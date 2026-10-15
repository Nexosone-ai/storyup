-- ============================================================
--  0060: 무료 플랜 월 이용권(재신청·관리자 승인)
-- ============================================================
-- 무료 플랜은 블로그를 '하루 1개 / 한 달 30개' 쓸 수 있고, 한 달이 지나면
-- 재신청(클릭) → 관리자 승인 후 다시 1개월 이용할 수 있다. 각 이용 기간을
-- free_grants 1행으로 관리한다. 첫 기간은 첫 글 작성 시 자동 발급(승인 불필요),
-- 이후 갱신은 status='pending' 재신청 → 관리자 승인으로 'active' 전환.

create table if not exists public.free_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'active'
                 check (status in ('active', 'pending', 'rejected')),
  period_start timestamptz,
  period_end   timestamptz,
  requested_at timestamptz,
  approved_at  timestamptz,
  approved_by  uuid,
  created_at   timestamptz not null default now()
);

create index if not exists free_grants_user_idx
  on public.free_grants (user_id, created_at desc);
create index if not exists free_grants_status_idx
  on public.free_grants (status, created_at desc);

alter table public.free_grants enable row level security;

-- 본인은 자기 이용권을 볼 수 있다(관리자는 is_admin으로 전체). 쓰기는 서버(서비스롤)에서만.
drop policy if exists fg_select on public.free_grants;
create policy fg_select on public.free_grants
  for select using (user_id = auth.uid() or public.is_admin());
