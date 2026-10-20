-- 0086: 디자인 프롬프트 프리셋(관리자 큐레이션) — 편집기 '프롬프트로 구성' 박스.
-- 관리자가 추가/편집하고, 파트너 편집기는 활성 프리셋을 박스로 노출(없으면 내장 기본값).
-- 쓰기는 서비스롤/관리자(정책 없음), 활성 항목만 읽기 공개.

create table if not exists public.design_prompts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  tag         text,
  hint        text,
  prompt      text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.design_prompts enable row level security;
drop policy if exists dprompt_read on public.design_prompts;
create policy dprompt_read on public.design_prompts
  for select using (active or public.is_admin());
create index if not exists design_prompts_active_idx
  on public.design_prompts (active, sort_order, created_at desc);
