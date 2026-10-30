"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";
import {
  saveStorefrontAction,
  saveProductAction,
  setProductStatusAction,
  createOfferAction,
  voidOfferAction,
  issueInvoiceAction,
  voidInvoiceAction,
} from "@/app/partner/sales/actions";

const won = (n: number) => `₩${n.toLocaleString()}`;

interface Storefront {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  intro: string | null;
  contact: string | null;
  sellerInfo: string | null;
  status: string;
}
interface Product {
  id: string;
  name: string;
  description: string | null;
  includedServices: string | null;
  basePlan: string | null;
  basePriceKrw: number;
  sellPriceKrw: number;
  vatMode: string;
  billingType: string;
  billingPeriod: string | null;
  validFrom: string | null;
  validUntil: string | null;
  scope: string | null;
  terms: string | null;
  status: string;
}
interface ClientOpt {
  clientUserId: string;
  label: string;
}
interface Offer {
  id: string;
  token: string;
  name: string;
  sellPriceKrw: number;
  basePriceKrw: number;
  status: string;
  createdAt: string;
}
interface Invoice {
  id: string;
  token: string;
  number: string;
  sellPriceKrw: number;
  basePriceKrw: number;
  status: string;
  createdAt: string;
}
interface Settlement {
  gross: number;
  baseDeduction: number;
  pending: number;
  held: number;
  paid: number;
}

type Tab = "store" | "products" | "offers" | "invoices" | "settlement";

export function PartnerSalesView(props: {
  storefront: Storefront | null;
  basePrices: { basic: number; pro: number };
  products: Product[];
  clients: ClientOpt[];
  offers: Offer[];
  invoices: Invoice[];
  settlement: Settlement;
}) {
  const [tab, setTab] = useState<Tab>("store");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const TABS: { id: Tab; label: string }[] = [
    { id: "store", label: "스토어" },
    { id: "products", label: "상품" },
    { id: "offers", label: "오퍼" },
    { id: "invoices", label: "청구서" },
    { id: "settlement", label: "정산" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">파트너 판매</p>
        <h1 className="text-2xl font-semibold tracking-tight">상품 · 판매 관리</h1>
        <p className="mt-1.5 text-muted">
          기존 요금제 위에 내 판매가를 붙여 상품을 만들고, 고객에게 오퍼·청구서를
          제시합니다. 수납은 STORYUP이 하고 차액은 정산됩니다.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "store" && (
        <StoreTab storefront={props.storefront} origin={origin} />
      )}
      {tab === "products" && (
        <ProductsTab products={props.products} basePrices={props.basePrices} />
      )}
      {tab === "offers" && (
        <OffersTab
          products={props.products}
          clients={props.clients}
          offers={props.offers}
          origin={origin}
        />
      )}
      {tab === "invoices" && (
        <InvoicesTab
          offers={props.offers}
          invoices={props.invoices}
          storefront={props.storefront}
          origin={origin}
        />
      )}
      {tab === "settlement" && <SettlementTab settlement={props.settlement} />}
    </div>
  );
}

