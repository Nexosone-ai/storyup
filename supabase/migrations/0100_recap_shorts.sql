-- ============================================================
--  0100: 파트너 '블로그 글감 → 요약 쇼츠'(Recap Shorts) 잡 + 패킷 단가
-- ============================================================
-- 고객 사업장의 발행 블로그 글 1개를 30~40초 내레이션 쇼츠로 만든다:
-- Claude 대본(장면별 내레이션·자막·이미지 프롬프트) → Gemini TTS(장면별 WAV, site-audio)
-- → 이미지(카드뉴스 배경 재사용 또는 AI 생성, site-images) → 브라우저 렌더(자막 번인·BGM 덕킹).
-- 파트너 전용. 추가 전용(비파괴). Requires 0001(set_updated_at), 0004(is_admin), 0070(partner_credit_prices).
-- 운영 반영은 별도 승인 후 SQL 에디터에서 실행.

create table if not exists public.recap_shorts_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,   -- 파트너
  business_id     uuid references public.businesses(id) on delete set null,   -- 고객 사업장
  blog_post_id    uuid,                                                        -- blog_posts.id (스냅샷)
  title           text not null default '',
  status          text not null default 'script'
                    check (status in ('script','audio','images','ready','failed')),
  voice           text not null default 'Charon',                              -- Gemini 프리셋 보이스
  image_source    text not null default 'cardnews'
                    check (image_source in ('cardnews','ai')),
  font            text not null default 'nanum-gothic',                        -- 자막 폰트(CARD_FONTS id)
  bgm             text not null default 'bright',                              -- mood id | library:<id> | none
  scenes          jsonb not null default '[]'::jsonb,
  -- scenes[] = { idx, narration, caption, imagePrompt, imageUrl?, audioUrl?, durationMs?, error? }
  credits_charged integer not null default 0,
  error           text,
  video_url       text,                                                        -- (선택) 렌더 결과 기록
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists recap_shorts_jobs_user_idx
  on public.recap_shorts_jobs (user_id, created_at desc);

drop trigger if exists recap_shorts_jobs_set_updated_at on public.recap_shorts_jobs;
create trigger recap_shorts_jobs_set_updated_at before update on public.recap_shorts_jobs
  for each row execute function public.set_updated_at();

alter table public.recap_shorts_jobs enable row level security;
-- 본인(파트너) + 관리자 조회. 쓰기는 서비스롤(앱 액션이 가드).
drop policy if exists recap_shorts_jobs_read on public.recap_shorts_jobs;
create policy recap_shorts_jobs_read on public.recap_shorts_jobs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists recap_shorts_jobs_admin on public.recap_shorts_jobs;
create policy recap_shorts_jobs_admin on public.recap_shorts_jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- 패킷(크레딧) 단가 — 1편당(대본+내레이션). AI 이미지는 기존 EXTRA_IMAGE(장당)로 별도 차감.
-- 단가 행이 없으면 chargePartnerCredits가 fail-closed로 생성을 차단하므로 반드시 시드.
insert into public.partner_credit_prices (action, label, credits) values
  ('RECAP_SHORTS', '블로그 요약 쇼츠 1편(대본+내레이션)', 30)
on conflict (action) do nothing;
