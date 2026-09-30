"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  generateBlogFaqAction,
  clearBlogFaqAction,
} from "@/app/business/faq-actions";
import type { BlogFaqItem } from "@/types/domain";

/**
 * 블로그 글 편집 화면의 "AEO FAQ" 섹션 (Pro 전용).
 * 본문에서 답변엔진용 Q&A를 생성해 공개 글에 FAQPage 구조화 데이터로 노출한다.
 */
export function BlogFaqEditor({
  businessId,
  postId,
  initialFaq,
  aeoAllowed,
}: {
  businessId: string;
  postId: string;
  initialFaq: BlogFaqItem[];
  aeoAllowed: boolean;
}) {
  const ko = useLocale() === "ko";
  const [faq, setFaq] = useState<BlogFaqItem[]>(initialFaq);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, start] = useTransition();

  const generate = () =>
    start(async () => {
      setNote(null);
      const res = await generateBlogFaqAction(businessId, postId);
      if (res.error) setNote({ text: res.error, error: true });
      else {
        setFaq(res.faq ?? []);
        setNote({
          text: ko ? "FAQ가 생성됐어요." : "FAQ generated.",
          error: false,
        });
      }
    });

  const clear = () =>
    start(async () => {
      setNote(null);
      const res = await clearBlogFaqAction(businessId, postId);
      if (res.error) setNote({ text: res.error, error: true });
      else setFaq([]);
    });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              💬 {ko ? "AEO FAQ" : "AEO FAQ"}
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                Pro
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {ko
                ? "본문에서 질문·답변을 만들어 공개 글 하단에 FAQ로 보여주고, 구글 AI Overviews·ChatGPT 같은 답변엔진이 인용하기 쉽게 FAQPage 구조화 데이터를 심어요."
                : "Builds Q&A from your post and adds FAQPage structured data for AI answer engines."}
            </p>
          </div>
          {aeoAllowed && (
            <div className="flex shrink-0 gap-2">
              {faq.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  disabled={busy}
                >
                  {ko ? "지우기" : "Clear"}
                </Button>
              )}
              <Button size="sm" onClick={generate} disabled={busy}>
                {busy ? (
                  <Spinner className="h-4 w-4" />
                ) : faq.length > 0 ? (
                  ko ? "다시 생성" : "Regenerate"
                ) : ko ? (
                  "FAQ 생성"
                ) : (
                  "Generate"
                )}
              </Button>
            </div>
          )}
        </div>

        {!aeoAllowed ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-muted p-4">
            <span aria-hidden className="mt-0.5">
              🔒
            </span>
            <p className="text-xs leading-relaxed text-muted">
              {ko
                ? "AEO FAQ는 Pro 플랜 전용이에요. 업그레이드하면 답변엔진 최적화 FAQ를 자동 생성할 수 있어요."
                : "AEO FAQ is a Pro feature."}{" "}
              <a
                href="/dashboard/plans"
                className="font-semibold text-primary underline"
              >
                {ko ? "플랜 업그레이드 →" : "Upgrade →"}
              </a>
            </p>
          </div>
        ) : (
          <>
            {note && (
              <p
                className={`mt-3 text-sm ${note.error ? "text-danger" : "text-primary"}`}
              >
                {note.text}
              </p>
            )}
            {faq.length === 0 ? (
              <p className="mt-4 rounded-lg bg-surface-muted px-3 py-6 text-center text-xs text-muted">
                {ko
                  ? "아직 FAQ가 없어요. 'FAQ 생성'을 눌러 본문에서 자동으로 만들어보세요."
                  : "No FAQ yet. Click Generate."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {faq.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border bg-white p-4"
                  >
                    <p className="text-sm font-semibold">Q. {f.q}</p>
                    <p className="mt-1 text-sm text-muted">A. {f.a}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
