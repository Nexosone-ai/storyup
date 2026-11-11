import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  chargePartnerCredits,
  getCreditPrice,
  isPartner,
  isSubPartner,
  parentPartnerOf,
  InsufficientCreditsError,
  CreditChargeError,
} from "@/lib/partner";
import { linkPartnerClient } from "@/lib/partner/clients";

/**
 * 파트너 직접 생성 계정(Lite) — 별도계약 파트너 전용.
 * - 파트너가 고객 계정을 '직접' 만든다(이메일 가입 대기 없이): 아이디(이메일)·이름·초기 비밀번호.
 * - 계정 1개 = 30일 이용권 = partner_credit_prices['LITE_ACCOUNT_30D'] 패킷(기본 118 = ₩11,800, VAT 별도).
 * - 생성 즉시 partner_clients(대행)·account_shares(고객 화면 '담당 파트너') 연결.
 * - 권한: partner_account_provisioning(enabled) 행이 있는 파트너 + 그 파트너의 서브파트너(상속).
 * 모든 쓰기는 service role. 호출 전 isPartner 확인.
 */

export const LITE_ACTION = "LITE_ACCOUNT_30D";
export const LITE_PERIOD_DAYS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 86_400_000;

/** 이 파트너(또는 그 상위파트너)가 계정 직접 생성 권한이 있는지. */
export async function canProvisionAccounts(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const has = async (id: string) => {
    const { data } = await admin
      .from("partner_account_provisioning")
      .select("enabled")
      .eq("partner_user_id", id)
      .maybeSingle();
    return data?.enabled === true;
  };
  if (await has(userId)) return true;
  if (await isSubPartner(userId)) {
    const parent = await parentPartnerOf(userId);
    if (parent && (await has(parent))) return true;
  }
  return false;
}

/** 계정 1개(30일) 패킷 단가. null = 단가 미설정(생성 차단). */
export async function liteAccountPrice(): Promise<number | null> {
  return getCreditPrice(LITE_ACTION);
}

export interface ProvisionedAccountRow {
  id: string;
  clientUserId: string;
  email: string;
  displayName: string | null;
  periods: number;
  expiresAt: string;
  createdAt: string;
  businessCount: number;
  /** 구독 상태(lite 활성·만료 등 표시용). */
  plan: string | null;
  active: boolean;
  /** 만료까지 남은 일수(음수 = 지남). 서버에서 계산해 화면 순수성을 유지. */
  daysLeft: number;
}

export async function listProvisionedAccounts(
  partnerUserId: string,
): Promise<ProvisionedAccountRow[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("partner_provisioned_accounts")
    .select("id, client_user_id, email, display_name, periods, expires_at, created_at")
    .eq("partner_user_id", partnerUserId)
    .order("created_at", { ascending: false });
  const list = rows ?? [];
  if (!list.length) return [];
  const ids = list.map((r) => r.client_user_id);
  const [{ data: subs }, { data: bizs }] = await Promise.all([
    admin.from("subscriptions").select("user_id, plan, status, current_period_end").in("user_id", ids),
    admin.from("businesses").select("user_id").in("user_id", ids),
  ]);
  const subBy = new Map((subs ?? []).map((s) => [s.user_id, s]));
  const bizCount = new Map<string, number>();
  for (const b of bizs ?? []) bizCount.set(b.user_id, (bizCount.get(b.user_id) ?? 0) + 1);
  const now = Date.now();
  return list.map((r) => {
    const s = subBy.get(r.client_user_id);
    const end = s?.current_period_end ? new Date(s.current_period_end).getTime() : null;
    const active = !!s && s.status === "active" && s.plan === "lite" && (end === null || end >= now);
    return {
      id: r.id,
      clientUserId: r.client_user_id,
      email: r.email,
      displayName: r.display_name,
      periods: r.periods,
      expiresAt: s?.current_period_end ?? r.expires_at,
      createdAt: r.created_at,
      businessCount: bizCount.get(r.client_user_id) ?? 0,
      plan: s?.plan ?? null,
      active,
      daysLeft: Math.ceil(((end ?? new Date(r.expires_at).getTime()) - now) / DAY_MS),
    };
  });
}

type Result = { ok?: true; error?: string; message?: string };

