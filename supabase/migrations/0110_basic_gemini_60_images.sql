-- 0110: 파트너 기본 상품(Basic) 재구성 — 카드뉴스 10건·쇼츠 10편·AI 이미지 월 60장(고화질 Gemini).
-- 코드(src/lib/plans.ts)의 한도 변경에 맞춰 관리자 기본상품 카탈로그·업세일 분야 설명 텍스트만 갱신한다.
-- replace() 로 해당 줄만 바꾸므로 0105(포함내역 확장 텍스트) 적용 전후 어느 순서로 실행해도 안전하다.

update public.base_plan_catalog
set included_services = replace(replace(replace(included_services,
      E'SNS 카드뉴스(6매) 5건/월', E'SNS 카드뉴스(6매) 10건/월'),
      E'AI 카드뉴스 영상(쇼츠) 5편/월', E'AI 카드뉴스 영상(쇼츠) 10편/월'),
      E'AI 이미지 생성 월 100장', E'AI 이미지 생성 월 60장 (고화질)'),
    updated_at = now()
where plan = 'basic';

update public.agency_services
set description = replace(description, '기본 상품 월 100장을 넘는', '기본 상품 월 60장을 넘는')
where key = 'EXTRA_IMAGES';

update public.agency_services
set description = replace(description, '기본 상품 월 5건을 넘는', '기본 상품 월 10건을 넘는')
where key = 'EXTRA_CARDNEWS';
