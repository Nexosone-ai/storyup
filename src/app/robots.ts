import type { MetadataRoute } from "next";
import { siteUrl } from "@/utils/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/business", "/onboarding", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
