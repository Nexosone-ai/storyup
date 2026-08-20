"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/utils/cn";
import { WEBSITE_TEMPLATES, PLATFORM_FEE_PERCENT } from "@/types/domain";
import type { StoreTemplate, MyTemplate, PurchaseRow } from "@/lib/templates";
import {
  createTemplate,
  setTemplateActive,
  deleteTemplate,
  buyTemplate,
} from "@/app/dashboard/templates/actions";

const KEY_LABEL: Record<string, string> = {
  classic: "클래식",
  split: "스플릿",
  minimal: "미니멀",
};

type Tab = "store" | "mine" | "purchases";

export function TemplatesView({
  store,
  mine,
  purchases,
}: {
  store: StoreTemplate[];
  mine: MyTemplate[];
  purchases: PurchaseRow[];
}) {
  const [tab, setTab] = useState<Tab>("store");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow mb-2">프리미엄 템플릿</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          템플릿 스토어
        </h1>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["store", "스토어"],
            ["mine", "내 템플릿"],
            ["purchases", "구매 내역"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary-soft text-primary"
                : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "store" && <Store store={store} />}
      {tab === "mine" && <Mine mine={mine} />}
      {tab === "purchases" && <Purchases purchases={purchases} />}
    </div>
  );
}

function Store({ store }: { store: StoreTemplate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const buy = (id: string) =>
    start(async () => {
      setError(null);
      const res = await buyTemplate(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  if (store.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
        아직 판매 중인 템플릿이 없습니다.
      </p>
    );

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {store.map((t) => (
          <Card key={t.id} className="flex flex-col overflow-hidden !p-0">
            <div className="aspect-[16/10] w-full border-b border-border bg-primary-soft">
              {t.preview_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.preview_image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{t.title}</h3>
                <Badge tone="muted">{KEY_LABEL[t.template_key] ?? t.template_key}</Badge>
              </div>
              {t.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {t.description}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">by {t.creator_name}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="tnum font-semibold">
                  {t.price_points.toLocaleString()} P
                </span>
                {t.mine ? (
                  <Badge tone="primary">내 템플릿</Badge>
                ) : t.purchased ? (
                  <Badge tone="success">구매완료</Badge>
                ) : (
                  <Button size="sm" onClick={() => buy(t.id)} disabled={pending}>
                    {pending ? <Spinner className="size-4" /> : "구매하기"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Mine({ mine }: { mine: MyTemplate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [key, setKey] = useState("classic");
  const [preview, setPreview] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createTemplate({
        title,
        description: desc,
        templateKey: key,
        previewImage: preview,
        pricePoints: Number(price || 0),
      });
      if (res.error) setError(res.error);
      else {
        setTitle("");
        setDesc("");
        setPreview("");
        setPrice("");
        router.refresh();
      }
    });

  const toggle = (id: string, active: boolean) =>
    start(async () => {
      await setTemplateActive(id, active);
      router.refresh();
    });
  const remove = (id: string) =>
    start(async () => {
      if (!confirm("삭제할까요?")) return;
      await deleteTemplate(id);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">템플릿 등록</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="템플릿 이름" />
        <Textarea
          className="min-h-16"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="설명"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="t-key">기본 레이아웃</Label>
            <Select id="t-key" value={key} onChange={(e) => setKey(e.target.value)}>
              {WEBSITE_TEMPLATES.map((k) => (
                <option key={k} value={k}>
                  {KEY_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="t-price">가격 (P)</Label>
            <Input
              id="t-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="t-prev">미리보기 이미지 URL</Label>
            <Input
              id="t-prev"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          판매 시 플랫폼 수수료 {PLATFORM_FEE_PERCENT}%를 제외한 금액이 적립됩니다.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button size="sm" onClick={create} disabled={pending}>
          {pending ? <Spinner className="size-4" /> : "등록"}
        </Button>
      </Card>

      {mine.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {mine.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{t.title}</p>
                  {!t.active && <Badge tone="muted">숨김</Badge>}
                </div>
                <p className="tnum mt-0.5 text-xs text-muted">
                  {t.price_points.toLocaleString()}P · 판매 {t.salesCount}건 · 적립{" "}
                  {t.earned.toLocaleString()}P
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggle(t.id, !t.active)}
                  disabled={pending}
                >
                  {t.active ? "숨기기" : "게시"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(t.id)}
                  disabled={pending}
                >
                  삭제
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Purchases({ purchases }: { purchases: PurchaseRow[] }) {
  if (purchases.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
        구매한 템플릿이 없습니다.
      </p>
    );
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {purchases.map((p) => (
        <li key={p.id} className="flex items-center justify-between p-4">
          <p className="font-medium">{p.title}</p>
          <span className="tnum text-sm text-muted">
            {p.price_points.toLocaleString()} P
          </span>
        </li>
      ))}
    </ul>
  );
}
