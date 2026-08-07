import { z } from 'zod'
import { locationSymbolIdSchema } from './location-symbol.js'
import type {
  EntityDeleteReceipt,
  EntityMutationReceipt
} from './entity-mutation.js'

export const worldLocationMapPresentationSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    titleOverride: z.string().trim().min(1).max(100).nullable(),
    symbolId: locationSymbolIdSchema,
    symbolSize: z.number().int().min(24).max(80),
    labelCurve: z.number().int().min(-40).max(40),
    labelPosition: z.enum(['above', 'below', 'both'])
  })
  .strict()

export const defaultWorldLocationMapPresentation = {
  revision: 0,
  titleOverride: null,
  symbolId: 'location',
  symbolSize: 44,
  labelCurve: 0,
  labelPosition: 'below'
} as const

export function canonicalWorldLocationTag(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase()
}

export const worldLocationTagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .min(1)
  .max(20)
  .superRefine((tags, context) => {
    const seen = new Set<string>()
    tags.forEach((tag, index) => {
      const canonical = canonicalWorldLocationTag(tag)
      if (seen.has(canonical))
        context.addIssue({
          code: 'custom',
          message: 'World Location tags must be unique.',
          path: [index]
        })
      seen.add(canonical)
    })
  })

export const worldLocationTagSearchInputSchema = z
  .object({
    query: z.string().trim().max(40),
    limit: z.number().int().min(1).max(10).default(6)
  })
  .strict()

export const worldLocationTagSuggestionsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(10)

export const worldLocationSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    tags: worldLocationTagsSchema,
    readAloud: z.string().max(20_000),
    notes: z.string().max(20_000),
    position: z.number().int().nonnegative(),
    factionIds: z.array(z.uuid()),
    encounterTableIds: z.array(z.uuid()),
    mapPresentation: worldLocationMapPresentationSchema
  })
  .strict()

export const worldLocationSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    locations: z.array(worldLocationSchema)
  })
  .strict()

export const worldLocationMutationReceiptSchema = z
  .object({
    snapshot: worldLocationSnapshotSchema,
    saved: worldLocationSchema
  })
  .strict()

export const worldLocationDeleteReceiptSchema = z
  .object({
    snapshot: worldLocationSnapshotSchema,
    deletedId: z.uuid()
  })
  .strict()

export const worldLocationDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    tags: worldLocationTagsSchema,
    readAloud: z.string().max(20_000).default(''),
    notes: z.string().trim().max(20_000),
    factionIds: z.array(z.uuid()).default([]),
    encounterTableIds: z.array(z.uuid()).default([])
  })
  .strict()

const locationMutationBaseSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict()

export const createWorldLocationInputSchema = locationMutationBaseSchema
  .extend({ location: worldLocationDraftSchema })
  .strict()

export const updateWorldLocationInputSchema = createWorldLocationInputSchema
  .extend({ id: z.uuid() })
  .strict()

export const deleteWorldLocationInputSchema = locationMutationBaseSchema
  .extend({ id: z.uuid() })
  .strict()

export const worldLocationPlacementSelectionSchema = z
  .object({
    mapId: z.uuid(),
    coordinate: z.object({ q: z.number().int(), r: z.number().int() }).strict()
  })
  .strict()

export const worldLocationPlacementIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('keep') }).strict(),
  z
    .object({
      kind: z.literal('place'),
      target: worldLocationPlacementSelectionSchema
    })
    .strict(),
  z.object({ kind: z.literal('remove') }).strict()
])

export const worldLocationPlacementFailureSchema = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('map-missing') }).strict(),
    z.object({ kind: z.literal('occupied') }).strict(),
    z.object({ kind: z.literal('tile-missing') }).strict(),
    z.object({ kind: z.literal('location-not-placed') }).strict(),
    z.object({ kind: z.literal('stale') }).strict(),
    z.object({ kind: z.literal('conflict') }).strict(),
    z
      .object({
        kind: z.literal('unavailable'),
        detail: z.string().optional()
      })
      .strict()
  ]
)

export const worldLocationPlacementCommandSchema = z
  .object({
    commandId: z.uuid(),
    locationId: z.uuid(),
    placement: worldLocationPlacementIntentSchema
  })
  .strict()

