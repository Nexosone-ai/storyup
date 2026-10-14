import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { CardNewsSlider } from "@/components/marketing/CardNewsSlider";
import { CardThanksBar } from "@/components/cards/CardThanksBar";
import { Logo } from "@/components/ui/Logo";
import type { CardNewsResult } from "@/types/domain";

const UUID = /^[0-9a-fA-F-]{36}$/;

async function loadCard(id: string) {
  if (!UUID.test(id)) return null;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("marketing_contents")
    .select("id,business_id,content,thanks_count,view_count")
    .eq("id", id)
    .eq("platform", "instagram_cards")
    .maybeSingle();
  if (!row) return null;
  let cardNews: CardNewsResult;
  try {
    cardNews = JSON.parse(row.content) as CardNewsResult;
  } catch {
    return null;
  }
  const { data: biz } = await admin
    .from("businesses")
    .select("name, slug")
    .eq("id", row.business_id)
    .maybeSingle();
  return { row, cardNews, biz };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadCard(id);
  if (!data) return { title: "카드뉴스" };
  const title = data.cardNews.cover?.title || data.biz?.name || "카드뉴스";
  const description = data.cardNews.cover?.subtitle || undefined;
  // 대표 이미지: 렌더된 커버(shareImage) 우선, 없으면 첫 카드 배경.
  const cover = data.cardNews.shareImage || data.cardNews.images?.[0];
  const image = cover
    ? [{ url: cover, width: 1080, height: 1350, alt: title }]
    : undefined;
  return {
    title: `${title} · STORYUP`,
    description,
    openGraph: {
      type: "article",
      url: `/cards/${id}`,
      title,
      description,
      images: image,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function CardSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const data = await loadCard(id);
  if (!data) notFound();

  const { row, cardNews, biz } = data;
  const item = {
    id: row.id,
    href: biz?.slug ? `/site/${biz.slug}` : "/",
    title: cardNews.cover?.title ?? "",
    subtitle: cardNews.cover?.subtitle ?? "",
    businessName: biz?.name ?? "",
    image: cardNews.images?.[0] ?? null,
    handle: `@${biz?.slug ?? "storyup"}`,
    cardNews,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 px-5 py-10">
      <div className="w-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <CardNewsSlider item={item} />
      </div>

      <CardThanksBar
        id={row.id}
        thanks={row.thanks_count}
        views={row.view_count}
        ko={ko}
      />

      <div className="mt-2 flex flex-col items-center gap-3 text-center">
        <Logo className="h-5 w-auto" />
        <p className="text-sm text-muted">
          {ko
            ? "이 카드뉴스는 STORYUP으로 만들어졌어요."
            : "This card news was made with STORYUP."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          {ko ? "나도 만들기 →" : "Make your own →"}
        </Link>
      </div>
    </main>
  );
}
