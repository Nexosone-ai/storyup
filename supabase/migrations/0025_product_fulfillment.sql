-- ============================================================
--  0025: 상품 결제 자동 이행(fulfillment)
--  일반결제 상품에 "지급할 구독 플랜 + 기간"을 연결한다.
--  결제 성공 시 구매자 이메일과 일치하는 계정에 해당 플랜을 자동 부여.
-- ============================================================

alter table public.products
  -- 결제 완료 시 자동 지급할 구독 플랜 id (basic/pro). null = 지급 없음(순수 상품)
  add column if not exists grants_plan text,
  -- 지급 기간(일). 기본 30일(1개월)
  add column if not exists grant_days integer not null default 30;
