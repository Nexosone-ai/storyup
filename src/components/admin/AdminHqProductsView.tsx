"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, Select } from "@/components/ui/Field";
import {
  saveHqProductAction,
  setHqProductStatusAction,
} from "@/app/dashboard/admin/hq-products/actions";
import {
  ENTITLEMENT_SERVICES,
  describeFulfillment,
  type EntitlementItem,
  type EntitlementKey,
  type GrantablePlan,
} from "@/lib/partner/entitlementCatalog";
import type { HqProduct } from "@/lib/hq/products";

const won = (n: number) => `₩${n.toLocaleString()}`;

const STATUS_LABEL: Record<HqProduct["status"], string> = {
  active: "판매중",
  draft: "초안",
  archived: "보관",
};

const PLAN_LABEL: Record<GrantablePlan, string> = {
  basic: "Basic",
  pro: "Pro",
  lite: "Lite",
};

/** 포함 내역 텍스트 → 불릿. */
function bullets(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 관리자 '본사 상품' — 파트너가 마진을 붙여 파는 본사 상품(hq_products)을 등록·수정한다.
 * 상품 = 공급가 + 결제 시 고객 플랜(선택) + 파트너 작업권(선택). 삭제 대신 보관.
 */
export function AdminHqProductsView({
  enabled,
  products,
}: {
  enabled: boolean;
  products: HqProduct[];
}) {
  const [editing, setEditing] = useState<HqProduct | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const live = products.filter((p) => p.status !== "archived");
  const archived = products.filter((p) => p.status === "archived");
  // 판매중 → 초안 순.
  live.sort(
    (a, b) =>
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
      a.sortOrder - b.sortOrder,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">본사 상품</h2>
        <p className="mt-1 text-sm text-muted">
          파트너·서브파트너가 자기 마진을 붙여 고객에게 판매하는 본사 상품입니다. 공급가는
          정산 때 본사가 공제하는 금액이며 파트너 화면에는 보이지 않습니다. 고객이 결제하면
          아래 &lsquo;결제 시 제공&rsquo;이 자동 지급됩니다(고객 플랜·파트너 작업권).
          &lsquo;판매중&rsquo; 상품만 파트너 상품 등록 화면에 나타나고, 변경 내용은 이후
          저장되는 파트너 상품부터 적용됩니다(이미 저장된 파트너 상품·청구서는 그대로).
          {!enabled && (
            <span className="ml-1 text-danger">
              (B2B2C 기능 플래그 꺼짐 — 파트너 판매가 비활성이라 작업권은 관리자 직접 부여로만
              생깁니다)
            </span>
          )}
        </p>
      </div>

      {editing ? (
        <HqProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button onClick={() => setEditing("new")}>+ 새 본사 상품</Button>
      )}

      <div className="space-y-3">
        {live.length === 0 && (
          <p className="text-sm text-muted">등록된 본사 상품이 없습니다.</p>
        )}
        {live.map((p) => (
          <HqProductCard key={p.id} product={p} onEdit={() => setEditing(p)} />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            {showArchived ? "▾" : "▸"} 보관된 상품 {archived.length}개
          </button>
          {showArchived &&
            archived.map((p) => (
              <HqProductCard key={p.id} product={p} onEdit={() => setEditing(p)} />
            ))}
        </div>
      )}
    </div>
  );
}

function HqProductCard({
  product: p,
  onEdit,
}: {
  product: HqProduct;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const fulfill = describeFulfillment(
    p.items,
    p.grantPlan ? { plan: p.grantPlan, days: p.grantDays } : null,
    "partner",
  );

  const setStatus = (status: HqProduct["status"]) =>
    start(async () => {
      setMsg(null);
      if (
        status === "archived" &&
        !window.confirm(
          `'${p.name}'을(를) 보관할까요?\n\n파트너 상품 등록 화면에서 사라집니다. 이미 연결된 파트너 상품·발행된 청구서는 그대로 유지됩니다.`,
        )
      )
        return;
      const res = await setHqProductStatusAction(p.id, status);
      if (res.error) setMsg(res.error);
      else router.refresh();
    });

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{p.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            공급가 {won(p.supplyPriceKrw)} (부가세{" "}
            {p.vatMode === "included" ? "포함" : "별도"}) ·{" "}
            {p.billingType === "recurring" ? "월 정기" : "1회"}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{p.key}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            p.status === "active"
              ? "bg-success/15 text-success"
              : "bg-surface-2 text-muted"
          }`}
        >
          {STATUS_LABEL[p.status]}
        </span>
      </div>
      {fulfill.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted">
          {fulfill.map((f) => (
            <li key={f} className="flex gap-1.5">
              <span className="text-primary">·</span>
              <span>결제 시 제공 — {f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-warning">
          결제 시 제공 항목이 없습니다(플랜·작업권 모두 없음).
        </p>
      )}
      {msg && <p className="text-sm text-danger">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
          편집
        </Button>
        {p.status !== "active" && (
          <Button size="sm" onClick={() => setStatus("active")} disabled={busy}>
            판매 시작
          </Button>
        )}
        {p.status === "active" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus("draft")}
            disabled={busy}
          >
            판매 중지
          </Button>
        )}
        {p.status !== "archived" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatus("archived")}
            disabled={busy}
          >
            보관
          </Button>
        )}
      </div>
    </Card>
  );
}

type ItemRow = { serviceKey: EntitlementKey | ""; units: string };

function HqProductForm({
  product,
  onDone,
}: {
  product: HqProduct | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [included, setIncluded] = useState(product?.includedServices ?? "");
  const [price, setPrice] = useState(product ? String(product.supplyPriceKrw) : "");
  const [vatMode, setVatMode] = useState<"included" | "excluded">(
    product?.vatMode ?? "excluded",
  );
  const [billingType, setBillingType] = useState<"one_time" | "recurring">(
    product?.billingType ?? "one_time",
  );
  const [grantPlan, setGrantPlan] = useState<GrantablePlan | "">(
    product?.grantPlan ?? "",
  );
  const [grantDays, setGrantDays] = useState(String(product?.grantDays ?? 30));
  const [items, setItems] = useState<ItemRow[]>(
    product?.items.map((it) => ({ serviceKey: it.serviceKey, units: String(it.units) })) ??
      [],
  );
  const [status, setStatus] = useState<HqProduct["status"]>(product?.status ?? "draft");
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 100));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const usedKeys = new Set(items.map((i) => i.serviceKey).filter(Boolean));
  const validItems: EntitlementItem[] = items
    .filter((i) => i.serviceKey && Number(i.units) >= 1)
    .map((i) => ({
      serviceKey: i.serviceKey as EntitlementKey,
      units: Math.floor(Number(i.units)),
    }));
  const days = Math.floor(Number(grantDays) || 0);
  const preview = describeFulfillment(
    validItems,
    grantPlan ? { plan: grantPlan, days: days || 30 } : null,
    "partner",
  );

  const setItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const save = () =>
    start(async () => {
      setMsg(null);
      if (!name.trim()) return setMsg("상품명을 입력해주세요.");
      const supply = Number(price);
      if (!Number.isFinite(supply) || supply < 0 || price.trim() === "")
        return setMsg("공급가를 0 이상 숫자로 입력해주세요.");
      if (items.some((i) => !i.serviceKey || !(Number(i.units) >= 1)))
        return setMsg("작업권 행마다 서비스와 1 이상의 수량을 입력해주세요(빈 행은 삭제).");
      if (grantPlan && (days < 1 || days > 365))
        return setMsg("플랜 기간은 1~365일이어야 해요.");
      if (status === "active" && !grantPlan && validItems.length === 0)
        return setMsg("판매중으로 저장하려면 결제 시 제공(플랜 또는 작업권)이 하나 이상 있어야 해요.");
      const res = await saveHqProductAction({
        id: product?.id,
        name,
        description: description || null,
        includedServices: included || null,
        supplyPriceKrw: Math.floor(supply),
        vatMode,
        billingType,
        grantPlan: grantPlan || null,
        grantDays: days || 30,
        items: validItems,
        status,
        sortOrder: Math.floor(Number(sortOrder) || 100),
      });
      if (res.error) setMsg(res.error);
      else {
        onDone();
        router.refresh();
      }
    });

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{product ? "본사 상품 편집" : "새 본사 상품"}</h3>
        {product && (
          <span className="font-mono text-[11px] text-muted">{product.key}</span>
        )}
      </div>

      <div>
        <Label required>상품명 (파트너·고객 노출)</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 블로그 요약 쇼츠 3편"
        />
      </div>
      <div>
        <Label>한 줄 요약</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 발행 글을 30초 내레이션 쇼츠로"
        />
      </div>
      <div>
        <Label>포함 내역 (한 줄에 하나씩, 파트너 화면 불릿)</Label>
        <Textarea
          rows={5}
          value={included}
          onChange={(e) => setIncluded(e.target.value)}
          placeholder={"블로그 요약 쇼츠 3편\n자막·내레이션 포함\n…"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label required>공급가(원)</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <Label>부가세</Label>
          <Select
            value={vatMode}
            onChange={(e) => setVatMode(e.target.value as "included" | "excluded")}
          >
            <option value="excluded">별도</option>
            <option value="included">포함</option>
          </Select>
        </div>
        <div>
          <Label>청구 방식</Label>
          <Select
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as "one_time" | "recurring")}
          >
            <option value="one_time">1회</option>
            <option value="recurring">월 정기</option>
          </Select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">
        공급가는 파트너 정산 때 본사가 공제하는 금액이며, 파트너·서브파트너 화면에는 보이지 않습니다.
      </p>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold">결제 시 제공</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>고객 플랜 지급</Label>
            <Select
              value={grantPlan}
              onChange={(e) => setGrantPlan(e.target.value as GrantablePlan | "")}
            >
              <option value="">없음</option>
              {(["basic", "pro", "lite"] as const).map((pl) => (
                <option key={pl} value={pl}>
                  {PLAN_LABEL[pl]}
                </option>
              ))}
            </Select>
          </div>
          {grantPlan && (
            <div>
              <Label>플랜 기간(일)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={grantDays}
                onChange={(e) => setGrantDays(e.target.value)}
              />
            </div>
          )}
        </div>
        <p className="text-xs text-muted">
          고객이 이미 더 높은 플랜을 쓰고 있으면 플랜은 낮추지 않고 그대로 둡니다. 같은 플랜이면 기간이
          연장됩니다.
        </p>

        <div className="space-y-2">
          <Label>파트너 작업권 (판매한 파트너에게 지급)</Label>
          {items.length === 0 && (
            <p className="text-xs text-muted">작업권 없음 — 아래 버튼으로 추가하세요.</p>
          )}
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={it.serviceKey}
                onChange={(e) =>
                  setItem(idx, { serviceKey: e.target.value as EntitlementKey | "" })
                }
                className="flex-1"
              >
                <option value="">서비스 선택</option>
                {ENTITLEMENT_SERVICES.map((s) => (
                  <option
                    key={s.key}
                    value={s.key}
                    disabled={s.key !== it.serviceKey && usedKeys.has(s.key)}
                  >
                    {s.label} ({s.unitLabel})
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={it.units}
                onChange={(e) => setItem(idx, { units: e.target.value })}
                className="w-24"
                aria-label="수량"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}
              >
                삭제
              </Button>
            </div>
          ))}
          {items.length < ENTITLEMENT_SERVICES.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((arr) => [...arr, { serviceKey: "", units: "1" }])}
            >
              + 작업권 추가
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>상태</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as HqProduct["status"])}
          >
            <option value="draft">초안 (파트너 비노출)</option>
            <option value="active">판매중</option>
            <option value="archived">보관</option>
          </Select>
        </div>
        <div>
          <Label>정렬 순서 (작을수록 위)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
      </div>

      {/* 파트너 화면 미리보기 — 공급가 없이 보이는 그대로. */}
      <div className="rounded-xl bg-surface-2 p-4">
        <p className="eyebrow mb-2">파트너 화면 미리보기</p>
        <p className="font-semibold">{name || "상품명"}</p>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
        {bullets(included).length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            {bullets(included).map((b, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-primary">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {preview.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <p className="text-xs font-medium">결제 시 제공</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {preview.map((f) => (
                <li key={f} className="flex gap-1.5">
                  <span className="text-primary">·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-danger">{msg}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          취소
        </Button>
      </div>
    </Card>
  );
}
