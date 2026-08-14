import type { DashboardData } from "@/lib/queries";

export function SummaryCards({ totals }: { totals: DashboardData["totals"] }) {
  const items = [
    { label: "내 비즈니스", value: totals.businesses },
    { label: "홈페이지", value: totals.websites },
    { label: "블로그 글", value: totals.blogPosts },
    { label: "공개된 콘텐츠", value: totals.published },
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={[
            "p-5",
            i % 2 === 0 ? "border-r border-border" : "",
            i < 2 ? "border-b border-border lg:border-b-0" : "",
            i === 1 ? "lg:border-r" : "",
            i === 2 ? "lg:border-r" : "",
          ].join(" ")}
        >
          <p className="text-sm text-muted">{it.label}</p>
          <p className="tnum mt-2 text-3xl font-semibold tracking-tight">
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}
