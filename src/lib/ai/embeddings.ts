import "server-only";

/**
 * 텍스트 임베딩 — 시맨틱 기억검색용. OpenAI text-embedding-3-small(1536차원)을
 * 쓰며, OPENAI_API_KEY가 없으면 null을 돌려 호출부가 최근순 폴백하도록 한다.
 * Server-only — API 키를 읽으므로 Client Component에서 import 금지.
 */

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

/** 임베딩 벡터(number[]) 또는 null(키 없음·실패). 실패해도 throw하지 않는다. */
export async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const input = text.trim().slice(0, 8000);
  if (!input) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: MODEL, input }),
    });
    if (!res.ok) {
      console.error("[embeddings]", res.status);
      return null;
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch (err) {
    console.error("[embeddings]", err);
    return null;
  }
}

/** pgvector 텍스트 표현("[1,2,3]") — insert/RPC 파라미터로 안전하게 전달. */
export function toVectorLiteral(vec: number[]): string {
  return JSON.stringify(vec);
}