function chargeErrorMessage(err: unknown): string {
  if (err instanceof InsufficientCreditsError)
    return "보유 패킷이 부족해요. 패킷을 구매한 뒤 다시 시도해주세요.";
  if (err instanceof CreditChargeError)
    return "패킷 차감 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.";
  return "패킷 차감에 실패했습니다.";
}

/**
 * 계정 생성 — 패킷 차감(선차감, 실패 시 환불) → auth 사용자 생성 → lite 구독(30일) → 대행 연결 → 대장 기록.
 * 비밀번호는 저장·로그하지 않는다(파트너가 고객에게 전달, 고객이 변경 권장).
 */
export async function createProvisionedAccount(args: {
  partnerUserId: string;
  partnerEmail: string;
  email: string;
  displayName: string;
  password: string;
}): Promise<Result> {
  const email = args.email.trim().toLowerCase();
  const name = args.displayName.trim();
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일(아이디)을 입력해주세요." };
  if (!name) return { error: "표시 이름을 입력해주세요." };
  if (args.password.length < 8) return { error: "초기 비밀번호는 8자 이상이어야 해요." };
  if (email === args.partnerEmail.toLowerCase()) return { error: "본인 이메일로는 만들 수 없어요." };
  if (!(await isPartner(args.partnerUserId))) return { error: "파트너만 가능해요." };
  if (!(await canProvisionAccounts(args.partnerUserId)))
    return { error: "계정 직접 생성은 별도계약 파트너만 사용할 수 있어요." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (existing)
    return {
      error: "이미 가입된 이메일이에요. 기존 가입자는 '고객 등록(이메일)'로 연결해주세요.",
    };

  // 1) 패킷 선차감 (fail-closed)
  let charge;
  try {
    charge = await chargePartnerCredits(args.partnerUserId, LITE_ACTION, undefined, true);
  } catch (err) {
    return { error: chargeErrorMessage(err) };
  }

  // 2) 계정 생성
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: { name, provisioned_by: args.partnerUserId },
  });
  if (createErr || !created?.user) {
    await charge.refund();
    const msg = createErr?.message ?? "";
    return {
      error: /already|registered|exists/i.test(msg)
        ? "이미 가입된 이메일이에요."
        : "계정 생성에 실패했어요. 다시 시도해주세요.",
    };
  }
  const clientId = created.user.id;
  // 프로필은 auth 트리거(handle_new_user)가 만든다 — 이름만 보정.
  await admin
    .from("profiles")
    .upsert({ user_id: clientId, email, name }, { onConflict: "user_id" })
    .then(() => undefined, () => undefined);

  // 3) lite 구독 30일
  const expires = new Date(Date.now() + LITE_PERIOD_DAYS * DAY_MS).toISOString();
  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      user_id: clientId,
      plan: "lite",
      status: "active",
      current_period_end: expires,
      billing_key: null,
      cancel_at_period_end: false,
      trial: false,
      billing_failures: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (subErr) {
    console.error("[provisioning] lite subscription failed", subErr);
    await admin.auth.admin.deleteUser(clientId).catch(() => {});
    await charge.refund();
    return { error: "이용권 설정에 실패했어요(0108 마이그레이션 적용 확인). 패킷은 환불됐어요." };
  }

  // 4) 대행 연결 + 대장
  await linkPartnerClient(args.partnerUserId, args.partnerEmail, clientId);
  const { error: rowErr } = await admin.from("partner_provisioned_accounts").insert({
    partner_user_id: args.partnerUserId,
    client_user_id: clientId,
    email,
    display_name: name,
    periods: 1,
    expires_at: expires,
  });
  if (rowErr) console.error("[provisioning] ledger insert failed", rowErr);

  return {
    ok: true,
    message: `${email} 계정을 만들었어요 (Lite · ${new Date(expires).toLocaleDateString("ko-KR")}까지, ${charge.charged}패킷 차감). 아이디와 초기 비밀번호를 고객에게 전달하고 비밀번호 변경을 안내하세요.`,
  };
}

/**
 * 30일 연장 — 만료일을 max(지금, 기존 만료) + 30일로.
 *
 * 보호 규칙(2026-11-11, 운영 전 결함 수정):
 * 1) 고객이 Basic·Pro 등 다른 요금제로 전환해 활성 상태면 연장을 거부한다(패킷 미차감).
 *    종전에는 플랜을 Lite 로 덮어쓰고 정기결제 키까지 지웠다.
 * 2) 동시 요청 방지 — partner_provisioned_accounts.periods 를 조건부 갱신(CAS)해 연장권을
 *    먼저 예약한 요청만 과금·연장한다. 종전에는 패킷이 두 번 차감되고 기간은 한 번만 늘었다.
 * 3) subscriptions 는 기존 행이면 plan/status/기간만 update — billing_key 는 건드리지 않는다.
 */
