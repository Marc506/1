"use client";

import { useActionState } from "react";
import type { PlaceFormState } from "./types";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const field =
  "rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent";

export function PlaceDetailsForm({
  action,
  initial,
  t,
  categories,
}: {
  action: (prev: PlaceFormState, formData: FormData) => Promise<PlaceFormState>;
  initial: {
    name: string;
    category: PlaceCategory;
    note: string;
    tags: string;
  };
  t: Dictionary["place"];
  categories: Dictionary["categories"];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.nameLabel}
        <input
          name="name"
          defaultValue={initial.name}
          required
          className={`${field} h-11 font-normal`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.categoryLabel}
        <select
          name="category"
          defaultValue={initial.category}
          className={`${field} h-11 font-normal`}
        >
          {PLACE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categories[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.noteLabel}
        <textarea
          name="note"
          rows={2}
          defaultValue={initial.note}
          className={`${field} py-2 font-normal`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.tagsLabel}
        <input
          name="tags"
          defaultValue={initial.tags}
          className={`${field} h-11 font-normal`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-accent px-5 text-base font-medium text-white active:opacity-80 disabled:opacity-60"
        >
          {t.save}
        </button>
        <p aria-live="polite" className="text-sm">
          {state.error ? (
            <span className="text-red-600 dark:text-red-400">
              {t.errors.invalid}
            </span>
          ) : state.saved && !pending ? (
            <span className="text-muted">{t.saved}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
