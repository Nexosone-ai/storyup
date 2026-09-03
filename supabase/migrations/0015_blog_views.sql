-- 블로그 글 조회수: 쇼케이스(스토리들)·인기글 뱃지 등 공개 노출용 카운터.
-- site_events는 소유자만 읽을 수 있으므로, 공개적으로 보여줄 수 있는
-- 누적 조회수를 blog_posts에 컬럼으로 둔다.
alter table public.blog_posts
  add column if not exists view_count integer not null default 0;

-- 기존 site_events(page_view)에서 글별 조회수를 백필한다.
-- path 형식: /site/{siteSlug}/blog/{postSlug}
update public.blog_posts p
set view_count = sub.cnt
from (
  select e.business_id, split_part(e.path, '/', 5) as post_slug, count(*)::int as cnt
  from public.site_events e
  where e.event = 'page_view'
    and e.path like '/site/%/blog/%'
    and split_part(e.path, '/', 5) <> ''
  group by e.business_id, split_part(e.path, '/', 5)
) sub
where p.business_id = sub.business_id
  and p.slug = sub.post_slug;

-- 공개 글의 조회수를 1 올리는 함수 — /api/track에서 익명으로 호출한다.
create or replace function public.increment_blog_view(p_business uuid, p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.blog_posts
  set view_count = view_count + 1
  where business_id = p_business
    and slug = p_slug
    and status = 'published';
$$;

revoke all on function public.increment_blog_view(uuid, text) from public;
grant execute on function public.increment_blog_view(uuid, text) to anon, authenticated, service_role;
