/**
 * 쇼츠 배경 음악 — 브라우저 WebAudio로 즉석 합성한다(무료·무저작권·무전송).
 * 외부 음원 파일을 내려받지 않아 패킷을 쓰지 않는다. 합성 결과를
 * MediaStreamAudioDestinationNode로 보내 녹화 스트림의 오디오 트랙으로 쓴다.
 */

export type ShortsMood = "bright" | "calm" | "energetic" | "none";

export interface MusicBed {
  /** 녹화에 합칠 오디오 스트림. mood='none'이면 null. */
  stream: MediaStream | null;
  start: () => void;
  stop: () => void;
}

export const SHORTS_MOODS: { id: ShortsMood; ko: string; en: string }[] = [
  { id: "bright", ko: "밝은", en: "Bright" },
  { id: "calm", ko: "잔잔한", en: "Calm" },
  { id: "energetic", ko: "경쾌한", en: "Energetic" },
  { id: "none", ko: "음악 없음", en: "No music" },
];

type MoodSpec = {
  bpm: number;
  scale: number[]; // semitone offsets from root
  root: number; // Hz of root
  drums: "none" | "soft" | "full";
  padGain: number;
  arpGain: number;
};

const MOODS: Record<Exclude<ShortsMood, "none">, MoodSpec> = {
  bright: { bpm: 104, scale: [0, 2, 4, 7, 9], root: 261.63, drums: "soft", padGain: 0.16, arpGain: 0.12 },
  calm: { bpm: 72, scale: [0, 2, 4, 7, 9], root: 196.0, drums: "none", padGain: 0.2, arpGain: 0.08 },
  energetic: { bpm: 126, scale: [0, 3, 5, 7, 10], root: 220.0, drums: "full", padGain: 0.14, arpGain: 0.13 },
};

// 코드 진행(스케일 degree의 근음). I–V–vi–IV 느낌.
const PROGRESSION = [0, 4, 3, 2];

const semi = (hz: number, n: number) => hz * Math.pow(2, n / 12);

/**
 * 선택한 분위기의 배경 음악을 durationSec 동안 스케줄한다.
 * ctx는 호출부(사용자 제스처)에서 만든 AudioContext를 받는다.
 */
export function createMusicBed(
  ctx: AudioContext,
  mood: ShortsMood,
  durationSec: number,
): MusicBed {
  if (mood === "none") return { stream: null, start() {}, stop() {} };
  const spec = MOODS[mood];
  const dest = ctx.createMediaStreamDestination();
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp);
  comp.connect(dest);

  // 드럼용 노이즈 버퍼(1초).
  const nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = nbuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  let stopped = false;

  const env = (g: GainNode, t: number, peak: number, a: number, d: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };

  const tone = (type: OscillatorType, f: number, t: number, dur: number, peak: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    env(g, t, peak, 0.02, dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.1);
  };

  const pad = (f: number, t: number, dur: number) => {
    [f, semi(f, 7), semi(f, 12)].forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = hz;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(spec.padGain, t + 0.4);
      g.gain.setValueAtTime(spec.padGain, t + dur - 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp);
      lp.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  };

  const kick = (t: number) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    env(g, t, 0.5, 0.004, 0.22);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.35);
  };
  const hat = (t: number, peak = 0.08) => {
    const n = ctx.createBufferSource();
    n.buffer = nbuf;
    n.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    env(g, t, peak, 0.001, 0.04);
    n.connect(hp);
    hp.connect(g);
    g.connect(master);
    n.start(t, Math.random());
    n.stop(t + 0.1);
  };
  const snare = (t: number) => {
    const n = ctx.createBufferSource();
    n.buffer = nbuf;
    n.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const g = ctx.createGain();
    env(g, t, 0.28, 0.001, 0.16);
    n.connect(hp);
    hp.connect(g);
    g.connect(master);
    n.start(t, Math.random());
    n.stop(t + 0.25);
  };

  const schedule = (base: number) => {
    const beat = 60 / spec.bpm;
    const bar = beat * 4;
    const bars = Math.ceil(durationSec / bar) + 1;
    for (let b = 0; b < bars; b++) {
      const t0 = base + b * bar;
      const deg = PROGRESSION[b % PROGRESSION.length];
      const chordRoot = semi(spec.root, spec.scale[deg % spec.scale.length]);
      pad(chordRoot, t0, bar);
      // 아르페지오(8분음표)
      for (let s = 0; s < 8; s++) {
        const note = spec.scale[(deg + s) % spec.scale.length];
        const hz = semi(spec.root, note) * 2;
        tone("triangle", hz, t0 + s * (beat / 2), beat * 0.45, spec.arpGain);
      }
      if (spec.drums !== "none") {
        for (let k = 0; k < 4; k++) kick(t0 + k * beat);
        if (spec.drums === "full") {
          snare(t0 + beat);
          snare(t0 + beat * 3);
          for (let h = 0; h < 8; h++) hat(t0 + h * (beat / 2), 0.07);
        } else {
          for (let h = 0; h < 4; h++) hat(t0 + h * beat, 0.05);
        }
      }
    }
  };

  return {
    stream: dest.stream,
    start() {
      if (stopped) return;
      const t = ctx.currentTime + 0.08;
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.9, t + 0.6);
      // 끝에서 페이드아웃
      const end = t + durationSec;
      master.gain.setValueAtTime(0.9, Math.max(t + 0.6, end - 0.6));
      master.gain.exponentialRampToValueAtTime(0.0001, end);
      schedule(t);
    },
    stop() {
      stopped = true;
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      } catch {
        /* noop */
      }
    },
  };
}
