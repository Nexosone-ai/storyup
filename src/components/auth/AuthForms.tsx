"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  signInAction,
  signUpAction,
  resetRequestAction,
  type AuthState,
} from "@/app/(auth)/actions";

const initial: AuthState = {};

function Alert({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p className="rounded-lg bg-[#fbeceb] px-3.5 py-2.5 text-sm text-danger ring-1 ring-inset ring-danger/10">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="rounded-lg bg-primary-soft px-3.5 py-2.5 text-sm text-primary ring-1 ring-inset ring-primary/10">
        {state.message}
      </p>
    );
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initial);
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirect" value={redirect} />
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Alert state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : "로그인"}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">이름</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <p className="mt-1 text-xs text-muted">6자 이상 입력해주세요.</p>
      </div>
      <Alert state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : "무료로 시작하기"}
      </Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(resetRequestAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Alert state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : "재설정 링크 보내기"}
      </Button>
    </form>
  );
}
