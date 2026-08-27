import { siteStyleVars } from "@/components/website/siteStyle";
import { getPublishedSite } from "@/lib/queries";

/** Applies the site owner's chosen palette/font to the homepage and blog. */
export default async function PublishedSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const style = site ? siteStyleVars(site.website.content.style) : undefined;

  return (
    <div className="min-h-dvh" style={style}>
      {children}
    </div>
  );
}
