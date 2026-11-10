-- ============================================================
--  0106: 영업자(마케터 0023 · 유통망 0053) → 파트너 통합 이전 (2026-11-10)
--  - 기존 영업자(marketers ∪ network_members) 전원 → 파트너(plan=partner, 무기한, 결제 없음)
--  - 유통망 하위(영업점·리셀러) → 상위 총판의 서브파트너(partner_subs)
--  - 영업자·파트너의 추천(referrals)으로 가입한 고객 → 본사(nexosoneai) 배정에서 추천인 파트너로 이전
--    (담당 파트너가 없던 추천 고객은 신규 연결). 고객 화면 '담당 파트너' 표시용 account_shares 동기화.
--  - 레거시 조직(marketers/network_members)은 삭제하지 않고 suspended + memo 로 봉인(원장·정산표 보존).
--  Idempotent. 데이터만 변경(DDL 없음). 결제·빌링키가 있는 구독은 건드리지 않는다.
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

-- ---------- 3) 추천 고객 → 추천인 파트너에게 이전 ----------
-- 대상: 추천인이 활성 파트너이고, 가입자가 파트너/관리자가 아닌 referrals.
create temp table _ref_moves on commit drop as
select r.referrer_user_id as partner_user_id, r.referred_user_id as client_user_id
from public.referrals r
join public.subscriptions ps
  on ps.user_id = r.referrer_user_id and ps.plan = 'partner' and ps.status = 'active'
where r.referrer_user_id <> r.referred_user_id
  and not exists (select 1 from public.subscriptions cs where cs.user_id = r.referred_user_id and cs.plan = 'partner')
  and not exists (select 1 from public.profiles pp where pp.user_id = r.referred_user_id and pp.is_admin);

-- 3a) 본사(nexosoneai) 백필 배정 → 추천인으로 이전 (추천인에게 이미 같은 링크가 있으면 본사 행 삭제)
delete from public.partner_clients pc
using _ref_moves m, public.profiles hq
where hq.email = 'nexosoneai@gmail.com'
  and pc.partner_user_id = hq.user_id
  and pc.client_user_id = m.client_user_id
  and m.partner_user_id <> hq.user_id
  and exists (
    select 1 from public.partner_clients d
    where d.partner_user_id = m.partner_user_id and d.client_user_id = m.client_user_id
  );

update public.partner_clients pc
set partner_user_id = m.partner_user_id,
    created_by      = m.partner_user_id
from _ref_moves m, public.profiles hq
where hq.email = 'nexosoneai@gmail.com'
  and pc.partner_user_id = hq.user_id
  and pc.client_user_id = m.client_user_id
  and m.partner_user_id <> hq.user_id;

-- 3b) 담당 파트너가 전혀 없는 추천 고객 → 추천인에게 신규 연결
insert into public.partner_clients (partner_user_id, client_user_id, created_by)
select m.partner_user_id, m.client_user_id, m.partner_user_id
from _ref_moves m
where not exists (select 1 from public.partner_clients pc where pc.client_user_id = m.client_user_id)
on conflict (partner_user_id, client_user_id) do nothing;

-- 3c) 고객 화면 '담당 파트너' 표시 — account_shares(accepted) 동기화
insert into public.account_shares (owner_user_id, partner_email, partner_user_id, status, accepted_at)
select pc.client_user_id, lower(pp.email), pc.partner_user_id, 'accepted', now()
from public.partner_clients pc
join _ref_moves m on m.partner_user_id = pc.partner_user_id and m.client_user_id = pc.client_user_id
join public.profiles pp on pp.user_id = pc.partner_user_id
where pp.email is not null
on conflict (owner_user_id, partner_email) do update
  set partner_user_id = excluded.partner_user_id,
      status          = 'accepted',
      accepted_at     = coalesce(public.account_shares.accepted_at, now());

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
