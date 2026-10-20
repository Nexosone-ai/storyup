import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { DesignerDashboard, type TemplateRow } from "@/components/marketplace/DesignerDashboard";

export const metadata = { title: "디자이너 스튜디오" };

export default async function DesignerPage() {
  if (!MARKETPLACE_ENABLED || !(await isCurrentUserDesigner())) notFound();

  const supabase = await createClient();
  // RLS로 본인 소유 템플릿만 조회됨.
  const { data } = await supabase
    .from("design_templates")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  const templates: TemplateRow[] = (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    updatedAt: t.updated_at,
  }));

  return <DesignerDashboard templates={templates} />;
}
