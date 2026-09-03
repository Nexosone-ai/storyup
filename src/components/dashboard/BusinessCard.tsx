import Link from "next/link";
import { Badge } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n";
import { BusinessCardMenu } from "./BusinessCardMenu";
import type { DashboardBusiness } from "@/lib/queries";

function timeAgo(iso: string, ko: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return ko ? "방금 전" : "just now";
  if (min < 60) return ko ? `${min}분 전` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return ko ? `${hr}시간 전` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return ko ? `${day}일 전` : `${day}d ago`;
}

export async function BusinessCard({
  business,
}: {
  business: DashboardBusiness;
}) {
  const ko = (await getLocale()) === "ko";
  return (
    <Link
      href={`/business/${business.id}`}
      className="group block rounded-2xl border border-border bg-surface p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold uppercase tracking-tight">
            {business.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{business.category}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {business.websiteStatus === "published" ? (
            <Badge tone="success">
              <span className="size-1.5 rounded-full bg-primary" />
              {ko ? "공개됨" : "Published"}
            </Badge>
          ) : business.websiteStatus === "draft" ? (
            <Badge tone="muted">{ko ? "초안" : "Draft"}</Badge>
          ) : (
            <Badge tone="muted">{ko ? "준비 중" : "Coming soon"}</Badge>
          )}
          <BusinessCardMenu
            businessId={business.id}
            name={business.name}
            category={business.category}
          />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted">{ko ? "랜딩페이지" : "Landing page"}</dt>
          <dd className="mt-0.5 font-medium">
            {business.websiteStatus === "published"
              ? ko
                ? "공개"
                : "Live"
              : business.websiteStatus === "draft"
                ? ko
                  ? "초안"
                  : "Draft"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{ko ? "블로그" : "Blog"}</dt>
          <dd className="tnum mt-0.5 font-medium">
            {ko
              ? `${business.blogCount}개`
              : `${business.blogCount} post${business.blogCount === 1 ? "" : "s"}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{ko ? "업데이트" : "Updated"}</dt>
          <dd className="mt-0.5 font-medium">
            {timeAgo(business.updated_at, ko)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        {ko ? "워크스페이스 열기" : "Open workspace"}
        <Icon.arrowLeft className="size-4 rotate-180" />
      </div>
    </Link>
  );
}
