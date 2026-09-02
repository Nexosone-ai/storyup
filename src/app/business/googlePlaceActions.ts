"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import {
  fetchWithTimeout,
  extractSocials,
  type PlaceImportData,
  type PlaceImportResult,
} from "@/lib/placeImport";

/**
 * 구글 지도 링크에서 사업자 정보를 가져오는 서버 액션.
 * Google Places API (New)를 사용한다 — GOOGLE_MAPS_API_KEY 필요.
 */

export type GooglePlaceData = PlaceImportData;
export type GooglePlaceResult = PlaceImportResult;

const PLACES_BASE = "https://places.googleapis.com/v1";
const IMAGE_BUCKET = "site-images";
const MAX_PHOTOS = 6;

interface PlaceDetails {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  photos?: { name: string }[];
}

/** 단축 링크(maps.app.goo.gl 등)를 따라가 전체 구글 지도 URL을 얻는다. */
async function resolveMapsUrl(raw: string): Promise<string> {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("링크 형식이 아닙니다.");
  const host = new URL(url).hostname;
  const isShort =
    /(^|\.)goo\.gl$/.test(host) ||
    host === "maps.app.goo.gl" ||
    host === "share.google";
  if (!isShort) return url;
  // 리다이렉트를 따라간 최종 URL이 전체 지도 주소다.
  const res = await fetchWithTimeout(url, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StoryupBot/1.0)" },
  });
  return res.url || url;
}

/** 지도 URL에서 place id 또는 (이름, 좌표) 검색 조건을 추출한다. */
function parseMapsUrl(fullUrl: string): {
  placeId?: string;
  query?: string;
  lat?: number;
  lng?: number;
} {
  const decoded = decodeURIComponent(fullUrl);

  // 1) 데이터 블록의 place id (!19sChIJ...) 또는 쿼리 파라미터
  const pid =
    decoded.match(/!19s(ChIJ[\w-]+)/)?.[1] ??
    decoded.match(/[?&](?:query_)?place_id[=:]([\w-]+)/)?.[1];
  if (pid) return { placeId: pid };

  // 2) /maps/place/<이름> — 좌표는 @lat,lng 또는 데이터 블록의 !3d..!4d..
  const m = decoded.match(/\/maps\/place\/([^/@]+)/);
  const at =
    decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ??
    decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) {
    return {
      query: m[1].replace(/\+/g, " ").trim(),
      lat: at ? Number(at[1]) : undefined,
      lng: at ? Number(at[2]) : undefined,
    };
  }

  // 3) ?q=<검색어>
  const q = new URL(fullUrl).searchParams.get("q");
  if (q && !/^\d+(\.\d+)?,/.test(q)) return { query: q };

  return {};
}

/** Places API 오류 응답을 사용자에게 보여줄 메시지로 바꾼다. */
async function placesApiError(res: Response, ko: boolean): Promise<string> {
  let detail = "";
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    detail = json.error?.message ?? "";
  } catch {
    // 본문이 JSON이 아니면 상태 코드만 표기
  }
  console.error(`[googlePlace] Places API ${res.status}: ${detail}`);
  if (res.status === 403 || res.status === 401)
    return ko
      ? "구글 API 키가 거부되었습니다. Google Cloud에서 'Places API (New)' 활성화, 결제 계정 연결, 키 제한 설정을 확인해주세요."
      : "The Google API key was rejected. In Google Cloud, check that 'Places API (New)' is enabled, billing is linked, and the key restrictions are correct.";
  if (res.status === 429)
    return ko
      ? "구글 API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
      : "Google API quota exceeded. Please try again shortly.";
  return ko
    ? `구글 Places API 오류가 발생했습니다 (${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}).`
    : `Google Places API error (${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}).`;
}

/** 텍스트 검색으로 place id를 찾는다 (좌표가 있으면 주변을 우선). */
async function searchPlaceId(
  key: string,
  query: string,
  ko: boolean,
  lat?: number,
  lng?: number,
): Promise<{ id?: string; error?: string }> {
  const body: Record<string, unknown> = { textQuery: query, languageCode: "ko" };
  if (lat !== undefined && lng !== undefined) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 1000.0 },
    };
  }
  const res = await fetchWithTimeout(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await placesApiError(res, ko) };
  const json = (await res.json()) as { places?: { id: string }[] };
  return { id: json.places?.[0]?.id };
}

