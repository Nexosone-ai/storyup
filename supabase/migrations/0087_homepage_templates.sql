-- 0087: 홈페이지 디자인 템플릿(블로그 연동형) — 디자인 + 추상 바인딩 규칙만 저장.
-- 판매자 사업장ID/연락처/이미지/실제 글은 저장하지 않는다(toHomepageTemplate가 제거).
-- 구매자가 설치하면 바인딩이 구매자 자신의 블로그로 연결된다(설치는 초안).
-- 쓰기는 소유자/서비스롤, 공개(is_listed)만 타인 읽기 허용.

create table if not exists public.homepage_templates (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title         text not null default '',
  description   text,
  -- 정제된 WebsiteContent(디자인 + 블로그 바인딩 규칙만).
  content       jsonb not null,
  -- 마켓 노출 여부(기본 비공개). 발행/판매 연동은 후속.
  is_listed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.homepage_templates enable row level security;
drop policy if exists ht_read on public.homepage_templates;
create policy ht_read on public.homepage_templates
  for select using (is_listed or owner_user_id = auth.uid() or public.is_admin());
drop policy if exists ht_write on public.homepage_templates;
create policy ht_write on public.homepage_templates
  for all using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());
create index if not exists homepage_templates_owner_idx
  on public.homepage_templates (owner_user_id, created_at desc);
create index if not exists homepage_templates_listed_idx
  on public.homepage_templates (is_listed, created_at desc);
