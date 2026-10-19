-- ============================================================
--  0075: 영상 보안·과금 하드닝
-- ============================================================
-- (1) video_jobs: 사용자가 status_url/response_url을 바꿔 서버가 fal 키를 임의 주소로
--     보내는 SSRF/키유출을 막기 위해, 쓰기를 서비스롤 전용으로(사용자는 조회만).
-- (2) video_credit_ledger: 주문당 패킷 지급 1회 보장(중복 지급 방지) 유니크 인덱스.
-- 추가 전용(비파괴) — Requires 0074. 운영 적용 필요.

-- (1) video_jobs — 사용자는 SELECT만, 모든 쓰기는 서비스롤(앱 admin 클라이언트).
drop policy if exists video_jobs_own on public.video_jobs;
drop policy if exists video_jobs_own_select on public.video_jobs;
create policy video_jobs_own_select on public.video_jobs
  for select using (public.owns_business(business_id));

-- (2) 패킷 지급 멱등 — 동일 주문(reason='pack:{orderId}') 1회만.
create unique index if not exists video_credit_ledger_grant_uniq
  on public.video_credit_ledger (reason)
  where ref_type = 'grant';
