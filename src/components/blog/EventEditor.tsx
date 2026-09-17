"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  saveBlogEventAction,
  applyBlogModulesToAllAction,
} from "@/app/business/event-actions";
import type { BlogEventRow } from "@/types/database";

/**
 * 블로그 글 편집 화면의 "이벤트" 설정 섹션.
 * - 쿠폰발행: 혜택·발행일자·사용한도·사용기간 설정 (수령 시 이름+전화 본인확인)
 * - 연락문의: 켜면 글 하단에 이름·전화 연락 폼이 붙고, 문의는 기존 문의함으로 들어간다.
 * 공개 글에서만 실제로 동작한다(초안은 방문자에게 보이지 않음).
 */
export function EventEditor({
  businessId,
  postId,
  event,
  couponClaimed = 0,
  published,
}: {
  businessId: string;
  postId: string;
  event: BlogEventRow | null;
  couponClaimed?: number;
  published: boolean;
}) {
  const ko = useLocale() === "ko";
  const [couponEnabled, setCouponEnabled] = useState(
    event?.coupon_enabled ?? false,
  );
  const [benefit, setBenefit] = useState(event?.coupon_benefit ?? "");
  const [issuedOn, setIssuedOn] = useState(event?.coupon_issued_on ?? "");
  const [limit, setLimit] = useState(
    event?.coupon_limit != null ? String(event.coupon_limit) : "",
  );
  const [validFrom, setValidFrom] = useState(event?.coupon_valid_from ?? "");
  const [validUntil, setValidUntil] = useState(event?.coupon_valid_until ?? "");
  const [contactEnabled, setContactEnabled] = useState(
    event?.contact_enabled ?? false,
  );
  const [contactTitle, setContactTitle] = useState(event?.contact_title ?? "");
  const [contactDesc, setContactDesc] = useState(event?.contact_desc ?? "");
  // 0030 모듈 — 댓글은 기존에 항상 노출됐으므로 기본값 true(끄면 숨김).
  const [commentEnabled, setCommentEnabled] = useState(
    event?.comment_enabled ?? true,
  );
  const [addressEnabled, setAddressEnabled] = useState(
    event?.address_enabled ?? false,
  );
  const [mapEnabled, setMapEnabled] = useState(event?.map_enabled ?? false);
  const [note, setNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [applying, startApply] = useTransition();

  // 하단 모듈(댓글·주소·정보·지도·연락문의)을 모든 글에 일괄 적용 (쿠폰 제외).
  const applyAll = () => {
    if (
      !window.confirm(
        ko
          ? "댓글·주소·정보·지도·연락문의 설정을 이 사업체의 모든 글에 동일하게 적용할까요? (쿠폰은 글마다 달라 제외되며, 각 글의 기존 쿠폰 설정은 유지됩니다.)"
          : "Apply comments, address, map, and contact settings to all posts of this business? (Coupons are excluded and each post's existing coupon settings are kept.)",
      )
    )
      return;
    startApply(async () => {
      setNote(null);
      const res = await applyBlogModulesToAllAction(businessId, {
        commentEnabled,
        addressEnabled,
        mapEnabled,
        contactEnabled,
        contactTitle,
        contactDesc,
      });
      setNote(res.error ?? res.message ?? (ko ? "적용되었습니다." : "Applied."));
    });
  };

  const save = () =>
    startSave(async () => {
      setNote(null);
      const res = await saveBlogEventAction(businessId, postId, {
        couponEnabled,
        couponBenefit: benefit,
        couponIssuedOn: issuedOn || null,
        couponLimit: limit ? Number(limit) : null,
        couponValidFrom: validFrom || null,
        couponValidUntil: validUntil || null,
        contactEnabled,
        contactTitle,
        contactDesc,
        commentEnabled,
        addressEnabled,
        mapEnabled,
      });
      setNote(res.error ?? res.message ?? (ko ? "저장되었습니다." : "Saved."));
    });

  const anyOn = couponEnabled || contactEnabled || addressEnabled || mapEnabled;
  const fieldCls = "w-40";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              🎁 {ko ? "이벤트" : "Event"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {ko
                ? "이 글 하단에 쿠폰·연락문의·댓글·주소·지도 모듈을 붙일 수 있어요. '모든 글에 동일 적용'으로 한 번에 반영할 수도 있어요(쿠폰 제외)."
                : "Attach coupon, contact, comments, address, and map modules below this post. Use 'Apply to all posts' to set them across every post at once (coupon excluded)."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={applyAll}
              disabled={saving || applying}
              title={
                ko
                  ? "현재 하단 모듈 설정을 모든 글에 동일하게 적용"
                  : "Apply current bottom modules to all posts"
              }
            >
              {applying ? (
                <Spinner className="h-4 w-4" />
              ) : ko ? (
                "모든 글에 동일 적용"
              ) : (
                "Apply to all posts"
              )}
            </Button>
            <Button size="sm" onClick={save} disabled={saving || applying}>
              {saving ? (
                <Spinner className="h-4 w-4" />
              ) : ko ? (
                "이벤트 저장"
              ) : (
                "Save event"
              )}
            </Button>
          </div>
        </div>

        {note && <p className="mt-3 text-sm text-primary">{note}</p>}

        {anyOn && !published && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-warning">
            {ko
              ? "글을 발행해야 방문자에게 이벤트가 보여요. (초안 상태에서는 미리 설정만 가능)"
              : "Publish the post so visitors can see the event. (In draft, you can only pre-configure it.)"}
          </p>
        )}

        {/* ---------- 쿠폰발행 ---------- */}
        <div className="mt-5 rounded-xl border border-border bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={couponEnabled}
              onChange={(e) => setCouponEnabled(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                {ko ? "쿠폰발행" : "Coupon"}
              </span>
              <span className="block text-xs text-muted">
                {ko
                  ? "방문자가 이름·전화번호를 남기면 혜택 쿠폰을 발급해요 (본인확인)."
                  : "Issue a benefit coupon when a visitor leaves their name and phone (identity check)."}
              </span>
            </span>
          </label>

          {couponEnabled && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div>
                <Label htmlFor="coupon-benefit">
                  {ko ? "혜택 내용" : "Benefit"}
                </Label>
                <Input
                  id="coupon-benefit"
                  value={benefit}
                  onChange={(e) => setBenefit(e.target.value)}
                  maxLength={120}
                  placeholder={
                    ko
                      ? "예: 아메리카노 1잔 무료 / 전 품목 10% 할인"
                      : "e.g. Free americano / 10% off everything"
                  }
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <div>
                  <Label htmlFor="coupon-issued">
                    {ko ? "발행일자" : "Issued on"}
                  </Label>
                  <Input
                    id="coupon-issued"
                    type="date"
                    value={issuedOn}
                    onChange={(e) => setIssuedOn(e.target.value)}
                    className={fieldCls}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {ko ? "이 날부터 수령 가능" : "Claimable from this date"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="coupon-limit">
                    {ko ? "사용한도(수량)" : "Limit (qty)"}
                  </Label>
                  <Input
                    id="coupon-limit"
                    type="number"
                    min={1}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className={fieldCls}
                    placeholder={ko ? "비우면 무제한" : "Empty = unlimited"}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {ko ? "총 발급 매수" : "Total coupons"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div>
                  <Label htmlFor="coupon-from">
                    {ko ? "사용기간 시작" : "Valid from"}
                  </Label>
                  <Input
                    id="coupon-from"
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <Label htmlFor="coupon-until">
                    {ko ? "사용기간 종료" : "Valid until"}
                  </Label>
                  <Input
                    id="coupon-until"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className={fieldCls}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                <ButtonLink
                  href={`/dashboard/inquiries/coupons?post=${postId}`}
                  variant="outline"
                  size="sm"
                >
                  {ko ? "수령자 관리" : "Manage claims"}
                </ButtonLink>
                <span className="text-xs text-muted">
                  {ko
                    ? `지금까지 ${couponClaimed}명 수령`
                    : `${couponClaimed} claimed so far`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ---------- 연락문의 ---------- */}
        <div className="mt-4 rounded-xl border border-border bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={contactEnabled}
              onChange={(e) => setContactEnabled(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                {ko ? "연락문의" : "Contact inquiry"}
              </span>
              <span className="block text-xs text-muted">
                {ko
                  ? "글 하단에 이름·전화 연락 폼을 붙여요. 문의는 대시보드 '문의' 목록으로 들어와요."
                  : "Adds a name/phone contact form below the post. Inquiries arrive in your dashboard 'Inquiries' list."}
              </span>
            </span>
          </label>

          {contactEnabled && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div>
                <Label htmlFor="contact-title">
                  {ko ? "제목 문구" : "Title"}
                </Label>
                <Input
                  id="contact-title"
                  value={contactTitle}
                  onChange={(e) => setContactTitle(e.target.value)}
                  maxLength={40}
                  placeholder={ko ? "연락 문의" : "Contact inquiry"}
                />
              </div>
              <div>
                <Label htmlFor="contact-desc">
                  {ko ? "안내 문구" : "Description"}
                </Label>
                <Input
                  id="contact-desc"
                  value={contactDesc}
                  onChange={(e) => setContactDesc(e.target.value)}
                  maxLength={120}
                  placeholder={
                    ko
                      ? "궁금한 점을 남겨주시면 사장님이 직접 연락드려요."
                      : "Leave your question and we'll contact you directly."
                  }
                />
              </div>
              <p className="text-xs text-muted">
                {ko
                  ? "비워두면 기본 문구가 표시돼요."
                  : "Leave empty to use the default text."}
              </p>
            </div>
          )}
        </div>

        {/* ---------- 댓글 ---------- */}
        <div className="mt-4 rounded-xl border border-border bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={commentEnabled}
              onChange={(e) => setCommentEnabled(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                {ko ? "댓글" : "Comments"}
              </span>
              <span className="block text-xs text-muted">
                {ko
                  ? "방문자가 글 하단에 댓글을 남길 수 있어요. 끄면 댓글 영역이 숨겨져요."
                  : "Let visitors leave comments below the post. Turn off to hide the comment area."}
              </span>
            </span>
          </label>
        </div>

        {/* ---------- 주소 및 정보 ---------- */}
        <div className="mt-4 rounded-xl border border-border bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={addressEnabled}
              onChange={(e) => setAddressEnabled(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                {ko ? "주소 및 정보" : "Address & info"}
              </span>
              <span className="block text-xs text-muted">
                {ko
                  ? "홈페이지의 연락처(주소·전화·이메일·SNS)를 글 하단에 카드로 보여줘요."
                  : "Shows your homepage contact info (address, phone, email, socials) as a card."}
              </span>
            </span>
          </label>
        </div>

        {/* ---------- 지도 ---------- */}
        <div className="mt-4 rounded-xl border border-border bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={mapEnabled}
              onChange={(e) => setMapEnabled(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                {ko ? "지도" : "Map"}
              </span>
              <span className="block text-xs text-muted">
                {ko
                  ? "홈페이지 주소를 기준으로 구글지도를 글 하단에 임베드해요. (주소가 없으면 표시되지 않아요.)"
                  : "Embeds a Google Map based on your homepage address. (Hidden if no address is set.)"}
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
