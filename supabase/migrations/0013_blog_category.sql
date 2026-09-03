-- 블로그 메뉴(카테고리): 글마다 하나의 메뉴에 속할 수 있다 (null = 미분류)
alter table public.blog_posts
  add column if not exists category text;

create index if not exists blog_posts_category_idx
  on public.blog_posts (business_id, category);
