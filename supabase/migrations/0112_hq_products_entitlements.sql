-- ============================================================
--  0112: 본사 상품(hq_products) + 파트너 작업권(partner_entitlements) — 패킷 제도 종료
-- ============================================================
-- 사용자 결정(2026-11-11): 파트너 패킷(크레딧) 자가 구매·차감·지급을 전부 폐지한다.
--  · 관리자가 본사 상품(구성·공급가·결제 시 제공 플랜/작업권)을 등록
--  · 파트너는 본사 상품에 마진을 붙여 오퍼/청구서 → 고객 결제(본사 수납) → 마진 정산(기존 흐름)
--  · 결제 완료 시 상품에 포함된 "작업권"이 판매 파트너에게 자동 지급되고,
--    요약 쇼츠·유사영상·Lite 계정 생성은 패킷 대신 작업권을 소비한다.
--  · 기존 패킷 잔액은 작업권으로 1회 환산(아래 7). 옛 원장·단가·주문 테이블은 감사용으로 보존(드롭 금지).
-- 추가 전용(비파괴). Supabase SQL 편집기에서 실행 가능. Requires 0004(is_admin), 0096(partner_*), 0097.

-- ------------------------------------------------------------
-- 1) 작업권 서비스 키 레지스트리
-- ------------------------------------------------------------
create table if not exists public.entitlement_services (
  key         text primary key,
  label       text not null,
  unit_label  text not null default '건',
  description text,
  active      boolean not null default true,
  sort_order  integer not null default 100
);
alter table public.entitlement_services enable row level security;
drop policy if exists entitlement_services_select on public.entitlement_services;
create policy entitlement_services_select on public.entitlement_services
  for select to authenticated using (true);

insert into public.entitlement_services (key, label, unit_label, description, sort_order) values
  ('RECAP_SHORTS',     '블로그 요약 쇼츠', '편', '블로그 글 1개 → 내레이션 요약 쇼츠 1편(대본+음성). 카드뉴스 배경 재사용 시 추가 사용 없음', 10),
  ('EXTRA_IMAGE',      'AI 이미지',        '장', '요약 쇼츠 장면용 AI 이미지 1장(고화질)', 20),
  ('SIMILAR_VIDEO',    '유사영상 10편',    '회', '원본 영상 1개로 유사영상 10편 1회(480p·5초 기준). 길이 배수(10초 ×2 …) × 화질 배수(720p ×2, 1080p ×5)만큼 사용', 30),
  ('LITE_ACCOUNT_30D', 'Lite 계정 30일',   '개', '별도계약 파트너의 고객 계정 직접 생성 또는 30일 연장 1회', 40)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 2) 본사 상품 + 결제 시 제공 항목
-- ------------------------------------------------------------
create table if not exists public.hq_products (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique,                  -- 안정 슬러그(basic | pro | recap_shorts_1 …)
  name              text not null,
  description       text,
  included_services text,                                  -- 줄바꿈 불릿(파트너·고객 노출)
  supply_price_krw  integer not null default 0 check (supply_price_krw >= 0),  -- 부가세 별도, 정산 시 본사 공제 기준
  vat_mode          text not null default 'excluded' check (vat_mode in ('included', 'excluded')),
  billing_type      text not null default 'one_time' check (billing_type in ('one_time', 'recurring')),
  billing_period    text check (billing_period in ('monthly')),
  grant_plan        text check (grant_plan in ('basic', 'pro', 'lite')),  -- null = 플랜 지급 없음
  grant_days        integer not null default 30 check (grant_days > 0),
  status            text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  sort_order        integer not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null
);
drop trigger if exists hq_products_set_updated_at on public.hq_products;
create trigger hq_products_set_updated_at
  before update on public.hq_products
  for each row execute function public.set_updated_at();

alter table public.hq_products enable row level security;
drop policy if exists hq_products_select on public.hq_products;
create policy hq_products_select on public.hq_products
  for select to authenticated using (status = 'active' or public.is_admin());
-- 쓰기는 서비스롤(관리자 서버 액션)만 — 정책 없음.

