"use client";

import { useState, useTransition } from "react";
import {
  claimCouponAction,
  createEventInquiryAction,
} from "@/app/site/event-actions";
import type { PublicBlogEvent } from "@/lib/events";

/**
 * 공개 블로그 글 하단의 이벤트 모듈 (쿠폰 수령 + 연락문의).
 * 서버(getPublicBlogEvent)가 활성 모듈이 있을 때만 이 컴포넌트를 렌더한다.
 */
export function BlogEventModules({
  postId,
  event,
  lang,
}: {
  postId: string;
  event: PublicBlogEvent;
  lang: "ko" | "en";
}) {
  return (
    <section className="mt-10 space-y-4 border-t border-border pt-8">
      {event.couponEnabled && event.couponBenefit && (
        <CouponCard postId={postId} event={event} lang={lang} />
      )}
      {event.contactEnabled && <ContactCard postId={postId} lang={lang} />}
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none";

function fmtDate(d: string, ko: boolean): string {
  const [y, m, day] = d.split("-");
  return ko ? `${y}.${m}.${day}` : `${m}/${day}/${y}`;
}

function CouponCard({
  postId,
  event,
  lang,
}: {
  postId: string;
  event: PublicBlogEvent;
  lang: "ko" | "en";
}) {
  const ko = lang === "ko";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const notYet = !!event.couponIssuedOn && today < event.couponIssuedOn;
  const expired = !!event.couponValidUntil && today > event.couponValidUntil;
  const soldOut = event.couponRemaining === 0;
  const closed = notYet || expired || soldOut;

  const period =
    event.couponValidFrom || event.couponValidUntil
      ? `${event.couponValidFrom ? fmtDate(event.couponValidFrom, ko) : ""} ~ ${
          event.couponValidUntil ? fmtDate(event.couponValidUntil, ko) : ""
        }`
      : null;

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await claimCouponAction(postId, { name, phone }, lang);
      if (res.error) setError(res.error);
      else if (res.code) {
        setCode(res.code);
        setAlready(!!res.already);
      }
    });

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-primary-soft/40">
      <div className="border-b border-dashed border-primary/30 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          🎟 {ko ? "쿠폰 이벤트" : "Coupon event"}
        </p>
        <p className="mt-1.5 break-keep-kr text-lg font-bold text-foreground">
          {event.couponBenefit}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {period && (
            <span>
              {ko ? "사용기간" : "Valid"} {period}
            </span>
          )}
          {event.couponRemaining != null && !code && (
            <span>
              {ko
                ? `선착순 ${event.couponLimit}명 · ${event.couponRemaining}장 남음`
                : `${event.couponRemaining} of ${event.couponLimit} left`}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {code ? (
          <div className="text-center">
            <p className="text-sm text-muted">
              {already
                ? ko
                  ? "이미 받으신 쿠폰이에요"
                  : "You already have this coupon"
                : ko
                  ? "쿠폰이 발급되었어요!"
                  : "Your coupon is ready!"}
            </p>
            <p className="mt-2 select-all rounded-xl border border-primary/40 bg-white px-4 py-3 font-mono text-2xl font-bold tracking-widest text-primary">
              {code}
            </p>
            <p className="mt-3 text-xs text-muted">
              {ko
                ? "매장 방문 시 이 코드를 보여주세요. 이름·전화번호로도 확인됩니다."
                : "Show this code at the store. It's also tied to your name and phone."}
            </p>
          </div>
        ) : closed ? (
          <p className="rounded-lg bg-white px-4 py-3 text-center text-sm font-medium text-muted">
            {notYet
              ? ko
                ? `${fmtDate(event.couponIssuedOn!, ko)}부터 받을 수 있어요`
                : `Available from ${fmtDate(event.couponIssuedOn!, ko)}`
              : expired
                ? ko
                  ? "종료된 이벤트예요"
                  : "This event has ended"
                : ko
                  ? "쿠폰이 모두 소진되었어요"
                  : "All coupons claimed"}
          </p>
        ) : (
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ko ? "이름" : "Name"}
                maxLength={60}
                className={inputCls}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={ko ? "휴대폰 번호" : "Phone number"}
                inputMode="tel"
                maxLength={20}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !name.trim() || !phone.trim()}
              className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs disabled:opacity-50"
            >
              {pending
                ? ko
                  ? "발급 중..."
                  : "Issuing..."
                : ko
                  ? "쿠폰 받기"
                  : "Get coupon"}
            </button>
            <p className="text-center text-xs text-muted">
              {ko
                ? "본인확인을 위해 이름·전화번호가 필요해요. 사장님에게만 전달됩니다."
                : "Name and phone are required for verification. Shared only with the owner."}
            </p>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactCard({
  postId,
  lang,
}: {
  postId: string;
  lang: "ko" | "en";
}) {
  const ko = lang === "ko";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createEventInquiryAction(
        postId,
        { name, phone, message },
        lang,
      );
      if (res.error) setError(res.error);
      else setDone(true);
    });

  if (done)
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-center">
        <p className="font-semibold">
          {ko ? "문의가 접수되었어요" : "Your inquiry was sent"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? "남겨주신 연락처로 사장님이 곧 연락드릴게요."
            : "The owner will reach out at the number you left soon."}
        </p>
      </div>
    );

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <p className="text-sm font-semibold">
        {ko ? "📞 연락 문의" : "📞 Contact inquiry"}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {ko
          ? "궁금한 점을 남겨주시면 사장님이 직접 연락드려요."
          : "Leave your question and the owner will contact you directly."}
      </p>
      <div className="mt-3 space-y-2.5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ko ? "이름" : "Name"}
            maxLength={60}
            className={inputCls}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={ko ? "휴대폰 번호" : "Phone number"}
            inputMode="tel"
            maxLength={20}
            className={inputCls}
          />
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            ko
              ? "문의하실 내용을 남겨주세요. (선택)"
              : "Write your inquiry. (optional)"
          }
          maxLength={2000}
          className={`${inputCls} min-h-24 resize-y`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim() || !phone.trim()}
          className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs disabled:opacity-50"
        >
          {pending
            ? ko
              ? "전송 중..."
              : "Sending..."
            : ko
              ? "문의 보내기"
              : "Send inquiry"}
        </button>
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
