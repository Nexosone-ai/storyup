import { notFound } from "next/navigation";
import { getBusiness, getBlogPost } from "@/lib/queries";
import { getCouponClaimsForOwner } from "@/lib/events";
import { CouponClaimsView } from "@/components/blog/CouponClaimsView";

export const metadata = { title: "쿠폰 수령자" };

export default async function CouponClaimsPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  const { id, postId } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const post = await getBlogPost(postId);
  if (!post || post.business_id !== id) notFound();

  const { event, claims } = await getCouponClaimsForOwner(postId);

  return (
    <CouponClaimsView
      businessId={id}
      postId={postId}
      benefit={event?.coupon_benefit ?? null}
      initialClaims={claims}
    />
  );
}
