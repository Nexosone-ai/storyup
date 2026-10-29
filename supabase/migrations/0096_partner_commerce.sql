-- ============================================================
--  0096: B2B2C 파트너 커머스 — 요금제 연동 상품 + 스토어프론트 + 오퍼/청구서 + 정산 확장
-- ============================================================
-- 파트너가 기존 요금제(기본요금·한도 불변) 위에 자기 판매가·마진을 붙여 '상품'으로 팔고,
-- 고객에게 토큰 기반 오퍼/청구서를 제시한다. 수납은 기존 PortOne(본사 수납), 정산은 기존
-- partner_earnings 를 확장해 공제항목(기본요금/PG수수료/세금)·보류를 분리 기록한다.
--
-- 추가 전용(비파괴). 기존 agency 견적(agency_quotes)과 공존하며 아무 것도 대체하지 않는다.
-- Requires 0001(profiles/businesses/set_updated_at), 0004(is_admin), 0022(product_orders),
--          0068(partner_clients/owns_business), 0071(partner_earnings).
--
-- 운영 반영은 별도 승인 후 SQL 에디터에서 실행한다.

-- ---------------- 1) 파트너 스토어프론트(공개 소개 페이지) ----------------
-- /partners/{slug} 공개 페이지. 로고·소개·연락처만 공개(가격 없음).
create table if not exists public.partner_storefronts (
  partner_user_id uuid primary key references auth.users(id) on delete cascade,
  slug          text not null unique,
  display_name  text not null,
  logo_url      text,
  intro         text,
  contact       text,                                 -- 이메일/전화/카카오 등
  seller_info   text,                                 -- 실제 판매자 표기(수납 주체는 STORYUP)
  status        text not null default 'active'
                  check (status in ('active','hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists partner_storefronts_slug_idx
  on public.partner_storefronts (slug) where status = 'active';

drop trigger if exists partner_storefronts_set_updated_at on public.partner_storefronts;
create trigger partner_storefronts_set_updated_at before update on public.partner_storefronts
  for each row execute function public.set_updated_at();

alter table public.partner_storefronts enable row level security;
-- 공개(active)만 누구나 조회. 파트너 본인 전체 + 관리자 전체.
drop policy if exists partner_storefronts_public_read on public.partner_storefronts;
create policy partner_storefronts_public_read on public.partner_storefronts
  for select using (status = 'active');
drop policy if exists partner_storefronts_self on public.partner_storefronts;
create policy partner_storefronts_self on public.partner_storefronts
  for all using (partner_user_id = auth.uid() or public.is_admin())
  with check (partner_user_id = auth.uid() or public.is_admin());

-- ---------------- 2) 파트너 상품(요금제 연동 판매가) ----------------
-- 기본요금(plans.ts)은 불변. 상품은 판매가·부가세·청구방식·유효기간·조건만 파트너가 정한다.
-- base_* 는 발행 시점 기본요금 스냅샷(참조·경고·정산 공제용). 최저가 제한 없음(판매가<기본요금 경고만).
create table if not exists public.partner_products (
  id              uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  included_services text,                              -- 포함 서비스 설명(고객 노출)
  base_plan       text check (base_plan in ('basic','pro')),  -- 연결 요금제(null = 요금제 미연동 커스텀)
  base_plan_version text,                              -- 기준가 버전 스냅샷(config.PLAN_PRICE_VERSION)
  base_price_krw  integer not null default 0 check (base_price_krw >= 0), -- 기본요금 스냅샷(참조)
  sell_price_krw  integer not null check (sell_price_krw >= 0),           -- 고객 판매가
  currency        text not null default 'KRW',
  vat_mode        text not null default 'included' check (vat_mode in ('included','excluded')),
  billing_type    text not null default 'one_time' check (billing_type in ('one_time','recurring')),
  billing_period  text check (billing_period in ('monthly')),            -- recurring 시 주기
  valid_from      date,
  valid_until     date,
  scope           text,                                -- 제공 범위
  terms           text,                                -- 취소·환불 조건
  status          text not null default 'draft'
                    check (status in ('draft','active','archived')),
  sort_order      integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists partner_products_owner_idx
  on public.partner_products (partner_user_id, status, sort_order);

drop trigger if exists partner_products_set_updated_at on public.partner_products;
create trigger partner_products_set_updated_at before update on public.partner_products
  for each row execute function public.set_updated_at();

alter table public.partner_products enable row level security;
-- 파트너 본인 상품만 + 관리자 전체. (고객에겐 상품을 직접 노출하지 않고 오퍼로만 제시)
drop policy if exists partner_products_self on public.partner_products;
create policy partner_products_self on public.partner_products
  for all using (partner_user_id = auth.uid() or public.is_admin())
  with check (partner_user_id = auth.uid() or public.is_admin());

-- ---------------- 3) 파트너 오퍼(고객별 제시/가격 조정, 토큰) ----------------
-- 상품을 특정 고객에게 제시. 모든 금액·조건을 스냅샷해 이후 상품 변경과 무관하게 한다.
-- /offers/{token} — 추측 불가 토큰 + 만료. URL의 ID 치환으로 타 자료 접근 불가(토큰만 유효).
create table if not exists public.partner_offers (
  id              uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id  uuid references auth.users(id) on delete set null,  -- 수락/연결 시
  product_id      uuid references public.partner_products(id) on delete set null,
  token           text not null unique,                -- 공개 보안 토큰
  name            text not null,                        -- 스냅샷
  description     text,
  included_services text,
  base_plan       text,                                 -- 스냅샷
  base_plan_version text,
  base_price_krw  integer not null default 0,
  sell_price_krw  integer not null check (sell_price_krw >= 0),  -- 고객별 최종 판매가
  currency        text not null default 'KRW',
  vat_mode        text not null default 'included',
  billing_type    text not null default 'one_time',
  billing_period  text,
  valid_until     timestamptz,                          -- 오퍼 만료
  status          text not null default 'draft'
                    check (status in ('draft','sent','accepted','expired','void')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists partner_offers_owner_idx
  on public.partner_offers (partner_user_id, created_at desc);
create index if not exists partner_offers_client_idx
  on public.partner_offers (client_user_id, created_at desc);

drop trigger if exists partner_offers_set_updated_at on public.partner_offers;
create trigger partner_offers_set_updated_at before update on public.partner_offers
  for each row execute function public.set_updated_at();

alter table public.partner_offers enable row level security;
-- 파트너 본인 + 배정 고객 본인 + 관리자. (공개 토큰 페이지는 서비스롤 SSR로 조회 — RLS 비의존)
drop policy if exists partner_offers_access on public.partner_offers;
create policy partner_offers_access on public.partner_offers
  for select using (
    partner_user_id = auth.uid() or client_user_id = auth.uid() or public.is_admin()
  );
drop policy if exists partner_offers_write on public.partner_offers;
create policy partner_offers_write on public.partner_offers
  for all using (partner_user_id = auth.uid() or public.is_admin())
  with check (partner_user_id = auth.uid() or public.is_admin());

-- ---------------- 4) 파트너 청구서(확정·스냅샷 동결) ----------------
-- 견적(오퍼) → 확정 청구 → 결제대기 → 납부확인 → 활성화. 발행 후 상품/판매가 변경과 무관(스냅샷).
-- /invoices/{token}. order_id 는 기존 product_orders 와 1:1(결제 연결, 중복 방지).
create table if not exists public.partner_invoices (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid references public.partner_offers(id) on delete set null,
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id  uuid references auth.users(id) on delete set null,
  token           text not null unique,
  number          text not null unique,                 -- 인보이스 번호(표시용)
  product_snapshot jsonb not null,                       -- 상품명·포함서비스·요금제·버전 동결
  sell_price_krw  integer not null check (sell_price_krw >= 0),
  base_price_krw  integer not null default 0,            -- 기본요금 스냅샷(정산 공제 기준)
  tax_krw         integer not null default 0,
  currency        text not null default 'KRW',
  vat_mode        text not null default 'included',
  billing_type    text not null default 'one_time',
  billing_period  text,
  period_start    date,
  period_end      date,
  seller_name     text,                                  -- 판매자(파트너) 스냅샷
  seller_info     text,
  collector_info  text not null default 'STORYUP',       -- 수납 주체(본사)
  status          text not null default 'issued'
                    check (status in ('issued','pending_payment','paid','void','refunded')),
  order_id        text unique,                           -- product_orders.order_id (결제 1:1)
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists partner_invoices_owner_idx
  on public.partner_invoices (partner_user_id, status, created_at desc);
create index if not exists partner_invoices_client_idx
  on public.partner_invoices (client_user_id, created_at desc);

drop trigger if exists partner_invoices_set_updated_at on public.partner_invoices;
create trigger partner_invoices_set_updated_at before update on public.partner_invoices
  for each row execute function public.set_updated_at();

alter table public.partner_invoices enable row level security;
-- 파트너 본인 + 고객 본인 + 관리자. (공개 토큰 페이지는 서비스롤 SSR, 결제·개인정보는 고객 인증 후)
drop policy if exists partner_invoices_access on public.partner_invoices;
create policy partner_invoices_access on public.partner_invoices
  for select using (
    partner_user_id = auth.uid() or client_user_id = auth.uid() or public.is_admin()
  );
drop policy if exists partner_invoices_write on public.partner_invoices;
create policy partner_invoices_write on public.partner_invoices
  for all using (partner_user_id = auth.uid() or public.is_admin())
  with check (partner_user_id = auth.uid() or public.is_admin());

-- ---------------- 5) 청구/정정 이력(감사 — 금융기록 삭제 금지, 정정은 추가) ----------------
create table if not exists public.partner_invoice_events (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.partner_invoices(id) on delete cascade,
  from_status text,
  to_status   text not null,
  amount_krw  integer,
  actor_id    uuid references auth.users(id),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists partner_invoice_events_inv_idx
  on public.partner_invoice_events (invoice_id, created_at);

alter table public.partner_invoice_events enable row level security;
-- 파트너 본인 청구서의 이력 + 관리자. 쓰기는 서비스롤(앱 액션).
drop policy if exists partner_invoice_events_read on public.partner_invoice_events;
create policy partner_invoice_events_read on public.partner_invoice_events
  for select using (
    public.is_admin() or exists (
      select 1 from public.partner_invoices inv
      where inv.id = invoice_id
        and (inv.partner_user_id = auth.uid() or inv.client_user_id = auth.uid())
    )
  );

-- ---------------- 6) 정산 원장 확장(partner_earnings) ----------------
-- 기존 agency 견적 정산(quote_id)과 공존. 상품 청구서(invoice_id) 정산을 더하고,
-- 공제항목(기본요금/PG수수료/세금)과 'held'(보류) 상태를 분리 기록한다. 전부 추가 컬럼.
alter table public.partner_earnings
  add column if not exists invoice_id        uuid references public.partner_invoices(id) on delete set null;
alter table public.partner_earnings
  add column if not exists gross_krw          integer;   -- 고객 결제금액(총액)
alter table public.partner_earnings
  add column if not exists base_deduction_krw integer;   -- 본사 기본요금 공제
alter table public.partner_earnings
  add column if not exists pg_fee_krw         integer not null default 0;
alter table public.partner_earnings
  add column if not exists tax_krw            integer not null default 0;

-- status: pending|paid → pending|held|paid (보류 추가). 기존 제약 교체.
alter table public.partner_earnings drop constraint if exists partner_earnings_status_check;
alter table public.partner_earnings add constraint partner_earnings_status_check
  check (status in ('pending','held','paid'));

-- 청구서당 정산 1건(중복 정산 방지). invoice_id 있는 행만.
create unique index if not exists partner_earnings_invoice_once
  on public.partner_earnings (invoice_id) where invoice_id is not null;
