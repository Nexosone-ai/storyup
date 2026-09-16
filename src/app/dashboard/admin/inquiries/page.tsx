import { getInquiriesAdmin } from "@/lib/admin/inquiries";
import { AdminInquiriesView } from "@/components/admin/AdminInquiriesView";

export const metadata = { title: "관리자 · 문의고객" };

export default async function AdminInquiriesPage() {
  const { inquiries, total } = await getInquiriesAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <AdminInquiriesView inquiries={inquiries} total={total} />
    </div>
  );
}
