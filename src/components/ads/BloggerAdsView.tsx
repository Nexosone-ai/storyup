"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BannerView } from "@/components/website/templates/BannerView";
import { AD_SLOTS, type AdSlot } from "@/lib/ads/slots";
import {
  acceptCampaignAction,
  setPlacementStatusAction,
} from "@/app/dashboard/ads/actions";
import type { InventoryCampaign, BloggerPlacement } from "@/lib/ads/placements";
import type { BloggerEarningsReport } from "@/lib/ads/report";
import type { SiteBanner } from "@/types/domain";

const won = (n: number) => `₩${n.toLocaleString()}`;
const SLOT_LABEL: Record<AdSlot, string> = {
  postTop: "글 상단",
  postBottom: "글 하단",
  blogList: "블로그 목록",
  landing: "랜딩 메인",
};

export function BloggerAdsView({
  bloggerBusinessId,
  businessName,
  inventory,
  placements,
  earnings,
}: {
  bloggerBusinessId: string | null;
  businessName: string | null;
  inventory: InventoryCampaign[];
  placements: BloggerPlacement[];
  earnings: BloggerEarningsReport;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [slotSel, setSlotSel] = useState<Record<string, AdSlot[]>>({});

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  const toggleSlot = (campId: string, slot: AdSlot) =>
    setSlotSel((p) => {
      const cur = p[campId] ?? ["postTop"];
      return {
        ...p,
        [campId]: cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot],
      };
    });

  const previewBanner = (c: InventoryCampaign): SiteBanner => ({
    id: c.id,
    placement: "landing",
    image: (c.creative as { image?: string })?.image,
    title: (c.creative as { title?: string })?.title,
    subtitle: (c.creative as { subtitle?: string })?.subtitle,
    ctaLabel: (c.creative as { ctaLabel?: string })?.ctaLabel,
    aspect: (c.creative as { aspect?: SiteBanner["aspect"] })?.aspect ?? "3:1",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">광고 수익</h1>
        <p className="mt-1 text-sm text-muted">
          원하는 광고를 수락해 내 블로그에 노출하고, 클릭당 수익을 받으세요.
        </p>
      </div>
      {note && <p className="text-sm text-primary">{note}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">누적 수익</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(earnings.total)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">정산 예정</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(earnings.pending)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">지급완료</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(earnings.paid)}</p>
        </Card>
      </div>

      {!bloggerBusinessId && (
        <Card>
          <p className="text-sm text-muted">
            광고를 집행하려면 먼저 발행된 사이트(블로그)가 필요합니다. ‘내 비즈니스’에서 사이트를 만들어
            게시해주세요.
          </p>
        </Card>
      )}

      {/* 오픈 인벤토리 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">광고 받기 ({inventory.length})</h2>
        {inventory.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            지금 수락 가능한 광고가 없습니다.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {inventory.map((c) => {
              const slots = slotSel[c.id] ?? ["postTop"];
              return (
                <Card key={c.id} className="space-y-3">
                  <BannerView banner={previewBanner(c)} />
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">{c.name}</p>
                    <span className="tnum text-sm font-semibold text-primary">
                      클릭당 {won(c.bidAmount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    광고주 {c.advertiserName} · 잔여 예산 {won(c.budgetLeft)}
                  </p>
                  {c.alreadyAccepted ? (
                    <Badge tone="success">수락함</Badge>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {AD_SLOTS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSlot(c.id, s)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              slots.includes(s)
                                ? "border-primary bg-primary-soft text-primary"
                                : "border-border text-muted"
                            }`}
                          >
                            {SLOT_LABEL[s]}
                          </button>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        disabled={busy || !bloggerBusinessId || slots.length === 0}
                        onClick={() =>
                          run(() =>
                            acceptCampaignAction(bloggerBusinessId!, c.id, slots),
                          )
                        }
                      >
                        {busy ? <Spinner className="size-4" /> : "이 광고 집행하기"}
                      </Button>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* 내 집행 광고 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          집행 중인 광고 ({placements.length})
        </h2>
        {placements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-muted">
            아직 집행 중인 광고가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">광고</th>
                  <th className="p-3">위치</th>
                  <th className="p-3 text-right">클릭단가</th>
                  <th className="p-3">상태</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-medium">{p.campaignName}</td>
                    <td className="p-3 text-xs">
                      {p.slots.map((s) => SLOT_LABEL[s as AdSlot] ?? s).join(", ")}
                    </td>
                    <td className="tnum p-3 text-right">{won(p.bidAmount)}</td>
                    <td className="p-3">
                      <Badge tone={p.status === "active" ? "success" : "muted"}>
                        {p.status === "active" ? "노출중" : p.status === "paused" ? "중지" : "종료"}
                      </Badge>
                      {p.campaignStatus !== "active" && (
                        <span className="ml-1 text-xs text-muted">(광고주 비활성)</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {p.status === "active" ? (
                          <Button size="sm" variant="ghost" disabled={busy}
                            onClick={() => run(() => setPlacementStatusAction(p.id, "paused"))}>
                            중지
                          </Button>
                        ) : p.status === "paused" ? (
                          <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => run(() => setPlacementStatusAction(p.id, "active"))}>
                            재개
                          </Button>
                        ) : null}
                        {p.status !== "ended" && (
                          <Button size="sm" variant="ghost" disabled={busy}
                            onClick={() => run(() => setPlacementStatusAction(p.id, "ended"))}>
                            <span className="text-danger">종료</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {businessName && (
        <p className="text-xs text-muted">집행 사이트: {businessName}</p>
      )}
    </div>
  );
}
