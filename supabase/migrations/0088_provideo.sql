-- 0088: 파트너 전문 영상 파이프라인(provideo) — 스토리(Claude)→이미지(GPT)→영상(Seedance)→음악(SUNO).
-- Phase 1: 프로젝트 + 장면(스토리보드). 이미지/영상 URL·에셋은 후속 Phase에서 채운다.
-- 파트너 전용. 쓰기는 소유자/서비스롤, 읽기는 소유자/관리자.

create table if not exists public.provideo_projects (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_id   uuid references public.businesses(id) on delete set null,
  title         text not null default '',
  concept       text not null default '',           -- 입력 컨셉/브리프
  aspect        text not null default '9:16' check (aspect in ('9:16','16:9','1:1')),
  quality       text not null default '720p' check (quality in ('480p','720p','1080p')),
  music_prompt  text,                                -- Claude가 만든 음악(SUNO) 프롬프트
  status        text not null default 'draft'
                check (status in ('draft','storyboard','assets','rendering','done')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.provideo_projects enable row level security;
drop policy if exists pvp_all on public.provideo_projects;
create policy pvp_all on public.provideo_projects
  for all using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());
create index if not exists provideo_projects_owner_idx
  on public.provideo_projects (owner_user_id, created_at desc);

create table if not exists public.provideo_scenes (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.provideo_projects(id) on delete cascade,
  idx          integer not null default 0,
  script       text,                                 -- 장면 내레이션/설명
  image_prompt text,                                 -- Claude가 만든 이미지 프롬프트(GPT용)
  image_url    text,                                 -- Phase 2(GPT 이미지)
  video_url    text,                                 -- Phase 3(Seedance 영상)
  status       text not null default 'draft',
  created_at   timestamptz not null default now()
);
alter table public.provideo_scenes enable row level security;
-- 소유자(프로젝트 주인) 또는 관리자만. 서브쿼리로 프로젝트 소유 확인.
drop policy if exists pvs_all on public.provideo_scenes;
create policy pvs_all on public.provideo_scenes
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.provideo_projects p
      where p.id = provideo_scenes.project_id and p.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.provideo_projects p
      where p.id = provideo_scenes.project_id and p.owner_user_id = auth.uid()
    )
  );
create index if not exists provideo_scenes_project_idx
  on public.provideo_scenes (project_id, idx);
