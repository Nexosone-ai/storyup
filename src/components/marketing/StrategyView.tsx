"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { generateStrategyAction } from "@/app/business/[id]/strategy/actions";
import type { MarketingStrategyResult } from "@/types/domain";

interface Initial {
  content: MarketingStrategyResult;
  createdAt: string;
}

export function StrategyView({
  businessId,
  ko,
  unlimited,
  initial,
}: {
  businessId: string;
  ko: boolean;
  unlimited: boolean;
  initial: Initial | null;
}) {
  const [strategy, setStrategy] = useState<MarketingStrategyResult | null>(
    initial?.content ?? null,
  );
  const [when, setWhen] = useState<string | null>(initial?.createdAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(null);
      const res = await generateStrategyAction(businessId);
      if (res.error) setError(res.error);
      else if (res.result) {
        setStrategy(res.result);
        setWhen(new Date().toISOString());
      }
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ko ? "AI 마케팅 전략" : "AI marketing strategy"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? `방문·리드·발행 지표를 분석해 실행 액션을 제안해요. ${unlimited ? "(상시 생성 가능)" : "(Basic 월 1회)"}`
              : `Actionable suggestions from your metrics. ${unlimited ? "(unlimited)" : "(Basic: once/month)"}`}
          </p>
        </div>
        <Button onClick={generate} disabled={busy}>
          {busy ? (
            <Spinner className="size-4" />
          ) : strategy ? (
            ko ? "새 전략 생성" : "Regenerate"
          ) : ko ? (
            "전략 생성"
          ) : (
            "Generate"
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!strategy && !busy && (
        <Card className="p-8 text-center text-sm text-muted">
          {ko
            ? "아직 생성된 전략이 없어요. 위 버튼으로 첫 전략을 만들어보세요."
            : "No strategy yet. Generate your first one above."}
        </Card>
      )}

      {strategy && (
        <div className="space-y-4">
          {when && (
            <p className="text-xs text-muted">
              {ko ? "생성일 " : "Generated "}
              {new Date(when).toLocaleString(ko ? "ko-KR" : "en-US")}
            </p>
          )}
          <Card className="space-y-2 border-primary/25 bg-primary-soft/30">
            <p className="text-sm font-semibold">{ko ? "요약" : "Summary"}</p>
            <p className="text-sm">{strategy.summary}</p>
            <p className="pt-1 text-sm">
              <span className="font-semibold">
                🎯 {ko ? "핵심 집중" : "Focus"}:{" "}
              </span>
              {strategy.focus}
            </p>
          </Card>

          <div className="space-y-3">
            {strategy.actions.map((a, i) => (
              <Card key={i} className="space-y-1.5">
                <p className="font-semibold">
                  {i + 1}. {a.title}
                </p>
                <p className="text-sm text-muted">
                  <span className="font-medium text-foreground">
                    {ko ? "왜 " : "Why "}
                  </span>
                  {a.reason}
                </p>
                <p className="text-sm text-muted">
                  <span className="font-medium text-foreground">
                    {ko ? "어떻게 " : "How "}
                  </span>
                  {a.how}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
