import type { WebsiteContent } from "@/types/domain";
import {
  SiteMap,
  CONTACT_FIELDS,
  contactHref,
  type SiteLang,
} from "@/components/website/templates/shared";

/**
 * 공개 블로그 글 하단의 "주소 및 정보" + "지도" 모듈 (서버 렌더, 정적).
 * 별도 저장 없이 랜딩페이지 content.contact를 재사용한다.
 * 글 주인이 blog_events에서 켠 경우에만(page에서 게이팅) 렌더된다.
 */
export function BlogInfoModules({
  contact,
  showAddress,
  showMap,
  lang,
}: {
  contact: WebsiteContent["contact"] | undefined;
  showAddress: boolean;
  showMap: boolean;
  lang: SiteLang;
}) {
  const ko = lang === "ko";
  const address = contact?.address?.trim() ?? "";

  // 주소·정보에서 실제 값이 있는 항목만 추린다.
  const rows = showAddress
    ? CONTACT_FIELDS.flatMap(([key, koLabel, enLabel]) => {
        const value = (contact?.[key] ?? "").trim();
        return value ? [{ key, label: ko ? koLabel : enLabel, value }] : [];
      })
    : [];

  const hasAddressCard = showAddress && rows.length > 0;
  const hasMap = showMap && !!address;
  if (!hasAddressCard && !hasMap) return null;

  return (
    <section className="mt-10 space-y-4 border-t border-border pt-8">
      {hasAddressCard && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold">
            📍 {ko ? "매장 정보" : "Business info"}
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            {rows.map(({ key, label, value }) => {
              const href = contactHref(key, value);
              return (
                <div key={key} className="flex gap-3">
                  <dt className="w-20 shrink-0 font-medium text-muted">
                    {label}
                  </dt>
                  <dd className="min-w-0 break-words">
                    {href ? (
                      <a
                        href={href}
                        target={key === "phone" || key === "email" ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
      {hasMap && <SiteMap address={address} lang={lang} />}
    </section>
  );
}
