-- ============================================================
--  0098: 서브파트너(2차 파트너) — 계층 등록 + 3단계 가격 체인 + 다수 수혜자 정산
-- ============================================================
-- 본사 → 파트너 → 서브파트너 → 고객 3단계. 서브파트너는 partner 플랜 계정이면서
-- partner_subs 에 (상위파트너, 서브파트너)로 등록된 계정이다. 서브는 상위파트너의
-- 활성 상품을 '원가'로 삼아 자기 마진을 얹어 판다(가격 스냅샷 체인).
--
-- 추가 전용(비파괴). parent_* 컬럼이 전부 NULL 이면 기존 2단계 동작과 100% 동일하다.
-- Requires 0068(partner_clients), 0071(partner_earnings), 0096(partner_products/offers/invoices).
--
-- 운영 반영은 별도 승인 후 SQL 에디터에서 실행한다.

-- ---------------- 1) 서브파트너 레지스트리(상위파트너 ↔ 서브파트너) ----------------
-- 서브는 상위 1명만(unique on sub). created_by = 초대한 상위파트너.
create table if not exists public.partner_subs (
  id                      uuid primary key default gen_random_uuid(),
  parent_partner_user_id  uuid not null references auth.users(id) on delete cascade,
  sub_partner_user_id     uuid not null references auth.users(id) on delete cascade,
  status                  text not null default 'active'
                            check (status in ('active','suspended')),
  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (sub_partner_user_id)
);
create index if not exists partner_subs_parent_idx
  on public.partner_subs (parent_partner_user_id, status);

drop trigger if exists partner_subs_set_updated_at on public.partner_subs;
create trigger partner_subs_set_updated_at before update on public.partner_subs
  for each row execute function public.set_updated_at();

alter table public.partner_subs enable row level security;
-- 상위파트너 본인 + 서브 본인 + 관리자 조회. 쓰기는 서비스롤(앱 액션)/관리자.
drop policy if exists partner_subs_read on public.partner_subs;
create policy partner_subs_read on public.partner_subs
  for select using (
    parent_partner_user_id = auth.uid()
    or sub_partner_user_id = auth.uid()
    or public.is_admin()
  );
drop policy if exists partner_subs_admin on public.partner_subs;
create policy partner_subs_admin on public.partner_subs
  for all using (public.is_admin())
  with check (public.is_admin());

-- ---------------- 2) 가격 스냅샷 체인(상품/오퍼/청구서에 상위 참조 추가) ----------------
-- 서브파트너 상품: base_price_krw = 상위파트너 판매가(서브의 원가),
--                 parent_base_price_krw = 본사 공급가(상위의 원가 스냅샷),
--                 sell_price_krw = 최종 고객가. parent_* NULL = 기존 파트너 직접판매.
alter table public.partner_products
  add column if not exists parent_partner_user_id uuid references auth.users(id) on delete set null;
alter table public.partner_products
  add column if not exists parent_product_id      uuid references public.partner_products(id) on delete set null;
alter table public.partner_products
  add column if not exists parent_base_price_krw  integer;   -- 본사 공급가 스냅샷(서브 상품만)

alter table public.partner_offers
  add column if not exists parent_partner_user_id uuid references auth.users(id) on delete set null;
alter table public.partner_offers
  add column if not exists parent_base_price_krw  integer;

alter table public.partner_invoices
  add column if not exists parent_partner_user_id uuid references auth.users(id) on delete set null;
alter table public.partner_invoices
  add column if not exists parent_base_price_krw  integer;

create index if not exists partner_invoices_parent_idx
  on public.partner_invoices (parent_partner_user_id, status, created_at desc);

-- ---------------- 3) 정산: 청구서당 다수 수혜자 허용 ----------------
-- 서브 판매는 earnings 2행(서브파트너 net + 상위파트너 net)이 생긴다. 역할 컬럼을 더하고
-- 멱등 유니크를 (invoice_id) → (invoice_id, partner_user_id) 로 교체한다(중복 정산은 여전히 차단).
alter table public.partner_earnings
  add column if not exists beneficiary_role text not null default 'partner'
    check (beneficiary_role in ('partner','sub_partner'));

drop index if exists public.partner_earnings_invoice_once;
create unique index if not exists partner_earnings_invoice_beneficiary_once
  on public.partner_earnings (invoice_id, partner_user_id) where invoice_id is not null;
