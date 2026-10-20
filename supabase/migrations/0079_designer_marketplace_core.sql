-- 0079: 디자이너 스튜디오 + 템플릿 마켓 — 1단계 코어 레지스트리.
-- 가산형. 앱 feature flag(NEXT_PUBLIC_MARKETPLACE_ENABLED) 뒤에서만 쓰이며, 1단계엔
-- 공개(마켓) 노출이 없다. RLS는 소유자 + 관리자만. 결제/정산/라이선스는 후속 단계.

-- 디자이너 권한 — 파트너 계정 내 '별도' 권한(파트너 AI Agent 자동화와 독립).
create table if not exists public.designer_permissions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  status     text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.designer_permissions enable row level security;
drop policy if exists dp_select on public.designer_permissions;
create policy dp_select on public.designer_permissions
  for select using (user_id = auth.uid() or public.is_admin());
-- 쓰기는 서비스롤/관리자만(정책 없음 → 서버 admin client 전용).

-- 디자인 Skill(제작 패키지) + 불변 버전.
create table if not exists public.design_skills (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  key           text not null,
  title         text not null default '',
  status        text not null default 'draft' check (status in ('draft','active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_user_id, key)
);
create table if not exists public.skill_versions (
  id             uuid primary key default gen_random_uuid(),
  skill_id       uuid not null references public.design_skills(id) on delete cascade,
  version        text not null,
  manifest       jsonb not null default '{}'::jsonb,
  tokens         jsonb not null default '{}'::jsonb,
  page_schema    jsonb not null default '{}'::jsonb,
  slots          jsonb not null default '[]'::jsonb,
  sample_content jsonb not null default '{}'::jsonb,
  checks         jsonb not null default '{}'::jsonb,
  status         text not null default 'draft' check (status in ('draft','active','archived')),
  created_at     timestamptz not null default now()
);
create index if not exists skill_versions_skill_idx on public.skill_versions (skill_id, created_at desc);

-- 디자인 템플릿 + 불변 버전(심사 단위).
create table if not exists public.design_templates (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  skill_id      uuid references public.design_skills(id) on delete set null,
  title         text not null default '',
  status        text not null default 'draft' check (status in ('draft','active','suspended','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table if not exists public.template_versions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.design_templates(id) on delete cascade,
  version       integer not null default 1,
  page_schema   jsonb not null default '{}'::jsonb,
  tokens        jsonb not null default '{}'::jsonb,
  status        text not null default 'draft'
                check (status in ('draft','submitted','approved','published','rejected','suspended','archived')),
  created_at    timestamptz not null default now(),
  unique (template_id, version)
);
create index if not exists template_versions_tpl_idx on public.template_versions (template_id, version desc);

-- RLS: 소유자 전체 + 관리자. (공개 마켓 읽기는 후속 단계에서 published 전용 정책 추가)
alter table public.design_skills      enable row level security;
alter table public.skill_versions     enable row level security;
alter table public.design_templates   enable row level security;
alter table public.template_versions  enable row level security;

drop policy if exists ds_all on public.design_skills;
create policy ds_all on public.design_skills
  for all using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists sv_all on public.skill_versions;
create policy sv_all on public.skill_versions
  for all using (
    public.is_admin() or exists (
      select 1 from public.design_skills s
      where s.id = skill_versions.skill_id and s.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.design_skills s
      where s.id = skill_versions.skill_id and s.owner_user_id = auth.uid()
    )
  );

drop policy if exists dt_all on public.design_templates;
create policy dt_all on public.design_templates
  for all using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists tv_all on public.template_versions;
create policy tv_all on public.template_versions
  for all using (
    public.is_admin() or exists (
      select 1 from public.design_templates t
      where t.id = template_versions.template_id and t.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.design_templates t
      where t.id = template_versions.template_id and t.owner_user_id = auth.uid()
    )
  );
