-- ============================================================
--  0023: 마케터(리셀러/메이커) 조직 + 직급별 수당 + 월별 정산
--  귀속: 기존 referrals(추천코드) 재사용 + 상품주문 ref_marketer_id
--  Idempotent. Requires 0004(is_admin), 0008(payments), 0016(referrals), 0022(products).
-- ============================================================

-- ---------- 1) 마케터 (관리자가 지정) ----------
create table if not exists public.marketers (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  status         text not null default 'active' check (status in ('active','suspended')),
  -- 정산 유형: freelancer=3.3% 원천징수 / business=세금계산서 발행
  payout_type    text not null default 'freelancer' check (payout_type in ('freelancer','business')),
  -- 캐시된 직급(표시용). 권위 있는 판정은 유지중 정기결제 클라이언트 수로 계산.
  rank           text not null default 'RESELLER' check (rank in ('RESELLER','MAKER')),
  -- 정산 지급 정보 (선택)
  bank_name      text,
  bank_account   text,
  account_holder text,
  tax_id         text,   -- 사업자번호(계산서) 등. 민감정보 최소 저장.
  memo           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.marketers enable row level security;
drop policy if exists marketers_select_self on public.marketers;
create policy marketers_select_self on public.marketers
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- 지정/수정은 service role(관리자 액션) 전용.

-- ---------- 2) 직급별 상품 수당 정책 (관리자 설정) ----------
create table if not exists public.marketer_rewards (
  id            uuid primary key default gen_random_uuid(),
  item_type     text not null check (item_type in ('subscription_plan','product')),
  item_key      text not null,        -- plan id('basic'/'pro') 또는 product id(uuid text)
  rank          text not null check (rank in ('RESELLER','MAKER')),
  reward_amount integer not null default 0 check (reward_amount >= 0), -- KRW
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (item_type, item_key, rank)
);
alter table public.marketer_rewards enable row level security;
drop policy if exists marketer_rewards_select on public.marketer_rewards;
-- 수당표는 민감정보가 아니므로 로그인 사용자 조회 허용(마케터가 자기 수당 기준 확인). 쓰기는 service role.
create policy marketer_rewards_select on public.marketer_rewards
  for select to authenticated using (true);

-- ---------- 3) 수당 적립 원장 ----------
create table if not exists public.marketer_commissions (
  id               uuid primary key default gen_random_uuid(),
  marketer_id      uuid not null references auth.users (id) on delete cascade,
  source_type      text not null check (source_type in ('subscription','product')),
  payment_id       uuid references public.payments (id) on delete set null,        -- 구독 결제
  product_order_id uuid references public.product_orders (id) on delete set null,  -- 상품 주문
  client_user_id   uuid references auth.users (id) on delete set null,             -- 구독 클라이언트
  item_key         text not null,      -- plan id 또는 product id
  item_label       text,               -- 표시용 스냅샷
  rank_at_sale     text not null check (rank_at_sale in ('RESELLER','MAKER')),
  gross_sale       integer not null default 0,  -- 매출(결제금액)
  amount           integer not null default 0,  -- 수당(스냅샷)
  status           text not null default 'pending' check (status in ('pending','settled','paid','void')),
  settlement_id    uuid,               -- 정산 배치 id (순환 FK 회피 위해 참조만)
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
-- 멱등: 구독 결제 1건당 수당 1건, 상품 주문 1건당 수당 1건
create unique index if not exists mc_sub_once
  on public.marketer_commissions (payment_id) where source_type = 'subscription';
create unique index if not exists mc_prod_once
  on public.marketer_commissions (product_order_id) where source_type = 'product';
create index if not exists mc_marketer_idx
  on public.marketer_commissions (marketer_id, occurred_at desc);
create index if not exists mc_status_idx on public.marketer_commissions (status);
create index if not exists mc_settlement_idx on public.marketer_commissions (settlement_id);
alter table public.marketer_commissions enable row level security;
drop policy if exists mc_select_self on public.marketer_commissions;
create policy mc_select_self on public.marketer_commissions
  for select to authenticated using (marketer_id = auth.uid() or public.is_admin());

-- ---------- 4) 월별 정산 배치 ----------
create table if not exists public.marketer_settlements (
  id               uuid primary key default gen_random_uuid(),
  marketer_id      uuid not null references auth.users (id) on delete cascade,
  period           text not null,            -- 'YYYY-MM'
  payout_type      text not null,            -- 정산 시점 유형 스냅샷
  gross            integer not null default 0,  -- 수당 합계
  tax              integer not null default 0,  -- 원천징수(프리랜서 3.3%)
  net              integer not null default 0,  -- 실지급액
  commission_count integer not null default 0,
  status           text not null default 'open' check (status in ('open','paid')),
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (marketer_id, period)
);
alter table public.marketer_settlements enable row level security;
drop policy if exists ms_select_self on public.marketer_settlements;
create policy ms_select_self on public.marketer_settlements
  for select to authenticated using (marketer_id = auth.uid() or public.is_admin());

-- ---------- 5) 상품 주문에 마케터 귀속 (익명 결제링크의 ?ref=코드) ----------
alter table public.product_orders
  add column if not exists ref_marketer_id uuid references auth.users (id) on delete set null;
