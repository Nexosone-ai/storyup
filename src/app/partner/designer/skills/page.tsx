import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { SkillHub, type SkillSourceRow } from "@/components/marketplace/SkillHub";

export const metadata = { title: "Skill 보관함" };

export default async function SkillsPage() {
  if (!MARKETPLACE_ENABLED || !(await isCurrentUserDesigner())) notFound();

  const supabase = await createClient();
  // RLS로 본인 소유 Skill만 조회됨.
  const { data } = await supabase
    .from("skill_sources")
    .select(
      "id, repo, ref, commit_sha, skill_name, description, license, compatibility, skill_type, support_level, support_reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const skills: SkillSourceRow[] = (data ?? []).map((s) => ({
    id: s.id,
    repo: s.repo,
    ref: s.ref,
    commitSha: s.commit_sha,
    skillName: s.skill_name,
    description: s.description,
    license: s.license,
    compatibility: s.compatibility,
    skillType: s.skill_type,
    supportLevel: s.support_level,
    supportReason: s.support_reason,
    createdAt: s.created_at,
  }));

  return <SkillHub skills={skills} />;
}
