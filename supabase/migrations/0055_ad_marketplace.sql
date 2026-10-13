-- ============================================================
--  0055: 광고 마켓플레이스 Phase 1 (공통 기반 + CPC)
--  광고주(사업주)가 광고 지갑에 선충전 → 캠페인 집행, 블로거가 수락해 자기 사이트에 노출.
--  CPC: 클릭당 광고주 지갑 차감 → 플랫폼 수수료% 제외 후 블로거 수익 적립. 부정클릭 차단.
--  지갑/차감은 point_transactions/spend_points(0008) 패턴, 정산은 marketer_settlements(0023/0053) 패턴을 복제.
--  Idempotent. Requires 0001(owns_business), 0004(is_admin), 0008(spend_points 패턴).
-- ============================================================

-- ---------- 1) 광고 지갑 원장 (잔액 = sum(amount)) ----------
create table if not exists public.ad_wallet_tx (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount      integer not null,              -- +충전 / -차감 (KRW)
  reason      text,
  ref_type    text,                          -- 'deposit' | 'click' | 'admin' ...
  ref_id      uuid,
  created_at  timestamptz not null default now()
);
create index if not exists awt_business_idx on public.ad_wallet_tx (business_id, created_at desc);
-- 멱등: 같은 레퍼런스(충전주문·클릭)로 1회만 기록
create unique index if not exists awt_ref_once
  on public.ad_wallet_tx (ref_type, ref_id) where ref_id is not null;
alter table public.ad_wallet_tx enable row level security;
drop policy if exists awt_select on public.ad_wallet_tx;
create policy awt_select on public.ad_wallet_tx
  for select to authenticated using (public.owns_business(business_id) or public.is_admin());

