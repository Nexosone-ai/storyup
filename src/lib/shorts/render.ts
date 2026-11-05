/**
 * 쇼츠 렌더러 — 카드뉴스 이미지들을 9:16 캔버스에 슬라이드·줌 애니메이션으로 그리고,
 * canvas.captureStream + MediaRecorder로 '영상'을 브라우저에서 바로 인코딩한다.
 * 서버로 업로드하거나 외부 자료를 받지 않아 패킷을 거의 쓰지 않는다(이미지는 이미
 * 로드돼 있고, 음악은 합성, 결과물만 로컬 저장).
 *
 * 확장(요약 쇼츠용, 미지정 시 기존 출력과 동일):
 * - `clock`: 프레임 시간축을 외부(오디오 컨텍스트)에서 받아 내레이션과 한 시간축을 공유.
 * - `captions`/`captionStyle`: 카드별 자막을 하단에 번인(프리레이아웃·캐시, 루프에서 measureText 금지).
 */

export type ShortsMotion = "static" | "dynamic";

export interface CaptionStyle {
  /** 캔버스에서 바로 쓸 수 있는 패밀리(= fonts.ts resolveCanvasFontFamily 결과). */
  fontFamily: string;
  fontWeight?: number;
  fontSizePx?: number;
  color?: string;
  boxColor?: string;
  /** 화면 하단에서 박스 아래쪽까지 거리(px). */
  bottomPx?: number;
  /** 박스 최대 너비(화면 너비 비율). */
  maxWidthRatio?: number;
  lineHeight?: number;
  paddingPx?: number;
  radiusPx?: number;
  maxLines?: number;
}

export interface ShortsRenderOptions {
  width: number;
  height: number;
  /** 카드별 노출 시간(ms) 배열 — images와 같은 길이. 시간 조율/간단 편집용. */
  durations: number[];
  /** 전환 시간(ms). */
  transitionMs: number;
  motion: ShortsMotion;
  fps: number;
  /** 합성 음악 오디오 스트림(없으면 무음). */
  audioStream: MediaStream | null;
  onProgress?: (p: number) => void;
  /** 경과 시간(ms)을 돌려주는 외부 클록. 미지정 시 performance.now() 기준. */
  clock?: () => number;
  /** 카드별 자막(없는 카드는 null). */
  captions?: (string | null)[];
  captionStyle?: CaptionStyle;
}

export interface ShortsResult {
  blob: Blob;
  mime: string;
  ext: string;
}

/** 녹화에 쓸 수 있는 최적 컨테이너를 고른다 — 가능하면 mp4(틱톡 호환), 아니면 webm. */
function pickMime(): { mime: string; ext: string } {
  const cands: { mime: string; ext: string }[] = [
    { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return { mime: "", ext: "webm" };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** 이미지를 WxH를 꽉 채우도록(cover) 그린다 — zoom(>1)·dx(가로 오프셋 비율) 적용. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  zoom: number,
  dx: number,
) {
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2 + dx * W, (H - h) / 2, w, h);
}

/** 카드 전체가 보이도록(가로 맞춤) 중앙에 그린다 — zoom·dx 적용. */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  zoom: number,
  dx: number,
) {
  // 가로를 화면의 92%에 맞추고, 너무 길면 세로를 화면의 88%로 제한한다.
  let w = W * 0.92 * zoom;
  let h = (w * img.height) / img.width;
  const maxH = H * 0.88 * zoom;
  if (h > maxH) {
    h = maxH;
    w = (h * img.width) / img.height;
  }
  const x = (W - w) / 2 + dx * W;
  const y = (H - h) / 2;
  // 카드 그림자
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 20;
  roundRectPath(ctx, x, y, w, h, 28);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
  // 라운드 클립 후 이미지
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 28);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 한 카드(배경 블러 + 카드 본체)를 alpha·dx·zoom으로 그린다. */
function drawCard(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  alpha: number,
  dx: number,
  zoom: number,
  supportsFilter: boolean,
) {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  // 배경: 같은 이미지를 cover로 깔고 블러·어둡게
  if (supportsFilter) {
    ctx.filter = "blur(36px) brightness(0.5)";
    drawCover(ctx, img, W, H, zoom * 1.12, dx * 0.25);
    ctx.filter = "none";
  } else {
    ctx.globalAlpha = clamp01(alpha) * 0.5;
    drawCover(ctx, img, W, H, zoom * 1.12, dx * 0.25);
    ctx.globalAlpha = clamp01(alpha);
  }
  // 본체: 카드 전체 보이게
  drawContain(ctx, img, W, H, zoom, dx);
  ctx.restore();
}

// ---------------- 자막 ----------------

interface CaptionLayout {
  lines: string[];
  fontSizePx: number;
  /** 가장 긴 줄의 측정 너비. */
  maxLineW: number;
}

