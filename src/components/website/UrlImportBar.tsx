"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { PdfImportData, PdfImportResult } from "@/lib/pdfImport";

/**
 * 웹주소(기존 홈페이지·소개 페이지)를 입력하면 그 페이지의 내용을 가져와
 * AI가 소개 문구·상품·연락처를 정리하고, 페이지 속 사진을 갤러리에 채워주는 바.
 */
export function UrlImportBar({
  businessId,
  onImport,
}: {
  businessId: string;
  onImport: (data: PdfImportData) => void;
}) {
  const ko = useLocale() === "ko";
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = async () => {
    const target = url.trim();
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/ai/url-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId, url: target }),
      });
      const json = (await res.json()) as PdfImportResult;
      if (json.error || !json.data) {
        setError(
          json.error ?? (ko ? "불러오지 못했습니다." : "Import failed."),
        );
        return;
      }
      onImport(json.data);
      const d = json.data;
      const filled = [
        (d.headline || d.shortDescription) && (ko ? "소개 문구" : "intro copy"),
        d.storyBody && (ko ? "스토리" : "story"),
        d.offers.length > 0 &&
          (ko
            ? `상품/서비스 ${d.offers.length}개`
            : `${d.offers.length} offer${d.offers.length > 1 ? "s" : ""}`),
        (d.phone || d.address || d.email) && (ko ? "연락처" : "contact info"),
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
            ? "이 주소에서 가져올 수 있는 내용이 없었어요."
            : "No importable content was found at that URL.",
      );
    } catch {
      setError(
        ko
          ? "불러오는 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while importing. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
      <span className="eyebrow mr-1 inline-flex items-center gap-1.5">
        <Icon.link className="size-4" />
        {ko ? "주소(URL)에서 불러오기" : "Import from URL"}
      </span>
      <input
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void run();
          }
        }}
        disabled={busy}
        placeholder={ko ? "예: https://내사이트.com" : "e.g. https://mysite.com"}
        className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-60"
      />
      <Button variant="outline" size="sm" onClick={() => void run()} disabled={busy}>
        {busy ? (
          <>
            <Spinner className="size-4" />
            {ko ? "분석 중..." : "Analyzing..."}
          </>
        ) : ko ? (
          "가져오기"
        ) : (
          "Import"
        )}
      </Button>
      <p className="w-full text-xs text-muted">
        {ko
          ? "기존 홈페이지·소개 페이지 주소를 입력하면 그 페이지의 소개 문구·상품·연락처를 AI가 정리하고, 페이지 속 사진을 갤러리에 채워드립니다."
          : "Enter the URL of an existing homepage or profile page — AI pulls in its intro copy, offers, and contact info, and photos from the page fill the gallery."}
      </p>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {done && <p className="w-full text-sm text-primary">{done}</p>}
    </div>
  );
}
