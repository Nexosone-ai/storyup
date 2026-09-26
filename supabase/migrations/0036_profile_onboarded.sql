-- 첫 대시보드 진입 시 환영 가이드를 1회만 보여주기 위한 플래그.
-- null = 아직 안 봄(가이드 표시 대상), 값 있음 = 가이드 확인 완료 시각.
alter table public.profiles add column if not exists onboarded_at timestamptz;
