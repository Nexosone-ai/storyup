-- 0048: 정기결제 자동갱신 청구용 결제자 정보.
-- KG이니시스는 빌링키 '결제' 요청에도 결제자 이름·이메일·휴대폰이 필수라(없으면 400)
-- 첫 결제 때 입력받은 값을 구독 행에 보관해 매월 크론 갱신 청구에 재사용한다.
-- Idempotent.
alter table public.subscriptions
  add column if not exists buyer_name text,
  add column if not exists buyer_email text,
  add column if not exists buyer_phone text;
