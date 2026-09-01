-- ============================================================
--  0010: 커뮤니티 v2 — 사진 첨부 + 댓글
-- ============================================================

-- 스토리 커넥트 글에 사진 첨부 (Storage public URL 목록)
alter table public.story_connect_posts
  add column if not exists image_urls text[] not null default '{}';

-- 두 피드 공용 댓글 테이블
create table if not exists public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_type   text not null check (post_type in ('story', 'realtalk')),
  post_id     uuid not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '익명',
  content     text not null check (char_length(content) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists community_comments_post_idx
  on public.community_comments (post_type, post_id, created_at);

alter table public.community_comments enable row level security;

-- 로그인 사용자는 모두 읽기 (커뮤니티는 회원 전용 공간)
drop policy if exists community_comments_select_auth on public.community_comments;
create policy community_comments_select_auth on public.community_comments
  for select using (auth.uid() is not null);

drop policy if exists community_comments_insert_own on public.community_comments;
create policy community_comments_insert_own on public.community_comments
  for insert with check (user_id = auth.uid());

drop policy if exists community_comments_delete_own on public.community_comments;
create policy community_comments_delete_own on public.community_comments
  for delete using (user_id = auth.uid());
