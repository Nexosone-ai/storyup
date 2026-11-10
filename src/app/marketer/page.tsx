import { redirect } from "next/navigation";

/** (레거시) 마케터 진입경로 — 영업자 조직은 파트너로 통합됐다(2026-11-10). */
export default function MarketerEntry() {
  redirect("/partner");
}
