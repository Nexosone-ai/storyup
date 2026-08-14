"use client";

import { useEffect, useRef } from "react";
import type { ElementType } from "react";
import { cn } from "@/utils/cn";
import type { TextRenderer } from "./shared";

/**
 * Inline-editable text (contentEditable). Uncontrolled while focused to keep
 * the caret stable; commits to state on blur.
 */
function EditableText({
  value,
  onChange,
  as = "span",
  className,
  style,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !focused.current && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  const Tag = as as ElementType;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        focused.current = false;
        onChange(e.currentTarget.textContent ?? "");
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
      />
    );
  };
}
