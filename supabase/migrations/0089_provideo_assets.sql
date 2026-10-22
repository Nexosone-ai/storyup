-- 0089: provideo 에셋 — 영상 전에 '싹 다' 만들어 두는 배경(앵글별)·소품.
-- Claude가 에셋 목록(라벨+이미지 프롬프트)을 만들고, GPT가 이미지를 생성해 재사용한다.
-- 0088(provideo_projects) 이후 적용. 파트너 전용 RLS(프로젝트 소유 확인).

create table if not exists public.provideo_assets (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.provideo_projects(id) on delete cascade,
  kind       text not null default 'prop' check (kind in ('background','prop')),
  label      text not null default '',
  prompt     text,                                  -- GPT 이미지 프롬프트(영어)
  image_url  text,
  status     text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table public.provideo_assets enable row level security;
drop policy if exists pva_all on public.provideo_assets;
create policy pva_all on public.provideo_assets
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.provideo_projects p
      where p.id = provideo_assets.project_id and p.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.provideo_projects p
      where p.id = provideo_assets.project_id and p.owner_user_id = auth.uid()
    )
  );
create index if not exists provideo_assets_project_idx
  on public.provideo_assets (project_id, created_at);
