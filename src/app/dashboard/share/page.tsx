import { redirect } from "next/navigation";
import { getUser, accountOwnerId } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  listOwnerShares,
  listIncomingShares,
  listSharedAccounts,
} from "@/lib/accountShare";
import { AccountShareView } from "@/components/share/AccountShareView";

export const metadata = { title: "계정 공유" };

export default async function AccountSharePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const ownerId = await accountOwnerId(supabase, user.id);

  const [ownerShares, incoming, sharedAccounts] = await Promise.all([
    listOwnerShares(ownerId),
    listIncomingShares(user.email ?? ""),
    listSharedAccounts(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <AccountShareView
        ownerShares={ownerShares}
        incoming={incoming}
        sharedAccounts={sharedAccounts}
      />
    </div>
  );
}
