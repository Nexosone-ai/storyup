import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export interface DesignEditPromptInput {
  /** 현재 Page Schema(검증 통과분). */
  schema: unknown;
  /** 디자이너 수정 요청(예: "카페용 따뜻한 톤으로", "모바일 CTA 강조"). */
  instruction: string;
  language?: PromptLanguage;
}

/**
 * Page Schema를 자연어 요청대로 수정한다. 출력은 '검증된 JSON 스키마'일 뿐 코드가 아니다.
 * 구조/슬롯은 유지하고 허용 컴포넌트·토큰만 쓴다(서버가 다시 검증·새니타이즈한다).
 */
export function designEditPrompt(input: DesignEditPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const system = `당신은 웹 페이지 레이아웃 디자이너입니다. 입력으로 받은 Page Schema(JSON)를
사용자의 요청대로 수정해 '수정된 전체 Page Schema'를 순수 JSON으로만 반환합니다.
${languageRule(language)}

스키마 규칙(반드시 준수):
- 최상위: { "version": 1, "tokens": {...}, "sections": [...] }
- tokens.colors: { 키: "#hex" } 형태. 색은 토큰 키로 참조(예: background: "primary").
- 구조: section → rows[] → columns[](span 1~12) → components[].
- 허용 컴포넌트 타입만: heading(level 1~4,text) / text(html) / image(src,alt) /
  button(label,href?,style) / list(items[]) / card(title,body,image?) / spacer(size) / divider.
- 섹션 레이아웃은 section.layout.base(align,justify,gap,paddingX,paddingY,background,maxWidth).
- 컴포넌트의 "slot" 값(콘텐츠 슬롯 키)은 그대로 유지한다.
- 새 섹션/컬럼/컴포넌트를 추가·삭제·재배치하거나 토큰 색을 조정할 수 있다.
- 임의 HTML/script/style/CSS를 넣지 않는다. href는 http(s)/상대경로만.
- 없는 사실(가격·수치·후기)을 지어내지 않는다. 후기는 '예시'로 표시.

반드시 수정된 전체 스키마 JSON 하나만 반환하세요(설명 금지).`;

  const user = `현재 Page Schema:
${JSON.stringify(input.schema).slice(0, 12000)}

수정 요청: ${input.instruction.slice(0, 500)}

수정된 전체 Page Schema를 순수 JSON으로만 반환하세요.`;

  return { system, user };
}
