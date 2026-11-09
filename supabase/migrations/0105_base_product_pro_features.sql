-- 0105: 파트너 기본 상품(Basic) 포함 내역 확장 — 상세 홈페이지·AEO FAQ·예약 모듈·고급 분석·주간 리포트·3계정
-- src/lib/plans.ts basic 과 동일하게 맞춘다(2026-11-09). 공급가 ₩20,000(VAT 별도) 유지.
update public.base_plan_catalog
set display_name      = 'STORYUP 기본 상품 (Basic)',
    summary           = '소상공인 1사업장 마케팅 자동화 기본 상품 — 추가 이용은 담당 파트너 업세일',
    included_services = E'AI 랜딩페이지 1개 (레이아웃 모두 사용)\nAI 상세 홈페이지 생성 (자료 입력 → 풍부한 섹션)\n블로그 생성 20건/월\nSNS 카드뉴스(6매) 5건/월\nAI 카드뉴스 영상(쇼츠) 5편/월\nAI 이미지 생성 월 100장\nAEO/GEO 답변엔진 최적화(FAQ 생성)\nSTORYUP 자체 도메인(storyup.me/내도메인)\nSTORYUP 워터마크 제거\n블로그 하단 쿠폰 발행 기능\n블로그 하단 예약(식당·매장) 기능\n사용 분석 기반 AI 전략 수립\nSEO 최적화 기능\n성과 리포트 (주간·월간)\n방문자 분석 (고급)\n관리자/직원 3계정\n추가 이용(블로그·카드뉴스·영상·이미지·Pro 전환)은 담당 파트너에게 문의',
    updated_at        = now()
where plan = 'basic';
