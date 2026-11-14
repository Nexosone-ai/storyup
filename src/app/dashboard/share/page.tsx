import { redirect } from "next/navigation";
import { getUser, accountOwnerId } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  listOwnerShares,
  listIncomingShares,
  listSharedAccounts,
} from "@/lib/accountShare";
import { AccountShareView } from "@/components/share/AccountShareView";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { listActiveStorefronts } from "@/lib/b2b2c/storefront";

export const metadata = { title: "담당 파트너" };

export default async function AccountSharePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const ownerId = await accountOwnerId(supabase, user.id);

  const [ownerShares, incoming, sharedAccounts, storefronts] = await Promise.all([
    listOwnerShares(ownerId),
    listIncomingShares(user.email ?? ""),
    listSharedAccounts(user.id),
    // 연결 가능한 파트너 = 공개 소개(스토어프론트)를 활성화한 파트너. 공개 페이지는 B2B2C 모드에서만 열린다.
    B2B2C_ENABLED ? listActiveStorefronts() : Promise.resolve([]),
  ]);
  const assignedSlugs = new Set(
    ownerShares.map((s) => s.storefront?.slug).filter((v): v is string => !!v),
  );
  const availablePartners = storefronts
    .filter((p) => !assignedSlugs.has(p.slug))
    .map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      intro: p.intro,
      contact: p.contact,
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <AccountShareView
        ownerShares={ownerShares}
        incoming={incoming}
        sharedAccounts={sharedAccounts}
        availablePartners={availablePartners}
        canRevoke={ownerId === user.id}
      />
    </div>
  );
}
