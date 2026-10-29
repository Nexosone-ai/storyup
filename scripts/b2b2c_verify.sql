-- ============================================================
--  B2B2C 검증 프로브 — 0096 적용 후 Supabase SQL 에디터에서 실행
-- ============================================================
-- 스키마/제약/정책이 의도대로 들어갔는지, 격리·멱등·가격독립이 보장되는지 확인한다.
-- 읽기 전용(SELECT) 중심. 각 쿼리 기대값을 주석으로 표기.

-- [스키마] 신규 테이블 5개 존재? (기대: 5행)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'partner_storefronts','partner_products','partner_offers',
    'partner_invoices','partner_invoice_events'
  )
order by table_name;

-- [멱등] 청구서당 정산 1건 유니크 인덱스 존재? (기대: partner_earnings_invoice_once 1행)
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'partner_earnings'
  and indexname = 'partner_earnings_invoice_once';

-- [정산 확장] partner_earnings 공제/상태 컬럼 존재? (기대: invoice_id, gross_krw, base_deduction_krw, pg_fee_krw, tax_krw)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'partner_earnings'
  and column_name in ('invoice_id','gross_krw','base_deduction_krw','pg_fee_krw','tax_krw')
order by column_name;

-- [상태 제약] partner_earnings status에 'held' 허용? (기대: 체크식에 held 포함)
select pg_get_constraintdef(oid)
from pg_constraint
where conname = 'partner_earnings_status_check';

-- [RLS] 신규 테이블 RLS 활성? (기대: 모두 relrowsecurity = true)
select relname, relrowsecurity
from pg_class
where relname in (
  'partner_storefronts','partner_products','partner_offers',
  'partner_invoices','partner_invoice_events'
)
order by relname;

-- [RLS 정책] 파트너/고객/관리자 접근 정책이 존재? (기대: 각 테이블에 self/access/admin 정책)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'partner_storefronts','partner_products','partner_offers',
    'partner_invoices','partner_invoice_events'
  )
order by tablename, policyname;

-- [가격 독립] 발행된 청구서는 base_price_krw를 '스냅샷'으로 별도 보관한다.
-- 상품 판매가를 바꿔도 이미 발행된 청구서의 sell/base가 바뀌지 않아야 한다(스냅샷 컬럼 존재 확인).
select column_name
from information_schema.columns
where table_schema='public' and table_name='partner_invoices'
  and column_name in ('sell_price_krw','base_price_krw','product_snapshot','order_id')
order by column_name;

-- [중복 결제 방지] 청구서 order_id 유니크? (기대: unique 제약/인덱스)
select conname, contype
from pg_constraint
where conrelid = 'public.partner_invoices'::regclass and contype = 'u';

-- ---- 데이터 프로브(운영 데이터가 있을 때) ----
-- [멱등 결과] 결제완료 청구서마다 정산 행이 정확히 1건인가? (기대: dup 0행)
select invoice_id, count(*) as n
from public.partner_earnings
where invoice_id is not null
group by invoice_id
having count(*) > 1;

-- [격리 수동 점검 안내]
--   파트너 A 세션으로: select * from public.partner_invoices;  → A의 청구서만 보여야 함.
--   파트너 B의 토큰/ID로 조회해도 0행이어야 함(RLS). 서비스롤(SQL에디터)은 전체가 보이므로
--   실제 격리는 앱의 세션 토큰(authenticated)으로 확인한다.
