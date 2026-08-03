import { z } from 'zod'

export const worldLocationSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    notes: z.string().max(20_000),
    position: z.number().int().nonnegative(),
    factionIds: z.array(z.uuid()),
    encounterTableIds: z.array(z.uuid())
  })
  .strict()

export const worldLocationSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    locations: z.array(worldLocationSchema)
  })
  .strict()

export const worldLocationDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
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

export type WorldLocation = Readonly<z.infer<typeof worldLocationSchema>>
export type WorldLocationDraft = Readonly<
  z.input<typeof worldLocationDraftSchema>
>
export type WorldLocationSnapshot = Readonly<
  z.infer<typeof worldLocationSnapshotSchema>
>
