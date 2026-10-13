"use client";

import { useActionState } from "react";
import type { PlaceFormState } from "./types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { SOURCE_KIND_OPTIONS } from "../source-kinds";

const field =
  "rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent";

export function MentionForm({
  action,
  t,
  addT,
  sourceKinds,
}: {
  action: (prev: PlaceFormState, formData: FormData) => Promise<PlaceFormState>;
  t: Dictionary["place"];
  addT: Dictionary["add"];
  sourceKinds: Dictionary["sourceKinds"];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const error =
    state.error === "invalid_url" || state.error === "empty"
      ? t.errors[state.error]
      : null;
  return (
    // Remount after a successful save so the fields clear.
    <form
      key={state.savedAt ?? "form"}
      action={formAction}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mention-why" className="text-sm font-medium">
          {addT.whyLabel}
        </label>
        <textarea
          id="mention-why"
          name="why"
          rows={2}
          placeholder={addT.whyPlaceholder}
          className={`${field} py-2`}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex w-2/5 shrink-0 flex-col gap-1.5">
          <label htmlFor="mention-sourceKind" className="text-sm font-medium">
            {addT.sourceKindLabel}
          </label>
          <select
            id="mention-sourceKind"
            name="sourceKind"
            className={`${field} h-11 px-2`}
          >
            <option value="other">—</option>
            {SOURCE_KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {sourceKinds[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="mention-sourceUrl" className="text-sm font-medium">
            {addT.sourceUrlLabel}
          </label>
          <input
            id="mention-sourceUrl"
            name="sourceUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            className={`${field} h-11 w-full min-w-0`}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl border border-accent px-4 text-base text-accent active:bg-border disabled:opacity-60"
        >
          {t.addMentionSubmit}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
