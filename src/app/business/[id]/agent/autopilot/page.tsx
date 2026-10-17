import { notFound } from "next/navigation";
import { getUser, getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getFacebookStatus } from "@/lib/social/facebook";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import {
  AutopilotSettings,
  type RoutineRow,
  type LogRow,
  type ProposalRow,
} from "@/components/agent/AutopilotSettings";

export const metadata = { title: "AI 오토파일럿" };

export default async function AutopilotPage({
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
          {ko ? "AI 오토파일럿" : "AI autopilot"}
        </h1>
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-lg font-semibold">
            {ko
              ? "오토파일럿은 대행 파트너 전용 기능이에요."
              : "Autopilot is available to partners only."}
          </p>
          <ButtonLink href="/dashboard">
            {ko ? "대시보드로" : "Back to dashboard"}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [routinesRes, logsRes, proposalsRes, fb] = await Promise.all([
    supabase
      .from("agent_routines")
      .select("*")
      .eq("business_id", id)
      .order("kind", { ascending: true }),
    supabase
      .from("agent_run_logs")
      .select("id, action, status, detail, created_at")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_proposals")
      .select("id, action, params")
      .eq("business_id", id)
      .eq("status", "pending")
      .is("conversation_id", null)
      .order("created_at", { ascending: false })
      .limit(20),
    getFacebookStatus(id),
  ]);

  const routines = (routinesRes.data ?? []) as unknown as RoutineRow[];
  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const proposals = (proposalsRes.data ?? []) as unknown as ProposalRow[];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">{ko ? "AI 오토파일럿" : "AI autopilot"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "자동 마케팅 루틴" : "Autonomous marketing routines"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "정해진 주기로 블로그·카드뉴스·SNS 게시를 자동으로 준비해요. 기본은 '제안'이며, '자동 실행'은 하루·월 한도 안에서만 동작합니다. 언제든 끌 수 있어요."
            : "Prepares blog/card/social posts on a schedule. Defaults to proposals; 'auto' runs only within daily/monthly caps. Turn off anytime."}
        </p>
      </div>
      <AutopilotSettings
        businessId={id}
        routines={routines}
        logs={logs}
        proposals={proposals}
        fbConnected={fb.connected}
      />
    </div>
  );
}
