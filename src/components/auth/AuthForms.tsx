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

export function LoginForm({ t }: { t: AuthDict }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";

  return (
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
  );
}

export function SignupForm({ t }: { t: AuthDict }) {
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
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
