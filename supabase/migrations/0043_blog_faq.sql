-- 0043: 블로그 FAQ (AEO — 답변엔진 최적화). Pro 이상에서 생성.
-- 공개 글에 FAQ 섹션 + FAQPage JSON-LD로 노출된다.
alter table public.blog_posts
  add column if not exists faq jsonb not null default '[]'::jsonb;
