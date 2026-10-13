import { createCollectionAction } from "@/app/c/actions";
import { CollectionForm } from "@/components/collection-form";
import { PageShell } from "@/components/page-shell";
import { requireOwnerId } from "@/lib/auth/server";
import { getDictionary } from "@/lib/i18n/server";

export default async function NewCollectionPage() {
  await requireOwnerId();
  const t = await getDictionary();
  return (
    <PageShell>
      <h1 className="py-4 text-2xl font-semibold tracking-tight">
        {t.collectionForm.newTitle}
      </h1>
      <CollectionForm
        action={createCollectionAction}
        initial={{ name: "", emoji: null, cityName: null }}
        submitLabel={t.collectionForm.create}
        cancelHref="/"
        t={t.collectionForm}
      />
    </PageShell>
  );
}
