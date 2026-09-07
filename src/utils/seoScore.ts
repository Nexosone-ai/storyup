import { markdownToPlainText } from "@/utils/markdown";

/**
 * 블로그 글 SEO 자가진단 — 에디터에서 실시간으로 계산한다 (클라이언트 안전).
 * 원칙: 키워드를 많이 넣을수록 점수가 오르는 구조로 만들지 않는다.
 * 과다 반복은 오히려 감점하고, 각 항목은 검색엔진이 실제로 보는 요소만 본다.
 */

export type SeoCheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  status: SeoCheckStatus;
  /** 체크 항목 이름 */
  label: { ko: string; en: string };
  /** 미통과 시 개선 힌트 */
  hint?: { ko: string; en: string };
  weight: number;
}

export interface SeoReport {
  score: number; // 0~100
  checks: SeoCheck[];
}

export interface SeoInput {
  title: string;
  summary: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  keywords: string[];
  content: string;
  hasCoverImage: boolean;
}

function check(
  id: string,
  status: SeoCheckStatus,
  weight: number,
  label: SeoCheck["label"],
  hint?: SeoCheck["hint"],
): SeoCheck {
  return { id, status, weight, label, ...(status === "pass" ? {} : { hint }) };
}

export function computeSeoReport(input: SeoInput): SeoReport {
  const title = (input.seoTitle || input.title || "").trim();
  const desc = (input.seoDescription || input.summary || "").trim();
  const plain = markdownToPlainText(input.content ?? "");
  const focus = input.keywords[0]?.trim() ?? "";

  const checks: SeoCheck[] = [];

  // 1. 제목 길이 — 검색결과에 잘리지 않는 범위
  checks.push(
    check(
      "title",
      !title ? "fail" : title.length >= 10 && title.length <= 60 ? "pass" : "warn",
      15,
      { ko: "제목 (10~60자)", en: "Title (10–60 chars)" },
      {
        ko: !title
          ? "제목을 입력하세요."
          : title.length < 10
            ? "제목이 너무 짧습니다. 내용을 알 수 있게 조금 더 구체적으로 써주세요."
            : "제목이 길어 검색결과에서 잘릴 수 있습니다. 60자 이내를 권장합니다.",
        en: !title
          ? "Add a title."
          : title.length < 10
            ? "The title is very short — make it more descriptive."
            : "Long titles get cut off in search results. Aim for under 60 chars.",
      },
    ),
  );

  // 2. 설명(요약) — meta description으로 나가는 문장
  checks.push(
    check(
      "description",
      !desc ? "fail" : desc.length >= 40 && desc.length <= 160 ? "pass" : "warn",
      15,
      { ko: "요약/설명 (40~160자)", en: "Summary/description (40–160 chars)" },
      {
        ko: !desc
          ? "요약을 입력하세요 — 검색결과의 설명문으로 쓰입니다."
          : desc.length < 40
            ? "요약이 짧습니다. 글 내용을 한두 문장으로 정확히 담아주세요."
            : "요약이 길어 검색결과에서 잘릴 수 있습니다. 160자 이내를 권장합니다.",
        en: !desc
          ? "Add a summary — it becomes the search result description."
          : desc.length < 40
            ? "The summary is short. Describe the post in one or two sentences."
            : "Long descriptions get cut off. Aim for under 160 chars.",
      },
    ),
  );

  // 3. 본문 분량 — 글자 수를 기계적으로 늘리라는 뜻이 아니라 최소한의 실속
  checks.push(
    check(
      "body",
      plain.length >= 800 ? "pass" : plain.length >= 300 ? "warn" : "fail",
      15,
      { ko: "본문 분량", en: "Body length" },
      {
        ko:
          plain.length < 300
            ? "본문이 너무 짧아 검색엔진이 저품질로 볼 수 있습니다. 실제 정보를 더 담아주세요."
            : "조금 더 자세히 쓰면 좋습니다. 단, 의미 없는 문장으로 늘리지는 마세요.",
        en:
          plain.length < 300
            ? "The body is very thin — add real substance."
            : "A bit more depth helps, but don't pad with filler.",
      },
    ),
  );

  // 4. 소제목 구조 (H2)
  const h2Count = (input.content.match(/^##\s/gm) ?? []).length;
  checks.push(
    check(
      "headings",
      h2Count >= 2 ? "pass" : h2Count === 1 ? "warn" : "fail",
      10,
      { ko: "소제목(H2) 구조", en: "Subheading (H2) structure" },
      {
        ko: "본문을 소제목(## )으로 2개 이상 나누면 독자와 검색엔진 모두 이해하기 쉽습니다.",
        en: "Break the body into 2+ sections with ## subheadings.",
      },
    ),
  );

  // 5. 키워드 지정 여부
  checks.push(
    check(
      "keywords",
      input.keywords.length >= 1 ? "pass" : "fail",
      10,
      { ko: "검색 키워드 지정", en: "Focus keywords set" },
      {
        ko: "AI 생성 글에는 자동으로 들어갑니다. 직접 쓴 글은 키워드가 비어 있을 수 있습니다.",
        en: "AI-generated posts include keywords automatically.",
      },
    ),
  );

  // 6. 대표 키워드가 제목·본문에 자연스럽게 등장하는지
  if (focus) {
    const inTitle = title.includes(focus);
    const inBody = plain.includes(focus);
    checks.push(
      check(
        "keyword-usage",
        inTitle || (inBody && plain.indexOf(focus) < 300)
          ? "pass"
          : inBody
            ? "warn"
            : "fail",
        10,
        { ko: "대표 키워드 사용", en: "Focus keyword usage" },
        {
          ko: `대표 키워드 "${focus}"를 제목이나 도입부에 자연스럽게 넣어주세요.`,
          en: `Use the focus keyword "${focus}" naturally in the title or intro.`,
        },
      ),
    );

    // 7. 키워드 과다 반복 감점 — 스터핑 방지
    const occurrences = plain.split(focus).length - 1;
    const stuffed = occurrences > Math.max(12, Math.floor(plain.length / 250));
    checks.push(
      check(
        "keyword-stuffing",
        stuffed ? "warn" : "pass",
        5,
        { ko: "키워드 반복 적정", en: "No keyword stuffing" },
        {
          ko: `"${focus}"가 ${occurrences}회 반복됩니다. 억지 반복은 검색 순위에 오히려 해롭습니다.`,
          en: `"${focus}" appears ${occurrences} times — forced repetition hurts ranking.`,
        },
      ),
    );
  }

  // 8. 커버 이미지 (OG 이미지로 쓰임)
  checks.push(
    check(
      "cover",
      input.hasCoverImage ? "pass" : "warn",
      10,
      { ko: "커버 이미지 (공유 미리보기)", en: "Cover image (share preview)" },
      {
        ko: "커버 이미지가 있으면 검색·SNS 공유 시 미리보기 이미지로 노출됩니다.",
        en: "A cover image becomes the preview in search and social shares.",
      },
    ),
  );

  // 9. 본문 이미지 ALT — 이미지가 없으면 통과(해당 없음)
  const images = [...input.content.matchAll(/!\[([^\]]*)\]\(/g)];
  const missingAlt = images.filter(
    (m) => !m[1].trim() || m[1].trim() === "사진",
  ).length;
  checks.push(
    check(
      "image-alt",
      images.length === 0 || missingAlt === 0 ? "pass" : "warn",
      5,
      { ko: "이미지 대체 텍스트(ALT)", en: "Image alt text" },
      {
        ko: `대체 텍스트가 없는 이미지가 ${missingAlt}개 있습니다. ![설명](주소) 형식으로 사진 내용을 적어주세요.`,
        en: `${missingAlt} image(s) lack alt text. Describe them: ![description](url).`,
      },
    ),
  );

  // 10. 링크 — 본문에 참고 링크(내부/외부)가 하나라도 있는지
  const hasLink = /\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/.test(
    input.content.replace(/!\[[^\]]*\]\([^)]*\)/g, ""),
  );
  checks.push(
    check(
      "links",
      hasLink ? "pass" : "warn",
      5,
      { ko: "본문 링크", en: "Links in body" },
      {
        ko: "관련 글이나 출처 링크가 있으면 신뢰도에 도움이 됩니다. 발행하면 '관련 콘텐츠'는 자동으로 연결됩니다.",
        en: "Reference or related links add credibility. Related posts are linked automatically on publish.",
      },
    ),
  );

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce(
    (s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0),
    0,
  );

  return { score: Math.round((earned / total) * 100), checks };
}
