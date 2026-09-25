-- 신규 가입 시 profiles 행을 자동 생성하는 트리거 복구.
-- 0001_init.sql 에서 정의했던 on_auth_user_created 트리거가 어느 시점(DB 재생성/이전)에
-- 유실되어, 2026-09-13 이후 가입자에게 profiles 행이 만들어지지 않았다.
-- 그 결과 관리자 화면에서 이메일로 조회 시 "없는 회원"으로 나오는 문제가 있었다.

-- 1) 트리거 함수 재정의(멱등) — 0001 과 동일 로직.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 2) 트리거 재생성.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) 트리거 유실 기간 동안 profiles 가 없는 기존 가입자 백필.
insert into public.profiles (user_id, name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  u.email
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;
