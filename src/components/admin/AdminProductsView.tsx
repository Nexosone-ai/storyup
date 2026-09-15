"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  type AdminProductInput,
} from "@/app/dashboard/admin/actions";

export interface AdminProductItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  detailImageUrl: string;
  active: boolean;
  sortOrder: number;
  grantsPlan: string;
  grantDays: number;
}

const EMPTY: AdminProductInput = {
  name: "",
  description: "",
  price: 0,
  imageUrl: "",
  detailImageUrl: "",
  active: true,
  sortOrder: 0,
  grantsPlan: "",
  grantDays: 30,
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------- 상품 폼 (생성/수정 공용) ----------------

function ProductForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: AdminProductInput;
  onSubmit: (input: AdminProductInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<AdminProductInput>(initial);
  const set = <K extends keyof AdminProductInput>(
    k: K,
    v: AdminProductInput[K],
  ) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-muted/50 p-4">
      <div>
        <Label htmlFor="p-name">상품명</Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="예: 브랜드 컨설팅 1회"
        />
      </div>
      <div>
        <Label htmlFor="p-desc">설명 (선택)</Label>
        <Textarea
          id="p-desc"
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="고객에게 보여줄 상품 설명"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex-1">
          <Label htmlFor="p-price">가격 (원)</Label>
          <Input
            id="p-price"
            type="number"
            min={1}
            value={form.price || ""}
            onChange={(e) => set("price", Number(e.target.value))}
            placeholder="50000"
          />
        </div>
        <div className="w-28">
          <Label htmlFor="p-sort">정렬</Label>
          <Input
            id="p-sort"
            type="number"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="p-img">카드 이미지 URL (선택)</Label>
        <Input
          id="p-img"
          value={form.imageUrl}
          onChange={(e) => set("imageUrl", e.target.value)}
          placeholder="https://… (스토어 카드 썸네일)"
        />
      </div>
      <div>
        <Label htmlFor="p-detail-img">상세 이미지 URL (선택)</Label>
        <Input
          id="p-detail-img"
          value={form.detailImageUrl}
          onChange={(e) => set("detailImageUrl", e.target.value)}
          placeholder="https://… (결제 페이지 하단 전체 폭 상세 이미지)"
        />
      </div>
      {/* 결제 시 자동 지급할 구독 플랜 — 결제 완료 후 구매자 계정(이메일 일치)에 자동 부여 */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex-1 min-w-[160px]">
          <Label htmlFor="p-plan">결제 시 자동 지급 플랜</Label>
          <Select
            id="p-plan"
            value={form.grantsPlan}
            onChange={(e) => set("grantsPlan", e.target.value)}
          >
            <option value="">지급 없음 (일반 상품)</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </Select>
        </div>
        {form.grantsPlan && (
          <div className="w-28">
            <Label htmlFor="p-days">지급 기간(일)</Label>
            <Input
              id="p-days"
              type="number"
              min={1}
              value={form.grantDays || ""}
              onChange={(e) => set("grantDays", Number(e.target.value))}
              placeholder="30"
            />
          </div>
        )}
        <p className="w-full text-xs text-muted">
          지급 플랜을 설정하면 결제 완료 시 구매자 이메일과 일치하는 계정에 해당 플랜이
          자동 부여됩니다. 계정이 없으면 주문 내역에 표시되고 관리자가 수동 지급합니다.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
        />
        판매 활성화 (끄면 결제 링크가 닫힘)
      </label>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button className="flex-1" onClick={() => onSubmit(form)} disabled={busy}>
          {busy ? <Spinner className="size-4" /> : "저장"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- 상품 목록 + 관리 ----------------

export function AdminProducts({
  products,
  siteUrl,
}: {
  products: AdminProductItem[];
  siteUrl: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null); // id | "new" | null
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const linkOf = (slug: string) => `${siteUrl}/pay/${slug}`;

  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(slug));
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1500);
    } catch {
      setNote("링크 복사에 실패했습니다. 주소를 직접 복사해주세요.");
    }
  };

  const submitNew = (input: AdminProductInput) =>
    start(async () => {
      setNote(null);
      const res = await createProductAction(input);
      setNote(res.error ?? res.message ?? null);
      if (!res.error) {
        setEditing(null);
        router.refresh();
      }
    });

  const submitEdit = (id: string, input: AdminProductInput) =>
    start(async () => {
      setNote(null);
      const res = await updateProductAction(id, input);
      setNote(res.error ?? res.message ?? null);
      if (!res.error) {
        setEditing(null);
        router.refresh();
      }
    });

  const remove = (id: string, name: string) => {
    if (!window.confirm(`'${name}' 상품을 삭제할까요? 결제 링크가 닫힙니다.`)) return;
    start(async () => {
      setNote(null);
      const res = await deleteProductAction(id);
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">결제 상품</h2>
        {editing !== "new" && (
          <Button size="sm" onClick={() => setEditing("new")} disabled={busy}>
            + 새 상품
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">
        상품을 등록하면 결제 링크가 생성됩니다. 링크를 고객에게 보내면 로그인 없이 바로 결제할 수 있어요.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}

      {editing === "new" && (
        <ProductForm
          initial={EMPTY}
          onSubmit={submitNew}
          onCancel={() => setEditing(null)}
          busy={busy}
        />
      )}

      {products.length === 0 && editing !== "new" ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          등록된 상품이 없습니다. “새 상품”으로 첫 상품을 등록해보세요.
        </p>
      ) : (
        <Card className="divide-y divide-border p-0">
          {products.map((p) =>
            editing === p.id ? (
              <div key={p.id} className="p-4">
                <ProductForm
                  initial={{
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    imageUrl: p.imageUrl,
                    detailImageUrl: p.detailImageUrl,
                    active: p.active,
                    sortOrder: p.sortOrder,
                    grantsPlan: p.grantsPlan,
                    grantDays: p.grantDays,
                  }}
                  onSubmit={(input) => submitEdit(p.id, input)}
                  onCancel={() => setEditing(null)}
                  busy={busy}
                />
              </div>
            ) : (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <Badge tone={p.active ? "success" : "muted"}>
                      {p.active ? "판매중" : "중지"}
                    </Badge>
                  </div>
                  <p className="tnum text-sm text-muted">
                    ₩{p.price.toLocaleString()}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted">
                    {linkOf(p.slug)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => copy(p.slug)}>
                    {copied === p.slug ? "복사됨 ✓" : "링크 복사"}
                  </Button>
                  <a
                    href={linkOf(p.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-surface-muted"
                  >
                    열기
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNote(null);
                      setEditing(p.id);
                    }}
                    disabled={busy}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(p.id, p.name)}
                    disabled={busy}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ),
          )}
        </Card>
      )}
    </section>
  );
}

// ---------------- 상품 주문 내역 ----------------

const ORDER_STATUS: Record<
  string,
  { label: string; tone: "success" | "muted" | "warning" | "danger" }
> = {
  PENDING: { label: "진행 중", tone: "warning" },
  PAID: { label: "결제 완료", tone: "success" },
  FAILED: { label: "실패", tone: "muted" },
  CANCELLED: { label: "취소됨", tone: "danger" },
  PARTIALLY_CANCELLED: { label: "부분 취소", tone: "danger" },
  REFUNDED: { label: "환불됨", tone: "danger" },
};

export interface AdminProductOrderItem {
  id: string;
  created_at: string;
  productName: string;
  buyerName: string;
  buyerContact: string;
  amount: number;
  method: string;
  status: string;
}

export function AdminProductOrders({
  orders,
}: {
  orders: AdminProductOrderItem[];
}) {
  const [status, setStatus] = useState("ALL");
  const filtered =
    status === "ALL" ? orders : orders.filter((o) => o.status === status);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">상품 주문 내역</h2>
      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          주문 내역이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">일시</th>
                <th className="p-3">상품</th>
                <th className="p-3">구매자</th>
                <th className="p-3 text-right">금액</th>
                <th className="p-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap">
                    {fmtDateTime(o.created_at)}
                  </td>
                  <td className="p-3">{o.productName}</td>
                  <td className="p-3">
                    <p className="font-medium">{o.buyerName || "-"}</p>
                    <p className="text-xs text-muted">{o.buyerContact}</p>
                  </td>
                  <td className="tnum p-3 text-right">
                    ₩{o.amount.toLocaleString()}
                  </td>
                  <td className="p-3">
                    <Badge tone={ORDER_STATUS[o.status]?.tone ?? "muted"}>
                      {ORDER_STATUS[o.status]?.label ?? o.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* 상태 필터는 목록 하단에 간단히 */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>필터:</span>
        {["ALL", "PAID", "PENDING", "FAILED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-2.5 py-1 transition ${
              status === s
                ? "bg-foreground text-background"
                : "bg-surface-muted hover:bg-border"
            }`}
          >
            {s === "ALL" ? "전체" : ORDER_STATUS[s]?.label ?? s}
          </button>
        ))}
      </div>
    </section>
  );
}
