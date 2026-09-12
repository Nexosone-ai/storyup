import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트 — "앱 설치하기" 기능의 기반.
 * Next가 /manifest.webmanifest 로 서빙하고 <link rel="manifest">를 자동 삽입한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "STORYUP — 당신의 이야기를 비즈니스로",
    short_name: "STORYUP",
    description:
      "AI가 브랜드·랜딩페이지·블로그·카드뉴스를 만들어주는 사장님 마케팅 도구.",
    start_url: "/dashboard",
    id: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e8703a",
    lang: "ko",
    orientation: "portrait",
    icons: [
      {
        src: "/images/logo-icon.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/logo-badge.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
