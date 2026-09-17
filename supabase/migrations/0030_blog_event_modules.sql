-- ============================================================
--  0030: 블로그 하단 선택 모듈 확장 (댓글 / 주소·정보 / 지도)
-- ============================================================
-- 기존 blog_events(쿠폰 + 연락문의)에 글 주인이 켤 수 있는 모듈 3개를 추가한다.
-- - comment_enabled: 방문자 댓글 폼. 기존에는 항상 노출됐으므로 default true로
--   두어 기존 글의 동작을 유지한다(끄면 숨김).
-- - address_enabled / map_enabled: 매장 주소·정보 블록과 구글지도 임베드.
--   랜딩페이지 content.contact(주소 등)를 재사용하므로 별도 저장 컬럼은 없다.

alter table public.blog_events
  add column if not exists comment_enabled boolean not null default true,
  add column if not exists address_enabled boolean not null default false,
  add column if not exists map_enabled     boolean not null default false;
