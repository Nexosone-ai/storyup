-- ============================================================
--  0074: 유료고객 AI 영상 — 월 무료 패킷(횟수) + 구매 크레딧 + fal 작업
-- ============================================================
-- 유료고객(Basic/Pro)이 AI 영상을 생성한다. 무료는 월 횟수(usage_events kind='video'),
-- 초과는 구매 크레딧(video_credit_ledger). fal 비동기 작업은 video_jobs로 추적.
-- 추가 전용(비파괴) — SQL 에디터 실행 가능. Requires 0012(usage_events), 0022(products), 0001(owns_business).

-- usage_events에 'video' kind 허용(0059에서 shorts 추가한 패턴).
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('site','blog_post','card_news','ai_image','shorts','video'));

-- 구매한 영상 크레딧 원장(구매 +N, 소비 −1). 잔액 = sum(amount).
create table if not exists public.video_credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  amount     integer not null,
  reason     text,
  ref_type   text,
  created_at timestamptz not null default now()
);
create index if not exists video_credit_ledger_user_idx
  on public.video_credit_ledger (user_id, created_at desc);
alter table public.video_credit_ledger enable row level security;
drop policy if exists video_credit_ledger_self on public.video_credit_ledger;
create policy video_credit_ledger_self on public.video_credit_ledger
  for select using (user_id = auth.uid() or public.is_admin());

-- 영상 팩 상품(결제 시 영상 크레딧 지급).
alter table public.products
  add column if not exists grants_video_credits integer not null default 0;

-- fal 비동기 영상 작업.
create table if not exists public.video_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  prompt       text not null,
  status       text not null default 'processing'
                 check (status in ('processing','done','failed')),
  request_id   text,
  status_url   text,
  response_url text,
  video_url    text,
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists video_jobs_biz_idx on public.video_jobs (business_id, created_at desc);
alter table public.video_jobs enable row level security;
drop policy if exists video_jobs_own on public.video_jobs;
create policy video_jobs_own on public.video_jobs
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- 영상 팩 상품 시드(관리자 화면에서 조정 가능).
insert into public.products (slug, name, description, price, active, grants_video_credits, sort_order) values
  ('video-pack-10', 'AI 영상 10편 팩', 'AI 영상 생성 10편 추가', 9900, true, 10, 50),
  ('video-pack-30', 'AI 영상 30편 팩', 'AI 영상 생성 30편 추가', 27000, true, 30, 51)
on conflict (slug) do nothing;
