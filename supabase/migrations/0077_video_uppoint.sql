-- 0077: AI 영상 생성 과금을 '월 무료 패킷'에서 'UP 포인트 차감'으로 전환.
-- - service_prices에 AI_VIDEO 단가 시드(기본 1000P=₩1,000). 관리자 화면에서 수정.
-- - video_jobs.charged: 제출 시 선차감한 UP을 기록 → 생성 실패 시 정확히 환급.

insert into public.service_prices (service, label, price, active)
values ('AI_VIDEO', 'AI 영상 생성', 1000, true)
on conflict (service) do nothing;

alter table public.video_jobs
  add column if not exists charged integer not null default 0;
