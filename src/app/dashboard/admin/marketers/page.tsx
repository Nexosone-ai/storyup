import { redirect } from "next/navigation";

/** (레거시) 마케터·유통망·정산 — 영업자 조직은 파트너로 통합(2026-11-10). 파트너 탭으로 보낸다. */
export default function LegacyAdminMarketersPage() {
  redirect("/dashboard/admin/partners");
}
