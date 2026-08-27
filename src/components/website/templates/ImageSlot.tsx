"use client";

import { useRef, useState } from "react";
import { uploadSiteImage } from "@/app/business/actions";
import { cn } from "@/utils/cn";
import type { ImageRenderer } from "./shared";

/** Downscale + compress an image in the browser before upload. */
export async function resizeImage(file: File, maxW: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", 0.85),
  );
  bitmap.close();
  if (!blob) return file;
  return new File([blob], "image.jpg", { type: "image/jpeg" });
}

function ImageSlot({
  value,
  onChange,
  businessId,
  className,
  kind = "cover",
}: {
  value?: string;
  onChange: (url: string) => void;
  businessId: string;
  className?: string;
  kind?: "cover" | "hero";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const resized = await resizeImage(file, kind === "hero" ? 1920 : 1000);
      const fd = new FormData();
      fd.append("file", resized);
      const res = await uploadSiteImage(businessId, fd);
      if (res.error || !res.url) setErr(res.error ?? "업로드 실패");
      else onChange(res.url);
    } catch {
      setErr("업로드 중 문제가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const hero = kind === "hero";

  return (
    <div className={cn("group/img", hero ? "absolute inset-0" : className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />

      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
          {hero && <div className="absolute inset-0 bg-black/40" />}
          {/* controls */}
          <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition group-hover/img:opacity-100">
            <button
              type="button"
              onClick={pick}
              disabled={busy}
              className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
            >
              {busy ? "..." : "변경"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={busy}
              className="rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
            >
              삭제
            </button>
          </div>
        </>
      ) : hero ? (
        <>
          {/* 배경 텍스트가 위에 그려지므로 라벨은 우상단 pill로 분리 */}
          <div className="absolute inset-0 border border-dashed border-primary/40 bg-primary-soft/40" />
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75"
          >
            {busy ? "업로드 중..." : "＋ 배경 이미지 추가"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 text-sm font-medium text-primary transition hover:bg-primary-soft"
        >
          <span className="text-lg">＋</span>
          {busy ? "업로드 중..." : "이미지 추가"}
        </button>
      )}

      {err && (
        <p className="absolute bottom-1 left-1 z-10 rounded bg-danger px-2 py-0.5 text-xs text-white">
          {err}
        </p>
      )}
    </div>
  );
}

/** Builds an ImageRenderer that uploads + edits in place. */
export function makeEditableImageRenderer(
  businessId: string,
  onEdit: (path: string, value: string) => void,
): ImageRenderer {
  return function EditableImage({ path, value, className, kind }) {
    return (
      <ImageSlot
        value={value}
        onChange={(url) => onEdit(path, url)}
        businessId={businessId}
        className={className}
        kind={kind}
      />
    );
  };
}
