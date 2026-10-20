-- 0083: GitHub Skill Hub — 공개 저장소에서 가져온 Skill 패키지 기록(보관함).
-- 실행(D단계)과 분리. commit SHA로 고정하고, 라이선스·지원수준·파일목록을 기록한다.
-- 가져오기/분석은 서버에서만, 토큰은 프런트/Skill 컨텍스트에 노출하지 않는다.

create table if not exists public.skill_sources (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  repo          text not null,                 -- "owner/repo"
  ref           text,                          -- 요청한 branch/tag
  commit_sha    text not null,                 -- 고정된 commit
  skill_path    text not null default '',      -- SKILL.md가 있는 폴더
  skill_name    text not null,
  description   text,
  license       text,                          -- 감지된 라이선스(불명확이면 null)
  compatibility text,
  skill_type    text not null,                 -- A|B|C|D
  support_level text not null,                 -- instructions|adapter|blocked
  support_reason text,
  files         jsonb not null default '[]'::jsonb,   -- [{path,size,type,sha}]
  manifest      jsonb,                          -- 파싱된 frontmatter + 본문 요약
  status        text not null default 'imported' check (status in ('imported','disabled')),
  created_at    timestamptz not null default now()
);

alter table public.skill_sources enable row level security;
drop policy if exists ss_all on public.skill_sources;
create policy ss_all on public.skill_sources
  for all using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());

create index if not exists skill_sources_owner_idx on public.skill_sources (owner_user_id, created_at desc);
