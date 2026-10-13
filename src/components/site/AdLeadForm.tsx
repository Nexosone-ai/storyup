"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { formatPhone } from "@/utils/phone";
import { submitAdLeadAction } from "@/app/ads/lead/actions";

export function AdLeadForm({ placementId }: { placementId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const submit = () =>
    start(async () => {
      setNote(null);
      const res = await submitAdLeadAction(placementId, {
        name,
        phone: phone.replace(/[^0-9]/g, ""),
        message,
      });
      if (res.error) {
        setNote(res.error);
        return;
      }
      setDone(true);
      setNote(res.message ?? "신청이 접수되었습니다.");
    });

  if (done)
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-6 text-center">
        <p className="font-semibold text-primary">신청 완료</p>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </div>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white p-6">
      <p className="text-sm font-semibold">상담/정보 신청</p>
      <div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" autoComplete="name" maxLength={40} />
      </div>
      <div>
        <Input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="휴대폰 번호 (010-0000-0000)"
          autoComplete="tel"
          maxLength={13}
        />
      </div>
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="문의 내용 (선택)"
          maxLength={500}
          className="min-h-20 w-full resize-y rounded-lg border border-border px-3 py-2 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>
      {note && <p className="text-sm text-danger">{note}</p>}
      <Button className="w-full" onClick={submit} disabled={busy || !name.trim() || phone.replace(/[^0-9]/g, "").length < 10}>
        {busy ? <Spinner className="size-4" /> : "신청하기"}
      </Button>
      <p className="text-center text-[11px] text-muted">
        입력하신 정보는 광고주에게 전달되어 상담 목적으로만 사용됩니다.
      </p>
    </div>
  );
}
