import type Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/types/database";
import type { DB } from "./store";
import { createProposal } from "./store";
import { saveMemory } from "./memory";
import { getFacebookStatus } from "@/lib/social/facebook";

/**
 * AI 에이전트 도구 — 읽기 도구는 즉시 실행, 비용/외부 작업은 proposal을 만들어
 * 사용자 승인 후에만 실행한다. 모든 핸들러는 소유자 세션(RLS)으로만 동작한다.
 */

export interface ToolCtx {
  supabase: DB;
  userId: string;
  businessId: string;
  conversationId: string;
  ko: boolean;
}

export interface ProposalOut {
  id: string;
  action: string;
  summary: string;
  params: Record<string, unknown>;
}

export interface ToolOutcome {
  result: string; // 모델에 돌려줄 tool_result 텍스트
  proposal?: ProposalOut;
}

const BLOG_TONE_ENUM = [
  "Friendly",
  "Professional",
  "Informative",
  "Storytelling",
  "Promotional",
];
const BLOG_LENGTH_ENUM = ["Short", "Medium", "Long"];

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_brand_info",
    description:
      "이 사업체의 브랜드 스토리·업종·강점·타깃 고객 등 기본 정보를 조회한다. 글/카드 제안 전에 맥락이 필요하면 사용.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_content",
    description:
      "이 사업체의 최근 블로그 글(제목·상태·ID)과 카드뉴스 보유 현황을 조회한다. 카드뉴스 생성·예약 발행 대상 글의 ID가 필요할 때 사용.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "가져올 글 수(기본 10, 최대 20)" },
      },
    },
  },
  {
    name: "save_memory",
    description:
      "사용자가 알려준 사업/고객/마케팅 관련 사실을 장기 기억에 저장한다. 다음 대화에서도 기억된다. 사용자가 명시적으로 알려준 중요한 사실에만 사용.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "기억할 사실(한 문장)" },
      },
      required: ["content"],
    },
  },
  {
    name: "generate_blog_draft",
    description:
      "블로그 초안 생성을 '제안'한다(바로 생성하지 않음). 사용자가 승인하면 초안이 만들어진다. 비용(쿼터)이 드는 작업이라 반드시 이 도구로 제안만 한다.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "글 주제/요청 내용" },
        tone: { type: "string", enum: BLOG_TONE_ENUM },
        length: { type: "string", enum: BLOG_LENGTH_ENUM },
      },
      required: ["topic"],
    },
  },
  {
    name: "generate_cardnews",
    description:
      "기존 블로그 글로 인스타그램 카드뉴스 생성을 '제안'한다(바로 생성하지 않음). blog_post_id는 list_content로 확인. 사용자 승인 후 생성된다.",
    input_schema: {
      type: "object",
      properties: {
        blog_post_id: { type: "string", description: "대상 블로그 글 ID" },
      },
      required: ["blog_post_id"],
    },
  },
  {
    name: "schedule_publish",
    description:
      "블로그 글의 예약 발행을 '제안'한다(바로 예약하지 않음). 사용자 승인 후 예약된다. scheduled_at은 미래 ISO8601.",
    input_schema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "대상 블로그 글 ID" },
        scheduled_at: {
          type: "string",
          description: "예약 발행 시각(ISO8601, 미래)",
        },
      },
      required: ["post_id", "scheduled_at"],
    },
  },
  {
    name: "publish_facebook",
    description:
      "연결된 Facebook 페이지에 게시물 게시를 '제안'한다(바로 게시하지 않음). 페이지가 연결돼 있어야 하며, 사용자 승인 후 게시된다. message는 한국어 게시 문구, link는 선택(블로그/사이트 URL).",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "게시 문구(한국어)" },
        link: { type: "string", description: "선택: 함께 공유할 URL" },
      },
      required: ["message"],
    },
  },
];

