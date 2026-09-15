-- ============================================================
--  0024: 블로그 예약 발행 — scheduled_at
--  예약 글은 status='draft' 유지(공개 RLS/쿼리가 숨김) + scheduled_at(미래) 설정.
--  크론(/api/cron/publish)이 시각 도래 시 published로 전환한다.
-- ============================================================

alter table public.blog_posts
  add column if not exists scheduled_at timestamptz;

-- 크론이 "발행 예정(초안 + 예약시각 도래)" 글을 빠르게 찾도록
create index if not exists blog_posts_scheduled_idx
  on public.blog_posts (scheduled_at)
  where status = 'draft' and scheduled_at is not null;
