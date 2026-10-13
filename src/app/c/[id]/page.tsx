import Link from "next/link";
import { notFound } from "next/navigation";
import { pinColor } from "@/components/map/category-colors";
import { CollectionMap } from "@/components/map/collection-map";
import { FilterPanel } from "@/components/filter-panel";
import { BackLink, PageShell } from "@/components/page-shell";
import { requireOwnerId } from "@/lib/auth/server";
import {
  filtersQuery,
  hasActiveFilters,
  parsePlaceFilters,
  type PlaceFilters,
} from "@/lib/collections/filters";
import { getDb } from "@/lib/db/client";
import { getCollection } from "@/lib/db/queries/collections";
import {
  collectionFacets,
  listCollectionPlaces,
  type CollectionFacets,
  type CollectionPlace,
} from "@/lib/db/queries/places";
import { VISIT_STATUSES } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/c/[id]">) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  const filters = parsePlaceFilters(await searchParams);
  const db = getDb();
  const [t, collection, places, facets] = await Promise.all([
    getDictionary(),
    getCollection(db, ownerId, id),
    listCollectionPlaces(db, ownerId, id, filters),
    collectionFacets(db, ownerId, id),
  ]);
  if (!collection) notFound();

  const base = `/c/${collection.id}`;
  const href = (change: Partial<PlaceFilters>) =>
    `${base}${filtersQuery(filters, change)}`;
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
          href={`${base}/edit`}
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
              fmt(
                facets.total === 1
                  ? t.collection.placeCountOne
                  : t.collection.placeCountOther,
                { count: facets.total },
              ),
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

      {!collection.archived && (
        <Link
          href={`${base}/add`}
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-medium text-white active:opacity-80"
        >
          <span aria-hidden>＋</span>
          {t.add.addButton}
        </Link>
      )}

      {facets.total === 0 ? (
        <section className="mt-4 rounded-2xl border border-border bg-surface px-5 py-10 text-center">
          <h2 className="text-base font-medium">
            {t.collection.noPlacesTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.collection.noPlacesBody}</p>
        </section>
      ) : (
        <>
          <Toolbar filters={filters} facets={facets} href={href} t={t} />
          {places.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
              <p>{t.collection.noMatches}</p>
              <Link
                href={href({ category: null, status: null, tag: null })}
                className="mt-2 inline-block text-accent"
              >
                {t.collection.clearFilters}
              </Link>
            </div>
          ) : filters.view === "map" ? (
            <CollectionMap
              className="mt-4 h-[60vh] min-h-80"
              unavailableText={t.collection.mapUnavailable}
              places={places.map((p) => ({
                id: p.id,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                category: p.category,
                status: p.status,
                subtitle: [t.categories[p.category], p.formattedAddress]
                  .filter(Boolean)
                  .join(" · "),
                href: `/p/${p.id}?from=${collection.id}`,
              }))}
            />
          ) : (
            <PlaceList places={places} collectionId={collection.id} t={t} />
          )}
        </>
      )}
    </PageShell>
  );
}

type NavItem = { key: string; text: string; href: string; active: boolean };

function Segmented({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <nav aria-label={label} className="flex rounded-xl bg-border/60 p-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-9 flex-1 items-center justify-center rounded-lg px-2 text-sm whitespace-nowrap ${
            item.active ? "bg-surface font-medium shadow-sm" : "text-muted"
          }`}
        >
          {item.text}
        </Link>
      ))}
    </nav>
  );
}

function Chips({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <nav
      aria-label={label}
      // Scrolls sideways inside the page instead of widening it.
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap ${
            item.active
              ? "border-accent bg-accent text-white"
              : "border-border bg-surface"
          }`}
        >
          {item.text}
        </Link>
      ))}
    </nav>
  );
}

