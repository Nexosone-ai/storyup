-- 0104: 파트너 기본 상품(₩20,000, 부가세 별도) + 파트너 업세일용 대행 문의 분야
--
-- 1) 본사 기본상품 카탈로그(base_plan_catalog, 0097) — Basic 을 '파트너 기본 상품'으로 재정의.
--    공급가 ₩20,000(VAT 별도). 포함 내역은 src/lib/plans.ts basic 과 동일하게 맞춘다.
--    (관리자 화면 /dashboard/admin/base-plans 에서 이후 수정 가능)
update public.base_plan_catalog
set display_name      = 'STORYUP 기본 상품 (Basic)',
    supply_price_krw  = 20000,
    summary           = '소상공인 1사업장 마케팅 자동화 기본 상품 — 추가 이용은 담당 파트너 업세일',
    included_services = E'AI 랜딩페이지 1개 (레이아웃 모두 사용)\n블로그 생성 20건/월\nSNS 카드뉴스(6매) 5건/월\nAI 카드뉴스 영상(쇼츠) 5편/월\nAI 이미지 생성 월 100장\nSTORYUP 자체 도메인(storyup.me/내도메인)\nSTORYUP 워터마크 제거\n블로그 하단 쿠폰 발행 기능\n사용 분석 기반 AI 전략 수립\nSEO 최적화 기능\n성과 리포트 (월간)\n방문자 분석 (상세)\n추가 이용(블로그·카드뉴스·영상·이미지·Pro 전환)은 담당 파트너에게 문의',
    updated_at        = now()
where plan = 'basic';

-- 카탈로그 행이 아직 없는 환경(0097 시드 전)도 같은 값으로 들어가도록 보강.
insert into public.base_plan_catalog (plan, display_name, supply_price_krw, summary, included_services)
values (
  'basic',
  'STORYUP 기본 상품 (Basic)',
  20000,
  '소상공인 1사업장 마케팅 자동화 기본 상품 — 추가 이용은 담당 파트너 업세일',
  E'AI 랜딩페이지 1개 (레이아웃 모두 사용)\n블로그 생성 20건/월\nSNS 카드뉴스(6매) 5건/월\nAI 카드뉴스 영상(쇼츠) 5편/월\nAI 이미지 생성 월 100장\nSTORYUP 자체 도메인(storyup.me/내도메인)\nSTORYUP 워터마크 제거\n블로그 하단 쿠폰 발행 기능\n사용 분석 기반 AI 전략 수립\nSEO 최적화 기능\n성과 리포트 (월간)\n방문자 분석 (상세)\n추가 이용(블로그·카드뉴스·영상·이미지·Pro 전환)은 담당 파트너에게 문의'
)
on conflict (plan) do nothing;

-- 2) 대행 문의 분야(agency_services, 0071) — 고객이 기본 상품 한도를 넘겨 "추가로 원할 때"
--    담당 파트너에게 문의하는 메뉴. 파트너가 견적(createQuote)으로 판매가를 정해 업세일한다.
--    supply_price_krw = 0: 본사 원가는 파트너가 작업할 때 패킷(크레딧)으로 이미 차감되므로
--    정산 시 추가 공제하지 않는다(이중 과금 방지). 기존 BLOG_AGENCY/VIDEO_AGENCY 는 그대로.
insert into public.agency_services (key, label, description, supply_price_krw, active, sort_order) values
  ('EXTRA_BLOG',       '블로그 추가 작성',        '기본 상품 월 20건을 넘는 블로그 글 — 담당 파트너가 대신 작성·발행 (10건 단위 권장)', 0, true, 10),
  ('EXTRA_CARDNEWS',   '카드뉴스 추가 제작',      '기본 상품 월 5건을 넘는 SNS 카드뉴스(6매) 제작', 0, true, 11),
  ('SHORTS_NARRATION', 'AI 카드뉴스 영상 + 내레이션', '블로그 글을 30~40초 내레이션 요약 쇼츠로 제작(자막·배경음악 포함)', 0, true, 12),
  ('AI_VIDEO',         'AI 영상 제작',            'AI 동영상 1편(5초 480p 기본, 길이·화질 선택) 또는 원본 1개로 관련 영상 10편', 0, true, 13),
  ('EXTRA_IMAGES',     'AI 이미지 추가',          '기본 상품 월 100장을 넘는 AI 이미지(고화질 Gemini) 제작', 0, true, 14),
  ('PLAN_UPGRADE',     'Pro 상품으로 업그레이드',  '랜딩 6개·블로그 300건·카드뉴스 90건·예약발행·자체 도메인 등 Pro 상품 상담', 0, true, 15)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      active = excluded.active,
      sort_order = excluded.sort_order,
      updated_at = now();
