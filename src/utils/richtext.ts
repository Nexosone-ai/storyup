/**
 * 랜딩페이지 텍스트 필드의 인라인 리치텍스트(위지윅) 처리.
 *
 * 저장 형식: 서식이 있으면 제한된 인라인 HTML(<b> <i> <u> <s> <mark> <span style>),
 * 없으면 기존과 같은 순수 텍스트. 서버·클라이언트 양쪽에서 동작해야 하므로
 * DOM 없이 정규식 토크나이저로 화이트리스트 새니타이즈한다.
 */

/** 속성 없이 그대로 통과시키는 서식 태그 */
const SIMPLE_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "mark"]);

/** execCommand("fontSize", 1~7)가 만드는 <font size> → 상대 크기 매핑 */
const FONT_SIZE_EM: Record<string, string> = {
  "1": "0.7em",
  "2": "0.85em",
  "3": "1em",
  "4": "1.15em",
  "5": "1.35em",
  "6": "1.7em",
  "7": "2.1em",
};

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i;
const FONT_SIZE_RE = /^[\d.]+(em|rem|px|%)$/i;

/** 값에 서식(또는 붙여넣기로 들어온) HTML 태그가 있는지 — 렌더 경로 분기용. */
export function hasRichHtml(value: string): boolean {
  return /<\/?(b|strong|i|em|u|s|strike|mark|span|font|br|div|p|li|h[1-6])\b/i.test(
    value,
  );
}

/** 태그를 모두 제거한 순수 텍스트 — 메타 설명·쇼케이스 카드 등 평문 맥락용. */
export function stripHtml(value: string): string {
  if (!/[<&]/.test(value)) return value;
  return decodeEntities(value.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** 기본 HTML 엔티티를 되돌린다 (innerHTML 커밋 결과가 평문일 때 사용). */
export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function escapeText(text: string): string {
  return text
    .replace(/&(?![a-z]+;|#\d+;|#x[0-9a-f]+;)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** style 속성에서 안전한 선언(color/background-color/font-size)만 남긴다. */
function safeStyle(style: string): string {
  const decls: string[] = [];
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (!value || value.includes('"')) continue;
    if ((prop === "color" || prop === "background-color") && COLOR_RE.test(value))
      decls.push(`${prop}:${value}`);
    else if (prop === "font-size" && FONT_SIZE_RE.test(value))
      decls.push(`${prop}:${value}`);
  }
  return decls.join(";");
}

function attrValue(tag: string, name: string): string | null {
  const m = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim();
}

/** 닫는 태그 — 스택과 짝이 맞을 때만, 그 위에 쌓인 태그도 함께 닫는다. */
function closeTag(name: string, open: string[]): string {
  const idx = open.lastIndexOf(name);
  if (idx < 0) return "";
  let out = "";
  while (open.length > idx) out += `</${open.pop()}>`;
  return out;
}

function sanitizeTag(tag: string, open: string[]): string {
  const closing = tag.match(/^<\/\s*([a-z0-9]+)/i);
  if (closing) {
    let name = closing[1].toLowerCase();
    if (name === "strike") name = "s";
    if (name === "font") name = "span";
    if (name === "span" || SIMPLE_TAGS.has(name)) return closeTag(name, open);
    return "";
  }
  const opening = tag.match(/^<\s*([a-z0-9]+)/i);
  if (!opening) return "";
  let name = opening[1].toLowerCase();
  if (name === "strike") name = "s";

  if (SIMPLE_TAGS.has(name) || name === "s") {
    open.push(name);
    return `<${name}>`;
  }
  if (name === "span" || name === "font") {
    let style = "";
    if (name === "span") {
      style = safeStyle(attrValue(tag, "style") ?? "");
    } else {
      // <font color size> → span 스타일로 변환
      const decls: string[] = [];
      const color = attrValue(tag, "color");
      if (color && COLOR_RE.test(color)) decls.push(`color:${color}`);
      const size = attrValue(tag, "size");
      if (size && FONT_SIZE_EM[size]) decls.push(`font-size:${FONT_SIZE_EM[size]}`);
      style = decls.join(";");
      name = "span";
    }
    open.push("span");
    return style ? `<span style="${style}">` : "<span>";
  }
  // 그 외 태그(script, img, a …)는 통째로 제거
  return "";
}

/**
 * contentEditable 결과(또는 저장된 값)를 화이트리스트 기준으로 정리한다.
 * 블록 태그·<br>는 줄바꿈 문자로 통일해 기존 평문(\n) 렌더링과 호환시킨다.
 */
export function sanitizeInlineHtml(html: string): string {
  const normalized = html
    // 내용까지 위험한 태그는 통째로 제거
    .replace(
      /<(script|style|iframe|object|embed|textarea|noscript|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      "",
    )
    // 빈 줄을 나타내는 <div><br></div>가 줄바꿈 2개로 늘지 않게 br을 걷어낸다
    .replace(/<(div|p)(\s[^>]*)?>\s*<br\s*\/?\s*>\s*<\/\1\s*>/gi, "<$1></$1>")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<(div|p|li|h[1-6]|blockquote|tr)(\s[^>]*)?>/gi, "\n")
    .replace(/<\/?(div|p|li|ul|ol|h[1-6]|blockquote|table|tbody|tr|td|th)(\s[^>]*)?>/gi, "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  let out = "";
  let last = 0;
  const open: string[] = [];
  const re = /<[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized))) {
    out += escapeText(normalized.slice(last, m.index));
    out += sanitizeTag(m[0], open);
    last = re.lastIndex;
  }
  out += escapeText(normalized.slice(last));
  while (open.length) out += `</${open.pop()}>`;
  return out;
}
