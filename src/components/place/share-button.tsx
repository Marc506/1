"use client";

import { useState } from "react";

/** Native share sheet where available (iOS Safari), otherwise copy. */
export function ShareButton({
  title,
  text,
  url,
  label,
  copiedLabel,
}: {
  title: string;
  text: string;
  url: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, text, url });
          } catch {
            // Dismissed by the person.
          }
          return;
        }
        await navigator.clipboard?.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-base active:bg-border"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
