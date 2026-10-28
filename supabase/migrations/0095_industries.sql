-- 업종별 특화 페이지 + 업종 추가 요청 + 관리자 검토.
-- 기존 INDUSTRIES 상수(사업장 태깅·showcase 필터)와 별개로, 관리자가 편집·발행하는
-- '업종 소개 페이지' 모델을 새로 둔다(초안/공개, 하위분류, 섹션/FAQ 콘텐츠, 기존 제작
-- 흐름으로의 매핑). 추가형 마이그레이션 — 기존 데이터에 영향 없음. 시드는 재실행 안전.

-- ---------------- 1) 업종(소개 페이지) ----------------
create table if not exists public.industries (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name_ko       text not null,
  name_en       text not null default '',
  icon          text not null default '',            -- 이모지 또는 아이콘 키
  summary_ko    text not null default '',            -- 한 줄 활용 설명
  summary_en    text not null default '',
  status        text not null default 'draft'
                  check (status in ('draft', 'published')),
  sort_order    int  not null default 100,
  parent_id     uuid references public.industries(id) on delete set null, -- 하위 분류
  -- 상세 콘텐츠(섹션/FAQ/예시) 오버라이드. null이면 코드 기본 콘텐츠(TS) 사용.
  content       jsonb,
  seo           jsonb,                               -- {title, description, keywords[]}
  -- '이 업종으로 시작하기'가 채울 기존 제작 흐름 기본값(사용자가 바꿀 수 있음).
  maps_category text,                                -- BusinessCategory (영문, AI용)
  maps_industry text,                                -- IndustryId (사용자용 분류)
  sensitive     boolean not null default false,      -- 의료·금융 등 전문가 검토 분야
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists industries_status_idx
  on public.industries (status, sort_order);
create index if not exists industries_parent_idx
  on public.industries (parent_id);

drop trigger if exists industries_set_updated_at on public.industries;
create trigger industries_set_updated_at before update on public.industries
  for each row execute function public.set_updated_at();

alter table public.industries enable row level security;
-- 공개된 업종만 누구나 조회. 관리자는 전부 조회·수정(서버 액션은 서비스롤로 쓰기).
drop policy if exists industries_public_read on public.industries;
create policy industries_public_read on public.industries
  for select using (status = 'published');
drop policy if exists industries_admin_all on public.industries;
create policy industries_admin_all on public.industries
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- 2) 업종 추가 요청 ----------------
create table if not exists public.industry_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,                       -- 요청 업종명(필수)
  description   text not null,                       -- 어떤 사업인지(필수)
  needs         text,                                -- 필요한 콘텐츠·기능(선택)
  ref_url       text,                                -- 참고 사이트(선택)
  status        text not null default 'received'
                  check (status in ('received', 'reviewing', 'adopted', 'rejected')),
  admin_note    text,                                -- 관리자 내부 메모(비공개)
  public_reply  text,                                -- 사용자에게 보여줄 답변
  linked_industry_id uuid references public.industries(id) on delete set null,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists industry_requests_status_idx
  on public.industry_requests (status, created_at desc);
create index if not exists industry_requests_user_idx
  on public.industry_requests (user_id, created_at desc);
-- 같은 사용자의 '처리 전(received·reviewing)' 동일 업종명 중복 접수 방지(재시도·중복클릭).
create unique index if not exists industry_requests_dedup_idx
  on public.industry_requests (user_id, lower(name))
  where status in ('received', 'reviewing');

drop trigger if exists industry_requests_set_updated_at on public.industry_requests;
create trigger industry_requests_set_updated_at before update on public.industry_requests
  for each row execute function public.set_updated_at();

alter table public.industry_requests enable row level security;
-- 본인 요청만 조회·작성. 수정/상태변경은 서비스롤(관리자 액션)만.
drop policy if exists industry_requests_own_read on public.industry_requests;
create policy industry_requests_own_read on public.industry_requests
  for select using (auth.uid() = user_id);
