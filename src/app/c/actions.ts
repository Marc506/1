"use server";

import { notFound, redirect } from "next/navigation";
import { requireOwnerId } from "@/lib/auth/server";
import {
  parseCollectionForm,
  type CollectionFormState,
} from "@/lib/collections/form";
import { getDb } from "@/lib/db/client";
import {
  createCollection,
  getCollection,
  updateCollection,
} from "@/lib/db/queries/collections";
import { geocodeCity } from "@/lib/geocoding";

async function cityCenter(cityName: string | null) {
  const center = cityName ? await geocodeCity(cityName) : null;
  return { centerLat: center?.lat ?? null, centerLng: center?.lng ?? null };
}

export async function createCollectionAction(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  const ownerId = await requireOwnerId();
  const parsed = parseCollectionForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values };

  const created = await createCollection(getDb(), ownerId, {
    ...parsed.values,
    ...(await cityCenter(parsed.values.cityName)),
  });
  redirect(`/c/${created.id}`);
}

export async function updateCollectionAction(
  id: string,
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  const ownerId = await requireOwnerId();
  const db = getDb();
  const existing = await getCollection(db, ownerId, id);
  if (!existing) notFound();

  const parsed = parseCollectionForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values };

  // Geocode again when the city changed, or when the last lookup failed.
  const { cityName } = parsed.values;
  const needsLookup =
    cityName !== existing.cityName ||
    (cityName !== null && existing.centerLat === null);
  await updateCollection(db, ownerId, id, {
    ...parsed.values,
    ...(needsLookup ? await cityCenter(cityName) : {}),
  });
  redirect(`/c/${id}`);
}

export async function setCollectionArchivedAction(
  id: string,
  archived: boolean,
): Promise<void> {
  const ownerId = await requireOwnerId();
  const updated = await updateCollection(getDb(), ownerId, id, { archived });
  if (!updated) notFound();
  redirect(archived ? "/" : `/c/${id}`);
}
