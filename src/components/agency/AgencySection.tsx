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
  const [open, setOpen] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (serviceKey: string) => {
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
        setOpen(null);
      }
    });
  };

  return (
    <section className="mb-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">전문가 대행 서비스</h2>
          <p className="mt-1 text-sm text-muted">
            블로그·영상 제작을 전담 파트너에게 맡기세요. 문의하면 담당 파트너와 바로
            상담하고 맞춤 견적을 받을 수 있어요.
          </p>
        </div>
        <Link
          href="/dashboard/supporters/apply"
          className="shrink-0 text-sm text-primary underline underline-offset-2"
        >
          서포터즈로 활동하기 →
        </Link>
      </div>

      {assignedPartner && (
        <SupporterProfileCard profile={assignedPartner} heading="내 담당 파트너" />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.key} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{s.label}</h3>
            </div>
            {s.description && (
              <p className="mt-1 text-sm text-muted">{s.description}</p>
            )}
            {open === s.key ? (
              <div className="mt-3 space-y-2">
                <select
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {businesses.length === 0 && <option value="">사업장 없음</option>}
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="요청 내용을 적어주세요(예: 주 2회 블로그, 신메뉴 홍보 영상 등)"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => submit(s.key)} disabled={pending}>
                    문의 보내기
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpen(null)}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  setOpen(s.key);
                  setDone(null);
                  setError(null);
                }}
              >
                문의하기
              </Button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {done && (
        <p className="text-sm text-primary">
          문의를 보냈어요.{" "}
          <Link href={`/dashboard/agency/${done}`} className="underline underline-offset-2">
            대화 열기
          </Link>
        </p>
      )}

      {!assignedPartner && availableSupporters.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">활동 중인 서포터즈</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableSupporters.slice(0, 4).map((s, i) => (
              <SupporterProfileCard key={i} profile={s} heading="서포터" />
            ))}
          </div>
        </div>
      )}

      {inquiries.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">내 대행 문의</h3>
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
    </section>
  );
}
