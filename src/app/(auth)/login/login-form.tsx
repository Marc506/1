"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function LoginForm({
  next,
  t,
}: {
  next: string;
  t: Dictionary["auth"];
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-sm font-medium">
        {t.passwordLabel}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "login-error" : undefined}
        // 16px font keeps iOS Safari from zooming in on focus.
        className="h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <p
        id="login-error"
        aria-live="polite"
        className="min-h-5 text-sm text-red-600 dark:text-red-400"
      >
        {state.error ? t.errors[state.error] : ""}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-accent text-base font-medium text-white transition-opacity active:opacity-80 disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
