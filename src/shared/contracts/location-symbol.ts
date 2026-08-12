import { z } from 'zod'
import {
  builtinLocationSymbolCatalog,
  builtinLocationSymbolIds,
  type BuiltinLocationSymbolId
} from '../values/location-symbol-values.js'
import type { EntityMutationReceipt } from './entity-mutation.js'

export const builtinLocationSymbolIdSchema = z.enum(builtinLocationSymbolIds)
export { builtinLocationSymbolCatalog }

export const locationSymbolIdSchema = z.union([
  builtinLocationSymbolIdSchema,
  z.uuid()
])

export const locationSymbolViewBoxSchema = z
  .object({
    minX: z.number().finite(),
    minY: z.number().finite(),
    width: z.number().finite().positive().max(1_000_000),
    height: z.number().finite().positive().max(1_000_000)
  })
  .strict()

const pathDataSchema = z
  .string()
  .trim()
  .min(1)
  .max(200_000)
  .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/)

export const locationSymbolSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    viewBox: locationSymbolViewBoxSchema,
    pathData: pathDataSchema,
    fillRule: z.enum(['nonzero', 'evenodd']),
    position: z.number().int().nonnegative()
  })
  .strict()

export const locationSymbolDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    viewBox: locationSymbolViewBoxSchema,
    pathData: pathDataSchema,
    fillRule: z.enum(['nonzero', 'evenodd']).default('nonzero')
  })
  .strict()

export const locationSymbolSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    symbols: z.array(locationSymbolSchema)
  })
  .strict()

export const locationSymbolMutationReceiptSchema = z
  .object({
    snapshot: locationSymbolSnapshotSchema,
    saved: locationSymbolSchema
  })
  .strict()

export const createLocationSymbolInputSchema = z
  .object({
    symbol: locationSymbolDraftSchema,
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const locationSymbolSearchInputSchema = z
  .object({
    query: z.string().trim().max(100).default(''),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(24).default(24)
  })
  .strict()

export const locationSymbolPageSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    symbols: z.array(locationSymbolSchema).max(24)
  })
  .strict()

export const updateLocationSymbolInputSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().trim().min(1).max(100),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const locationSymbolDetailInputSchema = z
  .object({ id: z.uuid() })
  .strict()

export const locationSymbolUsageSchema = z
  .object({
    campaignId: z.uuid(),
    campaignName: z.string().min(1),
    trashed: z.boolean(),
    locationIds: z.array(z.uuid()),
    locationNames: z.array(z.string().min(1))
  })
  .strict()

export const locationSymbolDeleteImpactSchema = z
  .object({
    symbolId: z.uuid(),
    symbolName: z.string().min(1),
    totalLocations: z.number().int().nonnegative(),
    usages: z.array(locationSymbolUsageSchema)
  })
  .strict()

export const deleteLocationSymbolInputSchema = z
  .object({
    commandId: z.uuid(),
    id: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const locationSymbolDeleteResultSchema = z
  .object({
    status: z.enum(['applied', 'replayed']),
    commandId: z.uuid(),
    symbols: locationSymbolSnapshotSchema
  })
  .strict()

export const importLocationSymbolInputSchema = z
  .object({
    commandId: z.uuid(),
    displayName: z.string().trim().min(1).max(100),
    source: z.string().min(1).max(262_144),
    locationId: z.uuid(),
    expectedSymbolRevision: z.number().int().nonnegative(),
    expectedPresentationRevision: z.number().int().nonnegative()
  })
  .strict()

export const importLocationSymbolResultSchema = z
  .object({
    status: z.enum(['applied', 'replayed']),
    commandId: z.uuid(),
    symbols: locationSymbolSnapshotSchema,
    presentationRevision: z.number().int().nonnegative()
  })
  .strict()

export const locationSymbolChangeNoticeSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    changedSymbolIds: z.array(z.uuid()),
    reason: z.enum(['created', 'renamed', 'deleted'])
  })
  .strict()

export const svgSymbolFileResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }).strict(),
  z
    .object({
      status: z.literal('rejected'),
      reason: z.enum(['not_svg', 'too_large', 'read_failed'])
    })
    .strict(),
  z
    .object({
      status: z.literal('selected'),
      fileName: z.string().min(1).max(255),
      source: z.string().min(1).max(262_144)
    })
    .strict()
])

export type { BuiltinLocationSymbolId }
export type LocationSymbolId = z.infer<typeof locationSymbolIdSchema>
export type LocationSymbol = Readonly<z.infer<typeof locationSymbolSchema>>
export type LocationSymbolDraft = Readonly<
  z.input<typeof locationSymbolDraftSchema>
>
export type LocationSymbolSnapshot = Readonly<
  z.infer<typeof locationSymbolSnapshotSchema>
>
export type LocationSymbolMutationReceipt = EntityMutationReceipt<
  LocationSymbol,
  LocationSymbolSnapshot
>
export type LocationSymbolPage = Readonly<
  z.infer<typeof locationSymbolPageSchema>
>
export type LocationSymbolDeleteImpact = Readonly<
  z.infer<typeof locationSymbolDeleteImpactSchema>
>
export type LocationSymbolDeleteResult = Readonly<
  z.infer<typeof locationSymbolDeleteResultSchema>
>
export type LocationSymbolChangeNotice = Readonly<
  z.infer<typeof locationSymbolChangeNoticeSchema>
>
export type ImportLocationSymbolResult = Readonly<
  z.infer<typeof importLocationSymbolResultSchema>
>
export type SvgSymbolFileResult = Readonly<
  z.infer<typeof svgSymbolFileResultSchema>
>
