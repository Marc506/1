"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsible filter area. Starts open when filters are in effect; after
 * that the person controls it, so server re-renders after each filter tap
 * never snap it shut.
 */
export function FilterPanel({
  title,
  activeCount,
  initiallyOpen,
  children,
}: {
  title: string;
  activeCount: number;
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-sm"
      >
        <span>
          {title}
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">
              {activeCount}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </div>
  );
}
