-- ============================================================
--  0064: AI 비즈니스 에이전트 — 대화·메시지·기억·제안
-- ============================================================
-- Pro 사업주가 /business/{id}/agent에서 전담 Claude 에이전트와 대화한다.
-- 모든 테이블은 business_id 기준 RLS(owns_business)로 사업체/사용자별 격리.
-- (Pro 전용 게이트는 앱 레이어. 쓰기는 소유자 세션으로 수행되어 owns_business 통과.)
-- 멱등 — Supabase SQL 에디터에서 실행 가능. Requires 0001(owns_business).

create table if not exists public.agent_conversations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists agent_conversations_biz_idx
  on public.agent_conversations (business_id, updated_at desc);

create table if not exists public.agent_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  tool_json       jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists agent_messages_conv_idx
  on public.agent_messages (conversation_id, created_at);

create table if not exists public.agent_memories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind        text not null default 'fact',
  content     text not null,
  source      text,
  superseded  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists agent_memories_biz_idx
  on public.agent_memories (business_id, superseded, created_at desc);

create table if not exists public.agent_proposals (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.agent_conversations(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  action          text not null,
  params          jsonb not null default '{}'::jsonb,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'done', 'rejected', 'failed')),
  result          jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists agent_proposals_biz_idx
  on public.agent_proposals (business_id, created_at desc);

-- RLS — 소유자(owns_business)만 접근.
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_memories enable row level security;
alter table public.agent_proposals enable row level security;

drop policy if exists agent_conversations_own on public.agent_conversations;
create policy agent_conversations_own on public.agent_conversations
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists agent_messages_own on public.agent_messages;
create policy agent_messages_own on public.agent_messages
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists agent_memories_own on public.agent_memories;
create policy agent_memories_own on public.agent_memories
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists agent_proposals_own on public.agent_proposals;
create policy agent_proposals_own on public.agent_proposals
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
