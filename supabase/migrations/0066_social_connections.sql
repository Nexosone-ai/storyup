-- ============================================================
--  0066: 외부 SNS 연동 — 연결 토큰 + 게시 이력
-- ============================================================
-- social_connections: 페이지/채널 액세스 토큰 보관(서비스롤 전용, youtube_connections와 동일 방침).
-- social_posts:       에이전트/오토파일럿의 외부 게시 큐·이력(소유자 RLS).
-- 추가만 하는 비파괴 변경 — Supabase SQL 에디터에서 실행 가능. Requires 0001(owns_business).

create table if not exists public.social_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid,
  business_id      uuid not null references public.businesses(id) on delete cascade,
  provider         text not null check (provider in ('facebook_page', 'youtube')),
  external_id      text not null,
  display_name     text,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scope            text,
  meta             jsonb,
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (business_id, provider, external_id)
);
create index if not exists social_connections_biz_idx
  on public.social_connections (business_id, provider, enabled);

-- 토큰 보관 — 서비스롤(서버)만 접근. 클라이언트 직접 접근 불가(정책 없음).
alter table public.social_connections enable row level security;

create table if not exists public.social_posts (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  provider         text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'posted', 'failed')),
  message          text,
  link             text,
  media_url        text,
  external_post_id text,
  scheduled_at     timestamptz,
  posted_at        timestamptz,
  error            text,
  source           text not null default 'manual' check (source in ('manual', 'autopilot')),
  created_at       timestamptz not null default now()
);
create index if not exists social_posts_biz_idx
  on public.social_posts (business_id, created_at desc);

alter table public.social_posts enable row level security;
drop policy if exists social_posts_own on public.social_posts;
create policy social_posts_own on public.social_posts
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
