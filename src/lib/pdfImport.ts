import sharp from "sharp";

/**
 * PDF 랜딩페이지 불러오기 — 타입과 이미지 추출 헬퍼.
 * PDF에 내장된 사진(JPEG/DCTDecode 스트림)을 파서 없이 바이트 스캔으로
 * 찾아내고, sharp로 검증·정규화한다. (벡터/PNG 이미지는 추출 대상 아님)
 */

/** AI가 PDF 본문에서 추출하는 텍스트 콘텐츠. 없는 항목은 빈 문자열. */
export interface PdfLandingExtract {
  name: string;
  headline: string;
  shortDescription: string;
  storyTitle: string;
  storyBody: string;
  offers: { title: string; description: string }[];
  phone: string;
  email: string;
  address: string;
  website: string;
  instagram: string;
  facebook: string;
  x: string;
}

/** 에디터로 전달되는 최종 페이로드 — 텍스트 + 스토리지에 저장된 사진 URL. */
export interface PdfImportData extends PdfLandingExtract {
  photos: string[];
}

export interface PdfImportResult {
  data?: PdfImportData;
  error?: string;
}

export const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_CANDIDATES = 24; // 스캔으로 모을 JPEG 후보 상한 (CPU 가드)
const MIN_JPEG_BYTES = 8 * 1024; // 아이콘/장식 제외
const MIN_DIMENSION = 280; // px — 실사용 가능한 사진만

/**
 * JPEG 세그먼트를 따라가 SOI(FFD8)에서 시작한 이미지의 끝(EOI 다음 오프셋)을
 * 찾는다. 구조가 깨져 있으면 null. EXIF 썸네일은 APP 세그먼트 길이로 건너뛴다.
 */
function findJpegEnd(buf: Buffer, start: number): number | null {
  let p = start + 2; // SOI 다음
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) return null;
    const marker = buf[p + 1];
    if (marker === 0xff) {
      p += 1; // fill byte
      continue;
    }
    if (marker === 0xd8) return null; // 중첩 SOI — 잘못된 구조
    if (marker === 0xd9) return p + 2; // EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2; // 길이 없는 마커
      continue;
    }
    const len = buf.readUInt16BE(p + 2);
    if (len < 2) return null;
    if (marker === 0xda) {
      // SOS — 엔트로피 데이터: 바이트 스터핑(FF00)·RSTn을 건너뛰며 EOI 탐색
      p += 2 + len;
      while (p + 1 < buf.length) {
        if (buf[p] !== 0xff) {
          p += 1;
          continue;
        }
        const m = buf[p + 1];
        if (m === 0xd9) return p + 2;
        if (m === 0x00 || m === 0xff || (m >= 0xd0 && m <= 0xd7)) {
          p += 2;
          continue;
        }
        // 엔트로피 중간의 기타 마커(DNL 등) — 길이만큼 건너뛴다
        if (p + 4 > buf.length) return null;
        p += 2 + buf.readUInt16BE(p + 2);
      }
      return null;
    }
    p += 2 + len;
  }
  return null;
}

/** PDF 바이트에서 내장 JPEG 이미지 후보를 찾아 (큰 것부터) 돌려준다. */
export function extractJpegCandidates(pdf: Buffer): Buffer[] {
  const soi = Buffer.from([0xff, 0xd8, 0xff]);
  const found: Buffer[] = [];
  let offset = 0;
  while (found.length < MAX_CANDIDATES) {
    const start = pdf.indexOf(soi, offset);
    if (start === -1) break;
    const end = findJpegEnd(pdf, start);
    if (end && end - start >= MIN_JPEG_BYTES) {
      found.push(pdf.subarray(start, end));
      offset = end;
    } else {
      offset = start + 3;
    }
  }
  return found.sort((a, b) => b.length - a.length);
}

/**
 * 후보를 sharp로 검증·정규화한다 — 진짜 사진(충분한 해상도)만,
 * 최대 1600px sRGB JPEG로 재인코딩해서 돌려준다.
 */
export async function normalizePhotos(
  candidates: Buffer[],
  max: number,
): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (const c of candidates) {
    if (out.length >= max) break;
    try {
      const meta = await sharp(c).metadata();
      if (
        !meta.width ||
        !meta.height ||
        meta.width < MIN_DIMENSION ||
        meta.height < MIN_DIMENSION
      )
        continue;
      out.push(
        await sharp(c)
          .rotate() // EXIF 방향 반영
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 82 })
          .toBuffer(),
      );
    } catch {
      // 스캔 오탐(JPEG 아님) — 무시
    }
  }
  return out;
}
