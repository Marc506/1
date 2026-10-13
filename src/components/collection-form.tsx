"use client";

import Link from "next/link";
import { useActionState } from "react";
import type {
  CollectionFormState,
  CollectionFormValues,
} from "@/lib/collections/form";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Props = {
  action: (
    prev: CollectionFormState,
    formData: FormData,
  ) => Promise<CollectionFormState>;
  initial: CollectionFormValues;
  submitLabel: string;
  cancelHref: string;
  t: Dictionary["collectionForm"];
};

const inputClass =
  "h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-500";

export function CollectionForm({
  action,
  initial,
  submitLabel,
  cancelHref,
  t,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const nameError = state.errors?.name
    ? t.errors[`name_${state.errors.name}`]
    : undefined;
  const cityError = state.errors?.cityName
    ? t.errors[`city_${state.errors.cityName}`]
    : undefined;

  return (
    // Remount after a failed submit so inputs show what was submitted.
    <form
      key={JSON.stringify(state.values ?? null)}
      action={formAction}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {t.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          defaultValue={values.name}
          placeholder={t.namePlaceholder}
          autoFocus={!initial.name}
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "name-error" : undefined}
          className={`${inputClass} w-full`}
        />
        {nameError && (
          <p id="name-error" className="text-sm text-red-600 dark:text-red-400">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cityName" className="text-sm font-medium">
          {t.cityLabel}
        </label>
        <input
          id="cityName"
          name="cityName"
          defaultValue={values.cityName ?? ""}
          placeholder={t.cityPlaceholder}
          autoComplete="off"
          aria-invalid={cityError ? true : undefined}
          aria-describedby="city-help"
          className={`${inputClass} w-full`}
        />
        <p id="city-help" className="text-sm text-muted">
          {cityError ?? t.cityHelp}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="emoji" className="text-sm font-medium">
          {t.emojiLabel}
        </label>
        <input
          id="emoji"
          name="emoji"
          defaultValue={values.emoji ?? ""}
          placeholder="🗽"
          autoComplete="off"
          className={`${inputClass} w-24 text-center text-2xl`}
        />
      </div>

      <div className="mt-2 flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl bg-accent text-base font-medium text-white active:opacity-80 disabled:opacity-60"
        >
          {pending ? t.saving : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="flex h-12 items-center justify-center rounded-xl text-base text-muted active:bg-border"
        >
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}
