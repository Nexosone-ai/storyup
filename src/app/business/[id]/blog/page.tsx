import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { BlogList } from "@/components/blog/BlogList";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { GuidedTour } from "@/components/ui/GuidedTour";

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
        <ButtonLink href={`/business/${id}/blog/new`} data-tour="blog-new">
          <Icon.plus width={18} height={18} />
          {ko ? "새 글 쓰기" : "New post"}
        </ButtonLink>
      </div>
      <div data-tour="blog-workflow">
        <WorkflowSteps businessId={id} current={3} />
      </div>
      <GuidedTour
        storageKey="tour.blog.v1"
        autoStart={posts.length === 0}
        steps={[
          {
            target: "[data-tour=blog-new]",
            title: ko ? "블로그는 여기서 시작해요" : "The blog starts here",
            desc: ko
              ? "'새 글 쓰기'를 누르고 하고 싶은 이야기를 한 줄만 적으면, AI가 글을 완성해드려요."
              : "Press 'New post' and write one line about your topic — AI writes the post for you.",
          },
          {
            target: "[data-tour=blog-list]",
            title: ko ? "쓴 글은 여기 모여요" : "Your posts live here",
            desc: ko
              ? "글을 열어 '게시하기'를 눌러야 공개돼요. 게시하면 내 랜딩페이지의 '최신 글'과 블로그에 자동으로 올라가서 손님이 검색으로 찾아올 수 있어요."
              : "Open a post and press Publish to make it public. Published posts appear on your landing page automatically, so customers can find you through search.",
          },
          {
            target: "[data-tour=blog-workflow]",
            title: ko
              ? "다음 할 일은 이 줄이 알려줘요"
              : "This strip shows your next step",
            desc: ko
              ? "브랜드 → 랜딩페이지 → 블로그 → SNS 순서예요. 글을 게시했다면 다음은 SNS 콘텐츠 만들기!"
              : "Brand → Landing page → Blog → SNS. Once a post is published, the next step is SNS content!",
          },
        ]}
      />
      <div data-tour="blog-list">
        <BlogList businessId={id} posts={posts} />
      </div>
    </div>
  );
}
