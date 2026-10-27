-- 파트너 '유사 영상 10개' — 영상 길이(초) 선택 추가.
-- 배치마다 길이를 기록해 재진입 시에도 표시하고, fal 큐에 duration으로 전달한다.
-- 길이가 길수록 파트너 패킷을 배수로 더 차감한다(원본 fal 비용도 길이에 비례).
alter table public.similar_video_batches
  add column if not exists seconds int not null default 5;
