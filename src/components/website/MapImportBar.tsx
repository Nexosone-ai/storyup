"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import {
  importGooglePlaceAction,
  type GooglePlaceData,
} from "@/app/business/googlePlaceActions";

/**
 * 구글 지도 링크를 붙여넣으면 사업자 정보(주소·전화·웹사이트·SNS·사진)를
 * 가져와 에디터 콘텐츠에 채워주는 바.
 */
export function GoogleImportBar({
  businessId,
  onImport,
}: {
  businessId: string;
  onImport: (data: GooglePlaceData) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    const link = url.trim();
    if (!link) return;
    start(async () => {
      setError(null);
      setDone(null);
      const res = await importGooglePlaceAction(businessId, link);
      if (res.error || !res.data) {
        setError(res.error ?? "불러오지 못했습니다.");
        return;
      }
      onImport(res.data);
      const d = res.data;
      const filled = [
        d.address && "주소",
        d.phone && "전화번호",
        d.website && "웹사이트",
        (d.instagram || d.facebook || d.x) && "SNS",
        d.photos.length > 0 && `사진 ${d.photos.length}장`,
      ]
        .filter(Boolean)
        .join(" · ");
      setDone(
        filled
          ? `${filled}을(를) 채웠어요. 미리보기 확인 후 저장을 눌러주세요.`
          : "가져올 수 있는 정보가 없었어요.",
      );
      setUrl("");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
      <span className="eyebrow mr-1 inline-flex items-center gap-1.5">
        <Icon.mapPin className="size-4" />
        구글 지도에서 불러오기
      </span>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !pending) {
            e.preventDefault();
            run();
          }
        }}
        placeholder="https://maps.app.goo.gl/... 또는 구글 지도 업체 링크"
        className="h-9 w-full max-w-md text-sm"
        spellCheck={false}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending || !url.trim()}
      >
        {pending ? (
          <>
            <Spinner className="size-4" />
            불러오는 중...
          </>
        ) : (
          "불러오기"
        )}
      </Button>
      <p className="w-full text-xs text-muted">
        구글 지도에서 내 업체 페이지를 열고 &lsquo;공유&rsquo; 링크를 붙여넣으면
        주소·전화번호·웹사이트·SNS·사진을 자동으로 채워드립니다.
      </p>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {done && <p className="w-full text-sm text-primary">{done}</p>}
    </div>
  );
}
