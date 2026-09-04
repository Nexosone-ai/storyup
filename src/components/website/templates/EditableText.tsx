"use client";

import { useEffect, useRef } from "react";
import type { ElementType } from "react";
import { cn } from "@/utils/cn";
import {
  decodeEntities,
  hasRichHtml,
  sanitizeInlineHtml,
} from "@/utils/richtext";
import type { TextRenderer } from "./shared";

/** 서식(볼드·색상 등)을 허용하는 필드 — 평문 맥락(쇼케이스·메타)에 쓰이는
 *  businessName·ctaLabel·연락처는 제외한다. */
const RICH_PATH =
  /^(hero\.(headline|shortDescription)|story\.(title|body)|(offers|whyChooseUs)\.(title|items\.\d+\.(title|description)))$/;

/**
 * Inline-editable text (contentEditable). Uncontrolled while focused to keep
 * the caret stable; commits to state on input/blur. rich 필드는 제한된 인라인
 * HTML(굵게·색상 등)을 저장하고, 나머지는 기존처럼 순수 텍스트만 저장한다.
 */
function EditableText({
  value,
  onChange,
  as = "span",
  className,
  style,
  placeholder,
  rich,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  rich?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const focused = useRef(false);
  const lastCommitted = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || focused.current || value === lastCommitted.current) return;
    if (rich && hasRichHtml(value)) el.innerHTML = sanitizeInlineHtml(value);
    else if (el.textContent !== value) el.textContent = value;
    lastCommitted.current = value;
  }, [value, rich]);

  /** 현재 DOM 내용을 저장용 값으로 — 서식이 없으면 평문으로 되돌린다. */
  const readValue = (el: HTMLElement): string => {
    if (!rich) return el.textContent ?? "";
    const html = sanitizeInlineHtml(el.innerHTML);
    return /<[a-z]/i.test(html) ? html : decodeEntities(html);
  };

  const Tag = as as ElementType;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      data-rich={rich ? "true" : undefined}
      onFocus={() => (focused.current = true)}
      onInput={(e: React.FormEvent<HTMLElement>) => {
        const v = readValue(e.currentTarget);
        lastCommitted.current = v;
        onChange(v);
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        focused.current = false;
        const el = e.currentTarget;
        const v = readValue(el);
        lastCommitted.current = v;
        // 붙여넣기 등으로 들어온 비허용 서식은 화면에서도 정리해 보이게 한다.
        if (rich) {
          if (hasRichHtml(v)) el.innerHTML = sanitizeInlineHtml(v);
          else if (el.textContent !== v) el.textContent = v;
        }
        onChange(v);
      }}
      className={cn(
        "cursor-text rounded-sm outline-none ring-primary/40 transition hover:bg-primary-soft/40 focus:bg-primary-soft/50 focus:ring-2",
        className,
      )}
      style={style}
    />
  );
}

/** Builds a TextRenderer that edits in place and reports changes via onEdit. */
export function makeEditableRenderer(
  onEdit: (path: string, value: string) => void,
): TextRenderer {
  return function EditableField({ path, value, as, className, style, placeholder }) {
    return (
      <EditableText
        value={value}
        onChange={(v) => onEdit(path, v)}
        as={as}
        className={className}
        style={style}
        placeholder={placeholder}
        rich={RICH_PATH.test(path)}
      />
    );
  };
}
