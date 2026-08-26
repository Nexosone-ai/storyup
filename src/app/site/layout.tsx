/**
 * Published business sites keep the original light "editorial paper" palette —
 * they belong to business owners and are shown to their customers, so the
 * app's Neon Tokyo theme must not leak into them.
 */
export default function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="theme-editorial-light min-h-dvh">{children}</div>;
}
