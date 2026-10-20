import type { CSSProperties } from "react";
import type { DesignTokens } from "@/lib/marketplace/pageSchema";
import type {
  DesignDocument,
  DocNode,
  NodeId,
  StyleProps,
} from "@/lib/marketplace/document";

/**
 * V2 문서 렌더러 — 편집 캔버스와 공개 사이트가 공유하는 단일 렌더 규칙.
 * 노드별 base 스타일은 인라인, 기기별(mobile/tablet/desktop) 오버라이드는
 * 생성된 <style>(미디어쿼리)로 적용한다. 검증된 문서만 받는다(임의 코드 미실행).
 */

const MQ = {
  mobile: "@media (max-width:767px)",
  tablet: "@media (min-width:768px) and (max-width:1023px)",
  desktop: "@media (min-width:1024px)",
} as const;

const JUSTIFY: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};
const ALIGN: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};
const SHADOW: Record<string, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.06)",
  md: "0 4px 12px rgba(0,0,0,0.08)",
  lg: "0 12px 32px rgba(0,0,0,0.12)",
};

function colorOf(v: string | undefined, tokens: DesignTokens): string | undefined {
  if (v == null) return undefined;
  if (v === "transparent") return "transparent";
  return tokens.colors[v] ?? v;
}

/** 스타일 한 겹 → CSS 선언 맵(토큰/단위 해석). */
function styleDecls(s: Partial<StyleProps>, tokens: DesignTokens): Record<string, string> {
  const unit = tokens.spacingUnit ?? 8;
  const d: Record<string, string> = {};
  if (s.display) d.display = s.display;
  if (s.display === "flex") {
    d["flex-direction"] = s.direction ?? "row";
    if (s.wrap) d["flex-wrap"] = "wrap";
    if (s.justify) d["justify-content"] = JUSTIFY[s.justify];
    if (s.align) d["align-items"] = ALIGN[s.align];
  }
  if (s.display === "grid") {
    d["grid-template-columns"] = `repeat(${s.gridColumns ?? 2}, minmax(0,1fr))`;
  }
  if (s.gap != null) d.gap = `${s.gap * unit}px`;
  if (s.grow != null) d["flex-grow"] = String(s.grow);
  if (s.colSpan != null) d["grid-column"] = `span ${s.colSpan}`;
  if (s.widthMode === "fill") d.width = "100%";
  else if (s.widthMode === "fixed" && s.width != null) d.width = `${s.width}px`;
  if (s.maxWidth != null) d["max-width"] = `${s.maxWidth}px`;
  if (s.minWidth != null) d["min-width"] = `${s.minWidth}px`;
  if (s.paddingX != null) {
    d["padding-left"] = `${s.paddingX * unit}px`;
    d["padding-right"] = `${s.paddingX * unit}px`;
  }
  if (s.paddingY != null) {
    d["padding-top"] = `${s.paddingY * unit}px`;
    d["padding-bottom"] = `${s.paddingY * unit}px`;
  }
  if (s.marginY != null) {
    d["margin-top"] = `${s.marginY * unit}px`;
    d["margin-bottom"] = `${s.marginY * unit}px`;
  }
  const bg = colorOf(s.background, tokens);
  if (bg) d.background = bg;
  if (s.radius != null) d["border-radius"] = `${s.radius}px`;
  if (s.shadow) d["box-shadow"] = SHADOW[s.shadow];
  if (s.fontSize != null) d["font-size"] = `${s.fontSize}px`;
  if (s.fontWeight != null) d["font-weight"] = String(s.fontWeight);
  if (s.lineHeight != null) d["line-height"] = String(s.lineHeight);
  if (s.align_text) d["text-align"] = s.align_text;
  const col = colorOf(s.color, tokens);
  if (col) d.color = col;
  return d;
}

const declsToInline = (d: Record<string, string>): CSSProperties => {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  }
  return o as CSSProperties;
};
const declsToCss = (d: Record<string, string>): string =>
  Object.entries(d)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

/** 노드의 base 인라인 스타일. */
function baseInline(node: DocNode, tokens: DesignTokens): CSSProperties {
  return declsToInline(styleDecls(node.style?.base ?? {}, tokens));
}

/** 루트에서 트리를 순회(인스턴스는 원본으로 확장)하며 기기별 오버라이드 CSS 생성. */
function collectResponsiveCss(doc: DesignDocument): string {
  const out: string[] = [];
  const walk = (nodes: Record<NodeId, DocNode>, id: NodeId, prefix: string): void => {
    const node = nodes[id];
    if (!node) return;
    if (node.type === "instance") {
      const def = node.componentRef ? doc.components?.[node.componentRef] : undefined;
      if (def) walk(def.nodes, def.root, `${prefix}${id}/`);
      return;
    }
    const st = node.style;
    if (st) {
      (["mobile", "tablet", "desktop"] as const).forEach((dev) => {
        const over = st[dev];
        if (over && Object.keys(over).length) {
          const decls = declsToCss(styleDecls(over, doc.tokens));
          if (decls) out.push(`${MQ[dev]}{[data-n="${prefix}${id}"]{${decls}}}`);
        }
      });
    }
    for (const c of node.children ?? []) walk(nodes, c, prefix);
  };
  walk(doc.nodes, doc.root, "");
  return out.join("");
}

