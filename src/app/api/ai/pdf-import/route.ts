import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { getLocale } from "@/lib/i18n";
import {
  extractJpegCandidates,
  normalizePhotos,
  PDF_MAX_BYTES,
  type PdfImportResult,
} from "@/lib/pdfImport";

export const maxDuration = 60;

const IMAGE_BUCKET = "site-images";
const MAX_PHOTOS = 6;

/**
 * PDF(회사 소개서·브로슈어)를 받아 텍스트 콘텐츠는 AI로, 사진은 바이트
 * 추출로 뽑아 랜딩페이지 에디터에 채울 데이터를 돌려준다.
 * 사진은 스토리지에 복사되므로 반환 URL을 그대로 사이트에 써도 된다.
 */
export async function POST(request: Request): Promise<NextResponse<PdfImportResult>> {
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

  let businessId: string;
  let file: File;
  try {
    const form = await request.formData();
    businessId = String(form.get("businessId") ?? "");
    const f = form.get("file");
    if (!(f instanceof File)) throw new Error("no file");
    file = f;
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  // Ownership check via RLS.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return NextResponse.json(
      { error: ko ? "권한이 없습니다." : "You don't have permission." },
      { status: 403 },
    );

  if (file.size > PDF_MAX_BYTES)
    return NextResponse.json(
      {
        error: ko
          ? "PDF가 너무 큽니다. 10MB 이하 파일을 올려주세요."
          : "The PDF is too large. Please upload a file under 10MB.",
      },
      { status: 413 },
    );

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-")
    return NextResponse.json(
      {
        error: ko
          ? "PDF 파일이 아닙니다. PDF 형식의 소개서를 올려주세요."
          : "That's not a PDF file. Please upload a PDF.",
      },
      { status: 400 },
    );

  try {
    // 텍스트(AI 추출)와 사진(바이트 추출)을 병렬로.
    const [content, photoBuffers] = await Promise.all([
      getAIProvider().extractLandingContent(buf.toString("base64"), locale),
      normalizePhotos(extractJpegCandidates(buf), MAX_PHOTOS),
    ]);

    const photos = await savePhotos(businessId, photoBuffers);
    return NextResponse.json({ data: { ...content, photos } });
  } catch (err) {
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "PDF를 분석하는 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while analyzing the PDF. Please try again.";
    console.error("[ai/pdf-import]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** 추출한 사진을 스토리지에 저장하고 공개 URL을 돌려준다. */
async function savePhotos(
  businessId: string,
  buffers: Buffer[],
): Promise<string[]> {
  if (buffers.length === 0) return [];
  const admin = createAdminClient();
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === IMAGE_BUCKET)) {
      await admin.storage.createBucket(IMAGE_BUCKET, {
        public: true,
        fileSizeLimit: "10MB",
      });
    }
  } catch {
    // 버킷이 이미 있으면 업로드는 그대로 동작한다.
  }

  const stamp = Date.now();
  const urls = await Promise.all(
    buffers.map(async (bytes, i) => {
      try {
        const path = `${businessId}/pdf-${stamp}-${i}.jpg`;
        const { error } = await admin.storage
          .from(IMAGE_BUCKET)
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (error) return null;
        return admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data
          .publicUrl;
      } catch {
        return null;
      }
    }),
  );
  return urls.filter((u): u is string => !!u);
}
