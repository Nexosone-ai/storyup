"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import { TemplateRenderer, TEMPLATE_META, setPath } from "./templates";
import { SiteSections } from "./templates/SiteSections";
import { makeEditableRenderer } from "./templates/EditableText";
import { makeEditableImageRenderer } from "./templates/ImageSlot";
import { makeEditableGallery } from "./templates/GallerySection";
import {
  saveWebsiteAction,
  publishWebsiteAction,
  updateSiteSlugAction,
  uploadSiteImage,
} from "@/app/business/actions";
import { resizeImage } from "./templates/ImageSlot";
import { MapImportBar } from "./MapImportBar";
import { RichTextToolbar } from "./RichTextToolbar";
import { stripHtml } from "@/utils/richtext";
import { PdfImportBar } from "./PdfImportBar";
import { UrlImportBar } from "./UrlImportBar";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { PlaceImportData } from "@/lib/placeImport";
import type { PdfImportData } from "@/lib/pdfImport";
import { SITE_FONTS, SITE_PALETTES, siteStyleVars } from "./siteStyle";
import { normalizeAdsensePublisherId } from "@/lib/adsense";
import { slugify } from "@/utils/slug";
import {
  LANDING_SECTION_KEYS,
  type WebsiteContent,
  type WebsiteFontId,
  type WebsitePaletteId,
  type WebsiteTemplateId,
  type SitePage,
  type LandingSectionKey,
  type SiteBanner,
  type SiteSection,
} from "@/types/domain";
import type { WebsiteRow } from "@/types/database";
import type { ShowcaseCardItem } from "@/components/marketing/showcaseData";
import type { SiteSectionPost } from "./templates/BlogPreview";
import { BannerEditor } from "./BannerEditor";

type Device = "desktop" | "mobile";

type AddableSection =
  | "hero"
  | "pricing"
  | "testimonials"
  | "faq"
  | "stats"
  | "cta"
  | "postList";

/** '섹션 추가'로 넣는 섹션의 시작 템플릿(언어별 예시 내용). */
function makeStarterSection(type: AddableSection, ko: boolean): SiteSection {
  if (type === "hero")
    return {
      type: "hero",
      title: ko ? "당신의 비즈니스,\n여기서 시작하세요" : "Your business starts here",
      subtitle: ko
        ? "핵심 메시지를 한두 문장으로 적어주세요."
        : "Add one or two sentences about what you offer.",
      ctaLabel: ko ? "문의하기" : "Get in touch",
    };
  if (type === "stats")
    return {
      type: "stats",
      title: ko ? "숫자로 보는 우리" : "By the numbers",
      items: [
        { value: ko ? "1,200+" : "1,200+", label: ko ? "누적 고객" : "Customers" },
        { value: "98%", label: ko ? "재방문율" : "Return rate" },
        { value: ko ? "4.9" : "4.9", label: ko ? "평균 평점" : "Avg. rating" },
        { value: ko ? "10년" : "10 yrs", label: ko ? "업력" : "Experience" },
      ],
    };
  if (type === "cta")
    return {
      type: "cta",
      title: ko ? "지금 바로 시작해볼까요?" : "Ready to get started?",
      body: ko
        ? "궁금한 점이 있으면 편하게 문의해주세요."
        : "Have a question? Reach out anytime.",
      ctaLabel: ko ? "문의하기" : "Contact us",
    };
  if (type === "postList")
    return {
      type: "postList",
      title: ko ? "최근 블로그" : "Latest posts",
      category: "",
    };
  if (type === "pricing")
    return {
      type: "pricing",
      title: ko ? "요금 안내" : "Pricing",
      subtitle: ko ? "합리적인 가격으로 시작하세요" : "Simple, fair pricing",
      items: [
        {
          name: ko ? "베이직" : "Basic",
          price: ko ? "₩0" : "$0",
          description: ko ? "가볍게 시작하는 분께" : "To get started",
          features: ko ? ["기본 기능", "이메일 문의"] : ["Core features", "Email support"],
        },
        {
          name: ko ? "프로" : "Pro",
          price: ko ? "₩00,000" : "$00",
          description: ko ? "가장 인기 있는 선택" : "Most popular",
          features: ko
            ? ["모든 기본 기능", "우선 지원", "추가 혜택"]
            : ["Everything in Basic", "Priority support", "Extra perks"],
          highlighted: true,
        },
      ],
    };
  if (type === "testimonials")
    return {
      type: "testimonials",
      title: ko ? "고객 후기" : "What customers say",
      items: [
        {
          quote: ko
            ? "여기에 실제 고객의 후기를 적어주세요. 신뢰를 높여줍니다."
            : "Add a real customer quote here to build trust.",
          author: ko ? "홍길동" : "Jane D.",
          role: ko ? "단골 고객" : "Regular customer",
        },
        {
          quote: ko ? "또 다른 후기를 적어주세요." : "Another happy customer quote.",
          author: ko ? "김영희" : "John S.",
          role: ko ? "고객" : "Customer",
        },
      ],
    };
  return {
    type: "faq",
    title: ko ? "자주 묻는 질문" : "FAQ",
    items: [
      {
        q: ko ? "질문을 입력하세요?" : "Your question here?",
        a: ko ? "답변을 입력하세요." : "Your answer here.",
      },
      {
        q: ko ? "또 다른 질문은?" : "Another question?",
        a: ko ? "답변을 입력하세요." : "Your answer here.",
      },
    ],
  };
}

/** 메인 섹션 키 → 편집기 라벨(관리자가 보는 이름). */
const SECTION_LABELS: Record<LandingSectionKey, { ko: string; en: string }> = {
  banner: { ko: "배너", en: "Banner" },
  story: { ko: "스토리", en: "Story" },
  offers: { ko: "제공 서비스", en: "Offers" },
  whyChooseUs: { ko: "강점", en: "Why us" },
  sections: { ko: "상세 섹션 (가격표·후기·FAQ 등)", en: "Detail sections" },
  gallery: { ko: "갤러리", en: "Gallery" },
  blog: { ko: "최신 글", en: "Blog" },
  cards: { ko: "카드뉴스", en: "Card news" },
  map: { ko: "오시는 길", en: "Location" },
  contact: { ko: "연락처·문의", en: "Contact" },
};

