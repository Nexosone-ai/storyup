-- 블로그 커버 이미지 URL (AI 자동 생성 또는 수동 재생성)
alter table public.blog_posts
  add column if not exists cover_image_url text;
