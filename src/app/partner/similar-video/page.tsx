import { redirect } from "next/navigation";

/** 구 라우트 — 파트너 영상 허브의 'AI로 관련 영상 10개' 탭으로 이동. (actions.ts 는 그대로 사용) */
export default function SimilarVideoRedirect() {
  redirect("/partner/videos?tab=similar");
}
