-- ============================================================
--  0062: 유튜브 연결(쇼츠 자동 업로드)
-- ============================================================
-- Pro 사용자가 구글 계정(YouTube)을 연결하면 쇼츠 영상을 자기 채널에 업로드할 수
-- 있다. 민감정보인 refresh_token은 서버(서비스롤)에서만 접근한다 — 영상 업로드는
-- 서버가 발급한 단기 access_token으로 브라우저가 유튜브에 직접 올린다(패킷 최소).

create table if not exists public.youtube_connections (
  user_id       uuid primary key,
  refresh_token text not null,
  channel_id    text,
  channel_title text,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 토큰은 서버 전용 — RLS 켜고 정책 없음(서비스롤만 접근, 클라이언트 접근 거부).
alter table public.youtube_connections enable row level security;
