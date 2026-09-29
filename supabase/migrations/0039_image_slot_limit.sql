-- 동일 이미지 슬롯의 AI 재생성 남용 방지.
-- 이미지는 딜리버리(랜딩·블로그·카드뉴스)에 포함되어 무과금이므로, 비용/남용은
-- "같은 슬롯을 몇 번까지 재생성할 수 있는가"로만 제한한다. (슬롯별 누적 카운터)

create table if not exists public.image_slot_generations (
  business_id uuid not null references public.businesses(id) on delete cascade,
  slot_key text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (business_id, slot_key)
);

-- 카운터는 서버(RPC, security definer)만 조작. 사용자 직접 접근 불가(정책 없음 = 차단).
alter table public.image_slot_generations enable row level security;

-- 슬롯 예약: 한도 미만이면 원자적으로 +1 하고 true, 한도 도달이면 false(증가 안 함).
create or replace function public.try_reserve_image_slot(
  p_business uuid,
  p_slot text,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.image_slot_generations as t (business_id, slot_key, count)
    values (p_business, p_slot, 1)
  on conflict (business_id, slot_key) do update
    set count = t.count + 1, updated_at = now()
    where t.count < p_limit
  returning count into v_count;
  return v_count is not null;
end;
$$;

-- 생성 실패 시 예약 반환(0 미만으로는 내리지 않음).
create or replace function public.release_image_slot(
  p_business uuid,
  p_slot text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.image_slot_generations
    set count = greatest(count - 1, 0), updated_at = now()
    where business_id = p_business and slot_key = p_slot;
end;
$$;

grant execute on function public.try_reserve_image_slot(uuid, text, integer) to authenticated;
grant execute on function public.release_image_slot(uuid, text) to authenticated;
