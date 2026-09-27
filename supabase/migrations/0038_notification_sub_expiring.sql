-- notifications.type CHECK 제약에 구독 만기 알림 타입 추가.
-- (0037에서 코드/타입엔 sub_expiring을 넣었으나 DB CHECK 제약을 갱신하지 않아
--  인앱 만기 알림 insert가 거부되던 문제 수정.)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'blog_comment'::text,
    'blog_like'::text,
    'site_inquiry'::text,
    'coupon_claim'::text,
    'sub_expiring'::text
  ]));
