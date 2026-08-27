import type { Metadata } from "next";
import {
  Inter,
  Sora,
  Space_Grotesk,
  DM_Serif_Display,
  Geist_Mono,
  Noto_Sans_KR,
  Noto_Serif_KR,
  Gowun_Dodum,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
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
      className={`${inter.variable} ${sora.variable} ${spaceGrotesk.variable} ${dmSerif.variable} ${geistMono.variable} ${notoSansKr.variable} ${notoSerifKr.variable} ${gowunDodum.variable} h-full antialiased`}
    >
      <body className="min-h-full cyber-grid">{children}</body>
    </html>
  );
}
