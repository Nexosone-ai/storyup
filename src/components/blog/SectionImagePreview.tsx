"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { preprocessMarkdown } from "@/utils/markdown";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

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
}: {
  content: string;
  onChange: (next: string) => void;
  businessId: string;
  postId: string;
  ko: boolean;
}) {
  const { introMd, sections } = useMemo(
    () => parseSections(content),
    [content],
  );
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [errIdx, setErrIdx] = useState<{ idx: number; msg: string } | null>(
    null,
  );

  const generate = async (s: Section) => {
    if (busyIdx !== null) return;
    setBusyIdx(s.headingIdx);
    setErrIdx(null);
    try {
      const res = await fetch("/api/ai/blog-body-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          postId,
          paragraph: `${s.heading}\n${s.bodyMd.slice(0, 400)}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setErrIdx({
          idx: s.headingIdx,
          msg: json.error ?? (ko ? "이미지 생성에 실패했어요." : "Failed."),
        });
        return;
      }
      const lines = content.split("\n");
      if (s.imageIdx != null) {
        lines[s.imageIdx] = `![${ko ? "섹션 이미지" : "section image"}](${json.url})`;
      } else {
        lines.splice(
          s.headingIdx + 1,
          0,
          "",
          `![${ko ? "섹션 이미지" : "section image"}](${json.url})`,
        );
      }
      onChange(lines.join("\n"));
    } catch {
      setErrIdx({
        idx: s.headingIdx,
        msg: ko
          ? "이미지 생성에 실패했어요. 다시 시도해주세요."
          : "Failed. Please try again.",
      });
    } finally {
      setBusyIdx(null);
    }
  };

  const removeImage = (s: Section) => {
    if (s.imageIdx == null) return;
    const lines = content.split("\n");
    lines.splice(s.imageIdx, 1);
    onChange(lines.join("\n"));
  };

  const box = (s: Section) => {
    const busy = busyIdx === s.headingIdx;
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
              disabled={busyIdx !== null}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {busy ? (
                <Spinner className="size-3.5" />
              ) : (
                <Icon.sparkles width={14} height={14} />
              )}
              {ko ? "다시 생성" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => removeImage(s)}
              disabled={busyIdx !== null}
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
          disabled={busyIdx !== null}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 px-4 py-6 text-sm font-medium text-primary transition-colors hover:bg-primary-soft/60 disabled:opacity-60"
        >
          {busy ? (
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

  return (
    <div className="min-h-[420px] space-y-4 p-5">
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
