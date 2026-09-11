"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markInquiriesReadAction } from "./actions";

/**
 * 문의 목록을 열면 안 읽은 문의를 모두 읽음 처리하고 화면을 새로고침해
 * 메뉴의 안읽음 배지를 즉시 지운다. hasUnread일 때만 동작한다.
 */
export function MarkInquiriesRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!hasUnread || done.current) return;
    done.current = true;
    void markInquiriesReadAction().then(() => router.refresh());
  }, [hasUnread, router]);
  return null;
}
