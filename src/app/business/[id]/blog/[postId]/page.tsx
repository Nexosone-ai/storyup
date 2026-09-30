import { notFound } from "next/navigation";
import {
  getUser,
  getBusiness,
  getBlogPost,
  getWebsite,
  getBlogCategories,
} from "@/lib/queries";
import { getBlogEventForOwner, getCouponClaimCount } from "@/lib/events";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
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
    getBlogCategories(id),
    getBlogEventForOwner(postId),
  ]);
  if (!post || post.business_id !== id) notFound();

  const couponClaimed = event?.coupon_enabled
    ? await getCouponClaimCount(event.id)
    : 0;

  // 플랜별 기능 게이팅 — 쿠폰 발행(Basic+), 예약 발행(Pro+).
  const user = await getUser();
  const plan = user ? getPlanById(await getPlanId(user.id)) : null;
  const couponAllowed = plan?.couponBlock === true;
  const schedulingAllowed = plan?.scheduledPublish === true;
  const aeoAllowed = plan?.aeo === true;

  return (
    <div className="space-y-8">
      <BlogEditor
        businessId={id}
        post={post}
        siteSlug={website?.slug ?? null}
        sitePublished={website?.status === "published"}
        categories={categories}
        schedulingAllowed={schedulingAllowed}
      />
      <EventEditor
        businessId={id}
        postId={postId}
        event={event}
        couponClaimed={couponClaimed}
        published={post.status === "published"}
        couponAllowed={couponAllowed}
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