create table if not exists public.hq_product_items (
  id            uuid primary key default gen_random_uuid(),
  hq_product_id uuid not null references public.hq_products (id) on delete cascade,
  service_key   text not null references public.entitlement_services (key),
  units         integer not null check (units > 0),
  unique (hq_product_id, service_key)
);
alter table public.hq_product_items enable row level security;
drop policy if exists hq_product_items_select on public.hq_product_items;
create policy hq_product_items_select on public.hq_product_items
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.hq_products p where p.id = hq_product_id and p.status = 'active')
  );

-- ------------------------------------------------------------
-- 3) 시드 — 기존 base_plan_catalog(basic/pro) → hq_products(active), 서비스 상품 5종(draft, 자리표시 공급가)
-- ------------------------------------------------------------
insert into public.hq_products (key, name, description, included_services, supply_price_krw, grant_plan, grant_days, status, sort_order)
select plan, display_name, summary, included_services, supply_price_krw, plan, 30, 'active',
       case plan when 'basic' then 1 else 2 end
from public.base_plan_catalog
where plan in ('basic', 'pro')
on conflict (key) do nothing;

-- 카탈로그에 행이 없던 플랜의 폴백(plans.ts 기준값).
insert into public.hq_products (key, name, description, included_services, supply_price_krw, grant_plan, grant_days, status, sort_order) values
  ('basic', 'STORYUP 기본 상품 (Basic)', '소상공인 1사업장 마케팅 자동화 기본 상품', null, 20000, 'basic', 30, 'active', 1),
  ('pro',   'STORYUP Pro',               '상위 상품(자체 도메인·예약발행·고화질 이미지 300장)', null, 119000, 'pro', 30, 'active', 2)
on conflict (key) do nothing;

-- 서비스 상품 — 공급가는 자리표시(원가표 기준). 관리자가 '본사 상품' 화면에서 수정 후 판매 시작.
insert into public.hq_products (key, name, description, included_services, supply_price_krw, grant_plan, status, sort_order) values
  ('recap_shorts_1',   '블로그 요약 쇼츠 1편',           '블로그 글 1개를 30~40초 내레이션 요약 쇼츠로 제작', E'요약 쇼츠 1편(대본·음성·자막·배경음악)\n카드뉴스 배경 또는 AI 이미지 선택', 3000,  null, 'draft', 10),
  ('recap_shorts_3',   '블로그 요약 쇼츠 3편',           '요약 쇼츠 3편 묶음',                                  E'요약 쇼츠 3편(대본·음성·자막·배경음악)', 9000,  null, 'draft', 11),
  ('similar_video_10', '유사영상 10편 세트(480p·5초)',   '원본 영상 1개 → 유사 컨셉 영상 10편',               E'AI 유사영상 10편(480p·5초 기준)\n길이·화질 상향 시 추가 사용', 50000, null, 'draft', 20),
  ('lite_account_30d', 'Lite 계정 30일 이용권',          '파트너가 고객 계정을 직접 만들어 주는 Lite 30일 이용권', E'STORYUP Lite 30일(랜딩 1·블로그 10·카드뉴스 6·쇼츠 3)\n파트너가 계정을 직접 생성·전달', 11800, null, 'draft', 30),
  ('extra_image_10',   '추가 AI 이미지 10장',            '고화질 AI 이미지 10장',                               E'고화질 AI 이미지 10장', 5000,  null, 'draft', 40)
on conflict (key) do nothing;

insert into public.hq_product_items (hq_product_id, service_key, units)
select p.id, v.service_key, v.units
from (values
  ('recap_shorts_1',   'RECAP_SHORTS',     1),
  ('recap_shorts_3',   'RECAP_SHORTS',     3),
  ('similar_video_10', 'SIMILAR_VIDEO',    1),
  ('lite_account_30d', 'LITE_ACCOUNT_30D', 1),
  ('extra_image_10',   'EXTRA_IMAGE',      10)
) as v(product_key, service_key, units)
join public.hq_products p on p.key = v.product_key
on conflict (hq_product_id, service_key) do nothing;

