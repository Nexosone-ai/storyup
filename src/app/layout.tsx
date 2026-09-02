import type { Metadata } from "next";
import {
  Outfit,
  Fraunces,
  Geist_Mono,
  Noto_Sans_KR,
  Noto_Serif_KR,
  Gowun_Dodum,
} from "next/font/google";
import "./globals.css";

// 브랜드 서체 — 본문 Outfit(지오메트릭 산스), 디스플레이 Fraunces(세리프)
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Site-editor font choices (loaded lazily; used on published business sites)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  preload: false,
});

const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  subsets: ["latin"],
  preload: false,
});

const gowunDodum = Gowun_Dodum({
  variable: "--font-gowun-dodum",
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "STORYUP — 당신의 이야기를 비즈니스로",
    template: "%s · STORYUP",
  },
  description:
    "사업 이야기를 들려주세요. AI가 브랜드, 홈페이지, 블로그 콘텐츠로 만들어드립니다.",
  openGraph: {
    title: "STORYUP",
    description: "Turn Your Story Into Business.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${outfit.variable} ${fraunces.variable} ${geistMono.variable} ${notoSansKr.variable} ${notoSerifKr.variable} ${gowunDodum.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* 프리텐다드 — 사이트 에디터 폰트 옵션용 (구글 폰트 미제공, 동적 서브셋 CDN 사용) */}
        <link
          rel="stylesheet"
          precedence="default"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {children}
      </body>
    </html>
  );
}
