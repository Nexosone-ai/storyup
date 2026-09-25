-- XP/레벨 시스템 폐지. XP는 게이미피케이션 레벨 표시 외에 쓰이지 않아 제거한다.
-- UP(포인트)만 남긴다. 무중단을 위해 grant_reward의 시그니처(6개 인자)는 그대로 두고
-- p_xp 인자만 무시하도록 본문을 교체한 뒤, XP 저장소(user_xp 테이블·reward_events.xp)를 제거한다.
-- (배포 전 구버전 코드가 p_xp를 넘겨도 그대로 동작한다.)

-- 1) grant_reward 재정의 — p_xp는 받되 무시(하위호환). user_xp/xp 기록 제거.
create or replace function public.grant_reward(
  p_user uuid,
  p_key text,
  p_rule text,
  p_up int,
  p_xp int,   -- 폐지됨. 하위호환용으로 시그니처만 유지, 본문에서 사용하지 않음.
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.reward_events (user_id, reward_key, rule, up)
  values (p_user, p_key, p_rule, greatest(p_up, 0))
  on conflict (user_id, reward_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return false; -- 이미 지급됨
  end if;

  if p_up > 0 then
    insert into public.point_transactions (user_id, amount, reason, type, ref_type, ref_id)
    values (p_user, p_up, p_reason, 'REWARD', 'reward_event', v_event_id);
  end if;

  return true;
end;
$$;

-- 2) XP 저장소 제거.
drop table if exists public.user_xp;
alter table public.reward_events drop column if exists xp;

-- 3) 레벨 설정 오버라이드가 있었다면 정리(더 이상 사용 안 함).
delete from public.reward_settings where key = 'levels';
