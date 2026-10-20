import { createAdminClient } from "@/lib/supabase/server";
import { listPendingDesignerEarnings } from "@/lib/marketplace/sales";
import { AdminDesignerView } from "@/components/admin/AdminDesignerView";
import type {
  DesignerRow,
  ReviewRow,
  ListingRow,
  CatalogRow,
} from "@/components/admin/AdminDesignerView";

export const metadata = { title: "관리자 · 디자이너 마켓" };

export default async function AdminDesignerPage() {
  const admin = createAdminClient();

  const [permsRes, reviewRes, listingRes, earnings, catalogRes] = await Promise.all([
    admin
      .from("designer_permissions")
      .select("user_id, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("template_versions")
      .select("id, template_id, version, status, created_at")
      .in("status", ["submitted", "approved"])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("template_listings")
      .select("id, version_id, title, price_krw, commission_pct, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    listPendingDesignerEarnings(),
    admin
      .from("skill_catalog")
      .select("id, repo_url, title, description, tag, active, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const perms = permsRes.data ?? [];
  const reviews = reviewRes.data ?? [];
  const listings = listingRes.data ?? [];
  const catalog: CatalogRow[] = (catalogRes.data ?? []).map((c) => ({
    id: c.id,
    repoUrl: c.repo_url,
    title: c.title,
    description: c.description,
    tag: c.tag,
    active: c.active,
  }));

  // 템플릿 제목 먼저 조회(소유자 id 확보용).
  const templateIds = [...new Set(reviews.map((r) => r.template_id))];
  const { data: templates } = templateIds.length
    ? await admin.from("design_templates").select("id, title, owner_user_id").in("id", templateIds)
    : { data: [] as { id: string; title: string; owner_user_id: string }[] };
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));

  // 이메일 보강 — 디자이너 + 템플릿 소유자 모두.
  const userIds = [
    ...new Set([
      ...perms.map((p) => p.user_id),
      ...(templates ?? []).map((t) => t.owner_user_id),
    ]),
  ];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("user_id, email").in("user_id", userIds)
    : { data: [] as { user_id: string; email: string }[] };
  const emailByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));

  // 판매량(소유권 수) — 리스팅별 구매 건수.
  const listingIds = listings.map((l) => l.id);
  const salesByListing = new Map<string, number>();
  if (listingIds.length) {
    const { data: purch } = await admin
      .from("template_sales")
      .select("listing_id")
      .in("listing_id", listingIds)
      .limit(5000);
    for (const p of purch ?? [])
      if (p.listing_id)
        salesByListing.set(p.listing_id, (salesByListing.get(p.listing_id) ?? 0) + 1);
  }

  const designers: DesignerRow[] = perms.map((p) => ({
    userId: p.user_id,
    email: emailByUser.get(p.user_id) ?? null,
    createdAt: p.created_at,
  }));

  const reviewRows: ReviewRow[] = reviews.map((r) => {
    const t = tplById.get(r.template_id);
    return {
      versionId: r.id,
      version: r.version,
      status: r.status,
      createdAt: r.created_at,
      templateTitle: t?.title || "(제목 없음)",
      ownerEmail: (t && emailByUser.get(t.owner_user_id)) ?? null,
    };
  });

  const listingRows: ListingRow[] = listings.map((l) => ({
    id: l.id,
    versionId: l.version_id,
    title: l.title,
    priceKrw: l.price_krw,
    commissionPct: l.commission_pct,
    status: l.status,
    sales: salesByListing.get(l.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <AdminDesignerView
        designers={designers}
        reviews={reviewRows}
        listings={listingRows}
        earnings={earnings}
        catalog={catalog}
      />
    </div>
  );
}
