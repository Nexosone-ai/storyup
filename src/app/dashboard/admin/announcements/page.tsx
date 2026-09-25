import { listAnnouncementsAdmin } from "@/lib/admin/announcements";
import { AdminAnnouncementsView } from "@/components/admin/AdminAnnouncementsView";

export const metadata = { title: "관리자 · 공지팝업" };

export default async function AdminAnnouncementsPage() {
  const announcements = await listAnnouncementsAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <AdminAnnouncementsView items={announcements} />
    </div>
  );
}