/** 저장된 순서를 정규화 — 저장값 우선, 빠진 키는 기본 순서로 뒤에 붙인다. */
function normalizeSectionOrder(
  saved?: LandingSectionKey[],
): LandingSectionKey[] {
  const seen = new Set<LandingSectionKey>();
  const out: LandingSectionKey[] = [];
  for (const k of saved ?? []) {
    if (LANDING_SECTION_KEYS.includes(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of LANDING_SECTION_KEYS) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function WebsiteEditor({
  businessId,
  website,
  maxLayouts = 1,
  richAllowed = false,
  cards = [],
  posts = [],
  categories = [],
}: {
  businessId: string;
  website: WebsiteRow;
  /** 플랜별 사용 가능한 레이아웃 수 (Free 1 · Basic 3 · Pro 9). 그 이후는 잠금. */
  maxLayouts?: number;
  /** AI 상세 홈페이지 생성 가능 플랜(Pro+)인지. false면 잠금. */
  richAllowed?: boolean;
  /** 이 가게의 카드뉴스 — 미리보기의 "카드뉴스" 섹션에 표시. */
  cards?: ShowcaseCardItem[];
  /** 이 가게의 공개 블로그 글 — 글 목록(postList) 섹션 미리보기·필터용. */
  posts?: SiteSectionPost[];
  /** 사용 중인 블로그 카테고리 — postList 입력 힌트. */
  categories?: string[];
}) {
  const ko = useLocale() === "ko";
  const [content, setContent] = useState<WebsiteContent>(website.content);
  const [brief, setBrief] = useState("");
  const [multi, setMulti] = useState(false);
  const [richBusy, setRichBusy] = useState(false);
  const [richNote, setRichNote] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement | null>(null);
  // 편집 중인 페이지: "home" 또는 pages 인덱스
  const [currentPage, setCurrentPage] = useState<"home" | number>("home");
  const [status, setStatus] = useState(website.status);
  const [device, setDevice] = useState<Device>("desktop");
  const [note, setNote] = useState<string | null>(null);
  const [slug, setSlug] = useState(website.slug);
  const [slugInput, setSlugInput] = useState(website.slug);
  const [slugNote, setSlugNote] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [slugSaving, startSlug] = useTransition();
  const [logoBusy, setLogoBusy] = useState(false);
  const logoFileRef = useRef<HTMLInputElement | null>(null);
  const [adsenseInput, setAdsenseInput] = useState(
    website.content.adsense?.publisherId ?? "",
  );
  const [adsenseNote, setAdsenseNote] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [adsenseSaving, startAdsense] = useTransition();

  const template = content.template ?? "classic";

  const onEdit = useCallback((path: string, value: string) => {
    setContent((c) => setPath(c, path, value));
  }, []);

  const editRenderer = useMemo(() => makeEditableRenderer(onEdit), [onEdit]);
  // AI 이미지 생성 시 슬롯 위치(path)에 맞는 피사체 설명을 프롬프트로 전달
  const subjectFor = useCallback(
    (path: string): string => {
      if (path === "hero.image")
        return `${content.hero.businessName}, ${stripHtml(content.hero.headline)}`;
      const m = path.match(/^(offers|whyChooseUs)\.items\.(\d+)\.image$/);
      if (m) {
        const section = m[1] as "offers" | "whyChooseUs";
        const item = content[section]?.items?.[Number(m[2])];
        if (!item?.title) return content.hero.businessName;
        // 제목만으로는 이미지가 엉뚱하게 나온다 — 설명까지 붙여 맥락을 전달
        const desc = stripHtml(item.description ?? "").slice(0, 160);
        return desc ? `${item.title} — ${desc}` : item.title;
      }
      return content.hero.businessName;
    },
    [content],
  );
  const editImgRenderer = useMemo(
    () => makeEditableImageRenderer(businessId, onEdit, subjectFor),
    [businessId, onEdit, subjectFor],
  );
  const editGallery = useMemo(
    () =>
      makeEditableGallery(businessId, (next) =>
        setContent((c) => ({ ...c, gallery: next })),
      ),
    [businessId],
  );

  /** (프리미엄) PDF 자료를 올리면 텍스트를 추출해 brief에 덧붙인다. */
  const attachPdf = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setRichNote(ko ? "PDF는 10MB 이하여야 합니다." : "PDF must be under 10MB.");
      return;
    }
    setPdfBusy(true);
    setRichNote(
      ko ? "PDF에서 내용을 추출하고 있어요…" : "Extracting from the PDF…",
    );
    try {
      const form = new FormData();
      form.set("businessId", businessId);
      form.set("file", file);
      const res = await fetch("/api/ai/pdf-import", { method: "POST", body: form });
      const json = await res.json();
      if (json.error || !json.data) {
        setRichNote(
          json.error ?? (ko ? "PDF 추출에 실패했어요." : "PDF extraction failed."),
        );
        return;
      }
      const d = json.data as PdfImportData;
      const parts: string[] = [];
      if (d.headline) parts.push(d.headline);
      if (d.shortDescription) parts.push(d.shortDescription);
      const story = [d.storyTitle, d.storyBody].filter(Boolean).join("\n");
      if (story) parts.push(story);
      if (d.offers?.length)
        parts.push(
          (ko ? "제공 서비스:\n" : "Offers:\n") +
            d.offers
              .map((o) => `- ${o.title}${o.description ? `: ${o.description}` : ""}`)
              .join("\n"),
        );
      const contact = [d.phone, d.email, d.address].filter(Boolean).join(" · ");
      if (contact) parts.push((ko ? "연락처: " : "Contact: ") + contact);
      const text = parts.filter(Boolean).join("\n\n");
      if (!text) {
        setRichNote(
          ko ? "PDF에서 가져올 내용이 없었어요." : "No content found in the PDF.",
        );
        return;
      }
      setBrief((b) => (b.trim() ? b.trim() + "\n\n" : "") + text);
      setRichNote(
        ko
          ? "PDF 내용을 자료에 추가했어요. 확인 후 생성하세요."
          : "Added the PDF content to the materials. Review, then generate.",
      );
    } catch {
      setRichNote(
        ko ? "PDF 추출에 실패했어요. 다시 시도해주세요." : "Failed to read the PDF.",
      );
    } finally {
      setPdfBusy(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  /** (프리미엄) 자료를 입력하면 AI가 풍부한 섹션·컨셉까지 다시 구성한다. */
  const generateRich = () => {
    if (richBusy || !richAllowed) return;
    if (brief.trim().length < 20) {
      setRichNote(
        ko
          ? "홈페이지에 담을 자료를 조금 더 자세히 입력해주세요."
          : "Please add more detail about your business.",
      );
      return;
    }
    setRichBusy(true);
    setRichNote(
      ko
        ? "자료를 바탕으로 홈페이지를 구성하고 있어요… (최대 1분)"
        : "Building your homepage from the materials… (up to 1 min)",
    );
    void (async () => {
      try {
        const res = await fetch("/api/ai/website", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            rich: true,
            multiPage: multi,
            brief: brief.trim(),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setRichNote(json.error ?? (ko ? "생성에 실패했습니다." : "Failed."));
          setRichBusy(false);
          return;
        }
        setRichNote(ko ? "완성됐어요! 미리보기를 불러옵니다…" : "Done! Reloading…");
        window.location.reload();
      } catch {
        setRichNote(
          ko ? "생성에 실패했습니다. 다시 시도해주세요." : "Failed. Please try again.",
        );
        setRichBusy(false);
      }
    })();
  };

  // ── 멀티페이지 관리 ──
  const pages = content.pages ?? [];
  const addPage = () => {
    const idx = pages.length;
    const np: SitePage = {
      id: `pg_${Date.now().toString(36)}`,
      slug: `page-${idx + 1}`,
      navLabel: ko ? "새 페이지" : "New page",
      showInNav: true,
      sections: [],
    };
    setContent((c) => ({ ...c, pages: [...(c.pages ?? []), np] }));
    setCurrentPage(idx);
  };
  const updatePage = (i: number, patch: Partial<SitePage>) =>
    setContent((c) => ({
      ...c,
      pages: (c.pages ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const deletePage = (i: number) => {
    if (!window.confirm(ko ? "이 페이지를 삭제할까요?" : "Delete this page?"))
      return;
    setContent((c) => ({
      ...c,
      pages: (c.pages ?? []).filter((_, j) => j !== i),
    }));
    setCurrentPage("home");
  };
  const movePage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    setContent((c) => {
      const arr = [...(c.pages ?? [])];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, pages: arr };
    });
    setCurrentPage(j);
  };
  const addPostListSection = (i: number) =>
    updatePage(i, {
      sections: [
        ...pages[i].sections,
        {
          type: "postList",
          title: ko ? "블로그 글" : "Blog posts",
          category: "",
        },
      ],
    });
  const addTextSection = (i: number) =>
    updatePage(i, {
      sections: [
        ...pages[i].sections,
        {
          type: "richText",
          title: ko ? "제목" : "Title",
          body: ko ? "내용을 입력하세요." : "Write here.",
        },
      ],
    });
  // 섹션(단락) 삭제 — 하위 페이지 / 홈 각각.
  const removePageSection = (pageIndex: number, sectionIndex: number) =>
    setContent((c) => ({
      ...c,
      pages: (c.pages ?? []).map((p, j) =>
        j === pageIndex
          ? { ...p, sections: p.sections.filter((_, k) => k !== sectionIndex) }
          : p,
      ),
    }));
  const removeHomeSection = (sectionIndex: number) =>
    setContent((c) => {
      const list = c.sections ?? [];
      const target = list[sectionIndex];
      // 블로그 섹션(postList)은 필수 — 마지막 하나는 삭제하지 못하게 막는다.
      if (
        target?.type === "postList" &&
        list.filter((s) => s.type === "postList").length <= 1
      ) {
        setNote(
          ko
            ? "블로그 섹션은 홈페이지 필수 구성이라 삭제할 수 없어요."
            : "The blog section is required and cannot be removed.",
        );
        return c;
      }
      return { ...c, sections: list.filter((_, k) => k !== sectionIndex) };
    });

  /** '섹션 추가' — 선택한 시작 템플릿을 메인 섹션(content.sections)에 추가한다. */
  const addHomeSection = (type: AddableSection) => {
    const starter = makeStarterSection(type, ko);
    setContent((c) => ({
      ...c,
      sections: [...(c.sections ?? []), starter],
      // 추가한 섹션이 바로 보이도록 '상세 섹션' 블록 숨김을 해제한다.
      hiddenSections: (c.hiddenSections ?? []).filter((k) => k !== "sections"),
    }));
  };

  /** 구글 지도에서 가져온 정보를 콘텐츠에 병합한다 — 가져온 값이 있으면 우선. */
  const applyGoogleImport = useCallback((d: PlaceImportData) => {
    setContent((c) => {
      const pick = (imported: string, current?: string) =>
        imported || current || "";
      const gallery = [...(c.gallery ?? [])];
      for (const p of d.photos) if (!gallery.includes(p)) gallery.push(p);
      return {
        ...c,
        hero: {
          ...c.hero,
          businessName: c.hero.businessName || d.name,
          // 대표 사진이 없으면 첫 장을 히어로 배경으로 쓴다.
          image: c.hero.image || d.photos[0] || c.hero.image,
        },
        contact: {
          ...c.contact,
          phone: pick(d.phone, c.contact.phone),
          address: pick(d.address, c.contact.address),
          website: pick(d.website, c.contact.website),
          instagram: pick(d.instagram, c.contact.instagram),
          facebook: pick(d.facebook, c.contact.facebook),
          x: pick(d.x, c.contact.x),
        },
        gallery,
      };
    });
  }, []);

  /** PDF에서 추출한 콘텐츠를 병합한다 — 추출된 값이 있으면 우선. */
  const applyPdfImport = useCallback((d: PdfImportData) => {
    setContent((c) => {
      const pick = (imported: string, current?: string) =>
        imported || current || "";
      const gallery = [...(c.gallery ?? [])];
      for (const p of d.photos) if (!gallery.includes(p)) gallery.push(p);
      const offerItems = (c.offers?.items ?? []).map((item, i) =>
        d.offers[i]
          ? {
              ...item,
              title: pick(d.offers[i].title, item.title),
              description: pick(d.offers[i].description, item.description),
            }
          : item,
      );
      return {
        ...c,
        hero: {
          ...c.hero,
          businessName: pick(d.name, c.hero.businessName),
          headline: pick(d.headline, c.hero.headline),
          shortDescription: pick(d.shortDescription, c.hero.shortDescription),
          image: c.hero.image || d.photos[0] || c.hero.image,
        },
        story: {
          ...c.story,
          title: pick(d.storyTitle, c.story.title),
          body: pick(d.storyBody, c.story.body),
        },
        offers: { ...c.offers, items: offerItems },
        contact: {
          ...c.contact,
          phone: pick(d.phone, c.contact.phone),
          email: pick(d.email, c.contact.email),
          address: pick(d.address, c.contact.address),
          website: pick(d.website, c.contact.website),
          instagram: pick(d.instagram, c.contact.instagram),
          facebook: pick(d.facebook, c.contact.facebook),
          x: pick(d.x, c.contact.x),
        },
        gallery,
      };
    });
  }, []);

  const setTemplate = (id: WebsiteTemplateId) =>
    setContent((c) => ({ ...c, template: id }));

  const setPalette = (id: WebsitePaletteId) =>
    setContent((c) => ({ ...c, style: { ...c.style, palette: id } }));

  const setFont = (id: WebsiteFontId) =>
    setContent((c) => ({ ...c, style: { ...c.style, font: id } }));

  // 메인(랜딩) 섹션 순서/숨김 — 히어로/푸터 사이 블록 재배치.
  const sectionOrder = normalizeSectionOrder(content.sectionOrder);
  const hiddenSet = new Set(content.hiddenSections ?? []);
  const moveSection = (i: number, dir: -1 | 1) =>
    setContent((c) => {
      const order = normalizeSectionOrder(c.sectionOrder);
      const j = i + dir;
      if (j < 0 || j >= order.length) return c;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...c, sectionOrder: order };
    });
  const toggleSection = (key: LandingSectionKey) =>
    setContent((c) => {
      const set = new Set(c.hiddenSections ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...c, hiddenSections: [...set] };
    });

  // 배너 관리 (랜딩/블로그 공용) — content.banners. 저장은 기존 '저장' 경로로 영속.
  const banners = content.banners ?? [];
  const addBanner = () =>
    setContent((c) => ({
      ...c,
      banners: [
        ...(c.banners ?? []),
        {
          id: `bn_${Date.now().toString(36)}`,
          placement: "landing",
          aspect: "3:1",
        } as SiteBanner,
      ],
    }));
  const updateBanner = (id: string, next: SiteBanner) =>
    setContent((c) => ({
      ...c,
      banners: (c.banners ?? []).map((b) => (b.id === id ? next : b)),
    }));
  const removeBanner = (id: string) =>
    setContent((c) => ({
      ...c,
      banners: (c.banners ?? []).filter((b) => b.id !== id),
    }));

  const palette = content.style?.palette ?? "forest";
  const font = content.style?.font ?? "default";

  /** 로고 파일 업로드 → 스토리지에 저장 후 hero.logo에 반영 (저장 버튼으로 확정). */
  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(true);
    setNote(null);
    try {
      const resized = await resizeImage(file, 512);
      const fd = new FormData();
      fd.append("file", resized);
      const up = await uploadSiteImage(businessId, fd);
      if (up.error || !up.url) {
        setNote(up.error ?? (ko ? "업로드에 실패했습니다." : "Upload failed."));
        return;
      }
      setContent((c) => ({ ...c, hero: { ...c.hero, logo: up.url } }));
    } catch {
      setNote(
        ko ? "업로드 중 문제가 발생했습니다." : "Something went wrong during upload.",
      );
    } finally {
      setLogoBusy(false);
    }
  };

  const clearLogo = () =>
    setContent((c) => ({ ...c, hero: { ...c.hero, logo: undefined } }));

  const save = () =>
    startSave(async () => {
      setNote(null);
      const res = await saveWebsiteAction(businessId, content);
      setNote(res.error ?? (ko ? "저장되었습니다." : "Saved."));
    });

  const saveSlug = () => {
    const next = slugInput.trim();
    if (!next || next === slug) return;
    if (
      status === "published" &&
      !window.confirm(
        ko
          ? "주소를 바꾸면 기존에 공유한 링크(랜딩페이지·블로그 글)가 더 이상 열리지 않습니다.\n새 주소로 변경할까요?"
          : "Changing the address will break links you already shared (landing page and blog posts).\nChange to the new address?",
      )
    )
      return;
    startSlug(async () => {
      setSlugNote(null);
      const res = await updateSiteSlugAction(businessId, next);
      if (res.error || !res.slug)
        setSlugNote({
          text:
            res.error ??
            (ko ? "주소 변경에 실패했습니다." : "Failed to change the address."),
          error: true,
        });
      else {
        setSlug(res.slug);
        setSlugInput(res.slug);
        setSlugNote({
          text:
            res.message ??
            (ko ? "사이트 주소가 변경되었습니다." : "Site address updated."),
          error: false,
        });
      }
    });
  };

  const saveAdsense = () => {
    const raw = adsenseInput.trim();
    const normalized = normalizeAdsensePublisherId(raw);
    if (raw && !normalized) {
      setAdsenseNote({
        text: ko
          ? "퍼블리셔 ID 형식이 올바르지 않아요. 예: ca-pub-1234567890123456"
          : "Invalid publisher ID. Example: ca-pub-1234567890123456",
        error: true,
      });
      return;
    }
    // content.adsense에 반영 — 메인 저장 경로(saveWebsiteAction)로 함께 영속화.
    const next: WebsiteContent = {
      ...content,
      adsense: normalized ? { publisherId: normalized } : undefined,
    };
    setContent(next);
    setAdsenseInput(normalized ?? "");
    startAdsense(async () => {
      setAdsenseNote(null);
      const res = await saveWebsiteAction(businessId, next);
      setAdsenseNote({
        text:
          res.error ??
          (normalized
            ? ko
              ? "AdSense를 연결했어요. 게시된 사이트에 자동광고가 적용되고, 연결된 도메인의 ads.txt에 반영됩니다."
              : "AdSense connected. Auto ads apply to your published site and your domain's ads.txt is served."
            : ko
              ? "AdSense 연결을 해제했어요."
              : "AdSense disconnected."),
        error: !!res.error,
      });
    });
  };

  const togglePublish = () =>
    startPublish(async () => {
      setNote(null);
      const next = status !== "published";
      await saveWebsiteAction(businessId, content);
      const res = await publishWebsiteAction(businessId, next);
      if (res.error) setNote(res.error);
      else {
        setStatus(next ? "published" : "draft");
        setNote(res.message ?? null);
      }
    });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {ko ? "랜딩페이지 편집" : "Edit landing page"}
          </h1>
          {status === "published" ? (
            <Badge tone="success">{ko ? "공개됨" : "Published"}</Badge>
          ) : (
            <Badge tone="muted">{ko ? "초안" : "Draft"}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "published" && (
            <ButtonLink href={`/site/${slug}`} variant="outline" size="sm" target="_blank" rel="noopener noreferrer">
              <Icon.external width={16} height={16} />
              {ko ? "사이트 열기" : "Open site"}
            </ButtonLink>
          )}
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : ko ? "저장" : "Save"}
          </Button>
          <Button size="sm" onClick={togglePublish} disabled={publishing}>
            {publishing ? (
              <Spinner className="size-4" />
            ) : status === "published" ? (
              ko ? "비공개로 전환" : "Unpublish"
            ) : ko ? (
              "게시하기"
            ) : (
              "Publish"
            )}
          </Button>
        </div>
      </div>

      {/* Site address */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
        <span className="eyebrow mr-1">{ko ? "사이트 주소" : "Site address"}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-muted">/site/</span>
          <Input
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="my-shop"
            className="h-9 w-52 font-mono text-sm"
            spellCheck={false}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={saveSlug}
          disabled={slugSaving || !slugInput.trim() || slugInput.trim() === slug}
        >
          {slugSaving ? <Spinner className="size-4" /> : ko ? "주소 변경" : "Change address"}
        </Button>
        <p className="w-full text-xs text-muted">
          {ko
            ? "영문 소문자·숫자·하이픈(-)만, 3자 이상. 게시된 사이트의 주소를 바꾸면 기존에 공유한 링크는 열리지 않아요."
            : "Lowercase letters, numbers, and hyphens (-) only, 3+ characters. Changing a published site’s address breaks links you already shared."}
        </p>
        {slugNote && (
          <p
            className={`w-full text-sm font-medium ${slugNote.error ? "text-danger" : "text-primary"}`}
          >
            {slugNote.text}
          </p>
        )}
      </div>

      {/* Google AdSense (광고 수익화) — 선택. 사장님 본인 퍼블리셔 ID 연결 시 자동광고 노출. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
        <span className="eyebrow mr-1">
          {ko ? "광고 수익화 (AdSense)" : "Monetize (AdSense)"}
        </span>
        <div className="flex items-center gap-1.5">
          <Input
            value={adsenseInput}
            onChange={(e) => setAdsenseInput(e.target.value)}
            placeholder="ca-pub-1234567890123456"
            className="h-9 w-60 font-mono text-sm"
            spellCheck={false}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={saveAdsense}
          disabled={
            adsenseSaving ||
            adsenseInput.trim() === (content.adsense?.publisherId ?? "")
          }
        >
          {adsenseSaving ? (
            <Spinner className="size-4" />
          ) : adsenseInput.trim() ? (
            ko ? (
              "연결"
            ) : (
              "Connect"
            )
          ) : ko ? (
            "연결 해제"
          ) : (
            "Disconnect"
          )}
        </Button>
        <p className="w-full text-xs text-muted">
          {ko
            ? "본인 Google AdSense 퍼블리셔 ID(ca-pub-…)를 넣으면 게시된 사이트와 블로그에 자동광고가 노출되고 수익은 사장님 계정으로 들어갑니다. AdSense 승인은 사장님이 소유한 도메인이 필요하므로 Pro 개인 도메인 연결을 권장해요. 비우면 광고가 꺼집니다."
            : "Enter your own Google AdSense publisher ID (ca-pub-…) to show Auto ads on your published site and blog; revenue goes to your account. AdSense approval needs a domain you own, so connecting a Pro custom domain is recommended. Leave empty to turn ads off."}
        </p>
        {adsenseNote && (
          <p
            className={`w-full text-sm font-medium ${adsenseNote.error ? "text-danger" : "text-primary"}`}
          >
            {adsenseNote.text}
          </p>
        )}
      </div>

      {/* (프리미엄) AI 상세 홈페이지 만들기 */}
      <div className="rounded-xl border border-primary/30 bg-primary-soft/30 p-4">
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">
            ✨
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {ko ? "AI 상세 홈페이지 만들기" : "AI detailed homepage"}
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                PRO
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {ko
                ? "서비스·요금·이용절차·FAQ·후기 등 자료를 자세히 적으면, AI가 섹션을 풍부하게 구성하고 어울리는 컨셉(디자인·색)까지 골라 진짜 홈페이지처럼 다시 만들어줘요. (블로그는 그대로 유지)"
                : "Describe your services, pricing, process, FAQs, reviews, etc. — AI rebuilds a rich, homepage-like page with matching concept. (Blog stays.)"}
            </p>

            {richAllowed ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  disabled={richBusy}
                  maxLength={6000}
                  placeholder={
                    ko
                      ? "예) 제공 서비스와 각 설명, 요금(있으면), 이용 절차, 자주 묻는 질문, 고객 후기, 강조하고 싶은 숫자/실적 등을 자유롭게 적어주세요."
                      : "e.g. your services with descriptions, pricing (if any), steps, FAQs, testimonials, key numbers…"
                  }
                  className="min-h-32 w-full resize-y rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none disabled:opacity-60"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={pdfRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void attachPdf(f);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pdfRef.current?.click()}
                    disabled={pdfBusy || richBusy}
                  >
                    {pdfBusy ? (
                      <Spinner className="size-4" />
                    ) : ko ? (
                      "PDF 자료 첨부"
                    ) : (
                      "Attach PDF"
                    )}
                  </Button>
                  <span className="text-xs text-muted">
                    {ko
                      ? "회사 소개서·브로슈어 PDF를 올리면 내용이 위 자료칸에 추가돼요. (10MB 이하)"
                      : "Upload a brochure PDF to append its text to the materials above. (<10MB)"}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={multi}
                    onChange={(e) => setMulti(e.target.checked)}
                    disabled={richBusy}
                    className="size-4 accent-primary"
                  />
                  {ko
                    ? "여러 페이지로 구성 (소개·서비스 등 별도 페이지 + 상단 메뉴)"
                    : "Multi-page (About, Services… as separate pages + top menu)"}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={generateRich} disabled={richBusy}>
                    {richBusy ? (
                      <Spinner className="size-4" />
                    ) : multi ? (
                      ko ? (
                        "멀티페이지 홈페이지 생성"
                      ) : (
                        "Generate multi-page site"
                      )
                    ) : ko ? (
                      "상세 홈페이지 생성"
                    ) : (
                      "Generate homepage"
                    )}
                  </Button>
                  <span className="text-xs text-muted">
                    {ko
                      ? "기존 내용을 새로 구성합니다. 생성 후 미리보기에서 각 문구를 바로 편집할 수 있어요."
                      : "Rebuilds the page. You can edit any text in the preview afterwards."}
                  </span>
                </div>
                {richNote && (
                  <p className="text-xs font-medium text-primary">{richNote}</p>
                )}
              </div>
            ) : (
              <a
                href="/dashboard/plans"
                className="mt-2 inline-block text-xs font-semibold text-primary underline"
              >
                {ko
                  ? "Pro 플랜에서 사용할 수 있어요 — 업그레이드 →"
                  : "Available on Pro — upgrade →"}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Google Maps import */}
      <MapImportBar businessId={businessId} onImport={applyGoogleImport} />

      {/* URL import — 기존 홈페이지 주소에서 콘텐츠·사진 가져오기 */}
      <UrlImportBar businessId={businessId} onImport={applyPdfImport} />

      {/* PDF import */}
      <PdfImportBar businessId={businessId} onImport={applyPdfImport} />

      {/* Template picker + device toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">{ko ? "템플릿" : "Template"}</span>
          {TEMPLATE_META.map((t, i) => {
            const locked = i >= maxLayouts;
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (locked) {
                    setNote(
                      ko
                        ? "이 레이아웃은 Pro 플랜에서 사용할 수 있어요."
                        : "This layout is available on the Pro plan.",
                    );
                    return;
                  }
                  setTemplate(t.id);
                }}
                title={
                  locked
                    ? ko
                      ? "Pro 플랜 전용"
                      : "Pro plan only"
                    : ko
                      ? t.description
                      : t.descriptionEn
                }
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  locked
                    ? "cursor-not-allowed border-border bg-surface-muted text-muted/60"
                    : template === t.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border-strong text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {ko ? t.name : t.nameEn}
                {locked && " 🔒"}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
          {(["desktop", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                device === d ? "bg-surface text-foreground shadow-sm" : "text-muted",
              )}
            >
              {d === "desktop"
                ? ko
                  ? "데스크톱"
                  : "Desktop"
                : ko
                  ? "모바일"
                  : "Mobile"}
            </button>
          ))}
        </div>
      </div>

      {/* Logo upload */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <span className="eyebrow mr-1">{ko ? "로고" : "Logo"}</span>
        <input
          ref={logoFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onLogoFile}
        />
        {content.hero.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원격 이미지, 높이 고정
          <img
            src={content.hero.logo}
            alt={ko ? "로고" : "Logo"}
            className="h-9 w-auto max-w-40 rounded-md border border-border bg-white object-contain px-1.5 py-0.5"
          />
        ) : (
          <span className="text-sm text-muted">
            {ko
              ? "로고를 올리면 사이트 상단에 가게 이름과 함께 표시돼요."
              : "Upload a logo to show it next to your business name in the site header."}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => logoFileRef.current?.click()}
          disabled={logoBusy}
        >
          {logoBusy ? (
            <Spinner className="size-4" />
          ) : content.hero.logo ? (
            ko ? "로고 변경" : "Change logo"
          ) : ko ? (
            "로고 업로드"
          ) : (
            "Upload logo"
          )}
        </Button>
        {content.hero.logo && (
          <Button variant="ghost" size="sm" onClick={clearLogo} disabled={logoBusy}>
            {ko ? "로고 제거" : "Remove logo"}
          </Button>
        )}
        <p className="w-full text-xs text-muted">
          {ko
            ? "배경이 투명한 PNG를 권장해요. 변경 후 '저장'을 눌러야 반영됩니다."
            : "A transparent PNG works best. Press Save to apply the change."}
        </p>
      </div>

      {/* Style picker: theme color + font */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">{ko ? "테마 색상" : "Theme color"}</span>
          {SITE_PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPalette(p.id)}
              title={ko ? p.name : p.nameEn}
              aria-label={ko ? p.name : p.nameEn}
              className={cn(
                "size-7 rounded-full border-2 transition-transform hover:scale-110",
                palette === p.id
                  ? "border-foreground ring-2 ring-primary/40"
                  : "border-border-strong",
              )}
              style={{ backgroundColor: p.primary }}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">{ko ? "폰트" : "Font"}</span>
          {SITE_FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFont(f.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                font === f.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border-strong text-muted hover:bg-surface-muted hover:text-foreground",
              )}
              style={f.stack ? { fontFamily: f.stack } : undefined}
            >
              {ko ? f.name : f.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* CTA 버튼 링크 — 메인 히어로 + 상세 홈페이지의 CTA/히어로 섹션 버튼 주소. */}
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="eyebrow mr-1">{ko ? "CTA 버튼 링크" : "CTA button link"}</span>
          <span className="text-xs text-muted">
            {ko
              ? "버튼을 누르면 이동할 주소예요. 비우면 문의하기 섹션으로 이동해요. (예: https://… · tel:01012345678 · #contact)"
              : "Where each button links. Empty = scroll to the contact section."}
          </span>
        </div>
        <label className="block">
          <span className="text-xs text-muted">{ko ? "메인 히어로 버튼" : "Main hero button"}</span>
          <input
            type="text"
            defaultValue={content.hero.ctaHref ?? ""}
            placeholder="https://… / tel:… / #contact"
            onBlur={(e) => onEdit("hero.ctaHref", e.target.value.trim())}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        {(content.sections ?? []).map((s, i) =>
          s.type === "cta" || s.type === "hero" ? (
            <label key={i} className="block">
              <span className="text-xs text-muted">
                {ko ? "섹션 버튼" : "Section button"}:{" "}
                {"title" in s && s.title ? s.title : s.type}
              </span>
              <input
                type="text"
                defaultValue={(s as { ctaHref?: string }).ctaHref ?? ""}
                placeholder="https://… / tel:… / #contact"
                onBlur={(e) => onEdit(`sections.${i}.ctaHref`, e.target.value.trim())}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          ) : null,
        )}
      </div>

      {/* 메인 섹션 배치/순서 — 히어로와 푸터 사이 블록을 원하는 순서로 바꾸고 숨길 수 있다. */}
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="eyebrow mr-1">{ko ? "섹션 배치" : "Section order"}</span>
          <span className="text-xs text-muted">
            {ko
              ? "메인 화면의 섹션 순서를 바꾸거나 숨겨요. (상단 히어로·하단 푸터는 고정)"
              : "Reorder or hide the main-page sections. (Top hero and bottom footer are fixed.)"}
          </span>
        </div>
        <ul className="divide-y divide-border">
          {sectionOrder.map((key, i) => {
            const hiddenHere = hiddenSet.has(key);
            const label = SECTION_LABELS[key];
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-2 py-2",
                  hiddenHere && "opacity-50",
                )}
              >
                <span className="w-5 text-center text-xs text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {ko ? label.ko : label.en}
                </span>
                <button
                  type="button"
                  onClick={() => moveSection(i, -1)}
                  disabled={i === 0}
                  className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
                  title={ko ? "위로" : "Move up"}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(i, 1)}
                  disabled={i === sectionOrder.length - 1}
                  className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
                  title={ko ? "아래로" : "Move down"}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    hiddenHere
                      ? "border-border text-muted hover:text-foreground"
                      : "border-primary/40 text-primary hover:bg-primary-soft",
                  )}
                >
                  {hiddenHere
                    ? ko
                      ? "숨김"
                      : "Hidden"
                    : ko
                      ? "표시"
                      : "Shown"}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          {ko
            ? "내용이 없는 섹션(예: 갤러리 사진 미등록)은 '표시'여도 공개 사이트에는 자동으로 나타나지 않아요. 변경 후 저장을 눌러주세요."
            : "Empty sections (e.g. no gallery photos) won’t appear on the live site even when set to Shown. Press Save to apply."}
        </p>
      </div>

      {/* 섹션 추가 — 가격표·후기·FAQ를 메인에 추가(추가 후 미리보기에서 글자를 눌러 편집) */}
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="eyebrow mr-1">{ko ? "섹션 추가" : "Add section"}</span>
          <span className="text-xs text-muted">
            {ko
              ? "가격표·후기·자주 묻는 질문(FAQ)을 메인에 추가해요. 추가하면 아래 미리보기에 바로 나타나고, 글자를 눌러 내용을 바꿀 수 있어요."
              : "Add a pricing, testimonials, or FAQ section. It appears in the preview below — click any text to edit."}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["hero", ko ? "히어로" : "Hero"],
              ["pricing", ko ? "가격표" : "Pricing"],
              ["testimonials", ko ? "후기" : "Testimonials"],
              ["faq", "FAQ"],
              ["stats", ko ? "통계" : "Stats"],
              ["cta", ko ? "CTA(행동 유도)" : "CTA"],
              ["postList", ko ? "블로그 글목록" : "Blog list"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => addHomeSection(t)}
              className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/50 hover:bg-primary-soft hover:text-primary"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      {/* 배너 관리 — 랜딩/블로그에 노출할 이미지 배너(문구·버튼·AI 이미지·사이즈). */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="eyebrow mr-1">{ko ? "배너" : "Banners"}</span>
            <span className="text-xs text-muted">
              {ko
                ? "랜딩페이지·블로그에 이미지 배너를 추가해요. 이미지 업로드 또는 AI 생성(원하는 내용 입력), 문구·버튼·사이즈·노출 위치를 설정할 수 있어요. 랜딩 배너의 순서는 위 ‘섹션 배치’에서 조정."
                : "Add image banners to your landing page and blog. Upload or generate with AI, set text, button, size, and placement."}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={addBanner}>
            + {ko ? "배너 추가" : "Add banner"}
          </Button>
        </div>
        {banners.length > 0 && (
          <div className="space-y-4">
            {banners.map((b) => (
              <BannerEditor
                key={b.id}
                banner={b}
                businessId={businessId}
                onChange={(next) => updateBanner(b.id, next)}
                onRemove={() => removeBanner(b.id)}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted">
          {ko
            ? "변경 후 상단 ‘저장’을 눌러야 반영됩니다. (게시된 사이트는 저장 즉시 공개)"
            : "Press Save at the top to apply. (Published sites go live on save.)"}
        </p>
      </div>

      {note && <p className="text-sm text-primary">{note}</p>}
      <p className="text-xs text-muted">
        {ko
          ? "아래 미리보기에서 텍스트를 클릭하면 바로 수정할 수 있어요. 텍스트를 드래그로 선택하면 굵게·색상·형광펜 같은 서식 도구가 나타납니다. 수정 후 저장을 눌러주세요."
          : "Click any text in the preview below to edit it in place. Select text to reveal formatting tools (bold, color, highlight). Press Save when you are done."}
      </p>

      {/* 페이지 관리 (멀티페이지) */}
      {(richAllowed || pages.length > 0) && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1">{ko ? "페이지" : "Pages"}</span>
            <button
              type="button"
              onClick={() => setCurrentPage("home")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                currentPage === "home"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {ko ? "홈" : "Home"}
            </button>
            {pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrentPage(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  currentPage === i
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {p.navLabel || p.slug}
              </button>
            ))}
            {richAllowed && (
              <button
                type="button"
                onClick={addPage}
                className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
              >
                + {ko ? "페이지 추가" : "Add page"}
              </button>
            )}
          </div>

          {typeof currentPage === "number" && pages[currentPage] && (
            <>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
              <input
                value={pages[currentPage].navLabel}
                onChange={(e) =>
                  updatePage(currentPage, { navLabel: e.target.value })
                }
                placeholder={ko ? "메뉴 이름" : "Menu label"}
                className="w-28 rounded-md border border-border px-2 py-1"
              />
              <span className="text-muted">/</span>
              <input
                defaultValue={pages[currentPage].slug}
                onBlur={(e) =>
                  updatePage(currentPage, {
                    slug: slugify(e.target.value) || `page-${currentPage + 1}`,
                  })
                }
                placeholder="slug"
                className="w-28 rounded-md border border-border px-2 py-1"
              />
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={pages[currentPage].showInNav}
                  onChange={(e) =>
                    updatePage(currentPage, { showInNav: e.target.checked })
                  }
                  className="size-3.5 accent-primary"
                />
                {ko ? "메뉴 표시" : "In menu"}
              </label>
              <button
                type="button"
                onClick={() => movePage(currentPage, -1)}
                className="rounded-md border border-border px-2 py-1"
                title={ko ? "앞으로" : "Move up"}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => movePage(currentPage, 1)}
                className="rounded-md border border-border px-2 py-1"
                title={ko ? "뒤로" : "Move down"}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => addTextSection(currentPage)}
                className="rounded-md border border-border px-2 py-1 font-medium text-primary"
              >
                + {ko ? "텍스트 섹션" : "Text section"}
              </button>
              <button
                type="button"
                onClick={() => addPostListSection(currentPage)}
                className="rounded-md border border-border px-2 py-1 font-medium text-primary"
              >
                + {ko ? "글 목록" : "Blog list"}
              </button>
              <button
                type="button"
                onClick={() => deletePage(currentPage)}
                className="ml-auto rounded-md border border-border px-2 py-1 text-danger"
              >
                {ko ? "페이지 삭제" : "Delete page"}
              </button>
            </div>
            <p className="pt-1 text-[11px] text-muted">
              {ko ? "공개 주소: " : "Public URL: "}
              <span className="font-mono">
                /site/{slug}/{pages[currentPage].slug}
              </span>
              {" · "}
              {status === "published"
                ? ko
                  ? "‘저장’을 누르면 바로 공개됩니다."
                  : "Press Save to publish this page."
                : ko
                  ? "‘저장’ 후 상단 ‘게시하기’를 눌러야 공개됩니다. (저장·게시 전에는 404)"
                  : "Save, then press Publish at the top to make it public."}
            </p>
            </>
          )}
        </div>
      )}

      {/* WYSIWYG canvas */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-muted/40 p-3">
        <div
          className={cn(
            "theme-editorial-light mx-auto overflow-hidden rounded-xl border border-border bg-white transition-all",
            device === "mobile" ? "max-w-[390px]" : "w-full",
          )}
          style={siteStyleVars(content.style)}
        >
          <div className="max-h-[72vh] overflow-y-auto">
            {typeof currentPage === "number" && pages[currentPage] ? (
              <div className="min-h-[300px]">
                <section className="border-b border-border bg-surface-muted/40">
                  <div className="mx-auto max-w-3xl px-5 py-16 text-center">
                    {editRenderer({
                      path: `pages.${currentPage}.hero.headline`,
                      value: pages[currentPage].hero?.headline ?? "",
                      as: "h1",
                      className: "text-3xl font-semibold tracking-tight",
                      placeholder: ko ? "페이지 제목" : "Page title",
                    })}
                    {editRenderer({
                      path: `pages.${currentPage}.hero.shortDescription`,
                      value: pages[currentPage].hero?.shortDescription ?? "",
                      as: "p",
                      className: "mx-auto mt-3 max-w-xl text-muted",
                      placeholder: ko ? "페이지 설명 (선택)" : "Page description (optional)",
                    })}
                  </div>
                </section>
                <SiteSections
                  sections={pages[currentPage].sections}
                  T={editRenderer}
                  Img={editImgRenderer}
                  pathPrefix={`pages.${currentPage}.`}
                  editable
                  onDelete={(i) => removePageSection(currentPage, i)}
                  posts={posts}
                  blogHref={`/site/${slug}/blog`}
                  lang={content.language === "en" ? "en" : "ko"}
                  categories={categories}
                />
              </div>
            ) : (
              <TemplateRenderer
                content={content}
                T={editRenderer}
                Img={editImgRenderer}
                Gallery={editGallery}
                cards={cards}
                editable
                scoped
                onDeleteSection={removeHomeSection}
              />
            )}
          </div>
        </div>
      </div>

      {/* 텍스트 선택 시 나타나는 위지윅 서식 툴바 */}
      <RichTextToolbar />
    </div>
  );
}
