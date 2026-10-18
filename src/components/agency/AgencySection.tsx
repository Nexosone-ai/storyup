"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createInquiryAction } from "@/app/agency/actions";
import {
  SupporterProfileCard,
  type SupporterProfileView,
} from "@/components/agency/SupporterProfileCard";

interface Service {
  key: string;
  label: string;
  description: string | null;
  supplyPriceKrw: number;
}
interface BizOption {
  id: string;
  name: string;
}
interface Inquiry {
  id: string;
  serviceLabel: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "접수",
  quoted: "견적 발행",
  paid: "결제 완료",
  in_progress: "진행중",
  done: "완료",
  cancelled: "취소",
};

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function AgencySection({
  services,
  businesses,
  inquiries,
  assignedPartner,
  availableSupporters,
}: {
  services: Service[];
  businesses: BizOption[];
  inquiries: Inquiry[];
  assignedPartner: SupporterProfileView | null;
  availableSupporters: SupporterProfileView[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [serviceKey, setServiceKey] = useState(services[0]?.key ?? "");
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openForm = (presetService?: string) => {
    if (presetService) setServiceKey(presetService);
    else if (!serviceKey) setServiceKey(services[0]?.key ?? "");
    setDone(null);
    setError(null);
    setFormOpen(true);
  };

  const submit = () => {
    if (!serviceKey) {
      setError("의뢰할 분야를 선택해주세요.");
      return;
    }
    if (!businessId) {
      setError("문의할 사업장을 선택해주세요.");
      return;
    }
    start(async () => {
      setError(null);
      const res = await createInquiryAction(businessId, serviceKey, message);
      if (res.error) setError(res.error);
      else {
        setDone(res.id ?? null);
        setMessage("");
        setFormOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 상단 CTA + 서포터즈 신청 링크 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">서포팅이 필요한 분야</h2>
        <Link
          href="/dashboard/supporters/apply"
          className="text-sm text-primary underline underline-offset-2"
        >
          서포터즈로 활동하기 →
        </Link>
      </div>

      {assignedPartner && (
        <SupporterProfileCard profile={assignedPartner} heading="내 담당 파트너" />
      )}

      {/* 분야(서비스) 카드 — 의뢰 내용 선택 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.key} className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="font-semibold">{s.label}</h3>
            {s.description && (
              <p className="mt-1 text-sm text-muted">{s.description}</p>
            )}
            <Button size="sm" className="mt-3" onClick={() => openForm(s.key)}>
              의뢰하기
            </Button>
          </div>
        ))}
      </div>

      {/* 의뢰 폼(공용) */}
      {formOpen && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/20 p-4">
          <h3 className="text-sm font-semibold">의뢰 작성</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              분야
              <select
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                className={`mt-1 ${field}`}
              >
                {services.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              사업장
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className={`mt-1 ${field}`}
              >
                {businesses.length === 0 && <option value="">사업장 없음</option>}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="요청 내용을 적어주세요(예: 주 2회 블로그, 신메뉴 홍보 영상 등)"
            className={`mt-2 resize-none ${field}`}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={submit} disabled={pending}>
              의뢰 보내기
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFormOpen(false)}>
              취소
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {done && (
        <p className="text-sm text-primary">
          의뢰를 보냈어요.{" "}
          <Link href={`/dashboard/agency/${done}`} className="underline underline-offset-2">
            대화 열기
          </Link>
        </p>
      )}

      {/* 전문가(서포터즈) — 이력·포트폴리오 중심 + 의뢰하기 */}
      {availableSupporters.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold tracking-tight">분야 전문가</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {availableSupporters.map((s, i) => (
              <div key={i} className="space-y-2">
                <SupporterProfileCard profile={s} heading="전문가" />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => openForm()}
                >
                  의뢰하기
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 내 대행 문의 */}
      {inquiries.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">내 의뢰</h3>
          <ul className="space-y-1.5">
            {inquiries.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/dashboard/agency/${i.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
                >
                  <span className="truncate">{i.serviceLabel}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
