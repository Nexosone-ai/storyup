import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { getLocale } from "@/lib/i18n";
import { normalizePhotos, type PdfImportResult } from "@/lib/pdfImport";
import {
  fetchLandingSource,
  fetchImageBuffers,
  UrlImportError,
} from "@/lib/urlImport";

export const maxDuration = 60;

const IMAGE_BUCKET = "site-images";
const MAX_PHOTOS = 6;

/**
 * 사용자가 입력한 웹주소(홈페이지·소개 페이지)에서 본문 텍스트와 사진을 가져와
 * 랜딩페이지 에디터에 채울 데이터를 돌려준다. 텍스트는 AI로 랜딩 콘텐츠로 정리하고,
 * 사진은 스토리지에 복사해 반환 URL을 그대로 사이트에 쓸 수 있게 한다.
 * SSRF 방어(내부망 차단 등)는 lib/urlImport에서 처리한다.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<PdfImportResult>> {
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
  let url: string;
  try {
    const body = (await request.json()) as {
      businessId?: string;
      url?: string;
    };
    businessId = String(body.businessId ?? "");
    url = String(body.url ?? "");
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  if (!url.trim())
    return NextResponse.json(
      { error: ko ? "주소를 입력해주세요." : "Please enter a URL." },
      { status: 400 },
    );

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

  try {
    const source = await fetchLandingSource(url);

    // 텍스트(AI 추출)와 사진(다운로드→정규화)을 병렬로.
    const [content, photoBuffers] = await Promise.all([
      getAIProvider().extractLandingFromText(source.text, locale),
      fetchImageBuffers(source.images, MAX_PHOTOS).then((bufs) =>
        normalizePhotos(bufs, MAX_PHOTOS),
      ),
    ]);

    // 페이지에서 뽑은 이름이 AI 결과에 없으면 보완한다.
    if (!content.name && source.name) content.name = source.name.slice(0, 80);

    const photos = await savePhotos(businessId, photoBuffers);
    return NextResponse.json({ data: { ...content, photos } });
  } catch (err) {
    if (err instanceof UrlImportError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "주소를 분석하는 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while analyzing the URL. Please try again.";
    console.error("[ai/url-import]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** 가져온 사진을 스토리지에 저장하고 공개 URL을 돌려준다. */
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
        const path = `${businessId}/url-${stamp}-${i}.jpg`;
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
