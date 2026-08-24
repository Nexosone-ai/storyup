"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { setLocaleAction } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (l: Locale) => {
    if (l === locale) return;
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
      {(["ko", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          disabled={pending}
          className={cn(
            "rounded px-2 py-1 text-xs font-semibold uppercase transition-colors",
            locale === l
              ? "bg-primary-soft text-primary"
              : "text-muted hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
