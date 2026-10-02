import { createAdminClient } from "@/lib/supabase/server";
import { deleteBillingKey } from "@/lib/payments/portone";

export type DeleteAccountResult = { ok: true } | { error: string };

type Bucket = ReturnType<
  ReturnType<typeof createAdminClient>["storage"]["from"]
>;

/** 스토리지 폴더를 하위 폴더까지(최대 3단계) 비운다. 실패해도 삭제는 계속된다. */
async function removeFolder(bucket: Bucket, prefix: string, depth = 0) {
  const { data } = await bucket.list(prefix, { limit: 1000 });
  const files: string[] = [];
  const dirs: string[] = [];
  for (const f of data ?? []) (f.id ? files : dirs).push(f.name);
  if (files.length) await bucket.remove(files.map((n) => `${prefix}/${n}`));
  if (depth < 3)
    for (const d of dirs) await removeFolder(bucket, `${prefix}/${d}`, depth + 1);
}

/**
 * 계정과 개인정보를 삭제한다(회원탈퇴).
 *
 * - 결제·입금 기록은 법령 보존 의무로 남기고(0046에서 CASCADE 해제),
 *   소비자 식별용 최소 정보를 account_deletions에 적는다.
 * - 정기결제 중이면 빌링키를 먼저 지워 추가 청구를 막는다. 남은 기간은 소멸.
 * - 그 외(사업장·사이트·블로그·구독·알림·직원 연결 등)는 auth.users 삭제 시
 *   CASCADE로 정리되고, 스토리지 이미지는 여기서 직접 비운다.
 * - 관리자·마케터·프리미엄 템플릿 거래 이력이 있는 계정은 운영 확인이 필요해 차단.
 */
export async function deleteAccount(
  userId: string,
  opts: { reason?: string | null; ko?: boolean } = {},
): Promise<DeleteAccountResult> {
  const ko = opts.ko ?? true;
  const admin = createAdminClient();

  const [{ data: profile }, { data: sub }, { count: marketerCount }, { count: templateCount }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("name,email,is_admin")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("subscriptions")
        .select("status,billing_key")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("marketers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      admin
        .from("template_purchases")
        .select("id", { count: "exact", head: true })
        .or(`buyer_user_id.eq.${userId},creator_user_id.eq.${userId}`),
    ]);

  if (profile?.is_admin)
    return {
      error: ko
        ? "관리자 계정은 직접 삭제할 수 없습니다. 관리자 권한을 먼저 해제해주세요."
        : "Admin accounts cannot be deleted directly. Remove admin rights first.",
    };
  if ((marketerCount ?? 0) > 0 || (templateCount ?? 0) > 0)
    return {
      error: ko
        ? "정산·거래 내역이 있는 계정은 고객지원을 통해 삭제를 요청해주세요."
        : "Accounts with settlement or sales history must request deletion via support.",
    };

  // 추가 청구 차단이 최우선 — 실패하면 삭제를 진행하지 않는다.
  if (sub?.billing_key) {
    try {
      await deleteBillingKey(sub.billing_key);
    } catch (err) {
      console.error("[account] billing key delete failed", userId, err);
      return {
        error: ko
          ? "결제 수단 해제에 실패했습니다. 잠시 후 다시 시도해주세요."
          : "Failed to release the payment method. Please try again shortly.",
      };
    }
  }

  const { data: bizList } = await admin
    .from("businesses")
    .select("id")
    .eq("user_id", userId);

  const { count: paymentCount } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // 결제 기록 식별용 대장. auth 삭제 전에 남겨 실패 시에도 흔적이 남게 한다.
  const { error: logErr } = await admin.from("account_deletions").insert({
    user_id: userId,
    email: profile?.email ?? null,
    name: profile?.name ?? null,
    reason: opts.reason || null,
    had_payments: (paymentCount ?? 0) > 0,
  });
  if (logErr) {
    console.error("[account] deletion log failed", userId, logErr.message);
    return {
      error: ko
        ? "삭제 처리에 실패했습니다. 잠시 후 다시 시도해주세요."
        : "Failed to process the deletion. Please try again shortly.",
    };
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error("[account] auth delete failed", userId, authErr.message);
    return {
      error: ko
        ? "계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요."
        : "Failed to delete the account. Please try again shortly.",
    };
  }

  // 스토리지 이미지 정리 — orphan 이미지는 치명적이지 않으므로 실패를 삼킨다.
  try {
    const bucket = admin.storage.from("site-images");
    for (const b of bizList ?? []) await removeFolder(bucket, b.id);
  } catch (err) {
    console.error("[account] storage cleanup failed", userId, err);
  }

  return { ok: true };
}
