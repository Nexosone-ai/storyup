-- 0078: 영상 생성이 UP 과금으로 바뀐 뒤 남은 영상팩/영상크레딧 정리.
-- (1) 더 이상 쓰지 않는 영상 크레딧을 지급하던 '영상 팩' 상품 비활성화.
--     앞으로 UP은 포인트 패키지(/dashboard/points)로 충전한다. 팩 지급 코드(fulfillProductOrder)는
--     이미 'UP 지급'으로 전환됨(video_credit_ledger 대신 point_transactions).
-- (2) 혹시 남아있는 video_credit_ledger 잔액(1편 = AI_VIDEO 단가)을 UP로 전환하고 원장을 0으로.
--     멱등: 잔액이 0이면 아무 행도 삽입하지 않으며, 재실행해도 안전.

update public.products set active = false
where slug in ('video-pack-10', 'video-pack-30');

-- 잔여 영상 크레딧 → UP 지급
insert into public.point_transactions (user_id, amount, reason, type, ref_type)
select l.user_id,
       sum(l.amount) * coalesce(
         (select price from public.service_prices
          where service = 'AI_VIDEO' and active and price > 0), 1000),
       'AI 영상 크레딧 → UP 전환', 'ADJUST', 'video_credit_migration'
from public.video_credit_ledger l
group by l.user_id
having sum(l.amount) > 0;

-- 전환한 만큼 영상 크레딧 원장 소진(0으로)
insert into public.video_credit_ledger (user_id, amount, reason, ref_type)
select l.user_id, -sum(l.amount), 'UP 전환으로 소진', 'use'
from public.video_credit_ledger l
group by l.user_id
having sum(l.amount) > 0;
