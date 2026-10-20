-- 0084: 디자이너 템플릿 판매/정산(E1) — 발행→판매→소유권→디자이너 정산.
-- 결제는 기존 PortOne 상품 경로 재사용(products + /pay/{slug} + fulfillProductOrder).
-- 쓰기는 서비스롤/관리자(정책 없음), 읽기만 RLS로 공개/소유 범위 제한.

-- 상품 ↔ 템플릿 버전 연결(발행 시 상품을 만들고 이 컬럼으로 묶는다).
alter table public.products
  add column if not exists grants_template_version uuid
  references public.template_versions(id) on delete set null;

-- 발행된 템플릿 버전 공개 읽기(스토어·미리보기) — 0079에서 미룬 정책.
drop policy if exists tv_public_read on public.template_versions;
create policy tv_public_read on public.template_versions
  for select using (status = 'published');

-- 판매 등록(리스팅) — 발행된 버전 1개당 1개.
create table if not exists public.template_listings (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.design_templates(id) on delete cascade,
  version_id       uuid not null references public.template_versions(id) on delete cascade,
  designer_user_id uuid not null references auth.users(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  title            text not null default '',
  summary          text,
  price_krw        integer not null check (price_krw >= 0),
  commission_pct   integer not null default 30 check (commission_pct between 0 and 100),
  status           text not null default 'active' check (status in ('active','paused')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(version_id)
);
alter table public.template_listings enable row level security;
drop policy if exists tl_read on public.template_listings;
create policy tl_read on public.template_listings
  for select using (
    status = 'active' or designer_user_id = auth.uid() or public.is_admin()
  );
create index if not exists template_listings_status_idx
  on public.template_listings (status, created_at desc);
create index if not exists template_listings_designer_idx
  on public.template_listings (designer_user_id, created_at desc);

-- 구매(소유권) — 구매자 ↔ 템플릿 버전. order_id로 멱등.
create table if not exists public.template_sales (
  id                  uuid primary key default gen_random_uuid(),
  buyer_user_id       uuid references auth.users(id) on delete set null,
  buyer_email         text,
  listing_id          uuid references public.template_listings(id) on delete set null,
  template_version_id uuid references public.template_versions(id) on delete set null,
  order_id            text not null,
  amount_krw          integer not null check (amount_krw >= 0),
  created_at          timestamptz not null default now(),
  unique(order_id)
);
alter table public.template_sales enable row level security;
drop policy if exists tp_select on public.template_sales;
create policy tp_select on public.template_sales
  for select using (buyer_user_id = auth.uid() or public.is_admin());
create index if not exists template_sales_buyer_idx
  on public.template_sales (buyer_user_id, created_at desc);

-- 디자이너 정산 원장(partner_earnings 미러) — 구매 1건당 1개.
create table if not exists public.designer_earnings (
  id               uuid primary key default gen_random_uuid(),
  designer_user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id      uuid references public.template_sales(id) on delete cascade,
  listing_id       uuid references public.template_listings(id) on delete set null,
  gross_krw        integer not null check (gross_krw >= 0),
  commission_pct   integer not null,
  net_krw          integer not null check (net_krw >= 0),
  status           text not null default 'pending' check (status in ('pending','paid')),
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique(purchase_id)
);
alter table public.designer_earnings enable row level security;
drop policy if exists de_select on public.designer_earnings;
create policy de_select on public.designer_earnings
  for select using (designer_user_id = auth.uid() or public.is_admin());
create index if not exists designer_earnings_status_idx
  on public.designer_earnings (status, created_at desc);
