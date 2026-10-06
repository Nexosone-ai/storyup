-- ============================================================
--  0050: 블로그 이벤트 예약(식당·매장 예약 요청) 모듈
-- ============================================================
-- 쿠폰(coupon_*)·연락문의와 동일한 "블로그 이벤트" 모듈 구조로 예약을 추가한다.
-- - 방문자는 STORYUP 로그인 상태가 아니므로 reservation_requests insert는
--   서버 액션(service role)에서 글이 공개 상태인지 검증한 뒤 수행한다.
-- - RLS는 글 주인(owns_business)의 읽기·상태변경(확정/취소)·삭제만 연다.
-- - 승인 방식: 손님이 '예약 요청'을 남기면 status=pending, 사장님이 대시보드에서
--   confirmed(확정)/cancelled(취소)로 처리한다.

-- ---------- blog_events: 예약 모듈 컬럼 추가 ----------
alter table public.blog_events
  add column if not exists reservation_enabled boolean not null default false,
  add column if not exists reservation_title   text,   -- 제목 문구 (예: "예약 문의")
  add column if not exists reservation_desc     text;   -- 안내 문구

-- ---------- reservation_requests: 예약 요청 ----------
create table if not exists public.reservation_requests (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.blog_events (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  phone        text not null,
  party_size   integer,              -- 인원수 (null=미입력)
  desired_date date,                 -- 희망 날짜 (null=미입력)
  desired_time text,                 -- 희망 시간 (HH:MM 또는 자유 입력)
  note         text,                 -- 요청사항 메모
  status       text not null default 'pending',  -- pending | confirmed | cancelled
  created_at   timestamptz not null default now(),
  constraint reservation_requests_party_positive
    check (party_size is null or party_size > 0),
  constraint reservation_requests_status_check
    check (status in ('pending', 'confirmed', 'cancelled'))
);
create index if not exists reservation_requests_event_idx
  on public.reservation_requests (event_id, created_at desc);
create index if not exists reservation_requests_business_idx
  on public.reservation_requests (business_id, created_at desc);

alter table public.reservation_requests enable row level security;

-- 예약 요청(insert)은 서버 액션(service role)만 → 공개 insert 정책 없음.
-- 글 주인은 자기 비즈니스의 예약을 읽고, 상태변경(update)하고, 삭제할 수 있다.
drop policy if exists reservation_requests_owner_read on public.reservation_requests;
create policy reservation_requests_owner_read on public.reservation_requests
  for select using (public.owns_business(business_id));

drop policy if exists reservation_requests_owner_update on public.reservation_requests;
create policy reservation_requests_owner_update on public.reservation_requests
  for update using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists reservation_requests_owner_delete on public.reservation_requests;
create policy reservation_requests_owner_delete on public.reservation_requests
  for delete using (public.owns_business(business_id));

-- ---------- 알림 타입에 reservation 추가 ----------
-- 방문자가 예약을 요청하면 글 주인에게 앱 내 알림을 남긴다.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'blog_comment'::text,
    'blog_like'::text,
    'site_inquiry'::text,
    'coupon_claim'::text,
    'sub_expiring'::text,
    'reservation'::text
  ]));
