import type { ComponentNode, PageSchema } from "./pageSchema";
import {
  newId,
  type DesignDocument,
  type DocNode,
  type NodeId,
  type StyleProps,
} from "./document";

/**
 * V1 PageSchema(section→row→column→component) → V2 Document(중첩 트리) 어댑터.
 * 기존 템플릿/문서를 손실 없이 새 모델로 읽기 위한 호환 레이어(문서 §8).
 * 반복 실행해도 동일 결과(멱등), 원본은 보존(이 함수는 새 문서만 반환).
 */

function leafFromComponent(c: ComponentNode): DocNode {
  const id = newId("c");
  const base: Partial<StyleProps> = {};
  const props: Record<string, unknown> = {};
  switch (c.type) {
    case "heading":
      props.level = c.level;
      props.text = c.text;
      if (c.color) base.color = c.color;
      break;
    case "text":
      props.html = c.html;
      break;
    case "image":
      props.src = c.src;
      props.alt = c.alt;
      props.ratio = c.ratio;
      break;
    case "button":
      props.label = c.label;
      if (c.href) props.href = c.href;
      props.variant = c.style ?? "primary";
      break;
    case "list":
      props.ordered = c.ordered;
      props.items = c.items;
      break;
    case "card":
      props.title = c.title;
      props.body = c.body;
      if (c.image) props.image = c.image;
      break;
    case "spacer":
      props.size = c.size;
      break;
    case "divider":
      break;
  }
  return {
    id,
    type: c.type,
    props,
    style: { base },
    slot: (c as { slot?: string }).slot,
  };
}

export function migratePageSchemaToDocument(schema: PageSchema): DesignDocument {
  const nodes: Record<NodeId, DocNode> = {};
  const add = (n: DocNode) => {
    nodes[n.id] = n;
    return n.id;
  };

  const sectionIds: NodeId[] = [];
  for (const sec of schema.sections ?? []) {
    const rowIds: NodeId[] = [];
    for (const row of sec.rows ?? []) {
      const colIds: NodeId[] = [];
      for (const col of row.columns ?? []) {
        const compIds = (col.components ?? []).map((c) => add(leafFromComponent(c)));
        colIds.push(
          add({
            id: newId("col"),
            type: "container",
            style: {
              base: {
                display: "flex",
                direction: "column",
                gap: 2,
                grow: 1,
                colSpan: Math.min(12, Math.max(1, col.span || 12)),
              },
            },
            children: compIds,
          }),
        );
      }
      rowIds.push(
        add({
          id: newId("row"),
          type: "container",
          style: { base: { display: "flex", direction: "row", wrap: true, gap: 3 } },
          children: colIds,
        }),
      );
    }
    const secBase: Partial<StyleProps> = {
      display: "flex",
      direction: "column",
      gap: 4,
      paddingX: 2,
      paddingY: 8,
    };
    const l = sec.layout?.base;
    if (l?.background) secBase.background = l.background;
    if (l?.maxWidth) secBase.maxWidth = l.maxWidth;
    if (l?.align) secBase.align = l.align;
    sectionIds.push(
      add({ id: newId("sec"), type: "section", style: { base: secBase }, children: rowIds }),
    );
  }

  const root = newId("page");
  nodes[root] = {
    id: root,
    type: "page",
    style: { base: { display: "flex", direction: "column" } },
    children: sectionIds,
  };

  return {
    version: 2,
    tokens: schema.tokens,
    root,
    nodes,
    revision: 1,
  };
}
