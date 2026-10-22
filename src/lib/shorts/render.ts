/**
 * 쇼츠 렌더러 — 카드뉴스 이미지들을 9:16 캔버스에 슬라이드·줌 애니메이션으로 그리고,
 * canvas.captureStream + MediaRecorder로 '영상'을 브라우저에서 바로 인코딩한다.
 * 서버로 업로드하거나 외부 자료를 받지 않아 패킷을 거의 쓰지 않는다(이미지는 이미
 * 로드돼 있고, 음악은 합성, 결과물만 로컬 저장).
 */

export type ShortsMotion = "static" | "dynamic";

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
    recorder.start();

    const start = performance.now();
    let rafId = 0;

    const frame = () => {
      const elapsed = performance.now() - start;
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
      if (inTransition) {
        const tp = easeInOut(clamp01(local / transitionMs));
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
