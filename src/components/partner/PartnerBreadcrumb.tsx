"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Icon } from "@/components/ui/icons";

/**
 * 파트너 영역 공통 상단 바 — 현재 위치(브레드크럼)와 "이전 페이지" 바로가기.
 * 파트너 레이아웃에서 모든 하위 페이지에 렌더되므로 페이지마다 돌아가기 버튼을 둘 필요가 없다.
 * "이전 페이지"는 같은 사이트 안에서 이동해 온 경우 브라우저 뒤로가기, 그 외(직접 URL 진입)는
 * 상위 단계로 이동한다.
 */

type Crumb = { href: string; label: string };

const LABELS: Record<string, { ko: string; en: string }> = {
  partner: { ko: "파트너 홈", en: "Partner home" },
  videos: { ko: "영상 만들기", en: "Make videos" },
  "recap-shorts": { ko: "블로그 요약 쇼츠", en: "Recap shorts" },
  "similar-video": { ko: "관련 영상 10개", en: "Similar videos" },
  packets: { ko: "패킷 구매", en: "Buy packets" },
  result: { ko: "결제 결과", en: "Payment result" },
  sales: { ko: "상품 · 판매 관리", en: "Products & sales" },
  "sub-partners": { ko: "서브파트너 관리", en: "Sub-partners" },
  video: { ko: "전문 영상 스튜디오", en: "Pro video studio" },
  designer: { ko: "디자이너 스튜디오", en: "Designer studio" },
  skills: { ko: "스킬", en: "Skills" },
  templates: { ko: "템플릿", en: "Templates" },
  edit: { ko: "템플릿 설정", en: "Template settings" },
  editor: { ko: "비주얼 에디터", en: "Visual editor" },
  guide: { ko: "파트너 사용 매뉴얼", en: "Partner guide" },
};

/** 동적 세그먼트(id)는 부모에 따라 이름을 정한다. */
function dynamicLabel(parent: string | undefined, ko: boolean): string {
  switch (parent) {
    case "sub-partners":
      return ko ? "서브파트너 상세" : "Sub-partner";
    case "video":
      return ko ? "프로젝트" : "Project";
    case "templates":
      return ko ? "템플릿" : "Template";
    default:
      return ko ? "상세" : "Detail";
  }
}

function buildCrumbs(pathname: string, ko: boolean): Crumb[] {
  const segs = pathname.split("/").filter(Boolean); // ["partner", "videos", ...]
  const crumbs: Crumb[] = [
    { href: "/dashboard", label: ko ? "대시보드" : "Dashboard" },
  ];
  let href = "";
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    href += `/${seg}`;
    const known = LABELS[seg];
    const label = known
      ? ko
        ? known.ko
        : known.en
      : dynamicLabel(segs[i - 1], ko);
    // "templates" 자체는 목록 페이지가 없으므로 링크 대신 상위(디자이너)로 보낸다.
    crumbs.push({ href: seg === "templates" ? "/partner/designer" : href, label });
  }
  return crumbs;
}

export function PartnerBreadcrumb() {
  const pathname = usePathname() ?? "/partner";
  const router = useRouter();
  const ko = useLocale() === "ko";
  const crumbs = buildCrumbs(pathname, ko);
  const parent = crumbs[crumbs.length - 2];

  const goBack = () => {
    const sameSite =
      typeof document !== "undefined" &&
      document.referrer.startsWith(window.location.origin) &&
      window.history.length > 1;
    if (sameSite) router.back();
    else router.push(parent.href);
  };

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm">
      <nav aria-label={ko ? "현재 위치" : "Breadcrumb"}>
        <ol className="flex flex-wrap items-center gap-1 text-muted">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={c.href + i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>›</span>}
                {last ? (
                  <span className="font-semibold text-foreground" aria-current="page">
                    {c.label}
                  </span>
                ) : (
                  <Link href={c.href} className="hover:text-foreground hover:underline">
                    {c.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted"
        title={ko ? `이전 페이지 (${parent.label})` : `Previous page (${parent.label})`}
      >
        <Icon.arrowLeft className="size-3.5" />
        {ko ? "이전 페이지" : "Back"}
        <span className="hidden text-muted sm:inline">· {parent.label}</span>
      </button>
    </div>
  );
}
