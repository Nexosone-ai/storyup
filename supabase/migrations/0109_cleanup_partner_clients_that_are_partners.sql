-- ============================================================
--  0109: 고객 배정(partner_clients) 정리 — 고객 쪽이 파트너 플랜(활성)인 행 삭제 (2026-11-10)
--  2026-10-29 본사(nexosoneai) 파트너 백필 때 당시 일반 회원이던 계정들이 고객으로 들어갔으나,
--  이후 파트너/파트너(영업)로 전환되어(0106) '파트너 계정은 고객으로 둘 수 없다'는 코드 규칙과 어긋남.
--  대상 11건(전부 본사 배정). account_shares 의 대응 행도 함께 제거. Idempotent, 데이터만.
-- ============================================================

drop table if exists _pc_partner_rows;
create temp table _pc_partner_rows as
select pc.id, pc.partner_user_id, pc.client_user_id
from public.partner_clients pc
join public.subscriptions s
  on s.user_id = pc.client_user_id and s.plan = 'partner' and s.status = 'active';

delete from public.account_shares a
using _pc_partner_rows r
where a.owner_user_id = r.client_user_id
  and a.partner_user_id = r.partner_user_id;

delete from public.partner_clients pc
using _pc_partner_rows r
where pc.id = r.id;

drop table if exists _pc_partner_rows;
