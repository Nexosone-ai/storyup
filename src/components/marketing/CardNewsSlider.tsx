"use client";

import { useEffect, useRef, useState } from "react";
import { InstagramCard, toIGCards } from "@/components/cards/InstagramCard";
import { IG } from "@/components/cards/cardTheme";
import { cn } from "@/utils/cn";
import type { ShowcaseCardItem } from "@/components/marketing/showcaseData";

/**
 * 쇼케이스용 카드뉴스 뷰어 — 실제 SNS 카드(1080×1350)를 축소 렌더링한다.
 * 자동 슬라이드 없이 클릭·스와이프·화살표로 직접 넘겨 본다.
 */
export function CardNewsSlider({ item }: { item: ShowcaseCardItem }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const touchX = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState(0);

  const cards = toIGCards(item.cardNews);
  const count = cards.length;

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
  const go = (delta: number) =>
    setIdx((i) => (i + delta + count) % count);

  return (
    <div
      ref={wrapRef}
      role="button"
      tabIndex={0}
      aria-label="카드뉴스 넘겨 보기"
      onClick={() => go(1)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go(1);
        }
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
      className="group/slider relative aspect-[4/5] w-full cursor-pointer select-none overflow-hidden"
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
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
                  total={count}
                  brandName={item.businessName}
                  handle={item.handle}
                  image={i === 0 ? (item.image ?? undefined) : undefined}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 좌우 화살표 */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 카드"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover/slider:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 카드"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover/slider:opacity-100"
          >
            ›
          </button>
        </>
      )}

      {/* 페이지 점 표시 */}
      {count > 1 && (
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
    </div>
  );
}
