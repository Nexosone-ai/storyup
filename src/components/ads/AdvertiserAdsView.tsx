"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { formatPhone } from "@/utils/phone";
import { BannerEditor } from "@/components/website/BannerEditor";
import {
  createAdDepositAction,
  confirmAdDepositAction,
  createCampaignAction,
  setCampaignStatusAction,
} from "@/app/business/[id]/ads/actions";
import type { SiteBanner } from "@/types/domain";
import type { AdvertiserReport } from "@/lib/ads/report";

const won = (n: number) => `₩${n.toLocaleString()}`;

const C_STATUS: Record<string, { label: string; tone: "success" | "muted" | "warning" | "danger" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending_review: { label: "검수 대기", tone: "warning" },
  active: { label: "진행중", tone: "success" },
  paused: { label: "일시중지", tone: "muted" },
  exhausted: { label: "예산 소진", tone: "warning" },
  ended: { label: "종료", tone: "muted" },
  rejected: { label: "반려", tone: "danger" },
};

type AdType = "cpc" | "cpv" | "cpa";
const TYPE_META: Record<AdType, { label: string; unit: string; metric: string }> = {
  cpc: { label: "CPC·클릭당", unit: "클릭당 단가", metric: "클릭" },
  cpv: { label: "CPV·노출당", unit: "노출당 단가", metric: "노출" },
  cpa: { label: "CPA·리드당", unit: "리드당 단가", metric: "리드" },
};

export interface AdLeadItem {
  id: string;
  campaignName: string;
  name: string;
  phone: string;
  message: string | null;
  createdAt: string;
}

