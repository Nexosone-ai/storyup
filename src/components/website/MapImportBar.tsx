"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { importGooglePlaceAction } from "@/app/business/googlePlaceActions";
import type { PlaceImportData } from "@/lib/placeImport";
import { useLocale } from "@/components/i18n/LocaleProvider";

/**
 * 구글 지도 링크를 붙여넣으면 사업자 정보(주소·전화·웹사이트·SNS·사진)를
 * 가져와 에디터 콘텐츠에 채워주는 바.
 */
export function MapImportBar({
  businessId,
  onImport,
}: {
  businessId: string;
  onImport: (data: PlaceImportData) => void;
}) {
  const ko = useLocale() === "ko";
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    const link = url.trim();
    if (!link) return;

    const isGoogle = /goo\.gl|share\.google|google\.[a-z.]+\/maps|maps\.google/i.test(
      link,
    );
    if (!isGoogle) {
      setError(
        ko
          ? "구글 지도 링크를 붙여넣어주세요. 구글 지도 앱의 '공유' 버튼에서 링크를 복사할 수 있어요."
          : "Paste a Google Maps link. You can copy one from the Google Maps Share button.",
      );
      return;
    }

    start(async () => {
      setError(null);
      setDone(null);
      const res = await importGooglePlaceAction(businessId, link);
      if (res.error || !res.data) {
        setError(res.error ?? (ko ? "불러오지 못했습니다." : "Import failed."));
        return;
      }
      onImport(res.data);
      const d = res.data;
      const filled = [
        d.address && (ko ? "주소" : "address"),
        d.phone && (ko ? "전화번호" : "phone"),
        d.website && (ko ? "웹사이트" : "website"),
        (d.instagram || d.facebook || d.x) && (ko ? "SNS" : "social links"),
        d.photos.length > 0 &&
          (ko
            ? `사진 ${d.photos.length}장`
            : `${d.photos.length} photo${d.photos.length > 1 ? "s" : ""}`),
      ]
        .filter(Boolean)
        .join(" · ");
      setDone(
        filled
          ? ko
            ? `${filled}을(를) 채웠어요. 미리보기 확인 후 저장을 눌러주세요.`
            : `Filled in: ${filled}. Check the preview, then press Save.`
          : ko
            ? "가져올 수 있는 정보가 없었어요."
            : "No importable information was found.",
      );
      setUrl("");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
      <span className="eyebrow mr-1 inline-flex items-center gap-1.5">
        <Icon.mapPin className="size-4" />
        {ko ? "구글 지도에서 불러오기" : "Import from Google Maps"}
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
        placeholder={
          ko
            ? "https://maps.app.goo.gl/... 또는 구글 지도 업체 링크"
            : "https://maps.app.goo.gl/... or a Google Maps place link"
        }
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
            {ko ? "불러오는 중..." : "Importing..."}
          </>
        ) : ko ? (
          "불러오기"
        ) : (
          "Import"
        )}
      </Button>
      <p className="w-full text-xs text-muted">
        {ko ? (
          <>
            구글 지도에서 내 업체 페이지를 열고 &lsquo;공유&rsquo; 링크를
            붙여넣으면 주소·전화번호·웹사이트·SNS·사진을 자동으로 채워드립니다.
          </>
        ) : (
          <>
            Open your business page on Google Maps and paste the
            &lsquo;Share&rsquo; link to auto-fill address, phone, website,
            social links, and photos.
          </>
        )}
      </p>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {done && <p className="w-full text-sm text-primary">{done}</p>}
    </div>
  );
}
