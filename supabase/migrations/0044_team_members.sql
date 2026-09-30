-- 0044: 관리자/직원 다중 계정 (Pro 3명 · Basic/Free 1명 · Partner 협의).
-- 계정 소유자(결제 주체)가 직원을 이메일로 초대하면, 직원은 소유자의 '사업장 데이터'만
-- 관리할 수 있다(브랜드·사이트·블로그·SNS·문의·쿠폰·분석). 소유자 개인 영역(구독·포인트·
-- 팀관리·설정)은 접근 불가.

create table if not exists public.team_members (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references auth.users (id) on delete cascade,
  -- 수락 전에는 null. 수락 시 초대받은 사용자의 uid가 채워진다.
  member_user_id uuid references auth.users (id) on delete cascade,
  invited_email  text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'active')),
  created_at     timestamptz not null default now(),
  unique (owner_user_id, invited_email)
);

create index if not exists team_members_member_idx
  on public.team_members (member_user_id) where member_user_id is not null;
create index if not exists team_members_email_idx
  on public.team_members (lower(invited_email));

-- 현재 사용자가 어떤 소유자의 '활성 직원'이면 그 owner_user_id, 아니면 자기 자신.
-- 앱이 사업장 목록·플랜을 이 id 기준으로 조회한다(직원은 소유자 계정으로 동작).
create or replace function public.account_owner_id(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select tm.owner_user_id from public.team_members tm
      where tm.member_user_id = p_user and tm.status = 'active'
      order by tm.created_at asc limit 1),
    p_user
  );
$$;
grant execute on function public.account_owner_id(uuid) to anon, authenticated;

-- owns_business 확장: 사업장 소유자이거나, 그 소유자의 활성 직원이면 true.
-- (사업장 데이터 테이블 전체가 이 함수를 RLS로 쓰므로 여기 한 곳만 바꾸면 전파된다.)
create or replace function public.owns_business(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = bid
      and (
        b.user_id = auth.uid()
        or exists (
          select 1 from public.team_members tm
          where tm.owner_user_id = b.user_id
            and tm.member_user_id = auth.uid()
            and tm.status = 'active'
        )
      )
  );
$$;

-- businesses 테이블: 직원이 소유자의 사업장을 조회·수정할 수 있게(생성·삭제는 소유자만).
drop policy if exists businesses_member_select on public.businesses;
create policy businesses_member_select on public.businesses
  for select using (public.owns_business(id));

drop policy if exists businesses_member_update on public.businesses;
create policy businesses_member_update on public.businesses
  for update using (public.owns_business(id))
  with check (public.owns_business(id));

-- team_members RLS
alter table public.team_members enable row level security;

-- 소유자: 자기 팀 전체 관리
drop policy if exists team_members_owner_all on public.team_members;
create policy team_members_owner_all on public.team_members
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- 직원/피초대자: 내 이메일로 온 초대 + 내 멤버십 행 조회(수락은 서버 액션이 처리)
drop policy if exists team_members_member_select on public.team_members;
create policy team_members_member_select on public.team_members
  for select using (
    member_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
