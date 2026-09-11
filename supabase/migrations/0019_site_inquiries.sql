-- ============================================================
--  0019: 랜딩페이지 문의하기 (방문자 → 사장님 대시보드)
-- ============================================================

-- 공개 랜딩페이지 하단 "문의하기" 폼으로 방문자가 남긴 문의.
-- 방문자는 STORYUP 로그인 상태가 아니므로 쓰기는 서버 액션(service role)에서만
-- 검증 후 수행하고, RLS는 사이트 주인의 읽기·관리(update/delete)만 연다.
create table if not exists public.site_inquiries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  contact     text not null,
  message     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists site_inquiries_business_idx
  on public.site_inquiries (business_id, created_at desc);

alter table public.site_inquiries enable row level security;

-- 사이트 주인만 자기 비즈니스의 문의를 읽고, 읽음 처리(update)하고, 삭제할 수 있다.
drop policy if exists site_inquiries_owner_read on public.site_inquiries;
create policy site_inquiries_owner_read on public.site_inquiries
  for select using (public.owns_business(business_id));

drop policy if exists site_inquiries_owner_update on public.site_inquiries;
create policy site_inquiries_owner_update on public.site_inquiries
  for update using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists site_inquiries_owner_delete on public.site_inquiries;
create policy site_inquiries_owner_delete on public.site_inquiries
  for delete using (public.owns_business(business_id));

-- ---------- 알림 타입에 문의 추가 ----------
-- 방문자 문의가 접수되면 사장님에게 앱 내 알림을 남긴다 (blog_comment/blog_like와 동일 경로).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('blog_comment', 'blog_like', 'site_inquiry'));
