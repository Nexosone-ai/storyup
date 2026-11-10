-- ============================================================
--  0107: 파트너(영업)(=서브파트너)의 영업 링크로 가입한 사용자 → 그 파트너(영업)의 고객 배정 (2026-11-10)
--  사용자 지시: "영업파트너로 등록된 계정의 경우, 영업링크로 들어간 사람은 영업파트너의 고객으로 배정"
--  - 0106에서 깊이 제한(2단계)으로 서브파트너가 되지 못한 3단계 추천 가입자가 대상.
--  - 본사(nexosoneai) 백필 배정이면 추천한 파트너(영업)으로 이전, 담당이 없으면 신규 연결,
--    다른 파트너가 이미 담당 중이면 건드리지 않는다(한 고객 = 한 파트너).
--  - 고객 화면 '담당 파트너' 표시용 account_shares(accepted) 동기화.
--  앞으로의 가입자는 코드(linkReferredClientToPartner)가 가입 시점에 같은 규칙으로 자동 연결한다.
--  Idempotent. 데이터만 변경(DDL 없음).
-- ============================================================

drop table if exists _sp_refs;
create temp table _sp_refs as
select r.referrer_user_id as partner_user_id, r.referred_user_id as client_user_id
from public.referrals r
join public.partner_subs ps
  on ps.sub_partner_user_id = r.referrer_user_id and ps.status = 'active'
join public.subscriptions s
  on s.user_id = r.referrer_user_id and s.plan = 'partner' and s.status = 'active'
where r.referrer_user_id <> r.referred_user_id
  and not exists (select 1 from public.subscriptions x where x.user_id = r.referred_user_id and x.plan = 'partner')
  and not exists (select 1 from public.profiles pp where pp.user_id = r.referred_user_id and pp.is_admin);

-- 1) 본사 백필 배정 → 추천한 파트너(영업)으로 이전 (이미 같은 링크가 있으면 본사 행만 삭제)
delete from public.partner_clients pc
using _sp_refs m, public.profiles hq
where hq.email = 'nexosoneai@gmail.com'
  and pc.partner_user_id = hq.user_id
  and pc.client_user_id = m.client_user_id
  and exists (
    select 1 from public.partner_clients d
    where d.partner_user_id = m.partner_user_id and d.client_user_id = m.client_user_id
  );

update public.partner_clients pc
set partner_user_id = m.partner_user_id,
    created_by      = m.partner_user_id
from _sp_refs m, public.profiles hq
where hq.email = 'nexosoneai@gmail.com'
  and pc.partner_user_id = hq.user_id
  and pc.client_user_id = m.client_user_id;

-- 2) 담당 파트너가 전혀 없는 가입자 → 신규 연결
insert into public.partner_clients (partner_user_id, client_user_id, created_by)
select m.partner_user_id, m.client_user_id, m.partner_user_id
from _sp_refs m
where not exists (select 1 from public.partner_clients pc where pc.client_user_id = m.client_user_id)
on conflict (partner_user_id, client_user_id) do nothing;

-- 3) 고객 화면 '담당 파트너' 표시 동기화
insert into public.account_shares (owner_user_id, partner_email, partner_user_id, status, accepted_at)
select pc.client_user_id, lower(pp.email), pc.partner_user_id, 'accepted', now()
from public.partner_clients pc
join _sp_refs m on m.partner_user_id = pc.partner_user_id and m.client_user_id = pc.client_user_id
join public.profiles pp on pp.user_id = pc.partner_user_id
where pp.email is not null
on conflict (owner_user_id, partner_email) do update
  set partner_user_id = excluded.partner_user_id,
      status          = 'accepted',
      accepted_at     = coalesce(public.account_shares.accepted_at, now());

drop table if exists _sp_refs;
