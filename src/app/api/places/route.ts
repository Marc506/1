import { savePlaceRequestSchema } from "@/lib/api/schemas";
import { getOwnerId } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { savePlaceToCollection } from "@/lib/db/queries/places";

export async function POST(request: Request) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = savePlaceRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { candidate, collectionId, ...rest } = parsed.data;
  const result = await savePlaceToCollection(getDb(), ownerId, {
    collectionId,
    place: {
      ...candidate,
      formattedAddress: candidate.formattedAddress ?? null,
      // A hand-placed pin has no provider id to deduplicate on.
      providerPlaceId:
        candidate.provider === "manual" ? null : candidate.providerPlaceId,
    },
    ...rest,
  });

  if (!result.ok)
    return Response.json({ error: result.error }, { status: 404 });
  const { ok, ...body } = result;
  return Response.json(body, { status: result.existing ? 200 : 201 });
}
