import { z } from "zod";
import { PLACE_CATEGORIES, SOURCE_KINDS } from "@/lib/db/schema";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullish();

export const searchRequestSchema = z.object({
  text: z.string().max(500),
  collectionId: z.string(),
  language: z.enum(["zh-CN", "en"]).optional(),
});

export const savePlaceRequestSchema = z.object({
  collectionId: z.string(),
  candidate: z.object({
    provider: z.enum(["google", "nominatim", "manual"]),
    providerPlaceId: z.string().min(1).max(300).nullable(),
    name: z.string().trim().min(1).max(200),
    formattedAddress: z.string().trim().max(500).nullish(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    category: z.enum(PLACE_CATEGORIES).catch("other"),
  }),
  note: optionalText(2000),
  why: optionalText(2000),
  sourceUrl: z
    .string()
    .trim()
    .max(2000)
    .transform((s) => s || null)
    .pipe(z.url({ protocol: /^https?$/ }).nullable())
    .nullish(),
  sourceKind: z.enum(SOURCE_KINDS).nullish(),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .optional()
    .transform((tags) => [...new Set(tags ?? [])]),
  priority: z.number().int().min(0).max(2).optional(),
});

export type SavePlaceRequest = z.infer<typeof savePlaceRequestSchema>;
