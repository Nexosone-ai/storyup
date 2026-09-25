-- 데이터 정합성 자동 점검. 매일 cron이 integrity_report()를 실행해 결과를 저장하고,
-- 관리자 화면에서 최신 결과 확인 + 온디맨드 재실행. auth 스키마 교차 조회가 필요해
-- 모든 검사는 SECURITY DEFINER 함수에 두고 service_role만 실행한다.

create table if not exists public.integrity_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'cron',   -- 'cron' | 'manual'
  ok boolean not null,
  issues int not null default 0,
  report jsonb not null
);
create index if not exists integrity_reports_created_idx
  on public.integrity_reports (created_at desc);

alter table public.integrity_reports enable row level security;
-- 클라이언트 직접 접근 없음 (서버 admin client 전용). select 정책 미부여 = 차단.

-- 정합성 검사 실행 — 검사 결과 jsonb를 반환(저장은 호출부에서).
create or replace function public.integrity_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_missing_profiles int;
  c_orphan_profiles int;
  c_trial_no_end int;
  c_ach_mismatch int;
  c_neg_balance int;
  c_bad_plan int;
  checks jsonb;
  issues int;
begin
  -- 가입(auth.users)했으나 profiles 행이 없는 사용자 (관리자 조회·온보딩 불가)
  select count(*) into c_missing_profiles
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where p.user_id is null;

  -- auth 사용자가 없는 고아 profiles
  select count(*) into c_orphan_profiles
    from public.profiles p
    left join auth.users u on u.id = p.user_id
    where u.id is null;

  -- 만료일이 비어있는 활성 체험 구독 (무기한 유료 플랜으로 남음)
  select count(*) into c_trial_no_end
    from public.subscriptions
    where trial = true and status = 'active' and current_period_end is null;

  -- 달성했으나 보상 이벤트가 없는 업적
  select count(*) into c_ach_mismatch
    from public.user_achievements ua
    where not exists (
      select 1 from public.reward_events re
      where re.user_id = ua.user_id
        and re.reward_key = 'achievement:' || ua.code
    );

  -- 포인트 잔액이 음수인 사용자 (과금 로직 오류 신호)
  select count(*) into c_neg_balance
    from (
      select user_id
      from public.point_transactions
      group by user_id
      having sum(amount) < 0
    ) t;

  -- 알 수 없는 구독 플랜
  select count(*) into c_bad_plan
    from public.subscriptions
    where plan not in ('free', 'basic', 'pro', 'partner');

  checks := jsonb_build_array(
    jsonb_build_object('key','missing_profiles','label','profiles 누락 (가입했으나 profiles 없음)','count',c_missing_profiles,'status', case when c_missing_profiles>0 then 'error' else 'ok' end),
    jsonb_build_object('key','orphan_profiles','label','고아 profiles (auth 사용자 없음)','count',c_orphan_profiles,'status', case when c_orphan_profiles>0 then 'error' else 'ok' end),
    jsonb_build_object('key','trial_no_period_end','label','만료일 없는 활성 체험 구독','count',c_trial_no_end,'status', case when c_trial_no_end>0 then 'warn' else 'ok' end),
    jsonb_build_object('key','achievement_reward_mismatch','label','보상 누락된 업적','count',c_ach_mismatch,'status', case when c_ach_mismatch>0 then 'error' else 'ok' end),
    jsonb_build_object('key','negative_balance','label','포인트 잔액 음수 사용자','count',c_neg_balance,'status', case when c_neg_balance>0 then 'error' else 'ok' end),
    jsonb_build_object('key','invalid_plan','label','알 수 없는 구독 플랜','count',c_bad_plan,'status', case when c_bad_plan>0 then 'error' else 'ok' end)
  );

  select count(*) into issues
    from jsonb_array_elements(checks) e
    where e->>'status' <> 'ok';

  return jsonb_build_object(
    'generated_at', now(),
    'ok', issues = 0,
    'issues', issues,
    'checks', checks
  );
end;
$$;

revoke all on function public.integrity_report() from public;
grant execute on function public.integrity_report() to service_role;
