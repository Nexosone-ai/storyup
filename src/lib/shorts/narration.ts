/**
 * 내레이션 트랙 + 믹스 버스 — 요약 쇼츠용(브라우저 WebAudio).
 *
 * 그래프: bed(BGM) → duckGain → limiter → dest ← narrationGain ← BufferSource(클립)
 * - 덕킹은 BGM 자체 gain(페이드 자동화 보유)이 아니라 별도 duckGain 에만 자동화한다.
 *   같은 AudioParam 에 페이드와 덕킹 램프를 섞으면 이전 이벤트 값에서 램프가 시작돼 튀기 때문.
 * - 모든 start()는 호출부가 정한 단일 시각 `at`(ctx.currentTime 기준)을 받아 BGM·내레이션·
 *   렌더 클록이 한 시간축을 공유한다.
 */

export interface NarrationClip {
  buffer: AudioBuffer;
  /** 트랙 시작(at) 기준 오프셋(초). */
  atSec: number;
}

export interface NarrationTrack {
  start: (at: number) => void;
  stop: () => void;
}

export interface MixBus {
  /** 녹화 스트림으로 넘길 최종 목적지. */
  dest: MediaStreamAudioDestinationNode;
  /** 합산 클리핑 방지 리미터(dest 바로 앞). */
  limiter: DynamicsCompressorNode;
  /** BGM 덕킹용 gain — createCustomBed/createMusicBed 의 `out` 으로 넘긴다. */
  duckGain: GainNode;
}

/** 공유 믹스 버스 생성. */
export function createMixBus(ctx: AudioContext): MixBus {
  const dest = ctx.createMediaStreamDestination();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  limiter.connect(dest);
  const duckGain = ctx.createGain();
  duckGain.gain.value = 1;
  duckGain.connect(limiter);
  return { dest, limiter, duckGain };
}

/** 클립 피크 → 정규화 gain(최대 0.9, 1 초과 증폭은 안 함). */
function normalizeGain(buffer: AudioBuffer, target = 0.9): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    // 긴 버퍼도 가볍게 — 4샘플 간격 샘플링으로 충분.
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
    }
  }
  if (peak <= 0.0001) return 1;
  return Math.min(1, target / peak);
}

/**
 * 내레이션 클립들을 `at + atSec` 에 예약하고, 재생 구간 동안 duckGain 을 낮춘다.
 * 간격이 2·ramp 보다 좁은 클립은 한 구간으로 합쳐 램프가 겹치지 않게 한다.
 */
export function createNarrationTrack(
  ctx: AudioContext,
  clips: NarrationClip[],
  out: AudioNode,
  duckGain: GainNode,
  opts: { duckTo?: number; rampSec?: number; gain?: number } = {},
): NarrationTrack {
  const duckTo = opts.duckTo ?? 0.25;
  const ramp = opts.rampSec ?? 0.15;
  const masterGain = opts.gain ?? 1;
  const sources: AudioBufferSourceNode[] = [];
  const sorted = [...clips].sort((a, b) => a.atSec - b.atSec);

  return {
    start(at: number) {
      // 1) 클립 예약
      for (const clip of sorted) {
        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
        const g = ctx.createGain();
        g.gain.value = normalizeGain(clip.buffer) * masterGain;
        src.connect(g);
        g.connect(out);
        src.start(at + clip.atSec);
        sources.push(src);
      }
      // 2) 덕킹 구간 병합
      const spans: { t0: number; t1: number }[] = [];
      for (const clip of sorted) {
        const t0 = at + clip.atSec;
        const t1 = t0 + clip.buffer.duration;
        const last = spans[spans.length - 1];
        if (last && t0 - last.t1 < 2 * ramp) last.t1 = Math.max(last.t1, t1);
        else spans.push({ t0, t1 });
      }
      // 3) duckGain 자동화(1 → duckTo → 1). 첫 램프 시작이 at 앞으로 가지 않게 클램프.
      const p = duckGain.gain;
      p.cancelScheduledValues(at);
      p.setValueAtTime(1, at);
      for (const { t0, t1 } of spans) {
        const down = Math.max(at, t0 - ramp);
        p.setValueAtTime(1, down);
        p.linearRampToValueAtTime(duckTo, Math.max(down, t0));
        p.setValueAtTime(duckTo, t1);
        p.linearRampToValueAtTime(1, t1 + ramp);
      }
    },
    stop() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* 이미 끝남 */
        }
      }
      try {
        const now = ctx.currentTime;
        duckGain.gain.cancelScheduledValues(now);
        duckGain.gain.setValueAtTime(1, now);
      } catch {
        /* noop */
      }
    },
  };
}
