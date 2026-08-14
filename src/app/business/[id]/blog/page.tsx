import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts } from "@/lib/queries";
import { BlogList } from "@/components/blog/BlogList";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "블로그" };

export default async function BlogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();
  const posts = await getBlogPosts(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">블로그</h1>
        <ButtonLink href={`/business/${id}/blog/new`}>
          <Icon.plus width={18} height={18} />새 글 쓰기
        </ButtonLink>
      </div>
      <BlogList businessId={id} posts={posts} />
    </div>
  );
}
