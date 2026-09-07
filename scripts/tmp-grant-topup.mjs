import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 이번 달(서울) 기간 키
const period = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
}).format(new Date());
const PRO_POINTS = 5000;

// 이번 달에 이미 (free 기준으로) 월 포인트를 받은 사용자 → pro 기준으로 차액 보정
const { data: grants, error } = await admin
  .from("plan_grants")
  .select("user_id, plan, amount")
  .eq("period", period)
  .lt("amount", PRO_POINTS);
if (error) {
  console.error("plan_grants 조회 실패:", error.message);
  process.exit(1);
}
console.log(`${period} 기간 보정 대상: ${grants?.length ?? 0}명`);

let done = 0,
  failed = 0;
for (const g of grants ?? []) {
  const diff = PRO_POINTS - g.amount;
  const { error: txErr } = await admin.from("point_transactions").insert({
    user_id: g.user_id,
    amount: diff,
    reason: `${period} pro 플랜 월 포인트 (체험 전환 보정)`,
    type: "PLAN_CREDIT",
    ref_type: "plan_grant",
  });
  if (txErr) {
    console.error("보정 실패:", g.user_id, txErr.message);
    failed++;
    continue;
  }
  await admin
    .from("plan_grants")
    .update({ plan: "pro", amount: PRO_POINTS })
    .eq("user_id", g.user_id)
    .eq("period", period);
  done++;
}
console.log(`보정 완료: ${done}명 (+각자 차액) · 실패 ${failed}`);
