"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  saveRewardSettingAction,
  resetRewardSettingAction,
  lookupUserGrowthAction,
  type UserGrowthLookup,
} from "@/app/dashboard/admin/actions";
import type {
  GrowthStats,
  GrowthSettingEntry,
} from "@/lib/gamification/admin";

const KEY_LABELS: Record<string, string> = {
  rules: "행동별 UP/XP 지급량 · 일일 상한 (rules)",
  levels: "레벨 기준 (levels)",
  missions: "데일리 미션 풀 (missions)",
  weekly_quest: "위클리 퀘스트 (weekly_quest)",
  score_weights: "Story Score 가중치 (score_weights)",
  surprise: "서프라이즈 보너스 (surprise)",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tnum mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

/** 게이미피케이션 관리 — 통계 · 정책 편집 · 사용자 성장 조회. */
export function AdminGrowthView({
  stats,
  settings,
}: {
  stats: GrowthStats;
  settings: GrowthSettingEntry[];
}) {
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold tracking-tight">
        성장 시스템 (UP · XP · 미션)
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="보상 UP 발행량" value={`${stats.rewardUpIssued.toLocaleString()} UP`} />
        <Stat label="UP 사용량 (AI)" value={`${stats.upSpent.toLocaleString()} UP`} />
        <Stat label="보상 지급 건수" value={stats.rewardCount.toLocaleString()} />
        <Stat label="스트릭 진행 중" value={`${stats.activeStreaks.toLocaleString()}명`} />
        <Stat label="추천 성사" value={`${stats.referrals.toLocaleString()}건`} />
      </div>

      <GrowthLookup />

      <div className="space-y-4">
        <p className="text-sm text-muted">
          정책은 코드 기본값 위에 저장한 값이 덮어써집니다. 잘못된 값을 저장했다면
          &ldquo;기본값으로&rdquo;를 눌러 되돌릴 수 있어요. 저장 후 최대 1분 안에 반영됩니다.
        </p>
        {settings.map((s) => (
          <SettingEditor key={s.key} entry={s} />
        ))}
      </div>
    </section>
  );
}

function SettingEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [json, setJson] = useState(entry.json);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote({
        text: res.error ?? res.message ?? "완료",
        error: !!res.error,
      });
    });

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">
          {KEY_LABELS[entry.key] ?? entry.key}
          {entry.overridden && (
            <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
              오버라이드 적용 중
            </span>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => run(() => resetRewardSettingAction(entry.key))}
          >
            기본값으로
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => run(() => saveRewardSettingAction(entry.key, json))}
          >
            {saving ? <Spinner className="size-4" /> : "저장"}
          </Button>
        </div>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={Math.min(14, json.split("\n").length + 1)}
        spellCheck={false}
        className="w-full rounded-xl border border-border bg-surface-muted/50 p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
      />
      {note && (
        <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
          {note.text}
        </p>
      )}
    </Card>
  );
}

function GrowthLookup() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<UserGrowthLookup | null>(null);
  const [busy, start] = useTransition();

  const lookup = () =>
    start(async () => {
      setResult(await lookupUserGrowthAction(email));
    });

  return (
    <Card className="space-y-3">
      <p className="font-medium">사용자 성장 조회</p>
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="h-9"
        />
        <Button size="sm" onClick={lookup} disabled={busy || !email.trim()}>
          {busy ? <Spinner className="size-4" /> : "조회"}
        </Button>
      </div>
      {result?.error && <p className="text-sm text-danger">{result.error}</p>}
      {result && !result.error && (
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            {result.name} <span className="text-muted">({result.email})</span>
          </p>
          <p className="tnum">
            🪙 {result.balance?.toLocaleString()} UP · ⭐{" "}
            {result.xp?.toLocaleString()} XP · 🔥 {result.streak}일 · 🏆{" "}
            {result.achievements}개 · 추천 {result.referrals}명
          </p>
          {!!result.recentRewards?.length && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {result.recentRewards.map((r, i) => (
                <li key={i} className="flex justify-between px-3 py-2 text-xs">
                  <span>{r.rule}</span>
                  <span className="tnum text-muted">
                    +{r.up} UP / +{r.xp} XP ·{" "}
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
