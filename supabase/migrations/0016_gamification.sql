-- 0016: 게이미피케이션 — UP 보상 원장, XP, 스트릭, 활동 로그, 업적, 추천, 정책 설정
-- UP = 기존 point_transactions 포인트의 서비스명. 이 마이그레이션은 "적립" 인프라를 더한다.

-- ---------- 보상 원장 (멱등키의 단일 근거) ----------
create table if not exists public.reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,          -- 멱등키 예: 'signup', 'blog_published:<postId>', 'streak:7:2026-09-01'
  rule text not null,                -- 규칙 코드 예: 'blog_published'
  up int not null default 0,
  xp int not null default 0,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, reward_key)
);
create index if not exists reward_events_user_created_idx
  on public.reward_events (user_id, created_at desc);
create index if not exists reward_events_user_rule_idx
  on public.reward_events (user_id, rule, created_at desc);

-- ---------- XP 누적 (감소하지 않음) ----------
create table if not exists public.user_xp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- 활동 로그 (스트릭·미션·퀘스트·업적의 집계 근거) ----------
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,              -- blog_created / blog_published / card_created / site_updated / share ...
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_user_action_idx
  on public.activity_events (user_id, action, created_at desc);
create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);

-- ---------- 스트릭 (서버 날짜 기준, KST 계산은 앱에서) ----------
create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_date date,
  started date,
  updated_at timestamptz not null default now()
);

-- ---------- 업적 ----------
create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- ---------- 추천 (직접 추천만, referred 1인 1행) ----------
create table if not exists public.referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  paid_rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  check (referred_user_id <> referrer_user_id)
);
create index if not exists referrals_referrer_idx
  on public.referrals (referrer_user_id, created_at desc);

alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code) where referral_code is not null;

-- ---------- 정책 설정 (Admin이 하드코딩 없이 조정) ----------
create table if not exists public.reward_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- Google Search Console 성과 캐시 (사용자별, 하루 1회 갱신) ----------
create table if not exists public.search_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  impressions int not null default 0,
  clicks int not null default 0,
  checked_at timestamptz not null default now()
);

-- ---------- Story Score 일별 스냅샷 ----------
create table if not exists public.story_score_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  score int not null,
  breakdown jsonb,
  primary key (user_id, date)
);

-- ---------- RLS: 본인 조회만, 쓰기는 전부 service role/definer 함수 ----------
alter table public.reward_events      enable row level security;
alter table public.user_xp            enable row level security;
alter table public.activity_events    enable row level security;
alter table public.user_streaks       enable row level security;
alter table public.user_achievements  enable row level security;
alter table public.referrals          enable row level security;
alter table public.reward_settings    enable row level security;
alter table public.search_stats       enable row level security;
alter table public.story_score_history enable row level security;

drop policy if exists reward_events_select on public.reward_events;
create policy reward_events_select on public.reward_events
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_xp_select on public.user_xp;
create policy user_xp_select on public.user_xp
  for select to authenticated using (user_id = auth.uid());
drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_streaks_select on public.user_streaks;
create policy user_streaks_select on public.user_streaks
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_achievements_select on public.user_achievements;
create policy user_achievements_select on public.user_achievements
  for select to authenticated using (user_id = auth.uid());
drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals
  for select to authenticated
  using (referred_user_id = auth.uid() or referrer_user_id = auth.uid());
drop policy if exists search_stats_select on public.search_stats;
create policy search_stats_select on public.search_stats
  for select to authenticated using (user_id = auth.uid());
drop policy if exists story_score_select on public.story_score_history;
create policy story_score_select on public.story_score_history
  for select to authenticated using (user_id = auth.uid());
-- reward_settings: 클라이언트 접근 없음 (서버 admin client 전용)

-- ---------- 보상 지급 함수: 멱등키 충돌 시 아무것도 하지 않는다 ----------
create or replace function public.grant_reward(
  p_user uuid,
  p_key text,
  p_rule text,
  p_up int,
  p_xp int,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.reward_events (user_id, reward_key, rule, up, xp)
  values (p_user, p_key, p_rule, greatest(p_up, 0), greatest(p_xp, 0))
  on conflict (user_id, reward_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return false; -- 이미 지급됨
  end if;

  if p_up > 0 then
    insert into public.point_transactions (user_id, amount, reason, type, ref_type, ref_id)
    values (p_user, p_up, p_reason, 'REWARD', 'reward_event', v_event_id);
  end if;

  if p_xp > 0 then
    insert into public.user_xp (user_id, xp, updated_at)
    values (p_user, p_xp, now())
    on conflict (user_id) do update
      set xp = public.user_xp.xp + excluded.xp, updated_at = now();
  end if;

  return true;
end;
$$;

revoke all on function public.grant_reward(uuid, text, text, int, int, text) from public;
grant execute on function public.grant_reward(uuid, text, text, int, int, text) to service_role;
