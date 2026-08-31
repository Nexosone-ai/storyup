-- ============================================================
--  STORYUP — Phase 4: Card payments → point charging
--  (PortOne + Toss Payments) + packages + service prices
--  Idempotent. Run in Supabase SQL editor. Requires 0004.
-- ============================================================

-- ---------- 1) Ledger extensions (기존 point_transactions 확장) ----------
-- type: PURCHASE / BONUS / AI_USAGE / REFUND / ADMIN_CREDIT / ADMIN_DEBIT /
--       PROMOTION / WITHDRAWAL (기존 행은 null = 레거시 수익)
alter table public.point_transactions
  add column if not exists type text,
  add column if not exists metadata jsonb;

-- 결제 1건당 같은 종류의 적립은 단 한 번 (중복 크레딧 방지의 최종 방어선)
create unique index if not exists pt_payment_once
  on public.point_transactions (ref_id, type)
  where ref_type = 'payment';

-- ---------- 2) 충전 패키지 (관리자 구성 가능) ----------
create table if not exists public.point_packages (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  price_krw     integer not null check (price_krw > 0),
  credits       integer not null check (credits > 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.point_packages enable row level security;
drop policy if exists pp_select on public.point_packages;
create policy pp_select on public.point_packages
  for select to authenticated using (active or public.is_admin());
-- 쓰기는 service role(관리자 액션) 전용.

insert into public.point_packages (name, price_krw, credits, bonus_credits, sort_order)
values
  ('스타터',   10000,  10000, 0, 1),
  ('베이직',   30000,  30000, 0, 2),
  ('플러스',   50000,  50000, 0, 3),
  ('프로',    100000, 100000, 0, 4)
on conflict (name) do nothing;

-- ---------- 3) 결제 기록 ----------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  order_id       text not null unique,          -- 내부 주문 ID = PortOne paymentId
  package_id     uuid references public.point_packages (id),
  provider       text not null default 'portone',
  payment_method text,
  payment_key    text unique,                   -- provider 결제 식별자
  transaction_id text,                          -- PG(토스) 거래 ID
  currency       text not null default 'KRW',
  amount         integer not null check (amount > 0),
  credits        integer not null check (credits > 0),
  bonus_credits  integer not null default 0 check (bonus_credits >= 0),
  status         text not null default 'PENDING' check (status in
                   ('PENDING','PAID','FAILED','CANCELLED','PARTIALLY_CANCELLED','REFUNDED')),
  requested_at   timestamptz not null default now(),
  approved_at    timestamptz,
  cancelled_at   timestamptz,
  metadata       jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists pay_user_idx on public.payments (user_id, created_at desc);
create index if not exists pay_status_idx on public.payments (status);

alter table public.payments enable row level security;
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- 생성/갱신은 service role(서버) 전용 — 클라이언트가 결제 상태를 조작할 수 없다.

-- ---------- 4) AI 서비스 가격 (관리자 구성 가능; 0 = 무료) ----------
create table if not exists public.service_prices (
  service    text primary key,
  label      text not null,
  price      integer not null default 0 check (price >= 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.service_prices enable row level security;
drop policy if exists sp_select on public.service_prices;
create policy sp_select on public.service_prices
  for select to authenticated using (true);

-- 기존 사용자 경험을 깨지 않도록 전부 0원으로 시드. 관리자 화면에서 조정.
insert into public.service_prices (service, label, price) values
  ('AI_BRAND',         'AI 브랜드 스토리 생성', 0),
  ('AI_WEBSITE',       'AI 홈페이지 생성',     0),
  ('AI_BLOG',          'AI 블로그 생성',       0),
  ('SNS_CONTENT',      'SNS 게시물 생성',      0),
  ('CARD_NEWS',        '카드뉴스 생성',        0),
  ('IMAGE_GENERATION', 'AI 이미지 생성',       0)
on conflict (service) do nothing;

-- ---------- 5) 안전한 포인트 차감 (동시 요청 이중지출 방지) ----------
create or replace function public.spend_points(
  p_user uuid,
  p_amount integer,
  p_reason text,
  p_type text default 'AI_USAGE',
  p_ref_type text default null,
  p_ref_id uuid default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  -- 같은 사용자의 차감을 직렬화해 잔액 검사~차감 사이의 경쟁을 차단
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select coalesce(sum(amount), 0) into v_balance
    from public.point_transactions where user_id = p_user;
  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_POINTS';
  end if;
  insert into public.point_transactions (user_id, amount, reason, type, ref_type, ref_id)
    values (p_user, -p_amount, p_reason, p_type, p_ref_type, p_ref_id);
  return v_balance - p_amount;
end $$;

revoke all on function public.spend_points(uuid, integer, text, text, text, uuid) from public;
revoke all on function public.spend_points(uuid, integer, text, text, text, uuid) from anon;
revoke all on function public.spend_points(uuid, integer, text, text, text, uuid) from authenticated;
grant execute on function public.spend_points(uuid, integer, text, text, text, uuid) to service_role;
