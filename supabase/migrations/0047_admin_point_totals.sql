-- 0047: 관리자 포인트 원장 집계 함수.
-- 전 기간 유형별 합계를 DB에서 GROUP BY로 계산한다. (클라이언트에서 전체 행을
-- 끌어오면 supabase-js 기본 1,000행 상한에 걸려 합계가 조용히 틀어지므로.)
-- 집계값(유형·건수·합계)만 반환하고 개별 사용자 정보는 노출하지 않는다.
create or replace function public.admin_point_totals()
returns table (type text, cnt bigint, total bigint, pos bigint, neg bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(pt.type, 'ETC')                                              as type,
    count(*)::bigint                                                      as cnt,
    coalesce(sum(pt.amount), 0)::bigint                                   as total,
    coalesce(sum(pt.amount) filter (where pt.amount >= 0), 0)::bigint     as pos,
    coalesce(sum(pt.amount) filter (where pt.amount < 0), 0)::bigint      as neg
  from public.point_transactions pt
  group by coalesce(pt.type, 'ETC');
$$;

-- 관리자 전용 — 서버(서비스 롤)에서만 호출한다.
revoke all on function public.admin_point_totals() from public, anon, authenticated;
grant execute on function public.admin_point_totals() to service_role;
