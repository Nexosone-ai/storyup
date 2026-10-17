-- ============================================================
--  0067: AI 오토파일럿 — 자동 스케줄 루틴 + 감사로그 + 서비스 가격 시드
-- ============================================================
-- agent_routines: 사업장별 자동 마케팅 루틴(기본 OFF, 기본 autonomy=propose).
-- agent_run_logs: 루틴 실행 감사로그(한도 집계·내역 표시).
-- 추가만 하는 비파괴 변경 — Supabase SQL 에디터에서 실행 가능.
-- Requires 0001(owns_business/is_admin), 0008(service_prices), 0064(agent_proposals).

create table if not exists public.agent_routines (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  kind            text not null check (kind in ('blog', 'cardnews', 'facebook')),
  cadence         text not null default 'weekly'
                    check (cadence in ('daily', 'weekly', 'biweekly', 'monthly')),
  params          jsonb not null default '{}'::jsonb,
  enabled         boolean not null default false,
  autonomy        text not null default 'propose' check (autonomy in ('propose', 'auto')),
  max_per_day     int not null default 1,   -- 하루 최대 자동 실행 횟수(하드캡)
  monthly_cap     int not null default 10,  -- 한 달 최대 자동 실행 횟수(0 = 무제한)
  quiet_start     int,                       -- 0~23 (Asia/Seoul), null이면 미설정
  quiet_end       int,
  next_run_at     timestamptz not null default now(),
  last_run_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists agent_routines_due_idx
  on public.agent_routines (enabled, next_run_at);
create index if not exists agent_routines_biz_idx
  on public.agent_routines (business_id, created_at desc);

create table if not exists public.agent_run_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  routine_id  uuid references public.agent_routines(id) on delete set null,
  action      text not null,
  status      text not null,
  detail      jsonb,
  charged     int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists agent_run_logs_biz_idx
  on public.agent_run_logs (business_id, created_at desc);

-- RLS — 소유자 전체 + 관리자 조회. 쓰기는 소유자 세션/서비스롤(크론).
alter table public.agent_routines enable row level security;
drop policy if exists agent_routines_own on public.agent_routines;
create policy agent_routines_own on public.agent_routines
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
drop policy if exists agent_routines_admin on public.agent_routines;
create policy agent_routines_admin on public.agent_routines
  for select using (public.is_admin());

alter table public.agent_run_logs enable row level security;
drop policy if exists agent_run_logs_own on public.agent_run_logs;
create policy agent_run_logs_own on public.agent_run_logs
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
drop policy if exists agent_run_logs_admin on public.agent_run_logs;
create policy agent_run_logs_admin on public.agent_run_logs
  for select using (public.is_admin());

-- AI 에이전트/오토파일럿 서비스 가격 시드(0 = 무료, 관리자 화면에서 조정).
insert into public.service_prices (service, label, price) values
  ('AI_AGENT_CHAT', 'AI 에이전트 대화', 0),
  ('AI_AUTOPILOT',  'AI 오토파일럿 실행', 0)
on conflict (service) do nothing;
