import "server-only";

/**
 * provideo 이미지 생성 = GPT(OpenAI Images). Claude가 준 프롬프트를 그대로 쓴다.
 * 프로젝트는 OpenAI SDK 없이 REST를 직접 호출한다. env OPENAI_API_KEY 필요.
 */

export class ProImageError extends Error {}

const SIZE: Record<string, string> = {
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "1:1": "1024x1024",
};

/** 프롬프트 → GPT 이미지(b64 png). 실패 시 ProImageError. */
export async function generateProVideoImage(
  prompt: string,
  aspect: string,
): Promise<{ b64: string; mime: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ProImageError("이미지 엔진(GPT)이 설정되지 않았어요(OPENAI_API_KEY).");
  const model = process.env.PROVIDEO_IMAGE_MODEL || "gpt-image-1";
  const size = SIZE[aspect] ?? "1024x1536";

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55_000);
  let json: { data?: { b64_json?: string }[]; error?: { message?: string } };
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt: prompt.slice(0, 3800), size, n: 1 }),
      signal: ctrl.signal,
    });
    json = await res.json();
    if (!res.ok) {
      console.error("[provideo/image]", res.status, json?.error?.message);
      throw new ProImageError("이미지 생성에 실패했어요. 프롬프트를 바꿔 다시 시도해주세요.");
    }
  } catch (err) {
    if (err instanceof ProImageError) throw err;
    throw new ProImageError("이미지 생성 중 네트워크 문제가 발생했어요.");
  } finally {
    clearTimeout(t);
  }

  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new ProImageError("이미지 응답을 받지 못했어요.");
  return { b64, mime: "image/png" };
}
