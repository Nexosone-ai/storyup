"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  signInAction,
  signUpAction,
  signInWithGoogleAction,
  resetRequestAction,
  type AuthState,
} from "@/app/(auth)/actions";
import type { Dict } from "@/lib/i18n";

type AuthDict = Dict["auth"];
const initial: AuthState = {};

function Alert({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm text-danger ring-1 ring-inset ring-danger/10">
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

/** Divider + "구글로 계속하기" — 이메일 폼과 별도의 form이어야 함 (중첩 불가) */
function GoogleAuth({ t, redirect }: { t: AuthDict; redirect?: string }) {
  return (
    <div className="mt-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">{t.or}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <form action={signInWithGoogleAction}>
        {redirect ? <input type="hidden" name="redirect" value={redirect} /> : null}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-surface-muted"
        >
          <GoogleIcon />
          {t.google}
        </button>
      </form>
    </div>
  );
}

export function LoginForm({ t }: { t: AuthDict }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";

  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="redirect" value={redirect} />
        <div>
          <Label htmlFor="email">{t.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t.password}</Label>
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
          {pending ? <Spinner /> : t.login}
        </Button>
      </form>
      <GoogleAuth t={t} redirect={redirect} />
    </>
  );
}

export function SignupForm({ t }: { t: AuthDict }) {
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
    <>
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">{t.name}</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">{t.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">{t.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <p className="mt-1 text-xs text-muted">{t.pwHint}</p>
      </div>
      <Alert state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : t.signup}
      </Button>
    </form>
    <GoogleAuth t={t} />
    </>
  );
}

export function ResetForm({ t }: { t: AuthDict }) {
  const [state, action, pending] = useActionState(resetRequestAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">{t.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Alert state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : t.sendReset}
      </Button>
    </form>
  );
}
