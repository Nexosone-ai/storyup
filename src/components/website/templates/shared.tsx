import type { CSSProperties, ElementType, ReactNode } from "react";
import type { WebsiteContent } from "@/types/domain";

export interface TextArgs {
  path: string;
  value: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}

/** Renders a content string — either static text or an inline-editable field. */
export type TextRenderer = (args: TextArgs) => ReactNode;

export interface TemplateProps {
  content: WebsiteContent;
  T: TextRenderer;
  blogHref?: string;
  scoped?: boolean;
  editable?: boolean;
}

/** Server-safe renderer: plain text, no interactivity. */
export const staticText: TextRenderer = ({
  value,
  as = "span",
  className,
  style,
}) => {
  const Tag = as as ElementType;
  return (
    <Tag className={className} style={style}>
      {value}
    </Tag>
  );
};

/** Immutably set a dotted path (e.g. "offers.items.0.title") on a clone. */
export function setPath<T>(obj: T, path: string, value: string): T {
  const clone = structuredClone(obj);
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = clone;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
  return clone;
}

export function ContactRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  if (!value) return null;
  return (
    <p>
      <span className="mr-2 font-medium text-muted">{label}</span>
      {children}
    </p>
  );
}
