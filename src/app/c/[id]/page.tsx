import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, PageShell } from "@/components/page-shell";
import { requireOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { getCollection } from "@/lib/db/queries/collections";
import { fmt } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";

export default async function CollectionPage({ params }: PageProps<"/c/[id]">) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  const [t, collection] = await Promise.all([
    getDictionary(),
    getCollection(getDb(), ownerId, id),
  ]);
  if (!collection) notFound();

  const cityNotLocated =
    collection.cityName !== null && collection.centerLat === null;

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <BackLink
          href={collection.archived ? "/?archived=1" : "/"}
          label={t.collection.back}
        />
        <Link
          href={`/c/${collection.id}/edit`}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-base text-accent active:bg-border"
        >
          {t.collection.edit}
        </Link>
      </div>

      <header className="flex items-center gap-4 py-3">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-3xl"
        >
          {collection.emoji ?? "📍"}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {collection.name}
          </h1>
          <p className="text-sm text-muted">
            {[
              collection.cityName,
              collection.archived ? t.collection.archivedBadge : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {cityNotLocated && (
        <p
          role="status"
          className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          {fmt(t.collection.cityNotFound, { city: collection.cityName! })}
        </p>
      )}

      <section className="mt-4 rounded-2xl border border-border bg-surface px-5 py-10 text-center">
        <h2 className="text-base font-medium">{t.collection.noPlacesTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.collection.noPlacesBody}</p>
      </section>
    </PageShell>
  );
}
