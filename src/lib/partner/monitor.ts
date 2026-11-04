import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  listSubPartners,
  listPartnerClients,
  type PartnerClientBiz,
} from "@/lib/partner";

/**
 * 파트너·관리자 모니터링 집계 — 읽기 전용. 호출 전 반드시 권한 확인
 * (상위파트너 본인 or isCurrentUserAdmin()). 운영 권한(operableOwnerIds)은
 * 건드리지 않고 서비스롤로 '보기'만 제공한다.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface BusinessActivity {
  businessId: string;
  name: string;
  sitePublished: boolean;
  blogPublished: number;
  cardNews: number;
  leads: number; // 쿠폰 수령 + 문의
  views30d: number;
}

export interface ClientActivity {
  clientUserId: string;
  label: string;
  businesses: BusinessActivity[];
}

export interface ActivityTotals {
  businesses: number;
  sitesPublished: number;
  blogPublished: number;
  cardNews: number;
  leads: number;
  views30d: number;
}

export interface SubPartnerActivity {
  subUserId: string;
  name: string | null;
  email: string | null;
  status: string;
  clientCount: number;
  totals: ActivityTotals;
  clients: ClientActivity[];
}

function emptyTotals(): ActivityTotals {
  return {
    businesses: 0,
    sitesPublished: 0,
    blogPublished: 0,
    cardNews: 0,
    leads: 0,
    views30d: 0,
  };
}

/** businessId → 활동 지표. 서비스롤로 배치 조회 후 JS 집계. */
async function aggregateBusinesses(
  businessIds: string[],
): Promise<Map<string, BusinessActivity>> {
  const map = new Map<string, BusinessActivity>();
  if (!businessIds.length) return map;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * DAY).toISOString();

  const [sites, blogs, cards, coupons, inquiries, views] = await Promise.all([
    admin.from("websites").select("business_id, status").in("business_id", businessIds),
    admin
      .from("blog_posts")
      .select("business_id")
      .in("business_id", businessIds)
      .eq("status", "published"),
    admin
      .from("marketing_contents")
      .select("business_id")
      .in("business_id", businessIds)
      .eq("platform", "instagram_cards"),
    admin.from("coupon_claims").select("business_id").in("business_id", businessIds),
    admin.from("site_inquiries").select("business_id").in("business_id", businessIds),
    admin
      .from("site_events")
      .select("business_id")
      .in("business_id", businessIds)
      .eq("event", "page_view")
      .gte("created_at", since),
  ]);

  const ensure = (bid: string): BusinessActivity => {
    let a = map.get(bid);
    if (!a) {
      a = {
        businessId: bid,
        name: "",
        sitePublished: false,
        blogPublished: 0,
        cardNews: 0,
        leads: 0,
        views30d: 0,
      };
      map.set(bid, a);
    }
    return a;
  };

  for (const r of sites.data ?? [])
    ensure(r.business_id).sitePublished = r.status === "published";
  for (const r of blogs.data ?? []) ensure(r.business_id).blogPublished += 1;
  for (const r of cards.data ?? []) ensure(r.business_id).cardNews += 1;
  for (const r of coupons.data ?? []) ensure(r.business_id).leads += 1;
  for (const r of inquiries.data ?? []) ensure(r.business_id).leads += 1;
  for (const r of views.data ?? []) ensure(r.business_id).views30d += 1;

  return map;
}

/** 여러 고객(+사업장)의 활동을 조립하고 합계를 낸다. */
function assembleClients(
  clients: PartnerClientBiz[],
  activity: Map<string, BusinessActivity>,
): { clients: ClientActivity[]; totals: ActivityTotals } {
  const totals = emptyTotals();
  const out: ClientActivity[] = clients.map((c) => {
    const businesses: BusinessActivity[] = c.businesses.map((b) => {
      const a = activity.get(b.id) ?? {
        businessId: b.id,
        name: b.name,
        sitePublished: false,
        blogPublished: 0,
        cardNews: 0,
        leads: 0,
        views30d: 0,
      };
      a.name = b.name;
      totals.businesses += 1;
      if (a.sitePublished) totals.sitesPublished += 1;
      totals.blogPublished += a.blogPublished;
      totals.cardNews += a.cardNews;
      totals.leads += a.leads;
      totals.views30d += a.views30d;
      return a;
    });
    return {
      clientUserId: c.clientUserId,
      label: c.clientName || c.clientEmail || c.clientUserId.slice(0, 8),
      businesses,
    };
  });
  return { clients: out, totals };
}