type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function runTool(
  name: string,
  input: Input,
  ctx: ToolCtx,
): Promise<ToolOutcome> {
  const { supabase, businessId } = ctx;

  switch (name) {
    case "get_brand_info": {
      const { data: biz } = await supabase
        .from("businesses")
        .select(
          "name, category, description, founder_story, target_customer, strengths, tone",
        )
        .eq("id", businessId)
        .maybeSingle();
      if (!biz) return { result: "사업체 정보를 찾을 수 없습니다." };
      const { data: brand } = await supabase
        .from("brand_profiles")
        .select(
          "brand_story, mission, slogan, short_description, key_strengths, brand_keywords, tone",
        )
        .eq("business_id", businessId)
        .maybeSingle();
      return { result: JSON.stringify({ business: biz, brand: brand ?? null }) };
    }

    case "list_content": {
      const limit = Math.min(
        20,
        Math.max(1, Number((input.limit as number) ?? 10)),
      );
      const { data: posts } = await supabase
        .from("blog_posts")
        .select("id, title, status, created_at")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      const { count: cardCount } = await supabase
        .from("marketing_contents")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("platform", "instagram_cards");
      return {
        result: JSON.stringify({
          posts: posts ?? [],
          cardNewsCount: cardCount ?? 0,
        }),
      };
    }

    case "save_memory": {
      const content = str(input.content).trim();
      if (!content) return { result: "저장할 내용이 비어 있습니다." };
      await saveMemory(supabase, businessId, content);
      return { result: "기억했어요." };
    }

    case "generate_blog_draft": {
      const topic = str(input.topic).trim();
      if (!topic) return { result: "주제가 필요합니다." };
      const params = {
        topic,
        tone: BLOG_TONE_ENUM.includes(str(input.tone)) ? str(input.tone) : "Friendly",
        length: BLOG_LENGTH_ENUM.includes(str(input.length))
          ? str(input.length)
          : "Medium",
      };
      const id = await createProposal(supabase, {
        conversationId: ctx.conversationId,
        businessId,
        action: "generate_blog_draft",
        params: params as unknown as Json,
      });
      if (!id) return { result: "제안 생성에 실패했습니다." };
      return {
        result:
          "블로그 초안 생성을 제안했습니다. 사용자가 승인하면 초안이 만들어집니다(승인 대기).",
        proposal: {
          id,
          action: "generate_blog_draft",
          summary: `블로그 초안: "${topic}"`,
          params,
        },
      };
    }

    case "generate_cardnews": {
      const blogPostId = str(input.blog_post_id).trim();
      if (!blogPostId) return { result: "blog_post_id가 필요합니다." };
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, title")
        .eq("id", blogPostId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!post) return { result: "해당 블로그 글을 찾을 수 없습니다." };
      const id = await createProposal(supabase, {
        conversationId: ctx.conversationId,
        businessId,
        action: "generate_cardnews",
        params: { blogPostId } as unknown as Json,
      });
      if (!id) return { result: "제안 생성에 실패했습니다." };
      return {
        result: "카드뉴스 생성을 제안했습니다(승인 대기).",
        proposal: {
          id,
          action: "generate_cardnews",
          summary: `카드뉴스: "${post.title}"`,
          params: { blogPostId },
        },
      };
    }

    case "schedule_publish": {
      const postId = str(input.post_id).trim();
      const scheduledAt = str(input.scheduled_at).trim();
      if (!postId || !scheduledAt)
        return { result: "post_id와 scheduled_at(ISO)이 필요합니다." };
      const t = new Date(scheduledAt);
      if (Number.isNaN(t.getTime()) || t.getTime() < Date.now() + 60_000)
        return { result: "예약 시각은 현재보다 1분 이후의 올바른 시각이어야 합니다." };
      const { data: post } = await supabase
        .from("blog_posts")
        .select("id, title")
        .eq("id", postId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!post) return { result: "해당 블로그 글을 찾을 수 없습니다." };
      const id = await createProposal(supabase, {
        conversationId: ctx.conversationId,
        businessId,
        action: "schedule_publish",
        params: { postId, scheduledAt: t.toISOString() } as unknown as Json,
      });
      if (!id) return { result: "제안 생성에 실패했습니다." };
      return {
        result: "예약 발행을 제안했습니다(승인 대기).",
        proposal: {
          id,
          action: "schedule_publish",
          summary: `예약 발행: "${post.title}" → ${t.toLocaleString("ko-KR")}`,
          params: { postId, scheduledAt: t.toISOString() },
        },
      };
    }

    case "publish_facebook": {
      const message = str(input.message).trim();
      if (!message) return { result: "게시 문구가 필요합니다." };
      const status = await getFacebookStatus(businessId);
      if (!status.configured)
        return {
          result:
            "Facebook 게시가 아직 설정되지 않았습니다(관리자 설정 필요). 게시를 제안하지 마세요.",
        };
      if (!status.connected)
        return {
          result:
            "연결된 Facebook 페이지가 없습니다. 사용자에게 먼저 페이지 연결을 안내하세요.",
        };
      const link = str(input.link).trim();
      const params = { message, link: link || null };
      const id = await createProposal(supabase, {
        conversationId: ctx.conversationId,
        businessId,
        action: "publish_facebook",
        params: params as unknown as Json,
      });
      if (!id) return { result: "제안 생성에 실패했습니다." };
      return {
        result: "Facebook 페이지 게시를 제안했습니다(승인 대기).",
        proposal: {
          id,
          action: "publish_facebook",
          summary: `Facebook 게시: "${message.slice(0, 40)}${message.length > 40 ? "…" : ""}"`,
          params: { message, link: link || undefined },
        },
      };
    }

    default:
      return { result: `알 수 없는 도구: ${name}` };
  }
}
