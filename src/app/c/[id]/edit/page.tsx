import { notFound } from "next/navigation";
import {
  setCollectionArchivedAction,
  updateCollectionAction,
} from "@/app/c/actions";
import { CollectionForm } from "@/components/collection-form";
import { PageShell } from "@/components/page-shell";
import { requireOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { getCollection } from "@/lib/db/queries/collections";
import { getDictionary } from "@/lib/i18n/server";

export default async function EditCollectionPage({
  params,
}: PageProps<"/c/[id]/edit">) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  const [t, collection] = await Promise.all([
    getDictionary(),
    getCollection(getDb(), ownerId, id),
  ]);
  if (!collection) notFound();

  const f = t.collectionForm;
  return (
    <PageShell>
      <h1 className="py-4 text-2xl font-semibold tracking-tight">
        {f.editTitle}
      </h1>
      <CollectionForm
        action={updateCollectionAction.bind(null, collection.id)}
        initial={{
          name: collection.name,
          emoji: collection.emoji,
          cityName: collection.cityName,
        }}
        submitLabel={f.save}
        cancelHref={`/c/${collection.id}`}
        t={f}
      />

      <form
        action={setCollectionArchivedAction.bind(
          null,
          collection.id,
          !collection.archived,
        )}
        className="mt-8 border-t border-border pt-6"
      >
        <button
          type="submit"
          className={`h-12 w-full rounded-xl border border-border text-base active:bg-border ${collection.archived ? "text-accent" : "text-red-600 dark:text-red-400"}`}
        >
          {collection.archived ? f.unarchive : f.archive}
        </button>
        {!collection.archived && (
          <p className="mt-2 text-center text-sm text-muted">{f.archiveHelp}</p>
        )}
      </form>
    </PageShell>
  );
}
