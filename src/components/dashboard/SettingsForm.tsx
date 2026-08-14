"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { updateProfileAction, type SimpleState } from "@/app/dashboard/actions";

export function SettingsForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, {} as SimpleState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">이름</Label>
        <Input id="name" name="name" defaultValue={initialName} required />
      </div>
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" value={email} disabled readOnly />
        <p className="mt-1 text-xs text-muted">이메일은 변경할 수 없습니다.</p>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && (
        <p className="text-sm text-green-600">{state.message}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : "저장"}
      </Button>
    </form>
  );
}
