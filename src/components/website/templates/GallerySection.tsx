"use client";

import { useRef, useState } from "react";
import { uploadSiteImage } from "@/app/business/actions";
import { resizeImage } from "./ImageSlot";
import type { GalleryRenderer } from "./shared";

function GallerySection({
  images,
  onChange,
  businessId,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  businessId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setErr(null);
    setBusy(true);
    const added: string[] = [];
    for (const file of files.slice(0, 12)) {
      try {
        const resized = await resizeImage(file, 1400);
        const fd = new FormData();
        fd.append("file", resized);
        const res = await uploadSiteImage(businessId, fd);
        if (res.url) added.push(res.url);
        else setErr(res.error ?? "일부 이미지를 업로드하지 못했습니다.");
      } catch {
        setErr("업로드 중 문제가 발생했습니다.");
      }
    }
    if (added.length) onChange([...images, ...added]);
    setBusy(false);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((src, i) => (
          <div
            key={i}
            className="group/g relative aspect-square overflow-hidden rounded-xl border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover/g:opacity-100 hover:bg-black/75"
            >
              삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 text-sm font-medium text-primary transition hover:bg-primary-soft disabled:opacity-60"
        >
          <span className="text-lg">＋</span>
          {busy ? "업로드 중..." : "사진 추가"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </div>
  );
}

/** Builds a GalleryRenderer wired to the editor's content state. */
export function makeEditableGallery(
  businessId: string,
  onChange: (next: string[]) => void,
): GalleryRenderer {
  return function EditableGallery(images) {
    return (
      <GallerySection
        images={images}
        onChange={onChange}
        businessId={businessId}
      />
    );
  };
}
