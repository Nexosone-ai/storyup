import { createAdminClient } from "@/lib/supabase/server";

/** 관리자 문의고객 DB — 호출 전 반드시 isCurrentUserAdmin() 확인. */

export interface AdminInquiry {
  id: string;
  name: string;
  contact: string;
  kakao: string | null;
  message: string;
  /** blog = 블로그 이벤트 연락문의, site = 랜딩페이지 문의 */
  source: "blog" | "site";
  businessId: string;
  businessName: string;
  ownerEmail: string;
  readAt: string | null;
  createdAt: string;
}

export interface AdminInquiriesResult {
  inquiries: AdminInquiry[];
  total: number;
}

/** 전체 사업체에 걸친 문의고객(site_inquiries) + 사업체·소유자 맥락. 최신순. */
export async function getInquiriesAdmin(
  limit = 500,
): Promise<AdminInquiriesResult> {
  const admin = createAdminClient();

  const [{ data: rows }, { count }] = await Promise.all([
    admin
      .from("site_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin.from("site_inquiries").select("id", { count: "exact", head: true }),
  ]);

  const list = rows ?? [];
  if (list.length === 0) return { inquiries: [], total: count ?? 0 };

  const bizIds = [...new Set(list.map((r) => r.business_id))];
  const { data: bizList } = await admin
    .from("businesses")
    .select("id, name, user_id")
    .in("id", bizIds);
  const bizMap = new Map((bizList ?? []).map((b) => [b.id, b]));

  const ownerIds = [...new Set((bizList ?? []).map((b) => b.user_id))];
  const emailMap = new Map<string, string | null>();
  if (ownerIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, email")
      .in("user_id", ownerIds);
    for (const p of profiles ?? []) emailMap.set(p.user_id, p.email);
  }

  const inquiries: AdminInquiry[] = list.map((r) => {
    const biz = bizMap.get(r.business_id);
    return {
      id: r.id,
      name: r.name,
      contact: r.contact,
      kakao: r.kakao,
      message: r.message,
      source: r.blog_post_id ? "blog" : "site",
      businessId: r.business_id,
      businessName: biz?.name ?? "(삭제된 사업체)",
      ownerEmail: biz ? (emailMap.get(biz.user_id) ?? "") : "",
      readAt: r.read_at,
      createdAt: r.created_at,
    };
  });

  return { inquiries, total: count ?? inquiries.length };
}
