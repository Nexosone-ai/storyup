-- ============================================================
--  0009: 공개 쇼케이스 카드뉴스
--  공개(published) 홈페이지를 가진 비즈니스의 카드뉴스(instagram_cards)를
--  누구나 읽을 수 있게 허용 — 랜딩/스토리들 페이지의 카드뉴스 탭용.
-- ============================================================

drop policy if exists marketing_contents_public_read_cards on public.marketing_contents;
create policy marketing_contents_public_read_cards on public.marketing_contents
  for select using (
    platform = 'instagram_cards'
    and exists (
      select 1 from public.websites w
      where w.business_id = marketing_contents.business_id
        and w.status = 'published'
    )
  );
