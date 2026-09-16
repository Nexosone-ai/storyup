"use client";

import { useId, useState } from "react";

interface Point {
  date: string;
  views: number;
}

/**
 * 방문(조회) 추이 라인·영역 그래프 — 의존성 없이 SVG로 그린다.
 * 마우스를 올리면 해당 날짜의 값을 툴팁으로 보여준다.
 */
export function TrendChart({
  data,
  ko,
  color = "var(--color-primary, #6d28d9)",
}: {
  data: Point[];
  ko: boolean;
  color?: string;
}) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 180;
  const padX = 8;
  const padY = 16;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.views));

  const x = (i: number) =>
    padX + (i * (W - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) =>
    H - padY - (v / max) * (H - padY * 2);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.views).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M ${x(0).toFixed(1)} ${(H - padY).toFixed(1)} ` +
    data.map((d, i) => `L ${x(i).toFixed(1)} ${y(d.views).toFixed(1)}`).join(" ") +
    ` L ${x(n - 1).toFixed(1)} ${(H - padY).toFixed(1)} Z`;

  const fmtDay = (d: string) => d.slice(5).replace("-", "/");

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={ko ? "방문 추이 그래프" : "Visits trend chart"}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 가로 기준선 */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padY + f * (H - padY * 2)}
            y2={padY + f * (H - padY * 2)}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {hover !== null && (
          <circle cx={x(hover)} cy={y(data[hover].views)} r="4" fill={color} />
        )}

        {/* 히트 영역 — 날짜별 세로 밴드 */}
        {data.map((d, i) => (
          <rect
            key={d.date}
            x={i === 0 ? 0 : (x(i - 1) + x(i)) / 2}
            y="0"
            width={
              i === 0
                ? x(0) + (x(1) - x(0)) / 2
                : i === n - 1
                  ? W - (x(i - 1) + x(i)) / 2
                  : (x(i + 1) - x(i - 1)) / 2
            }
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {/* 툴팁 */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs shadow-sm"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-semibold">{data[hover].views}</span>
          <span className="ml-1 text-muted">{fmtDay(data[hover].date)}</span>
        </div>
      )}

      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{data[0] ? fmtDay(data[0].date) : ""}</span>
        <span>{data.at(-1) ? fmtDay(data.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}
