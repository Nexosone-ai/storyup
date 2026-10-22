import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDEO_STORY_MODEL } from "./config";

/**
 * 전문 영상 스토리보드 — Claude(Opus 5.5)가 컨셉으로 전체 스토리 + 장면별
 * 이미지 프롬프트(GPT용) + 음악 프롬프트(SUNO용)까지 한 번에 만든다.
 * 이야기는 Claude가 끌고, 이미지/영상/음악은 그 프롬프트로 각 엔진이 실행한다.
 */

export interface StoryScene {
  /** 장면 내레이션/설명(한국어). */
  script: string;
  /** 이미지 생성용 영어 프롬프트(GPT에 그대로 전달). */
  imagePrompt: string;
}
export interface StoryboardResult {
  title: string;
  scenes: StoryScene[];
  /** 음악(SUNO) 생성용 영어 프롬프트. */
  musicPrompt: string;
}

export class StoryboardError extends Error {}

export interface ProAsset {
  kind: "background" | "prop";
  label: string;
  prompt: string;
}

/**
 * 에셋 목록 — 영상 전에 만들어 둘 배경(앵글별)·소품을 Claude가 설계한다.
 * 각 에셋의 prompt는 영어(GPT 이미지용). 재사용 가능한 단위로.
 */
export async function generateAssetList(input: {
  businessName: string;
  category: string;
  concept: string;
  scenes: string[];
  language?: "ko" | "en";
}): Promise<ProAsset[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new StoryboardError("스토리 엔진(Claude)이 설정되지 않았어요.");

  const system = `당신은 광고 영상의 아트 디렉터입니다. 영상 제작 전에 미리 만들어 둘 '에셋' 목록을 설계합니다.
- kind='background': 장면 배경을 '앵글별'로(예: 정면/측면/부감 등) 나눠 제안.
- kind='prop': 장면에 필요한 소품을 하나하나.
- 각 에셋의 prompt는 '영어'로 이미지 모델이 바로 쓸 수 있게(피사체·구도·조명·스타일, 글자/로고 금지, 인물이 있으면 한국인).
- 소품 없이 돌리면 재생성이 많아지니, 장면에 등장할 핵심 배경·소품을 빠짐없이.
반드시 아래 JSON만 반환: {"assets":[{"kind":"background|prop","label":"짧은 이름","prompt":"English prompt"}]}`;

  const user = `사업: ${input.businessName} (업종: ${input.category})
컨셉: ${input.concept.slice(0, 1200)}
장면 요약:
${input.scenes.map((s, i) => `${i + 1}. ${s}`).join("\n").slice(0, 2000)}

JSON으로만 응답.`;

  const client = new Anthropic({ apiKey: key });
  let text = "";
  try {
    const res = await client.messages.create({
      model: PROVIDEO_STORY_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });
    text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (err) {
    console.error("[provideo/assets]", err);
    throw new StoryboardError("에셋 목록 생성에 실패했어요.");
  }
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) throw new StoryboardError("에셋 응답을 해석하지 못했어요.");
  let parsed: { assets?: ProAsset[] };
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    throw new StoryboardError("에셋 응답 형식이 올바르지 않아요.");
  }
  return (Array.isArray(parsed.assets) ? parsed.assets : [])
    .map((a) => ({
      kind: a?.kind === "background" ? "background" : ("prop" as "background" | "prop"),
      label: String(a?.label ?? "").slice(0, 80),
      prompt: String(a?.prompt ?? "").slice(0, 800),
    }))
    .filter((a) => a.prompt)
    .slice(0, 30);
}

export async function generateStoryboard(input: {
  businessName: string;
  category: string;
  concept: string;
  aspect: string;
  sceneCount?: number;
  language?: "ko" | "en";
}): Promise<StoryboardResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new StoryboardError("스토리 엔진(Claude)이 설정되지 않았어요.");
  const scenes = Math.min(Math.max(input.sceneCount ?? 6, 3), 12);
  const ko = (input.language ?? "ko") === "ko";

  const system = `당신은 광고·브랜드 영상의 시니어 크리에이티브 디렉터입니다.
업종 맥락을 이해해 짧은 영상(${input.aspect})의 스토리보드를 설계합니다.
- ${scenes}개 장면으로 기승전결이 있는 이야기를 만듭니다.
- 각 장면의 script는 ${ko ? "한국어" : "영어"}로, 내레이션/화면 설명을 1~2문장.
- 각 장면의 imagePrompt는 '영어'로, 이미지 모델(GPT)이 바로 쓸 수 있는 구체적 묘사
  (피사체·구도·조명·분위기·스타일). 글자/로고는 넣지 말 것. 인물이 나오면 한국인(동양인)으로.
- musicPrompt는 '영어'로, 이야기 분위기에 맞는 BGM 설명(장르·템포·악기·무드).
- 없는 사실(가격·효능·수치)을 지어내지 않습니다.
반드시 아래 JSON만 순수 JSON으로 반환하세요.`;

  const user = `사업: ${input.businessName} (업종: ${input.category})
영상 컨셉/브리프:
"""
${input.concept.slice(0, 2000)}
"""

아래 JSON 스키마로만 응답:
{
  "title": "영상 제목",
  "scenes": [
    { "script": "장면 설명/내레이션", "imagePrompt": "English image prompt" }
  ],
  "musicPrompt": "English BGM prompt"
}`;

  const client = new Anthropic({ apiKey: key });
  let text = "";
  try {
    const res = await client.messages.create({
      model: PROVIDEO_STORY_MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: user }],
    });
    text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (err) {
    console.error("[provideo/story]", err);
    throw new StoryboardError("스토리보드 생성 중 문제가 발생했어요.");
  }

  // JSON 파싱(코드블록/잡음 방어).
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) throw new StoryboardError("스토리보드 응답을 해석하지 못했어요.");
  let parsed: StoryboardResult;
  try {
    parsed = JSON.parse(m[0]) as StoryboardResult;
  } catch {
    throw new StoryboardError("스토리보드 응답 형식이 올바르지 않아요.");
  }
  const outScenes = (Array.isArray(parsed.scenes) ? parsed.scenes : [])
    .map((s) => ({
      script: String(s?.script ?? "").slice(0, 600),
      imagePrompt: String(s?.imagePrompt ?? "").slice(0, 800),
    }))
    .filter((s) => s.script || s.imagePrompt)
    .slice(0, 12);
  if (outScenes.length === 0) throw new StoryboardError("장면을 만들지 못했어요. 컨셉을 더 구체적으로 입력해주세요.");

  return {
    title: String(parsed.title ?? "").slice(0, 120) || (ko ? "브랜드 영상" : "Brand video"),
    scenes: outScenes,
    musicPrompt: String(parsed.musicPrompt ?? "").slice(0, 600),
  };
}
