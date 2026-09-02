"use server";

import { createClient } from "@/lib/supabase/server";
import {
  fetchWithTimeout,
  extractSocials,
  type PlaceImportResult,
} from "@/lib/placeImport";

/**
 * 네이버 지도 링크에서 사업자 정보를 가져오는 서버 액션.
 * 네이버 검색 API(지역)를 사용한다 — NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요.
 * 네이버는 장소 사진을 공식 API로 제공하지 않으므로 사진은 가져오지 않는다.
 */

const LOCAL_SEARCH = "https://openapi.naver.com/v1/search/local.json";

interface LocalItem {
  title: string;
  link: string;
  category: string;
  telephone: string;
  address: string;
  roadAddress: string;
}

/** naver.me 단축 링크를 따라가 전체 네이버 지도/플레이스 URL을 얻는다. */
async function resolveNaverUrl(raw: string): Promise<string> {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("링크 형식이 아닙니다.");
  const host = new URL(url).hostname;
  if (host !== "naver.me") return url;
  const res = await fetchWithTimeout(url, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StoryupBot/1.0)" },
  });
  return res.url || url;
}

/** 네이버 지도 URL에서 검색어(업체명)를 추출한다. 없으면 null. */
function parseNaverQuery(fullUrl: string): string | null {
  const decoded = decodeURIComponent(fullUrl);
  // PC 지도: map.naver.com/p/search/<검색어>/place/<id>
  const m = decoded.match(/\/p\/search\/([^/?#]+)/);
  if (m) return m[1].replace(/\+/g, " ").trim();
  // 구버전: ?query=<검색어>
  const q = new URL(fullUrl).searchParams.get("query");
  return q?.trim() || null;
}

/** <b> 태그와 HTML 엔티티를 제거한다 (검색 API의 title 필드). */
function cleanTitle(title: string): string {
  return title
    .replace(/<\/?b>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

async function searchLocal(
  id: string,
  secret: string,
  query: string,
): Promise<{ item?: LocalItem; error?: string }> {
  const res = await fetchWithTimeout(
    `${LOCAL_SEARCH}?query=${encodeURIComponent(query)}&display=5`,
    {
      headers: {
        "X-Naver-Client-Id": id,
        "X-Naver-Client-Secret": secret,
      },
    },
  );
  if (!res.ok) {
    let detail = "";
    try {
      const json = (await res.json()) as { errorMessage?: string };
      detail = json.errorMessage ?? "";
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 기록
    }
    console.error(`[naverPlace] local search ${res.status}: ${detail}`);
    if (res.status === 401 || res.status === 403)
      return {
        error:
          "네이버 API 키가 거부되었습니다. 네이버 개발자센터에서 Client ID/Secret과 '검색' API 사용 설정을 확인해주세요.",
      };
    if (res.status === 429)
      return { error: "네이버 API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요." };
    return { error: `네이버 검색 API 오류가 발생했습니다 (${res.status}).` };
  }
  const json = (await res.json()) as { items?: LocalItem[] };
  return { item: json.items?.[0] };
}

/**
 * 네이버 지도 링크로 사업자 정보(이름·주소·전화·웹사이트·SNS)를 가져온다.
 * 링크에 검색어가 없으면(모바일 공유 링크 등) 비즈니스 이름으로 검색한다.
 */
export async function importNaverPlaceAction(
  businessId: string,
  mapsUrl: string,
): Promise<PlaceImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // Ownership check via RLS — 검색 폴백에 쓸 이름도 함께 가져온다.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { error: "권한이 없습니다." };

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return {
      error:
        "네이버 지도 연동이 설정되지 않았습니다. 관리자가 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET을 설정해야 합니다.",
    };

  try {
    const fullUrl = await resolveNaverUrl(mapsUrl);
    if (!/(?:map|place)\.naver\.com|naver\.me/i.test(fullUrl))
      return {
        error:
          "네이버 지도 링크가 아닌 것 같습니다. 네이버 지도에서 '공유' 링크를 복사해 붙여넣어주세요.",
      };

    const query = parseNaverQuery(fullUrl) ?? biz.name;
    const { item, error } = await searchLocal(clientId, clientSecret, query);
    if (error) return { error };
    if (!item)
      return {
        error: `'${query}'로 네이버에서 업체를 찾지 못했습니다. 네이버 지도에 등록된 업체명과 비즈니스 이름이 같은지 확인해주세요.`,
      };

    const website = item.link ?? "";
    const socials = website
      ? await extractSocials(website)
      : { instagram: "", facebook: "", x: "" };

    return {
      data: {
        name: cleanTitle(item.title),
        address: item.roadAddress || item.address || "",
        phone: item.telephone ?? "",
        website,
        ...socials,
        photos: [],
      },
    };
  } catch (e) {
    console.error("[naverPlace] import failed:", e);
    return { error: "불러오는 중 문제가 발생했습니다. 링크를 확인하고 다시 시도해주세요." };
  }
}