/** 상위파트너의 서브파트너별 활동 롤업(랜딩·블로그·카드뉴스·리드·트래픽). */
export async function getSubPartnerMonitor(
  parentUserId: string,
): Promise<SubPartnerActivity[]> {
  const subs = await listSubPartners(parentUserId);
  if (!subs.length) return [];

  // 모든 서브의 고객·사업장을 모아 한 번에 집계.
  const perSubClients = await Promise.all(
    subs.map((s) => listPartnerClients(s.subUserId)),
  );
  const allBizIds = perSubClients.flatMap((cs) =>
    cs.flatMap((c) => c.businesses.map((b) => b.id)),
  );
  const activity = await aggregateBusinesses([...new Set(allBizIds)]);

  return subs.map((s, i) => {
    const { clients, totals } = assembleClients(perSubClients[i], activity);
    return {
      subUserId: s.subUserId,
      name: s.name,
      email: s.email,
      status: s.status,
      clientCount: s.clientCount,
      totals,
      clients,
    };
  });
}

/** 한 서브파트너(또는 파트너)의 고객 활동 상세 — 상세 페이지용. */
export async function getPartnerClientsActivity(
  partnerUserId: string,
): Promise<{ clients: ClientActivity[]; totals: ActivityTotals }> {
  const clients = await listPartnerClients(partnerUserId);
  const bizIds = clients.flatMap((c) => c.businesses.map((b) => b.id));
  const activity = await aggregateBusinesses([...new Set(bizIds)]);
  return assembleClients(clients, activity);
}

export interface PartnerMonitorRow {
  partnerUserId: string;
  name: string | null;
  email: string | null;
  directClients: number;
  subPartners: number;
  totals: ActivityTotals;
}

/**
 * 관리자 전체 현황 — 모든 (상위)파트너별 롤업(직속 고객 + 서브파트너의 고객 전부).
 * 호출 전 isCurrentUserAdmin() 확인.
 */
export async function getAllPartnersMonitor(): Promise<PartnerMonitorRow[]> {
  const admin = createAdminClient();
  // 서브로 등록된 계정은 상위파트너 집계에 흡수되므로 최상위 파트너만 나열한다.
  const [{ data: partnerSubs }, { data: partnerPlans }] = await Promise.all([
    admin.from("partner_subs").select("parent_partner_user_id, sub_partner_user_id"),
    admin.from("subscriptions").select("user_id").eq("plan", "partner").eq("status", "active"),
  ]);
  const subIds = new Set((partnerSubs ?? []).map((r) => r.sub_partner_user_id));
  const topPartners = [
    ...new Set((partnerPlans ?? []).map((r) => r.user_id)),
  ].filter((id) => !subIds.has(id));
  if (!topPartners.length) return [];

  const labels = await (async () => {
    const { data } = await admin
      .from("profiles")
      .select("user_id, name, email")
      .in("user_id", topPartners);
    return new Map((data ?? []).map((p) => [p.user_id, p]));
  })();

  const rows = await Promise.all(
    topPartners.map(async (pid) => {
      const [directClients, subs] = await Promise.all([
        listPartnerClients(pid),
        listSubPartners(pid),
      ]);
      // 직속 고객 + 서브파트너들의 고객 전부를 한 파트너의 성과로 롤업.
      const subClients = await Promise.all(
        subs.map((s) => listPartnerClients(s.subUserId)),
      );
      const allClients = [...directClients, ...subClients.flat()];
      const bizIds = allClients.flatMap((c) => c.businesses.map((b) => b.id));
      const activity = await aggregateBusinesses([...new Set(bizIds)]);
      const { totals } = assembleClients(allClients, activity);
      const p = labels.get(pid);
      return {
        partnerUserId: pid,
        name: p?.name ?? null,
        email: p?.email ?? null,
        directClients: directClients.length,
        subPartners: subs.length,
        totals,
      };
    }),
  );
  // 활동(조회수) 많은 순.
  rows.sort((a, b) => b.totals.views30d - a.totals.views30d);
  return rows;
}
