import type { WebsiteContent } from "@/types/domain";
import {
  TemplateRenderer,
  staticText,
  staticImage,
  staticGallery,
} from "./templates";

/**
 * Public homepage renderer. Server-safe (static text). Picks the layout from
 * content.template. Used by the public /site route and the editor's preview.
 */
export function SiteRenderer({
  content,
  blogHref,
  scoped = false,
}: {
  content: WebsiteContent;
  blogHref?: string;
  scoped?: boolean;
}) {
  return (
    <div className={scoped ? "" : "min-h-dvh"}>
      <TemplateRenderer
        content={content}
        T={staticText}
        Img={staticImage}
        Gallery={staticGallery}
        blogHref={blogHref}
        scoped={scoped}
      />
    </div>
  );
}
