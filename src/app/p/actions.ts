"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { PlaceFormState } from "@/components/place/types";
import { requireOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { isUuid } from "@/lib/db/queries/collections";
import {
  addMention,
  deleteMention,
  deletePlace,
  removePlaceFromCollection,
  updatePlace,
} from "@/lib/db/queries/places";
import {
  PLACE_CATEGORIES,
  SOURCE_KINDS,
  VISIT_STATUSES,
} from "@/lib/db/schema";

export async function setPlaceStatusAction(
  placeId: string,
  status: string,
): Promise<void> {
  const ownerId = await requireOwnerId();
  const parsed = z.enum(VISIT_STATUSES).safeParse(status);
  if (!parsed.success) return;
  if (
    !(await updatePlace(getDb(), ownerId, placeId, { status: parsed.data }))
  ) {
    notFound();
  }
  refresh();
}

export async function setPlacePriorityAction(
  placeId: string,
  priority: number,
): Promise<void> {
  const ownerId = await requireOwnerId();
  const parsed = z.number().int().min(0).max(2).safeParse(priority);
  if (!parsed.success) return;
  if (
    !(await updatePlace(getDb(), ownerId, placeId, { priority: parsed.data }))
  ) {
    notFound();
  }
  refresh();
}

const detailsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(PLACE_CATEGORIES),
  note: z
    .string()
    .trim()
    .max(2000)
    .transform((s) => s || null),
  tags: z.string().transform((s) => [
    ...new Set(
      s
        .split(/[,，、]/)
        .map((t) => t.trim().slice(0, 40))
        .filter(Boolean),
    ),
  ]),
});

export async function updatePlaceDetailsAction(
  placeId: string,
  _prev: PlaceFormState,
  formData: FormData,
): Promise<PlaceFormState> {
  const ownerId = await requireOwnerId();
  const parsed = detailsSchema.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    note: formData.get("note") ?? "",
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };
  if (!(await updatePlace(getDb(), ownerId, placeId, parsed.data))) notFound();
  refresh();
  return { saved: true };
}

const mentionSchema = z.object({
  why: z
    .string()
    .trim()
    .max(2000)
    .transform((s) => s || null),
  sourceKind: z.enum(SOURCE_KINDS).catch("other"),
  sourceUrl: z
    .string()
    .trim()
    .max(2000)
    .transform((s) => s || null)
    .pipe(z.url({ protocol: /^https?$/ }).nullable()),
});

export async function addMentionAction(
  placeId: string,
  _prev: PlaceFormState,
  formData: FormData,
): Promise<PlaceFormState> {
  const ownerId = await requireOwnerId();
  const parsed = mentionSchema.safeParse({
    why: formData.get("why") ?? "",
    sourceKind: formData.get("sourceKind") ?? "",
    sourceUrl: formData.get("sourceUrl") ?? "",
  });
  if (!parsed.success) return { error: "invalid_url" };
  if (!parsed.data.why && !parsed.data.sourceUrl) return { error: "empty" };
  if (!(await addMention(getDb(), ownerId, placeId, parsed.data))) notFound();
  refresh();
  return { saved: true, savedAt: Date.now() };
}

export async function deleteMentionAction(mentionId: string): Promise<void> {
  const ownerId = await requireOwnerId();
  await deleteMention(getDb(), ownerId, mentionId);
  refresh();
}

export async function deletePlaceAction(
  placeId: string,
  fromCollectionId: string | null,
): Promise<void> {
  const ownerId = await requireOwnerId();
  if (!(await deletePlace(getDb(), ownerId, placeId))) notFound();
  redirect(
    fromCollectionId && isUuid(fromCollectionId)
      ? `/c/${fromCollectionId}`
      : "/",
  );
}

export async function removeFromCollectionAction(
  placeId: string,
  collectionId: string,
): Promise<void> {
  const ownerId = await requireOwnerId();
  await removePlaceFromCollection(getDb(), ownerId, placeId, collectionId);
  redirect(`/c/${collectionId}`);
}
