-- 파트너 전용 '유사 영상 10개' — 원본 영상 URL + 컨셉으로 fal.ai 변형 영상을 한 번에 생성.
-- 배치(batch) 1개가 영상 N개(기본 10) 작업(job)으로 펼쳐지고, 각 작업은 fal 큐로 비동기 생성된다.
-- 과금은 아직 미연결(파트너 패킷 연동은 후속). 엔진은 기존 fal.ai(FAL_KEY) 재사용.

create table if not exists public.similar_video_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  source_url text not null,
  concept text not null default '',
  aspect text not null default '9:16',
  quality text not null default '720p',
  count int not null default 10,
  status text not null default 'processing' check (status in ('processing','done','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.similar_video_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.similar_video_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idx int not null default 0,
  prompt text not null,
  status text not null default 'processing' check (status in ('processing','done','failed')),
  request_id text,
  status_url text,
  response_url text,
  video_url text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists similar_video_batches_user_idx
  on public.similar_video_batches(user_id, created_at desc);
create index if not exists similar_video_jobs_batch_idx
  on public.similar_video_jobs(batch_id, idx);

alter table public.similar_video_batches enable row level security;
alter table public.similar_video_jobs enable row level security;

-- 소유자만 읽기. 쓰기(insert/update)는 서비스롤(서버 액션 admin 클라이언트)만 —
-- 사용자가 status_url·video_url 등을 변조하지 못하게 insert/update 정책을 두지 않는다.
drop policy if exists svb_select_own on public.similar_video_batches;
create policy svb_select_own on public.similar_video_batches
  for select using (auth.uid() = user_id);

drop policy if exists svj_select_own on public.similar_video_jobs;
create policy svj_select_own on public.similar_video_jobs
  for select using (auth.uid() = user_id);
