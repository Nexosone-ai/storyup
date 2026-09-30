import { createAdminClient } from "@/lib/supabase/server";
import { AdminDomainsView } from "@/components/admin/AdminDomainsView";

export const metadata = { title: "관리자 · 개인 도메인" };

export interface AdminDomainRow {
  id: string;
  domain: string;
  status: "pending" | "active" | "error";
  createdAt: string;
  businessName: string;
  slug: string | null;
}

export default async function AdminDomainsPage() {
  const admin = createAdminClient();
  const { data: domains } = await admin
    .from("custom_domains")
    .select("id, domain, status, created_at, business_id")
    .order("created_at", { ascending: false });

  const bizIds = [...new Set((domains ?? []).map((d) => d.business_id))];
  const [{ data: bizRows }, { data: siteRows }] = await Promise.all([
    bizIds.length
      ? admin.from("businesses").select("id, name").in("id", bizIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    bizIds.length
      ? admin.from("websites").select("business_id, slug").in("business_id", bizIds)
      : Promise.resolve({ data: [] as { business_id: string; slug: string }[] }),
  ]);
  const nameBy = new Map((bizRows ?? []).map((b) => [b.id, b.name]));
  const slugBy = new Map((siteRows ?? []).map((s) => [s.business_id, s.slug]));

  const rows: AdminDomainRow[] = (domains ?? []).map((d) => ({
    id: d.id,
    domain: d.domain,
    status: d.status,
    createdAt: d.created_at,
    businessName: nameBy.get(d.business_id) ?? "—",
    slug: slugBy.get(d.business_id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <AdminDomainsView rows={rows} />
    </div>
  );
}
