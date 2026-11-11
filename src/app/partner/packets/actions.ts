"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { isCurrentUserPartner } from "@/lib/partner";
import type { CreatedOrder } from "@/lib/payments/orders";
import {
  cancelMyTransferOrder,
  createPacketCardOrder,
  createPacketTransferOrder,
  validatePackets,
  type PacketOrderRow,
} from "@/lib/partner/packets";

const PATH = "/partner/packets";

/** 2026-11-11 패킷 제도 종료 — 모든 구매 액션은 차단(안내만). PR2 에서 파일 삭제 예정. */
const PACKETS_CLOSED =
  "패킷 제도가 종료되었어요. 고객에게 상품을 판매(결제)하면 작업권이 생겨요.";

async function guard(): Promise<
  { userId: string; email: string } | { error: string }
> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isCurrentUserPartner()))
    return { error: "파트너만 이용할 수 있습니다." };
  return { error: PACKETS_CLOSED };
}

/** 카드결제 주문 생성 → 브라우저가 PortOne 결제창을 연다. */
export async function createPacketCardOrderAction(input: {
  packets: number;
  buyer: { name: string; phone: string; email: string };
}): Promise<{ order?: CreatedOrder; error?: string }> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const v = validatePackets(input.packets);
  if (!v.ok) return { error: v.error };
  const name = input.buyer.name.trim();
  const email = input.buyer.email.trim() || g.email;
  if (!name) return { error: "구매자 이름을 입력해주세요." };
  const res = await createPacketCardOrder({
    partnerUserId: g.userId,
    packets: v.packets,
    buyer: { name, email, phone: input.buyer.phone.trim() },
  });
  if (res.order) revalidatePath(PATH);
  return res;
}

/** 계좌이체 청구서 발행(입금 대기). 입금 확인·지급은 관리자가 수동. */
export async function createPacketTransferOrderAction(input: {
  packets: number;
  depositorName: string;
  buyer: { name: string; phone: string; email: string };
}): Promise<{ order?: PacketOrderRow; error?: string }> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const v = validatePackets(input.packets);
  if (!v.ok) return { error: v.error };
  const depositorName = input.depositorName.trim();
  if (!depositorName) return { error: "입금자명을 입력해주세요." };
  const res = await createPacketTransferOrder({
    partnerUserId: g.userId,
    packets: v.packets,
    depositorName,
    buyer: {
      name: input.buyer.name.trim() || depositorName,
      email: input.buyer.email.trim() || g.email,
      phone: input.buyer.phone.trim(),
    },
  });
  if (res.order) revalidatePath(PATH);
  return res;
}

export async function cancelMyPacketOrderAction(
  id: string,
): Promise<{ ok?: true; error?: string }> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const res = await cancelMyTransferOrder(g.userId, id);
  if (res.ok) revalidatePath(PATH);
  return res;
}
