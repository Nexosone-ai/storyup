"use server";

import { isCurrentUserAdmin } from "@/lib/points";
import { setEarningStatus } from "@/lib/b2b2c/admin";
import { reprocessInvoice } from "@/lib/b2b2c/invoices";

export async function setEarningStatusAction(
  earningId: string,
  status: "pending" | "held" | "paid",
): Promise<{ error?: string }> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  return setEarningStatus(earningId, status);
}

export async function reprocessInvoiceAction(
  invoiceId: string,
): Promise<{ ok?: boolean; note?: string; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await reprocessInvoice(invoiceId);
  return { ok: res.ok, note: res.note };
}
