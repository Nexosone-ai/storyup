import { createAdminClient } from "@/lib/supabase/server";
import {
  AdminTestAccountsView,
  type TestAccountRow,
} from "@/components/admin/AdminTestAccountsView";

export const metadata = { title: "관리자 · 테스트 계정" };

/** 만료 여부 — Date.now는 컴포넌트 밖에서 호출(순수성 규칙). */
function isPast(iso: string | null): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export default async function AdminTestAccountsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("test_accounts")
    .select("id, email, label, password, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: TestAccountRow[] = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    label: r.label,
    password: r.password,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    expired: isPast(r.expires_at),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <AdminTestAccountsView rows={rows} />
    </div>
  );
}
