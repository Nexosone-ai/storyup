"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { isPartner } from "@/lib/partner";
import {
  upsertOwnSupporterProfile,
  type SupporterProfileInput,
} from "@/lib/supporters";

/** 파트너가 고객(가맹점) 이메일을 등록 → 즉시 연결(가입자) 또는 가입 대기 초대. */
export async function registerClientAction(
  email: string,
): Promise<{ ok?: true; error?: string; message?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id))) return { error: "파트너만 고객을 등록할 수 있어요." };
  const { registerClientByEmail } = await import("@/lib/partner/clients");
  const res = await registerClientByEmail({
    partnerUserId: user.id,
    partnerEmail: user.email ?? "",
    clientEmail: email,
  });
  if (res.ok) {
    revalidatePath("/partner");
    revalidatePath("/dashboard/share");
  }
  return res;
}

/** 파트너가 고객 연결 해제. */
export async function unregisterClientAction(
  clientUserId: string,
): Promise<{ ok?: true; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id))) return { error: "파트너만 가능해요." };
  const { unregisterClient } = await import("@/lib/partner/clients");
  const res = await unregisterClient(user.id, clientUserId);
  if (res.ok) {
    revalidatePath("/partner");
    revalidatePath("/dashboard/share");
  }
  return res;
}

/** 가입 대기 초대 취소. */
export async function cancelClientInviteAction(
  inviteId: string,
): Promise<{ ok?: true; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id))) return { error: "파트너만 가능해요." };
  const { cancelClientInvite } = await import("@/lib/partner/clients");
  const res = await cancelClientInvite(user.id, inviteId);
  if (res.ok) revalidatePath("/partner");
  return res;
}

/** 파트너 본인 프로필(작업 현황·이력) 저장. */
export async function savePartnerProfileAction(
  input: SupporterProfileInput,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id)))
    return { error: "파트너만 프로필을 등록할 수 있어요." };
  const res = await upsertOwnSupporterProfile(user.id, input);
  if (res.ok) revalidatePath("/partner");
  return res;
}

/** 별도계약 파트너 — 고객 계정 직접 생성(Lite, 30일 이용권 패킷 차감). 비밀번호는 저장·로그하지 않는다. */
export async function createProvisionedAccountAction(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<{ ok?: true; error?: string; message?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id))) return { error: "파트너만 가능해요." };
  const { createProvisionedAccount } = await import("@/lib/partner/provisioning");
  const res = await createProvisionedAccount({
    partnerUserId: user.id,
    partnerEmail: user.email ?? "",
    email: input.email,
    displayName: input.displayName,
    password: input.password,
  });
  if (res.ok) revalidatePath("/partner");
  return res;
}

/** 별도계약 파트너 — 생성 계정 30일 연장(패킷 차감). */
export async function extendProvisionedAccountAction(
  clientUserId: string,
): Promise<{ ok?: true; error?: string; message?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id))) return { error: "파트너만 가능해요." };
  const { extendProvisionedAccount } = await import("@/lib/partner/provisioning");
  const res = await extendProvisionedAccount(user.id, clientUserId);
  if (res.ok) revalidatePath("/partner");
  return res;
}
