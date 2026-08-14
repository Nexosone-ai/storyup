import { forwardRef } from "react";
import { CARD } from "./cardTheme";

/**
 * Landscape share card (X 1600×900, Facebook 1200×630) derived from the
 * card-news cover. Optional AI backdrop image. Full pixel size for export.
 */
export const ShareCard = forwardRef<
  HTMLDivElement,
  {
    width: number;
    height: number;
    title: string;
    subtitle: string;
    brandName: string;
    handle: string;
    image?: string;
  }
>(function ShareCard(
  { width, height, title, subtitle, brandName, handle, image },
  ref,
) {
  const pad = Math.round(width * 0.075);
  const photo = !!image;
  const ink = photo ? "#ffffff" : CARD.ink;
  const sub = photo ? "rgba(255,255,255,0.82)" : CARD.muted;
  const accent = photo ? "#ffffff" : CARD.primary;

  return (
    <div
      ref={ref}
      style={{
        width,
        height,
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
                "linear-gradient(180deg, rgba(20,19,16,0.40) 0%, rgba(20,19,16,0.30) 40%, rgba(20,19,16,0.62) 100%)",
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
          justifyContent: "space-between",
          padding: pad,
          boxSizing: "border-box",
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
          <span style={{ fontSize: 28, fontWeight: 600 }}>{brandName}</span>
        </div>

        <div>
          <div
            style={{
              width: 56,
              height: 6,
              borderRadius: 999,
              background: accent,
              marginBottom: 28,
            }}
          />
          <h1
            style={{
              fontSize: Math.round(height * 0.11),
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: Math.round(height * 0.045),
              lineHeight: 1.5,
              color: sub,
              marginTop: 20,
              maxWidth: "85%",
            }}
          >
            {subtitle}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: sub,
          }}
        >
          <span>{handle}</span>
          <span style={{ fontFamily: CARD.mono, letterSpacing: "0.1em" }}>
            STORYUP
          </span>
        </div>
      </div>
    </div>
  );
});
