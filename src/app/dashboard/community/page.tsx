import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getStoryFeed, getRealTalkFeed } from "@/lib/community";
import { CommunityView } from "@/components/community/CommunityView";

export const metadata = { title: "커뮤니티" };

export default async function CommunityPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [story, realtalk] = await Promise.all([
    getStoryFeed(),
    getRealTalkFeed(),
  ]);

  return <CommunityView story={story} realtalk={realtalk} />;
}
