-- ============================================================
--  0113: 블로그 글 광고 게재 검수(ad_review) — 공개 발행과 광고 게재 가능을 분리
-- ============================================================
-- Google AdSense "가치가 별로 없는 콘텐츠" 반려(2026-11-11) 대응.
-- 이용자가 만든 글은 발행과 동시에 공개되지만, 회사(STORYUP) 광고는 관리자가 검수해
-- 'approved' 로 표시한 글(과 승인 글이 1개 이상인 사이트의 홈·블로그 목록)에만 나온다.
-- Google 권고: 검토되지 않은 사용자 콘텐츠에는 광고를 비활성화(support.google.com/adsense/answer/3011869).
-- 추가 전용(비파괴). 기존 글은 전부 'pending'(광고 없음) 으로 시작한다.

alter table public.blog_posts
  add column if not exists ad_review_status text not null default 'pending'
    check (ad_review_status in ('pending', 'approved', 'rejected')),
  add column if not exists ad_reviewed_at timestamptz,
  add column if not exists ad_reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists ad_review_note text;

create index if not exists blog_posts_ad_review_idx
  on public.blog_posts (ad_review_status, status, published_at desc);

comment on column public.blog_posts.ad_review_status is
  '광고 게재 검수 상태 — pending(미검수, 광고 없음) | approved(검수 통과, 회사 광고 허용) | rejected(반려)';
