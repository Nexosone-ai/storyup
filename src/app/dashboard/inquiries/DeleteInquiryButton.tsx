"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { deleteInquiryAction } from "./actions";

/** 문의 삭제 버튼 — 실수로 지우지 않도록 한 번 더 확인한 뒤 삭제한다. */
export function DeleteInquiryButton({
  id,
  ko,
}: {
  id: string;
  ko: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onClick = () => {
    if (
      !confirm(
        ko
          ? "이 문의를 삭제하시겠습니까? 삭제하면 되돌릴 수 없어요."
          : "Delete this inquiry? This cannot be undone.",
      )
    )
      return;
    start(async () => {
      await deleteInquiryAction(id);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={ko ? "삭제" : "Delete"}
      className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-50"
    >
      <Icon.x width={16} height={16} />
    </button>
  );
}
