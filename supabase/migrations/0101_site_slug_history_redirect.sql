-- ============================================================
--  0101: 공개 사이트 옛 URL 리다이렉트 — 슬러그 변경 이력 + 위치 해석 RPC
-- ============================================================
-- 사이트 슬러그를 바꾸거나 개인 도메인으로 옮기면 검색엔진에 남은 옛 주소
-- (https://storyup.me/site/<옛슬러그>/...)가 404가 난다. 미들웨어가 요청 슬러그를
-- 현재 위치(현재 슬러그 + 활성 커스텀 도메인)로 해석해 301 리다이렉트할 수 있게 한다.
-- 추가 전용(비파괴). Requires 0040(custom_domains), 0042(active_custom_domain_for).
-- 운영 반영은 별도 승인 후 SQL 에디터에서 실행.

-- 1) 슬러그 변경 이력 — 슬러그를 바꿀 때 앱이 옛 값을 append 한다(삭제 안 함).
alter table public.websites
  add column if not exists previous_slugs text[] not null default '{}';
create index if not exists websites_previous_slugs_gin
  on public.websites using gin (previous_slugs);

-- 2) 요청 슬러그 → 현재 위치. 현재 슬러그가 우선, 없으면 옛 슬러그로 찾는다.
--    반환: {"slug": 현재슬러그, "domain": 활성도메인|null}  (없으면 null)
--    SECURITY DEFINER — 익명 요청(미들웨어, anon 키)도 공개 사이트의 위치만 읽는다.
create or replace function public.resolve_site_location(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'slug', w.slug,
    'domain', public.active_custom_domain_for(w.business_id)
  )
  from public.websites w
  where w.status = 'published'
    and (w.slug = p_slug or w.previous_slugs @> array[p_slug])
  order by (w.slug = p_slug) desc, w.updated_at desc
  limit 1;
$$;

grant execute on function public.resolve_site_location(text) to anon, authenticated;
