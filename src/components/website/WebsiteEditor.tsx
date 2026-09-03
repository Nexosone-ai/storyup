"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import { TemplateRenderer, TEMPLATE_META, setPath } from "./templates";
import { makeEditableRenderer } from "./templates/EditableText";
import { makeEditableImageRenderer } from "./templates/ImageSlot";
import { makeEditableGallery } from "./templates/GallerySection";
import {
  saveWebsiteAction,
  publishWebsiteAction,
  updateSiteSlugAction,
} from "@/app/business/actions";
import { MapImportBar } from "./MapImportBar";
import { PdfImportBar } from "./PdfImportBar";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { PlaceImportData } from "@/lib/placeImport";
import type { PdfImportData } from "@/lib/pdfImport";
import { SITE_FONTS, SITE_PALETTES, siteStyleVars } from "./siteStyle";
import type {
  WebsiteContent,
  WebsiteFontId,
  WebsitePaletteId,
  WebsiteTemplateId,
} from "@/types/domain";
import type { WebsiteRow } from "@/types/database";

type Device = "desktop" | "mobile";

export function WebsiteEditor({
  businessId,
  website,
}: {
  businessId: string;
  website: WebsiteRow;
}) {
  const ko = useLocale() === "ko";
  const [content, setContent] = useState<WebsiteContent>(website.content);
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

  const template = content.template ?? "classic";

  const onEdit = useCallback((path: string, value: string) => {
    setContent((c) => setPath(c, path, value));
  }, []);

  const editRenderer = useMemo(() => makeEditableRenderer(onEdit), [onEdit]);
  // AI 이미지 생성 시 슬롯 위치(path)에 맞는 피사체 설명을 프롬프트로 전달
  const subjectFor = useCallback(
    (path: string): string => {
      if (path === "hero.image")
        return `${content.hero.businessName}, ${content.hero.headline}`;
      const m = path.match(/^(offers|whyChooseUs)\.items\.(\d+)\.image$/);
      if (m) {
        const section = m[1] as "offers" | "whyChooseUs";
        const item = content[section]?.items?.[Number(m[2])];
        return item?.title || content.hero.businessName;
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

  const palette = content.style?.palette ?? "forest";
  const font = content.style?.font ?? "default";

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

      {/* Google Maps import */}
      <MapImportBar businessId={businessId} onImport={applyGoogleImport} />

      {/* PDF import */}
      <PdfImportBar businessId={businessId} onImport={applyPdfImport} />

      {/* Template picker + device toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">{ko ? "템플릿" : "Template"}</span>
          {TEMPLATE_META.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              title={ko ? t.description : t.descriptionEn}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                template === t.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border-strong text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {ko ? t.name : t.nameEn}
            </button>
          ))}
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

      {note && <p className="text-sm text-primary">{note}</p>}
      <p className="text-xs text-muted">
        {ko
          ? "아래 미리보기에서 텍스트를 클릭하면 바로 수정할 수 있어요. 수정 후 저장을 눌러주세요."
          : "Click any text in the preview below to edit it in place. Press Save when you are done."}
      </p>

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
            <TemplateRenderer
              content={content}
              T={editRenderer}
              Img={editImgRenderer}
              Gallery={editGallery}
              editable
              scoped
            />
          </div>
        </div>
      </div>
    </div>
  );
}
