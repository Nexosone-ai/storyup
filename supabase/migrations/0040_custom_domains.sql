-- 0040: 개인(커스텀) 도메인 연결 — Pro 이상.
-- 사업장별로 외부 도메인(예: myshop.com)을 공개 랜딩/블로그에 연결한다.
-- 실제 서빙/SSL은 Vercel 프로젝트에 도메인이 등록돼야 하며(외부 단계),
-- 미들웨어는 활성(active) 도메인 요청을 해당 사업장의 /site/<slug>로 rewrite한다.

create table if not exists public.custom_domains (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- 프로토콜/경로 없는 호스트만 저장(소문자). 예: "myshop.com", "www.myshop.com"
  domain      text not null unique,
  status      text not null default 'pending'
                check (status in ('pending', 'active', 'error')),
  created_at  timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists custom_domains_business_idx
  on public.custom_domains (business_id);

alter table public.custom_domains enable row level security;

-- 소유자(사업장 주인)만 자신의 도메인 행을 관리한다.
drop policy if exists custom_domains_owner_select on public.custom_domains;
create policy custom_domains_owner_select on public.custom_domains
  for select using (
    exists (
      select 1 from public.businesses b
      where b.id = custom_domains.business_id and b.user_id = auth.uid()
    )
  );

drop policy if exists custom_domains_owner_insert on public.custom_domains;
create policy custom_domains_owner_insert on public.custom_domains
  for insert with check (
    exists (
      select 1 from public.businesses b
      where b.id = custom_domains.business_id and b.user_id = auth.uid()
    )
  );

drop policy if exists custom_domains_owner_delete on public.custom_domains;
create policy custom_domains_owner_delete on public.custom_domains
  for delete using (
    exists (
      select 1 from public.businesses b
      where b.id = custom_domains.business_id and b.user_id = auth.uid()
    )
  );

-- 미들웨어용 공개 조회: 활성 도메인 → 공개된 사이트 slug.
-- SECURITY DEFINER로 RLS 우회(익명 요청도 rewrite 대상 해석이 필요), slug만 노출.
create or replace function public.resolve_custom_domain(p_domain text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select w.slug
  from public.custom_domains cd
  join public.websites w on w.business_id = cd.business_id
  where cd.domain = lower(p_domain)
    and cd.status = 'active'
    and w.status = 'published'
  limit 1;
$$;

grant execute on function public.resolve_custom_domain(text) to anon, authenticated;
