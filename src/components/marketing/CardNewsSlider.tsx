"use client";

import { useEffect, useRef, useState } from "react";
import { InstagramCard, toIGCards } from "@/components/cards/InstagramCard";
import { IG } from "@/components/cards/cardTheme";
import { cn } from "@/utils/cn";
import type { ShowcaseCardItem } from "@/components/marketing/showcaseData";

/**
 * 쇼케이스용 카드뉴스 슬라이더 — 실제 SNS 카드(1080×1350)를 축소 렌더링하고
 * 커버→내용→CTA 순으로 자동으로 넘어간다. 마우스를 올리면 멈춘다.
 */
export function CardNewsSlider({ item }: { item: ShowcaseCardItem }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const cards = toIGCards(item.cardNews);

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

  useEffect(() => {
    if (paused || cards.length <= 1) return;
    const timer = setInterval(
      () => setIdx((i) => (i + 1) % cards.length),
      3500,
    );
    return () => clearInterval(timer);
  }, [paused, cards.length]);

  const scale = width / IG.w;

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative aspect-[4/5] w-full overflow-hidden"
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {cards.map((card, i) => (
          <div key={i} className="h-full w-full shrink-0 overflow-hidden">
            {width > 0 && (
              <div
                style={{
                  width: IG.w,
                  height: IG.h,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <InstagramCard
                  card={card}
                  pageNo={i + 1}
                  total={cards.length}
                  brandName={item.businessName}
                  handle={item.handle}
                  image={i === 0 ? (item.image ?? undefined) : undefined}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 페이지 점 표시 */}
      {cards.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
          {cards.map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === idx ? "bg-primary" : "bg-black/20",
              )}
            />
          ))}
        </div>
      )}

      {/* 회색 처리한 STORYUP 로고 워터마크 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 */}
      <img
        src="/images/logo-icon.png"
        alt=""
        aria-hidden
        className="absolute right-3 top-3 size-7 opacity-45 grayscale"
      />
    </div>
  );
}
