import { forwardRef } from "react";
import { CARD, IG } from "./cardTheme";
import type { CardNewsResult } from "@/types/domain";

export type IGCardModel =
  | { kind: "cover"; title: string; subtitle: string }
  | { kind: "content"; index: number; heading: string; body: string }
  | { kind: "cta"; text: string; handle: string };

/** Flattens a CardNewsResult into the ordered list of IG cards. */
export function toIGCards(cn: CardNewsResult): IGCardModel[] {
  return [
    { kind: "cover", title: cn.cover.title, subtitle: cn.cover.subtitle },
    ...cn.slides.map((s, i) => ({
      kind: "content" as const,
      index: i + 1,
      heading: s.heading,
      body: s.body,
    })),
    { kind: "cta", text: cn.cta.text, handle: cn.cta.handle },
  ];
}

/** Short text used to prompt this card's backdrop image. */
export function cardImageSubject(card: IGCardModel): string {
  if (card.kind === "cover") return `${card.title} ${card.subtitle}`;
  if (card.kind === "content") return `${card.heading} ${card.body}`;
  return card.text;
}

const PAD = 96;

export const InstagramCard = forwardRef<
  HTMLDivElement,
  {
    card: IGCardModel;
    total: number;
    pageNo: number;
    brandName: string;
    handle: string;
    image?: string;
  }
>(function InstagramCard(
  { card, total, pageNo, brandName, handle, image },
  ref,
) {
  const photo = !!image;
  const ink = photo ? "#ffffff" : CARD.ink;
  const sub = photo ? "rgba(255,255,255,0.82)" : CARD.muted;
  const accent = photo ? "#ffffff" : CARD.primary;
  const line = photo ? "rgba(255,255,255,0.32)" : CARD.border;

  return (
    <div
      ref={ref}
      style={{
        width: IG.w,
        height: IG.h,
        background: CARD.paper,
        color: ink,
        fontFamily: CARD.font,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(20,19,16,0.45) 0%, rgba(20,19,16,0.30) 45%, rgba(20,19,16,0.62) 100%)",
            }}
          />
        </>
      )}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          boxSizing: "border-box",
        }}
      >
        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: photo ? "rgba(255,255,255,0.16)" : CARD.primary,
                border: photo ? "1px solid rgba(255,255,255,0.5)" : "none",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              S
            </div>
            <span style={{ fontSize: 26, fontWeight: 600 }}>{brandName}</span>
          </div>
          <span
            style={{
              fontFamily: CARD.mono,
              fontSize: 22,
              letterSpacing: "0.12em",
              color: sub,
            }}
          >
            {String(pageNo).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: card.kind === "content" ? "flex-start" : "center",
            paddingTop: card.kind === "content" ? 120 : 0,
          }}
        >
          {card.kind === "cover" && (
            <>
              <div
                style={{
                  width: 64,
                  height: 6,
                  borderRadius: 999,
                  background: accent,
                  marginBottom: 44,
                }}
              />
              <h1
                style={{
                  fontSize: 92,
                  lineHeight: 1.08,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  margin: 0,
                }}
              >
                {card.title}
              </h1>
              <p style={{ fontSize: 38, lineHeight: 1.5, color: sub, marginTop: 36 }}>
                {card.subtitle}
              </p>
            </>
          )}

          {card.kind === "content" && (
            <>
              <div
                style={{
                  fontFamily: CARD.mono,
                  fontSize: 30,
                  fontWeight: 600,
                  color: accent,
                  marginBottom: 28,
                }}
              >
                {String(card.index).padStart(2, "0")}
              </div>
              <h2
                style={{
                  fontSize: 66,
                  lineHeight: 1.15,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {card.heading}
              </h2>
              <p style={{ fontSize: 40, lineHeight: 1.6, color: sub, marginTop: 32 }}>
                {card.body}
              </p>
            </>
          )}

          {card.kind === "cta" && (
            <>
              <h2
                style={{
                  fontSize: 78,
                  lineHeight: 1.12,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {card.text}
              </h2>
              <div
                style={{
                  marginTop: 56,
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  background: photo ? "rgba(255,255,255,0.16)" : CARD.primary,
                  border: photo ? "1px solid rgba(255,255,255,0.5)" : "none",
                  color: "#ffffff",
                  fontSize: 34,
                  fontWeight: 600,
                  padding: "22px 40px",
                  borderRadius: 18,
                }}
              >
                {card.handle}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `2px solid ${line}`,
            paddingTop: 32,
            fontSize: 26,
            color: sub,
          }}
        >
          <span>{handle}</span>
          {card.kind === "cover" ? (
            <span style={{ color: accent, fontWeight: 600 }}>밀어서 보기 →</span>
          ) : (
            <span style={{ fontFamily: CARD.mono, letterSpacing: "0.1em" }}>
              STORYUP
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
