import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { BlogList } from "@/components/blog/BlogList";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";

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
  const ko = (await getLocale()) === "ko";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "블로그" : "Blog"}
        </h1>
        <ButtonLink href={`/business/${id}/blog/new`}>
          <Icon.plus width={18} height={18} />
          {ko ? "새 글 쓰기" : "New post"}
        </ButtonLink>
      </div>
      <WorkflowSteps businessId={id} current={3} />
      <BlogList businessId={id} posts={posts} />
    </div>
  );
}
