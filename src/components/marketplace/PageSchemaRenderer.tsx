import type { CSSProperties } from "react";
import type {
  Column,
  ComponentNode,
  DesignTokens,
  LayoutProps,
  PageSchema,
  Row,
  Section,
  SpaceToken,
} from "@/lib/marketplace/pageSchema";

/**
 * 통합 Page Schema 렌더러 — 편집 캔버스와 공개 사이트가 공유한다.
 * 검증된 스키마만 받는다(validatePageSchema 통과분). 토큰·열거값으로만 스타일링하며
 * 임의 CSS/스크립트를 실행하지 않는다. 텍스트 html은 이미 새니타이즈된 값이다.
 */

function px(unit: number, token: SpaceToken | undefined): number | undefined {
  if (token == null) return undefined;
  return unit * token;
}

function colorOf(v: string | undefined, tokens: DesignTokens): string | undefined {
  if (v == null) return undefined;
  if (v === "transparent") return "transparent";
  return tokens.colors[v] ?? v;
}

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

function layoutStyle(
  l: LayoutProps | undefined,
  tokens: DesignTokens,
  unit: number,
): CSSProperties {
  if (!l) return {};
  return {
    justifyContent: l.justify ? JUSTIFY[l.justify] : undefined,
    alignItems: l.align ? ALIGN[l.align] : undefined,
    gap: px(unit, l.gap),
    paddingLeft: px(unit, l.paddingX),
    paddingRight: px(unit, l.paddingX),
    paddingTop: px(unit, l.paddingY),
    paddingBottom: px(unit, l.paddingY),
    background: colorOf(l.background, tokens),
    maxWidth: l.maxWidth,
  };
}

function ComponentView({ node, tokens }: { node: ComponentNode; tokens: DesignTokens }) {
  switch (node.type) {
    case "heading": {
      const Tag = (`h${node.level}` as "h1" | "h2" | "h3" | "h4");
      return (
        <Tag
          style={{ color: colorOf(node.color, tokens) }}
          dangerouslySetInnerHTML={{ __html: node.text }}
        />
      );
    }
    case "text":
      return <div dangerouslySetInnerHTML={{ __html: node.html }} />;
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element -- 스키마 렌더러(동적 외부/상대 주소)
        <img
          src={node.src}
          alt={node.alt}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: tokens.radius }}
        />
      );
    case "button": {
      const primary = (node.style ?? "primary") === "primary";
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
      return node.href ? (
        <a href={node.href} style={style}>
          {node.label}
        </a>
      ) : (
        <span style={style}>{node.label}</span>
      );
    }
    case "list": {
      const List = node.ordered ? "ol" : "ul";
      return (
        <List style={{ paddingLeft: 20 }}>
          {node.items.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </List>
      );
    }
    case "card":
      return (
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: tokens.radius ?? 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {node.image && (
            // eslint-disable-next-line @next/next/no-img-element -- 스키마 렌더러
            <img src={node.image} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
          )}
          <div style={{ padding: 16 }}>
            {node.title && (
              <p style={{ fontWeight: 700 }} dangerouslySetInnerHTML={{ __html: node.title }} />
            )}
            {node.body && (
              <div style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: node.body }} />
            )}
          </div>
        </div>
      );
    case "spacer":
      return <div style={{ height: (tokens.spacingUnit ?? 8) * node.size }} />;
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.1)" }} />;
    default:
      return null;
  }
}

function ColumnView({ col, tokens, unit }: { col: Column; tokens: DesignTokens; unit: number }) {
  const basis = `${(Math.min(12, Math.max(1, col.span)) / 12) * 100}%`;
  return (
    <div
      style={{
        flex: `1 1 ${basis}`,
        minWidth: 240, // 좁은 화면에서 자동 세로 적층(반응형 기본)
        display: "flex",
        flexDirection: "column",
        gap: unit * 2,
        ...layoutStyle(col.layout, tokens, unit),
      }}
    >
      {col.components.map((c, i) => (
        <ComponentView key={i} node={c} tokens={tokens} />
      ))}
    </div>
  );
}

function RowView({ row, tokens, unit }: { row: Row; tokens: DesignTokens; unit: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: unit * 3,
        ...layoutStyle(row.layout, tokens, unit),
      }}
    >
      {row.columns.map((c, i) => (
        <ColumnView key={i} col={c} tokens={tokens} unit={unit} />
      ))}
    </div>
  );
}

function SectionView({ section, tokens, unit }: { section: Section; tokens: DesignTokens; unit: number }) {
  const base = section.layout?.base;
  return (
    <section
      style={{
        background: colorOf(base?.background, tokens),
        paddingTop: px(unit, base?.paddingY) ?? unit * 8,
        paddingBottom: px(unit, base?.paddingY) ?? unit * 8,
        paddingLeft: px(unit, base?.paddingX) ?? unit * 2,
        paddingRight: px(unit, base?.paddingX) ?? unit * 2,
      }}
    >
      <div
        style={{
          maxWidth: base?.maxWidth ?? 1120,
          marginLeft: "auto",
          marginRight: "auto",
          display: "flex",
          flexDirection: "column",
          gap: unit * 4,
        }}
      >
        {section.rows.map((r, i) => (
          <RowView key={i} row={r} tokens={tokens} unit={unit} />
        ))}
      </div>
    </section>
  );
}

export function PageSchemaRenderer({ schema }: { schema: PageSchema }) {
  const tokens = schema.tokens;
  const unit = tokens.spacingUnit ?? 8;
  return (
    <div
      style={{
        color: colorOf("text", tokens) ?? "#111827",
        background: colorOf("bg", tokens) ?? "#ffffff",
        fontFamily: tokens.fontFamily,
      }}
    >
      {schema.sections.map((s) => (
        <SectionView key={s.id} section={s} tokens={tokens} unit={unit} />
      ))}
    </div>
  );
}
