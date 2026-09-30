import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CustomDomainManager } from "@/components/dashboard/CustomDomainManager";

export const metadata = { title: "개인 도메인" };

export default async function DomainPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const ko = (await getLocale()) === "ko";
  const plan = getPlanById(await getPlanId(user.id));

  // Pro 미만 — 업그레이드 안내.
  if (plan.domain !== "custom") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "개인 도메인" : "Custom domain"}
        </h1>
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-lg font-semibold">
            {ko
              ? "개인 도메인 연결은 Pro 플랜에서 제공돼요."
              : "Custom domains are available on the Pro plan."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "myshop.com 같은 내 도메인을 STORYUP 랜딩페이지에 연결해 브랜드 주소로 운영할 수 있어요."
              : "Connect your own domain (e.g. myshop.com) to your STORYUP landing page."}
          </p>
          <ButtonLink href="/dashboard/plans">
            {ko ? "플랜 업그레이드" : "Upgrade plan"}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: businesses }, { data: websites }, { data: domains }] =
    await Promise.all([
      supabase.from("businesses").select("id, name").eq("user_id", user.id),
      supabase.from("websites").select("business_id, slug, status"),
      supabase
        .from("custom_domains")
        .select("id, business_id, domain, status, created_at"),
    ]);

  const siteBy = new Map(
    (websites ?? []).map((w) => [w.business_id, w]),
  );
  const domainBy = new Map(
    (domains ?? []).map((d) => [d.business_id, d]),
  );

  const items = (businesses ?? []).map((b) => {
    const site = siteBy.get(b.id);
    const dom = domainBy.get(b.id);
    return {
      businessId: b.id,
      name: b.name,
      published: site?.status === "published",
      domain: dom
        ? { id: dom.id, domain: dom.domain, status: dom.status }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "개인 도메인" : "Custom domain"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "내 도메인을 사업장 랜딩페이지에 연결하세요. 연결 후 DNS 설정과 검토를 거쳐 활성화됩니다."
            : "Connect your own domain to a business landing page. It activates after DNS setup and review."}
        </p>
      </div>
      <CustomDomainManager items={items} ko={ko} />
    </div>
  );
}
