"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";

export interface QuickViewBusiness {
  id: string;
  name: string;
  websiteStatus: "none" | "draft" | "published";
  websiteSlug: string | null;
}

/**
 * 대시보드 상단 바로가기 — 내 랜딩페이지 / 내 블로그 / 내 카드뉴스.
 * 공개된 사이트는 실제 공개 주소(새 탭)로, 아니면 해당 편집 화면으로 간다.
 * 비즈니스가 여러 개면 select로 대상을 고른다.
 */
export function QuickViewBar({ businesses }: { businesses: QuickViewBusiness[] }) {
  const ko = useLocale() === "ko";
  const [selectedId, setSelectedId] = useState(businesses[0]?.id ?? "");
  if (businesses.length === 0) return null;

  const biz = businesses.find((b) => b.id === selectedId) ?? businesses[0];
  const live = biz.websiteStatus === "published" && !!biz.websiteSlug;

  const links = [
    {
      label: ko ? "내 랜딩페이지" : "My landing page",
      icon: Icon.globe,
      href: live ? `/site/${biz.websiteSlug}` : `/business/${biz.id}/website`,
      external: live,
    },
    {
      label: ko ? "내 블로그" : "My blog",
      icon: Icon.pen,
      href: live ? `/site/${biz.websiteSlug}/blog` : `/business/${biz.id}/blog`,
      external: live,
    },
    {
      label: ko ? "내 카드뉴스" : "My card news",
      icon: Icon.megaphone,
      href: `/business/${biz.id}/marketing`,
      external: false,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
      {businesses.length > 1 && (
        <select
          value={biz.id}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label={ko ? "비즈니스 선택" : "Select business"}
          className="h-9 max-w-44 truncate rounded-lg border border-border bg-surface px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      {links.map((l) => {
        const LinkIcon = l.icon;
        return (
          <Link
            key={l.label}
            href={l.href}
            target={l.external ? "_blank" : undefined}
            className="flex items-center gap-2 rounded-lg bg-surface-muted px-3.5 py-2 text-sm font-medium transition-colors hover:bg-primary-soft hover:text-primary"
          >
            <LinkIcon className="size-4" />
            {l.label}
            {l.external && <Icon.external className="size-3.5 text-muted" />}
          </Link>
        );
      })}
      {!live && (
        <span className="text-xs text-muted">
          {ko
            ? "랜딩페이지를 공개하면 실제 공개 주소로 연결돼요"
            : "Publish your landing page to open the live URLs"}
        </span>
      )}
    </div>
  );
}
