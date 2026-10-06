"use client";

import { useActionState, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { deleteAccountAction } from "@/app/dashboard/settings/actions";
import type { SimpleState } from "@/app/dashboard/actions";

export function DeleteAccountSection({
  email,
  businessCount,
  staffCount,
  hasBillingKey,
  planLabel,
}: {
  email: string;
  businessCount: number;
  staffCount: number;
  hasBillingKey: boolean;
  planLabel: string | null;
}) {
  const ko = useLocale() === "ko";
  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    {} as SimpleState,
  );

  const emailMatches =
    typedEmail.trim().toLowerCase() === email.trim().toLowerCase();
  const reasonFilled = reason.trim().length > 0;
  const canSubmit = emailMatches && reasonFilled && !pending;

  const bullets: string[] = ko
    ? [
        `사업장 ${businessCount}개와 그 사이트·블로그·카드뉴스·이미지가 모두 삭제됩니다.`,
        ...(staffCount > 0
          ? [`직원 계정 ${staffCount}명의 접근 권한이 즉시 해제됩니다.`]
          : []),
        ...(planLabel
          ? [
              `${planLabel} 구독이 즉시 종료되고 남은 기간은 소멸됩니다(환불 없음).${
                hasBillingKey ? " 등록된 카드는 삭제되어 더 이상 청구되지 않습니다." : ""
              }`,
            ]
          : []),
        "보유 중인 UP(이용권)과 알림·활동 기록이 삭제됩니다.",
        "결제·입금 기록은 전자상거래법에 따라 5년간 분리 보관 후 파기됩니다.",
        "연결한 개인 도메인이 있다면 사이트 연결이 해제됩니다.",
      ]
    : [
        `${businessCount} business(es) and all their sites, posts, card news and images will be deleted.`,
        ...(staffCount > 0
          ? [`${staffCount} team member(s) will lose access immediately.`]
          : []),
        ...(planLabel
          ? [
              `Your ${planLabel} subscription ends now; the remaining period is forfeited (no refund).${
                hasBillingKey ? " Your saved card is removed and will not be charged again." : ""
              }`,
            ]
          : []),
        "Remaining UP credits, notifications and activity history are deleted.",
        "Payment records are kept separately for 5 years as required by law, then destroyed.",
        "Any connected custom domain is disconnected from your site.",
      ];

  if (!open)
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {ko
            ? "계정과 모든 데이터를 영구 삭제합니다. 되돌릴 수 없어요."
            : "Permanently delete your account and all data. This cannot be undone."}
        </p>
        <Button variant="danger" onClick={() => setOpen(true)}>
          {ko ? "계정 삭제" : "Delete account"}
        </Button>
      </div>
    );

  return (
    <form action={action} className="space-y-4">
      <ul className="space-y-1.5 text-sm text-foreground [&_li]:ml-5 [&_li]:list-disc">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <div>
        <Label htmlFor="delete-reason">
          {ko ? "떠나시는 이유" : "Why are you leaving?"}
        </Label>
        <Textarea
          id="delete-reason"
          name="reason"
          rows={2}
          maxLength={500}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            ko
              ? "탈퇴 사유를 입력해주세요. 서비스 개선에 참고할게요."
              : "Please tell us why. This helps us improve the service."
          }
        />
      </div>

      <div>
        {/* id는 같은 페이지의 비밀번호 변경 폼(#confirm)과 겹치지 않게 둔다 */}
        <Label htmlFor="delete-confirm-email">
          {ko ? (
            <>
              실수를 막기 위해, 본인 이메일{" "}
              <span className="font-semibold text-danger">{email}</span> 을
              그대로 입력하세요
            </>
          ) : (
            <>
              To prevent mistakes, type your email{" "}
              <span className="font-semibold text-danger">{email}</span> exactly
            </>
          )}
        </Label>
        <Input
          id="delete-confirm-email"
          name="confirmEmail"
          type="email"
          autoComplete="off"
          inputMode="email"
          value={typedEmail}
          onChange={(e) => setTypedEmail(e.target.value)}
          placeholder={email}
          required
        />
        {typedEmail.trim().length > 0 && !emailMatches && (
          <p className="mt-1 text-sm text-danger">
            {ko
              ? "이메일이 일치하지 않습니다."
              : "The email does not match."}
          </p>
        )}
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={!canSubmit}>
          {pending ? (
            <Spinner />
          ) : ko ? (
            "영구 삭제"
          ) : (
            "Delete permanently"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTypedEmail("");
            setReason("");
          }}
        >
          {ko ? "취소" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}
