-- ============================================================
--  0114: 내 영상(쇼츠·AI 영상) 공개 사이트 게시 — agency_deliverables.is_public
-- ============================================================
-- 카드뉴스로 만든 쇼츠(kind='shorts')와 AI 영상·편집본(kind='video')을 사용자의 공개
-- 사이트(/site/<slug>/videos, 랜딩 '영상' 블록)에서 볼 수 있게 한다(2026-11-13 요청).
-- 저장되는 영상은 기본 공개(true). 소유자가 콘텐츠 스튜디오 '내 영상'에서 숨기거나 삭제한다.
-- 공개 페이지는 service role 로 읽으므로 RLS 변경 없음. 추가 전용(비파괴).

alter table public.agency_deliverables
  add column if not exists is_public boolean not null default true;

create index if not exists agency_deliverables_public_idx
  on public.agency_deliverables (business_id, is_public, created_at desc);
