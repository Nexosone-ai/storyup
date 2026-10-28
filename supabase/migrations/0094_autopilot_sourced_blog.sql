-- 오토파일럿 블로그 — 글감 소스(URL/PDF) + '검토 후 예약 자동발행' 모드.
-- autonomy에 'review' 추가: AI가 소스에 근거해 초안을 만들어 검토창에 올리고
-- scheduled_at(검토 창 N시간 뒤)에 기존 /api/cron/publish가 자동 발행한다.
-- 파트너 관리자는 그 사이 초안을 보고 수정·지금발행·보류·삭제할 수 있다.

-- 1) autonomy 'review' 허용 + 검토 창(시간) 컬럼.
alter table public.agent_routines
  drop constraint if exists agent_routines_autonomy_check;
alter table public.agent_routines
  add constraint agent_routines_autonomy_check
  check (autonomy in ('propose', 'auto', 'review'));
alter table public.agent_routines
  add column if not exists review_hours int not null default 24;

-- 2) 오토파일럿이 '검토' 모드로 만든 예약 발행 글 식별(검토 큐).
--    status='draft' + scheduled_at + autopilot_routine_id not null = 검토 대기.
alter table public.blog_posts
  add column if not exists autopilot_routine_id uuid
    references public.agent_routines(id) on delete set null;
create index if not exists blog_posts_autopilot_idx
  on public.blog_posts (business_id, autopilot_routine_id)
  where autopilot_routine_id is not null;

-- 3) 글감 소스 — URL/PDF에서 추출한 텍스트를 사업장 단위로 보관.
create table if not exists public.agent_blog_sources (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind        text not null check (kind in ('url', 'pdf')),
  url         text,
  title       text not null default '',
  text        text not null default '',
  char_count  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists agent_blog_sources_biz_idx
  on public.agent_blog_sources (business_id, created_at desc);

alter table public.agent_blog_sources enable row level security;
-- 소유자(대행 파트너=owns_business)가 CRUD, 관리자 조회. 오토파일럿은 서비스롤로 읽는다.
drop policy if exists agent_blog_sources_own on public.agent_blog_sources;
create policy agent_blog_sources_own on public.agent_blog_sources
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
drop policy if exists agent_blog_sources_admin on public.agent_blog_sources;
create policy agent_blog_sources_admin on public.agent_blog_sources
  for select using (public.is_admin());
