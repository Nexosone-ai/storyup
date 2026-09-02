/** 지도(구글·네이버) 불러오기가 공유하는 타입과 헬퍼. */

export interface PlaceImportData {
  name: string;
  address: string;
  phone: string;
  website: string;
  instagram: string;
  facebook: string;
  x: string;
  /** Supabase 스토리지에 저장된 사진 URL들 (네이버는 사진 미제공) */
  photos: string[];
}

export interface PlaceImportResult {
  data?: PlaceImportData;
  error?: string;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 8000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 사업자 웹사이트 HTML에서 SNS 프로필 링크를 추출한다. */
export async function extractSocials(
  websiteUri: string,
): Promise<{ instagram: string; facebook: string; x: string }> {
  const none = { instagram: "", facebook: "", x: "" };
  try {
    const res = await fetchWithTimeout(
      websiteUri,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; StoryupBot/1.0)" } },
      6000,
    );
    if (!res.ok) return none;
    const html = (await res.text()).slice(0, 600_000);

    const first = (re: RegExp, exclude: RegExp) => {
      for (const m of html.matchAll(re)) {
        const url = m[0].replace(/["'\\).,]+$/, "");
        if (!exclude.test(url)) return url;
      }
      return "";
    };

    return {
      instagram: first(
        /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/g,
        /instagram\.com\/(?:p|reel|reels|explore|accounts|share)\b/i,
      ),
      facebook: first(
        /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-]+/g,
        /facebook\.com\/(?:sharer|share|dialog|plugins|login|tr)\b/i,
      ),
      x: first(
        /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+/g,
        /(?:x|twitter)\.com\/(?:intent|share|home|search|hashtag|i)\b/i,
      ),
    };
  } catch {
    return none;
  }
}
