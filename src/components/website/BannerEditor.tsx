"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { uploadSiteImage } from "@/app/business/actions";
import { resizeImage } from "./templates/ImageSlot";
import { BannerView } from "./templates/BannerView";
import type {
  SiteBanner,
  SiteBannerAspect,
  SiteBannerPlacement,
} from "@/types/domain";

const PLACEMENTS: { value: SiteBannerPlacement; label: string }[] = [
  { value: "landing", label: "랜딩페이지 섹션" },
  { value: "blogList", label: "블로그 목록 상단" },
  { value: "postTop", label: "블로그 글 상단" },
  { value: "postBottom", label: "블로그 글 하단" },
];
const ASPECTS: { value: SiteBannerAspect; label: string }[] = [
  { value: "4:1", label: "와이드 4:1" },
  { value: "3:1", label: "배너 3:1" },
  { value: "16:9", label: "16:9" },
  { value: "1:1", label: "정사각 1:1" },
];

/** AI 생성 비율은 site-image 지원값으로 매핑(가로 긴 배너는 16:9 생성 후 object-cover). */
function genAspect(a?: SiteBannerAspect): "16:9" | "1:1" {
  return a === "1:1" ? "1:1" : "16:9";
}

export function BannerEditor({
  banner,
  businessId,
  onChange,
  onRemove,
}: {
  banner: SiteBanner;
  businessId: string;
  onChange: (next: SiteBanner) => void;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState<"upload" | "ai" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const patch = (p: Partial<SiteBanner>) => onChange({ ...banner, ...p });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("upload");
    setNote(null);
    try {
      const resized = await resizeImage(file, 1600);
      const fd = new FormData();
      fd.append("file", resized);
      const up = await uploadSiteImage(businessId, fd);
      if (up.error || !up.url) setNote(up.error ?? "업로드에 실패했습니다.");
      else patch({ image: up.url });
    } catch {
      setNote("업로드 중 문제가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("ai");
    setNote(null);
    try {
      const res = await fetch("/api/ai/site-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          subject: banner.prompt ?? "",
          slotKey: `banner:${banner.id}`,
          aspect: genAspect(banner.aspect),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url)
        setNote(json.error ?? "이미지 생성에 실패했습니다.");
      else patch({ image: json.url });
    } catch {
      setNote("이미지 생성 중 문제가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      {/* 미리보기 */}
      <BannerView banner={banner} />
      {note && <p className="text-xs font-medium text-danger">{note}</p>}

      {/* 위치 · 사이즈 */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-1 block text-muted">노출 위치</span>
          <Select
            value={banner.placement}
            onChange={(e) =>
              patch({ placement: e.target.value as SiteBannerPlacement })
            }
            className="w-40"
          >
            {PLACEMENTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted">비율</span>
          <Select
            value={banner.aspect ?? "3:1"}
            onChange={(e) =>
              patch({ aspect: e.target.value as SiteBannerAspect })
            }
            className="w-32"
            disabled={!!banner.heightPx}
          >
            {ASPECTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted">높이(px, 선택)</span>
          <Input
            type="number"
            min={0}
            value={banner.heightPx ?? ""}
            onChange={(e) =>
              patch({
                heightPx: e.target.value
                  ? Math.max(0, Number(e.target.value))
                  : undefined,
              })
            }
            placeholder="자동"
            className="w-24 text-right"
          />
        </label>
      </div>

      {/* 이미지 */}
      <div className="space-y-2 rounded-lg border border-border/70 bg-surface-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:bg-surface-muted">
            {busy === "upload" ? "업로드 중…" : "이미지 업로드"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
              disabled={busy !== null}
            />
          </label>
          {banner.image && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patch({ image: undefined })}
              disabled={busy !== null}
            >
              이미지 제거
            </Button>
          )}
        </div>
        <textarea
          value={banner.prompt ?? ""}
          onChange={(e) => patch({ prompt: e.target.value })}
          maxLength={300}
          placeholder="AI로 만들 배너 이미지 내용 (예: 가을 단풍이 보이는 여행 풍경, 따뜻한 느낌)"
          className="min-h-16 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <Button
          size="sm"
          onClick={generate}
          disabled={busy !== null || !(banner.prompt ?? "").trim()}
        >
          {busy === "ai" ? <Spinner className="size-4" /> : "✨ AI로 이미지 생성"}
        </Button>
      </div>

      {/* 문구 · 버튼 */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={banner.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="제목 (예: 가을 여행 특가)"
          maxLength={60}
        />
        <Input
          value={banner.subtitle ?? ""}
          onChange={(e) => patch({ subtitle: e.target.value })}
          placeholder="소제목 (선택)"
          maxLength={120}
        />
        <Input
          value={banner.ctaLabel ?? ""}
          onChange={(e) => patch({ ctaLabel: e.target.value })}
          placeholder="버튼 문구 (예: 예약하기)"
          maxLength={30}
        />
        <Input
          value={banner.ctaHref ?? ""}
          onChange={(e) => patch({ ctaHref: e.target.value })}
          placeholder="버튼 링크 (예: https://… 또는 #contact)"
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy !== null}>
          <span className="text-danger">배너 삭제</span>
        </Button>
      </div>
    </div>
  );
}
