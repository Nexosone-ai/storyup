"use client";

import { useEffect, useState } from "react";

/**
 * 카드뉴스 공개 공유 페이지의 '감사 표시' 바.
 * - 마운트 시 조회 1회 자동 집계(브라우저당), 감사 버튼은 브라우저당 1회.
 * - UP 등 화폐 보상이 아닌 비화폐 '감사' 지표(정책상 UP 양도 없음).
 */
export function CardThanksBar({
  id,
  thanks,
  views,
  ko,
}: {
  id: string;
  thanks: number;
  views: number;
  ko: boolean;
}) {
  const [t, setT] = useState(thanks);
  const [v, setV] = useState(views);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // 조회 1회 자동 집계(브라우저당). setState는 비동기 콜백에서만 호출.
    let skip = true;
    try {
      skip = !!localStorage.getItem(`cv_${id}`);
      if (!skip) localStorage.setItem(`cv_${id}`, "1");
    } catch {
      skip = false;
    }
    if (skip) return;
    fetch("/api/cards/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind: "view" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.count === "number") setV(j.count);
      })
      .catch(() => {});
  }, [id]);

  const thank = () => {
    if (done) return;
    let already = false;
    try {
      already = !!localStorage.getItem(`ct_${id}`);
      if (!already) localStorage.setItem(`ct_${id}`, "1");
    } catch {
      /* ignore */
    }
    setDone(true);
    if (already) return; // 이미 이 브라우저에서 감사함 — 중복 집계 생략
    setT((x) => x + 1);
    fetch("/api/cards/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind: "thanks" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.count === "number") setT(j.count);
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={thank}
        disabled={done}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        👏{" "}
        {done
          ? ko
            ? "감사를 전했어요"
            : "Thanks sent"
          : ko
            ? "감사 표시하기"
            : "Say thanks"}
      </button>
      <p className="text-sm text-muted">
        {ko ? `감사 ${t.toLocaleString()} · 조회 ${v.toLocaleString()}` : `${t.toLocaleString()} thanks · ${v.toLocaleString()} views`}
      </p>
    </div>
  );
}