/** 줄 첫머리에 오면 어색한 문장부호 — 이전 줄 끝으로 보낸다. */
const NO_LINE_START = new Set([".", ",", "!", "?", ")", "…", "』", "」", "”", "’", "]"]);

function captionFont(style: CaptionStyle, sizePx: number): string {
  return `${style.fontWeight ?? 700} ${sizePx}px ${style.fontFamily}`;
}

/**
 * 자막을 maxW 안에 줄바꿈한다. 공백 기준 토큰 → 토큰이 너무 길면(한글 문장 등) 코드포인트 단위로 분할.
 * 호출 전 ctx.font 가 설정돼 있어야 한다.
 */
function wrapCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const lines: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) lines.push(cur.trim());
    cur = "";
  };
  const fits = (s: string) => ctx.measureText(s).width <= maxW;
  const addUnit = (u: string) => {
    const cand = cur ? cur + u : u;
    if (fits(cand)) {
      cur = cand;
      return;
    }
    // 줄 첫머리 금지 문자는 이전 줄에 붙인다(넘쳐도 허용).
    if (NO_LINE_START.has(u.trim())) {
      cur = cand;
      return;
    }
    push();
    cur = u.trimStart();
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const tokens = rawLine.split(/(\s+)/).filter((t) => t.length > 0);
    for (const tok of tokens) {
      if (/^\s+$/.test(tok)) {
        if (cur) cur += " ";
        continue;
      }
      if (fits(tok)) {
        // 토큰이 한 줄에 들어가면 통째로(현재 줄에 못 붙으면 addUnit 이 줄을 넘긴다).
        addUnit(tok);
      } else {
        // 토큰 자체가 한 줄보다 길다(공백 없는 한글 문장 등) → 글자 단위.
        for (const ch of Array.from(tok)) addUnit(ch);
      }
    }
    push(); // 명시적 줄바꿈
  }
  push();
  return lines;
}

/** 자막 1개를 프리레이아웃 — 줄 수 초과 시 폰트를 10%씩 줄이고(최저 70%) 그래도 넘치면 마지막 줄을 … 처리. */
function layoutCaption(
  ctx: CanvasRenderingContext2D,
  text: string | null | undefined,
  style: CaptionStyle,
  W: number,
): CaptionLayout | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const baseSize = style.fontSizePx ?? 56;
  const maxLines = style.maxLines ?? 3;
  const pad = style.paddingPx ?? 28;
  const maxW = W * (style.maxWidthRatio ?? 0.86) - pad * 2;

  let size = baseSize;
  let lines: string[] = [];
  for (let step = 0; step < 4; step++) {
    ctx.font = captionFont(style, size);
    lines = wrapCaption(ctx, t, maxW);
    if (lines.length <= maxLines) break;
    size = Math.round(baseSize * (1 - 0.1 * (step + 1)));
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    ctx.font = captionFont(style, size);
    while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  ctx.font = captionFont(style, size);
  const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 0);
  return { lines, fontSizePx: size, maxLineW };
}

/** 프리레이아웃된 자막을 하단 중앙에 그린다(반투명 라운드 박스 + 텍스트). */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  layout: CaptionLayout,
  style: CaptionStyle,
  W: number,
  H: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  const pad = style.paddingPx ?? 28;
  const lh = style.lineHeight ?? 1.35;
  const fs = layout.fontSizePx;
  const boxW = Math.min(W * (style.maxWidthRatio ?? 0.86), layout.maxLineW + pad * 2);
  const boxH = layout.lines.length * fs * lh + pad * 2;
  const x = (W - boxW) / 2;
  const y = H - (style.bottomPx ?? 260) - boxH;

  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  roundRectPath(ctx, x, y, boxW, boxH, style.radiusPx ?? 24);
  ctx.fillStyle = style.boxColor ?? "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.font = captionFont(style, fs);
  ctx.fillStyle = style.color ?? "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  layout.lines.forEach((line, i) => {
    const ly = y + pad + fs * lh * i + (fs * lh) / 2;
    ctx.fillText(line, W / 2, ly);
  });
  ctx.restore();
}

/**
 * 이미지 배열로 쇼츠 영상을 만든다. 반환 Blob을 그대로 다운로드하면 된다.
 */
