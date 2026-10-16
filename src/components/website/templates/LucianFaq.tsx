"use client";

/* Lucian UX/UI Prompt #044 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#044
 * 자주 묻는 질문 아코디언 — 한 번에 하나만 열림, +/− 모프, 부드러운 펼침, 키보드 이동.
 * 발행(정적) 사이트용으로 React 상태로 포팅하고 --ux-* 토큰을 사이트 테마 변수로 매핑했다.
 */

import { useRef, useState } from "react";

const CSS = `
.lxf{display:flex;flex-direction:column;gap:8px}
.lxf-it{position:relative;border-radius:20px;background:var(--surface);box-shadow:0 0 0 1px var(--border);transition:background-color .4s cubic-bezier(.2,.8,.2,1),box-shadow .5s cubic-bezier(.2,.8,.2,1),transform .5s cubic-bezier(.34,1.45,.64,1)}
.lxf-it.open{box-shadow:0 0 0 1px var(--border-strong),0 22px 40px -22px rgba(0,0,0,.28);transform:translateY(-2px)}
.lxf-q{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:14px 14px 14px 16px;border:0;border-radius:20px;background:none;font-size:15px;font-weight:650;letter-spacing:-.02em;color:var(--foreground);text-align:left;cursor:pointer}
.lxf-q:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.lxf-n{font-size:12px;font-weight:800;color:var(--muted);font-variant-numeric:tabular-nums;transition:color .3s}
.lxf-it.open .lxf-n{color:var(--primary)}
.lxf-t{flex:1}
.lxf-pm{position:relative;width:30px;height:30px;flex:none;border-radius:50%;background:var(--surface-muted);transition:background-color .35s,transform .45s cubic-bezier(.34,1.45,.64,1)}
.lxf-q:hover .lxf-pm{transform:scale(1.1)}
.lxf-q:active .lxf-pm{transform:scale(.9)}
.lxf-pm::before,.lxf-pm::after{content:"";position:absolute;left:50%;top:50%;width:11px;height:2px;margin:-1px 0 0 -5.5px;border-radius:2px;background:var(--foreground);transition:transform .5s cubic-bezier(.34,1.45,.64,1),background-color .3s}
.lxf-pm::after{transform:rotate(90deg)}
.lxf-it.open .lxf-pm{background:var(--primary)}
.lxf-it.open .lxf-pm::before,.lxf-it.open .lxf-pm::after{background:var(--primary-foreground)}
.lxf-it.open .lxf-pm::after{transform:rotate(180deg)}
.lxf-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s cubic-bezier(.2,.8,.2,1)}
.lxf-it.open .lxf-body{grid-template-rows:1fr}
.lxf-body>div{overflow:hidden;min-height:0}
.lxf-a{padding:0 18px 16px 42px;opacity:0;transform:translateY(-8px);transition:opacity .25s cubic-bezier(.2,.8,.2,1),transform .45s cubic-bezier(.34,1.45,.64,1)}
.lxf-it.open .lxf-a{opacity:1;transform:none;transition-delay:.1s}
.lxf-a p{margin:0;font-size:14px;line-height:1.62;color:var(--muted);white-space:pre-wrap}
@media (prefers-reduced-motion:reduce){.lxf-it,.lxf-pm,.lxf-pm::before,.lxf-pm::after,.lxf-body,.lxf-a{transition-duration:.001ms}}
`;

export function LucianFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  const btns = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n =
      e.key === "ArrowDown"
        ? i + 1
        : e.key === "ArrowUp"
          ? i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : -2;
    if (n === -2) return;
    e.preventDefault();
    btns.current[(n + items.length) % items.length]?.focus();
  };

  return (
    <div className="lxf">
      <style>{CSS}</style>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={isOpen ? "lxf-it open" : "lxf-it"}>
            <button
              type="button"
              className="lxf-q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
              onKeyDown={(e) => onKey(e, i)}
              ref={(el) => {
                btns.current[i] = el;
              }}
            >
              <span className="lxf-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="lxf-t">{it.q}</span>
              <span className="lxf-pm" aria-hidden="true" />
            </button>
            <div className="lxf-body" role="region">
              <div>
                <div className="lxf-a">
                  <p>{it.a}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
