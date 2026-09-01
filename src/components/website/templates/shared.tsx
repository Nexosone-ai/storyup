import type { CSSProperties, ElementType, ReactNode } from "react";
import type { WebsiteContent } from "@/types/domain";
import { GalleryLightbox } from "./GalleryLightbox";

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

export interface ImageArgs {
  path: string;
  value?: string;
  className?: string;
  kind?: "cover" | "hero";
}

/** Renders an image slot — either a static <img> or an editable uploader. */
export type ImageRenderer = (args: ImageArgs) => ReactNode;

/** Renders the photo gallery grid — static or editable (add/remove). */
export type GalleryRenderer = (images: string[]) => ReactNode;

export interface TemplateProps {
  content: WebsiteContent;
  T: TextRenderer;
  Img: ImageRenderer;
  Gallery: GalleryRenderer;
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

/** Gallery renderer for the public site — 클릭하면 크게 보는 라이트박스. */
export const staticGallery: GalleryRenderer = (images) => {
  if (!images?.length) return null;
  return <GalleryLightbox images={images} />;
};

/** Server-safe image renderer for the public site. */
export const staticImage: ImageRenderer = ({ value, className, kind }) => {
  if (!value) return null;
  if (kind === "hero") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={value}
      alt=""
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
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

// ---- Contact 필드 정의 (세 템플릿 공용) ----

export type ContactKey = keyof WebsiteContent["contact"];

export const CONTACT_FIELDS: Array<[ContactKey, string]> = [
  ["phone", "전화"],
  ["email", "이메일"],
  ["address", "주소"],
  ["instagram", "인스타그램"],
  ["facebook", "페이스북"],
  ["x", "X (트위터)"],
  ["website", "웹사이트"],
];

/** 공개 화면에서 연락처 값을 클릭 가능한 링크로 만들 때의 href (없으면 null). */
export function contactHref(key: ContactKey, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (key) {
    case "phone":
      return `tel:${v.replace(/[^+\d]/g, "")}`;
    case "email":
      return `mailto:${v}`;
    case "instagram":
      if (/^https?:\/\//i.test(v)) return v;
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    case "facebook":
      if (/^https?:\/\//i.test(v)) return v;
      return `https://facebook.com/${v.replace(/^@/, "")}`;
    case "x":
      if (/^https?:\/\//i.test(v)) return v;
      return `https://x.com/${v.replace(/^@/, "")}`;
    case "website":
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    default:
      return null;
  }
}

/**
 * Contact 한 줄 — 에디터에선 인라인 편집(T), 공개 화면에선 링크로 렌더링.
 * 세 템플릿이 공유한다.
 */
export function ContactEntry({
  k,
  label,
  value,
  T,
  editable,
}: {
  k: ContactKey;
  label: string;
  value: string;
  T: TextRenderer;
  editable?: boolean;
}) {
  if (!editable && !value) return null;
  const href = !editable ? contactHref(k, value) : null;
  return (
    <p>
      <span className="mr-2 font-medium text-muted">{label}</span>
      {href ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="underline-offset-2 hover:underline"
        >
          {value}
        </a>
      ) : (
        T({ path: `contact.${k}`, value, as: "span", placeholder: label })
      )}
    </p>
  );
}
