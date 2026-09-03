"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { PdfImportData, PdfImportResult } from "@/lib/pdfImport";

/**
 * PDF(회사 소개서·브로슈어)를 올리면 AI가 텍스트를, 서버가 사진을 추출해
 * 랜딩페이지 콘텐츠를 자동으로 채워주는 바.
 */
export function PdfImportBar({
  businessId,
  onImport,
}: {
  businessId: string;
  onImport: (data: PdfImportData) => void;
}) {
  const ko = useLocale() === "ko";
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = async (file: File) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      if (file.size > 10 * 1024 * 1024) {
        setError(
          ko
            ? "PDF가 너무 큽니다. 10MB 이하 파일을 올려주세요."
            : "The PDF is too large. Please upload a file under 10MB.",
        );
        return;
      }
      const form = new FormData();
      form.set("businessId", businessId);
      form.set("file", file);
      const res = await fetch("/api/ai/pdf-import", {
        method: "POST",
        body: form,
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
            ? "PDF에서 가져올 수 있는 내용이 없었어요."
            : "No importable content was found in the PDF.",
      );
    } catch {
      setError(
        ko
          ? "불러오는 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while importing. Please try again.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
      <span className="eyebrow mr-1 inline-flex items-center gap-1.5">
        <Icon.file className="size-4" />
        {ko ? "PDF에서 불러오기" : "Import from PDF"}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(f);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Spinner className="size-4" />
            {ko ? "분석 중..." : "Analyzing..."}
          </>
        ) : ko ? (
          "PDF 선택"
        ) : (
          "Choose PDF"
        )}
      </Button>
      <p className="w-full text-xs text-muted">
        {ko
          ? "회사 소개서·브로슈어 PDF를 올리면 AI가 소개 문구·상품·연락처를 추출하고, PDF 속 사진을 갤러리에 채워드립니다. (10MB 이하)"
          : "Upload a company brochure PDF — AI extracts your intro copy, offers, and contact info, and photos inside the PDF fill the gallery. (Under 10MB)"}
      </p>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {done && <p className="w-full text-sm text-primary">{done}</p>}
    </div>
  );
}
