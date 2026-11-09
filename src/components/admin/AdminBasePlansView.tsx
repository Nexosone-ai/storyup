"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";
import {
  saveBasePlanAction,
  deleteBasePlanAction,
} from "@/app/dashboard/admin/base-plans/actions";

const won = (n: number) => `₩${n.toLocaleString()}`;

interface BasePlanInfo {
  plan: "basic" | "pro";
  displayName: string;
  supplyPriceKrw: number;
  summary: string | null;
  includedServices: string | null;
  source: "db" | "default";
}

export function AdminBasePlansView({
  enabled,
  plans,
}: {
  enabled: boolean;
  plans: BasePlanInfo[];
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">본사 기본상품 (공급가)</h2>
        <p className="mt-1 text-sm text-muted">
          파트너가 상품을 만들 때 참조하는 본사 기준 요금제의 상품명·공급가·포함
          내역을 관리합니다. 여기서 바꾸면 파트너 상품 등록 화면과 정산 공제 기준이
          즉시 반영됩니다(이미 저장된 파트너 상품의 스냅샷 공급가는 변하지 않습니다).
          설정을 삭제하면 해당 상품은 코드 기본값(plans.ts)으로 되돌아갑니다.
          {!enabled && (
            <span className="ml-1 text-danger">
              (B2B2C 기능 플래그 꺼짐 — 파트너 판매는 비활성)
            </span>
          )}
        </p>
      </div>
      {plans.map((p) => (
        <PlanForm
          key={`${p.plan}:${p.source}:${p.supplyPriceKrw}:${p.displayName}`}
          info={p}
        />
      ))}
    </div>
  );
}

function PlanForm({ info }: { info: BasePlanInfo }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(info.displayName);
  const [price, setPrice] = useState(String(info.supplyPriceKrw));
  const [summary, setSummary] = useState(info.summary ?? "");
  const [included, setIncluded] = useState(info.includedServices ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const label = info.plan === "basic" ? "Basic" : "Pro";

  const remove = () => {
    if (
      !window.confirm(
        `${label} 기본상품 설정을 삭제할까요?\n\n삭제하면 상품명·공급가·포함 내역이 코드 기본값으로 되돌아가고, 파트너 상품 등록 화면과 이후 정산 공제 기준에 즉시 반영됩니다. 이미 저장된 파트너 상품의 스냅샷 공급가는 그대로입니다.`,
      )
    )
      return;
    start(async () => {
      setMsg(null);
      const res = await deleteBasePlanAction(info.plan);
      if (res.error) setMsg(res.error);
      else {
        setMsg("설정을 삭제하고 기본값으로 되돌렸습니다.");
        router.refresh();
      }
    });
  };

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveBasePlanAction({
        plan: info.plan,
        displayName,
        supplyPriceKrw: Number(price) || 0,
        summary: summary || null,
        includedServices: included || null,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg("저장되었습니다.");
        router.refresh();
      }
    });

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{label} 기준 상품</h3>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
          {info.source === "db"
            ? `현재 공급가 ${won(info.supplyPriceKrw)}`
            : "기본값(미설정) — 저장 시 관리 전환"}
        </span>
      </div>
      <div>
        <Label required>상품명(고객·파트너 노출)</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="예: STORYUP Basic"
        />
      </div>
      <div>
        <Label required>공급가(원)</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">
          파트너 정산 시 본사가 공제하는 기준 금액입니다.
        </p>
      </div>
      <div>
        <Label>한 줄 요약</Label>
        <Input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="예: 소상공인을 위한 기본 마케팅 자동화"
        />
      </div>
      <div>
        <Label>포함 내역 (한 줄에 하나씩)</Label>
        <Textarea
          rows={10}
          value={included}
          onChange={(e) => setIncluded(e.target.value)}
          placeholder={"블로그 생성 100건/월\nSNS 카드뉴스 30건/월\n…"}
        />
        <p className="mt-1 text-xs text-muted">
          줄바꿈으로 구분하면 파트너 화면에 불릿으로 표시됩니다.
        </p>
      </div>
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "처리 중…" : `${label} 저장`}
        </Button>
        {info.source === "db" && (
          <Button variant="ghost" onClick={remove} disabled={busy}>
            설정 삭제(기본값으로)
          </Button>
        )}
      </div>
    </Card>
  );
}
