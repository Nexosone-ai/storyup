-- 공개 블로그 글의 방문자 댓글.
-- 작성/삭제는 서버 액션(service role)으로만 하고, RLS는 읽기 전용으로 연다.
create table if not exists public.blog_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.blog_posts (id) on delete cascade,
  business_id   uuid not null references public.businesses (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  author_name   text not null,
  password_hash text,
  content       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists blog_comments_post_idx
  on public.blog_comments (post_id, created_at);

alter table public.blog_comments enable row level security;

-- 공개된 글의 댓글은 누구나(비로그인 포함) 읽을 수 있다
drop policy if exists blog_comments_public_read on public.blog_comments;
create policy blog_comments_public_read on public.blog_comments
  for select using (
    exists (
      select 1 from public.blog_posts p
      where p.id = post_id and p.status = 'published'
    )
  );

-- 글 주인은 자기 글의 댓글을 항상 읽을 수 있다 (비공개 전환 후 관리 포함)
drop policy if exists blog_comments_owner_read on public.blog_comments;
create policy blog_comments_owner_read on public.blog_comments
  for select using (public.owns_business(business_id));
