-- 0085: 추천 스킬 카탈로그 — 관리자가 큐레이션한 공개 GitHub 스킬 목록.
-- 파트너/디자이너가 Skill 보관함에서 원클릭으로 가져온다(가져오기=기존 C1 분석 파이프라인).
-- 쓰기는 서비스롤/관리자(정책 없음), 활성 항목만 읽기 공개.

create table if not exists public.skill_catalog (
  id          uuid primary key default gen_random_uuid(),
  repo_url    text not null,          -- 가져올 공개 GitHub URL
  title       text not null,
  description text,
  tag         text,                   -- 분류 라벨(선택)
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.skill_catalog enable row level security;
drop policy if exists sc_read on public.skill_catalog;
create policy sc_read on public.skill_catalog
  for select using (active or public.is_admin());
create index if not exists skill_catalog_active_idx
  on public.skill_catalog (active, sort_order, created_at desc);
