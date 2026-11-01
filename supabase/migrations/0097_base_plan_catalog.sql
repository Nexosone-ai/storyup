-- 본사 기본상품(공급가) 카탈로그 — 파트너가 상품을 만들 때 참조하는 "본사가 제공하는 기준 요금제"의
-- 공개용 상품 정보(상품명·공급가·상세 포함내역)를 관리자가 직접 수정/업데이트할 수 있게 DB로 뺀다.
--
-- 기존에는 plans.ts 상수(Basic 59,000 / Pro 119,000)만 참조했는데, 이 테이블의 행이 있으면
-- 그 값을 '본사 공급가'로 사용한다(없으면 코드가 plans.ts 로 폴백). 파트너 상품의 base_price_krw
-- (정산 시 본사 공제액)는 저장 시점에 이 공급가를 스냅샷한다.
--
-- 쓰기는 서비스롤(관리자 서버 액션)만. 읽기는 로그인 사용자 전체(파트너가 상품 폼에서 참조).

create table if not exists public.base_plan_catalog (
  plan text primary key check (plan in ('basic', 'pro')),
  display_name text not null,
  -- 본사 공급가(원) — 파트너에게 공급하는 기준 가격. 정산 시 공제 기준.
  supply_price_krw integer not null check (supply_price_krw >= 0),
  -- 한 줄 요약(선택).
  summary text,
  -- 상세 포함 내역 — 줄바꿈으로 구분된 불릿. 고객/파트너에게 노출.
  included_services text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.base_plan_catalog enable row level security;

-- 로그인 사용자는 읽기 가능(파트너 상품 폼·공개 노출용). 쓰기는 서비스롤만(정책 없음 = RLS가 차단).
drop policy if exists base_plan_catalog_select on public.base_plan_catalog;
create policy base_plan_catalog_select
  on public.base_plan_catalog
  for select
  to authenticated
  using (true);

-- 현재 plans.ts 기준값으로 시드(이미 있으면 유지).
insert into public.base_plan_catalog (plan, display_name, supply_price_krw, summary, included_services)
values
  (
    'basic',
    'STORYUP Basic',
    59000,
    '소상공인·1인 사업자를 위한 기본 마케팅 자동화',
    E'AI 랜딩페이지 3개 (레이아웃 3종)\n블로그 생성 100건/월\nSNS 카드뉴스(6매) 30건/월\n쇼츠 생성 30건/월\nAI 영상 생성 월 8편\nAI 이미지 생성 포함\nSTORYUP 자체 도메인(storyup.me/내도메인)\nSTORYUP 워터마크 제거\n블로그 하단 쿠폰 발행 기능\n사용 분석 기반 AI 전략 수립\nSEO 최적화 기능\n성과 리포트 (월간)\n방문자 분석 (상세)'
  ),
  (
    'pro',
    'STORYUP Pro',
    119000,
    '성장하는 브랜드를 위한 전문 마케팅 패키지',
    E'AI 랜딩페이지 6개 (레이아웃 9종)\n블로그 생성 300건/월\nSNS 카드뉴스(6매) 90건/월\n쇼츠 생성 90건/월\nAI 영상 생성 월 10편\nAI 이미지 생성 포함\n자체 도메인 연결 지원(도메인 구매 별도)\nSTORYUP 워터마크 제거\n블로그 하단 쿠폰 발행 기능\n사용 분석 기반 AI 전략 수립\nSEO 최적화 기능\nAEO/GEO 답변엔진 최적화(FAQ)\n콘텐츠 예약 발행\n블로그 하단 예약(식당·매장) 기능\nAI 상세 홈페이지 생성 (자료 입력 → 풍부한 섹션)\n성과 리포트 (주간·월간)\n방문자 분석 (고급)\n관리자/직원 3계정\n여러 브랜드/사업장 6개 관리'
  )
on conflict (plan) do nothing;