function Leaf({ node, tokens }: { node: DocNode; tokens: DesignTokens }) {
  const p = node.props ?? {};
  switch (node.type) {
    case "heading": {
      const Tag = (`h${(p.level as number) ?? 2}` as "h1" | "h2" | "h3" | "h4");
      return <Tag dangerouslySetInnerHTML={{ __html: String(p.text ?? "") }} />;
    }
    case "text":
      return <div dangerouslySetInnerHTML={{ __html: String(p.html ?? "") }} />;
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element -- 문서 렌더러(동적 주소)
        <img
          src={String(p.src ?? "")}
          alt={String(p.alt ?? "")}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: tokens.radius }}
        />
      );
    case "button": {
      const primary = (p.variant ?? "primary") === "primary";
      const style: CSSProperties = {
        display: "inline-block",
        padding: "10px 18px",
        borderRadius: tokens.radius ?? 10,
        fontWeight: 600,
        background: primary ? colorOf("primary", tokens) : "transparent",
        color: primary ? "#fff" : colorOf("primary", tokens),
        border: primary ? "none" : `1px solid ${colorOf("primary", tokens) ?? "#4f46e5"}`,
        textDecoration: "none",
      };
      const label = String(p.label ?? "버튼");
      return p.href ? <a href={String(p.href)} style={style}>{label}</a> : <span style={style}>{label}</span>;
    }
    case "list": {
      const List = p.ordered ? "ol" : "ul";
      const items = Array.isArray(p.items) ? (p.items as string[]) : [];
      return (
        <List style={{ paddingLeft: 20 }}>
          {items.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </List>
      );
    }
    case "card":
      return (
        <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: tokens.radius ?? 12, overflow: "hidden", background: "#fff" }}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- 문서 렌더러
            <img src={String(p.image)} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
          ) : null}
          <div style={{ padding: 16 }}>
            {p.title ? <p style={{ fontWeight: 700 }} dangerouslySetInnerHTML={{ __html: String(p.title) }} /> : null}
            {p.body ? <div style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: String(p.body) }} /> : null}
          </div>
        </div>
      );
    case "spacer":
      return <div style={{ height: (tokens.spacingUnit ?? 8) * ((p.size as number) ?? 4) }} />;
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.1)" }} />;
    default:
      return null;
  }
}

function NodeView({
  doc,
  nodes,
  id,
  prefix,
  overrides,
}: {
  doc: DesignDocument;
  nodes: Record<NodeId, DocNode>;
  id: NodeId;
  prefix: string;
  overrides?: Record<string, Record<string, unknown>>;
}) {
  const node = nodes[id];
  if (!node) return null;

  // 인스턴스 — 원본 컴포넌트를 확장(오버라이드 전달·접두사로 id 분리).
  if (node.type === "instance") {
    const def = node.componentRef ? doc.components?.[node.componentRef] : undefined;
    if (!def) return null;
    return (
      <NodeView doc={doc} nodes={def.nodes} id={def.root} prefix={`${prefix}${id}/`} overrides={node.overrides} />
    );
  }

  const inline = baseInline(node, doc.tokens);
  const dataN = `${prefix}${id}`;

  if (node.type === "page" || node.type === "section" || node.type === "container") {
    const style: CSSProperties = { display: inline.display ?? "block", ...inline };
    return (
      <div data-n={dataN} style={style}>
        {(node.children ?? []).map((cid) => (
          <NodeView key={cid} doc={doc} nodes={nodes} id={cid} prefix={prefix} overrides={overrides} />
        ))}
      </div>
    );
  }
  // 잎 — 인스턴스 오버라이드(슬롯 매칭) 적용.
  const effNode =
    node.slot && overrides?.[node.slot]
      ? { ...node, props: { ...(node.props ?? {}), ...overrides[node.slot] } }
      : node;
  return (
    <div data-n={dataN} style={inline}>
      <Leaf node={effNode} tokens={doc.tokens} />
    </div>
  );
}

export function DocumentRenderer({ doc }: { doc: DesignDocument }) {
  const css = collectResponsiveCss(doc);
  return (
    <div
      style={{
        color: colorOf("text", doc.tokens) ?? "#111827",
        background: colorOf("bg", doc.tokens) ?? "#fff",
        fontFamily: doc.tokens.fontFamily,
      }}
    >
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <NodeView doc={doc} nodes={doc.nodes} id={doc.root} prefix="" />
    </div>
  );
}
