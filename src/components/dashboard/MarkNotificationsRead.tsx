"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction } from "@/app/dashboard/notifications/actions";

/**
 * 알림 목록을 열면 안 읽은 알림을 모두 읽음 처리하고 화면을 새로고침해
 * 헤더의 종모양 배지를 즉시 지운다. hasUnread일 때만 동작한다.
 */
export function MarkNotificationsRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!hasUnread || done.current) return;
    done.current = true;
    void markAllNotificationsReadAction().then(() => router.refresh());
  }, [hasUnread, router]);
  return null;
}