export function renderShortsVideo(
  images: HTMLImageElement[],
  opts: ShortsRenderOptions,
): Promise<ShortsResult> {
  return new Promise((resolve, reject) => {
    const { width: W, height: H, transitionMs, motion, fps } = opts;
    if (images.length === 0) {
      reject(new Error("no images"));
      return;
    }
    // 카드별 노출 시간(ms). 누락/부족분은 기본 2500ms로 채운다.
    const durations = images.map((_, i) =>
      Number.isFinite(opts.durations?.[i]) && opts.durations[i] > 0
        ? opts.durations[i]
        : 2500,
    );
    const starts: number[] = [];
    let acc = 0;
    for (const d of durations) {
      starts.push(acc);
      acc += d;
    }
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("no 2d context"));
      return;
    }
    const supportsFilter = "filter" in ctx;

    // 자막 프리레이아웃(카드별 캐시) — 루프 안에서 measureText 를 하지 않는다.
    const capStyle = opts.captionStyle;
    const capLayouts: (CaptionLayout | null)[] | null =
      opts.captions && capStyle
        ? images.map((_, i) => layoutCaption(ctx, opts.captions?.[i], capStyle, W))
        : null;

    // 캔버스 스트림 + 오디오 트랙 결합
    const cStream = canvas.captureStream(fps);
    const tracks: MediaStreamTrack[] = [...cStream.getVideoTracks()];
    if (opts.audioStream) tracks.push(...opts.audioStream.getAudioTracks());
    const stream = new MediaStream(tracks);

    const { mime, ext } = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: 6_000_000,
          })
        : new MediaRecorder(stream);
    } catch (e) {
      reject(e instanceof Error ? e : new Error("recorder init failed"));
      return;
    }
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "video/webm";
      resolve({ blob: new Blob(chunks, { type }), mime: type, ext });
    };
    recorder.onerror = () => reject(new Error("recording failed"));

    const totalMs = acc;
    const n = images.length;

    const first = images[0];
    // 첫 프레임을 그려두고 녹화 시작
    drawCard(ctx, first, W, H, 1, 0, 1, supportsFilter);
    if (capLayouts?.[0] && capStyle) drawCaption(ctx, capLayouts[0], capStyle, W, H, 1);
    recorder.start();

    const start = performance.now();
    const clock = opts.clock ?? (() => performance.now() - start);
    let rafId = 0;

    const frame = () => {
      const elapsed = Math.max(0, clock());
      const t = Math.min(elapsed, totalMs);
      opts.onProgress?.(clamp01(t / totalMs));

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, W, H);

      // 누적 시작시간으로 현재 카드 인덱스를 찾는다(카드별 시간 반영).
      let idx = 0;
      while (idx < n - 1 && t >= starts[idx + 1]) idx++;
      const local = t - starts[idx];
      const p = clamp01(local / durations[idx]);
      // 켄번스 줌(세그먼트 동안 서서히 확대)
      const zoomAmt = motion === "dynamic" ? 0.1 : 0.05;
      const curZoom = 1 + zoomAmt * easeInOut(p);

      const inTransition = idx > 0 && local < transitionMs;
      let tp = 1;
      if (inTransition) {
        tp = easeInOut(clamp01(local / transitionMs));
        const prev = images[idx - 1];
        if (motion === "dynamic") {
          // 이전은 왼쪽으로 빠지고, 현재는 오른쪽에서 슬라이드 인
          drawCard(ctx, prev, W, H, 1, -tp * 0.5, 1 + zoomAmt, supportsFilter);
          drawCard(ctx, images[idx], W, H, 1, (1 - tp) * 0.6, curZoom, supportsFilter);
        } else {
          // 크로스페이드
          drawCard(ctx, prev, W, H, 1 - tp, 0, 1 + zoomAmt * 0.6, supportsFilter);
          drawCard(ctx, images[idx], W, H, tp, 0, curZoom, supportsFilter);
        }
      } else {
        drawCard(ctx, images[idx], W, H, 1, 0, curZoom, supportsFilter);
      }

      // 자막 — 전환 중엔 페이드(슬라이드 아님)로 이전/현재를 교차.
      if (capLayouts && capStyle) {
        if (inTransition && capLayouts[idx - 1])
          drawCaption(ctx, capLayouts[idx - 1] as CaptionLayout, capStyle, W, H, 1 - tp);
        if (capLayouts[idx])
          drawCaption(ctx, capLayouts[idx] as CaptionLayout, capStyle, W, H, inTransition ? tp : 1);
      }

      if (elapsed >= totalMs) {
        cancelAnimationFrame(rafId);
        // 마지막 프레임을 잠깐 더 유지한 뒤 종료
        setTimeout(() => {
          try {
            recorder.stop();
          } catch {
            /* noop */
          }
          cStream.getTracks().forEach((tr) => tr.stop());
        }, 120);
        return;
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  });
}

/** File/Blob을 로드된 HTMLImageElement로 변환한다(렌더 입력용). */
export function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

/**
 * 원격 URL(스토리지 공개 URL·data: URL)을 캔버스 오염 없이 이미지로 로드한다.
 * fetch → blob → 블롭 URL은 same-origin 이라 crossOrigin 설정이 필요 없다.
 */
export async function urlToImage(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  return fileToImage(await res.blob());
}
