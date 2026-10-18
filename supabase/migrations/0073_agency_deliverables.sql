-- ============================================================
--  0073: 대행 산출물 — 작업자(파트너)가 만든 영상 등 결과물 전달
-- ============================================================
-- 파트너가 만든 영상을 고객 사업장에 전달하면, 고객이 영상 섹션에서 다운로드하거나
-- 자신의 페이지(랜딩·홈·블로그·SNS카드)에 사용할 수 있다.
-- RLS: owns_business(소유자/직원/배정 파트너) + is_admin. 추가 전용(비파괴).
-- Requires 0001(owns_business), 0068(partner_clients 확장), 0071(agency_inquiries).

create table if not exists public.agency_deliverables (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inquiry_id  uuid references public.agency_inquiries(id) on delete set null,
  kind        text not null default 'video',
  title       text,
  url         text not null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists agency_deliverables_biz_idx
  on public.agency_deliverables (business_id, created_at desc);

alter table public.agency_deliverables enable row level security;
drop policy if exists agency_deliverables_access on public.agency_deliverables;
create policy agency_deliverables_access on public.agency_deliverables
  for all using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());