-- ------------------------------------------------------------
-- 4) 파트너 상품/오퍼/청구서 — 본사 상품 참조 + 결제 시 제공 스냅샷
--    base_plan 은 "결제 시 고객에게 주는 플랜" 의미로 유지(lite 허용).
-- ------------------------------------------------------------
alter table public.partner_products
  add column if not exists hq_product_id uuid references public.hq_products (id) on delete set null,
  add column if not exists entitlements  jsonb not null default '[]'::jsonb,
  add column if not exists grant_days    integer not null default 30;
alter table public.partner_products drop constraint if exists partner_products_base_plan_check;
alter table public.partner_products
  add constraint partner_products_base_plan_check check (base_plan is null or base_plan in ('basic', 'pro', 'lite'));

alter table public.partner_offers
  add column if not exists hq_product_id uuid,
  add column if not exists entitlements  jsonb not null default '[]'::jsonb,
  add column if not exists grant_days    integer not null default 30;

alter table public.partner_invoices
  add column if not exists hq_product_id uuid;

-- 백필: 요금제 연동 상품 → 같은 key 의 본사 상품.
update public.partner_products p
set hq_product_id = h.id
from public.hq_products h
where h.key = p.base_plan and p.hq_product_id is null and p.base_plan is not null;

update public.partner_offers o
set hq_product_id = h.id
from public.hq_products h
where h.key = o.base_plan and o.hq_product_id is null and o.base_plan is not null;

-- ------------------------------------------------------------
-- 5) 파트너 작업권 원장(추가 전용, 잔액 = sum(delta))
-- ------------------------------------------------------------
create table if not exists public.partner_entitlements (
  id              uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users (id) on delete cascade,
  service_key     text not null references public.entitlement_services (key),
  delta           integer not null check (delta <> 0),   -- +지급 / -소비
  reason          text,
  ref_type        text not null check (ref_type in ('invoice_grant', 'admin_grant', 'consume', 'refund', 'migration')),
  ref_invoice_id  uuid references public.partner_invoices (id) on delete set null,
  ref_business_id uuid,
  ref_id          text,                                   -- 요약 쇼츠 잡 id · 유사영상 배치 id · 계정 대장 id 등
  created_by      uuid,
  created_at      timestamptz not null default now()
);
create index if not exists partner_entitlements_partner_idx
  on public.partner_entitlements (partner_user_id, service_key, created_at desc);
-- 청구서 1건당 (파트너, 서비스) 지급은 1회만 — 웹훅/결과 페이지 동시 처리 이중 지급 방지.
create unique index if not exists partner_entitlements_invoice_grant_once
  on public.partner_entitlements (ref_invoice_id, partner_user_id, service_key)
  where ref_type = 'invoice_grant';

alter table public.partner_entitlements enable row level security;
drop policy if exists partner_entitlements_select on public.partner_entitlements;
create policy partner_entitlements_select on public.partner_entitlements
  for select using (partner_user_id = auth.uid() or public.is_admin());
-- 쓰기(insert)는 서비스롤만. update/delete 정책 없음(추가 전용).

-- ------------------------------------------------------------
-- 6) 작업권 소비 RPC — 동시 요청 이중 소비 방지(advisory lock). 부족 시 INSUFFICIENT_ENTITLEMENT.
-- ------------------------------------------------------------
create or replace function public.consume_partner_entitlement(
  p_partner      uuid,
  p_service      text,
  p_units        integer,
  p_reason       text,
  p_ref_business uuid default null,
  p_ref_id       text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_units is null or p_units <= 0 then
    raise exception 'INVALID_UNITS';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_partner::text || ':' || p_service));
  select coalesce(sum(delta), 0) into v_balance
    from public.partner_entitlements
   where partner_user_id = p_partner and service_key = p_service;
  if v_balance < p_units then
    raise exception 'INSUFFICIENT_ENTITLEMENT';
  end if;
  insert into public.partner_entitlements
    (partner_user_id, service_key, delta, reason, ref_type, ref_business_id, ref_id)
  values (p_partner, p_service, -p_units, p_reason, 'consume', p_ref_business, p_ref_id);
  return v_balance - p_units;
