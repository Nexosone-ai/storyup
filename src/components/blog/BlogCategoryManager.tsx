"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  addBlogCategoryAction,
  renameBlogCategoryAction,
  deleteBlogCategoryAction,
} from "@/app/business/actions";

/**
 * 블로그 카테고리 관리 — 사장님이 카테고리를 추가/이름변경/삭제한다.
 * 이름변경 시 해당 글들의 카테고리도 함께 바뀌고, 삭제 시 글은 미분류가 된다.
 */
export function BlogCategoryManager({
  businessId,
  categories,
}: {
  businessId: string;
  categories: string[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) {
        setAdding("");
        setEditing(null);
        router.refresh();
      }
    });

  return (
    <Card className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-sm font-semibold">
          카테고리 관리{" "}
          <span className="text-muted">({categories.length})</span>
        </span>
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            블로그 카테고리를 추가·변경·삭제합니다. 이름을 바꾸면 그 카테고리의 글도 함께 이동하고,
            삭제하면 해당 글은 미분류가 됩니다. (랜딩페이지 ‘글 목록’ 섹션의 카테고리와 연동)
          </p>
          {note && <p className="text-sm text-primary">{note}</p>}

          {/* 추가 */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="새 카테고리 (예: 여행)"
              maxLength={30}
              className="max-w-xs"
            />
            <Button
              size="sm"
              disabled={busy || !adding.trim()}
              onClick={() => run(() => addBlogCategoryAction(businessId, adding))}
            >
              {busy ? <Spinner className="size-4" /> : "추가"}
            </Button>
          </div>

          {/* 목록 */}
          {categories.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface p-5 text-center text-sm text-muted">
              아직 카테고리가 없습니다. 위에서 추가하거나, 글 작성 시 카테고리를 입력하면 자동으로
              쌓입니다.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {categories.map((c) => (
                <li
                  key={c}
                  className="flex flex-wrap items-center gap-2 px-3 py-2"
                >
                  {editing === c ? (
                    <>
                      <Input
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        maxLength={30}
                        className="max-w-[12rem]"
                      />
                      <Button
                        size="sm"
                        disabled={busy || !editVal.trim()}
                        onClick={() =>
                          run(() =>
                            renameBlogCategoryAction(businessId, c, editVal),
                          )
                        }
                      >
                        저장
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                      >
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{c}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setEditing(c);
                          setEditVal(c);
                        }}
                      >
                        이름변경
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `'${c}' 카테고리를 삭제할까요? 이 카테고리의 글은 미분류로 바뀝니다.`,
                            )
                          )
                            run(() =>
                              deleteBlogCategoryAction(businessId, c),
                            );
                        }}
                      >
                        <span className="text-danger">삭제</span>
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
