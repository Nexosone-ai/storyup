-- 0041: AI 마케팅 전략 — 사용 분석 기반 전략 생성 결과 저장.
-- Basic=월 1회, Pro=상시. plan.aiStrategy 게이팅은 애플리케이션에서 처리.

create table if not exists public.marketing_strategies (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists marketing_strategies_business_idx
  on public.marketing_strategies (business_id, created_at desc);

alter table public.marketing_strategies enable row level security;

drop policy if exists marketing_strategies_owner_select on public.marketing_strategies;
create policy marketing_strategies_owner_select on public.marketing_strategies
  for select using (
    exists (
      select 1 from public.businesses b
      where b.id = marketing_strategies.business_id and b.user_id = auth.uid()
    )
  );

drop policy if exists marketing_strategies_owner_insert on public.marketing_strategies;
create policy marketing_strategies_owner_insert on public.marketing_strategies
  for insert with check (
    exists (
      select 1 from public.businesses b
      where b.id = marketing_strategies.business_id and b.user_id = auth.uid()
    )
  );