-- 원자적 차감(이중지출 방지) — spend_points 복제. service_role 전용.
create or replace function public.ad_wallet_spend(
  p_business uuid,
  p_amount   integer,
  p_reason   text,
  p_ref_type text,
  p_ref_id   uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  perform pg_advisory_xact_lock(hashtext(p_business::text));
  select coalesce(sum(amount), 0) into v_balance
    from public.ad_wallet_tx where business_id = p_business;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;
  insert into public.ad_wallet_tx (business_id, amount, reason, ref_type, ref_id)
    values (p_business, -p_amount, p_reason, p_ref_type, p_ref_id);
  return v_balance - p_amount;
end $$;
revoke all on function public.ad_wallet_spend(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.ad_wallet_spend(uuid, integer, text, text, uuid) to service_role;

-- ---------- 2) 충전 주문 (PortOne 카드 선충전) ----------
create table if not exists public.ad_deposit_orders (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id    text not null unique,          -- 'adw_' + uuid
  amount      integer not null check (amount > 0),
  currency    text not null default 'KRW',
  status      text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','CANCELLED')),
  payment_key text,
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ado_business_idx on public.ad_deposit_orders (business_id, created_at desc);
alter table public.ad_deposit_orders enable row level security;
drop policy if exists ado_select on public.ad_deposit_orders;
create policy ado_select on public.ad_deposit_orders
  for select to authenticated using (public.owns_business(business_id) or public.is_admin());

-- ---------- 3) 캠페인 (광고주) ----------
create table if not exists public.ad_campaigns (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  type         text not null default 'cpc' check (type in ('cpc','cpv','cpa')),
  name         text not null,
  creative     jsonb not null default '{}'::jsonb,  -- {image,title,subtitle,ctaLabel,aspect}
  target_url   text not null,
  bid_amount   integer not null check (bid_amount > 0),   -- 클릭당 KRW
  total_budget integer not null check (total_budget >= 0),
  spent        integer not null default 0,
  status       text not null default 'pending_review'
                 check (status in ('draft','pending_review','active','paused','exhausted','ended','rejected')),
  industry     text,                          -- 타겟 업종(대분류) id, null=전체
  review_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ac_business_idx on public.ad_campaigns (business_id, created_at desc);
create index if not exists ac_status_idx on public.ad_campaigns (status);
alter table public.ad_campaigns enable row level security;
drop policy if exists ac_select on public.ad_campaigns;
create policy ac_select on public.ad_campaigns
  for select to authenticated using (public.owns_business(business_id) or public.is_admin());

-- ---------- 4) 집행(블로거 수락) ----------
create table if not exists public.ad_placements (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.ad_campaigns (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,  -- 블로거 사업체
  blogger_user_id uuid not null references auth.users (id) on delete cascade,
  slots           text[] not null default '{}',   -- 'postTop','postBottom','blogList','landing'
  status          text not null default 'active' check (status in ('active','paused','ended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (campaign_id, business_id)
);
create index if not exists ap_business_idx on public.ad_placements (business_id, status);
create index if not exists ap_campaign_idx on public.ad_placements (campaign_id);
create index if not exists ap_blogger_idx on public.ad_placements (blogger_user_id);
alter table public.ad_placements enable row level security;
drop policy if exists ap_select on public.ad_placements;
create policy ap_select on public.ad_placements
  for select to authenticated using (
    public.owns_business(business_id) or blogger_user_id = auth.uid() or public.is_admin()
  );

-- ---------- 5) 클릭 로그 (CPC 과금·부정클릭 차단) ----------
create table if not exists public.ad_clicks (
  id                    uuid primary key default gen_random_uuid(),
  placement_id          uuid not null references public.ad_placements (id) on delete cascade,
  campaign_id           uuid not null references public.ad_campaigns (id) on delete cascade,
  advertiser_business_id uuid not null,
  blogger_user_id       uuid not null,
  visitor_key           text not null,
  charged               boolean not null default false,
  amount                integer not null default 0,     -- 광고주 차감액
  fee_amount            integer not null default 0,     -- 플랫폼 수수료
  blogger_amount        integer not null default 0,     -- 블로거 수익
  click_day             date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at            timestamptz not null default now()
);
-- 방문자당 placement·일자 1회만 과금(부정클릭 차단)
create unique index if not exists acl_dedup
  on public.ad_clicks (placement_id, visitor_key, click_day);
create index if not exists acl_campaign_idx on public.ad_clicks (campaign_id, created_at desc);
create index if not exists acl_blogger_idx on public.ad_clicks (blogger_user_id, created_at desc);
alter table public.ad_clicks enable row level security;  -- select 정책 없음: 서버(service_role)만 조회

-- ---------- 6) 노출 로그 (CTR용, CPC에선 과금X) ----------
create table if not exists public.ad_impressions (
  id           uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.ad_placements (id) on delete cascade,
  campaign_id  uuid not null references public.ad_campaigns (id) on delete cascade,
  visitor_key  text,
  imp_day      date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at   timestamptz not null default now()
);
create index if not exists aimp_campaign_idx on public.ad_impressions (campaign_id, created_at desc);
-- 하루 중복 노출은 1행만(경량 집계)
create unique index if not exists aimp_dedup
  on public.ad_impressions (placement_id, visitor_key, imp_day) where visitor_key is not null;
alter table public.ad_impressions enable row level security;  -- 서버 전용

-- ---------- 7) 블로거 수익 원장 + 정산 ----------
create table if not exists public.ad_earnings (
  id              uuid primary key default gen_random_uuid(),
  blogger_user_id uuid not null references auth.users (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  campaign_id     uuid references public.ad_campaigns (id) on delete set null,
  placement_id    uuid references public.ad_placements (id) on delete set null,
  event_type      text not null default 'click' check (event_type in ('click','view','action')),
  ref_id          uuid,                       -- ad_clicks.id 등
  amount          integer not null default 0, -- 블로거 수익(KRW)
  status          text not null default 'pending' check (status in ('pending','settled','paid','void')),
  settlement_id   uuid,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create unique index if not exists ae_ref_once on public.ad_earnings (event_type, ref_id) where ref_id is not null;
create index if not exists ae_blogger_idx on public.ad_earnings (blogger_user_id, occurred_at desc);
create index if not exists ae_status_idx on public.ad_earnings (status);
alter table public.ad_earnings enable row level security;
drop policy if exists ae_select on public.ad_earnings;
create policy ae_select on public.ad_earnings
  for select to authenticated using (blogger_user_id = auth.uid() or public.is_admin());

create table if not exists public.ad_settlements (
  id               uuid primary key default gen_random_uuid(),
  blogger_user_id  uuid not null references auth.users (id) on delete cascade,
  period           text not null,              -- 'YYYY-MM'
  gross            integer not null default 0,
  tax              integer not null default 0,
  net              integer not null default 0,
  earning_count    integer not null default 0,
  status           text not null default 'open' check (status in ('open','paid')),
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (blogger_user_id, period)
);
alter table public.ad_settlements enable row level security;
drop policy if exists aset_select on public.ad_settlements;
create policy aset_select on public.ad_settlements
  for select to authenticated using (blogger_user_id = auth.uid() or public.is_admin());

-- ---------- 8) 전역 설정 (수수료%) ----------
create table if not exists public.ad_settings (
  id               integer primary key default 1 check (id = 1),
  platform_fee_pct integer not null default 20 check (platform_fee_pct between 0 and 100),
  updated_at       timestamptz not null default now()
);
insert into public.ad_settings (id) values (1) on conflict (id) do nothing;
alter table public.ad_settings enable row level security;
drop policy if exists aset_cfg_select on public.ad_settings;
create policy aset_cfg_select on public.ad_settings for select to authenticated using (true);
