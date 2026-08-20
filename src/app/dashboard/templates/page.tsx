import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getStore, getMyTemplates, getMyPurchases } from "@/lib/templates";
import { TemplatesView } from "@/components/templates/TemplatesView";

export const metadata = { title: "프리미엄 템플릿" };

export default async function TemplatesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [store, mine, purchases] = await Promise.all([
    getStore(user.id),
    getMyTemplates(user.id),
    getMyPurchases(user.id),
  ]);

  return <TemplatesView store={store} mine={mine} purchases={purchases} />;
}
