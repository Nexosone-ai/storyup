-- ============================================================
--  0028: 블로그 이벤트 연락문의 안내 문구 커스터마이즈
-- ============================================================
-- 연락문의 모듈의 제목·안내 문구를 사장님이 직접 수정할 수 있게 한다.
-- null이면 공개 페이지가 기본 문구("연락 문의" / "궁금한 점을 남겨주시면 …")를 사용한다.
alter table public.blog_events
  add column if not exists contact_title text,
  add column if not exists contact_desc  text;
