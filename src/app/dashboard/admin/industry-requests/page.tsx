import { createAdminClient } from "@/lib/supabase/server";
import {
  AdminIndustryRequestsView,
  type RequestRow,
  type EventRow,
} from "@/components/admin/AdminIndustryRequestsView";

export const metadata = { title: "업종 추가 요청" };

// 관리자 가드는 layout.tsx + 액션에서 수행. 조회는 서비스롤(모든 요청).
export default async function AdminIndustryRequestsPage() {
  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("industry_requests")
    .select(
      "id, user_id, name, description, needs, ref_url, status, admin_note, public_reply, linked_industry_id, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (requests ?? []) as RequestRow[];
  const ids = rows.map((r) => r.id);

  const { data: events } = ids.length
    ? await admin
        .from("industry_request_events")
        .select("id, request_id, from_status, to_status, note, created_at")
        .in("request_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminIndustryRequestsView
        requests={rows}
        events={(events ?? []) as EventRow[]}
      />
    </div>
  );
}