export function AdvertiserAdsView({
  businessId,
  report,
  buyer,
  leads,
}: {
  businessId: string;
  report: AdvertiserReport;
  buyer: { name: string; email: string };
  leads: AdLeadItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  // 충전
  const [amount, setAmount] = useState("50000");
  const [phone, setPhone] = useState("");

  // 캠페인 생성
  const [cType, setCType] = useState<AdType>("cpc");
  const [banner, setBanner] = useState<SiteBanner>({
    id: "draft",
    placement: "landing",
    aspect: "3:1",
  });
  const [cName, setCName] = useState("");
  const [cUrl, setCUrl] = useState("https://");
  const [cBid, setCBid] = useState("300");
  const [cBudget, setCBudget] = useState("30000");

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  const deposit = () =>
    start(async () => {
      setNote(null);
      const amt = Number(amount);
      const ph = phone.replace(/[^0-9]/g, "");
      if (!buyer.name || !buyer.email || ph.length < 10) {
        setNote("휴대폰 번호를 정확히 입력해주세요. (이름·이메일은 계정 정보 사용)");
        return;
      }
      const { order, error } = await createAdDepositAction(businessId, amt);
      if (error || !order) {
        setNote(error ?? "충전을 시작하지 못했습니다.");
        return;
      }
      try {
        const res = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.orderId,
          orderName: order.orderName,
          totalAmount: order.amount,
          currency: "KRW",
          payMethod: "CARD",
          redirectUrl: `${window.location.origin}/business/${businessId}/ads`,
          customer: { fullName: buyer.name, phoneNumber: ph, email: buyer.email },
        });
        if (res?.code) {
          setNote(res.message ?? "결제가 완료되지 않았습니다.");
          return;
        }
        const conf = await confirmAdDepositAction(businessId, order.orderId);
        setNote(conf.error ?? (conf.status === "PAID" ? "충전되었습니다." : "결제 확인 중입니다."));
        if (conf.status === "PAID") router.refresh();
      } catch {
        setNote("결제 모듈을 불러오지 못했습니다.");
      }
    });

  const createCampaign = () =>
    run(async () => {
      const res = await createCampaignAction(businessId, {
        type: cType,
        name: cName,
        creative: {
          image: banner.image,
          title: banner.title,
          subtitle: banner.subtitle,
          ctaLabel: banner.ctaLabel,
          aspect: banner.aspect,
        },
        targetUrl: cUrl,
        bidAmount: Number(cBid),
        totalBudget: Number(cBudget),
      });
      if (res.id) {
        setCName("");
        setCUrl("https://");
        setBanner({ id: "draft", placement: "landing", aspect: "3:1" });
        return { message: "캠페인을 등록했습니다. 관리자 검수 후 노출됩니다." };
      }
      return res;
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">광고 (CPC)</h1>
        <p className="mt-1 text-sm text-muted">
          광고 지갑에 충전하고 캠페인을 만들면, 블로거들이 수락해 자기 블로그에 광고를 노출합니다.
          클릭당 단가만큼 지갑에서 차감되고, 수수료를 제외한 금액이 블로거에게 지급됩니다.
        </p>
      </div>
      {note && <p className="text-sm text-primary">{note}</p>}

      {/* 지갑 */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">지갑 잔액</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(report.balance)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">누적 지출</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(report.totalSpent)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">총 클릭</p>
          <p className="tnum mt-1 text-2xl font-bold">{report.totalClicks.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">총 노출</p>
          <p className="tnum mt-1 text-2xl font-bold">{report.totalImpressions.toLocaleString()}</p>
        </Card>
      </div>

      {/* 충전 */}
      <Card className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted">충전 금액 (₩)</label>
          <Input
            type="number"
            min={10000}
            step={10000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 text-right"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">휴대폰(결제용)</label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
            className="w-40"
          />
        </div>
        <Button onClick={deposit} disabled={busy}>
          {busy ? <Spinner className="size-4" /> : "카드로 충전"}
        </Button>
        <p className="w-full text-xs text-muted">최소 ₩10,000. 결제 영수증은 {buyer.email}로 발송됩니다.</p>
      </Card>

      {/* 캠페인 생성 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">새 캠페인</h2>
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(["cpc", "cpv", "cpa"] as AdType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCType(t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  cType === t
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted"
                }`}
              >
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {cType === "cpc" && "클릭당 과금 — 방문자가 광고를 클릭하면 단가만큼 차감됩니다."}
            {cType === "cpv" && "노출당 과금 — 광고가 방문자에게 1회 노출될 때마다 차감됩니다."}
            {cType === "cpa" && "리드당 과금 — 광고 신청폼으로 잠재고객 DB(이름·연락처)를 받을 때 차감됩니다."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="캠페인 이름" maxLength={80} />
            <Input
              value={cUrl}
              onChange={(e) => setCUrl(e.target.value)}
              placeholder={cType === "cpa" ? "이동 링크 (선택, https://…)" : "클릭 시 이동할 링크 (https://…)"}
            />
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted">{TYPE_META[cType].unit}(₩)</span>
              <Input type="number" min={1} value={cBid} onChange={(e) => setCBid(e.target.value)} className="w-28 text-right" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted">총 예산(₩)</span>
              <Input type="number" min={1} value={cBudget} onChange={(e) => setCBudget(e.target.value)} className="w-32 text-right" />
            </label>
          </div>
          <p className="text-xs text-muted">광고 소재(배너) — 이미지 업로드 또는 AI 생성, 문구·버튼 설정:</p>
          <BannerEditor
            banner={banner}
            businessId={businessId}
            onChange={setBanner}
            onRemove={() => setBanner({ id: "draft", placement: "landing", aspect: "3:1" })}
          />
          <Button onClick={createCampaign} disabled={busy || !cName.trim()}>
            {busy ? <Spinner className="size-4" /> : "캠페인 등록 (검수 요청)"}
          </Button>
        </Card>
      </section>

      {/* 캠페인 목록·리포트 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">내 캠페인 ({report.campaigns.length})</h2>
        {report.campaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            아직 캠페인이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">캠페인</th>
                  <th className="p-3">유형</th>
                  <th className="p-3">상태</th>
                  <th className="p-3 text-right">단가/예산</th>
                  <th className="p-3 text-right">지출</th>
                  <th className="p-3 text-right">노출/클릭/리드</th>
                  <th className="p-3 text-right">CTR</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {report.campaigns.map((c) => (
                  <tr key={c.campaignId} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-xs uppercase text-muted">{c.type}</td>
                    <td className="p-3">
                      <Badge tone={C_STATUS[c.status]?.tone ?? "muted"}>
                        {C_STATUS[c.status]?.label ?? c.status}
                      </Badge>
                    </td>
                    <td className="tnum p-3 text-right">
                      {won(c.bidAmount)} / {won(c.totalBudget)}
                    </td>
                    <td className="tnum p-3 text-right">{won(c.spent)}</td>
                    <td className="tnum p-3 text-right">
                      {c.impressions.toLocaleString()} / {c.clicks.toLocaleString()} / {c.leads.toLocaleString()}
                    </td>
                    <td className="tnum p-3 text-right">{c.ctr}%</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {c.status === "active" && (
                          <Button size="sm" variant="ghost" disabled={busy}
                            onClick={() => run(() => setCampaignStatusAction(businessId, c.campaignId, "paused"))}>
                            일시중지
                          </Button>
                        )}
                        {c.status === "paused" && (
                          <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => run(() => setCampaignStatusAction(businessId, c.campaignId, "active"))}>
                            재개
                          </Button>
                        )}
                        {!["ended", "rejected"].includes(c.status) && (
                          <Button size="sm" variant="ghost" disabled={busy}
                            onClick={() => run(() => setCampaignStatusAction(businessId, c.campaignId, "ended"))}>
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

      {/* 수령한 리드(CPA) */}
      {leads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">수령한 리드 ({leads.length})</h2>
          <p className="text-xs text-muted">CPA 광고로 받은 잠재고객 DB입니다.</p>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">일시</th>
                  <th className="p-3">이름</th>
                  <th className="p-3">연락처</th>
                  <th className="p-3">문의</th>
                  <th className="p-3">캠페인</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 whitespace-nowrap text-muted">
                      {new Date(l.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </td>
                    <td className="p-3 font-medium">{l.name}</td>
                    <td className="tnum p-3">{l.phone}</td>
                    <td className="p-3 text-xs text-muted">{l.message ?? "-"}</td>
                    <td className="p-3 text-xs">{l.campaignName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
