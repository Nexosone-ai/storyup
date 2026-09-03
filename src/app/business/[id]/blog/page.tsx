import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { BlogList } from "@/components/blog/BlogList";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { GuideCard } from "@/components/ui/GuideCard";

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
      <GuideCard
        storageKey="guide.blog.v1"
        title={ko ? "블로그, 이렇게 쓰는 거예요" : "How the blog works"}
        steps={[
          {
            title: ko ? "주제만 알려주세요" : "Tell us a topic",
            desc: ko
              ? "'새 글 쓰기'를 누르고 하고 싶은 이야기를 한 줄 적으면, AI가 글을 완성해드려요."
              : "Press 'New post' and write one line about what you want to say — AI writes the post for you.",
          },
          {
            title: ko ? "확인하고 '게시하기'를 누르세요" : "Review, then press Publish",
            desc: ko
              ? "내용을 읽어보고 마음에 들면 '게시하기'를 누르세요. 누르기 전에는 나만 볼 수 있어요."
              : "Read it over and press Publish when you like it. Until then, only you can see the draft.",
          },
          {
            title: ko
              ? "내 랜딩페이지에 자동으로 올라가요"
              : "It appears on your landing page automatically",
            desc: ko
              ? "게시한 글은 내 랜딩페이지의 '최신 글'과 블로그 메뉴에 바로 나타나요. 손님이 검색으로 찾아올 수 있게 됩니다."
              : "Published posts show up in your landing page's latest-posts section and blog menu, so customers can find you through search.",
          },
        ]}
      />
      <BlogList businessId={id} posts={posts} />
    </div>
  );
}
