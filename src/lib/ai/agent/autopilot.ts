import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/server";
import { generateAndSaveBlog } from "@/lib/ai/generateBlog";
import { generateAndSaveCardNews } from "@/lib/ai/generateCardNews";
import { postToFacebook, getFacebookStatus } from "@/lib/social/facebook";
import {
  partnerForClient,
  chargePartnerCredits,
  InsufficientCreditsError,
  CreditChargeError,
  type CreditCharge,
} from "@/lib/partner";
import { loadCombinedSources } from "@/lib/ai/agent/sources";
import type { BlogTone, BlogLength } from "@/types/domain";

/** 루틴 종류 → 파트너 크레딧 단가 키(facebook 게시는 무차감). */
const ROUTINE_CREDIT: Record<string, string | undefined> = {
  blog: "BLOG_BASIC",
  cardnews: "CARDNEWS_FULL",
};

/**
 * AI 오토파일럿 — enabled 루틴 중 next_run_at이 지난 것을 선점(claim)해 실행한다.
 * autonomy='auto'면 한도(하루·월) 내에서 생성/게시까지, 'propose'면 agent_proposals로
 * 제안만 쌓는다. 모든 처리는 agent_run_logs에 기록(감사). 크론에서 호출.
 */

type Admin = SupabaseClient<Database>;
type Routine = Database["public"]["Tables"]["agent_routines"]["Row"];

const GLOBAL_MAX = 25;

function cadenceMs(c: string): number {
  const day = 86_400_000;
  switch (c) {
    case "daily":
      return day;
    case "biweekly":
      return 14 * day;
    case "monthly":
      return 30 * day;
    default:
      return 7 * day; // weekly
  }
}

function seoulHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(d),
  );
}

