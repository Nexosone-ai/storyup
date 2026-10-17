import { notFound } from "next/navigation";
import { getUser, getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { AgentChat } from "@/components/agent/AgentChat";

export const metadata = { title: "AI 에이전트" };

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const business = await getBusiness(id);
  if (!business) notFound();

  const user = await getUser();
  const plan = getPlanById(user ? await getPlanId(user.id) : "free");

  if (!plan.aiAgent) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "AI 에이전트" : "AI agent"}
        </h1>
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-lg font-semibold">
            {ko
              ? "AI 에이전트는 Pro 플랜에서 사용할 수 있어요."
              : "The AI agent is available on the Pro plan."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "내 사업을 아는 AI와 대화하며 블로그·카드뉴스 생성, 예약 발행을 바로 맡길 수 있어요. 대화 내용과 알려주신 정보는 기억됩니다."
              : "Chat with an AI that knows your business — generate blogs, card news, and schedule publishing. It remembers what you tell it."}
          </p>
          <ButtonLink href="/dashboard/plans">
            {ko ? "Pro로 업그레이드" : "Upgrade to Pro"}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">{ko ? "AI 에이전트" : "AI agent"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? `${business.name} 담당 AI` : `${business.name}'s AI`}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "내 사업을 아는 AI와 대화하세요. 블로그·카드뉴스 생성과 예약 발행은 제안 후 승인하면 실행돼요."
            : "Chat with your business AI. Blog/card generation and scheduling run after you approve a proposal."}
        </p>
      </div>
      <AgentChat businessId={id} ko={ko} />
    </div>
  );
}
