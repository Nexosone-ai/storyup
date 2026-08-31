import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";

/** 법적 고지 페이지 공용 레이아웃. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1 px-5 py-16 sm:px-8">
        <article className="prose mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted">최종 수정일: {updated}</p>
          <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

/** 법률 검토가 필요한 문구 표시. */
export function LegalTodo({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4 text-sm text-muted">
      ⚠️ 법률 검토 필요: {children}
    </p>
  );
}
