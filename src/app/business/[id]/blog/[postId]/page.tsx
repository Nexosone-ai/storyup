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

  // 쿠폰 발행은 Basic 이상(plan.couponBlock)만 가능 — 문의·댓글 등 다른 모듈은 무관.
  const user = await getUser();
  const couponAllowed = user
    ? getPlanById(await getPlanId(user.id)).couponBlock === true
    : false;

  return (
    <div className="space-y-8">
      <BlogEditor
        businessId={id}
        post={post}
        siteSlug={website?.slug ?? null}
        sitePublished={website?.status === "published"}
        categories={categories}
      />
      <EventEditor
        businessId={id}
        postId={postId}
        event={event}
        couponClaimed={couponClaimed}
        published={post.status === "published"}
        couponAllowed={couponAllowed}
      />
    </div>
  );
}
