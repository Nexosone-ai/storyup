"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { setAdReviewStatus, type AdReviewStatus } from "@/lib/adReview";

export interface AdReviewState {
  ok?: boolean;
  error?: string;
}

/** 관리자 — 글의 광고 게재 검수 상태 변경(승인/반려/대기). 공개 페이지 캐시도 갱신. */
export async function setAdReviewAction(
  postId: string,
  status: AdReviewStatus,
  note: string,
  publicPath?: string | null,
): Promise<AdReviewState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  if (status !== "pending" && status !== "approved" && status !== "rejected")
    return { error: "잘못된 상태입니다." };
  const user = await getUser();
  const res = await setAdReviewStatus(postId, status, note, user?.id ?? null);
  if (res.error) return res;
  revalidatePath("/dashboard/admin/ad-review");
  if (publicPath && publicPath.startsWith("/site/")) {
    revalidatePath(publicPath);
    // 사이트 홈·블로그 목록의 광고 노출 판정(승인 글 수)도 바뀐다.
    const siteRoot = publicPath.split("/blog/")[0];
    revalidatePath(siteRoot);
    revalidatePath(`${siteRoot}/blog`);
  }
  return { ok: true };
}
