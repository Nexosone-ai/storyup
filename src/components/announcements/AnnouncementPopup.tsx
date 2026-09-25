"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import type { ActiveAnnouncement } from "@/lib/admin/announcements";

const dismissKey = (id: string) => `announce-dismiss-${id}`;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * 공지 팝업 — 활성 공지가 있으면 로그인 사용자에게 1건 표시.
 * '오늘 하루 보지 않기'는 공지 id별로 localStorage에 오늘 날짜를 저장한다
 * (다음 날 다시 뜨고, 새 공지는 별도 키라 무조건 다시 뜬다).
 */
export function AnnouncementPopup({
  announcement,
}: {
  announcement: ActiveAnnouncement;
}) {
  const ko = useLocale() === "ko";
  const [open, setOpen] = useState(false);

  // 마운트 후에만 표시 여부 결정 — 하이드레이션 불일치·SSR localStorage 접근 회피
  useEffect(() => {
    const decide = () => {
      try {
        if (localStorage.getItem(dismissKey(announcement.id)) === today())
          return; // 오늘 이미 닫음
      } catch {
        /* localStorage 접근 불가 시엔 그냥 표시 */
      }
      setOpen(true);
    };
    decide();
  }, [announcement.id]);

  if (!open) return null;

  const dismissToday = () => {
    try {
      localStorage.setItem(dismissKey(announcement.id), today());
    } catch {
      /* 저장 실패해도 닫기는 진행 */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ko ? "공지사항" : "Announcement"}
        className="relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
      >
        <button
          type="button"
          aria-label={ko ? "닫기" : "Close"}
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <Icon.x width={18} height={18} />
        </button>

        <AnnouncementBody
          content={announcement}
          onLinkClick={() => setOpen(false)}
        />

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={dismissToday}
            className="text-xs font-medium text-muted hover:text-foreground"
          >
            {ko ? "오늘 하루 보지 않기" : "Don't show again today"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            {ko ? "닫기" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
