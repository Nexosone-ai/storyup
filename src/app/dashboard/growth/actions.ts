"use server";

import { createClient } from "@/lib/supabase/server";
import { trackGrowthActivity, kstDate } from "@/lib/gamification/engine";
import { award } from "@/lib/gamification/engine";

/**
 * 게이미피케이션 서버 액션 — 반드시 로그인 사용자 본인 기준으로만 기록한다.
 * (클라이언트가 넘긴 사용자 ID는 절대 신뢰하지 않음)
 */

/** 대시보드에서 콘텐츠를 공유했을 때 — 하루 채널당 1회, 일일 상한은 규칙에서. */
export async function recordShareAction(channel: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const safeChannel = channel.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "etc";
  await trackGrowthActivity(user.id, "share", `${kstDate()}:${safeChannel}`);
}

/** 초대 링크 최초 복사 보상 (평생 1회 — 발송 자체는 검증 불가). */
export async function claimInviteRewardAction(): Promise<{ granted: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { granted: false };
  const res = await award(user.id, "ref_invite", "ref_invite");
  return { granted: res.granted };
}