function Toolbar({
  filters,
  facets,
  href,
  t,
}: {
  filters: PlaceFilters;
  facets: CollectionFacets;
  href: (change: Partial<PlaceFilters>) => string;
  t: Dictionary;
}) {
  const c = t.collection;
  const statusCount = (s: string) =>
    facets.statuses.find((x) => x.value === s)?.count ?? 0;
  const activeCount = [filters.status, filters.category, filters.tag].filter(
    Boolean,
  ).length;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Segmented
        label={`${c.viewList} / ${c.viewMap}`}
        items={[
          {
            key: "list",
            text: c.viewList,
            href: href({ view: "list" }),
            active: filters.view === "list",
          },
          {
            key: "map",
            text: c.viewMap,
            href: href({ view: "map" }),
            active: filters.view === "map",
          },
        ]}
      />
      {/* Collapsed by default so the places stay near the top on a phone. */}
      <FilterPanel
        title={c.filterToggle}
        activeCount={activeCount}
        initiallyOpen={activeCount > 0 || filters.sort !== "recent"}
      >
        <Chips
          label={c.statusLabel}
          items={[
            {
              key: "all",
              text: `${c.filterAll} ${facets.total}`,
              href: href({ status: null }),
              active: !filters.status,
            },
            ...VISIT_STATUSES.map((s) => ({
              key: s,
              text: `${t.statuses[s]} ${statusCount(s)}`,
              href: href({ status: s }),
              active: filters.status === s,
            })),
          ]}
        />
        {facets.categories.length > 1 && (
          <Chips
            label={c.categoryLabel}
            items={[
              {
                key: "all",
                text: c.filterAll,
                href: href({ category: null }),
                active: !filters.category,
              },
              ...facets.categories.map((f) => ({
                key: f.value,
                text: `${t.categories[f.value]} ${f.count}`,
                href: href({ category: f.value }),
                active: filters.category === f.value,
              })),
            ]}
          />
        )}
        {facets.tags.length > 0 && (
          <Chips
            label={c.tagLabel}
            items={[
              {
                key: "all",
                text: c.filterAll,
                href: href({ tag: null }),
                active: !filters.tag,
              },
              ...facets.tags.map((f) => ({
                key: f.value,
                text: `#${f.value}`,
                href: href({ tag: f.value }),
                active: filters.tag === f.value,
              })),
            ]}
          />
        )}
        {filters.view === "list" && (
          <Segmented
            label={c.sortLabel}
            items={(
              [
                ["recent", c.sortRecent],
                ["priority", c.sortPriority],
                ["name", c.sortName],
              ] as const
            ).map(([key, text]) => ({
              key,
              text,
              href: href({ sort: key }),
              active: filters.sort === key,
            }))}
          />
        )}
        {hasActiveFilters(filters) && (
          <Link
            href={href({ category: null, status: null, tag: null })}
            className="self-start text-sm text-accent"
          >
            {c.clearFilters}
          </Link>
        )}
      </FilterPanel>
    </div>
  );
}

function PlaceList({
  places,
  collectionId,
  t,
}: {
  places: CollectionPlace[];
  collectionId: string;
  t: Dictionary;
}) {
  return (
    <ul
      aria-label={t.collection.viewList}
      className="mt-4 flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface"
    >
      {places.map((p) => {
        const visited = p.status === "visited";
        const showBadges =
          p.priority === 2 || p.status !== "want_to_go" || p.tags.length > 0;
        return (
          <li key={p.id}>
            <Link
              href={`/p/${p.id}?from=${collectionId}`}
              className="flex gap-3 px-4 py-3 active:bg-border"
            >
              <span
                aria-hidden
                className="mt-1.5 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: pinColor(p.category, visited) }}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`text-base font-medium ${visited ? "text-muted" : ""}`}
                >
                  {p.name}
                </span>
                <span className="text-sm text-muted">
                  {[t.categories[p.category], p.formattedAddress]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {showBadges && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {p.priority === 2 && (
                      <Badge tone="accent">{t.add.priority2}</Badge>
                    )}
                    {p.status !== "want_to_go" && (
                      <Badge>{t.statuses[p.status]}</Badge>
                    )}
                    {p.tags.map((tag) => (
                      <Badge key={tag}>#{tag}</Badge>
                    ))}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        tone === "accent"
          ? "bg-accent/15 text-accent"
          : "bg-background text-muted"
      }`}
    >
      {children}
    </span>
  );
}
