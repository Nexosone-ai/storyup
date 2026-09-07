"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

// config.ts는 서버 전용(supabase admin client)이라 클라이언트에서 타입만 재정의한다.
interface RewardRule {
  up: number;
  xp: number;
  dailyCap?: number;
}
interface LevelDef {
  xp: number;
  name: string;
}
interface MissionDef {
  code: string;
  action: string;
  labelKo: string;
  labelEn: string;
  rewardRule: string;
}
interface QuestItemDef {
  action: string;
  target: number;
  labelKo: string;
  labelEn: string;
}

/** 행동 키 → 운영자용 한글 이름 */
const RULE_LABELS: Record<string, string> = {
  signup: "가입 보너스",
  brand_profile: "브랜드 스토리 완성",
  site_created: "랜딩페이지 생성",
  site_updated: "랜딩페이지 업데이트",
  blog_created: "블로그 작성",
  blog_published: "블로그 발행",
  card_created: "SNS 카드뉴스 생성",
  share: "콘텐츠 공유",
  ref_invite: "초대 링크 복사 (1회)",
  ref_signup: "추천 가입 성사",
  ref_paid: "추천인 유료 전환",
  daily_clear: "데일리 미션 올클리어",
  weekly_quest: "위클리 퀘스트 완료",
  streak_3: "스트릭 3일",
  streak_7: "스트릭 7일",
  streak_14: "스트릭 14일",
  streak_30: "스트릭 30일",
  streak_100: "스트릭 100일",
  achievement: "업적 기본 보상",
  surprise: "서프라이즈 보너스",
};

/** 미션/퀘스트에 쓸 수 있는 행동 목록 */
const ACTION_OPTIONS = [
  { value: "blog_created", label: "블로그 작성" },
  { value: "blog_published", label: "블로그 발행" },
  { value: "card_created", label: "카드뉴스 생성" },
  { value: "site_updated", label: "랜딩페이지 업데이트" },
  { value: "share", label: "콘텐츠 공유" },
  { value: "brand_profile", label: "브랜드 스토리 완성" },
  { value: "site_created", label: "랜딩페이지 생성" },
];

const SCORE_LABELS: Record<string, string> = {
  brand: "브랜드 스토리",
  website: "랜딩페이지",
  blog: "블로그",
  sns: "SNS 콘텐츠",
  share: "공유 활동",
  seo: "SEO·검색 성과",
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
          아래 값은 저장 즉시 서비스에 반영됩니다(최대 1분). 잘못 저장했다면
          &ldquo;기본값으로&rdquo;를 눌러 언제든 코드 기본값으로 되돌릴 수 있어요.
        </p>
        {settings.map((s) => (
          // 저장/리셋 후 서버 데이터로 다시 마운트되도록 json을 key에 포함
          <SettingEditor key={`${s.key}:${s.json}`} entry={s} />
        ))}
      </div>
    </section>
  );
}

function SettingEditor({ entry }: { entry: GrowthSettingEntry }) {
  switch (entry.key) {
    case "rules":
      return <RulesEditor entry={entry} />;
    case "levels":
      return <LevelsEditor entry={entry} />;
    case "missions":
      return <MissionsEditor entry={entry} />;
    case "weekly_quest":
      return <WeeklyQuestEditor entry={entry} />;
    case "score_weights":
      return <ScoreWeightsEditor entry={entry} />;
    case "surprise":
      return <SurpriseEditor entry={entry} />;
    default:
      return <JsonEditor entry={entry} />;
  }
}

/** 저장/기본값 버튼 + 상태 메시지를 공유하는 카드 틀. */
function SettingCard({
  entry,
  title,
  description,
  buildValue,
  validate,
  children,
}: {
  entry: GrowthSettingEntry;
  title: string;
  description?: string;
  /** 저장 시 JSON으로 직렬화할 현재 폼 값 */
  buildValue: () => unknown;
  /** 저장 전 검증 — 오류 문구를 돌려주면 저장 중단 */
  validate?: () => string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote({ text: res.error ?? res.message ?? "완료", error: !!res.error });
      if (!res.error) router.refresh();
    });

  const save = () => {
    const problem = validate?.();
    if (problem) {
      setNote({ text: problem, error: true });
      return;
    }
    run(() => saveRewardSettingAction(entry.key, JSON.stringify(buildValue())));
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">
          {title}
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
          <Button size="sm" disabled={saving} onClick={save}>
            {saving ? <Spinner className="size-4" /> : "저장"}
          </Button>
        </div>
      </div>
      {description && <p className="text-xs text-muted">{description}</p>}
      {children}
      {note && (
        <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
          {note.text}
        </p>
      )}
    </Card>
  );
}

