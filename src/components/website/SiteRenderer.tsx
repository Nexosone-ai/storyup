import type { WebsiteContent } from "@/types/domain";
import {
  TemplateRenderer,
  staticText,
  staticImage,
  staticGallery,
} from "./templates";
import type { SitePostPreview } from "./templates/BlogPreview";
import type { ShowcaseCardItem } from "@/components/marketing/showcaseData";

/**
 * Public homepage renderer. Server-safe (static text). Picks the layout from
 * content.template. Used by the public /site route and the editor's preview.
 */
export function SiteRenderer({
  content,
  blogHref,
  latestPosts,
  cards,
  scoped = false,
  siteSlug,
  editHref,
}: {
  content: WebsiteContent;
  blogHref?: string;
  latestPosts?: SitePostPreview[];
  /** 랜딩페이지 "카드뉴스" 섹션에 보여줄 이 가게의 카드뉴스. */
  cards?: ShowcaseCardItem[];
  scoped?: boolean;
  /** 공개 사이트 슬러그 — Contact 섹션의 문의 폼을 활성화한다. */
  siteSlug?: string;
  /** 사이트 주인이 볼 때만 넘어오는 편집 화면 링크 — 헤더에 "편집" 버튼 표시. */
  editHref?: string;
}) {
  return (
    <div className={scoped ? "" : "min-h-dvh"}>
      <TemplateRenderer
        content={content}
        T={staticText}
        Img={staticImage}
        Gallery={staticGallery}
        blogHref={blogHref}
        latestPosts={latestPosts}
        cards={cards}
        scoped={scoped}
        siteSlug={siteSlug}
        editHref={editHref}
      />
    </div>
  );
}