drop policy if exists industry_requests_own_insert on public.industry_requests;
create policy industry_requests_own_insert on public.industry_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists industry_requests_admin_read on public.industry_requests;
create policy industry_requests_admin_read on public.industry_requests
  for select using (public.is_admin());

-- ---------------- 3) 요청 처리 이력(감사) ----------------
create table if not exists public.industry_request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.industry_requests(id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    uuid references auth.users(id),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists industry_request_events_req_idx
  on public.industry_request_events (request_id, created_at);
alter table public.industry_request_events enable row level security;
-- 관리자만 조회(쓰기는 서비스롤).
drop policy if exists industry_request_events_admin on public.industry_request_events;
create policy industry_request_events_admin on public.industry_request_events
  for select using (public.is_admin());

-- ---------------- 4) 알림 타입 확장 ----------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'blog_comment'::text,
    'blog_like'::text,
    'site_inquiry'::text,
    'coupon_claim'::text,
    'sub_expiring'::text,
    'reservation'::text,
    'industry_request'::text
  ]));

-- ---------------- 5) 초기 13개 업종 시드(재실행 안전) ----------------
-- content/seo는 비워두고(코드 TS 기본 콘텐츠 사용) 메타데이터만 시드. 공개 상태로 시작.
insert into public.industries
  (slug, name_ko, name_en, icon, summary_ko, summary_en, status, sort_order,
   maps_category, maps_industry, sensitive)
values
  ('food-service','외식업','Food & Dining','🍽️','대표 메뉴·매장 이야기로 단골과 예약을 늘려요','Turn signature menus and your store story into regulars and reservations','published',10,'Restaurant','food',false),
  ('cafe','카페','Cafe','☕','시그니처 음료·공간·원두 이야기를 콘텐츠로','Share signature drinks, your space and bean stories','published',20,'Cafe','food',false),
  ('beauty','뷰티','Beauty','💄','디자이너·시술·가격을 믿음직하게 안내','Introduce designers, services and pricing with trust','published',30,'Beauty','beauty',false),
  ('medical','한의원/병원','Clinic & Hospital','🏥','진료 분야·의료진·건강 정보를 바르게 전달','Convey specialties, staff and health info responsibly','published',40,'Professional Service','service',true),
  ('education','교육업','Education','🎓','교육 철학·커리큘럼·강사를 설득력 있게','Present your philosophy, curriculum and instructors','published',50,'Education','education',false),
  ('it','IT','IT','💻','제품·기능·개발 사례로 데모를 유도','Drive demos with product, features and case studies','published',60,'Technology','tech',false),
  ('manufacturing','제조업','Manufacturing','🏭','제품·공정·인증·납품 사례로 B2B 문의를','Win B2B inquiries with products, process and certifications','published',70,'Other','manufacturing',false),
  ('real-estate','부동산','Real Estate','🏢','매물·지역 정보로 현장 방문을 늘려요','Grow visits with listings and local insight','published',80,'Professional Service','realestate',true),
  ('auto','자동차','Automotive','🚗','차량·정비·시승으로 상담을 늘려요','Grow consults with vehicles, service and test drives','published',90,'Retail','travel',false),
  ('finance','금융','Finance','🏦','서비스·금융 교육·상담으로 신뢰를','Build trust with services, education and consultations','published',100,'Professional Service','service',true),
  ('digital-asset','디지털자산','Digital Assets','🪙','프로젝트·기술·리스크를 투명하게 설명','Explain projects, tech and risks transparently','published',110,'Technology','tech',true),
  ('network-marketing','네트워크마케팅','Network Marketing','🌐','제품·사용법·사업 구조를 정확하게','Communicate products, usage and structure accurately','published',120,'Retail','retail',true),
  ('religion','종교','Religion','⛪','공동체·일정·말씀·소식을 따뜻하게','Warmly share community, schedule, messages and news','published',130,'Other','etc',false)
on conflict (slug) do nothing;
