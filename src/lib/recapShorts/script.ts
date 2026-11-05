import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  RECAP_SCENE_MIN,
  RECAP_SCENE_MAX,
  RECAP_TARGET_SEC,
} from "./config";

/**
 * 요약 쇼츠 대본 — Claude가 블로그 글 1개를 30~40초 내레이션 장면(5~7개)으로 압축한다.
 * 장면마다 '읽을 내레이션'(TTS) + '화면 자막'(번인) + '이미지 프롬프트'(AI 소스일 때)를 만든다.
 * 저장소(recap-shorts-automation)의 핵심 규칙을 따른다: 원문에 없는 수치·효과·가격을 지어내지 않는다.
 * provideo/story.ts(generateStoryboard) 패턴 미러.
 */

const MODEL = process.env.RECAP_SCRIPT_MODEL || "claude-sonnet-5-5";

export interface RecapScriptScene {
  narration: string;
  caption: string;
  imagePrompt: string;
}
export interface RecapScriptResult {
  title: string;
  scenes: RecapScriptScene[];
}

export class RecapScriptError extends Error {}

export async function generateRecapScript(input: {
  businessName: string;
  category: string;
  postTitle: string;
  postText: string;
  sceneCount?: number;
  language?: "ko" | "en";
}): Promise<RecapScriptResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new RecapScriptError("대본 엔진(Claude)이 설정되지 않았어요.");
  const want = Math.min(
    Math.max(input.sceneCount ?? 6, RECAP_SCENE_MIN),
    RECAP_SCENE_MAX,
  );
  const ko = (input.language ?? "ko") === "ko";
  const lang = ko ? "한국어" : "영어";

  const system = `당신은 숏폼(유튜브 쇼츠·릴스) 전문 에디터입니다. 블로그 글 하나를 ${RECAP_TARGET_SEC}초 안팎의 세로 영상 '요약 쇼츠' 대본으로 압축합니다.
구성: 장면 ${want}개 — 1) 첫 장면은 시청자를 붙잡는 후킹 한 문장, 2) 중간 장면들은 글의 핵심 포인트를 하나씩, 3) 마지막 장면은 짧은 마무리와 행동 유도(사업장 방문·문의·더 알아보기).
각 장면:
- narration: ${lang} 구어체 1~2문장(소리 내어 읽는 내레이션). 전체 합계 약 180~260자(약 30~40초). 말끝은 자연스럽게(~해요/~입니다).
- caption: 화면 자막. 핵심만 ${ko ? "한국어" : "영어"}로 최대 2줄·28자 이내. 이모지·해시태그 금지.
- imagePrompt: '영어' 이미지 생성 프롬프트(세로 9:16, 피사체·구도·조명·분위기·스타일). 글자/로고/워터마크 금지. 인물이 나오면 한국인(동양인).
절대 규칙:
- 원문에 없는 숫자·가격·효능·순위·통계를 만들지 않는다. 원문에 수치가 있으면 그대로만 쓴다.
- 과장(최고·1위·100% 등)과 근거 없는 주장을 넣지 않는다.
- 사업명·상호는 원문 표기 그대로.
반드시 아래 JSON만 순수 JSON으로 반환하세요.`;

  const user = `사업: ${input.businessName} (업종: ${input.category})
글 제목: ${input.postTitle.slice(0, 200)}
글 본문:
"""
${input.postText.slice(0, 6000)}
"""

아래 JSON 스키마로만 응답:
{
  "title": "쇼츠 제목(한 줄)",
  "scenes": [
    { "narration": "읽을 내레이션", "caption": "화면 자막", "imagePrompt": "English image prompt" }
  ]
}`;

  const client = new Anthropic({ apiKey: key });
  let text = "";
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });
    text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (err) {
    console.error("[recap/script]", err);
    throw new RecapScriptError("대본 생성 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
  }

  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) throw new RecapScriptError("대본 응답을 해석하지 못했어요.");
  let parsed: RecapScriptResult;
  try {
    parsed = JSON.parse(m[0]) as RecapScriptResult;
  } catch {
    throw new RecapScriptError("대본 응답 형식이 올바르지 않아요.");
  }
  const scenes = (Array.isArray(parsed.scenes) ? parsed.scenes : [])
    .map((s) => ({
      narration: String(s?.narration ?? "").trim().slice(0, 400),
      caption: String(s?.caption ?? "").trim().slice(0, 80),
      imagePrompt: String(s?.imagePrompt ?? "").trim().slice(0, 800),
    }))
    .filter((s) => s.narration)
    .slice(0, RECAP_SCENE_MAX);
  if (scenes.length < 2)
    throw new RecapScriptError("장면을 충분히 만들지 못했어요. 글 내용이 너무 짧지 않은지 확인해주세요.");
  // caption이 비면 내레이션 앞부분으로 보강.
  for (const s of scenes) if (!s.caption) s.caption = s.narration.slice(0, 28);

  return {
    title: String(parsed.title ?? "").trim().slice(0, 120) || input.postTitle.slice(0, 120),
    scenes,
  };
}
