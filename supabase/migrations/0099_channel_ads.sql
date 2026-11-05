-- ============================================================
--  0099: 채널 공유 광고 마켓플레이스 — 채널 등록 + 공유 의뢰 주문 + 정산
-- ============================================================
-- 채널 보유자가 자신의 SNS 채널(유튜브/페북/인스타/틱톡/카카오/밴드 등)을 등록하고
-- 공유 단가를 정한다(관리자 승인 후 공개). 광고주(스토리업 사용자)가 자기 블로그/카드뉴스를
-- 특정 채널에 공유 의뢰·결제 → 채널 보유자가 직접 게시+증빙 → 광고주 확인(또는 N일 후
-- 자동확정) → 정산(20% 수수료 공제, 80% 채널 보유자 지급, 실제 송금은 수동).
--
-- 추가 전용(비파괴). 기존 CPC 광고(ad_* 0055~0057)와 별개 병렬 모델.
-- Requires 0001(set_updated_at), 0004(is_admin). 운영 반영은 별도 승인 후 SQL 에디터에서 실행.

-- ---------------- 1) 채널 등록(채널 보유자가 올리는 공유 상품) ----------------
create table if not exists public.share_channels (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  platform       text not null
                   check (platform in ('youtube','facebook','instagram','tiktok','kakao','band','other')),
  handle         text,                                 -- @핸들/채널명
  url            text,                                 -- 채널 공개 URL
  follower_count integer not null default 0 check (follower_count >= 0),
  price_krw      integer not null check (price_krw >= 0),  -- 1회 공유 단가
  description    text,                                 -- 공유 범위·조건 설명
  status         text not null default 'pending'
                   check (status in ('pending','active','rejected','hidden')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists share_channels_user_idx on public.share_channels (user_id);
create index if not exists share_channels_status_idx on public.share_channels (status, platform);

drop trigger if exists share_channels_set_updated_at on public.share_channels;
create trigger share_channels_set_updated_at before update on public.share_channels
  for each row execute function public.set_updated_at();

alter table public.share_channels enable row level security;
-- 공개(active)만 누구나 조회 + 본인 전체 + 관리자 전체. 쓰기는 본인(승인 status는 앱이 관리).
drop policy if exists share_channels_read on public.share_channels;
create policy share_channels_read on public.share_channels
  for select to authenticated
  using (status = 'active' or user_id = auth.uid() or public.is_admin());
drop policy if exists share_channels_insert on public.share_channels;
create policy share_channels_insert on public.share_channels
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists share_channels_update on public.share_channels;
create policy share_channels_update on public.share_channels
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists share_channels_delete on public.share_channels;
create policy share_channels_delete on public.share_channels
  for delete to authenticated using (user_id = auth.uid());

-- ---------------- 2) 공유 의뢰 주문(광고주 → 채널) ----------------
-- 모든 금액·채널 정보를 스냅샷해 이후 채널 단가 변경과 무관하게 한다.
create table if not exists public.share_orders (
  id                     uuid primary key default gen_random_uuid(),
  advertiser_user_id     uuid not null references auth.users(id) on delete cascade,
  channel_id             uuid references public.share_channels(id) on delete set null,
  channel_owner_user_id  uuid not null references auth.users(id) on delete cascade, -- 스냅샷
  platform               text not null,                 -- 스냅샷
  price_krw              integer not null check (price_krw >= 0),  -- 스냅샷(=gross)
  content_type           text not null check (content_type in ('blog','card_news')),
  content_ref_id         uuid,                          -- blog_posts.id / marketing_contents.id
  content_url            text not null,                 -- 공유할 공개 URL
  content_title          text,
  message                text,                          -- 광고주 요청사항
  status                 text not null default 'pending_payment'
                           check (status in ('pending_payment','paid','shared','confirmed',
                                             'settled','cancelled','refunded','disputed')),
  order_id               text,                          -- product_orders.order_id
  proof_url              text,                          -- 채널 보유자 게시 증빙
  shared_at              timestamptz,
  confirmed_at           timestamptz,
  auto_confirm_at        timestamptz,                   -- 증빙 후 자동확정 기한
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists share_orders_owner_idx on public.share_orders (channel_owner_user_id, status);
create index if not exists share_orders_advertiser_idx on public.share_orders (advertiser_user_id, created_at desc);
create index if not exists share_orders_autoconfirm_idx on public.share_orders (status, auto_confirm_at);

drop trigger if exists share_orders_set_updated_at on public.share_orders;
create trigger share_orders_set_updated_at before update on public.share_orders
  for each row execute function public.set_updated_at();

alter table public.share_orders enable row level security;
-- 광고주 본인 + 채널 보유자 + 관리자 조회. 쓰기는 서비스롤(앱 액션이 상태전이 가드).
drop policy if exists share_orders_read on public.share_orders;
create policy share_orders_read on public.share_orders
  for select to authenticated
  using (
    advertiser_user_id = auth.uid()
    or channel_owner_user_id = auth.uid()
    or public.is_admin()
  );
drop policy if exists share_orders_admin on public.share_orders;
create policy share_orders_admin on public.share_orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- 3) 정산 원장(채널 보유자 지급) ----------------
-- 결제 시 held(에스크로) 적립, 확정 시 pending(지급 대기), 관리자 지급 시 paid.
-- 수수료액 = gross − net(파생). share_order_id 유니크 = 결제 이행 멱등 잠금.
create table if not exists public.share_earnings (
  id                    uuid primary key default gen_random_uuid(),
  channel_owner_user_id uuid not null references auth.users(id) on delete cascade,
  share_order_id        uuid not null unique references public.share_orders(id) on delete cascade,
  gross_krw             integer not null,
  fee_krw               integer not null default 0,
  net_krw               integer not null,
  status                text not null default 'held'
                          check (status in ('held','pending','paid')),
  paid_at               timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists share_earnings_owner_idx on public.share_earnings (channel_owner_user_id, status);

alter table public.share_earnings enable row level security;
-- 채널 보유자 본인 + 관리자 조회. 쓰기는 서비스롤(결제 이행·관리자 지급).
drop policy if exists share_earnings_read on public.share_earnings;
create policy share_earnings_read on public.share_earnings
  for select to authenticated
  using (channel_owner_user_id = auth.uid() or public.is_admin());
drop policy if exists share_earnings_admin on public.share_earnings;
create policy share_earnings_admin on public.share_earnings
  for all using (public.is_admin()) with check (public.is_admin());