/** 숫자 입력칸 — 빈 문자열을 허용해 입력 중 상태를 지원한다. */
function NumInput({
  value,
  onChange,
  className = "w-24",
  placeholder,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === "" ? "" : Number(e.target.value))
      }
      className={`tnum h-8 rounded-lg border border-border bg-surface px-2 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
    />
  );
}

function TextInput({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 min-w-0 rounded-lg border border-border bg-surface px-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
    />
  );
}

// ---------- rules ----------

interface RuleRow {
  key: string;
  up: number | "";
  xp: number | "";
  dailyCap: number | "";
}

function RulesEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [rows, setRows] = useState<RuleRow[]>(() => {
    const parsed = JSON.parse(entry.json) as Record<string, RewardRule>;
    return Object.entries(parsed).map(([key, r]) => ({
      key,
      up: r.up,
      xp: r.xp,
      dailyCap: r.dailyCap ?? "",
    }));
  });

  const set = (i: number, patch: Partial<RuleRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <SettingCard
      entry={entry}
      title="행동별 보상 (UP · XP · 일일 상한)"
      description="1 UP = ₩1 가치입니다. 일일 상한을 비워두면 무제한으로 지급됩니다."
      validate={() =>
        rows.some((r) => r.up === "" || r.xp === "")
          ? "UP/XP 값을 모두 입력해주세요."
          : rows.some((r) => Number(r.up) < 0 || Number(r.xp) < 0)
            ? "UP/XP는 0 이상이어야 합니다."
            : null
      }
      buildValue={() =>
        Object.fromEntries(
          rows.map((r) => [
            r.key,
            {
              up: Number(r.up),
              xp: Number(r.xp),
              ...(r.dailyCap === "" ? {} : { dailyCap: Number(r.dailyCap) }),
            },
          ]),
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1.5 pr-3 font-medium">행동</th>
              <th className="w-28 py-1.5 pr-3 font-medium">UP</th>
              <th className="w-28 py-1.5 pr-3 font-medium">XP</th>
              <th className="w-32 py-1.5 font-medium">일일 상한</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="py-1.5 pr-3">
                  {RULE_LABELS[r.key] ?? r.key}
                  <span className="ml-1.5 text-[11px] text-muted">{r.key}</span>
                </td>
                <td className="py-1.5 pr-3">
                  <NumInput value={r.up} onChange={(v) => set(i, { up: v })} />
                </td>
                <td className="py-1.5 pr-3">
                  <NumInput value={r.xp} onChange={(v) => set(i, { xp: v })} />
                </td>
                <td className="py-1.5">
                  <NumInput
                    value={r.dailyCap}
                    placeholder="무제한"
                    onChange={(v) => set(i, { dailyCap: v })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingCard>
  );
}

// ---------- levels ----------

function LevelsEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [rows, setRows] = useState<Array<{ name: string; xp: number | "" }>>(
    () => JSON.parse(entry.json) as LevelDef[],
  );

  const set = (i: number, patch: Partial<{ name: string; xp: number | "" }>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <SettingCard
      entry={entry}
      title="레벨 기준"
      description="누적 XP가 기준값 이상이면 해당 레벨이 됩니다. 첫 레벨은 XP 0부터 시작해야 합니다."
      validate={() => {
        if (rows.length === 0) return "레벨이 최소 1개 필요합니다.";
        if (rows.some((r) => !r.name.trim() || r.xp === ""))
          return "레벨 이름과 XP 기준을 모두 입력해주세요.";
        if (Number(rows[0].xp) !== 0) return "첫 레벨의 XP 기준은 0이어야 합니다.";
        for (let i = 1; i < rows.length; i++)
          if (Number(rows[i].xp) <= Number(rows[i - 1].xp))
            return "XP 기준은 위에서 아래로 커져야 합니다.";
        return null;
      }}
      buildValue={() =>
        rows.map((r) => ({ name: r.name.trim(), xp: Number(r.xp) }))
      }
    >
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 text-xs text-muted">Lv.{i + 1}</span>
            <TextInput
              value={r.name}
              onChange={(v) => set(i, { name: v })}
              className="flex-1"
              placeholder="레벨 이름"
            />
            <NumInput value={r.xp} onChange={(v) => set(i, { xp: v })} />
            <span className="text-xs text-muted">XP부터</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={rows.length <= 1}
              onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
            >
              삭제
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((p) => [
              ...p,
              { name: "", xp: p.length ? Number(p[p.length - 1].xp || 0) * 2 || 1000 : 0 },
            ])
          }
        >
          + 레벨 추가
        </Button>
      </div>
    </SettingCard>
  );
}

// ---------- missions ----------

function MissionsEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [rows, setRows] = useState<MissionDef[]>(
    () => JSON.parse(entry.json) as MissionDef[],
  );

  const set = (i: number, patch: Partial<MissionDef>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <SettingCard
      entry={entry}
      title="데일리 미션 풀"
      description="이 목록에서 사용자 상태에 맞춰 매일 3개가 자동 선택됩니다. 보상은 해당 행동의 기본 보상과 같습니다(이중 지급 없음)."
      validate={() =>
        rows.length < 3
          ? "미션 풀에는 최소 3개가 필요합니다."
          : rows.some((r) => !r.labelKo.trim() || !r.labelEn.trim())
            ? "미션 문구(한/영)를 모두 입력해주세요."
            : null
      }
      buildValue={() =>
        rows.map((r) => ({
          ...r,
          labelKo: r.labelKo.trim(),
          labelEn: r.labelEn.trim(),
        }))
      }
    >
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.code} className="flex flex-wrap items-center gap-2">
            <select
              value={r.action}
              onChange={(e) =>
                set(i, { action: e.target.value, rewardRule: e.target.value })
              }
              className="h-8 rounded-lg border border-border bg-surface px-2 text-sm"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <TextInput
              value={r.labelKo}
              onChange={(v) => set(i, { labelKo: v })}
              className="flex-1"
              placeholder="한글 문구"
            />
            <TextInput
              value={r.labelEn}
              onChange={(v) => set(i, { labelEn: v })}
              className="flex-1"
              placeholder="English label"
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={rows.length <= 3}
              onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
            >
              삭제
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((p) => [
              ...p,
              {
                code: `m_custom_${Date.now().toString(36)}`,
                action: "blog_created",
                rewardRule: "blog_created",
                labelKo: "",
                labelEn: "",
              },
            ])
          }
        >
          + 미션 추가
        </Button>
      </div>
    </SettingCard>
  );
}

// ---------- weekly quest ----------

function WeeklyQuestEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [rows, setRows] = useState<
    Array<Omit<QuestItemDef, "target"> & { target: number | "" }>
  >(() => JSON.parse(entry.json) as QuestItemDef[]);

  const set = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <SettingCard
      entry={entry}
      title="위클리 퀘스트"
      description="한 주(월~일) 동안 모든 항목을 달성하면 위클리 퀘스트 보상이 지급됩니다."
      validate={() =>
        rows.length === 0
          ? "퀘스트 항목이 최소 1개 필요합니다."
          : rows.some(
                (r) =>
                  !r.labelKo.trim() || !r.labelEn.trim() || r.target === "" ||
                  Number(r.target) < 1,
              )
            ? "문구와 목표 횟수(1 이상)를 모두 입력해주세요."
            : null
      }
      buildValue={() =>
        rows.map((r) => ({
          action: r.action,
          target: Number(r.target),
          labelKo: r.labelKo.trim(),
          labelEn: r.labelEn.trim(),
        }))
      }
    >
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={r.action}
              onChange={(e) => set(i, { action: e.target.value })}
              className="h-8 rounded-lg border border-border bg-surface px-2 text-sm"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <NumInput
              value={r.target}
              onChange={(v) => set(i, { target: v })}
              className="w-20"
            />
            <span className="text-xs text-muted">회</span>
            <TextInput
              value={r.labelKo}
              onChange={(v) => set(i, { labelKo: v })}
              className="flex-1"
              placeholder="한글 문구"
            />
            <TextInput
              value={r.labelEn}
              onChange={(v) => set(i, { labelEn: v })}
              className="flex-1"
              placeholder="English label"
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={rows.length <= 1}
              onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
            >
              삭제
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((p) => [
              ...p,
              { action: "blog_published", target: 1, labelKo: "", labelEn: "" },
            ])
          }
        >
          + 항목 추가
        </Button>
      </div>
    </SettingCard>
  );
}

// ---------- score weights ----------

function ScoreWeightsEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [weights, setWeights] = useState<Record<string, number | "">>(
    () => JSON.parse(entry.json) as Record<string, number>,
  );
  const sum = Object.values(weights).reduce<number>(
    (s, v) => s + (v === "" ? 0 : Number(v)),
    0,
  );

  return (
    <SettingCard
      entry={entry}
      title="Story Score 가중치"
      description="영역별 중요도입니다. 합계 기준으로 자동 정규화되지만, 합계 100을 권장합니다."
      validate={() =>
        Object.values(weights).some((v) => v === "" || Number(v) < 0)
          ? "가중치를 모두 0 이상으로 입력해주세요."
          : sum === 0
            ? "가중치 합계가 0이면 안 됩니다."
            : null
      }
      buildValue={() =>
        Object.fromEntries(
          Object.entries(weights).map(([k, v]) => [k, Number(v)]),
        )
      }
    >
      <div className="flex flex-wrap items-end gap-4">
        {Object.entries(weights).map(([k, v]) => (
          <label key={k} className="space-y-1">
            <span className="block text-xs text-muted">
              {SCORE_LABELS[k] ?? k}
            </span>
            <NumInput
              value={v}
              onChange={(nv) => setWeights((p) => ({ ...p, [k]: nv }))}
              className="w-20"
            />
          </label>
        ))}
        <p
          className={`tnum pb-1.5 text-sm font-medium ${
            sum === 100 ? "text-muted" : "text-warning"
          }`}
        >
          합계 {sum}
        </p>
      </div>
    </SettingCard>
  );
}

// ---------- surprise ----------

function SurpriseEditor({ entry }: { entry: GrowthSettingEntry }) {
  const parsed = JSON.parse(entry.json) as {
    enabled: boolean;
    chance: number;
    up: number;
    xp: number;
    dailyMax: number;
  };
  const [enabled, setEnabled] = useState(parsed.enabled);
  // 내부 저장은 0~1, 화면은 % 단위로 보여준다
  const [chancePct, setChancePct] = useState<number | "">(
    Math.round(parsed.chance * 1000) / 10,
  );
  const [up, setUp] = useState<number | "">(parsed.up);
  const [xp, setXp] = useState<number | "">(parsed.xp);
  const [dailyMax, setDailyMax] = useState<number | "">(parsed.dailyMax);

  return (
    <SettingCard
      entry={entry}
      title="서프라이즈 보너스"
      description="활동 1건마다 설정된 확률로 깜짝 보너스가 지급됩니다 (구매 불가, 무료 활동 대상)."
      validate={() =>
        chancePct === "" || up === "" || xp === "" || dailyMax === ""
          ? "모든 값을 입력해주세요."
          : Number(chancePct) < 0 || Number(chancePct) > 100
            ? "당첨 확률은 0~100% 사이여야 합니다."
            : null
      }
      buildValue={() => ({
        enabled,
        chance: Number(chancePct) / 100,
        up: Number(up),
        xp: Number(xp),
        dailyMax: Number(dailyMax),
      })}
    >
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          활성화
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">당첨 확률 (%)</span>
          <NumInput value={chancePct} onChange={setChancePct} className="w-20" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">지급 UP</span>
          <NumInput value={up} onChange={setUp} className="w-24" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">지급 XP</span>
          <NumInput value={xp} onChange={setXp} className="w-24" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">1인 하루 최대</span>
          <NumInput value={dailyMax} onChange={setDailyMax} className="w-20" />
        </label>
      </div>
    </SettingCard>
  );
}

// ---------- fallback: 알 수 없는 키는 기존 JSON 편집 ----------

function JsonEditor({ entry }: { entry: GrowthSettingEntry }) {
  const [json, setJson] = useState(entry.json);
  return (
    <SettingCard
      entry={entry}
      title={entry.key}
      validate={() => {
        try {
          JSON.parse(json);
          return null;
        } catch {
          return "JSON 형식이 올바르지 않습니다.";
        }
      }}
      buildValue={() => JSON.parse(json)}
    >
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={Math.min(14, json.split("\n").length + 1)}
        spellCheck={false}
        className="w-full rounded-xl border border-border bg-surface-muted/50 p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
      />
    </SettingCard>
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
