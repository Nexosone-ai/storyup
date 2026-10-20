-- 0080: 디자이너 AI 수정(Page Schema 편집) 단가 — UP 차감. 관리자 화면에서 수정.
-- 템플릿 판매가와 분리된 'AI 제작 비용'. 기본 300P. 0 = 무료.
insert into public.service_prices (service, label, price, active)
values ('DESIGN_AI_EDIT', 'AI 디자인 수정', 300, true)
on conflict (service) do nothing;
