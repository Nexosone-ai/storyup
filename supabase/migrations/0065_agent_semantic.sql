-- ============================================================
--  0065: AI 에이전트 시맨틱 기억검색 — pgvector 임베딩
-- ============================================================
-- agent_memories에 임베딩 컬럼을 추가하고, 질의와 코사인 유사도가 높은
-- 비폐기 기억만 돌려주는 RPC를 둔다. (임베딩 미사용 시 앱은 최근순 폴백)
-- 추가만 하는 비파괴 변경 — Supabase SQL 에디터에서 실행 가능.
-- Requires 0001(owns_business), 0064(agent_memories).

create extension if not exists vector;

-- text-embedding-3-small = 1536차원.
alter table public.agent_memories
  add column if not exists embedding vector(1536);

-- 코사인 거리 기반 근사 최근접 인덱스(HNSW).
create index if not exists agent_memories_embedding_idx
  on public.agent_memories using hnsw (embedding vector_cosine_ops);

-- 사업체 기억을 질의 임베딩과의 유사도순으로 반환.
-- security definer — 인증 사용자는 소유자만, 서비스롤(auth.uid() null)은 백엔드로 신뢰.
create or replace function public.match_agent_memories(
  p_business uuid,
  p_query    text,
  p_count    int default 8
)
returns table (content text, similarity double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.owns_business(p_business) then
    return;
  end if;
  return query
    select m.content,
           1 - (m.embedding <=> p_query::vector) as similarity
    from public.agent_memories m
    where m.business_id = p_business
      and m.superseded = false
      and m.embedding is not null
    order by m.embedding <=> p_query::vector
    limit greatest(1, least(p_count, 20));
end;
$$;

revoke all on function public.match_agent_memories(uuid, text, int) from public;
grant execute on function public.match_agent_memories(uuid, text, int)
  to authenticated, service_role;
