import { notFound } from "next/navigation";
import { AddPlaceLoader as AddPlace } from "@/components/add-place-loader";
import { BackLink, PageShell } from "@/components/page-shell";
import { requireOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { getCollection } from "@/lib/db/queries/collections";
import { getDictionary } from "@/lib/i18n/server";

export default async function AddPlacePage({
  params,
}: PageProps<"/c/[id]/add">) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  const [t, collection] = await Promise.all([
    getDictionary(),
    getCollection(getDb(), ownerId, id),
  ]);
  if (!collection) notFound();

  return (
    <PageShell>
      <BackLink href={`/c/${collection.id}`} label={collection.name} />
      <h1 className="mt-1 mb-4 text-2xl font-semibold tracking-tight">
        {t.add.title}
      </h1>
      <AddPlace
        collection={{ id: collection.id, cityName: collection.cityName }}
        t={t.add}
        categories={t.categories}
        sourceKinds={t.sourceKinds}
      />
    </PageShell>
  );
}
