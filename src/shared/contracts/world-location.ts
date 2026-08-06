import { z } from 'zod'
import { locationSymbolIdSchema } from './location-symbol.js'

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

export const worldLocationSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    kind: z.string().max(100),
    region: z.string().max(100),
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

export const createWorldLocationResultSchema = z
  .object({
    snapshot: worldLocationSnapshotSchema,
    createdLocation: worldLocationSchema
  })
  .strict()

export const worldLocationDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    kind: z.string().trim().max(100).default(''),
    region: z.string().trim().max(100).default(''),
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
export type CreateWorldLocationResult = Readonly<
  z.infer<typeof createWorldLocationResultSchema>
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
