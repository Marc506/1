import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addMentionAction,
  deleteMentionAction,
  deletePlaceAction,
  removeFromCollectionAction,
  setPlacePriorityAction,
  setPlaceStatusAction,
  updatePlaceDetailsAction,
} from "@/app/p/actions";
import { BackLink, PageShell } from "@/components/page-shell";
import { ConfirmSubmit } from "@/components/place/confirm-submit";
import { PlaceDetailsForm } from "@/components/place/details-form";
import { MentionForm } from "@/components/place/mention-form";
import { ShareButton } from "@/components/place/share-button";
import { requireOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/db/queries/collections";
import { getPlaceDetail } from "@/lib/db/queries/places";
import { VISIT_STATUSES } from "@/lib/db/schema";
import { fmt } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import {
  appleMapsDirectionsUrl,
  appleMapsOpenUrl,
  googleMapsDirectionsUrl,
  googleMapsOpenUrl,
} from "@/lib/maps-links";
import { getNavApp } from "@/lib/prefs/server";

export default async function PlacePage({
  params,
  searchParams,
}: PageProps<"/p/[id]">) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  const fromParam = (await searchParams).from;
  const [t, place, navApp] = await Promise.all([
    getDictionary(),
    getPlaceDetail(getDb(), ownerId, id),
    getNavApp(),
  ]);
  if (!place) notFound();

  // Only link back to a collection this place is actually in.
  const from =
    typeof fromParam === "string" && isUuid(fromParam)
      ? place.collections.find((c) => c.id === fromParam)
      : undefined;
  const p = t.place;

  const links = {
    appleNavigate: appleMapsDirectionsUrl(place),
    appleOpen: appleMapsOpenUrl(place),
    googleNavigate: googleMapsDirectionsUrl(place),
    googleOpen: googleMapsOpenUrl(place),
  };
  const primary =
    navApp === "google"
      ? { href: links.googleNavigate, label: p.navigateGoogle }
      : { href: links.appleNavigate, label: p.navigateApple };
  const secondary =
    navApp === "google"
      ? [
          { href: links.googleOpen, label: p.openGoogle },
          { href: links.appleOpen, label: p.openApple },
          { href: links.appleNavigate, label: p.navigateApple },
        ]
      : [
          { href: links.appleOpen, label: p.openApple },
          { href: links.googleOpen, label: p.openGoogle },
          { href: links.googleNavigate, label: p.navigateGoogle },
        ];

  return (
    <PageShell>
      <BackLink
        href={from ? `/c/${from.id}` : "/"}
        label={from ? from.name : p.back}
      />

      <header className="py-3">
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {place.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {[
            t.categories[place.category],
            place.formattedAddress,
            place.matched ? null : p.manualBadge,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <section aria-label={p.moreOptions} className="flex flex-col gap-2">
        <a
          href={primary.href}
          className="flex h-12 items-center justify-center rounded-xl bg-accent text-base font-medium text-white active:opacity-80"
        >
          {primary.label}
        </a>
        <div className="grid grid-cols-2 gap-2">
          {secondary.slice(0, 2).map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-2 text-center text-sm active:bg-border"
            >
              {l.label}
            </a>
          ))}
          <a
            href={secondary[2].href}
            className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-2 text-center text-sm active:bg-border"
          >
            {secondary[2].label}
          </a>
          <ShareButton
            title={place.name}
            text={[place.name, place.formattedAddress]
              .filter(Boolean)
              .join("\n")}
            url={navApp === "google" ? links.googleOpen : links.appleOpen}
            label={p.share}
            copiedLabel={p.copied}
          />
        </div>
        <p className="text-xs text-muted">{p.appleGuideHint}</p>
      </section>

      <section className="mt-6 flex flex-col gap-3">
        <SegmentedForm
          label={p.statusLabel}
          options={VISIT_STATUSES.map((s) => ({
            key: s,
            text: t.statuses[s],
            active: place.status === s,
            action: setPlaceStatusAction.bind(null, place.id, s),
          }))}
        />
        <SegmentedForm
          label={p.priorityLabel}
          options={([0, 1, 2] as const).map((n) => ({
            key: String(n),
            text: t.add[`priority${n}`],
            active: place.priority === n,
            action: setPlacePriorityAction.bind(null, place.id, n),
          }))}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-base font-medium">{p.mentionsTitle}</h2>
        {place.mentions.length === 0 ? (
          <p className="text-sm text-muted">{p.noMentions}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {place.mentions.map((m) => (
              <li key={m.id} className="flex items-start gap-2 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  {m.why && <p className="whitespace-pre-line">{m.why}</p>}
                  <p className="mt-0.5 text-muted">
                    {t.sourceKinds[m.sourceKind]}
                    {m.sourceUrl && (
                      <>
                        {" · "}
                        <a
                          href={m.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-accent"
                        >
                          {m.sourceTitle || hostOf(m.sourceUrl)}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <form action={deleteMentionAction.bind(null, m.id)}>
                  <button
                    type="submit"
                    aria-label={p.deleteMention}
                    className="flex size-9 items-center justify-center rounded-full text-muted active:bg-border"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-3 rounded-2xl border border-border bg-surface">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm text-accent">
            {p.addMention}
          </summary>
          <div className="px-4 pb-4">
            <MentionForm
              action={addMentionAction.bind(null, place.id)}
              t={p}
              addT={t.add}
              sourceKinds={t.sourceKinds}
            />
          </div>
        </details>
      </section>

      {place.collections.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-base font-medium">{p.inCollections}</h2>
          <div className="flex flex-wrap gap-2">
            {place.collections.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.id}`}
                className="flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 text-sm active:bg-border"
              >
                <span aria-hidden>{c.emoji ?? "📍"}</span>
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <details className="mt-6 rounded-2xl border border-border bg-surface">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm text-accent">
          {p.detailsTitle}
        </summary>
        <div className="px-4 pb-4">
          <PlaceDetailsForm
            action={updatePlaceDetailsAction.bind(null, place.id)}
            initial={{
              name: place.name,
              category: place.category,
              note: place.note ?? "",
              tags: place.tags.join(", "),
            }}
            t={p}
            categories={t.categories}
          />
        </div>
      </details>

      <section className="mt-8 flex flex-col gap-2 border-t border-border pt-6">
        {from && (
          <form
            action={removeFromCollectionAction.bind(null, place.id, from.id)}
          >
            <button
              type="submit"
              className="h-11 w-full rounded-xl border border-border text-base active:bg-border"
            >
              {fmt(p.removeFromCollection, { name: from.name })}
            </button>
          </form>
        )}
        <form action={deletePlaceAction.bind(null, place.id, from?.id ?? null)}>
          <ConfirmSubmit
            message={fmt(p.deleteConfirm, { name: place.name })}
            className="h-11 w-full rounded-xl border border-border text-base text-red-600 active:bg-border dark:text-red-400"
          >
            {p.deletePlace}
          </ConfirmSubmit>
        </form>
      </section>
    </PageShell>
  );
}

function SegmentedForm({
  label,
  options,
}: {
  label: string;
  options: {
    key: string;
    text: string;
    active: boolean;
    action: () => Promise<void>;
  }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-border/60 p-1">
        {options.map((o) => (
          <form key={o.key} action={o.action}>
            <button
              type="submit"
              aria-pressed={o.active}
              className={`flex min-h-10 w-full items-center justify-center rounded-lg px-2 text-sm ${
                o.active ? "bg-surface font-medium shadow-sm" : "text-muted"
              }`}
            >
              {o.text}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
