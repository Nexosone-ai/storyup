-- ============================================================
--  0057: 광고 집행 승인 플로우 — 블로거 요청 → 광고주 승인
--  ad_placements.status에 'requested'(요청 대기)·'declined'(거절) 추가.
--  기본값을 'requested'로. 기존 'active' 행은 그대로 유효(하위호환).
--  Idempotent. Requires 0055.
-- ============================================================

alter table public.ad_placements
  drop constraint if exists ad_placements_status_check;
alter table public.ad_placements
  add constraint ad_placements_status_check
  check (status in ('requested','active','paused','ended','declined'));
alter table public.ad_placements
  alter column status set default 'requested';
