"use client";

import { useState, useTransition } from "react";
import { createInquiryAction } from "@/app/site/inquiry-actions";

/**
 * 공개 랜딩페이지 Contact 섹션의 "문의하기" 폼.
 * - slug가 있으면(공개 사이트) 실제로 접수되고, 없으면(에디터 미리보기) 비활성 미리보기.
 * - 접수되면 사이트 주인(사장님) 대시보드의 "문의" 목록에 이름·연락처·내용이 쌓인다.
 */
export function InquiryForm({
  slug,
  lang,
}: {
  slug?: string;
  lang: "ko" | "en";
}) {
  const ko = lang === "ko";
  const preview = !slug; // 에디터 미리보기(슬러그 없음)에선 전송하지 않는다.
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [kakao, setKakao] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const inputCls =
    "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none";

  const submit = () => {
    if (preview) return;
    start(async () => {
      setError(null);
      const res = await createInquiryAction(
        slug!,
        { name, contact, kakao, message },
        lang,
      );
      if (res.error) setError(res.error);
      else {
        setDone(true);
        setName("");
        setContact("");
        setKakao("");
        setMessage("");
      }
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-white p-8 text-center">
        <p className="text-lg font-semibold">
          {ko ? "문의가 접수되었어요" : "Your inquiry was sent"}
        </p>
        <p className="mt-1.5 text-sm text-muted">
          {ko
            ? "빠른 시일 내에 남겨주신 연락처로 답변드릴게요."
            : "We'll get back to you at the contact you provided soon."}
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-5 text-sm font-medium text-primary hover:underline"
        >
          {ko ? "다시 문의하기" : "Send another"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-2.5 rounded-2xl border border-border bg-white p-5 text-left">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={ko ? "이름" : "Name"}
          maxLength={60}
          disabled={preview}
          className={inputCls}
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={ko ? "연락처 (전화·이메일)" : "Contact (phone or email)"}
          maxLength={120}
          disabled={preview}
          className={inputCls}
        />
      </div>
      <input
        value={kakao}
        onChange={(e) => setKakao(e.target.value)}
        placeholder={
          ko ? "카카오톡 아이디 (선택)" : "KakaoTalk ID (optional)"
        }
        maxLength={120}
        disabled={preview}
        className={inputCls}
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          ko ? "문의하실 내용을 남겨주세요." : "Write your inquiry here."
        }
        maxLength={2000}
        disabled={preview}
        className={`${inputCls} min-h-28 resize-y`}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {preview
            ? ko
              ? "공개 후 방문자가 문의할 수 있어요"
              : "Visitors can inquire once published"
            : ko
              ? "남겨주신 정보는 사장님에게만 전달돼요"
              : "Your info is sent only to the owner"}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={preview || pending || !name.trim() || !contact.trim() || !message.trim()}
          className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xs disabled:opacity-50"
        >
          {pending
            ? ko
              ? "전송 중..."
              : "Sending..."
            : ko
              ? "문의 보내기"
              : "Send inquiry"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
