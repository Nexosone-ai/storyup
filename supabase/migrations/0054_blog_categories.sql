-- ============================================================
--  0054: 블로그 카테고리 관리 (사장님이 추가/변경/삭제)
--  기존엔 blog_posts.category(자유 입력)만 있었음 → 관리형 목록을 businesses에 보관.
--  관리 목록은 글이 없어도 유지되고, 이름 변경/삭제 시 글의 category도 함께 반영한다.
--  Idempotent.
-- ============================================================

alter table public.businesses
  add column if not exists blog_categories text[] not null default '{}';
