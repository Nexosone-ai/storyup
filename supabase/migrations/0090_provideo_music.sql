-- 0090: provideo 음악(SUNO) — 프로젝트에 생성된 BGM URL 저장.
alter table public.provideo_projects
  add column if not exists music_url text;
