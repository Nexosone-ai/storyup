import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import {
  transcribeAudio,
  normalizeAudioMime,
  VOICE_MAX_BYTES,
} from "@/lib/ai/stt";
import { createBlogDraft } from "@/lib/blogDraft";
import { getLocale } from "@/lib/i18n";
import { BLOG_TONES, BLOG_LENGTHS } from "@/types/domain";
import type { BlogTone, BlogLength } from "@/types/domain";

export const maxDuration = 60;

const VOICE_BUCKET = "voice-notes";

/**
 * 음성 녹음 → 블로그 글 생성.
 * 오디오는 클라이언트가 서명 URL로 voice-notes 버킷에 직접 올린 뒤
 * storagePath만 전달한다 (Vercel 요청 본문 4.5MB 한도 회피).
 * 전사(Gemini)는 과금 전에 수행 — 전사 실패 시 포인트 차감 없음.
 */
export async function POST(request: Request) {
  const locale = await getLocale();
  const ko = locale === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: ko ? "로그인이 필요합니다." : "Please log in." },
      { status: 401 },
    );

  let businessId = "";
  let storagePath = "";
  let rawMime = "";
  let tone: BlogTone = "Friendly";
  let length: BlogLength = "Medium";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    storagePath = String(body.storagePath ?? "");
    rawMime = String(body.mimeType ?? "");
    if (BLOG_TONES.includes(body.tone)) tone = body.tone;
    if (BLOG_LENGTHS.includes(body.length)) length = body.length;
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  // 경로는 반드시 본인 비즈니스 폴더 안이어야 한다.
  if (
    !storagePath ||
    !storagePath.startsWith(`${businessId}/`) ||
    storagePath.includes("..")
  )
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );

  const mimeType = normalizeAudioMime(rawMime);
  if (!mimeType)
    return NextResponse.json(
      {
        error: ko
          ? "지원하지 않는 오디오 형식입니다. (m4a/mp3/wav/webm 지원)"
          : "Unsupported audio format. (m4a/mp3/wav/webm supported)",
      },
      { status: 400 },
    );

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
      { status: 404 },
    );

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  const admin = createAdminClient();

  // 전사까지 마치면 오디오는 더 필요 없다 — 성공/실패와 무관하게 지운다.
  let transcript: string;
  try {
    const { data: blob, error: dlErr } = await admin.storage
      .from(VOICE_BUCKET)
      .download(storagePath);
    if (dlErr || !blob)
      return NextResponse.json(
        {
          error: ko
            ? "녹음 파일을 찾을 수 없습니다. 다시 업로드해주세요."
            : "Recording not found. Please upload again.",
        },
        { status: 400 },
      );
    if (blob.size > VOICE_MAX_BYTES)
      return NextResponse.json(
        {
          error: ko
            ? "녹음 파일은 20MB 이하여야 합니다."
            : "Recordings must be 20MB or smaller.",
        },
        { status: 400 },
      );

    const buf = Buffer.from(await blob.arrayBuffer());
    transcript = await transcribeAudio(buf, mimeType);
  } catch (err) {
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "음성 변환 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while transcribing. Please try again.";
    console.error("[ai/blog-voice] transcribe", err);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    admin.storage
      .from(VOICE_BUCKET)
      .remove([storagePath])
      .catch(() => {});
  }

  if (transcript.length < 20)
    return NextResponse.json(
      {
        error: ko
          ? "녹음에서 내용을 알아듣지 못했습니다. 조금 더 길고 또렷하게 말씀해주세요."
          : "We couldn't make out the recording. Please speak a bit longer and more clearly.",
      },
      { status: 400 },
    );

  let billing;
  try {
    billing = await chargeAiUsage(user.id, "AI_BLOG", "음성 블로그 생성");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    const article = await getAIProvider().generateBlogFromTranscript({
      businessName: business.name,
      category: business.category,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      transcript,
      tone,
      length,
      language: locale,
    });

    const postId = await createBlogDraft({
      supabase,
      userId: user.id,
      businessId,
      category: business.category,
      article,
    });

    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    await billing.refund();
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "글 생성 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while writing the post. Please try again.";
    console.error("[ai/blog-voice]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
