-- ============================================================
--  STORYUP — Phase 5: 요금제 구독 + 월 제공량 + 월 포인트 지급
--  Idempotent. Run in Supabase SQL editor. Requires 0008.
--  플랜 정의(한도·가격)는 코드(src/lib/plans.ts)가 단일 소스이며,
--  DB는 "누가 어떤 플랜인지"와 "무엇을 얼마나 썼는지"만 기록한다.
-- ============================================================

-- ---------- 1) 구독 (사용자당 1행, 행이 없으면 free) ----------
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  plan               text not null default 'free'
                       check (plan in ('free','basic','pro','partner')),
  status             text not null default 'active'
                       check (status in ('active','canceled')),
  current_period_end timestamptz,                -- 정기결제 도입 후 사용
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists sub_select on public.subscriptions;
create policy sub_select on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- 쓰기는 service role(서버) 전용 — 클라이언트가 플랜을 조작할 수 없다.

-- ---------- 2) 사용량 이벤트 (월 제공량 계산 근거) ----------
create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null
               check (kind in ('site','blog_post','card_news','ai_image')),
  charged    integer not null default 0,          -- 0 = 월 제공량 내, >0 = 초과분 포인트 차감액
  created_at timestamptz not null default now()
);
create index if not exists ue_user_kind_idx
  on public.usage_events (user_id, kind, created_at desc);

alter table public.usage_events enable row level security;
drop policy if exists ue_select on public.usage_events;
create policy ue_select on public.usage_events
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- 쓰기는 service role 전용.

-- ---------- 3) 월 포인트 지급 (멱등 가드) ----------
create table if not exists public.plan_grants (
  user_id    uuid not null references auth.users (id) on delete cascade,
  period     text not null,                       -- 'YYYY-MM' (Asia/Seoul 기준)
  plan       text not null,
  amount     integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, period)
);

alter table public.plan_grants enable row level security;
drop policy if exists pg_select on public.plan_grants;
create policy pg_select on public.plan_grants
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- 지급: 같은 (user, period)에 한 번만. 동시 호출에도 안전.
create or replace function public.grant_plan_points(
  p_user uuid,
  p_plan text,
  p_period text,
  p_amount integer
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  insert into public.plan_grants (user_id, period, plan, amount)
    values (p_user, p_period, p_plan, p_amount)
    on conflict (user_id, period) do nothing;
  if not found then
    return false; -- 이번 달 지급 완료됨
  end if;
  if p_amount > 0 then
    insert into public.point_transactions (user_id, amount, reason, type, ref_type)
      values (p_user, p_amount,
              p_period || ' ' || p_plan || ' 플랜 월 포인트',
              'PLAN_CREDIT', 'plan_grant');
  end if;
  return true;
end $$;

revoke all on function public.grant_plan_points(uuid, text, text, integer) from public;
revoke all on function public.grant_plan_points(uuid, text, text, integer) from anon;
revoke all on function public.grant_plan_points(uuid, text, text, integer) from authenticated;
grant execute on function public.grant_plan_points(uuid, text, text, integer) to service_role;
