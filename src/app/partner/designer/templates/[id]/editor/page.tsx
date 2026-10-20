import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { validatePageSchema } from "@/lib/marketplace/validate";
import { emptyPageSchema } from "@/lib/marketplace/pageSchema";
import { validateDocument } from "@/lib/marketplace/validateDocument";
import { migratePageSchemaToDocument } from "@/lib/marketplace/migrateV1";
import { emptyDocument } from "@/lib/marketplace/document";
import { DocumentEditor } from "@/components/marketplace/DocumentEditor";

export const metadata = { title: "문서 편집기" };

export default async function TemplateDocumentEditorPage({
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
    .select("id, version, page_schema, document, status")
    .eq("template_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ver) notFound();

  // document(V2)가 있으면 그걸, 없으면 page_schema(V1)를 V2로 변환해서 연다.
  let doc = emptyDocument();
  const parsedDoc = ver.document ? validateDocument(ver.document) : null;
  if (parsedDoc?.ok && parsedDoc.doc) {
    doc = parsedDoc.doc;
  } else {
    const v1 = validatePageSchema(ver.page_schema);
    doc = migratePageSchemaToDocument(v1.ok && v1.schema ? v1.schema : emptyPageSchema());
  }

  return (
    <DocumentEditor versionId={ver.id} title={tpl.title} status={ver.status} initialDoc={doc} />
  );
}
