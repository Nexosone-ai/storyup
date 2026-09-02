import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { CommunityView } from "@/components/community/CommunityView";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getLocale } from "@/lib/i18n";
import { getStoryFeed, getRealTalkFeed } from "@/lib/community";
import { getUser } from "@/lib/queries";

export const metadata = { title: "커뮤니티" };

export default async function CommunityPage() {
  const [user, story, realtalk] = await Promise.all([
    getUser(),
    getStoryFeed(),
    getRealTalkFeed(),
  ]);
  const locale = await getLocale();

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1 px-5 py-12 sm:px-8">
        <LocaleProvider locale={locale}>
          <CommunityView story={story} realtalk={realtalk} loggedIn={!!user} />
        </LocaleProvider>
      </main>
      <Footer />
    </div>
  );
}
