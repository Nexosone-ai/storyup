"use client";

import { useEffect, useState } from "react";

export interface CardShareRow {
  channel: string;
  visitorKey: string | null;
  createdAt: string;
}

/**
 * 카드뉴스 공개 공유 페이지의 '공유하기' 바 + 공유 이력 리스트.
 * - 누구나(로그인 불필요) 이 카드뉴스를 공유할 수 있다.
 *   휴대폰은 네이티브 공유 시트(카톡·인스타·X·페북 등), PC는 링크 복사.
 * - 공유 1회가 기록되고 아래 리스트에 쌓인다. 내 브라우저에서 한 공유는 '나'로 표시.
 * - 조회는 마운트 시 브라우저당 1회 자동 집계. (감사 표시 지표는 폐지)
 */
export function CardShareBar({
  id,
  views,
  shareCount,
  shares,
  ko,
}: {
  id: string;
  views: number;
  shareCount: number;
  shares: CardShareRow[];
  ko: boolean;
}) {
  const [v, setV] = useState(views);
  const [count, setCount] = useState(shareCount);
  const [list, setList] = useState<CardShareRow[]>(shares);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myVid, setMyVid] = useState("");
  // 상대 시간 계산용 기준 시각 — 렌더 중 Date.now() 호출을 피하려고 상태로 둔다.
  const [now, setNow] = useState(0);

  // 브라우저당 방문자 id('나의 공유' 표시용, 개인정보 아님) + 상대시간 기준 갱신.
  // 외부 시스템(localStorage·시계) 읽기는 콜백에서 상태에 반영한다.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        let x = localStorage.getItem("cshr_vid");
        if (!x) {
          x = Math.random().toString(36).slice(2) + Date.now().toString(36);
          localStorage.setItem("cshr_vid", x);
        }
        setMyVid(x);
      } catch {
        /* ignore */
      }
      setNow(Date.now());
    });
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, []);

  // 조회 1회 자동 집계(브라우저당).
  useEffect(() => {
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

  const recordShare = (channel: string) => {
    const createdAt = new Date().toISOString();
    setCount((c) => c + 1);
    setList((l) =>
      [{ channel, visitorKey: myVid || null, createdAt }, ...l].slice(0, 50),
    );
    fetch("/api/cards/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind: "share", channel, visitor: myVid }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.count === "number") setCount(j.count);
      })
      .catch(() => {});
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      recordShare("link");
      setMsg(
        ko
          ? "링크를 복사했어요. 원하는 곳에 붙여넣어 공유하세요."
          : "Link copied — paste it anywhere to share.",
      );
    } catch {
      recordShare("link");
      setMsg(url);
    }
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title =
      typeof document !== "undefined" ? document.title : "StoryUp 카드뉴스";
    try {
      const nav = navigator as Navigator & {
        canShare?: (d?: ShareData) => boolean;
      };
      if (typeof nav.share === "function") {
        try {
          await nav.share({ title, url });
          recordShare("native");
          setMsg(ko ? "공유했어요. 감사합니다!" : "Shared — thank you!");
        } catch (e) {
          // 사용자가 취소하면 무기록, 그 외엔 링크 복사로 폴백
          if (!(e instanceof DOMException && e.name === "AbortError"))
            await copyLink(url);
        }
      } else {
        await copyLink(url);
      }
    } finally {
      setBusy(false);
    }
  };

  const channelLabel = (c: string): string => {
    const map: Record<string, { ko: string; en: string }> = {
      native: { ko: "공유", en: "Shared" },
      link: { ko: "링크 복사", en: "Copied link" },
      facebook: { ko: "페이스북", en: "Facebook" },
      x: { ko: "X", en: "X" },
      instagram: { ko: "인스타그램", en: "Instagram" },
    };
    const m = map[c];
    return m ? (ko ? m.ko : m.en) : c;
  };

  const timeAgo = (iso: string): string => {
    const base = now || new Date(iso).getTime();
    const diff = base - new Date(iso).getTime();
    const s = Math.max(0, Math.floor(diff / 1000));
    if (s < 60) return ko ? "방금 전" : "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return ko ? `${m}분 전` : `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return ko ? `${h}시간 전` : `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return ko ? `${d}일 전` : `${d}d ago`;
    return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US");
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        <ShareIcon />
        {ko ? "공유하기" : "Share"}
      </button>
      <p className="text-sm text-muted">
        {ko
          ? `공유 ${count.toLocaleString()} · 조회 ${v.toLocaleString()}`
          : `${count.toLocaleString()} shares · ${v.toLocaleString()} views`}
      </p>
      {msg && <p className="text-sm font-medium text-primary">{msg}</p>}

      {/* 공유 이력 리스트 */}
      <div className="mt-2 w-full">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {ko ? "공유 이력" : "Share history"}
        </p>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-sm text-muted">
            {ko
              ? "아직 공유 내역이 없어요. 가장 먼저 공유해보세요!"
              : "No shares yet — be the first to share!"}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {list.map((row, i) => {
              const mine = !!myVid && row.visitorKey === myVid;
              return (
                <li
                  key={`${row.createdAt}-${i}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="inline-flex items-center gap-2 text-foreground">
                    <ShareIcon className="size-3.5 text-muted" />
                    {channelLabel(row.channel)}
                    {mine && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {ko ? "나" : "You"}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {timeAgo(row.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShareIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
