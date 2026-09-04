"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

/** 글자색 스와치 — 검정(기본 복귀용)·빨강·주황·황토·초록·파랑·보라 */
const TEXT_COLORS = [
  "#111827",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#9333ea",
];
const HIGHLIGHT_COLOR = "#fde047";

interface Anchor {
  top: number;
  bottom: number;
  left: number;
}

/**
 * 위지윅 서식 툴바 — 미리보기에서 서식 허용 필드([data-rich])의 텍스트를
 * 드래그로 선택하면 선택 영역 위에 떠서 굵게·기울임·밑줄·취소선·크기·
 * 형광펜·글자색·서식 지우기를 적용한다.
 */
export function RichTextToolbar() {
  const ko = useLocale() === "ko";
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return setAnchor(null);
      const node = sel.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      if (!el?.closest('[data-rich="true"]')) return setAnchor(null);
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return setAnchor(null);
      setAnchor({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left + rect.width / 2,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (!anchor) return null;

  const exec = (cmd: string, val?: string) => {
    // 색상류가 <font> 대신 <span style>로 생성되도록 한다.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, val);
  };

  const showBelow = anchor.top < 104;
  const left = Math.min(
    Math.max(anchor.left, 170),
    (typeof window !== "undefined" ? window.innerWidth : 1200) - 170,
  );

  const btn =
    "grid size-8 shrink-0 place-items-center rounded-md text-sm text-foreground transition-colors hover:bg-surface-muted";
  const divider = <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />;

  return (
    <div
      role="toolbar"
      aria-label={ko ? "텍스트 서식" : "Text formatting"}
      // mousedown을 막아 선택 영역·포커스를 유지한 채 서식을 적용한다.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[90] flex items-center gap-0.5 rounded-xl border border-border bg-surface p-1 shadow-lg"
      style={{
        top: showBelow ? anchor.bottom + 10 : anchor.top - 10,
        left,
        transform: `translate(-50%, ${showBelow ? "0" : "-100%"})`,
      }}
    >
      <button type="button" title={ko ? "굵게" : "Bold"} className={`${btn} font-extrabold`} onClick={() => exec("bold")}>
        B
      </button>
      <button type="button" title={ko ? "기울임" : "Italic"} className={`${btn} italic`} onClick={() => exec("italic")}>
        I
      </button>
      <button type="button" title={ko ? "밑줄" : "Underline"} className={`${btn} underline`} onClick={() => exec("underline")}>
        U
      </button>
      <button type="button" title={ko ? "취소선" : "Strikethrough"} className={`${btn} line-through`} onClick={() => exec("strikeThrough")}>
        S
      </button>
      {divider}
      <button type="button" title={ko ? "크게" : "Larger"} className={btn} onClick={() => exec("fontSize", "5")}>
        가<span className="text-[10px] leading-none">＋</span>
      </button>
      <button type="button" title={ko ? "작게" : "Smaller"} className={btn} onClick={() => exec("fontSize", "2")}>
        가<span className="text-[10px] leading-none">－</span>
      </button>
      {divider}
      <button
        type="button"
        title={ko ? "형광펜" : "Highlight"}
        className={btn}
        style={{ backgroundColor: `${HIGHLIGHT_COLOR}66` }}
        onClick={() => exec("hiliteColor", HIGHLIGHT_COLOR)}
      >
        🖍
      </button>
      {divider}
      {TEXT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={ko ? "글자색" : "Text color"}
          className="grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-surface-muted"
          onClick={() => exec("foreColor", c)}
        >
          <span
            className="size-4 rounded-full border border-border-strong"
            style={{ backgroundColor: c }}
          />
        </button>
      ))}
      {divider}
      <button
        type="button"
        title={ko ? "서식 지우기" : "Clear formatting"}
        className={`${btn} w-auto px-2 text-xs font-medium text-muted`}
        onClick={() => exec("removeFormat")}
      >
        {ko ? "지우기" : "Clear"}
      </button>
    </div>
  );
}
