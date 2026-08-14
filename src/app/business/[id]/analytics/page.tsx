import { notFound } from "next/navigation";
import { getBusiness, getWebsite, getBlogPosts } from "@/lib/queries";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "애널리틱스" };

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [website, posts] = await Promise.all([
    getWebsite(id),
    getBlogPosts(id),
  ]);

  const published = posts.filter((p) => p.status === "published").length;

  const stats = [
    {
      label: "홈페이지 상태",
      value: website?.status === "published" ? "공개" : "비공개",
    },
    { label: "블로그 글", value: String(posts.length) },
    { label: "공개된 글", value: String(published) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-2">애널리틱스</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">지표</h1>
        <p className="mt-1.5 text-muted">기본 지표를 확인하세요.</p>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={i < 2 ? "border-b border-border p-6 sm:border-b-0 sm:border-r" : "p-6"}
          >
            <p className="text-sm text-muted">{s.label}</p>
            <p className="tnum mt-2 text-3xl font-semibold tracking-tight">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <Card className="flex items-start gap-4 border-dashed bg-surface">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted">
          <Icon.chart className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">홈페이지 조회수</p>
          <p className="mt-1 text-sm text-muted">
            방문자 통계는 곧 제공될 예정입니다. (Phase 2)
          </p>
        </div>
      </Card>
    </div>
  );
}
