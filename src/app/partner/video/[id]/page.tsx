import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserPartner } from "@/lib/partner";
import { PROVIDEO_ENABLED, providerStatus } from "@/lib/provideo/config";
import {
  ProVideoProject,
  type SceneRow,
  type AssetRow,
} from "@/components/provideo/ProVideoProject";

export const metadata = { title: "전문 영상 프로젝트" };

export default async function ProVideoProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!PROVIDEO_ENABLED || !(await isCurrentUserPartner())) notFound();
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("provideo_projects")
    .select("id, title, concept, status, aspect, quality, music_prompt, music_url")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: scenes }, { data: assets }] = await Promise.all([
    supabase
      .from("provideo_scenes")
      .select("id, idx, script, image_prompt, image_url, video_url, status")
      .eq("project_id", id)
      .order("idx", { ascending: true }),
    supabase
      .from("provideo_assets")
      .select("id, kind, label, prompt, image_url")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const sceneRows: SceneRow[] = (scenes ?? []).map((s) => ({
    id: s.id,
    idx: s.idx,
    script: s.script,
    imagePrompt: s.image_prompt,
    imageUrl: s.image_url,
    videoUrl: s.video_url,
  }));
  const assetRows: AssetRow[] = (assets ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    label: a.label,
    prompt: a.prompt,
    imageUrl: a.image_url,
  }));

  return (
    <ProVideoProject
      project={{
        id: project.id,
        title: project.title,
        concept: project.concept,
        status: project.status,
        aspect: project.aspect,
        quality: project.quality,
        musicPrompt: project.music_prompt,
        musicUrl: project.music_url,
      }}
      scenes={sceneRows}
      assets={assetRows}
      providers={providerStatus()}
    />
  );
}
