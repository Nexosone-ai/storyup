-- 0082: 전문 편집 엔진(V2) 문서 저장 컬럼.
-- 기존 page_schema(V1)는 보존하고, V2 중첩 문서는 document에 저장한다.
-- 에디터는 document가 있으면 그걸, 없으면 page_schema를 V2로 변환해 연다.
alter table public.template_versions
  add column if not exists document jsonb;
