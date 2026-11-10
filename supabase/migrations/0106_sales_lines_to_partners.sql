-- ============================================================
--  0106: 영업자(마케터 0023 · 유통망 0053) → 파트너 통합 이전 (2026-11-10)
--  - 기존 영업자(marketers ∪ network_members) 전원 → 파트너(plan=partner, 무기한, 결제 없음)
--  - 유통망 하위(영업점·리셀러) → 상위 총판의 서브파트너(partner_subs)
--  - 영업자·파트너의 추천(referrals)으로 가입한 사용자 → 그 파트너의 **서브파트너 = 파트너(영업)**
--    (사용자 지시 2026-11-10: 영업자가 영업한 추천인은 고객이 아니라 서브파트너로)
--    파트너가 된 계정은 본사(nexosoneai) 고객 배정(partner_clients)에서 제거.
--  - 레거시 조직(marketers/network_members)은 삭제하지 않고 suspended + memo 로 봉인(원장·정산표 보존).
--  Idempotent. 데이터만 변경(DDL 없음). 빌링키가 있는(실결제 중) 구독은 건드리지 않는다.
-- ============================================================

-- ---------- 1) 영업자 → 파트너 플랜 ----------
with sellers as (
  select user_id from public.marketers
  union
  select user_id from public.network_members
)
insert into public.subscriptions
  (user_id, plan, status, current_period_end, billing_key, cancel_at_period_end, trial, billing_failures, updated_at)
select s.user_id, 'partner', 'active', null, null, false, false, 0, now()
from sellers s
on conflict (user_id) do update
  set plan                 = 'partner',
      status               = 'active',
      current_period_end   = null,
      billing_key          = null,
      cancel_at_period_end = false,
      trial                = false,
      billing_failures     = 0,
      updated_at           = now()
  where public.subscriptions.billing_key is null            -- 실결제 중인 구독은 보호
    and (public.subscriptions.plan <> 'partner' or public.subscriptions.status <> 'active');

-- ---------- 2) 유통망 하위 → 서브파트너 ----------
-- 영업점의 상위 = 총판. 리셀러(3단계)는 서브파트너 깊이 제한(2단계) 때문에 루트 총판 아래로 평탄화.
insert into public.partner_subs (parent_partner_user_id, sub_partner_user_id, status, created_by)
select
  case when p.role = 'distributor' then nm.parent_id else nm.distributor_id end,
  nm.user_id,
  'active',
  nm.parent_id
from public.network_members nm
join public.network_members p on p.user_id = nm.parent_id
where nm.parent_id is not null
  and nm.user_id <> case when p.role = 'distributor' then nm.parent_id else nm.distributor_id end
  -- 상위가 이미 누군가의 서브면 3단계가 되므로 제외
  and not exists (
    select 1 from public.partner_subs x
    where x.sub_partner_user_id = case when p.role = 'distributor' then nm.parent_id else nm.distributor_id end
  )
on conflict (sub_partner_user_id) do nothing;

-- ---------- 3) 추천 가입자 → 추천인 파트너의 서브파트너(파트너(영업)) ----------
drop table if exists _ref_subs;
create temp table _ref_subs as
select r.referrer_user_id as parent_user_id, r.referred_user_id as sub_user_id
from public.referrals r
join public.subscriptions ps
  on ps.user_id = r.referrer_user_id and ps.plan = 'partner' and ps.status = 'active'
where r.referrer_user_id <> r.referred_user_id
  -- 추천인이 서브면 3단계가 되므로 제외(깊이 2단계)
  and not exists (select 1 from public.partner_subs x where x.sub_partner_user_id = r.referrer_user_id)
  -- 가입자가 이미 파트너(상위·서브)·관리자면 제외
  and not exists (select 1 from public.subscriptions cs where cs.user_id = r.referred_user_id and cs.plan = 'partner')
  and not exists (select 1 from public.profiles pp where pp.user_id = r.referred_user_id and pp.is_admin)
  and not exists (select 1 from public.partner_subs x where x.sub_partner_user_id = r.referred_user_id)
  -- 실결제(빌링키) 중인 구독은 보호
  and not exists (select 1 from public.subscriptions cs where cs.user_id = r.referred_user_id and cs.billing_key is not null);

-- 3a) partner 플랜 부여
insert into public.subscriptions
  (user_id, plan, status, current_period_end, billing_key, cancel_at_period_end, trial, billing_failures, updated_at)
select s.sub_user_id, 'partner', 'active', null, null, false, false, 0, now()
from _ref_subs s
on conflict (user_id) do update
  set plan                 = 'partner',
      status               = 'active',
      current_period_end   = null,
      billing_key          = null,
      cancel_at_period_end = false,
      trial                = false,
      billing_failures     = 0,
      updated_at           = now()
  where public.subscriptions.billing_key is null
    and (public.subscriptions.plan <> 'partner' or public.subscriptions.status <> 'active');

-- 3b) 서브파트너 등록(상위 = 추천인)
insert into public.partner_subs (parent_partner_user_id, sub_partner_user_id, status, created_by)
select s.parent_user_id, s.sub_user_id, 'active', s.parent_user_id
from _ref_subs s
on conflict (sub_partner_user_id) do nothing;

-- 3c) 파트너가 된 계정은 고객 배정·공유에서 제거(파트너 계정은 고객으로 둘 수 없음)
delete from public.partner_clients pc using _ref_subs s where pc.client_user_id = s.sub_user_id;
delete from public.account_shares a using _ref_subs s where a.owner_user_id = s.sub_user_id;

drop table if exists _ref_subs;

-- ---------- 4) 레거시 조직 봉인 (삭제 금지 — 원장·수당표·정산 배치 보존) ----------
update public.marketers
set status     = 'suspended',
    memo       = concat_ws(' | ', nullif(memo, ''), '2026-11-10 파트너로 통합 이전(0106)'),
    updated_at = now()
where status <> 'suspended' or memo is null or position('0106' in memo) = 0;

update public.network_members
set status     = 'suspended',
    memo       = concat_ws(' | ', nullif(memo, ''), '2026-11-10 파트너(서브파트너)로 통합 이전(0106)'),
    updated_at = now()
where status <> 'suspended' or memo is null or position('0106' in memo) = 0;
