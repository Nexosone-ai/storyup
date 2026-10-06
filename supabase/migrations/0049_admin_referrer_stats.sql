-- 0049: 관리자 추천인별 가입·전환 집계 함수.
-- 추천인(referrer)별로 데려온 가입 수와 유료 전환 수(paid_rewarded)를
-- DB에서 GROUP BY로 계산한다. (클라이언트에서 전체 referrals를 끌어오면
-- supabase-js 기본 1,000행 상한에 걸려 집계가 조용히 틀어지므로.)
-- 추천인 이름·이메일은 집계와 함께 반환해 한 번에 표시한다.
create or replace function public.admin_referrer_stats()
returns table (
  referrer_user_id uuid,
  referrer_name text,
  referrer_email text,
  signups bigint,
  conversions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.referrer_user_id,
    p.name                                                        as referrer_name,
    p.email                                                       as referrer_email,
    count(*)::bigint                                              as signups,
    count(*) filter (where r.paid_rewarded)::bigint              as conversions
  from public.referrals r
  left join public.profiles p on p.user_id = r.referrer_user_id
  group by r.referrer_user_id, p.name, p.email
  order by signups desc, conversions desc;
$$;

-- 관리자 전용 — 서버(서비스 롤)에서만 호출한다.
revoke all on function public.admin_referrer_stats() from public, anon, authenticated;
grant execute on function public.admin_referrer_stats() to service_role;