// ---------------- 스토어 ----------------
function StoreTab({
  storefront,
  origin,
}: {
  storefront: Storefront | null;
  origin: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(storefront?.displayName ?? "");
  const [slug, setSlug] = useState(storefront?.slug ?? "");
  const [logoUrl, setLogoUrl] = useState(storefront?.logoUrl ?? "");
  const [intro, setIntro] = useState(storefront?.intro ?? "");
  const [contact, setContact] = useState(storefront?.contact ?? "");
  const [sellerInfo, setSellerInfo] = useState(storefront?.sellerInfo ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveStorefrontAction({
        displayName,
        slug: slug || undefined,
        logoUrl: logoUrl || null,
        intro: intro || null,
        contact: contact || null,
        sellerInfo: sellerInfo || null,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg("저장되었습니다.");
        if (res.slug) setSlug(res.slug);
        router.refresh();
      }
    });

  return (
    <Card className="space-y-4 p-6">
      <div>
        <Label htmlFor="sf-name" required>
          스토어 이름
        </Label>
        <Input
          id="sf-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="예: 노바 마케팅"
        />
      </div>
      <div>
        <Label htmlFor="sf-slug">공개 주소(slug)</Label>
        <Input
          id="sf-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="nova"
        />
        {slug && (
          <p className="mt-1 text-xs text-muted">
            {origin}/partners/{slug}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="sf-logo">로고 이미지 URL</Label>
        <Input
          id="sf-logo"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div>
        <Label htmlFor="sf-intro">소개</Label>
        <Textarea
          id="sf-intro"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="브랜드·서비스 소개"
        />
      </div>
      <div>
        <Label htmlFor="sf-contact">연락처</Label>
        <Input
          id="sf-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="이메일 · 전화 · 카카오"
        />
      </div>
      <div>
        <Label htmlFor="sf-seller">판매자 표기(선택)</Label>
        <Textarea
          id="sf-seller"
          value={sellerInfo}
          onChange={(e) => setSellerInfo(e.target.value)}
          placeholder="사업자명·대표·주소 등 (수납 주체는 STORYUP)"
        />
      </div>
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <Button onClick={save} disabled={busy}>
        {busy ? "저장 중…" : "스토어 저장"}
      </Button>
    </Card>
  );
}

// ---------------- 상품 ----------------
function ProductsTab({
  products,
  basePrices,
}: {
  products: Product[];
  basePrices: { basic: number; pro: number };
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {!creating && !editing && (
        <Button onClick={() => setCreating(true)}>+ 새 상품</Button>
      )}
      {(creating || editing) && (
        <ProductForm
          product={editing}
          basePrices={basePrices}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <div className="space-y-3">
        {products.length === 0 && !creating && (
          <p className="text-sm text-muted">아직 상품이 없습니다.</p>
        )}
        {products.map((p) => {
          const delta = p.sellPriceKrw - p.basePriceKrw;
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    판매가 {won(p.sellPriceKrw)}
                    {p.basePlan && (
                      <>
                        {" · "}기본요금 {won(p.basePriceKrw)}
                      </>
                    )}
                  </p>
                  {p.basePlan && (
                    <p
                      className={`mt-0.5 text-xs ${delta < 0 ? "text-danger" : "text-muted"}`}
                    >
                      예상 차액 {won(delta)}{" "}
                      {delta < 0 ? "(기본요금보다 낮음 ⚠)" : "(세금·수수료 제외 전)"}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.status === "active"
                      ? "bg-success/15 text-success"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {p.status === "active"
                    ? "판매중"
                    : p.status === "draft"
                      ? "초안"
                      : "보관"}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(p)}>
                  편집
                </Button>
                <StatusToggle id={p.id} status={p.status} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const next = status === "active" ? "draft" : "active";
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() =>
        start(async () => {
          await setProductStatusAction(id, next as "draft" | "active");
          router.refresh();
        })
      }
    >
      {status === "active" ? "판매 중지" : "판매 시작"}
    </Button>
  );
}

function ProductForm({
  product,
  basePrices,
  onDone,
}: {
  product: Product | null;
  basePrices: { basic: number; pro: number };
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [includedServices, setIncluded] = useState(
    product?.includedServices ?? "",
  );
  const [basePlan, setBasePlan] = useState(product?.basePlan ?? "");
  const [sellPrice, setSellPrice] = useState(
    product ? String(product.sellPriceKrw) : "",
  );
  const [vatMode, setVatMode] = useState(product?.vatMode ?? "included");
  const [billingType, setBillingType] = useState(
    product?.billingType ?? "one_time",
  );
  const [scope, setScope] = useState(product?.scope ?? "");
  const [terms, setTerms] = useState(product?.terms ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const basePrice =
    basePlan === "basic"
      ? basePrices.basic
      : basePlan === "pro"
        ? basePrices.pro
        : 0;
  const sellNum = Number(sellPrice) || 0;
  const delta = sellNum - basePrice;

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveProductAction({
        id: product?.id,
        name,
        description: description || null,
        includedServices: includedServices || null,
        basePlan: (basePlan || null) as "basic" | "pro" | null,
        sellPriceKrw: sellNum,
        vatMode: vatMode as "included" | "excluded",
        billingType: billingType as "one_time" | "recurring",
        scope: scope || null,
        terms: terms || null,
        status: product?.status === "active" ? "active" : "draft",
      });
      if (res.error) setMsg(res.error);
      else {
        onDone();
        router.refresh();
      }
    });

  return (
    <Card className="space-y-4 p-6">
      <h3 className="font-semibold">{product ? "상품 편집" : "새 상품"}</h3>
      <div>
        <Label required>상품명</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>설명</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label>포함 서비스(고객 노출)</Label>
        <Textarea
          value={includedServices}
          onChange={(e) => setIncluded(e.target.value)}
          placeholder="블로그 월 20건 대행, 카드뉴스 10건 …"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>연결 요금제</Label>
          <Select
            value={basePlan}
            onChange={(e) => setBasePlan(e.target.value)}
          >
            <option value="">요금제 미연동(커스텀)</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </Select>
        </div>
        <div>
          <Label required>판매가(원)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
          />
        </div>
      </div>
      {basePlan && (
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p>
            본사 기본요금(참조):{" "}
            <span className="font-semibold">{won(basePrice)}</span>
          </p>
          <p className={delta < 0 ? "text-danger" : "text-muted"}>
            예상 차액: {won(delta)}{" "}
            {delta < 0
              ? "— 기본요금보다 낮습니다 ⚠"
              : "— 세금·PG수수료·대행비용 제외 전(순이익 아님)"}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>부가세</Label>
          <Select value={vatMode} onChange={(e) => setVatMode(e.target.value)}>
            <option value="included">포함</option>
            <option value="excluded">별도</option>
          </Select>
        </div>
        <div>
          <Label>청구 방식</Label>
          <Select
            value={billingType}
            onChange={(e) => setBillingType(e.target.value)}
          >
            <option value="one_time">1회</option>
            <option value="recurring">정기(월)</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>제공 범위</Label>
        <Input value={scope} onChange={(e) => setScope(e.target.value)} />
      </div>
      <div>
        <Label>취소·환불 조건</Label>
        <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} />
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

// ---------------- 오퍼 ----------------
function OffersTab({
  products,
  clients,
  offers,
  origin,
}: {
  products: Product[];
  clients: ClientOpt[];
  offers: Offer[];
  origin: string;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [clientUserId, setClientUserId] = useState("");
  const [override, setOverride] = useState("");
  const [validDays, setValidDays] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const activeProducts = products.filter((p) => p.status !== "archived");

  const create = () =>
    start(async () => {
      setMsg(null);
      if (!productId) {
        setMsg("상품을 선택해주세요.");
        return;
      }
      const res = await createOfferAction({
        productId,
        clientUserId: clientUserId || null,
        sellPriceKrw: override ? Number(override) : null,
        validDays: validDays ? Number(validDays) : null,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg(`오퍼 생성됨: ${origin}/offers/${res.token}`);
        setProductId("");
        setOverride("");
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <h3 className="font-semibold">오퍼 만들기(고객 제시)</h3>
        <div>
          <Label required>상품</Label>
          <Select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">선택</option>
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {won(p.sellPriceKrw)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>고객(선택)</Label>
            <Select
              value={clientUserId}
              onChange={(e) => setClientUserId(e.target.value)}
            >
              <option value="">링크로 공유</option>
              {clients.map((c) => (
                <option key={c.clientUserId} value={c.clientUserId}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>가격 조정(선택)</Label>
            <Input
              type="number"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="미입력 시 상품가"
            />
          </div>
        </div>
        <div>
          <Label>유효기간(일, 선택)</Label>
          <Input
            type="number"
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
            placeholder="예: 14"
          />
        </div>
        {msg && <p className="text-sm text-primary break-all">{msg}</p>}
        <Button onClick={create} disabled={busy}>
          {busy ? "생성 중…" : "오퍼 생성"}
        </Button>
      </Card>

      <div className="space-y-2">
        {offers.map((o) => (
          <Card key={o.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{o.name}</p>
              <p className="text-sm text-muted">
                {won(o.sellPriceKrw)} · {o.status}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <CopyLinkButton url={`${origin}/offers/${o.token}`} />
              {o.status !== "void" && o.status !== "accepted" && (
                <VoidButton kind="offer" id={o.id} />
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------- 청구서 ----------------
function InvoicesTab({
  offers,
  invoices,
  storefront,
  origin,
}: {
  offers: Offer[];
  invoices: Invoice[];
  storefront: Storefront | null;
  origin: string;
}) {
  const router = useRouter();
  const [offerId, setOfferId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [tax, setTax] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const issuableOffers = offers.filter(
    (o) => o.status === "sent" || o.status === "accepted",
  );

  const issue = () =>
    start(async () => {
      setMsg(null);
      if (!offerId) {
        setMsg("오퍼를 선택해주세요.");
        return;
      }
      const res = await issueInvoiceAction({
        offerId,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        taxKrw: tax ? Number(tax) : null,
        sellerName: storefront?.displayName ?? null,
        sellerInfo: storefront?.sellerInfo ?? null,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg(`청구서 발행됨: ${origin}/invoices/${res.token}`);
        setOfferId("");
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <h3 className="font-semibold">청구서 발행(오퍼 → 확정 청구)</h3>
        <div>
          <Label required>오퍼</Label>
          <Select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
            <option value="">선택</option>
            {issuableOffers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {won(o.sellPriceKrw)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>이용 시작</Label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <Label>이용 종료</Label>
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>부가세(원, 별도일 때)</Label>
          <Input
            type="number"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </div>
        {msg && <p className="text-sm text-primary break-all">{msg}</p>}
        <Button onClick={issue} disabled={busy}>
          {busy ? "발행 중…" : "청구서 발행"}
        </Button>
      </Card>

      <div className="space-y-2">
        {invoices.map((i) => (
          <Card key={i.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{i.number}</p>
              <p className="text-sm text-muted">
                {won(i.sellPriceKrw)} · {i.status}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <CopyLinkButton url={`${origin}/invoices/${i.token}`} />
              {i.status !== "paid" && i.status !== "void" && (
                <VoidButton kind="invoice" id={i.id} />
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------- 정산 ----------------
function SettlementTab({ settlement }: { settlement: Settlement }) {
  const tiles = [
    { label: "총 수납액(고객 결제)", value: settlement.gross },
    { label: "본사 기본요금 공제", value: settlement.baseDeduction },
    { label: "정산 예정(대기)", value: settlement.pending },
    { label: "보류", value: settlement.held },
    { label: "지급 완료", value: settlement.paid },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="mt-1 text-lg font-semibold">{won(t.value)}</p>
          </Card>
        ))}
      </div>
      <Card className="p-5 text-sm text-muted">
        정산 예정액은 <strong>고객 결제금액 − 본사 기본요금</strong> 기준의 예상
        차액입니다. 세금·PG 수수료·환불·대행 비용은 아직 반영되지 않았으므로
        순이익이 아닙니다. 실제 지급액·주기·보류 조건은 관리자 정산 정책을 따릅니다.
      </Card>
    </div>
  );
}

// ---------------- 공통 ----------------
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
    >
      {copied ? "복사됨" : "링크 복사"}
    </Button>
  );
}

function VoidButton({ kind, id }: { kind: "offer" | "invoice"; id: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() =>
        start(async () => {
          if (kind === "offer") await voidOfferAction(id);
          else await voidInvoiceAction(id);
          router.refresh();
        })
      }
    >
      취소
    </Button>
  );
}
