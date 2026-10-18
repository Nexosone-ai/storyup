-- ============================================================
--  0072: 서포터(파트너) 프로필 — 작업 현황 + 이력 내용
-- ============================================================
-- 대행 서포터(=파트너)가 자신의 작업 현황(현재 수주 가능 여부 등)과 경력/이력을
-- 올려 클라이언트에게 보여줄 수 있도록 supporter_profiles에 필드 추가.
-- 추가 전용(비파괴) — SQL 에디터 실행 가능. Requires 0005(supporter_profiles).

alter table public.supporter_profiles
  add column if not exists work_status text,   -- 현재 작업 현황(예: 수주 가능, 1주 대기)
  add column if not exists history text,        -- 경력/이력/포트폴리오 설명(자유 텍스트)
  -- 승인 상태: 기존 행/관리자 등록분은 active 유지(default), 자가 신청은 앱에서 pending으로 삽입 → 관리자 승인.
  add column if not exists status text not null default 'active'
    check (status in ('pending', 'active', 'rejected'));
create index if not exists supporter_profiles_status_idx
  on public.supporter_profiles (status);
