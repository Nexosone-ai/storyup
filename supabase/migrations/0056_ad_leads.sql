-- ============================================================
--  0056: 광고 마켓플레이스 Phase 3 (CPA) — 리드(DB) 수집
--  CPA 캠페인: 광고 경유 리드폼 제출 1건당 과금 → 광고주가 리드 DB 수령, 블로거 수익 적립.
--  중복(캠페인×전화) 차단. CPV는 0055의 ad_impressions/ad_earnings(view)로 과금(추가 테이블 없음).
--  Idempotent. Requires 0055.
-- ============================================================

create table if not exists public.ad_leads (
  id                     uuid primary key default gen_random_uuid(),
  campaign_id            uuid not null references public.ad_campaigns (id) on delete cascade,
  placement_id           uuid references public.ad_placements (id) on delete set null,
  advertiser_business_id uuid not null references public.businesses (id) on delete cascade,
  blogger_user_id        uuid not null references auth.users (id) on delete cascade,
  name                   text not null,
  phone                  text not null,
  message                text,
  charged                boolean not null default false,
  amount                 integer not null default 0,     -- 광고주 차감액
  created_at             timestamptz not null default now()
);
-- 캠페인당 같은 전화번호는 1회만(중복 리드 과금 차단)
create unique index if not exists al_dedup on public.ad_leads (campaign_id, phone);
create index if not exists al_adv_idx on public.ad_leads (advertiser_business_id, created_at desc);
create index if not exists al_campaign_idx on public.ad_leads (campaign_id, created_at desc);
alter table public.ad_leads enable row level security;
drop policy if exists al_select on public.ad_leads;
-- 광고주(=수령자)와 관리자만 리드 조회. 블로거/방문자는 조회 불가(개인정보).
create policy al_select on public.ad_leads
  for select to authenticated
  using (public.owns_business(advertiser_business_id) or public.is_admin());