end;
$$;
revoke all on function public.consume_partner_entitlement(uuid, text, integer, text, uuid, text) from public;
grant execute on function public.consume_partner_entitlement(uuid, text, integer, text, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 7) 패킷 잔액 → 작업권 1회 환산(멱등). 규칙(탐욕):
--    별도계약(provisioning enabled) 파트너만 LITE_ACCOUNT_30D 먼저 → RECAP_SHORTS → EXTRA_IMAGE.
--    SIMILAR_VIDEO 는 자동 환산 제외(DB 단가 100 ≠ 의도 500). 5패킷 미만 잔여는 reason 에 기록 후 소멸.
--    환산 후 partner_credit_ledger 에 -잔액 상쇄 행을 넣어 합계 0 → 재실행 시 아무것도 하지 않는다.
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_lite  integer := coalesce((select credits from public.partner_credit_prices where action = 'LITE_ACCOUNT_30D'), 118);
  v_recap integer := coalesce((select credits from public.partner_credit_prices where action = 'RECAP_SHORTS'), 30);
  v_img   integer := coalesce((select credits from public.partner_credit_prices where action = 'EXTRA_IMAGE'), 5);
  v_rem   integer;
  v_n     integer;
  v_note  text;
begin
  if v_lite <= 0 then v_lite := 118; end if;
  if v_recap <= 0 then v_recap := 30; end if;
  if v_img <= 0 then v_img := 5; end if;

  for r in
    select partner_user_id, sum(amount)::integer as balance
      from public.partner_credit_ledger
     group by partner_user_id
    having sum(amount) > 0
  loop
    v_rem := r.balance;
    v_note := 'credit_conversion_0112: ' || r.balance || ' credits';

    if exists (select 1 from public.partner_account_provisioning
                where partner_user_id = r.partner_user_id and enabled) then
      v_n := v_rem / v_lite;
      if v_n > 0 then
        insert into public.partner_entitlements (partner_user_id, service_key, delta, reason, ref_type)
        values (r.partner_user_id, 'LITE_ACCOUNT_30D', v_n, v_note, 'migration');
        v_rem := v_rem - v_n * v_lite;
      end if;
    end if;

    v_n := v_rem / v_recap;
    if v_n > 0 then
      insert into public.partner_entitlements (partner_user_id, service_key, delta, reason, ref_type)
      values (r.partner_user_id, 'RECAP_SHORTS', v_n, v_note, 'migration');
      v_rem := v_rem - v_n * v_recap;
    end if;

    v_n := v_rem / v_img;
    if v_n > 0 then
      insert into public.partner_entitlements (partner_user_id, service_key, delta, reason, ref_type)
      values (r.partner_user_id, 'EXTRA_IMAGE', v_n, v_note, 'migration');
      v_rem := v_rem - v_n * v_img;
    end if;

    -- 잔액 상쇄(원장 보존, 합계 0). 잔여 v_rem(<5)은 소멸 — reason 에 기록.
    insert into public.partner_credit_ledger (partner_user_id, amount, reason, ref_type)
    values (r.partner_user_id, -r.balance,
            'converted_to_entitlements_0112 (leftover ' || v_rem || ' credits expired)', 'migration');
  end loop;
end $$;

-- ------------------------------------------------------------
-- 8) 패킷 제도 종료 — 차감 RPC 실행 권한 회수(함수는 보존), 단가 비활성, 대기 주문 취소
-- ------------------------------------------------------------
revoke execute on function public.spend_partner_credits(uuid, integer, text, uuid) from service_role;
update public.partner_credit_prices set active = false, updated_at = now();
update public.partner_packet_orders
   set status = 'cancelled', admin_note = coalesce(admin_note || ' · ', '') || '패킷 제도 종료(0112)', updated_at = now()
 where status = 'pending' and granted_at is null;
