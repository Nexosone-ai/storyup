import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { IndustryRequestForm } from "@/components/marketing/IndustryRequestForm";
import { getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/queries";
import { buildSeo } from "@/utils/seo";

export const metadata = buildSeo({
  title: "업종 추가 요청",
  description:
    "찾는 업종이 없나요? 원하는 업종을 요청하면 검토 후 반영 여부를 안내해드립니다.",
  path: "/industries/request",
});

const STATUS_LABEL: Record<string, string> = {
  received: "접수됨",
  reviewing: "검토 중",
  adopted: "채택",
  rejected: "반려",
};

export default async function IndustryRequestPage() {
  const ko = (await getLocale()) === "ko";
  const user = await getUser();

  let myRequests: {
    id: string;
    name: string;
    status: string;
    public_reply: string | null;
    created_at: string;
  }[] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("industry_requests")
      .select("id, name, status, public_reply, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    myRequests = data ?? [];
  }

  const loginHref = `/login?redirect=${encodeURIComponent("/industries/request")}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-xl">
          <nav className="text-xs text-muted">
            <Link href="/industries" className="hover:text-foreground">
              {ko ? "업종별 활용" : "By industry"}
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">
              {ko ? "업종 추가 요청" : "Request an industry"}
            </span>
          </nav>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {ko ? "업종 추가 요청" : "Request an industry"}
          </h1>
          <p className="mt-2 text-muted">
            {ko
              ? "찾는 업종이 없나요? 원하는 업종을 알려주시면 검토 후 반영 여부를 안내해드려요. 추가 일정이나 채택을 보장하지는 않습니다."
              : "Tell us the industry you need. We review requests but can't guarantee adoption or timing."}
          </p>

          <div className="mt-6">
            <IndustryRequestForm
              ko={ko}
              loggedIn={!!user}
              loginHref={loginHref}
            />
          </div>

          {user && myRequests.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold">
                {ko ? "내 요청" : "My requests"}
              </h2>
              <ul className="mt-3 space-y-2">
                {myRequests.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {r.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    {r.public_reply && (
                      <p className="mt-1.5 text-xs text-muted">
                        {ko ? "답변: " : "Reply: "}
                        {r.public_reply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
