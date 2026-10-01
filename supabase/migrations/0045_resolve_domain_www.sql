-- 0045: 커스텀 도메인 해석을 apex ↔ www 상호 매칭으로.
-- Vercel이 apex를 www로(또는 반대로) 리다이렉트하면 앱에 도달하는 호스트가
-- 저장값과 달라질 수 있다(예: 저장 amicommunity.com, 요청 www.amicommunity.com).
-- 양쪽에서 선행 "www." 를 제거해 비교한다.
create or replace function public.resolve_custom_domain(p_domain text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select w.slug
  from public.custom_domains cd
  join public.websites w on w.business_id = cd.business_id
  where regexp_replace(cd.domain, '^www\.', '')
        = regexp_replace(lower(p_domain), '^www\.', '')
    and cd.status = 'active'
    and w.status = 'published'
  limit 1;
$$;
