"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import { TemplateRenderer, TEMPLATE_META, setPath } from "./templates";
import { makeEditableRenderer } from "./templates/EditableText";
import { makeEditableImageRenderer } from "./templates/ImageSlot";
import { makeEditableGallery } from "./templates/GallerySection";
import { saveWebsiteAction, publishWebsiteAction } from "@/app/business/actions";
import type { WebsiteContent, WebsiteTemplateId } from "@/types/domain";
import type { WebsiteRow } from "@/types/database";

type Device = "desktop" | "mobile";

export function WebsiteEditor({
  businessId,
  website,
}: {
  businessId: string;
  website: WebsiteRow;
}) {
  const [content, setContent] = useState<WebsiteContent>(website.content);
  const [status, setStatus] = useState(website.status);
  const [device, setDevice] = useState<Device>("desktop");
  const [note, setNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();

  const template = content.template ?? "classic";

  const onEdit = useCallback((path: string, value: string) => {
    setContent((c) => setPath(c, path, value));
  }, []);

  const editRenderer = useMemo(() => makeEditableRenderer(onEdit), [onEdit]);
  const editImgRenderer = useMemo(
    () => makeEditableImageRenderer(businessId, onEdit),
    [businessId, onEdit],
  );
  const editGallery = useMemo(
    () =>
      makeEditableGallery(businessId, (next) =>
        setContent((c) => ({ ...c, gallery: next })),
      ),
    [businessId],
  );

  const setTemplate = (id: WebsiteTemplateId) =>
    setContent((c) => ({ ...c, template: id }));

  const save = () =>
    startSave(async () => {
      setNote(null);
      const res = await saveWebsiteAction(businessId, content);
      setNote(res.error ?? "저장되었습니다.");
    });

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
          <h1 className="text-2xl font-semibold tracking-tight">홈페이지 편집</h1>
          {status === "published" ? (
            <Badge tone="success">공개됨</Badge>
          ) : (
            <Badge tone="muted">초안</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "published" && (
            <ButtonLink href={`/site/${website.slug}`} variant="outline" size="sm">
              <Icon.external width={16} height={16} />
              사이트 열기
            </ButtonLink>
          )}
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : "저장"}
          </Button>
          <Button size="sm" onClick={togglePublish} disabled={publishing}>
            {publishing ? (
              <Spinner className="size-4" />
            ) : status === "published" ? (
              "비공개로 전환"
            ) : (
              "게시하기"
            )}
          </Button>
        </div>
      </div>

      {/* Template picker + device toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">템플릿</span>
          {TEMPLATE_META.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              title={t.description}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                template === t.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border-strong text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {t.name}
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
              {d === "desktop" ? "데스크톱" : "모바일"}
            </button>
          ))}
        </div>
      </div>

      {note && <p className="text-sm text-primary">{note}</p>}
      <p className="text-xs text-muted">
        아래 미리보기에서 텍스트를 클릭하면 바로 수정할 수 있어요. 수정 후 저장을 눌러주세요.
      </p>

      {/* WYSIWYG canvas */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-muted/40 p-3">
        <div
          className={cn(
            "theme-editorial-light mx-auto overflow-hidden rounded-xl border border-border bg-white transition-all",
            device === "mobile" ? "max-w-[390px]" : "w-full",
          )}
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
