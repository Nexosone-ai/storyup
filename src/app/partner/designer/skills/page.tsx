import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import {
  SkillHub,
  type SkillSourceRow,
  type CatalogItem,
} from "@/components/marketplace/SkillHub";

export const metadata = { title: "Skill 보관함" };

export default async function SkillsPage() {
  if (!MARKETPLACE_ENABLED || !(await isCurrentUserDesigner())) notFound();

  const supabase = await createClient();
  // RLS로 본인 소유 Skill + 활성 추천 카탈로그만 조회됨.
  const [{ data }, catalogRes] = await Promise.all([
    supabase
      .from("skill_sources")
      .select(
        "id, repo, ref, commit_sha, skill_name, description, license, compatibility, skill_type, support_level, support_reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("skill_catalog")
      .select("id, repo_url, title, description, tag")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const catalog: CatalogItem[] = (catalogRes.data ?? []).map((c) => ({
    id: c.id,
    repoUrl: c.repo_url,
    title: c.title,
    description: c.description,
    tag: c.tag,
  }));

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

  return <SkillHub skills={skills} catalog={catalog} />;
}
