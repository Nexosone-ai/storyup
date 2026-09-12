"use client";

import { useActionState, useRef } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { changePasswordAction } from "@/app/dashboard/actions";
import type { SimpleState } from "@/app/dashboard/actions";

export function ChangePasswordForm() {
  const ko = useLocale() === "ko";
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: SimpleState, formData: FormData) => {
      const res = await changePasswordAction(prev, formData);
      if (res.message) formRef.current?.reset();
      return res;
    },
    {} as SimpleState,
  );

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div>
        <Label htmlFor="password">{ko ? "새 비밀번호" : "New password"}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="mt-1 text-xs text-muted">
          {ko ? "8자 이상 입력해주세요." : "At least 8 characters."}
        </p>
      </div>
      <div>
        <Label htmlFor="confirm">
          {ko ? "새 비밀번호 확인" : "Confirm new password"}
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && (
        <p className="text-sm text-green-600">{state.message}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : ko ? "비밀번호 변경" : "Change password"}
      </Button>
    </form>
  );
}
