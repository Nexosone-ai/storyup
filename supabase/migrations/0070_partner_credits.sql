-- ============================================================
--  0070: 파트너 패킷(크레딧) — UP 포인트와 분리된 에이전트 전용 재화
-- ============================================================
-- 관리자가 계약 시 크레딧을 지급하고, 파트너가 AI 에이전트 작업을 실행하면
-- 작업별 단가만큼 차감한다(UP 포인트 사용 안 함). 원장(ledger) 합계 = 잔액.
-- 추가 전용(비파괴) — Supabase SQL 에디터 실행 가능. Requires 0004(is_admin).

create table if not exists public.partner_credit_ledger (
  id              uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  amount          integer not null,            -- +지급 / -차감
  reason          text,
  ref_type        text,                        -- 'grant' | 'agent' | 'refund' ...
  ref_business_id uuid,
  created_by      uuid,
  created_at      timestamptz not null default now()
);
create index if not exists partner_credit_ledger_partner_idx
  on public.partner_credit_ledger (partner_user_id, created_at desc);

alter table public.partner_credit_ledger enable row level security;
drop policy if exists partner_credit_ledger_self on public.partner_credit_ledger;
create policy partner_credit_ledger_self on public.partner_credit_ledger
  for select using (partner_user_id = auth.uid() or public.is_admin());
drop policy if exists partner_credit_ledger_admin on public.partner_credit_ledger;
create policy partner_credit_ledger_admin on public.partner_credit_ledger
  for all using (public.is_admin()) with check (public.is_admin());

-- 작업별 크레딧 단가(관리자 편집). 0 = 무료.
create table if not exists public.partner_credit_prices (
  action     text primary key,
  label      text not null,
  credits    integer not null default 0 check (credits >= 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.partner_credit_prices enable row level security;
drop policy if exists pcp_select on public.partner_credit_prices;
create policy pcp_select on public.partner_credit_prices
  for select to authenticated using (true);
drop policy if exists pcp_admin on public.partner_credit_prices;
create policy pcp_admin on public.partner_credit_prices
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.partner_credit_prices (action, label, credits) values
  ('BLOG_BASIC',         '블로그 기본작업(글+이미지1+SNS문구)', 10),
  ('CARDNEWS_RECOMPOSE', '카드뉴스 문구 재구성',               3),
  ('CARDNEWS_FULL',      '카드뉴스 문구+새 이미지(최대6장)',    40),
  ('EXTRA_IMAGE',        '추가 AI 이미지(장당)',               5),
  ('AGENT_CHAT',         '에이전트 대화',                      0)
on conflict (action) do nothing;

-- 안전한 크레딧 차감(동시 요청 이중지출 방지). 잔액 부족 시 INSUFFICIENT_CREDITS.
create or replace function public.spend_partner_credits(
  p_partner      uuid,
  p_amount       integer,
  p_reason       text,
  p_ref_business uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_partner::text));
  select coalesce(sum(amount), 0) into v_balance
    from public.partner_credit_ledger where partner_user_id = p_partner;
  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;
  insert into public.partner_credit_ledger
    (partner_user_id, amount, reason, ref_type, ref_business_id)
  values (p_partner, -p_amount, p_reason, 'agent', p_ref_business);
  return v_balance - p_amount;
end;
$$;

revoke all on function public.spend_partner_credits(uuid, integer, text, uuid) from public;
grant execute on function public.spend_partner_credits(uuid, integer, text, uuid)
  to service_role;
