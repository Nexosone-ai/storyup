-- ============================================================
--  0018: 블로그 좋아요 + 사장님 알림(앱 내)
-- ============================================================

-- ---------- 블로그 좋아요 ----------
-- 공개 블로그 방문자는 STORYUP 로그인 상태가 아니므로 익명 좋아요를 허용한다.
-- visitor_key = 로그인 사용자는 'user:{uid}', 익명은 'anon:{쿠키 UUID}'.
-- 쓰기는 서버 액션(service role)에서만 하고, RLS는 집계용 읽기만 연다.
create table if not exists public.blog_likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.blog_posts (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  visitor_key text not null,
  created_at  timestamptz not null default now(),
  unique (post_id, visitor_key)
);
create index if not exists blog_likes_post_idx on public.blog_likes (post_id);

alter table public.blog_likes enable row level security;

-- 공개된 글의 좋아요는 누구나(비로그인 포함) 읽을 수 있다 (카운트 집계용)
drop policy if exists blog_likes_public_read on public.blog_likes;
create policy blog_likes_public_read on public.blog_likes
  for select using (
    exists (
      select 1 from public.blog_posts p
      where p.id = post_id and p.status = 'published'
    )
  );

-- 글 주인은 자기 글의 좋아요를 항상 읽을 수 있다
drop policy if exists blog_likes_owner_read on public.blog_likes;
create policy blog_likes_owner_read on public.blog_likes
  for select using (public.owns_business(business_id));

-- ---------- 알림(앱 내) ----------
-- 받는 사람은 가맹점 주인(user_id). 생성은 서버 액션(service role)에서만 한다.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  type        text not null check (type in ('blog_comment', 'blog_like')),
  post_id     uuid references public.blog_posts (id) on delete set null,
  -- 원본이 삭제돼도 알림 목록에서 표시할 수 있도록 비정규화해 저장한다.
  post_title  text,
  site_slug   text,
  post_slug   text,
  actor_name  text,
  preview     text,
  -- 좋아요 중복 알림 방지용 키 (예: 'like:{postId}:{visitorKey}'). 댓글은 null.
  dedup_key   text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
-- dedup_key가 있는 알림은 유일해야 한다 (같은 방문자의 같은 글 좋아요는 1회만 알림)
create unique index if not exists notifications_dedup_key
  on public.notifications (dedup_key) where dedup_key is not null;

alter table public.notifications enable row level security;

-- 본인 알림만 읽고, 읽음 처리(update)하고, 삭제할 수 있다.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (user_id = auth.uid());
