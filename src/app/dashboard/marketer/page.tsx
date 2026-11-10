import { redirect } from "next/navigation";

/**
 * (레거시) 마케터/유통망 대시보드 — 영업자 조직은 파트너로 통합됐다(2026-11-10).
 * 기존 영업자는 파트너, 하위 영업자는 서브파트너로 이전(마이그 0106). 파트너 영역으로 보낸다.
 */
export default function LegacyMarketerPage() {
  redirect("/partner");
}
