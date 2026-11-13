import type { WebsiteContent } from "@/types/domain";
import {
  TemplateRenderer,
  staticText,
  staticImage,
  staticGallery,
} from "./templates";
import type {
  SitePostPreview,
  SiteSectionPost,
} from "./templates/BlogPreview";
import type { ShowcaseCardItem } from "@/components/marketing/showcaseData";
import type { SiteVideoItem } from "@/types/domain";

/**
 * Public homepage renderer. Server-safe (static text). Picks the layout from
 * content.template. Used by the public /site route and the editor's preview.
 */
export function SiteRenderer({
  content,
  blogHref,
  latestPosts,
  sectionPosts,
  categories,
  cards,
  videos,
  videosHref,
  scoped = false,
  siteSlug,
  editHref,
}: {
  content: WebsiteContent;
  blogHref?: string;
  latestPosts?: SitePostPreview[];
  /** 블로그 연결 섹션용 — 이 사업장 공개 글 전체(카테고리 포함). */
  sectionPosts?: SiteSectionPost[];
  categories?: string[];
  /** 랜딩페이지 "카드뉴스" 섹션에 보여줄 이 가게의 카드뉴스. */
  cards?: ShowcaseCardItem[];
  /** 랜딩페이지 "영상" 섹션 — 공개된 쇼츠·AI 영상. */
  videos?: SiteVideoItem[];
  /** 공개 영상 페이지 링크(영상이 있을 때). */
  videosHref?: string;
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
        sectionPosts={sectionPosts}
        categories={categories}
        cards={cards}
        videos={videos}
        videosHref={videosHref}
        scoped={scoped}
        siteSlug={siteSlug}
        editHref={editHref}
      />
    </div>
  );
}
