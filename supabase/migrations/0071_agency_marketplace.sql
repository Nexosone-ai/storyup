-- ============================================================
--  0071: 대행 마켓플레이스 — 공급가 + 클라↔파트너 문의/채팅 + 견적·결제코드 + 마진 정산
-- ============================================================
-- 서포터즈에서 들어온 클라이언트를 배정 파트너와 매칭·대화하고, 파트너가 공급가(관리자 설정)
-- 위에 마진을 붙여 커스텀 결제코드를 발행한다. 결제는 플랫폼(PortOne)이 수금, 공급가는 STORYUP,
-- 마진은 파트너 정산. 추가 전용(비파괴) — SQL 에디터 실행 가능. Requires 0001/0004/0022/0068/0070.

-- 1) 대행 서비스 + 공급가(관리자 설정 KRW)
create table if not exists public.agency_services (
  key          text primary key,  -- 'BLOG_AGENCY' | 'VIDEO_AGENCY'
  label        text not null,
  description  text,
  supply_price_krw integer not null default 0 check (supply_price_krw >= 0),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now()
);
alter table public.agency_services enable row level security;
drop policy if exists agency_services_read on public.agency_services;
create policy agency_services_read on public.agency_services
  for select to authenticated using (true);
drop policy if exists agency_services_admin on public.agency_services;
create policy agency_services_admin on public.agency_services
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.agency_services (key, label, description, supply_price_krw, sort_order) values
  ('BLOG_AGENCY',  '블로그 대행', '네이버/자사 블로그 운영대행 — 글 작성·발행·관리', 300000, 1),
  ('VIDEO_AGENCY', '영상제작 대행', '쇼츠/홍보 영상 기획·제작 대행', 500000, 2)
on conflict (key) do nothing;

-- 2) 대행 문의(서포터즈 → 파트너 매칭)
create table if not exists public.agency_inquiries (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  client_user_id uuid not null,
  partner_user_id uuid,                 -- 매칭된 파트너(없으면 관리자 배정 대기)
  service_key    text not null,
  message        text,
  status         text not null default 'open'
                   check (status in ('open','quoted','paid','in_progress','done','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists agency_inquiries_partner_idx on public.agency_inquiries (partner_user_id, created_at desc);
create index if not exists agency_inquiries_biz_idx on public.agency_inquiries (business_id, created_at desc);

alter table public.agency_inquiries enable row level security;
drop policy if exists agency_inquiries_access on public.agency_inquiries;
create policy agency_inquiries_access on public.agency_inquiries
  for all using (
    public.owns_business(business_id) or partner_user_id = auth.uid() or public.is_admin()
  ) with check (
    public.owns_business(business_id) or partner_user_id = auth.uid() or public.is_admin()
  );

-- 3) 클라↔파트너 채팅
create table if not exists public.agency_messages (
  id             uuid primary key default gen_random_uuid(),
  inquiry_id     uuid not null references public.agency_inquiries(id) on delete cascade,
  sender_user_id uuid not null,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists agency_messages_inquiry_idx on public.agency_messages (inquiry_id, created_at);

alter table public.agency_messages enable row level security;
drop policy if exists agency_messages_part on public.agency_messages;
create policy agency_messages_part on public.agency_messages
  for all using (
    exists (
      select 1 from public.agency_inquiries i
      where i.id = inquiry_id and (
        public.owns_business(i.business_id) or i.partner_user_id = auth.uid() or public.is_admin()
      )
    )
  ) with check (
    exists (
      select 1 from public.agency_inquiries i
      where i.id = inquiry_id and (
        public.owns_business(i.business_id) or i.partner_user_id = auth.uid() or public.is_admin()
      )
    )
  );

-- 4) 견적(공급가+마진 → 결제코드)
create table if not exists public.agency_quotes (
  id               uuid primary key default gen_random_uuid(),
  inquiry_id       uuid references public.agency_inquiries(id) on delete set null,
  partner_user_id  uuid not null,
  service_key      text not null,
  supply_price_krw integer not null,            -- 발행 시점 공급가 스냅샷
  client_price_krw integer not null check (client_price_krw > 0),
  margin_krw       integer not null default 0,
  code             text not null unique,         -- 결제코드(/pay/q/{code})
  status           text not null default 'sent'
                     check (status in ('draft','sent','paid','cancelled','expired')),
  order_id         text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);
create index if not exists agency_quotes_partner_idx on public.agency_quotes (partner_user_id, created_at desc);

alter table public.agency_quotes enable row level security;
drop policy if exists agency_quotes_access on public.agency_quotes;
create policy agency_quotes_access on public.agency_quotes
  for all using (partner_user_id = auth.uid() or public.is_admin())
  with check (partner_user_id = auth.uid() or public.is_admin());

-- 5) 파트너 마진 정산 원장
create table if not exists public.partner_earnings (
  id             uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null,
  quote_id       uuid references public.agency_quotes(id) on delete set null,
  amount_krw     integer not null,
  status         text not null default 'pending' check (status in ('pending','paid')),
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists partner_earnings_partner_idx on public.partner_earnings (partner_user_id, status, created_at desc);

alter table public.partner_earnings enable row level security;
drop policy if exists partner_earnings_self on public.partner_earnings;
create policy partner_earnings_self on public.partner_earnings
  for select using (partner_user_id = auth.uid() or public.is_admin());
drop policy if exists partner_earnings_admin on public.partner_earnings;
create policy partner_earnings_admin on public.partner_earnings
  for all using (public.is_admin()) with check (public.is_admin());

-- 6) 셀프서브 에이전트 영상 생성 크레딧 단가(0070 표에 추가)
insert into public.partner_credit_prices (action, label, credits) values
  ('VIDEO_SHORT', '영상 생성(짧은클립)', 20),
  ('VIDEO_LONG',  '영상 생성(긴클립)',  35)
on conflict (action) do nothing;
