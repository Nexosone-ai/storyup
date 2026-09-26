-- 구독 만기 알림 인프라: 웹 푸시 구독 저장 + 알림 발송 중복 방지 로그.
-- (인앱 알림은 기존 notifications 테이블에 type='sub_expiring'으로 적재)

-- 브라우저 웹 푸시 구독 (사용자당 여러 기기 가능, endpoint 유니크)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- 서버(admin client) 전용 — 클라 접근 정책 없음(저장/삭제는 서버 액션이 대행).

-- 알림 발송 멱등 로그 (채널별 dedup_key로 중복 발송 차단)
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,       -- 'daily' | 'email'
  dedup_key text not null,     -- 'expiry:<periodEndDate>:<sendDate>' | 'expiry_email:<periodEndDate>'
  created_at timestamptz not null default now(),
  unique (channel, dedup_key)
);
alter table public.reminder_log enable row level security;