export const worldLocationPlacementCommitResultSchema = z.discriminatedUnion(
  'status',
  [
    z.object({ status: z.literal('unchanged') }).strict(),
    z.object({ status: z.literal('applied') }).strict(),
    z
      .object({
        status: z.literal('rejected'),
        failure: worldLocationPlacementFailureSchema
      })
      .strict()
  ]
)

export const saveWorldLocationInputSchema = z
  .object({
    commandId: z.uuid(),
    locationId: z.uuid().nullable(),
    location: worldLocationDraftSchema,
    expectedRevision: z.number().int().nonnegative(),
    placement: worldLocationPlacementIntentSchema
  })
  .strict()

const worldLocationSaveReceiptBaseSchema = z
  .object({
    commandId: z.uuid(),
    snapshot: worldLocationSnapshotSchema,
    saved: worldLocationSchema
  })
  .strict()

export const worldLocationSaveReceiptSchema = z.discriminatedUnion('status', [
  worldLocationSaveReceiptBaseSchema
    .extend({
      status: z.literal('saved'),
      placement: z.enum(['unchanged', 'applied'])
    })
    .strict(),
  worldLocationSaveReceiptBaseSchema
    .extend({
      status: z.literal('partially-saved'),
      placementFailure: worldLocationPlacementFailureSchema
    })
    .strict()
])

export const worldLocationSaveReceiptInputSchema = z
  .object({ commandId: z.uuid() })
  .strict()

export const worldLocationMapPresentationPatchSchema = z
  .object({
    titleOverride: z.string().trim().min(1).max(100).nullable().optional(),
    symbolId: locationSymbolIdSchema.optional(),
    symbolSize: z.number().int().min(24).max(80).optional(),
    labelCurve: z.number().int().min(-40).max(40).optional(),
    labelPosition: z.enum(['above', 'below', 'both']).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

export const updateWorldLocationMapPresentationInputSchema =
  locationMutationBaseSchema
    .extend({
      id: z.uuid(),
      expectedRevision: z.number().int().nonnegative(),
      patch: worldLocationMapPresentationPatchSchema
    })
    .strict()

export const worldLocationChangeNoticeSchema = z
  .object({
    campaignId: z.uuid(),
    revision: z.number().int().nonnegative(),
    changedLocationIds: z.array(z.uuid()),
    reason: z.enum(['catalog', 'presentation', 'symbol-replacement'])
  })
  .strict()

export type WorldLocation = Readonly<z.infer<typeof worldLocationSchema>>
export type WorldLocationDraft = Readonly<
  z.input<typeof worldLocationDraftSchema>
>
export type WorldLocationSnapshot = Readonly<
  z.infer<typeof worldLocationSnapshotSchema>
>
export type WorldLocationMutationReceipt = EntityMutationReceipt<
  WorldLocation,
  WorldLocationSnapshot
>
export type WorldLocationDeleteReceipt =
  EntityDeleteReceipt<WorldLocationSnapshot>
export type WorldLocationPlacementSelection = Readonly<
  z.infer<typeof worldLocationPlacementSelectionSchema>
>
export type WorldLocationPlacementIntent = Readonly<
  z.infer<typeof worldLocationPlacementIntentSchema>
>
export type WorldLocationPlacementFailure = Readonly<
  z.infer<typeof worldLocationPlacementFailureSchema>
>
export type WorldLocationPlacementCommand = Readonly<
  z.infer<typeof worldLocationPlacementCommandSchema>
>
export type WorldLocationPlacementCommitResult = Readonly<
  z.infer<typeof worldLocationPlacementCommitResultSchema>
>
export type SaveWorldLocationInput = Readonly<
  z.infer<typeof saveWorldLocationInputSchema>
>
export type WorldLocationSaveReceipt = Readonly<
  z.infer<typeof worldLocationSaveReceiptSchema>
>
export type WorldLocationMapPresentation = Readonly<
  z.infer<typeof worldLocationMapPresentationSchema>
>
export type WorldLocationMapPresentationPatch = Readonly<
  z.infer<typeof worldLocationMapPresentationPatchSchema>
>
export type WorldLocationChangeNotice = Readonly<
  z.infer<typeof worldLocationChangeNoticeSchema>
>
