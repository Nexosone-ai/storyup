"use client";

import { useState, useTransition } from "react";
import { Card, Badge } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { updateBrandAction, type BrandEditFields } from "@/app/business/actions";
import type { BrandProfileRow } from "@/types/database";

export function BrandStoryView({
  businessId,
  brand,
  websiteExists,
}: {
  businessId: string;
  brand: BrandProfileRow;
  websiteExists: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const [form, setForm] = useState<BrandEditFields>({
    brand_name: brand.brand_name ?? "",
    headline: brand.headline ?? "",
    slogan: brand.slogan ?? "",
    short_description: brand.short_description ?? "",
    brand_story: brand.brand_story ?? "",
    mission: brand.mission ?? "",
    key_strengths: brand.key_strengths ?? [],
    brand_keywords: brand.brand_keywords ?? [],
  });

  const set = <K extends keyof BrandEditFields>(
    k: K,
    v: BrandEditFields[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setNote(null);
    startTransition(async () => {
      const res = await updateBrandAction(businessId, form);
      if (res.error) setNote(res.error);
      else {
        setEditing(false);
        setNote("저장되었습니다.");
      }
    });
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">브랜드 스토리 편집</h1>
        <Card className="space-y-4">
          <Editable label="브랜드 이름">
            <Input
              value={form.brand_name}
              onChange={(e) => set("brand_name", e.target.value)}
            />
          </Editable>
          <Editable label="헤드라인">
            <Input
              value={form.headline}
              onChange={(e) => set("headline", e.target.value)}
            />
          </Editable>
          <Editable label="슬로건">
            <Input
              value={form.slogan}
              onChange={(e) => set("slogan", e.target.value)}
            />
          </Editable>
          <Editable label="한 줄 소개">
            <Textarea
              className="min-h-20"
              value={form.short_description}
              onChange={(e) => set("short_description", e.target.value)}
            />
          </Editable>
          <Editable label="브랜드 스토리">
            <Textarea
              className="min-h-48"
              value={form.brand_story}
              onChange={(e) => set("brand_story", e.target.value)}
            />
          </Editable>
          <Editable label="미션">
            <Textarea
              className="min-h-20"
              value={form.mission}
              onChange={(e) => set("mission", e.target.value)}
            />
          </Editable>
          <Editable label="핵심 강점 (쉼표로 구분)">
            <Input
              value={form.key_strengths.join(", ")}
              onChange={(e) =>
                set(
                  "key_strengths",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                )
              }
            />
          </Editable>
          <Editable label="브랜드 키워드 (쉼표로 구분)">
            <Input
              value={form.brand_keywords.join(", ")}
              onChange={(e) =>
                set(
                  "brand_keywords",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                )
              }
            />
          </Editable>
        </Card>
        {note && <p className="text-sm text-muted">{note}</p>}
        <div className="flex gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? <Spinner /> : "저장"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <Badge tone="primary">브랜드 완성</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Your Brand Story is Ready
        </h1>
        <p className="mt-2 text-muted">
          AI가 당신의 이야기를 바탕으로 브랜드를 만들었어요. 자유롭게 다듬어보세요.
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Icon.pen width={16} height={16} />
          편집
        </Button>
      </div>

      <Card className="space-y-6">
        <Section label="Brand Name">
          <p className="text-xl font-bold">{brand.brand_name}</p>
        </Section>
        <Section label="Headline">
          <p className="text-lg font-medium">{brand.headline}</p>
        </Section>
        <Section label="Slogan">
          <p className="text-lg italic text-primary">“{brand.slogan}”</p>
        </Section>
        <Section label="Brand Story">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            {brand.brand_story}
          </p>
        </Section>
        <Section label="Mission">
          <p className="leading-relaxed text-foreground/90">{brand.mission}</p>
        </Section>
        <Section label="Brand Keywords">
          <div className="flex flex-wrap gap-2">
            {brand.brand_keywords.map((k) => (
              <Badge key={k}>{k}</Badge>
            ))}
          </div>
        </Section>
      </Card>

      {note && <p className="text-center text-sm text-green-600">{note}</p>}

      <div className="flex justify-center pt-2">
        <ButtonLink href={`/business/${businessId}/website`} size="lg">
          <Icon.globe width={18} height={18} />
          {websiteExists ? "홈페이지 보기" : "홈페이지 만들기"}
        </ButtonLink>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-5 last:border-0 last:pb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function Editable({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
