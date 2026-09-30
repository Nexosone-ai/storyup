-- 0042: 사업장 → 활성 커스텀 도메인 (역방향 조회).
-- 공개 페이지 SEO에서 canonical/OG를 커스텀 도메인으로 맞추기 위해, 익명 요청도
-- 사업장의 활성 도메인을 읽을 수 있어야 한다. custom_domains는 소유자 전용 RLS라
-- SECURITY DEFINER 함수로 도메인 문자열만 노출한다(공개 사이트라 도메인은 공개 정보).
create or replace function public.active_custom_domain_for(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cd.domain
  from public.custom_domains cd
  where cd.business_id = p_business_id
    and cd.status = 'active'
  order by cd.created_at asc
  limit 1;
$$;

grant execute on function public.active_custom_domain_for(uuid) to anon, authenticated;
