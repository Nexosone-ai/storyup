import { notFound } from "next/navigation";
import {
  getBusiness,
  getBlogPost,
  getWebsite,
  getBlogCategories,
} from "@/lib/queries";
import { getBlogEventForOwner, getCouponClaimCount } from "@/lib/events";
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
      />
    </div>
  );
}
