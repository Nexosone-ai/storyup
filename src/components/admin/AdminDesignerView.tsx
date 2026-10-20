"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import type { PendingEarningRow } from "@/lib/marketplace/sales";
import {
  grantDesignerAction,
  revokeDesignerAction,
  reviewTemplateVersionAction,
  publishTemplateAction,
  pauseListingAction,
  markDesignerEarningPaidAction,
  addSkillCatalogAction,
  toggleSkillCatalogAction,
  removeSkillCatalogAction,
} from "@/app/dashboard/admin/designer/actions";

export interface DesignerRow {
  userId: string;
  email: string | null;
  createdAt: string;
}
export interface ReviewRow {
  versionId: string;
  version: number;
  status: string;
  createdAt: string;
  templateTitle: string;
  ownerEmail: string | null;
}
export interface ListingRow {
  id: string;
  versionId: string;
  title: string;
  priceKrw: number;
  commissionPct: number;
  status: string;
  sales: number;
}
export interface CatalogRow {
  id: string;
  repoUrl: string;
  title: string;
  description: string | null;
  tag: string | null;
  active: boolean;
}

const won = (n: number) => `₩${n.toLocaleString()}`;

export function AdminDesignerView({
  designers,
  reviews,
  listings,
  earnings,
  catalog,
}: {
  designers: DesignerRow[];
  reviews: ReviewRow[];
  listings: ListingRow[];
  earnings: PendingEarningRow[];
  catalog: CatalogRow[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  // 추천 스킬 입력.
  const [cUrl, setCUrl] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cTag, setCTag] = useState("");

  // 발행 폼 상태(버전별).
  const [pubFor, setPubFor] = useState<string | null>(null);
  const [price, setPrice] = useState("29000");
  const [commission, setCommission] = useState("30");
  const [summary, setSummary] = useState("");

  const run = (fn: () => Promise<{ error?: string; message?: string }>) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? res.message ?? "처리됐어요.");
      if (!res.error) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">디자이너 마켓</p>
        <h2 className="text-xl font-semibold">템플릿 심사·발행·정산</h2>
        <p className="mt-1 text-sm text-muted">
          디자이너 권한 부여, 제출된 템플릿 심사·발행(가격 책정), 판매·정산을 관리해요.
        </p>
      </div>
      {msg && <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">{msg}</p>}

      {/* 디자이너 권한 */}
      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">디자이너 권한</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Label htmlFor="de">이메일로 부여</Label>
            <Input
              id="de"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="designer@example.com"
            />
          </div>
          <Button
            disabled={busy || !email.trim()}
            onClick={() => run(() => grantDesignerAction(email).then((r) => (setEmail(""), r)))}
          >
            {busy ? <Spinner className="size-4" /> : "권한 부여"}
          </Button>
        </div>
        {designers.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {designers.map((d) => (
              <li key={d.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{d.email ?? d.userId}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => revokeDesignerAction(d.userId))}
                  className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-danger"
                >
                  해제
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">아직 디자이너가 없어요.</p>
        )}
      </Card>

      {/* 심사·발행 */}
      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">심사 대기·승인</h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">심사할 템플릿이 없어요.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.versionId} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.templateTitle}</p>
                    <p className="truncate text-xs text-muted">
                      v{r.version} · {r.ownerEmail ?? "소유자 불명"} ·{" "}
                      {r.status === "submitted" ? "심사 요청" : "승인됨"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {r.status === "submitted" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => run(() => reviewTemplateVersionAction(r.versionId, "approve"))}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => run(() => reviewTemplateVersionAction(r.versionId, "reject"))}
                        >
                          반려
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setPubFor(pubFor === r.versionId ? null : r.versionId);
                        setMsg(null);
                      }}
                    >
                      발행·판매
                    </Button>
                  </div>
                </div>

                {pubFor === r.versionId && (
                  <div className="mt-3 space-y-2 rounded-lg bg-surface p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`p-${r.versionId}`}>가격(원)</Label>
                        <Input
                          id={`p-${r.versionId}`}
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`c-${r.versionId}`}>플랫폼 수수료(%)</Label>
                        <Input
                          id={`c-${r.versionId}`}
                          type="number"
                          value={commission}
                          onChange={(e) => setCommission(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`s-${r.versionId}`}>판매 소개(선택)</Label>
                      <Input
                        id={`s-${r.versionId}`}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="한 줄 소개"
                      />
                    </div>
                    <p className="text-xs text-muted">
                      발행하면 결제 링크(/pay/…)가 생기고, 구매 시 디자이너에게 순수익(가격 −
                      수수료)이 적립돼요.
                    </p>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          publishTemplateAction({
                            versionId: r.versionId,
                            title: r.templateTitle,
                            summary,
                            priceKrw: Math.trunc(Number(price) || 0),
                            commissionPct: Math.trunc(Number(commission) || 0),
                          }).then((res) => (res.ok ? (setPubFor(null), res) : res)),
                        )
                      }
                    >
                      {busy ? <Spinner className="size-4" /> : "발행하고 판매 시작"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 판매중 리스팅 */}
      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">판매 중</h3>
        {listings.length === 0 ? (
          <p className="text-sm text-muted">판매 중인 템플릿이 없어요.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.title}</p>
                  <p className="text-xs text-muted">
                    {won(l.priceKrw)} · 수수료 {l.commissionPct}% · 판매 {l.sales}건 ·{" "}
                    {l.status === "active" ? "판매중" : "중지"}
                  </p>
                </div>
                {l.status === "active" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => pauseListingAction(l.id))}
                    className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-danger"
                  >
                    판매 중지
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 디자이너 정산 */}
      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">정산(미지급)</h3>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted">지급할 정산이 없어요.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {earnings.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.designerEmail ?? "디자이너"}</p>
                  <p className="text-xs text-muted">
                    {e.listingTitle} · 판매 {won(e.grossKrw)} − {e.commissionPct}% ={" "}
                    <strong className="text-foreground">{won(e.netKrw)}</strong>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => markDesignerEarningPaidAction(e.id))}
                >
                  지급 완료
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 추천 스킬 카탈로그 */}
      <Card className="space-y-3 p-4">
        <div>
          <h3 className="font-semibold">추천 스킬 카탈로그</h3>
          <p className="mt-1 text-xs text-muted">
            공개 GitHub 스킬을 등록하면, 파트너가 Skill 보관함에서 원클릭으로 가져올 수 있어요(실행 아님, 지침 참고용).
          </p>
        </div>
        <div className="space-y-2 rounded-lg bg-surface p-3">
          <div>
            <Label htmlFor="c-url">GitHub URL</Label>
            <Input
              id="c-url"
              type="url"
              value={cUrl}
              onChange={(e) => setCUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-title">제목</Label>
              <Input id="c-title" value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-tag">분류(선택)</Label>
              <Input id="c-tag" value={cTag} onChange={(e) => setCTag(e.target.value)} placeholder="예: 영상, 디자인" />
            </div>
          </div>
          <div>
            <Label htmlFor="c-desc">소개(선택)</Label>
            <Input id="c-desc" value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={busy || !cUrl.trim() || !cTitle.trim()}
            onClick={() =>
              run(() =>
                addSkillCatalogAction({
                  repoUrl: cUrl,
                  title: cTitle,
                  description: cDesc,
                  tag: cTag,
                  sortOrder: 0,
                }).then((r) => {
                  if (r.ok) {
                    setCUrl("");
                    setCTitle("");
                    setCDesc("");
                    setCTag("");
                  }
                  return r;
                }),
              )
            }
          >
            {busy ? <Spinner className="size-4" /> : "추천 스킬 추가"}
          </Button>
        </div>
        {catalog.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {catalog.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {c.title}
                    {c.tag && <span className="ml-2 text-xs text-muted">· {c.tag}</span>}
                    {!c.active && <span className="ml-2 text-xs text-muted">(숨김)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{c.repoUrl}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => toggleSkillCatalogAction(c.id, !c.active))}
                    className="text-xs text-muted underline underline-offset-2 hover:text-primary"
                  >
                    {c.active ? "숨기기" : "노출"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => removeSkillCatalogAction(c.id))}
                    className="text-xs text-muted underline underline-offset-2 hover:text-danger"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">아직 등록한 추천 스킬이 없어요.</p>
        )}
      </Card>
    </div>
  );
}
