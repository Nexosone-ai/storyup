// 기존 Supabase Storage(site-images) 대형 이미지 일괄 재압축.
//
// 왜: AI 생성 이미지가 큰 PNG(수 MB)로 저장돼 전송량이 크다. 가로 1600px 상한 +
// JPEG(q82, 불투명) / WebP(q82, 투명 로고 등 알파 보존)로 재인코딩해 용량을 줄인다.
//
// 어떻게: URL이 바뀌지 않도록 "같은 경로에 덮어쓰기"(upsert)만 한다 → DB의 이미지
// 참조(blog_posts.cover_image_url, 본문 HTML, websites.content 등)를 손댈 필요 없다.
// content-type 헤더로 실제 포맷을 알리므로 파일 확장자가 달라도 브라우저가 올바로 렌더한다.
//
// 안전장치: 기본은 미리보기(dry-run) — 무엇을 얼마나 줄일지 보고만 한다.
// 실제 덮어쓰기는 `--apply` 플래그가 있을 때만 수행한다.
//
// 실행:
//   미리보기:  npm run compress-images
//   실제 적용:  npm run compress-images -- --apply
//   (옵션)     -- --apply --prefix=<businessId>   특정 사업장만
//              -- --limit=50                      앞에서 N개만(테스트)
//
// 요구: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local, node --env-file)

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- 설정 ----
const BUCKET = "site-images";
const MAX_WIDTH = 1600; // 가로 상한(px)
const QUALITY = 82; // JPEG/WebP 품질
const MIN_ORIGINAL_BYTES = 150 * 1024; // 이보다 작은 파일은 건너뜀(이미 충분히 작음)
const MIN_SAVING_RATIO = 0.1; // 최소 10% 이상 줄 때만 교체
const COMPRESSIBLE = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

// ---- 인자 파싱 ----
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const PREFIX = (args.find((a) => a.startsWith("--prefix=")) ?? "").split("=")[1] ?? "";
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1]) || Infinity;

const fmtMB = (b) => (b / 1024 / 1024).toFixed(2) + "MB";

/** 버킷(또는 prefix) 아래 모든 파일을 재귀적으로 나열한다. */
async function listAll(prefix) {
  const out = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // 폴더는 id/metadata가 없다 → 재귀
      if (item.id === null || !item.metadata) {
        out.push(...(await listAll(path)));
      } else {
        out.push({
          path,
          size: Number(item.metadata.size ?? 0),
          mimetype: String(item.metadata.mimetype ?? ""),
        });
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

/** 한 이미지를 재인코딩한다. 알파가 있으면 WebP(투명 보존), 없으면 JPEG. */
async function recompress(buf) {
  const img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const resized = img.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (meta.hasAlpha) {
    const out = await resized.webp({ quality: QUALITY }).toBuffer();
    return { buffer: out, contentType: "image/webp" };
  }
  const out = await resized.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  return { buffer: out, contentType: "image/jpeg" };
}

async function main() {
  console.log(
    `[compress] 버킷 "${BUCKET}" 스캔 중${PREFIX ? ` (prefix=${PREFIX})` : ""}...`,
  );
  const all = await listAll(PREFIX);
  const candidates = all
    .filter((f) => COMPRESSIBLE.has(f.mimetype) && f.size >= MIN_ORIGINAL_BYTES)
    .slice(0, LIMIT);

  console.log(
    `[compress] 전체 ${all.length}개, 압축 대상 ${candidates.length}개 ` +
      `(≥${(MIN_ORIGINAL_BYTES / 1024) | 0}KB, 이미지). ` +
      (APPLY ? "모드: 실제 적용(--apply)" : "모드: 미리보기(dry-run)"),
  );

  let processed = 0,
    replaced = 0,
    origTotal = 0,
    newTotal = 0,
    skipped = 0,
    failed = 0;

  for (const f of candidates) {
    processed++;
    try {
      const { data: blob, error: dErr } = await admin.storage
        .from(BUCKET)
        .download(f.path);
      if (dErr || !blob) {
        failed++;
        console.warn(`  ✗ 다운로드 실패: ${f.path} (${dErr?.message ?? "no data"})`);
        continue;
      }
      const inBuf = Buffer.from(await blob.arrayBuffer());
      const { buffer: outBuf, contentType } = await recompress(inBuf);

      const saving = inBuf.length - outBuf.length;
      const ratio = saving / inBuf.length;
      origTotal += inBuf.length;

      if (ratio < MIN_SAVING_RATIO || outBuf.length >= inBuf.length) {
        skipped++;
        newTotal += inBuf.length; // 교체 안 함
        if (processed % 25 === 0 || LIMIT !== Infinity)
          console.log(
            `  · 유지 ${f.path} (${fmtMB(inBuf.length)} → ${fmtMB(outBuf.length)}, ${(ratio * 100) | 0}%↓ 미미)`,
          );
        continue;
      }

      newTotal += outBuf.length;
      if (APPLY) {
        const { error: uErr } = await admin.storage
          .from(BUCKET)
          .upload(f.path, outBuf, {
            contentType,
            upsert: true,
            cacheControl: "3600",
          });
        if (uErr) {
          failed++;
          newTotal += inBuf.length - outBuf.length; // 롤백 집계
          console.warn(`  ✗ 업로드 실패: ${f.path} (${uErr.message})`);
          continue;
        }
      }
      replaced++;
      console.log(
        `  ✓ ${APPLY ? "압축" : "압축예정"} ${f.path} ` +
          `${fmtMB(inBuf.length)} → ${fmtMB(outBuf.length)} (${(ratio * 100) | 0}%↓, ${contentType})`,
      );
    } catch (e) {
      failed++;
      console.warn(`  ✗ 처리 실패: ${f.path} (${e?.message ?? e})`);
    }
  }

  const saved = origTotal - newTotal;
  console.log("\n[compress] 요약");
  console.log(`  처리 ${processed} · 교체${APPLY ? "" : "예정"} ${replaced} · 유지 ${skipped} · 실패 ${failed}`);
  console.log(
    `  용량 ${fmtMB(origTotal)} → ${fmtMB(newTotal)} (절감 ${fmtMB(saved)}, ${origTotal ? ((saved / origTotal) * 100) | 0 : 0}%)`,
  );
  if (!APPLY) {
    console.log("\n  ※ 미리보기였습니다. 실제 적용하려면: npm run compress-images -- --apply");
  } else {
    console.log("\n  ※ 완료. CDN 캐시로 기존 이미지가 최대 1시간 후 새 버전으로 바뀔 수 있습니다.");
  }
}

main().catch((e) => {
  console.error("[compress] 중단:", e);
  process.exit(1);
});
