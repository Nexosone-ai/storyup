"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import {
  setVideoPublicAction,
  deleteVideoAction,
} from "@/app/business/[id]/video/actions";

export interface MyVideoItem {
  id: string;
  kind: "video" | "shorts";
  title: string | null;
  url: string;
  createdAt: string;
  isPublic: boolean;
}

/**
 * 내 영상 목록(보기·내 페이지 공개/숨김·삭제) — AI 영상이 플랜에 없는 계정(Basic·Lite)용.
 * 카드뉴스 쇼츠도 내 페이지(/site/<slug>/videos)에 저장되므로, AI 영상 생성 화면(VideoStudio)이
 * 없는 플랜에서도 저장한 쇼츠를 확인·관리할 수 있어야 한다.
 */
export function MyVideosPanel({
  businessId,
  videos,
  siteSlug,
  ko,
}: {
  businessId: string;
  videos: MyVideoItem[];
  siteSlug: string | null;
  ko: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = async (v: MyVideoItem) => {
    setBusy(v.id);
    setMsg(null);
    const res = await setVideoPublicAction(businessId, v.id, !v.isPublic);
    setBusy(null);
    if (res.error) setMsg(res.error);
    else router.refresh();
  };
  const remove = async (v: MyVideoItem) => {
    if (
      !window.confirm(
        ko
          ? "이 영상을 내 영상 목록과 내 페이지에서 삭제할까요? 되돌릴 수 없어요."
          : "Delete this video from your list and your page? This cannot be undone.",
      )
    )
      return;
    setBusy(v.id);
    setMsg(null);
    const res = await deleteVideoAction(businessId, v.id);
    setBusy(null);
    if (res.error) setMsg(res.error);
    else router.refresh();
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{ko ? "내 영상" : "My videos"}</h2>
        {siteSlug ? (
          <a
            href={`/site/${siteSlug}/videos`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {ko ? "내 페이지에서 보기 ↗" : "View on my page ↗"}
          </a>
        ) : (
          <span className="text-xs text-muted">
            {ko
              ? "랜딩페이지를 발행하면 내 페이지 '영상'에 공개돼요."
              : "Publish your landing page to show these on your site."}
          </span>
        )}
      </div>
      {msg && <p className="text-xs text-danger">{msg}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {videos.map((v) => (
          <li key={v.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                {v.kind === "shorts" ? (ko ? "쇼츠" : "Short") : ko ? "AI 영상" : "AI video"}
              </span>
              {v.title && <p className="min-w-0 truncate text-sm font-medium">{v.title}</p>}
              <span
                className={`ml-auto shrink-0 text-[10px] font-semibold ${v.isPublic ? "text-primary" : "text-muted"}`}
              >
                {v.isPublic ? (ko ? "내 페이지 공개" : "On my page") : ko ? "숨김" : "Hidden"}
              </span>
            </div>
            <video
              src={v.url}
              controls
              playsInline
              preload="metadata"
              className="mt-2 max-h-[420px] w-full rounded-lg bg-black"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <a
                href={v.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                {ko ? "다운로드" : "Download"}
              </a>
              <button
                type="button"
                onClick={() => toggle(v)}
                disabled={busy === v.id}
                className="font-medium text-primary underline underline-offset-2 disabled:opacity-50"
              >
                {v.isPublic
                  ? ko
                    ? "내 페이지에서 숨기기"
                    : "Hide from my page"
                  : ko
                    ? "내 페이지에 공개"
                    : "Show on my page"}
              </button>
              <button
                type="button"
                onClick={() => remove(v)}
                disabled={busy === v.id}
                className="text-danger underline-offset-2 hover:underline disabled:opacity-50"
              >
                {ko ? "삭제" : "Delete"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
