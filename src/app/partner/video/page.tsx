import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { operableOwnerIds } from "@/lib/queries";
import { isCurrentUserPartner } from "@/lib/partner";
import { PROVIDEO_ENABLED, providerStatus } from "@/lib/provideo/config";
import {
  ProVideoStudio,
  type ProjectRow,
  type BizOption,
} from "@/components/provideo/ProVideoStudio";

export const metadata = { title: "전문 영상 스튜디오" };

export default async function ProVideoPage() {
  if (!PROVIDEO_ENABLED || !(await isCurrentUserPartner())) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const owners = await operableOwnerIds(supabase, user.id);
  const [{ data: projects }, { data: bizs }] = await Promise.all([
    supabase
      .from("provideo_projects")
      .select("id, title, concept, status, aspect, quality, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("businesses").select("id, name").in("user_id", owners).limit(100),
  ]);

  const rows: ProjectRow[] = (projects ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    concept: p.concept,
    status: p.status,
    aspect: p.aspect,
    quality: p.quality,
  }));
  const businesses: BizOption[] = (bizs ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <ProVideoStudio
      projects={rows}
      businesses={businesses}
      providers={providerStatus()}
    />
  );
}
