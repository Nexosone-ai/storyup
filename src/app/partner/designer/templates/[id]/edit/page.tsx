import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED, DESIGN_AI_SERVICE } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { validatePageSchema } from "@/lib/marketplace/validate";
import { emptyPageSchema } from "@/lib/marketplace/pageSchema";
import { getServicePrice } from "@/lib/payments/prices";
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
  const aiPrice = await getServicePrice(DESIGN_AI_SERVICE);

  // 적용 가능한(지침형) 보관함 Skill — 디자인 AI 패치로 적용(RLS 본인 것만).
  const { data: skillRows } = await supabase
    .from("skill_sources")
    .select("id, skill_name, description")
    .eq("support_level", "instructions")
    .eq("status", "imported")
    .order("created_at", { ascending: false })
    .limit(50);
  const skills = (skillRows ?? []).map((s) => ({
    id: s.id,
    name: s.skill_name,
    description: s.description,
  }));

  // 관리자 큐레이션 프롬프트 프리셋(활성) — 없으면 편집기가 내장 기본값 사용.
  const { data: promptRows } = await supabase
    .from("design_prompts")
    .select("id, title, tag, hint, prompt")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(60);
  const presets = (promptRows ?? []).map((p) => ({
    key: p.id,
    title: p.title,
    tag: p.tag ?? "",
    hint: p.hint ?? "",
    prompt: p.prompt,
  }));

  return (
    <TemplateEditor
      versionId={ver.id}
      title={tpl.title}
      status={ver.status}
      initialSchema={schema}
      aiPrice={aiPrice}
      skills={skills}
      presets={presets}
    />
  );
}
