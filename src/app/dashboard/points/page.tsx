import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getBalance, getMyTransactions, getMyWithdrawals } from "@/lib/points";
import { PointsView } from "@/components/points/PointsView";

export const metadata = { title: "포인트" };

export default async function PointsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [balance, transactions, withdrawals] = await Promise.all([
    getBalance(user.id),
    getMyTransactions(user.id),
    getMyWithdrawals(user.id),
  ]);

  return (
    <PointsView
      balance={balance}
      transactions={transactions}
      withdrawals={withdrawals}
    />
  );
}
