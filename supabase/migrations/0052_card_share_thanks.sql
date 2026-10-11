-- ============================================================
--  0052: 카드뉴스 공개 공유 + 감사 표시/조회 집계
-- ============================================================
-- 카드뉴스(marketing_contents, platform='instagram_cards')를 공개 페이지(/cards/{id})로
-- 공유하고, 받은 사람이 '감사 표시'(비화폐)를 누르거나 조회가 자동 집계되게 한다.
-- 증분은 서버(서비스롤)에서 아래 함수로 원자적으로 수행한다(동시성 안전).

alter table public.marketing_contents
  add column if not exists thanks_count integer not null default 0,
  add column if not exists view_count  integer not null default 0;

create or replace function public.bump_card_thanks(p_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.marketing_contents
    set thanks_count = thanks_count + 1
    where id = p_id and platform = 'instagram_cards'
  returning thanks_count;
$$;

create or replace function public.bump_card_view(p_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.marketing_contents
    set view_count = view_count + 1
    where id = p_id and platform = 'instagram_cards'
  returning view_count;
$$;

-- 증분은 서버 라우트(서비스롤)에서만 호출한다 — 익명 직접 호출 권한은 주지 않는다.
revoke all on function public.bump_card_thanks(uuid) from anon, authenticated;
revoke all on function public.bump_card_view(uuid)  from anon, authenticated;
grant execute on function public.bump_card_thanks(uuid) to service_role;
grant execute on function public.bump_card_view(uuid)  to service_role;
