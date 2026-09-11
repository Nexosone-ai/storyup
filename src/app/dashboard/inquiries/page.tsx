import { redirect } from "next/navigation";
import { getUser, getUserInquiries } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { Icon } from "@/components/ui/icons";
import { MarkInquiriesRead } from "./MarkInquiriesRead";
import { DeleteInquiryButton } from "./DeleteInquiryButton";

export const metadata = { title: "문의" };

function fmtDate(iso: string, ko: boolean): string {
  return new Date(iso).toLocaleString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InquiriesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [items, locale] = await Promise.all([getUserInquiries(), getLocale()]);
  const ko = locale === "ko";
  const hasUnread = items.some((i) => !i.read_at);

  return (
    <div className="space-y-6">
      {/* 목록을 열면 안읽음 배지를 지운다. */}
      <MarkInquiriesRead hasUnread={hasUnread} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "문의" : "Inquiries"}
        </h1>
        <p className="mt-1 text-muted">
          {ko
            ? "랜딩페이지 방문자가 남긴 문의예요. 남겨진 연락처로 답변해보세요."
            : "Inquiries left by visitors on your landing pages. Reply via the contact they left."}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
            <Icon.chat width={22} height={22} />
          </div>
          <p className="mt-4 font-semibold">
            {ko ? "아직 받은 문의가 없어요" : "No inquiries yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            {ko
              ? "랜딩페이지 하단 문의하기 폼으로 방문자가 문의를 남기면 여기에 모여요."
              : "When visitors submit the contact form on your landing pages, inquiries appear here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className={`rounded-2xl border p-5 ${
                it.read_at
                  ? "border-border bg-surface"
                  : "border-primary/40 bg-primary-soft/25"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight">{it.name}</p>
                    {!it.read_at && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {ko ? "새 문의" : "New"}
                      </span>
                    )}
                    {it.businessName && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                        {it.businessName}
                      </span>
                    )}
                  </div>
                  <a
                    href={
                      /@/.test(it.contact)
                        ? `mailto:${it.contact}`
                        : `tel:${it.contact.replace(/[^+\d]/g, "")}`
                    }
                    className="mt-0.5 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {it.contact}
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-xs text-muted">
                    {fmtDate(it.created_at, ko)}
                  </span>
                  <DeleteInquiryButton id={it.id} ko={ko} />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {it.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
