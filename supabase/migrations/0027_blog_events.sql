-- ============================================================
--  0027: 블로그 이벤트 (쿠폰발행 + 연락문의)
-- ============================================================
-- 블로그 글에 붙는 "이벤트" 모듈. 글 하나에 이벤트 설정 1개(blog_events)를 두고,
-- 쿠폰(coupon_*) / 연락문의(contact_enabled) 모듈을 각각 켤 수 있다.
-- - 방문자는 STORYUP 로그인 상태가 아니므로 쿠폰 수령(coupon_claims insert)은
--   서버 액션(service role)에서 검증 후 수행하고, RLS는 글 주인의 읽기·관리만 연다.
-- - 연락문의는 별도 테이블을 만들지 않고 기존 site_inquiries를 재사용한다
--   (blog_post_id 컬럼만 추가해 랜딩페이지 문의와 같은 문의함에서 관리).

-- ---------- blog_events: 글당 이벤트 설정 ----------
create table if not exists public.blog_events (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null unique references public.blog_posts (id) on delete cascade,
  business_id        uuid not null references public.businesses (id) on delete cascade,
  -- 쿠폰 모듈
  coupon_enabled     boolean not null default false,
  coupon_benefit     text,                 -- 혜택 내용 (예: "아메리카노 1잔 무료")
  coupon_issued_on   date,                 -- 발행일자 (이 날짜부터 수령 가능; null=즉시)
  coupon_limit       integer,              -- 사용한도 = 총 발급 수량 상한 (null=무제한)
  coupon_valid_from  date,                 -- 사용기간 시작
  coupon_valid_until date,                 -- 사용기간 종료
  -- 연락문의 모듈
  contact_enabled    boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint blog_events_coupon_limit_positive check (coupon_limit is null or coupon_limit > 0)
);
create index if not exists blog_events_business_idx
  on public.blog_events (business_id);
create or replace trigger blog_events_updated_at before update on public.blog_events
  for each row execute function public.set_updated_at();

alter table public.blog_events enable row level security;

-- 글 주인만 자기 비즈니스의 이벤트를 관리한다.
drop policy if exists blog_events_owner_all on public.blog_events;
create policy blog_events_owner_all on public.blog_events
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- 공개 글의 이벤트 설정은 누구나 읽을 수 있다 (공개 페이지가 모듈을 렌더).
drop policy if exists blog_events_public_read on public.blog_events;
create policy blog_events_public_read on public.blog_events
  for select using (
    exists (
      select 1 from public.blog_posts p
      where p.id = blog_events.post_id and p.status = 'published'
    )
  );

-- ---------- coupon_claims: 쿠폰 수령자 (본인확인 = 이름+전화) ----------
create table if not exists public.coupon_claims (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.blog_events (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  phone       text not null,
  code        text not null,        -- 수령 코드 (매장에서 대조용)
  used_at     timestamptz,          -- 사장님이 사용처리한 시각
  created_at  timestamptz not null default now(),
  unique (event_id, phone)          -- 본인확인: 같은 전화번호는 이벤트당 1매
);
create index if not exists coupon_claims_event_idx
  on public.coupon_claims (event_id, created_at desc);
create index if not exists coupon_claims_business_idx
  on public.coupon_claims (business_id, created_at desc);

alter table public.coupon_claims enable row level security;

-- 수령(insert)은 서버 액션(service role)만 → 공개 insert 정책 없음.
-- 글 주인은 자기 비즈니스의 수령자를 읽고, 사용처리(update)하고, 삭제할 수 있다.
drop policy if exists coupon_claims_owner_read on public.coupon_claims;
create policy coupon_claims_owner_read on public.coupon_claims
  for select using (public.owns_business(business_id));

drop policy if exists coupon_claims_owner_update on public.coupon_claims;
create policy coupon_claims_owner_update on public.coupon_claims
  for update using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists coupon_claims_owner_delete on public.coupon_claims;
create policy coupon_claims_owner_delete on public.coupon_claims
  for delete using (public.owns_business(business_id));

-- ---------- 연락문의: 기존 site_inquiries 재사용 ----------
-- 블로그 이벤트의 연락문의를 랜딩페이지 문의와 같은 문의함에서 보되,
-- 어느 글에서 왔는지 구분할 수 있도록 blog_post_id를 붙인다 (null이면 랜딩페이지 문의).
alter table public.site_inquiries
  add column if not exists blog_post_id uuid references public.blog_posts (id) on delete set null;

-- ---------- 알림 타입에 coupon_claim 추가 ----------
-- 방문자가 쿠폰을 받으면 글 주인에게 앱 내 알림을 남긴다 (site_inquiry와 동일 경로).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('blog_comment', 'blog_like', 'site_inquiry', 'coupon_claim'));
