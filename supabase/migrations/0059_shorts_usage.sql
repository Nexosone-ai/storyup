-- ============================================================
--  0059: 쇼츠(Shorts) 생성 사용량 집계
-- ============================================================
-- 카드뉴스를 배경으로 한 쇼츠(9:16 유튜브/틱톡용) 생성 횟수를 기존 usage_events로
-- 집계한다(월 제한: BASIC 30 / Pro 90). kind 체크 제약에 'shorts'를 추가한다.

alter table public.usage_events
  drop constraint if exists usage_events_kind_check;

alter table public.usage_events
  add constraint usage_events_kind_check
  check (kind in ('site', 'blog_post', 'card_news', 'ai_image', 'shorts'));
