/**
 * 플랜 상품(Basic/Pro 1개월 이용권) 카드 상단 배너 — 기존 배너 디자인을 코드로 재현.
 * 가격·사양을 이미지에 박으면 요금이 바뀔 때마다 어긋나므로, 가격은 빼고 디자인만 둔다.
 * (실제 가격·혜택은 카드 본문 텍스트가 보여준다.)
 */
export function PlanBanner({
  plan,
  className = "",
}: {
  plan: "basic" | "pro";
  className?: string;
}) {
  const isPro = plan === "pro";
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden ${
        isPro ? "text-white" : "text-foreground"
      } ${className}`}
      style={{
        background: isPro
          ? "linear-gradient(135deg, var(--primary), var(--primary-hover))"
          : "linear-gradient(135deg, #fdf2ea, #f6ddc8)",
      }}
    >
      {/* 장식 원 */}
      <span
        className={`pointer-events-none absolute -right-10 -top-12 size-44 rounded-full ${
          isPro ? "bg-white/10" : "bg-white/50"
        }`}
      />
      <span
        className={`pointer-events-none absolute right-8 top-20 size-24 rounded-full ${
          isPro ? "bg-white/10" : "bg-white/60"
        }`}
      />

      <div className="relative flex h-full flex-col justify-center px-6 py-5 sm:px-7">
        <span className="text-sm font-extrabold tracking-tight">
          STORY<span className={isPro ? "text-white" : "text-primary"}>UP</span>
        </span>

        {isPro && (
          <span className="mt-2.5 inline-flex w-fit rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Popular
          </span>
        )}

        <h3 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {isPro ? "PRO" : "BASIC"}
        </h3>
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
            isPro ? "text-white/80" : "text-muted"
          }`}
        >
          1-Month Plan
        </p>
        <span
          className={`mt-3 block h-1 w-10 rounded-full ${
            isPro ? "bg-white/70" : "bg-primary"
          }`}
        />
      </div>
    </div>
  );
}
