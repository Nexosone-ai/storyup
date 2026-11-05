import { redirect } from "next/navigation";

/** 구 라우트 — 파트너 영상 허브의 '글로 영상 만들기' 탭으로 이동. (actions.ts 는 그대로 사용) */
export default function RecapShortsRedirect() {
  redirect("/partner/videos?tab=recap");
}
