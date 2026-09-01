import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "서포터즈" };

/** 서포터즈는 정식 오픈 전까지 준비 중 안내만 표시한다. */
export default async function SupportersPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <p className="eyebrow mb-2">서포터즈</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          함께 만드는 사람들
        </h1>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon.users className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">준비 중입니다</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          디자이너·영상 편집자·음악 제작자와 소상공인을 연결하는 서포터즈
          기능을 준비하고 있습니다. 곧 만나보실 수 있어요.
        </p>
      </div>
    </div>
  );
}
