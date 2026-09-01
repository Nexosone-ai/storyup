import Link from "next/link";
import { Badge } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { BusinessCardMenu } from "./BusinessCardMenu";
import type { DashboardBusiness } from "@/lib/queries";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export function BusinessCard({ business }: { business: DashboardBusiness }) {
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
        <div className="flex items-center gap-1.5">
          {business.websiteStatus === "published" ? (
            <Badge tone="success">
              <span className="size-1.5 rounded-full bg-primary" />
              공개됨
            </Badge>
          ) : business.websiteStatus === "draft" ? (
            <Badge tone="muted">초안</Badge>
          ) : (
            <Badge tone="muted">준비 중</Badge>
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
          <dt className="text-xs text-muted">홈페이지</dt>
          <dd className="mt-0.5 font-medium">
            {business.websiteStatus === "published"
              ? "공개"
              : business.websiteStatus === "draft"
                ? "초안"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">블로그</dt>
          <dd className="tnum mt-0.5 font-medium">{business.blogCount}개</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">업데이트</dt>
          <dd className="mt-0.5 font-medium">{timeAgo(business.updated_at)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        워크스페이스 열기
        <Icon.arrowLeft className="size-4 rotate-180" />
      </div>
    </Link>
  );
}
