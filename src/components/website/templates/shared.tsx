import type { CSSProperties, ElementType, ReactNode } from "react";
import Link from "next/link";
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

/** AI 생성 시 요청할 이미지 비율 — 표시 박스에 맞춰 지정한다. */
export type GenAspect = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";

export interface ImageArgs {
  path: string;
  value?: string;
  className?: string;
  kind?: "cover" | "hero";
  /** AI 생성 이미지 비율 힌트 (표시 박스 비율). 지정 안 하면 kind로 추정. */
  aspect?: GenAspect;
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
  /** 공개 사이트 슬러그 — 있으면 Contact 섹션에 실제 문의 폼을 렌더링한다.
   *  에디터 미리보기에선 없음(비활성 미리보기). */
  siteSlug?: string;
  /** 사이트 주인이 볼 때만 넘어오는 편집 화면 링크 — 헤더에 "편집" 바로가기를 표시한다. */
  editHref?: string;
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
    // eslint-disable-next-line @next/next/no-img-element -- 업로드 원본이 잘리지 않도록 카드류는 contain (hero 배경만 cover)
    <img
      src={value}
      alt=""
      className={`h-full w-full object-contain ${className ?? ""}`}
    />
  );
};

/**
 * 사이트 헤더에서 이름 옆에 표시하는 가게 로고.
 * - 직접 업로드한 로고(src)가 있으면 원본 비율로 표시.
 * - 로고가 없고 hero 사진(fallback)이 있으면 그 사진을 작은 정사각 아바타로 자동 사용.
 * - 둘 다 없으면 렌더하지 않음.
 */
export function SiteLogo({
  src,
  fallback,
  className = "h-8 max-w-32",
  fallbackClassName = "size-8",
}: {
  src?: string;
  /** 로고 미설정 시 대체로 쓸 hero 사진 URL. */
  fallback?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원격 이미지, 높이 고정
      <img src={src} alt="" className={`w-auto shrink-0 object-contain ${className}`} />
    );
  }
  if (fallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 로고 미설정 시 hero 사진을 아바타로 자동 사용
      <img
        src={fallback}
        alt=""
        className={`shrink-0 rounded-lg object-cover ${fallbackClassName}`}
      />
    );
  }
  return null;
}

/** 사이트 주인이 공개 페이지를 볼 때 헤더에 뜨는 "편집" 바로가기 (방문자에겐 안 보임). */
export function SiteEditLink({
  href,
  lang,
}: {
  href: string;
  lang: SiteLang;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      {lang === "en" ? "Edit" : "편집"}
    </Link>
  );
}

/** 랜딩·블로그 풋터의 "Powered by STORYUP" — STORYUP 홈으로 가는 바로가기 버튼.
 *  단순 텍스트가 아니라 화살표가 붙은 버튼 모양으로, 눌러서 이동하는 링크임을 분명히 한다. */
export function PoweredByStoryup({
  lang = "ko",
  className,
}: {
  lang?: SiteLang;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-wrap items-center px-2 gap-x-1.5 gap-y-1 ${className ?? ""}`}
    >
      Powered by
      <Link
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={lang === "en" ? "Visit STORYUP" : "STORYUP 바로가기"}
        className="group inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 transition-colors hover:border-primary hover:bg-primary-soft"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 */}
        <img
          src="/images/logo-icon.png"
          alt=""
          className="size-5 shrink-0 object-contain"
        />
        <span className="text-sm font-extrabold tracking-tight text-foreground">
          STORY<span className="brand-gradient-text">UP</span>
        </span>
        <span className="font-semibold text-foreground group-hover:text-primary">
          {lang === "en" ? "Visit" : "바로가기"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-muted group-hover:text-primary"
        >
          <path d="M7 17 17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </Link>
    </span>
  );
}

/**
 * 주소가 입력돼 있으면 Contact 섹션에 보여주는 구글 지도.
 * API 키 없이 주소 텍스트로 임베드한다(키리스 embed) — 사장님이 별도 설정할 게 없다.
 */
export function SiteMap({
  address,
  lang = "ko",
  className,
}: {
  address: string;
  lang?: SiteLang;
  className?: string;
}) {
  const q = address.trim();
  if (!q) return null;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=${lang}&z=16&output=embed`;
  return (
    // STORYUP 배경(따뜻한 오프화이트)과 어울리는 primary-soft 매트 프레임.
    <div
      className={`rounded-2xl border border-primary/15 bg-primary-soft/40 p-1.5 ${className ?? ""}`}
    >
      <iframe
        title={lang === "en" ? "Map" : "지도"}
        src={src}
        className="block h-56 w-full rounded-xl sm:h-72"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
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
  { about: string; contact: string; blog: string; inquire: string; space: string; latestPosts: string; viewAll: string; directions: string }
> = {
  ko: { about: "소개", contact: "연락처", blog: "블로그", inquire: "문의하기", space: "공간", latestPosts: "최신 글", viewAll: "전체 보기 →", directions: "오시는 길" },
  en: { about: "About", contact: "Contact", blog: "Blog", inquire: "Contact us", space: "Our Space", latestPosts: "Latest posts", viewAll: "View all →", directions: "Find us" },
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
