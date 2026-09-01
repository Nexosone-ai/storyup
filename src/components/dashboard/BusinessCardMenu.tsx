"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import {
  updateBusinessAction,
  deleteBusinessAction,
} from "@/app/business/actions";
import { BUSINESS_CATEGORIES } from "@/types/domain";

/** 카드가 <Link>라서 메뉴 클릭이 내비게이션으로 새지 않게 막는다. */
function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function BusinessCardMenu({
  businessId,
  name,
  category,
}: {
  businessId: string;
  name: string;
  category: string;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftCategory, setDraftCategory] = useState(category);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = (e: React.SyntheticEvent) => {
    stop(e);
    setMenuOpen(false);
    if (
      !window.confirm(
        `'${name}' 비즈니스를 삭제할까요?\n\n브랜드·홈페이지·블로그 글 등 모든 콘텐츠가 함께 영구 삭제되며 되돌릴 수 없습니다.`,
      )
    )
      return;
    start(async () => {
      const res = await deleteBusinessAction(businessId);
      if (res.error) window.alert(res.error);
      else router.refresh();
    });
  };

  const save = (e: React.SyntheticEvent) => {
    stop(e);
    setError(null);
    start(async () => {
      const res = await updateBusinessAction(businessId, {
        name: draftName,
        category: draftCategory,
      });
      if (res.error) setError(res.error);
      else {
        setEditOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <div onClick={stop} className="relative shrink-0">
      <button
        type="button"
        aria-label="비즈니스 관리"
        onClick={(e) => {
          stop(e);
          setMenuOpen((v) => !v);
        }}
        className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        {pending ? <Spinner className="size-4" /> : <Icon.more className="size-[18px]" />}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { stop(e); setMenuOpen(false); }} />
          <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-md">
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setMenuOpen(false);
                setDraftName(name);
                setDraftCategory(category);
                setError(null);
                setEditOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <Icon.pen className="size-4 text-muted" />
              수정
            </button>
            <button
              type="button"
              onClick={remove}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-danger hover:bg-red-50"
            >
              <Icon.x className="size-4" />
              삭제
            </button>
          </div>
        </>
      )}

      {editOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-foreground/25 p-4 backdrop-blur-sm"
            onClick={() => setEditOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold tracking-tight">
                비즈니스 수정
              </h3>
              <div className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="biz-name">이름</Label>
                  <Input
                    id="biz-name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="biz-category">업종</Label>
                  <Select
                    id="biz-category"
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                  >
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditOpen(false)}
                  disabled={pending}
                >
                  취소
                </Button>
                <Button size="sm" onClick={save} disabled={pending}>
                  {pending ? <Spinner className="size-4" /> : "저장"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
