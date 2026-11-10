import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isPartner } from "@/lib/partner";

/**
 * 파트너 주도 고객 등록.
 * 파트너가 고객(가맹점) 이메일을 등록하면 즉시 partner_clients 링크(대행 접근)가 생기고,
 * 고객의 '담당 파트너' 화면(account_shares, status=accepted)에도 표시돼 고객이 해제할 수 있다.
 * 아직 가입 전 이메일은 partner_client_invites 로 보관 → 가입/로그인 시 자동 연결.
 * 한 고객은 한 파트너만 담당한다.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PendingInviteRow {
  id: string;
  clientEmail: string;
  createdAt: string;
}

type LinkResult = { ok: true } | { ok: false; error: string };

/** 핵심: partner_clients + account_shares(accepted) 멱등 생성. 호출 전 검증 끝난 상태. */
async function linkPartnerClient(
  partnerUserId: string,
  partnerEmail: string,
  clientUserId: string,
): Promise<LinkResult> {
  const admin = createAdminClient();
  const { error: linkErr } = await admin
    .from("partner_clients")
    .insert({
      partner_user_id: partnerUserId,
      client_user_id: clientUserId,
      created_by: partnerUserId,
    });
  if (linkErr && linkErr.code !== "23505") {
    console.error("[partner-clients] link insert failed", linkErr);
    return { ok: false, error: "고객 연결에 실패했습니다." };
  }
  // 고객 화면(담당 파트너)에 노출 + 고객이 해제할 수 있도록 공유행 기록.
  if (!partnerEmail) return { ok: true };
  const now = new Date().toISOString();
  await admin.from("account_shares").upsert(
    {
      owner_user_id: clientUserId,
      partner_email: partnerEmail.toLowerCase(),
      partner_user_id: partnerUserId,
      status: "accepted",
      accepted_at: now,
    },
    { onConflict: "owner_user_id,partner_email" },
  );
  return { ok: true };
}

/** 이 고객을 이미 담당하는 '다른' 파트너가 있는지. */
async function otherPartnerOf(
  clientUserId: string,
  partnerUserId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("partner_clients")
    .select("id", { count: "exact", head: true })
    .eq("client_user_id", clientUserId)
    .neq("partner_user_id", partnerUserId);
  return (count ?? 0) > 0;
}

/**
 * 파트너가 고객 이메일을 등록. 가입 사용자면 즉시 연결, 아니면 초대 보관.
 * 반환 message 는 화면 안내용.
 */
export async function registerClientByEmail(args: {
  partnerUserId: string;
  partnerEmail: string;
  clientEmail: string;
}): Promise<{ ok?: true; error?: string; message?: string; linked?: boolean }> {
  const email = args.clientEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일을 입력해주세요." };
  if (email === args.partnerEmail.toLowerCase())
    return { error: "본인 계정은 등록할 수 없어요." };

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("user_id, name, is_admin")
    .eq("email", email)
    .maybeSingle();

  if (prof) {
    if (prof.is_admin) return { error: "관리자 계정은 등록할 수 없어요." };
    if (await isPartner(prof.user_id))
      return { error: "다른 파트너 계정은 고객으로 등록할 수 없어요." };
    if (await otherPartnerOf(prof.user_id, args.partnerUserId))
      return { error: "이미 다른 파트너가 담당 중인 고객이에요. 본사에 문의해주세요." };
    const res = await linkPartnerClient(args.partnerUserId, args.partnerEmail, prof.user_id);
    if (!res.ok) return { error: res.error };
    // 같은 이메일의 대기 초대가 있으면 정리.
    await admin
      .from("partner_client_invites")
      .update({ status: "linked", client_user_id: prof.user_id, linked_at: new Date().toISOString() })
      .eq("partner_user_id", args.partnerUserId)
      .eq("status", "pending")
      .ilike("client_email", email);
    return {
      ok: true,
      linked: true,
      message: `${prof.name || email} 고객을 연결했어요. 아래 고객 목록에서 바로 작업할 수 있어요.`,
    };
  }

  // 미가입 → 초대 보관(이메일당 대기 1건: 다른 파트너가 먼저 등록했으면 23505).
  const { error } = await admin.from("partner_client_invites").insert({
    partner_user_id: args.partnerUserId,
    client_email: email,
  });
  if (error) {
    if (error.code === "23505") {
      const { data: mine } = await admin
        .from("partner_client_invites")
        .select("id")
        .eq("partner_user_id", args.partnerUserId)
        .eq("status", "pending")
        .ilike("client_email", email)
        .maybeSingle();
      return mine
        ? { error: "이미 등록해 둔 이메일이에요(가입 대기)." }
        : { error: "이미 다른 파트너가 등록한 이메일이에요. 본사에 문의해주세요." };
    }
    console.error("[partner-clients] invite insert failed", error);
    return { error: "등록에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }
  return {
    ok: true,
    linked: false,
    message: `${email} 은(는) 아직 가입 전이에요. 이 이메일로 가입하면 자동으로 내 고객에 연결됩니다.`,
  };
}

/** 파트너가 고객 연결 해제 — partner_clients + account_shares 제거. (콘텐츠는 그대로) */
export async function unregisterClient(
  partnerUserId: string,
  clientUserId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_clients")
    .delete()
    .eq("partner_user_id", partnerUserId)
    .eq("client_user_id", clientUserId);
  if (error) return { error: "해제에 실패했습니다." };
  await admin
    .from("account_shares")
    .delete()
    .eq("owner_user_id", clientUserId)
    .eq("partner_user_id", partnerUserId);
  return { ok: true };
}

export async function cancelClientInvite(
  partnerUserId: string,
  inviteId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_client_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId)
    .eq("partner_user_id", partnerUserId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: "취소에 실패했습니다." };
  if (!data?.length) return { error: "취소할 초대가 없어요." };
  return { ok: true };
}

export async function listPendingInvites(partnerUserId: string): Promise<PendingInviteRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_client_invites")
    .select("id, client_email, created_at")
    .eq("partner_user_id", partnerUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, clientEmail: r.client_email, createdAt: r.created_at }));
}

