-- 파트너 '유사 영상 10개' 패킷(크레딧) 단가 — 배치 1회(영상 10편)당 차감.
-- 관리자 '파트너' 탭에서 값·활성 여부를 조정할 수 있다(기존 행만 수정하므로 먼저 시드).
-- 단가 행이 없으면 chargePartnerCredits가 fail-closed로 생성을 차단하므로 반드시 필요.
insert into public.partner_credit_prices (action, label, credits) values
  ('SIMILAR_VIDEO', '유사 영상 10개 생성(1회)', 100)
on conflict (action) do nothing;
