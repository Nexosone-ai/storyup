-- 일회성 데이터 보정(기록용). 2026-09-26 실행됨.
-- 2026-09-21 "기존 가입자 → Basic 전환" 작업이 plan은 basic으로 바꿨으나
-- current_period_end 를 비워둬(null), 해당 체험 사용자들이 만료 없이 무기한
-- Basic 으로 남는 문제가 있었다(getPlanId는 period_end 가 null 이면 만료 판정을
-- 건너뜀). 의도된 정책은 "가입 1개월 뒤 만료 → Free" 이므로 만료일을 가입일+1개월로 채운다.
--
-- 대상: 미과금 체험(trial=true, billing_key null)이면서 만료일이 비어있는 구독만.
--       실제 결제(billing_key 존재) 사용자는 제외. period_end 가 이미 있으면 건너뜀 → 재실행 안전.

update subscriptions s
set current_period_end = u.created_at + interval '1 month',
    updated_at = now()
from auth.users u
where u.id = s.user_id
  and s.trial = true
  and s.billing_key is null
  and s.current_period_end is null;
