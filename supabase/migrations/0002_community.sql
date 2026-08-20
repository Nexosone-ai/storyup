-- ============================================================
--  STORYUP — Phase: Community (Story Connect + Real Talk)
--  Idempotent. Run in Supabase SQL editor.
-- ============================================================

-- ---------- Story Connect (business owner story feed) ----------
create table if not exists public.story_connect_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '익명',
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists scp_created_idx on public.story_connect_posts (created_at desc);

create table if not exists public.story_connect_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.story_connect_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists scl_post_idx on public.story_connect_likes (post_id);

-- ---------- Real Talk (anonymous one-liners) ----------
create table if not exists public.real_talk_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists rtp_created_idx on public.real_talk_posts (created_at desc);

create table if not exists public.real_talk_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.real_talk_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists rtl_post_idx on public.real_talk_likes (post_id);

-- ---------- RLS ----------
alter table public.story_connect_posts enable row level security;
alter table public.story_connect_likes enable row level security;
alter table public.real_talk_posts    enable row level security;
alter table public.real_talk_likes    enable row level security;

-- Story Connect posts: any signed-in user reads; author writes/deletes own.
drop policy if exists scp_read on public.story_connect_posts;
create policy scp_read on public.story_connect_posts for select to authenticated using (true);
drop policy if exists scp_insert on public.story_connect_posts;
create policy scp_insert on public.story_connect_posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists scp_delete on public.story_connect_posts;
create policy scp_delete on public.story_connect_posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists scl_read on public.story_connect_likes;
create policy scl_read on public.story_connect_likes for select to authenticated using (true);
drop policy if exists scl_insert on public.story_connect_likes;
create policy scl_insert on public.story_connect_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists scl_delete on public.story_connect_likes;
create policy scl_delete on public.story_connect_likes for delete to authenticated using (user_id = auth.uid());

-- Real Talk posts: any signed-in user reads; author writes/deletes own.
drop policy if exists rtp_read on public.real_talk_posts;
create policy rtp_read on public.real_talk_posts for select to authenticated using (true);
drop policy if exists rtp_insert on public.real_talk_posts;
create policy rtp_insert on public.real_talk_posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rtp_delete on public.real_talk_posts;
create policy rtp_delete on public.real_talk_posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists rtl_read on public.real_talk_likes;
create policy rtl_read on public.real_talk_likes for select to authenticated using (true);
drop policy if exists rtl_insert on public.real_talk_likes;
create policy rtl_insert on public.real_talk_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rtl_delete on public.real_talk_likes;
create policy rtl_delete on public.real_talk_likes for delete to authenticated using (user_id = auth.uid());
