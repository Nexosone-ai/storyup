"use client";

import { mintYoutubeUploadToken } from "@/app/business/actions";

/**
 * 방금 만든 쇼츠를 유튜브에 직접 업로드(브라우저 → 유튜브 resumable, 서버 미경유).
 * 토큰은 서버가 발급(Pro/Partner, 본인 연결 채널). 검수 전이라 privacyStatus 는 private 강제.
 * ShortsPanel 과 요약 쇼츠 스튜디오가 공용으로 쓴다.
 */
const YT_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

export async function uploadShortToYoutube(
  blob: Blob,
  meta: { title: string; description?: string },
  ko = true,
): Promise<{ link?: string; error?: string }> {
  try {
    const t = await mintYoutubeUploadToken();
    if (t.error || !t.token)
      return { error: t.error ?? (ko ? "토큰 발급 실패" : "Token error") };
    const body = {
      snippet: {
        title: (meta.title || "StoryUp Shorts").slice(0, 100),
        description:
          meta.description ?? (ko ? "STORYUP으로 만든 쇼츠입니다." : "Created with STORYUP."),
        categoryId: "22",
      },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    };
    // 1) 재개 가능 업로드 세션 시작
    const init = await fetch(YT_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t.token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": blob.type || "video/mp4",
        "X-Upload-Content-Length": String(blob.size),
      },
      body: JSON.stringify(body),
    });
    const loc = init.headers.get("location") || init.headers.get("Location");
    if (!init.ok || !loc) throw new Error("init");
    // 2) 영상 바이트 업로드
    const put = await fetch(loc, {
      method: "PUT",
      headers: { "Content-Type": blob.type || "video/mp4" },
      body: blob,
    });
    const data = (await put.json()) as { id?: string };
    if (!put.ok || !data.id) throw new Error("put");
    return { link: `https://youtu.be/${data.id}` };
  } catch {
    return {
      error: ko
        ? "유튜브 업로드에 실패했어요. 잠시 후 다시 시도하거나 계정을 다시 연결해주세요."
        : "YouTube upload failed. Please retry or reconnect your account.",
    };
  }
}
