import { notFound } from "next/navigation";
import {
  getBusiness,
  getBlogPost,
  getWebsite,
  getBlogCategories,
} from "@/lib/queries";
import { BlogEditor } from "@/components/blog/BlogEditor";

export const metadata = { title: "블로그 편집" };

export default async function BlogEditorPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  const { id, postId } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [post, website, categories] = await Promise.all([
    getBlogPost(postId),
    getWebsite(id),
    getBlogCategories(id),
  ]);
  if (!post || post.business_id !== id) notFound();

  return (
    <BlogEditor
      businessId={id}
      post={post}
      siteSlug={website?.slug ?? null}
      sitePublished={website?.status === "published"}
      categories={categories}
    />
  );
}
