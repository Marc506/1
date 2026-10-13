"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceKind } from "@/lib/db/schema";
import type { CollectionSearchResult } from "@/lib/geocoding/search";
import type { RankedCandidate } from "@/lib/geocoding/rank";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { formatDistance } from "@/lib/matching/geo";
import { SOURCE_KIND_OPTIONS } from "./source-kinds";

type SearchOk = Extract<CollectionSearchResult, { ok: true }>;
type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: SearchOk }
  | { status: "error"; error: keyof Dictionary["add"]["errors"] };

type Details = {
  why: string;
  note: string;
  sourceUrl: string;
  sourceKind: SourceKind | "";
  tags: string;
  priority: 0 | 1 | 2;
};

const EMPTY_DETAILS: Details = {
  why: "",
  note: "",
  sourceUrl: "",
  sourceKind: "",
  tags: "",
  priority: 1,
};

const DEBOUNCE_MS = 400;
const MIN_CHARS = 2;

type Props = {
  collection: { id: string; cityName: string | null };
  t: Dictionary["add"];
  categories: Dictionary["categories"];
  sourceKinds: Dictionary["sourceKinds"];
};

export function AddPlace({ collection, t, categories, sourceKinds }: Props) {
  const draftKey = `placebook:add-draft:${collection.id}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // Restore an unsent draft (e.g. after losing the connection). This
  // component only renders in the browser, so sessionStorage is available.
  const [draft] = useState(() => readDraft(draftKey));
  const [text, setText] = useState(draft?.text ?? "");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [selected, setSelected] = useState(0);
  const [details, setDetails] = useState<Details>({
    ...EMPTY_DETAILS,
    ...draft?.details,
  });
  const [detailsOpen, setDetailsOpen] = useState(!!draft?.details);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ id: string; name: string }[]>([]);

  const runSearch = useCallback(
    async (query: string) => {
      const id = ++requestId.current;
      abort.current?.abort();
      if ([...query.trim()].length < MIN_CHARS) {
        setSearch({ status: "idle" });
        return;
      }
      const controller = new AbortController();
      abort.current = controller;
      setSearch({ status: "loading" });
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: query, collectionId: collection.id }),
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (id !== requestId.current) return;
        if (!res.ok) {
          const error =
            body.error === "rate_limited" ||
            body.error === "provider_unavailable"
              ? body.error
              : "provider_error";
          setSearch({ status: "error", error });
          return;
        }
        setSelected(0);
        setSearch({ status: "done", result: body as SearchOk });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (id === requestId.current) {
          setSearch({ status: "error", error: "network" });
        }
      }
    },
    [collection.id],
  );

  useEffect(() => {
    try {
      const hasDetails =
        JSON.stringify(details) !== JSON.stringify(EMPTY_DETAILS);
      if (text || hasDetails) {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({ text, details: hasDetails ? details : undefined }),
        );
      } else {
        sessionStorage.removeItem(draftKey);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [draftKey, text, details]);

  // Debounced search while typing.
  useEffect(() => {
    const handle = setTimeout(() => void runSearch(text), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text, runSearch]);

  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(handle);
  }, [toast]);

  const candidates =
    search.status === "done" ? search.result.candidates : ([] as const);
  const chosen: RankedCandidate | undefined = candidates[selected];

  async function save() {
    if (!chosen || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: collection.id,
          candidate: {
            provider: chosen.provider,
            providerPlaceId: chosen.providerPlaceId,
            name: chosen.name,
            formattedAddress: chosen.formattedAddress,
            lat: chosen.lat,
            lng: chosen.lng,
            category: chosen.category,
          },
          why: details.why,
          note: details.note,
          sourceUrl: details.sourceUrl,
          sourceKind: details.sourceKind || null,
          tags: details.tags
            .split(/[,，、]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          priority: details.priority,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const badUrl = body.issues?.some?.(
          (i: { path?: string[] }) => i.path?.[0] === "sourceUrl",
        );
        setSaveError(badUrl ? t.errors.invalid_url : t.errors.save_failed);
        return;
      }
      setToast(
        body.alreadyInCollection
          ? t.savedAlreadyHere
          : body.existing
            ? t.savedExisting
            : t.saved,
      );
      if (!body.alreadyInCollection) {
        setRecent((r) => [{ id: body.placeId, name: chosen.name }, ...r]);
      }
      // Ready for the next one.
      requestId.current++;
      setText("");
      setDetails(EMPTY_DETAILS);
      setDetailsOpen(false);
      setSearch({ status: "idle" });
      inputRef.current?.focus();
    } catch {
      setSaveError(t.errors.network);
    } finally {
      setSaving(false);
    }
  }

  const bias = search.status === "done" ? search.result.bias : null;

  return (
    <div className="flex flex-1 flex-col">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(text);
        }}
        className="flex flex-col gap-1.5"
      >
        <label htmlFor="place-query" className="text-sm font-medium">
          {t.searchLabel}
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="place-query"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.searchPlaceholder}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-xl border border-border bg-surface pr-12 pl-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              aria-label={t.clear}
              onClick={() => {
                setText("");
                setSearch({ status: "idle" });
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted active:bg-border"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      <div aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {search.status === "loading" && t.searching}
        {search.status === "done" &&
          bias &&
          (bias.source === "collection" && collection.cityName
            ? fmt(t.biasCollection, { city: collection.cityName })
            : t.biasRecent)}
        {search.status === "error" && (
          <span className="text-red-600 dark:text-red-400">
            {t.errors[search.error]}
          </span>
        )}
      </div>

      {search.status === "done" && search.result.usedFallback && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t.fallbackBadge}
        </p>
      )}

      {search.status === "done" && candidates.length === 0 && (
        <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          {t.noResults}
        </p>
      )}

      {candidates.length > 0 && (
        <div
          role="radiogroup"
          aria-label={t.candidatesLabel}
          className="mt-3 flex flex-col gap-2"
        >
          {candidates.map((c, i) => {
            const active = i === selected;
            return (
              <button
                key={`${c.provider}:${c.providerPlaceId}`}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(i)}
                className={`flex items-start gap-3 rounded-2xl border bg-surface p-3 text-left transition-colors ${
                  active
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-border active:bg-border"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    active ? "bg-accent text-white" : "bg-background text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-base font-medium">{c.name}</span>
                  <span className="text-sm text-muted">
                    {[
                      categories[c.category],
                      c.distanceM !== undefined
                        ? formatDistance(c.distanceM)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {c.formattedAddress && (
                    <span className="line-clamp-2 text-sm text-muted">
                      {c.formattedAddress}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <details
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        className="mt-4 rounded-2xl border border-border bg-surface"
      >
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm text-accent">
          {t.detailsToggle}
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field label={t.whyLabel} htmlFor="why">
            <textarea
              id="why"
              rows={2}
              value={details.why}
              placeholder={t.whyPlaceholder}
              onChange={(e) => setDetails({ ...details, why: e.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
            />
          </Field>
          <div className="flex gap-3">
            <Field
              label={t.sourceKindLabel}
              htmlFor="sourceKind"
              className="w-2/5 shrink-0"
            >
              <select
                id="sourceKind"
                value={details.sourceKind}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    sourceKind: e.target.value as SourceKind | "",
                  })
                }
                className="h-11 rounded-xl border border-border bg-background px-2 text-base"
              >
                <option value="">—</option>
                {SOURCE_KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {sourceKinds[kind]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t.sourceUrlLabel}
              htmlFor="sourceUrl"
              className="min-w-0 flex-1"
            >
              <input
                id="sourceUrl"
                type="url"
                inputMode="url"
                value={details.sourceUrl}
                placeholder="https://"
                onChange={(e) =>
                  setDetails({ ...details, sourceUrl: e.target.value })
                }
                className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
              />
            </Field>
          </div>
          <Field label={t.tagsLabel} htmlFor="tags">
            <input
              id="tags"
              value={details.tags}
              placeholder={t.tagsPlaceholder}
              onChange={(e) => setDetails({ ...details, tags: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
            />
          </Field>
          <Field label={t.noteLabel} htmlFor="note">
            <input
              id="note"
              value={details.note}
              onChange={(e) => setDetails({ ...details, note: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
            />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">
              {t.priorityLabel}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {([0, 1, 2] as const).map((p) => (
                <label
                  key={p}
                  className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm ${
                    details.priority === p
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-background"
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={details.priority === p}
                    onChange={() => setDetails({ ...details, priority: p })}
                    className="sr-only"
                  />
                  {t[`priority${p}`]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted">
            {fmt(t.recentTitle, { count: recent.length })}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {recent.map((r) => (
              <li key={r.id} className="truncate text-sm">
                ✓ {r.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Spacer so the sticky bar never covers content. */}
      <div className="h-28" />

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {saveError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!chosen || saving}
            className="h-12 truncate rounded-xl bg-accent px-4 text-base font-medium text-white active:opacity-80 disabled:opacity-40"
          >
            {saving
              ? t.saving
              : chosen
                ? fmt(t.saveNamed, { name: chosen.name })
                : t.save}
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 mx-auto w-fit max-w-[90vw] rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function readDraft(
  key: string,
): { text?: string; details?: Partial<Details> } | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Storage unavailable (private mode) or bad JSON: start empty.
    return null;
  }
}

function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
