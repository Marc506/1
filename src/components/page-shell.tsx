import Link from "next/link";
import type { ReactNode } from "react";

/** Phone-first page container that respects the notch and home indicator. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      {children}
    </main>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-2 text-base text-accent active:bg-border"
    >
      <span aria-hidden>‹</span>
      {label}
    </Link>
  );
}
