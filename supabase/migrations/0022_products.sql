-- ============================================================
--  0022: PG 일반결제 — 상품 카탈로그 + 결제링크(익명 1회성 결제)
--  관리자가 상품을 등록하면 /pay/{slug} 링크를 고객에게 보내 결제.
--  포인트/구독과 무관한 순수 상품 판매(인보이스형). Idempotent. Requires 0008.
-- ============================================================

-- ---------- 1) 상품 카탈로그 (관리자 구성) ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                -- 공개 결제 URL: /pay/{slug}
  name        text not null,
  description text,
  price       integer not null check (price > 0),  -- KRW
  image_url   text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.products enable row level security;
-- 공개 결제 페이지는 서버(service role)로 상품을 읽는다 — anon RLS는 열지 않는다.
-- 관리자 화면에서의 직접 조회만 허용.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated using (public.is_admin());
-- 생성/수정/삭제는 service role(관리자 액션) 전용.

-- ---------- 2) 상품 주문 (익명 구매자 · 1회성 결제) ----------
create table if not exists public.product_orders (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null unique,                 -- 내부 주문 ID = PortOne paymentId (ord_…)
  product_id     uuid references public.products (id) on delete set null,
  product_name   text not null,                        -- 결제 시점 상품명 스냅샷
  amount         integer not null check (amount > 0),  -- 결제 시점 금액 스냅샷(KRW)
  currency       text not null default 'KRW',
  buyer_name     text,
  buyer_phone    text,
  buyer_email    text,
  provider       text not null default 'portone',
  payment_method text,
  payment_key    text,
  transaction_id text,
  status         text not null default 'PENDING' check (status in
                   ('PENDING','PAID','FAILED','CANCELLED','PARTIALLY_CANCELLED','REFUNDED')),
  requested_at   timestamptz not null default now(),
  approved_at    timestamptz,
  cancelled_at   timestamptz,
  metadata       jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists po_created_idx on public.product_orders (created_at desc);
create index if not exists po_status_idx on public.product_orders (status);
create index if not exists po_product_idx on public.product_orders (product_id);

alter table public.product_orders enable row level security;
-- 구매자 개인정보(이름·연락처)를 담으므로 select 정책을 두지 않는다 → service role 전용.
-- 생성/갱신도 service role(서버) 전용 — 클라이언트가 결제 상태를 조작할 수 없다.
