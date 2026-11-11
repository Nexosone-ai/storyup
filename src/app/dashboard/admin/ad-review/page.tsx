import { adReviewSummary, listAdReviewPosts, type AdReviewStatus } from "@/lib/adReview";
import { AdminAdReviewView } from "@/components/admin/AdminAdReviewView";

export const metadata = { title: "관리자 · 광고 검수" };

const STATUSES: (AdReviewStatus | "all")[] = ["pending", "approved", "rejected", "all"];

/**
 * 광고 게재 검수(0113) — 공개 글 중 회사(STORYUP) 애드센스 광고를 실을 글을 사람이 검수한다.
 * 기본은 '대기(pending)' 목록. 승인된 글(과 승인 글이 있는 사이트의 홈·목록)에만 회사 광고가 나온다.
 */
export default async function AdminAdReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES as string[]).includes(sp.status ?? "")
    ? (sp.status as AdReviewStatus | "all")
    : "pending";
  const [rows, summary] = await Promise.all([listAdReviewPosts({ status }), adReviewSummary()]);
  return (
    <div className="mx-auto max-w-4xl">
      <AdminAdReviewView rows={rows} status={status} summary={summary} />
    </div>
  );
}
