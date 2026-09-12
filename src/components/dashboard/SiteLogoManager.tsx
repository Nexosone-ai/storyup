"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import { uploadSiteImage, updateSiteLogoAction } from "@/app/business/actions";
import type { SiteLogoItem } from "@/lib/queries";

/**
 * 설정 페이지의 사이트 로고 관리.
 * 사이트별로 로고를 올리거나 제거한다. 로고를 안 올리면 헤더는 hero 사진으로 자동 대체된다.
 */
export function SiteLogoManager({ items }: { items: SiteLogoItem[] }) {
  const ko = useLocale() === "ko";
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        {ko
          ? "아직 만든 사이트가 없어요. 사이트를 만들면 여기에서 로고를 관리할 수 있어요."
          : "No sites yet. Once you create a site, you can manage its logo here."}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <SiteLogoRow key={it.businessId} item={it} ko={ko} />
      ))}
    </ul>
  );
}

function SiteLogoRow({ item, ko }: { item: SiteLogoItem; ko: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(item.logo);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startRemove] = useTransition();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const resized = await resizeImage(file, 512);
      const fd = new FormData();
      fd.append("file", resized);
      const up = await uploadSiteImage(item.businessId, fd);
      if (up.error || !up.url) {
        setNote(up.error ?? (ko ? "업로드에 실패했습니다." : "Upload failed."));
        return;
      }
      const res = await updateSiteLogoAction(item.businessId, up.url);
      if (res.error) {
        setNote(res.error);
        return;
      }
      setLogo(up.url);
      setNote(ko ? "저장되었어요." : "Saved.");
    } catch {
      setNote(
        ko ? "업로드 중 문제가 발생했어요." : "Something went wrong during upload.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    startRemove(async () => {
      setNote(null);
      const res = await updateSiteLogoAction(item.businessId, null);
      if (res.error) setNote(res.error);
      else {
        setLogo(null);
        setNote(
          ko
            ? "로고를 제거했어요. 헤더는 hero 사진으로 표시돼요."
            : "Logo removed. The header will use the hero photo.",
        );
      }
    });

  return (
    <li className="flex items-center gap-4 rounded-xl border border-border p-4">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-muted">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원격 이미지
          <img src={logo} alt="" className="size-full object-contain" />
        ) : item.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- hero 사진 자동 대체 미리보기
          <img src={item.heroImage} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-[11px] text-muted">{ko ? "없음" : "None"}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {logo
            ? ko
              ? "로고 사용 중"
              : "Using logo"
            : item.heroImage
              ? ko
                ? "hero 사진 자동 사용 중"
                : "Using hero photo"
              : ko
                ? "로고·사진 없음"
                : "No logo or photo"}
        </p>
        {note && <p className="mt-1 text-xs text-primary">{note}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy || pending}
        >
          {busy ? (
            <Spinner className="size-4" />
          ) : logo ? (
            ko ? (
              "변경"
            ) : (
              "Change"
            )
          ) : ko ? (
            "로고 업로드"
          ) : (
            "Upload"
          )}
        </Button>
        {logo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={busy || pending}
          >
            {ko ? "제거" : "Remove"}
          </Button>
        )}
      </div>
    </li>
  );
}
