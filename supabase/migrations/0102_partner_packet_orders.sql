-- ============================================================
--  0102: 파트너 패킷(크레딧) 구매 주문 — 카드결제(PortOne) / 계좌이체(청구서·수동 지급)
-- ============================================================
-- 1패킷 = 공급가 100원, VAT 별도(10%) → 청구 110원/패킷.
-- 카드: product_orders(ord_) + syncProductOrder 퍼널 → fulfillPacketOrderPaid 가 자동 지급.
-- 계좌이체: 청구서(invoice_no) 발행 → 파트너 입금 → 관리자가 '입금 확인·지급'(수동) →
--          partner_credit_ledger 에 grant 행 추가. 지급 멱등 = granted_at 단일 전이.
-- 추가 전용(비파괴). Requires 0001(set_updated_at), 0004(is_admin), 0070(partner_credit_ledger).
-- 운영 반영은 별도 승인 후 SQL 에디터에서 실행.

create table if not exists public.partner_packet_orders (
  id               uuid primary key default gen_random_uuid(),
  partner_user_id  uuid not null references auth.users(id) on delete cascade,
  packets          integer not null check (packets > 0),
  unit_price_krw   integer not null default 100 check (unit_price_krw >= 0),  -- 공급가/패킷 스냅샷
  supply_krw       integer not null check (supply_krw >= 0),                  -- packets × unit
  vat_krw          integer not null default 0 check (vat_krw >= 0),
  total_krw        integer not null check (total_krw >= 0),                   -- 청구 합계
  method           text not null check (method in ('card','transfer')),
  status           text not null default 'pending'
                     check (status in ('pending','paid','cancelled')),
  order_id         text,                                   -- product_orders.order_id (card)
  invoice_no       text unique,                            -- 계좌이체 청구서 번호 PK-YYYYMMDD-XXXX
  depositor_name   text,                                   -- 입금자명(계좌이체)
  buyer_name       text,
  buyer_email      text,
  buyer_phone      text,
  admin_note       text,
  reviewed_by      uuid references auth.users(id),
  paid_at          timestamptz,
  granted_at       timestamptz,                            -- 패킷 지급 시각(멱등 키)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists partner_packet_orders_partner_idx
  on public.partner_packet_orders (partner_user_id, created_at desc);
create index if not exists partner_packet_orders_status_idx
  on public.partner_packet_orders (status, method, created_at desc);

drop trigger if exists partner_packet_orders_set_updated_at on public.partner_packet_orders;
create trigger partner_packet_orders_set_updated_at before update on public.partner_packet_orders
  for each row execute function public.set_updated_at();

alter table public.partner_packet_orders enable row level security;
-- 파트너 본인 조회 + 관리자 전체. 쓰기는 서비스롤(앱 액션이 가드).
drop policy if exists ppo_read on public.partner_packet_orders;
create policy ppo_read on public.partner_packet_orders
  for select to authenticated
  using (partner_user_id = auth.uid() or public.is_admin());
drop policy if exists ppo_admin on public.partner_packet_orders;
create policy ppo_admin on public.partner_packet_orders
  for all using (public.is_admin()) with check (public.is_admin());
