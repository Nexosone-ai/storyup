import { CARD } from "@/components/cards/cardTheme";

/** Stable non-negative hash from a string (for deterministic variant pick). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Variant {
  bg: string;
  fg: string;
  sub: string;
  motif: string; // stroke/fill color for the motif
}

const VARIANTS: Variant[] = [
  { bg: CARD.primary, fg: "#ffffff", sub: "rgba(255,255,255,0.72)", motif: "rgba(255,255,255,0.16)" },
  { bg: CARD.primarySoft, fg: "#13332a", sub: "#3f6b5c", motif: "rgba(31,111,90,0.18)" },
  { bg: CARD.surface, fg: CARD.ink, sub: CARD.muted, motif: "rgba(31,111,90,0.14)" },
];

function Motif({ kind, color }: { kind: number; color: string }) {
  if (kind === 0) {
    // concentric arcs, anchored bottom-right
    return (
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMaxYMax slice"
        aria-hidden
      >
        {[40, 90, 140, 190, 240].map((r) => (
          <circle
            key={r}
            cx="400"
            cy="200"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        ))}
      </svg>
    );
  }
  if (kind === 1) {
    // dot grid
    return (
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2.4" fill={color} />
          </pattern>
        </defs>
        <rect width="400" height="200" fill="url(#dots)" />
      </svg>
    );
  }
  // diagonal hairlines
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 200"
      preserveAspectRatio="none"
      aria-hidden
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <line
          key={i}
          x1={i * 40 - 200}
          y1="0"
          x2={i * 40}
          y2="200"
          stroke={color}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

/**
 * Deterministic, brand-consistent blog cover. Pure component — renders on the
 * server. Same slug always yields the same cover.
 */
export function BlogCover({
  title,
  seed,
  label,
  showTitle = true,
  className,
}: {
  title: string;
  seed: string;
  label?: string;
  showTitle?: boolean;
  className?: string;
}) {
  const h = hash(seed);
  const v = VARIANTS[h % VARIANTS.length];
  const motifKind = h % 3;

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ background: v.bg }}
    >
      <Motif kind={motifKind} color={v.motif} />
      <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
        <div
          className="font-mono text-[0.7rem] uppercase tracking-[0.14em]"
          style={{ color: v.sub }}
        >
          {label || "STORYUP · STORY"}
        </div>
        {showTitle && (
          <h2
            className="max-w-[92%] text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl"
            style={{ color: v.fg }}
          >
            {title}
          </h2>
        )}
      </div>
    </div>
  );
}
