import Link from "next/link";
import { PageShell, BackLink } from "@/components/page-shell";
import { logout } from "@/lib/auth/actions";
import { requireOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import {
  countArchivedCollections,
  listCollections,
  type CollectionWithCount,
} from "@/lib/db/queries/collections";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";

export default async function Home({ searchParams }: PageProps<"/">) {
  const ownerId = await requireOwnerId();
  const showArchived = (await searchParams).archived === "1";
  const db = getDb();
  const [t, collections, archivedCount] = await Promise.all([
    getDictionary(),
    listCollections(db, ownerId, { archived: showArchived }),
    showArchived ? 0 : countArchivedCollections(db, ownerId),
  ]);

  if (showArchived) {
    return (
      <PageShell>
        <BackLink href="/" label={t.home.backToCollections} />
        <h1 className="mt-2 mb-4 text-2xl font-semibold tracking-tight">
          {t.home.archivedTitle}
        </h1>
        {collections.length ? (
          <CollectionList collections={collections} t={t} />
        ) : (
          <p className="text-sm text-muted">{t.home.archivedEmpty}</p>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="flex items-start justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.appName}</h1>
          <p className="mt-1 text-sm text-muted">{t.tagline}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="shrink-0 rounded-lg px-2 py-1 text-sm whitespace-nowrap text-muted active:bg-border"
          >
            {t.auth.logout}
          </button>
        </form>
      </header>

      <Link
        href="/c/new"
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-medium text-white active:opacity-80"
      >
        <span aria-hidden>＋</span>
        {t.home.newCollection}
      </Link>

      {collections.length ? (
        <div className="mt-5">
          <CollectionList collections={collections} t={t} />
        </div>
      ) : (
        <section className="mt-5 rounded-2xl border border-border bg-surface px-5 py-10 text-center">
          <div aria-hidden className="text-4xl">
            📍
          </div>
          <h2 className="mt-3 text-base font-medium">{t.home.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.home.emptyBody}</p>
        </section>
      )}

      {archivedCount > 0 && (
        <Link
          href="/?archived=1"
          className="mt-6 self-center rounded-lg px-3 py-2 text-sm text-muted active:bg-border"
        >
          {fmt(t.home.archivedLink, { count: archivedCount })}
        </Link>
      )}
    </PageShell>
  );
}

function CollectionList({
  collections,
  t,
}: {
  collections: CollectionWithCount[];
  t: Dictionary;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {collections.map((c) => (
        <li key={c.id}>
          <Link
            href={`/c/${c.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 active:bg-border"
          >
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background text-2xl"
            >
              {c.emoji ?? "📍"}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-base font-medium">{c.name}</span>
              <span className="truncate text-sm text-muted">
                {[
                  c.cityName,
                  fmt(
                    c.placeCount === 1
                      ? t.collection.placeCountOne
                      : t.collection.placeCountOther,
                    { count: c.placeCount },
                  ),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
