"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { updateBusinessAction } from "@/app/business/actions";
import { BUSINESS_CATEGORIES } from "@/types/domain";

/**
 * 비즈니스 세부설정 — 이름·업종(카테고리) 편집.
 * 업종을 바꾸면 카테고리별 기능 노출(예: 작가 카테고리의 음악 앨범)도 따라 바뀐다.
 */
export function BusinessSettingsForm({
  businessId,
  name,
  category,
  categoryLabels,
}: {
  businessId: string;
  name: string;
  category: string;
  categoryLabels: Record<string, string>;
}) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [draftName, setDraftName] = useState(name);
  const [draftCategory, setDraftCategory] = useState(category);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const dirty = draftName.trim() !== name || draftCategory !== category;

  const save = () => {
    setNote(null);
    start(async () => {
      const res = await updateBusinessAction(businessId, {
        name: draftName,
        category: draftCategory,
      });
      if (res.error) setNote({ text: res.error, error: true });
      else {
        setNote({
          text: res.message ?? (ko ? "저장되었습니다." : "Saved."),
          error: false,
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <Label htmlFor="biz-name">{ko ? "비즈니스 이름" : "Business name"}</Label>
        <Input
          id="biz-name"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="biz-category">{ko ? "업종" : "Category"}</Label>
        <Select
          id="biz-category"
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
        >
          {BUSINESS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c] ?? c}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-muted">
          {ko
            ? "업종에 따라 제공되는 기능이 달라져요. (예: ‘작가·예술가’를 고르면 음악 앨범 섹션이 열려요.)"
            : "Available features depend on the category. (e.g. choosing ‘Artist’ unlocks the music album section.)"}
        </p>
      </div>

      {note && (
        <p
          className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}
        >
          {note.text}
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending || !dirty}>
          {pending ? <Spinner className="size-4" /> : ko ? "저장" : "Save"}
        </Button>
      </div>
    </div>
  );
}
