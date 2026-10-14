-- ============================================================
--  0058: 카드뉴스 공개 공유 이력
-- ============================================================
-- 공개 공유 페이지(/cards/{id})에서 누구나 '공유하기'를 누르면 공유 1회가
-- 기록되고, 페이지 아래에 공유 이력 리스트로 표시된다. (감사 표시 지표는 폐지)
-- 기록은 서버(서비스롤)에서 아래 함수로만 수행한다 — 익명 직접 접근 불가.

alter table public.marketing_contents
  add column if not exists share_count integer not null default 0;

create table if not exists public.card_shares (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.marketing_contents(id) on delete cascade,
  channel     text not null default 'link',
  visitor_key text,
  created_at  timestamptz not null default now()
);

create index if not exists card_shares_card_created_idx
  on public.card_shares (card_id, created_at desc);

-- 읽기·쓰기는 서버(서비스롤)에서만. 정책을 두지 않아 익명/일반 사용자 직접 접근은 거부된다.
alter table public.card_shares enable row level security;

-- 카드뉴스 1건 공유 기록 + 카운트 증가(원자적). 존재하지 않는 카드면 null 반환(무기록).
create or replace function public.bump_card_share(p_id uuid, p_channel text, p_visitor text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  insert into public.card_shares (card_id, channel, visitor_key)
    select p_id,
           coalesce(nullif(left(p_channel, 24), ''), 'link'),
           nullif(left(p_visitor, 64), '')
    where exists (
      select 1 from public.marketing_contents
      where id = p_id and platform = 'instagram_cards'
    );
  if not found then
    return null;
  end if;
  update public.marketing_contents
    set share_count = share_count + 1
    where id = p_id and platform = 'instagram_cards'
    returning share_count into v_count;
  return v_count;
end;
$$;

revoke all on function public.bump_card_share(uuid, text, text) from anon, authenticated;
grant execute on function public.bump_card_share(uuid, text, text) to service_role;
