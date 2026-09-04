import type { CSSProperties, ElementType, ReactNode } from "react";
import type { WebsiteContent } from "@/types/domain";
import { hasRichHtml, sanitizeInlineHtml } from "@/utils/richtext";
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
  /** 랜딩페이지 하단에 보여줄 최신 블로그 글 (최대 3개). */
  latestPosts?: import("./BlogPreview").SitePostPreview[];
  scoped?: boolean;
  editable?: boolean;
}

/** Server-safe renderer: plain text, no interactivity.
 *  위지윅 서식이 저장된 값은 화이트리스트 새니타이즈 후 HTML로 렌더링한다. */
export const staticText: TextRenderer = ({
  value,
  as = "span",
  className,
  style,
}) => {
  const Tag = as as ElementType;
  if (hasRichHtml(value)) {
    return (
      <Tag
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(value) }}
      />
    );
  }
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

/** 직접 업로드한 가게 로고 — 사이트 헤더에서 이름 옆에 표시한다 (없으면 렌더 안 함). */
export function SiteLogo({
  src,
  className = "h-8 max-w-32",
}: {
  src?: string;
  className?: string;
}) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원격 이미지, 높이 고정
    <img src={src} alt="" className={`w-auto shrink-0 object-contain ${className}`} />
  );
}

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

// ---- 사이트 콘텐츠 언어 (세 템플릿 공용) ----

export type SiteLang = "ko" | "en";

/**
 * 사이트 콘텐츠 언어 — 저장된 값이 있으면 그것을, 없으면(과거 생성 사이트)
 * 히어로·스토리 텍스트의 한글 포함 여부로 추정한다.
 */
export function siteLang(content: WebsiteContent): SiteLang {
  if (content.language) return content.language === "en" ? "en" : "ko";
  const probe = `${content.hero?.headline ?? ""}${content.hero?.shortDescription ?? ""}${content.story?.body ?? ""}`;
  if (!probe.trim()) return "ko";
  return /[가-힣]/.test(probe) ? "ko" : "en";
}

/** 템플릿 크롬(내비게이션·섹션 제목 폴백)에 쓰는 고정 문구. */
export const SITE_UI: Record<
  SiteLang,
  { about: string; contact: string; blog: string; inquire: string; space: string; latestPosts: string; viewAll: string }
> = {
  ko: { about: "소개", contact: "연락처", blog: "블로그", inquire: "문의하기", space: "공간", latestPosts: "최신 글", viewAll: "전체 보기 →" },
  en: { about: "About", contact: "Contact", blog: "Blog", inquire: "Contact us", space: "Our Space", latestPosts: "Latest posts", viewAll: "View all →" },
};

// ---- Contact 필드 정의 (세 템플릿 공용) ----

export type ContactKey = keyof WebsiteContent["contact"];

/** [키, 한국어 라벨, 영어 라벨] */
export const CONTACT_FIELDS: Array<[ContactKey, string, string]> = [
  ["phone", "전화", "Phone"],
  ["email", "이메일", "Email"],
  ["address", "주소", "Address"],
  ["instagram", "인스타그램", "Instagram"],
  ["facebook", "페이스북", "Facebook"],
  ["x", "X (트위터)", "X (Twitter)"],
  ["website", "웹사이트", "Website"],
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