/**
 * 파트너 홈 로드 시: 대기 초대 중 그 사이 가입한 이메일을 찾아 연결한다.
 * 반환: 연결된 수.
 */
export async function linkPendingInvitesForPartner(
  partnerUserId: string,
  partnerEmail: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data: invites } = await admin
    .from("partner_client_invites")
    .select("id, client_email")
    .eq("partner_user_id", partnerUserId)
    .eq("status", "pending");
  if (!invites?.length) return 0;
  const emails = invites.map((i) => i.client_email.toLowerCase());
  const { data: profs } = await admin
    .from("profiles")
    .select("user_id, email")
    .in("email", emails);
  let n = 0;
  for (const p of profs ?? []) {
    if (!p.email) continue;
    const inv = invites.find((i) => i.client_email.toLowerCase() === p.email!.toLowerCase());
    if (!inv) continue;
    if (await isPartner(p.user_id)) continue;
    if (await otherPartnerOf(p.user_id, partnerUserId)) continue;
    const res = await linkPartnerClient(partnerUserId, partnerEmail, p.user_id);
    if (!res.ok) continue;
    await admin
      .from("partner_client_invites")
      .update({ status: "linked", client_user_id: p.user_id, linked_at: new Date().toISOString() })
      .eq("id", inv.id);
    n++;
  }
  return n;
}

/**
 * 고객(사용자) 로그인/대시보드 진입 시: 내 이메일로 등록된 대기 초대가 있으면 그 파트너에 연결.
 * 실패해도 화면에 영향 없도록 조용히 종료.
 */
export async function linkPendingInvitesForUser(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return;
  try {
    const admin = createAdminClient();
    const { data: inv } = await admin
      .from("partner_client_invites")
      .select("id, partner_user_id")
      .eq("status", "pending")
      .ilike("client_email", e)
      .maybeSingle();
    if (!inv) return;
    if (await isPartner(userId)) return; // 파트너 계정은 고객으로 연결하지 않음
    if (!(await isPartner(inv.partner_user_id))) return; // 등록한 쪽이 더는 파트너가 아니면 보류
    const { data: pp } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", inv.partner_user_id)
      .maybeSingle();
    const res = await linkPartnerClient(inv.partner_user_id, pp?.email ?? "", userId);
    if (!res.ok) return;
    await admin
      .from("partner_client_invites")
      .update({ status: "linked", client_user_id: userId, linked_at: new Date().toISOString() })
      .eq("id", inv.id);
  } catch (err) {
    console.error("[partner-clients] auto-link failed", err);
  }
}

/**
 * 영업 링크(?ref=파트너 추천코드)로 가입한 고객을 추천 파트너에게 자동 연결.
 * referrals 귀속 직후 호출(attributeReferral). 추천인이 파트너가 아니면 아무것도 하지 않는다.
 * 다른 파트너가 이미 담당 중이거나, 가입자가 파트너/관리자면 연결하지 않는다(한 고객 = 한 파트너).
 */
export async function linkReferredClientToPartner(
  referrerUserId: string,
  clientUserId: string,
): Promise<boolean> {
  try {
    if (referrerUserId === clientUserId) return false;
    if (!(await isPartner(referrerUserId))) return false;
    if (await isPartner(clientUserId)) return false;
    const admin = createAdminClient();
    const [{ data: client }, { data: partner }] = await Promise.all([
      admin.from("profiles").select("is_admin").eq("user_id", clientUserId).maybeSingle(),
      admin.from("profiles").select("email").eq("user_id", referrerUserId).maybeSingle(),
    ]);
    if (client?.is_admin) return false;
    if (await otherPartnerOf(clientUserId, referrerUserId)) return false;
    const res = await linkPartnerClient(referrerUserId, partner?.email ?? "", clientUserId);
    return res.ok;
  } catch (err) {
    console.error("[partner-clients] referral auto-link failed", err);
    return false;
  }
}
