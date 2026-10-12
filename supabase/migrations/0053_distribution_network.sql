-- ============================================================
--  0053: 3단계 유통 네트워크 (총판 → 영업점 → 리셀러)
--  - 관리자가 총판 등록 + (총판 × 플랜/상품별) 지급률(%) 설정
--  - 총판이 배분비율(총판:영업점:리셀러) 설정, 총판→영업점→리셀러 하위 등록
--  - 수당 원장/정산은 기존 marketer_commissions / marketer_settlements 재사용
--    (멱등키만 payment×수혜자 / order×수혜자로 확장 → 결제 1건이 여러 수혜자 행)
--  Idempotent. Requires 0023(marketers), 0008(payments), 0016(referrals), 0022(products), 0004(is_admin).
-- ============================================================

-- ---------- 1) 네트워크 멤버 (계층) ----------
create table if not exists public.network_members (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  role             text not null check (role in ('distributor','agency','reseller')),
  -- 상위 멤버. 총판은 null. 영업점의 상위=총판, 리셀러의 상위=영업점.
  parent_id        uuid references public.network_members (user_id) on delete set null,
  -- 루트 총판(배분비율·지급률의 기준). 총판 행은 자기 자신을 가리킨다.
  distributor_id   uuid not null references public.network_members (user_id) on delete cascade,
  status           text not null default 'active' check (status in ('active','suspended')),
  -- 배분비율(0~100). 루트 총판 행의 값이 서브트리 전체를 지배한다. 합계 100 권장(앱에서 검증).
  split_distributor integer not null default 100 check (split_distributor between 0 and 100),
  split_agency      integer not null default 0   check (split_agency between 0 and 100),
  split_reseller    integer not null default 0   check (split_reseller between 0 and 100),
  -- 정산 정보
  payout_type      text not null default 'freelancer' check (payout_type in ('freelancer','business')),
  bank_name        text,
  bank_account     text,
  account_holder   text,
  tax_id           text,
  memo             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists nm_parent_idx on public.network_members (parent_id);
create index if not exists nm_distributor_idx on public.network_members (distributor_id);
alter table public.network_members enable row level security;
drop policy if exists nm_select on public.network_members;
-- 본인 / 직속 하위(parent=self) / 서브트리(루트 총판=self) / 관리자 조회. 쓰기는 service role.
create policy nm_select on public.network_members
  for select to authenticated using (
    user_id = auth.uid()
    or parent_id = auth.uid()
    or distributor_id = auth.uid()
    or public.is_admin()
  );

-- ---------- 2) 총판별 지급률 (관리자 설정) ----------
create table if not exists public.distributor_rates (
  id                  uuid primary key default gen_random_uuid(),
  distributor_user_id uuid not null references public.network_members (user_id) on delete cascade,
  item_type           text not null check (item_type in ('subscription_plan','product')),
  item_key            text not null,              -- plan id('basic'/'pro') 또는 product id(uuid text)
  rate_pct            integer not null default 0 check (rate_pct between 0 and 100),
  active              boolean not null default true,
  updated_at          timestamptz not null default now(),
  unique (distributor_user_id, item_type, item_key)
);
alter table public.distributor_rates enable row level security;
drop policy if exists dr_select on public.distributor_rates;
-- 지급률은 민감정보가 아니므로 로그인 사용자 조회 허용(멤버가 자기 기준 확인). 쓰기는 service role.
create policy dr_select on public.distributor_rates
  for select to authenticated using (true);

-- ---------- 3) 수당 원장(marketer_commissions) 확장 ----------
-- 기존 행 보존. 새 네트워크 적립 행은 role_at_sale/seller_user_id/pool_amount/rate_pct를 채우고
-- rank_at_sale(레거시)은 null로 둔다.
alter table public.marketer_commissions
  alter column rank_at_sale drop not null;
alter table public.marketer_commissions
  drop constraint if exists marketer_commissions_rank_at_sale_check;
alter table public.marketer_commissions
  add constraint marketer_commissions_rank_at_sale_check
  check (rank_at_sale is null or rank_at_sale in ('RESELLER','MAKER'));

alter table public.marketer_commissions
  add column if not exists role_at_sale   text check (role_at_sale in ('distributor','agency','reseller')),
  add column if not exists seller_user_id uuid references auth.users (id) on delete set null,
  add column if not exists pool_amount    integer,
  add column if not exists rate_pct       integer;

-- 멱등 인덱스 교체: 결제/주문 1건당 수혜자별 1행 허용.
drop index if exists public.mc_sub_once;
drop index if exists public.mc_prod_once;
create unique index if not exists mc_sub_once
  on public.marketer_commissions (payment_id, marketer_id) where source_type = 'subscription';
create unique index if not exists mc_prod_once
  on public.marketer_commissions (product_order_id, marketer_id) where source_type = 'product';
