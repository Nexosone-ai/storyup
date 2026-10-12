"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addDownstreamMember,
  setDistributorSplit,
  getNetworkMember,
} from "@/lib/network";

type Result = { ok?: boolean; error?: string; message?: string };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** 하위 멤버 등록 (총판→영업점, 영업점→리셀러). 역할은 서버가 호출자 기준으로 결정. */
export async function addDownstreamMemberAction(email: string): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "로그인이 필요합니다." };
  if (!email.trim()) return { error: "이메일을 입력해주세요." };
  const res = await addDownstreamMember(uid, email);
  if (res.ok) return { ok: true, message: "하위 멤버가 등록되었습니다." };
  return res;
}

/** 총판 본인 배분비율 설정 (합계 100%). */
export async function setMySplitAction(
  sd: number,
  sa: number,
  sr: number,
): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "로그인이 필요합니다." };
  const m = await getNetworkMember(uid);
  if (!m || m.role !== "distributor")
    return { error: "총판만 배분비율을 설정할 수 있습니다." };
  const res = await setDistributorSplit(uid, sd, sa, sr);
  if (res.ok) return { ok: true, message: "배분비율이 저장되었습니다." };
  return res;
}
