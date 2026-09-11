import type { WebsiteContent } from "@/types/domain";
import {
  TemplateRenderer,
  staticText,
  staticImage,
  staticGallery,
} from "./templates";
import type { SitePostPreview } from "./templates/BlogPreview";

/**
 * Public homepage renderer. Server-safe (static text). Picks the layout from
 * content.template. Used by the public /site route and the editor's preview.
 */
export function SiteRenderer({
  content,
  blogHref,
  latestPosts,
  scoped = false,
  siteSlug,
}: {
  content: WebsiteContent;
  blogHref?: string;
  latestPosts?: SitePostPreview[];
  scoped?: boolean;
  /** 공개 사이트 슬러그 — Contact 섹션의 문의 폼을 활성화한다. */
  siteSlug?: string;
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
        scoped={scoped}
        siteSlug={siteSlug}
      />
    </div>
  );
}
