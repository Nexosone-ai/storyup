-- ============================================================
--  STORYUP — 정기결제(빌링키) + 체험 구독
--  Idempotent. Run in Supabase SQL editor. Requires 0008, 0012.
--  구독 결제는 payments에 kind='subscription' metadata로 기록되고
--  포인트 적립은 기존 grant_plan_points(월 멱등)로만 이뤄진다.
-- ============================================================

-- 1) subscriptions: 빌링키·해지 예약·갱신 실패 카운트
alter table public.subscriptions
  add column if not exists billing_key text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists billing_failures integer not null default 0,
  add column if not exists trial boolean not null default false;

-- 상태 확장: past_due(갱신 실패), expired(기간 종료)
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active','canceled','past_due','expired'));

-- 2) payments: 구독 결제는 포인트 적립이 없으므로 credits=0 허용
alter table public.payments drop constraint if exists payments_credits_check;
alter table public.payments
  add constraint payments_credits_check check (credits >= 0);
