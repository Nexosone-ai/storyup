import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { validatePageSchema } from "@/lib/marketplace/validate";
import { emptyPageSchema } from "@/lib/marketplace/pageSchema";
import { TemplateEditor } from "@/components/marketplace/TemplateEditor";

export const metadata = { title: "템플릿 편집" };

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!MARKETPLACE_ENABLED || !(await isCurrentUserDesigner())) notFound();
  const { id } = await params;

  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("design_templates")
    .select("id, title, status")
    .eq("id", id)
    .maybeSingle();
  if (!tpl) notFound();

  const { data: ver } = await supabase
    .from("template_versions")
    .select("id, version, page_schema, status")
    .eq("template_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ver) notFound();

  // 저장된 스키마를 검증·정규화해 안전한 값만 에디터로 전달.
  const parsed = validatePageSchema(ver.page_schema);
  const schema = parsed.ok && parsed.schema ? parsed.schema : emptyPageSchema();

  return (
    <TemplateEditor
      versionId={ver.id}
      title={tpl.title}
      status={ver.status}
      initialSchema={schema}
    />
  );
}
