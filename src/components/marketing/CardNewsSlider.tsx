"use client";

import { useEffect, useRef, useState } from "react";
import { InstagramCard, toIGCards } from "@/components/cards/InstagramCard";
import { IG } from "@/components/cards/cardTheme";
import type { ShowcaseCardItem } from "@/components/marketing/showcaseData";

/**
 * 쇼케이스용 카드뉴스 미리보기 — 실제 SNS 카드(1080×1350)의 표지 한 장을
 * 축소 렌더링한다. (슬라이드는 산만하다는 피드백으로 표지만 표시)
 */
export function CardNewsSlider({ item }: { item: ShowcaseCardItem }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  const cards = toIGCards(item.cardNews);
  const cover = cards[0];

  // 컨테이너 너비에 맞춰 1080px 카드를 축소한다.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / IG.w;

  return (
    <div ref={wrapRef} className="relative aspect-[4/5] w-full overflow-hidden">
      {width > 0 && cover && (
        <div
          style={{
            width: IG.w,
            height: IG.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <InstagramCard
            card={cover}
            pageNo={1}
            total={cards.length}
            brandName={item.businessName}
            handle={item.handle}
            image={item.image ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