export async function extendProvisionedAccount(
  partnerUserId: string,
  clientUserId: string,
): Promise<Result> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("partner_provisioned_accounts")
    .select("id, periods, expires_at, email")
    .eq("partner_user_id", partnerUserId)
    .eq("client_user_id", clientUserId)
    .maybeSingle();
  if (!row) return { error: "내가 생성한 계정만 연장할 수 있어요." };
  if (!(await canProvisionAccounts(partnerUserId)))
    return { error: "계정 직접 생성은 별도계약 파트너만 사용할 수 있어요." };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", clientUserId)
    .maybeSingle();
  const now = Date.now();
  const subEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).getTime()
    : 0;

  // 1) 플랜 보호 — Lite/Free 가 아닌 플랜이 활성(만료 전 또는 만료 없음)이면 연장 대상이 아니다.
  if (
    sub &&
    sub.plan !== "lite" &&
    sub.plan !== "free" &&
    sub.status === "active" &&
    (!sub.current_period_end || subEnd > now)
  ) {
    return {
      error: `이 계정은 ${sub.plan.toUpperCase()} 요금제로 전환되어 Lite 연장 대상이 아니에요. 고객이 직접 결제·갱신하는 계정이라 파트너 연장으로 바꿀 수 없어요.`,
    };
  }

  // 2) 연장권 예약(CAS) — periods 가 읽은 값 그대로일 때만 +1. 0행이면 다른 요청이 먼저 처리 중.
  const base = Math.max(now, subEnd, new Date(row.expires_at).getTime());
  const expires = new Date(base + LITE_PERIOD_DAYS * DAY_MS).toISOString();
  const { data: reserved } = await admin
    .from("partner_provisioned_accounts")
    .update({
      periods: row.periods + 1,
      expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("periods", row.periods)
    .select("id");
  if (!reserved?.length)
    return { error: "이미 연장 처리 중이에요. 잠시 후 새로고침해서 확인해주세요." };
  const revert = async () => {
    await admin
      .from("partner_provisioned_accounts")
      .update({
        periods: row.periods,
        expires_at: row.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  };

  let charge;
  try {
    charge = await chargePartnerCredits(partnerUserId, LITE_ACTION, undefined, true);
  } catch (err) {
    await revert();
    return { error: chargeErrorMessage(err) };
  }

  // 3) 구독 갱신 — 기존 행은 billing_key 를 보존(update), 행이 없을 때만 insert.
  const patch = {
    plan: "lite" as const,
    status: "active",
    current_period_end: expires,
    cancel_at_period_end: false,
    trial: false,
    billing_failures: 0,
    updated_at: new Date().toISOString(),
  };
  const { error: subErr } = sub
    ? await admin.from("subscriptions").update(patch).eq("user_id", clientUserId)
    : await admin
        .from("subscriptions")
        .insert({ user_id: clientUserId, billing_key: null, ...patch });
  if (subErr) {
    await charge.refund();
    await revert();
    return { error: "연장에 실패했어요. 패킷은 환불됐어요." };
  }
  return {
    ok: true,
    message: `${row.email} 이용권을 ${new Date(expires).toLocaleDateString("ko-KR")}까지 연장했어요 (${charge.charged}패킷 차감).`,
  };
}

/** 관리자: 별도계약(계정 직접 생성) 권한 설정. */
export async function setProvisioning(
  partnerUserId: string,
  enabled: boolean,
  createdBy: string | null,
  note?: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("partner_account_provisioning").upsert(
    {
      partner_user_id: partnerUserId,
      enabled,
      note: note ?? null,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "partner_user_id" },
  );
  if (error) return { error: "설정 저장에 실패했어요(0108 마이그레이션 적용 확인)." };
  return {};
}

/** 관리자 목록용: 권한이 켜진 파트너 user_id 집합. */
export async function provisioningPartnerIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_account_provisioning")
    .select("partner_user_id")
    .eq("enabled", true);
  return new Set((data ?? []).map((r) => r.partner_user_id));
}
