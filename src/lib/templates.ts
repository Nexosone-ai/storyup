import { createClient } from "@/lib/supabase/server";

export interface StoreTemplate {
  id: string;
  creator_user_id: string;
  creator_name: string;
  title: string;
  description: string | null;
  template_key: string;
  preview_image: string | null;
  price_points: number;
  mine: boolean;
  purchased: boolean;
}

export interface MyTemplate {
  id: string;
  title: string;
  template_key: string;
  price_points: number;
  active: boolean;
  salesCount: number;
  earned: number;
}

export interface PurchaseRow {
  id: string;
  title: string;
  price_points: number;
  created_at: string;
}

export async function getStore(userId: string): Promise<StoreTemplate[]> {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("premium_templates")
    .select(
      "id,creator_user_id,creator_name,title,description,template_key,preview_image,price_points,active",
    )
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: bought } = await supabase
    .from("template_purchases")
    .select("template_id")
    .eq("buyer_user_id", userId);
  const boughtIds = new Set((bought ?? []).map((b) => b.template_id));

  return (templates ?? []).map((t) => ({
    id: t.id,
    creator_user_id: t.creator_user_id,
    creator_name: t.creator_name,
    title: t.title,
    description: t.description,
    template_key: t.template_key,
    preview_image: t.preview_image,
    price_points: t.price_points,
    mine: t.creator_user_id === userId,
    purchased: boughtIds.has(t.id),
  }));
}

export async function getMyTemplates(userId: string): Promise<MyTemplate[]> {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("premium_templates")
    .select("id,title,template_key,price_points,active")
    .eq("creator_user_id", userId)
    .order("created_at", { ascending: false });

  const list = templates ?? [];
  if (list.length === 0) return [];

  const { data: sales } = await supabase
    .from("template_purchases")
    .select("template_id,creator_earning")
    .eq("creator_user_id", userId);

  return list.map((t) => {
    const forT = (sales ?? []).filter((s) => s.template_id === t.id);
    return {
      ...t,
      salesCount: forT.length,
      earned: forT.reduce((sum, s) => sum + s.creator_earning, 0),
    };
  });
}

export async function getMyPurchases(userId: string): Promise<PurchaseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("template_purchases")
    .select("id,template_id,price_points,created_at")
    .eq("buyer_user_id", userId)
    .order("created_at", { ascending: false });

  const list = data ?? [];
  if (list.length === 0) return [];

  const ids = [...new Set(list.map((p) => p.template_id))];
  const { data: templates } = await supabase
    .from("premium_templates")
    .select("id,title")
    .in("id", ids);
  const titleById = new Map((templates ?? []).map((t) => [t.id, t.title]));

  return list.map((p) => ({
    id: p.id,
    price_points: p.price_points,
    created_at: p.created_at,
    title: titleById.get(p.template_id) ?? "삭제된 템플릿",
  }));
}
