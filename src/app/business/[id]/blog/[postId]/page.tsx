import { notFound } from "next/navigation";
import {
  getUser,
  getBusiness,
  getBlogPost,
  getWebsite,
  getManagedBlogCategories,
} from "@/lib/queries";
import {
  getBlogEventForOwner,
  getCouponClaimCount,
  getReservationCount,
} from "@/lib/events";
import { getUserPlan } from "@/lib/subscription";
import { imageRemaining } from "@/lib/ai/imageQuota";

import { BlogEditor } from "@/components/blog/BlogEditor";
import { EventEditor } from "@/components/blog/EventEditor";
import { BlogFaqEditor } from "@/components/blog/BlogFaqEditor";

export const metadata = { title: "블로그 편집" };

export default async function BlogEditorPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  const { id, postId } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [post, website, categories, event] = await Promise.all([
    getBlogPost(postId),
    getWebsite(id),
    getManagedBlogCategories(id),
    getBlogEventForOwner(postId),
  ]);
  if (!post || post.business_id !== id) notFound();

  const [couponClaimed, reservationCount] = await Promise.all([
    event?.coupon_enabled ? getCouponClaimCount(event.id) : Promise.resolve(0),
    event?.reservation_enabled
      ? getReservationCount(event.id)
      : Promise.resolve(0),
  ]);

  // 플랜별 기능 게이팅 — 쿠폰 발행(Basic+), 예약 발행(Pro+).
  const user = await getUser();
  const plan = user ? await getUserPlan(user.id) : null;
  const couponAllowed = plan?.couponBlock === true;
  const reservationAllowed = plan?.reservation === true;
  const schedulingAllowed = plan?.scheduledPublish === true;
  const aeoAllowed = plan?.aeo === true;
  const seoAllowed = plan?.seoTools === true;
  // 글 요약 이미지(1장)는 Pro 전용.
  const summaryImageAllowed = plan?.id === "pro";
  // AI 이미지 월 한도(Free 30 · Basic 60 · Pro 300) — 남은 장수 안내. Partner 는 무제한(null).
  const imagesLimit = plan?.limits.aiImages ?? null;
  const imagesRemaining =
    user && plan && imagesLimit !== null ? await imageRemaining(user.id, plan) : null;

  return (
    <div className="space-y-8">
      <BlogEditor
        businessId={id}
        post={post}
        siteSlug={website?.slug ?? null}
        sitePublished={website?.status === "published"}
        categories={categories}
        schedulingAllowed={schedulingAllowed}
        seoAllowed={seoAllowed}
        summaryImageAllowed={summaryImageAllowed}
        planId={plan?.id ?? "free"}
        imagesLimit={imagesLimit}
        imagesRemaining={imagesRemaining}
      />
      <EventEditor
        businessId={id}
        postId={postId}
        event={event}
        couponClaimed={couponClaimed}
        reservationCount={reservationCount}
        published={post.status === "published"}
        couponAllowed={couponAllowed}
        reservationAllowed={reservationAllowed}
      />
      <BlogFaqEditor
        businessId={id}
        postId={postId}
        initialFaq={post.faq ?? []}
        aeoAllowed={aeoAllowed}
      />
    </div>
  );
}
