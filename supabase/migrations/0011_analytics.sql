-- ============================================================
--  0011: 애널리틱스 — 공개 사이트 이벤트(조회·공유) 수집
-- ============================================================

create table if not exists public.site_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  event       text not null check (event in ('page_view', 'share')),
  -- page_view: 조회한 경로 (예: /site/cafe, /site/cafe/blog/opening)
  path        text not null default '',
  -- share: 공유 채널 (x, facebook, kakao, link, ...) / page_view: null
  channel     text,
  referrer    text,
  created_at  timestamptz not null default now()
);
create index if not exists site_events_business_idx
  on public.site_events (business_id, created_at desc);

alter table public.site_events enable row level security;

-- 방문자(anon 포함) 누구나 이벤트를 기록할 수 있다.
-- 서버 API(/api/track)가 값을 정규화해 넣지만, 직접 insert돼도 스키마 체크로 제한된다.
drop policy if exists site_events_insert_any on public.site_events;
create policy site_events_insert_any on public.site_events
  for insert with check (
    char_length(path) <= 300
    and (channel is null or char_length(channel) <= 40)
    and (referrer is null or char_length(referrer) <= 300)
  );

-- 소유자만 조회
drop policy if exists site_events_select_own on public.site_events;
create policy site_events_select_own on public.site_events
  for select using (public.owns_business(business_id));