async function fetchPlaceDetails(
  key: string,
  placeId: string,
  ko: boolean,
): Promise<{ details?: PlaceDetails; error?: string }> {
  const res = await fetchWithTimeout(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=ko`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,photos",
      },
    },
  );
  if (!res.ok) return { error: await placesApiError(res, ko) };
  return { details: (await res.json()) as PlaceDetails };
}

/** 장소 사진을 내려받아 Supabase 스토리지에 저장하고 공개 URL을 돌려준다. */
async function savePhotos(
  key: string,
  businessId: string,
  photos: { name: string }[],
): Promise<string[]> {
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
  const results = await Promise.all(
    photos.slice(0, MAX_PHOTOS).map(async (photo, i) => {
      try {
        // skipHttpRedirect=true → 실제 이미지 URI(JSON)를 받아 직접 내려받는다.
        const metaRes = await fetchWithTimeout(
          `${PLACES_BASE}/${photo.name}/media?maxWidthPx=1400&skipHttpRedirect=true&key=${key}`,
        );
        if (!metaRes.ok) return null;
        const { photoUri } = (await metaRes.json()) as { photoUri?: string };
        if (!photoUri) return null;

        const imgRes = await fetchWithTimeout(photoUri, {}, 12000);
        if (!imgRes.ok) return null;
        const bytes = await imgRes.arrayBuffer();
        if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024)
          return null;

        const path = `${businessId}/google-${stamp}-${i}.jpg`;
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
  return results.filter((u): u is string => !!u);
}

/**
 * 구글 지도 링크로 사업자 정보(이름·주소·전화·웹사이트·사진·SNS)를 가져온다.
 * 사진은 스토리지에 복사해 저장하므로 반환된 URL을 그대로 사이트에 써도 된다.
 */
export async function importGooglePlaceAction(
  businessId: string,
  mapsUrl: string,
): Promise<GooglePlaceResult> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // Ownership check via RLS.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "권한이 없습니다." : "You don't have permission." };

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key)
    return {
      error: ko
        ? "구글 지도 연동이 설정되지 않았습니다. 관리자가 GOOGLE_MAPS_API_KEY를 설정해야 합니다."
        : "Google Maps import is not configured. An administrator must set GOOGLE_MAPS_API_KEY.",
    };

  try {
    const fullUrl = await resolveMapsUrl(mapsUrl);
    if (!/google\.[a-z.]+\/maps|maps\.google/i.test(fullUrl))
      return {
        error: ko
          ? "구글 지도 링크가 아닌 것 같습니다. 지도에서 '공유' 링크를 복사해 붙여넣어주세요."
          : "That doesn't look like a Google Maps link. Copy the 'Share' link from Google Maps and paste it here.",
      };

    const parsed = parseMapsUrl(fullUrl);
    let placeId = parsed.placeId ?? null;
    if (!placeId && parsed.query) {
      const found = await searchPlaceId(key, parsed.query, ko, parsed.lat, parsed.lng);
      if (found.error) return { error: found.error };
      placeId = found.id ?? null;
    }
    if (!placeId)
      return {
        error: ko
          ? "링크에서 장소를 찾지 못했습니다. 구글 지도에서 업체 페이지를 연 뒤 '공유' 버튼의 링크를 사용해주세요."
          : "Couldn't find a place in that link. Open the business page on Google Maps and use the link from the 'Share' button.",
      };

    const { details, error: detailsError } = await fetchPlaceDetails(key, placeId, ko);
    if (detailsError) return { error: detailsError };
    if (!details)
      return {
        error: ko
          ? "구글에서 장소 정보를 가져오지 못했습니다. 잠시 후 다시 시도해주세요."
          : "Couldn't fetch place details from Google. Please try again shortly.",
      };

    const website = details.websiteUri ?? "";
    const [photos, socials] = await Promise.all([
      savePhotos(key, businessId, details.photos ?? []),
      website ? extractSocials(website) : Promise.resolve({ instagram: "", facebook: "", x: "" }),
    ]);

    return {
      data: {
        name: details.displayName?.text ?? "",
        address: details.formattedAddress ?? "",
        phone:
          details.nationalPhoneNumber ??
          details.internationalPhoneNumber ??
          "",
        website,
        ...socials,
        photos,
      },
    };
  } catch (e) {
    console.error("[googlePlace] import failed:", e);
    return {
      error: ko
        ? "불러오는 중 문제가 발생했습니다. 링크를 확인하고 다시 시도해주세요."
        : "Something went wrong while importing. Check the link and try again.",
    };
  }
}
