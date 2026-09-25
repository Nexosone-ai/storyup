-- ============================================================
--  0031: 공지사항 팝업 (관리자 작성 → 로그인 사용자에게 팝업)
-- ============================================================
-- 관리자가 공지 팝업을 템플릿 형태로 작성한다(제목·내용·이미지·버튼·기간).
-- - 노출 기간(starts_at ~ ends_at)과 활성 여부(active)로 표시를 제어한다.
-- - 조회는 활성 + 기간 내인 공지만(RLS). 작성/수정/삭제는 서버 액션(service role)에서만.
-- - 사용자별 '오늘 하루 보지 않기'는 클라이언트(localStorage)에서 처리 — 서버 상태 아님.

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,                 -- 본문(줄바꿈 유지해 표시)
  image_url   text,                          -- 상단 이미지 (선택)
  link_url    text,                          -- 버튼 링크 (선택)
  link_label  text,                          -- 버튼 문구 (선택)
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  active      boolean not null default true, -- 수동 on/off
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 현재 노출 대상(활성 + 기간 내) 조회를 빠르게.
create index if not exists announcements_live_idx
  on public.announcements (active, starts_at, ends_at);

create or replace trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

-- 로그인 사용자는 '활성 + 기간 내' 공지만 조회한다. (작성/수정/삭제 정책 없음 = 서버 액션 전용)
drop policy if exists announcements_select_live on public.announcements;
create policy announcements_select_live on public.announcements
  for select
  to authenticated
  using (active and now() between starts_at and ends_at);
