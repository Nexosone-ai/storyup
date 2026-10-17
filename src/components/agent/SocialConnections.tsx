"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { disconnectFacebookAction } from "@/app/business/[id]/agent/social-actions";

interface FbStatus {
  configured: boolean;
  connected: boolean;
  pages: { id: string; name: string }[];
}
interface YtStatus {
  configured: boolean;
  connected: boolean;
  channelTitle: string | null;
}

/**
 * 에이전트가 외부에 게시할 수 있도록 SNS 계정을 연결하는 패널.
 * Facebook 페이지(서버 Graph API 게시)와 YouTube(브라우저 업로드) 상태를 보여준다.
 */
export function SocialConnections({
  businessId,
  ko,
  fb,
  yt,
}: {
  businessId: string;
  ko: boolean;
  fb: FbStatus;
  yt: YtStatus;
}) {
  const [fbConnected, setFbConnected] = useState(fb.connected);
  const [pages, setPages] = useState(fb.pages);
  const [pending, startTransition] = useTransition();

  const next = `/business/${businessId}/agent`;
  const fbConnectHref = `/api/social/facebook/connect?business=${businessId}&next=${encodeURIComponent(next)}`;
  const ytConnectHref = `/api/youtube/connect?next=${encodeURIComponent(next)}`;

  const disconnectFb = () =>
    startTransition(async () => {
      await disconnectFacebookAction(businessId);
      setFbConnected(false);
      setPages([]);
    });

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {ko ? "SNS 연동" : "Social connections"}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {ko
          ? "연결하면 에이전트가 해당 채널로 게시를 제안할 수 있어요. 게시는 항상 승인 후 실행됩니다."
          : "Once connected, the agent can propose posts to that channel. Posting always runs after your approval."}
      </p>

      <div className="mt-3 space-y-3">
        {/* Facebook */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">Facebook</span>
            {!fb.configured ? (
              <span className="ml-2 text-xs text-muted">
                {ko ? "설정 필요(관리자)" : "Setup required (admin)"}
              </span>
            ) : fbConnected ? (
              <span className="ml-2 text-xs text-primary">
                {ko ? "연결됨" : "Connected"}
                {pages.length > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {pages.map((p) => p.name).join(", ")}
                  </span>
                )}
              </span>
            ) : (
              <span className="ml-2 text-xs text-muted">
                {ko ? "연결 안 됨" : "Not connected"}
              </span>
            )}
          </div>
          {fb.configured &&
            (fbConnected ? (
              <Button
                size="sm"
                variant="outline"
                onClick={disconnectFb}
                disabled={pending}
              >
                {ko ? "연결 해제" : "Disconnect"}
              </Button>
            ) : (
              <ButtonLink size="sm" href={fbConnectHref}>
                {ko ? "페이지 연결" : "Connect page"}
              </ButtonLink>
            ))}
        </div>

        {/* YouTube */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">YouTube</span>
            {!yt.configured ? (
              <span className="ml-2 text-xs text-muted">
                {ko ? "설정 필요(관리자)" : "Setup required (admin)"}
              </span>
            ) : yt.connected ? (
              <span className="ml-2 text-xs text-primary">
                {ko ? "연결됨" : "Connected"}
                {yt.channelTitle && (
                  <span className="text-muted"> · {yt.channelTitle}</span>
                )}
              </span>
            ) : (
              <span className="ml-2 text-xs text-muted">
                {ko ? "연결 안 됨" : "Not connected"}
              </span>
            )}
          </div>
          {yt.configured && !yt.connected && (
            <ButtonLink size="sm" variant="outline" href={ytConnectHref}>
              {ko ? "채널 연결" : "Connect channel"}
            </ButtonLink>
          )}
        </div>
        {yt.configured && (
          <p className="text-xs text-muted">
            {ko
              ? "YouTube 쇼츠 업로드는 쇼츠 패널에서 직접 올립니다(에이전트는 제안까지)."
              : "YouTube shorts are uploaded from the shorts panel (the agent only proposes)."}
          </p>
        )}
      </div>
    </div>
  );
}
