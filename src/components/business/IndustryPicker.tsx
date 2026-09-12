"use client";

import { useState, useTransition } from "react";
import { INDUSTRIES } from "@/types/domain";
import { updateBusinessIndustryAction } from "@/app/business/actions";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cn } from "@/utils/cn";

/**
 * 브랜드 페이지의 업종(대분류) 선택 카드.
 * 선택하면 businesses.industry에 저장되고, 스토리업 둘러보기(쇼케이스)에서 업종별로 묶여 보인다.
 */
export function IndustryPicker({
  businessId,
  current,
}: {
  businessId: string;
  current: string | null;
}) {
  const ko = useLocale() === "ko";
  const [selected, setSelected] = useState<string | null>(current);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pick = (id: string) => {
    if (pending) return;
    const next = selected === id ? "" : id; // 다시 누르면 해제
    const prev = selected;
    setSelected(next || null);
    setNote(null);
    start(async () => {
      const res = await updateBusinessIndustryAction(businessId, next);
      if (res.error) {
        setSelected(prev); // 실패 시 되돌린다
        setNote(res.error);
      } else {
        setNote(ko ? "저장되었어요." : "Saved.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-semibold tracking-tight">
          {ko ? "업종" : "Industry"}
        </h2>
        {note && <span className="text-xs text-primary">{note}</span>}
      </div>
      <p className="mb-4 text-sm text-muted">
        {ko
          ? "업종을 고르면 스토리업 둘러보기에서 같은 업종끼리 모아볼 수 있어요."
          : "Pick an industry so your page can be browsed by category in the STORYUP showcase."}
      </p>
      <div className="flex flex-wrap gap-2">
        {INDUSTRIES.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => pick(it.id)}
            aria-pressed={selected === it.id}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              selected === it.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong bg-surface text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary",
            )}
          >
            {ko ? it.ko : it.en}
          </button>
        ))}
      </div>
    </div>
  );
}
