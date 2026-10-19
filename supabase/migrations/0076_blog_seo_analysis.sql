-- 0076: 블로그 글별 SEO 진단·보강 — AI 분석 결과 캐시.
-- 규칙 점검은 매번 계산(무과금)하고, 비용이 드는 AI 분석만 저장해 재호출을 줄인다.
-- 내용(content/제목 등)이 바뀌면 애플리케이션이 seo_analyzed_at를 비워 재분석을 유도한다.

alter table public.blog_posts
  add column if not exists seo_analysis jsonb,
  add column if not exists seo_analyzed_at timestamptz;

-- RLS는 blog_posts 기존 정책(소유자 전체 접근 + 공개글 공개읽기)을 그대로 사용한다.
-- 새 컬럼은 소유자만 의미가 있어 별도 정책이 필요 없다.
