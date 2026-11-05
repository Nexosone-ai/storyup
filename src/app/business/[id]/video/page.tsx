import { redirect } from "next/navigation";

/** AI 영상은 콘텐츠 스튜디오 6단계로 통합 — 구 URL은 그대로 열리도록 리다이렉트. (actions.ts 는 그대로 사용) */
export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/business/${id}/marketing?step=6`);
}
