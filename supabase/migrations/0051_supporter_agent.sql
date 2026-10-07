-- ============================================================
--  0051: 서포터즈에 'agent'(스토리업 대행업무) 역할 + 월 기본가격
-- ============================================================
-- 기존 서포터(디자이너·편집자·뮤지션) 프리랜서 마켓에, 스토리업/네이버 블로그
-- 운영을 전담 대행하는 'agent' 역할을 추가한다. 에이전트는 월 기본가격을 표기한다.

-- 역할 체크에 'agent' 추가
alter table public.supporter_profiles drop constraint if exists supporter_profiles_role_check;
alter table public.supporter_profiles add constraint supporter_profiles_role_check
  check (role = any (array[
    'designer'::text,
    'editor'::text,
    'musician'::text,
    'agent'::text
  ]));

-- 월 기본가격(원). null = 미표기.
alter table public.supporter_profiles
  add column if not exists base_price_krw integer;
alter table public.supporter_profiles drop constraint if exists supporter_profiles_base_price_nonneg;
alter table public.supporter_profiles add constraint supporter_profiles_base_price_nonneg
  check (base_price_krw is null or base_price_krw >= 0);

-- ---------- 스토리업 대행업무 Agent 시드 (관리자 계정 소유) ----------
-- 관리자(nexosoneai@gmail.com) 계정 소유로 등록 → 클라이언트 의뢰가 이 계정의
-- '내 프로젝트'로 들어온다. 이미 있으면 내용만 갱신한다(onConflict user_id).
insert into public.supporter_profiles
  (user_id, role, display_name, bio, skills, base_price_krw, contact)
select
  p.user_id,
  'agent',
  '스토리업 운영대행',
  '스토리업 프로그램과 네이버 블로그 운영을 전담 대행합니다. 매일 블로그 글 1개 작성(주 7회), 매주 블로그 운영성과 보고, 이벤트 기획·클라이언트 협의·운영, 매주 AI 운영전략 수립 후 실행 및 클라이언트 보고·피드백, 매월 1개월 완료보고서까지 제공합니다.',
  array[
    '스토리업 프로그램 운영대행',
    '네이버 블로그 운영대행',
    '매일 블로그 1개 작성',
    '주간 운영성과 보고',
    '이벤트 기획·협의·운영',
    '주간 AI 운영전략 수립·실행',
    '월간 완료보고서'
  ],
  300000,
  'cto@nexosoneai.com'
from public.profiles p
where lower(p.email) = 'nexosoneai@gmail.com'
on conflict (user_id) do update set
  role           = excluded.role,
  display_name   = excluded.display_name,
  bio            = excluded.bio,
  skills         = excluded.skills,
  base_price_krw = excluded.base_price_krw,
  contact        = excluded.contact,
  updated_at     = now();