function inQuiet(start: number | null, end: number | null, h: number): boolean {
  if (start == null || end == null || start === end) return false;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

function seoulDayStartIso(): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${ymd}T00:00:00+09:00`;
}

function seoulMonthStartIso(): string {
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return `${ym}-01T00:00:00+09:00`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

async function log(
  admin: Admin,
  r: Routine,
  status: string,
  note: string,
  detail?: Json,
): Promise<void> {
  await admin.from("agent_run_logs").insert({
    business_id: r.business_id,
    routine_id: r.id,
    action: r.kind,
    status,
    detail: (detail ?? { note }) as Json,
  });
}

async function countDone(
  admin: Admin,
  routineId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await admin
    .from("agent_run_logs")
    .select("id", { count: "exact", head: true })
    .eq("routine_id", routineId)
    .eq("status", "done")
    .gte("created_at", sinceIso);
  return count ?? 0;
}

async function latestPublishedPost(
  admin: Admin,
  businessId: string,
): Promise<{ id: string; title: string } | null> {
  const { data } = await admin
    .from("blog_posts")
    .select("id, title")
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** 소재 중복 회피용 — 최근 글 제목 몇 개. */
async function recentTitles(admin: Admin, businessId: string): Promise<string[]> {
  const { data } = await admin
    .from("blog_posts")
    .select("title")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((r) => r.title).filter(Boolean);
}

/** auto 모드 실제 실행. 성공 시 detail 반환, 실패 시 throw. */
async function executeRoutine(
  admin: Admin,
  r: Routine,
  ownerId: string,
  bizName: string,
): Promise<Json> {
  const params = (r.params ?? {}) as Record<string, unknown>;

  if (r.kind === "blog") {
    // 글감 소스(URL/PDF)가 있으면 그 자료에 근거해 생성(지어내기 금지). 비어 있으면 주제 힌트로.
    const [{ text: source }, avoid] = await Promise.all([
      loadCombinedSources(admin, r.business_id),
      recentTitles(admin, r.business_id),
    ]);
    // 소스가 있으면 주제는 비워 AI가 자료에서 글감을 추리게 한다(힌트가 있으면 방향만).
    const topic = source
      ? str(params.topic)
      : str(params.topic) || `${bizName} 이번 주 소식과 팁`;
    const { postId, title } = await generateAndSaveBlog({
      supabase: admin,
      userId: ownerId,
      businessId: r.business_id,
      topic,
      tone: (str(params.tone) || "Friendly") as BlogTone,
      length: (str(params.length) || "Medium") as BlogLength,
      locale: "ko",
      skipBilling: true, // 파트너 크레딧으로 과금
      source: source || undefined,
      avoidTitles: avoid,
    });

    if (r.autonomy === "review") {
      // 검토 모드: 바로 발행하지 않고 검토 창(review_hours) 뒤로 예약. 그 사이 파트너가
      // 초안을 보고 수정·지금발행·보류할 수 있다. 예약시각이 되면 /api/cron/publish가 발행.
      const hours = Math.max(1, Math.min(168, r.review_hours ?? 24));
      const scheduledAt = new Date(Date.now() + hours * 3_600_000).toISOString();
      await admin
        .from("blog_posts")
        .update({
          status: "draft",
          scheduled_at: scheduledAt,
          autopilot_routine_id: r.id,
        })
        .eq("id", postId)
        .eq("business_id", r.business_id);
      return { postId, title, scheduledReview: true, scheduledAt } as Json;
    }

    // auto 모드: 생성 후 바로 발행.
    await admin
      .from("blog_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        scheduled_at: null,
      })
      .eq("id", postId)
      .eq("business_id", r.business_id);
    return { postId, title, published: true } as Json;
  }

  if (r.kind === "cardnews") {
    const post = await latestPublishedPost(admin, r.business_id);
    if (!post) throw new Error("no_published_post");
    const { cardNewsId } = await generateAndSaveCardNews({
      supabase: admin,
      userId: ownerId,
      businessId: r.business_id,
      blogPostId: post.id,
      locale: "ko",
      skipBilling: true, // 파트너 크레딧으로 과금
    });
    return { cardNewsId, from: post.id } as Json;
  }

  // facebook
  const status = await getFacebookStatus(r.business_id);
  if (!status.connected) throw new Error("facebook_not_connected");
  const post = await latestPublishedPost(admin, r.business_id);
  const message =
    str(params.message) ||
    (post ? `${bizName} 새 소식 — ${post.title}` : `${bizName}의 새 소식을 확인하세요!`);
  const posted = await postToFacebook(r.business_id, { message });
  await admin.from("social_posts").insert({
    business_id: r.business_id,
    provider: "facebook_page",
    status: "posted",
    message,
    external_post_id: posted.postId,
    posted_at: new Date().toISOString(),
    source: "autopilot",
  });
  return { facebookPostId: posted.postId } as Json;
}

/** propose 모드: agent_proposals(대화 없이)로 제안만 쌓는다. */
async function proposeRoutine(admin: Admin, r: Routine, bizName: string): Promise<void> {
  const params = (r.params ?? {}) as Record<string, unknown>;
  let action = "";
  let pparams: Record<string, unknown> = {};

  if (r.kind === "blog") {
    action = "generate_blog_draft";
    pparams = {
      topic: str(params.topic) || `${bizName} 이번 주 소식과 팁`,
      tone: str(params.tone) || "Friendly",
      length: str(params.length) || "Medium",
    };
  } else if (r.kind === "cardnews") {
    const post = await latestPublishedPost(admin, r.business_id);
    if (!post) throw new Error("no_published_post");
    action = "generate_cardnews";
    pparams = { blogPostId: post.id };
  } else {
    const status = await getFacebookStatus(r.business_id);
    if (!status.connected) throw new Error("facebook_not_connected");
    const post = await latestPublishedPost(admin, r.business_id);
    action = "publish_facebook";
    pparams = {
      message:
        str(params.message) ||
        (post ? `${bizName} 새 소식 — ${post.title}` : `${bizName}의 새 소식!`),
      link: null,
    };
  }

  await admin.from("agent_proposals").insert({
    conversation_id: null,
    business_id: r.business_id,
    action,
    params: pparams as Json,
    status: "pending",
  });
}

export interface AutopilotSummary {
  checked: number;
  executed: number;
  proposed: number;
  skipped: number;
}

/** due 루틴 실행. 크론에서 호출(서비스롤). */
export async function runDueRoutines(now = new Date()): Promise<AutopilotSummary> {
  const admin = createAdminClient();
  const nowIso = now.toISOString();
  const { data } = await admin
    .from("agent_routines")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(GLOBAL_MAX);

  const routines = data ?? [];
  let executed = 0,
    proposed = 0,
    skipped = 0;

  for (const r of routines) {
    // 선점(claim): next_run_at을 다음 주기로 밀어 동시/중복 실행 방지.
    const nextIso = new Date(now.getTime() + cadenceMs(r.cadence)).toISOString();
    const { data: claimed } = await admin
      .from("agent_routines")
      .update({ next_run_at: nextIso, last_run_at: nowIso, updated_at: nowIso })
      .eq("id", r.id)
      .eq("next_run_at", r.next_run_at)
      .select("id")
      .maybeSingle();
    if (!claimed) {
      skipped++;
      continue;
    }

    const { data: biz } = await admin
      .from("businesses")
      .select("user_id, name")
      .eq("id", r.business_id)
      .maybeSingle();
    if (!biz) {
      await log(admin, r, "skip", "no_business");
      skipped++;
      continue;
    }
    const ownerId = biz.user_id;

    // 대행 파트너 게이트 — 배정된 파트너가 있어야 동작(없으면 중단).
    const partnerId = await partnerForClient(ownerId);
    if (!partnerId) {
      await log(admin, r, "skip", "no_partner");
      skipped++;
      continue;
    }

    // 조용한 시간: 한 시간 뒤 재시도로 미룸.
    if (inQuiet(r.quiet_start, r.quiet_end, seoulHour(now))) {
      await admin
        .from("agent_routines")
        .update({ next_run_at: new Date(now.getTime() + 3_600_000).toISOString() })
        .eq("id", r.id);
      await log(admin, r, "skip", "quiet_hours");
      skipped++;
      continue;
    }

    try {
      // 'review'(검토 후 예약발행)도 실제 생성·과금이 일어나므로 auto와 같은 경로로 처리한다.
      if (r.autonomy === "auto" || r.autonomy === "review") {
        if ((await countDone(admin, r.id, seoulDayStartIso())) >= r.max_per_day) {
          await log(admin, r, "skip", "max_per_day");
          skipped++;
          continue;
        }
        if (
          r.monthly_cap > 0 &&
          (await countDone(admin, r.id, seoulMonthStartIso())) >= r.monthly_cap
        ) {
          await log(admin, r, "skip", "monthly_cap");
          skipped++;
          continue;
        }
        // 파트너 패킷(크레딧) 선차감 — 부족하면 실행 중단.
        const creditAction = ROUTINE_CREDIT[r.kind];
        let charge: CreditCharge | null = null;
        if (creditAction) {
          try {
            charge = await chargePartnerCredits(
              partnerId,
              creditAction,
              r.business_id,
            );
          } catch (e) {
            if (e instanceof InsufficientCreditsError) {
              await log(admin, r, "skip", "no_credits");
              skipped++;
              continue;
            }
            if (e instanceof CreditChargeError) {
              // 과금 불가 → 무상 진행 금지(차단).
              await log(admin, r, "skip", "charge_error");
              skipped++;
              continue;
            }
            throw e;
          }
        }
        try {
          const detail = await executeRoutine(admin, r, ownerId, biz.name);
          await log(admin, r, "done", "auto", detail);
          executed++;
        } catch (e) {
          if (charge) await charge.refund();
          throw e;
        }
      } else {
        await proposeRoutine(admin, r, biz.name);
        await log(admin, r, "proposed", "propose");
        proposed++;
      }
    } catch (e) {
      await log(admin, r, "failed", String((e as Error)?.message ?? e).slice(0, 200));
      skipped++;
    }
  }

  return { checked: routines.length, executed, proposed, skipped };
}
