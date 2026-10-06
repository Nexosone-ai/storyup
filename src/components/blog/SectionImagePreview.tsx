"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { preprocessMarkdown } from "@/utils/markdown";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import {
  IMAGE_STYLES,
  IMAGE_STYLE_META,
  type ImageStyleId,
} from "@/lib/ai/image/style";

/** 한 번에 자동 생성하는 섹션 이미지 최대 개수. */
const BATCH_MAX = 5;

marked.setOptions({ gfm: true, breaks: true });

/**
 * 미리보기 + 소제목별 이미지 생성.
 * 본문을 소제목(## )으로 나눠 렌더하고, 각 소제목 바로 밑에 이미지 생성 박스를 둔다.
 * 생성하면 그 소제목 아래에 이미지가 삽입되고, 생성하지 않으면 이미지 없이 그대로 나간다.
 */

interface Section {
  heading: string;
  headingIdx: number;
  imageIdx: number | null;
  imageUrl: string | null;
  bodyMd: string;
}

const IMG_RE = /^!\[[^\]]*\]\(([^)]+)\)\s*$/;

function parseSections(content: string): {
  introMd: string;
  sections: Section[];
} {
  const lines = content.split("\n");
  const isH2 = (l: string) => /^##\s+/.test(l);

  const introLines: string[] = [];
  const sections: Section[] = [];
  let cur: {
    heading: string;
    headingIdx: number;
    body: { idx: number; line: string }[];
  } | null = null;

  const finalize = (c: NonNullable<typeof cur>): Section => {
    let imageIdx: number | null = null;
    let imageUrl: string | null = null;
    const bodyForRender: string[] = [];
    let decided = false; // 소제목 바로 뒤 첫 콘텐츠 줄로 이미지 여부를 판정
    for (const { idx, line } of c.body) {
      if (!decided) {
        if (line.trim() === "") continue; // 선행 빈 줄 스킵
        const m = IMG_RE.exec(line.trim());
        decided = true;
        if (m) {
          imageIdx = idx;
          imageUrl = m[1];
          continue; // 이미지는 박스로 관리 → 본문 렌더에서 제외
        }
        bodyForRender.push(line);
        continue;
      }
      bodyForRender.push(line);
    }
    return {
      heading: c.heading,
      headingIdx: c.headingIdx,
      imageIdx,
      imageUrl,
      bodyMd: bodyForRender.join("\n").trim(),
    };
  };

  lines.forEach((line, idx) => {
    if (isH2(line)) {
      if (cur) sections.push(finalize(cur));
      cur = { heading: line.replace(/^##\s+/, "").trim(), headingIdx: idx, body: [] };
    } else if (cur) {
      cur.body.push({ idx, line });
    } else {
      introLines.push(line);
    }
  });
  if (cur) sections.push(finalize(cur));

  return { introMd: introLines.join("\n").trim(), sections };
}

const html = (md: string) => marked.parse(preprocessMarkdown(md)) as string;

export function SectionImagePreview({
  content,
  onChange,
  businessId,
  postId,
  ko,
  style,
  onStyleChange,
}: {
  content: string;
  onChange: (next: string) => void;
  businessId: string;
  postId: string;
  ko: boolean;
  style: ImageStyleId;
  onStyleChange: (s: ImageStyleId) => void;
}) {
  const { introMd, sections } = useMemo(
    () => parseSections(content),
    [content],
  );
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [errIdx, setErrIdx] = useState<{ idx: number; msg: string } | null>(
    null,
  );
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchNote, setBatchNote] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const imgAlt = ko ? "섹션 이미지" : "section image";
  const busy = batchBusy || busyIdx !== null;

  /** 한 섹션 이미지를 생성해 URL을 받는다(상태 변경 없음 — 호출부가 content에 반영). */
  const requestImage = async (
    s: Section,
  ): Promise<{ url: string } | { error: string }> => {
    try {
      const res = await fetch("/api/ai/blog-body-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          postId,
          paragraph: `${s.heading}\n${s.bodyMd.slice(0, 400)}`,
          slotKey: `body:${s.headingIdx}`,
          style,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url)
        return { error: json.error ?? (ko ? "이미지 생성에 실패했어요." : "Failed.") };
      return { url: json.url as string };
    } catch {
      return {
        error: ko
          ? "이미지 생성에 실패했어요. 다시 시도해주세요."
          : "Failed. Please try again.",
      };
    }
  };

  const generate = async (s: Section) => {
    if (busy) return;
    setBusyIdx(s.headingIdx);
    setErrIdx(null);
    const r = await requestImage(s);
    if ("error" in r) {
      setErrIdx({ idx: s.headingIdx, msg: r.error });
      setBusyIdx(null);
      return;
    }
    const lines = content.split("\n");
    if (s.imageIdx != null) {
      lines[s.imageIdx] = `![${imgAlt}](${r.url})`;
    } else {
      lines.splice(s.headingIdx + 1, 0, "", `![${imgAlt}](${r.url})`);
    }
    onChange(lines.join("\n"));
    setBusyIdx(null);
  };

  /**
   * 이미지가 없는 섹션을 최대 5개까지 한 번에(병렬) 생성한다.
   * 모든 요청이 끝난 뒤 content를 한 번만 재구성한다 — 각 삽입이 뒤 줄 인덱스를
   * 밀어 경합하지 않도록, headingIdx 내림차순으로 아래쪽부터 끼워넣는다.
   */
  const batchGenerate = async () => {
    if (busy) return;
    const targets = sections.filter((s) => !s.imageUrl).slice(0, BATCH_MAX);
    if (targets.length === 0) {
      setBatchNote({
        text: ko
          ? "이미지를 넣을 소제목이 없어요. 소제목(## )을 추가해 주세요."
          : "No sections without an image. Add ‘## ’ subheadings.",
        error: true,
      });
      return;
    }
    setBatchBusy(true);
    setErrIdx(null);
    setBatchNote(null);
    const results = await Promise.all(
      targets.map(async (s) => ({
        headingIdx: s.headingIdx,
        r: await requestImage(s),
      })),
    );
    const ok = results.filter(
      (x): x is { headingIdx: number; r: { url: string } } => "url" in x.r,
    );
    if (ok.length > 0) {
      const lines = content.split("\n");
      ok.sort((a, b) => b.headingIdx - a.headingIdx).forEach(({ headingIdx, r }) => {
        lines.splice(headingIdx + 1, 0, "", `![${imgAlt}](${r.url})`);
      });
      onChange(lines.join("\n"));
    }
    const fail = results.length - ok.length;
    setBatchNote({
      text: ko
        ? `이미지 ${ok.length}장 생성 완료${fail ? `, ${fail}장 실패` : ""}.`
        : `${ok.length} image(s) created${fail ? `, ${fail} failed` : ""}.`,
      error: ok.length === 0,
    });
    setBatchBusy(false);
  };

  const removeImage = (s: Section) => {
    if (s.imageIdx == null) return;
    const lines = content.split("\n");
    lines.splice(s.imageIdx, 1);
    onChange(lines.join("\n"));
  };

  const box = (s: Section) => {
    const thisBusy = busyIdx === s.headingIdx;
    if (s.imageUrl) {
      return (
        <figure className="my-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- 생성 이미지 미리보기 */}
          <img
            src={s.imageUrl}
            alt={s.heading}
            className="aspect-[4/3] w-full rounded-xl object-cover"
          />
          <figcaption className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => generate(s)}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {thisBusy ? (
                <Spinner className="size-3.5" />
              ) : (
                <Icon.sparkles width={14} height={14} />
              )}
              {ko ? "다시 생성" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => removeImage(s)}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-danger disabled:opacity-50"
            >
              {ko ? "이미지 제거" : "Remove"}
            </button>
          </figcaption>
        </figure>
      );
    }
    return (
      <div className="my-3">
        <button
          type="button"
          onClick={() => generate(s)}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 px-4 py-6 text-sm font-medium text-primary transition-colors hover:bg-primary-soft/60 disabled:opacity-60"
        >
          {thisBusy ? (
            <>
              <Spinner className="size-5" />
              {ko ? "이미지를 생성하고 있어요..." : "Generating an image..."}
            </>
          ) : (
            <>
              <Icon.sparkles width={20} height={20} />
              {ko ? "이 소제목 이미지 생성" : "Generate an image for this section"}
            </>
          )}
        </button>
        <p className="mt-1 text-center text-xs text-muted">
          {ko
            ? "생성하지 않으면 이미지 없이 그대로 발행돼요."
            : "Skip it and the post publishes without an image here."}
        </p>
      </div>
    );
  };

  const imagelessCount = sections.filter((s) => !s.imageUrl).length;

  return (
    <div className="min-h-[420px] space-y-4 p-5">
      {/* 스타일 선택 + 섹션 이미지 일괄 생성 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-muted/60 p-3">
        <span className="eyebrow mr-1">
          {ko ? "이미지 스타일" : "Image style"}
        </span>
        <Select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as ImageStyleId)}
          disabled={busy}
          className="h-9 w-36"
        >
          {IMAGE_STYLES.map((id) => (
            <option key={id} value={id}>
              {ko ? IMAGE_STYLE_META[id].ko : IMAGE_STYLE_META[id].en}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={batchGenerate}
          disabled={busy || sections.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {batchBusy ? (
            <Spinner className="size-4" />
          ) : (
            <Icon.sparkles width={16} height={16} />
          )}
          {batchBusy
            ? ko
              ? "생성 중..."
              : "Generating..."
            : ko
              ? `이미지 ${Math.min(imagelessCount, BATCH_MAX)}장 자동 생성`
              : `Auto-generate ${Math.min(imagelessCount, BATCH_MAX)} images`}
        </button>
        <p className="w-full text-xs text-muted">
          {ko
            ? `선택한 스타일로 이미지 없는 소제목에 최대 ${BATCH_MAX}장을 한 번에 생성해요. 커버·개별 생성에도 같은 스타일이 적용됩니다.`
            : `Generates up to ${BATCH_MAX} images at once for subheadings without one, in the selected style (also used for the cover and per-section generation).`}
        </p>
        {batchNote && (
          <p
            className={`w-full text-sm font-medium ${batchNote.error ? "text-danger" : "text-primary"}`}
          >
            {batchNote.text}
          </p>
        )}
      </div>

      {introMd && (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: html(introMd) }}
        />
      )}

      {sections.length === 0 && !introMd && (
        <p className="py-10 text-center text-sm text-muted">
          {ko ? "내용을 입력하세요." : "Write something first."}
        </p>
      )}

      {sections.length === 0 && introMd && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-center text-xs text-muted">
          {ko
            ? "소제목(## )을 넣으면 소제목마다 이미지를 생성할 수 있어요."
            : "Add ‘## ’ subheadings to generate an image per section."}
        </p>
      )}

      {sections.map((s) => (
        <section key={s.headingIdx}>
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: html(`## ${s.heading}`) }}
          />
          {box(s)}
          {errIdx?.idx === s.headingIdx && (
            <p className="mb-2 text-sm text-danger">{errIdx.msg}</p>
          )}
          {s.bodyMd && (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: html(s.bodyMd) }}
            />
          )}
        </section>
      ))}
    </div>
  );
}
