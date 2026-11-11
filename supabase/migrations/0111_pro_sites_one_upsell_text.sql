-- 0111: Pro 랜딩페이지 한도 6개 → 1개(PR#141)에 맞춰 업세일 분야 PLAN_UPGRADE 설명에서 "랜딩 6개" 제거.
update public.agency_services
set description = replace(description, '랜딩 6개·', '')
where key = 'PLAN_UPGRADE';
