import { z } from 'zod'

export const encounterTableScopeSchema = z.enum(['installation', 'campaign'])

export const encounterTableEntrySchema = z
  .object({
    creatureId: z.string().min(1),
    weight: z.number().int().min(1).max(10),
    position: z.number().int().nonnegative()
  })
  .strict()

export const encounterTableSchema = z
  .object({
    id: z.uuid(),
    scope: encounterTableScopeSchema.default('campaign'),
    protected: z.boolean().default(false),
    displayName: z.string().min(1).max(100),
    description: z.string().max(20_000),
    position: z.number().int().nonnegative(),
    entries: z.array(encounterTableEntrySchema)
  })
  .strict()

export const encounterTableDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    description: z.string().trim().max(20_000),
    entries: z
      .array(
        z
          .object({
            creatureId: z.string().min(1),
            weight: z.number().int().min(1).max(10)
          })
          .strict()
      )
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.creatureId)).size ===
          entries.length,
        { message: 'Encounter table entries must be unique' }
      )
  })
  .strict()

export const encounterTableSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    installationRevision: z.number().int().nonnegative().default(0),
    campaignRevision: z.number().int().nonnegative().default(0),
    tables: z.array(encounterTableSchema)
  })
  .strict()

export const factionInventoryEntrySchema = z
  .object({
    creatureId: z.string().min(1),
    maximum: z.number().int().nonnegative()
  })
  .strict()

export const worldFactionSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1).max(100),
    notes: z.string().max(20_000),
    disposition: z.number().int().min(-50).max(50),
    primaryEncounterTableId: z.uuid().nullable(),
    position: z.number().int().nonnegative(),
    inventory: z.array(factionInventoryEntrySchema)
  })
  .strict()

export const worldFactionDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    notes: z.string().trim().max(20_000),
    disposition: z.number().int().min(-50).max(50),
    primaryEncounterTableId: z.uuid().nullable(),
    inventory: z
      .array(factionInventoryEntrySchema)
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.creatureId)).size ===
          entries.length,
        { message: 'Faction inventory entries must be unique' }
      )
  })
  .strict()

export const worldFactionSnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    factions: z.array(worldFactionSchema)
  })
  .strict()

const mutationBaseSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict()

const encounterTableMutationBaseSchema = mutationBaseSchema
  .extend({ commandId: z.uuid() })
  .strict()

export const createEncounterTableInputSchema = encounterTableMutationBaseSchema
  .extend({
    scope: encounterTableScopeSchema.default('campaign'),
    table: encounterTableDraftSchema
  })
  .strict()
export const updateEncounterTableInputSchema = createEncounterTableInputSchema
  .extend({ id: z.uuid() })
  .strict()
export const deleteEncounterTableInputSchema = encounterTableMutationBaseSchema
  .extend({
    id: z.uuid(),
    scope: encounterTableScopeSchema.default('campaign')
  })
  .strict()

export const encounterTableChangeNoticeSchema = z
  .object({
    installationRevision: z.number().int().nonnegative(),
    campaignRevision: z.number().int().nonnegative(),
    changedTableIds: z.array(z.uuid()),
    scope: encounterTableScopeSchema,
    reason: z.enum(['created', 'updated', 'deleted'])
  })
  .strict()
  .readonly()

export const createWorldFactionInputSchema = mutationBaseSchema
  .extend({ faction: worldFactionDraftSchema })
  .strict()
export const updateWorldFactionInputSchema = createWorldFactionInputSchema
  .extend({ id: z.uuid() })
  .strict()
export const deleteWorldFactionInputSchema = mutationBaseSchema
  .extend({ id: z.uuid() })
  .strict()

export type EncounterTable = Readonly<z.infer<typeof encounterTableSchema>>
export type EncounterTableScope = z.infer<typeof encounterTableScopeSchema>
export type EncounterTableDraft = Readonly<
  z.infer<typeof encounterTableDraftSchema>
>
export type EncounterTableSnapshot = Readonly<
  z.infer<typeof encounterTableSnapshotSchema>
>
export type EncounterTableChangeNotice = Readonly<
  z.infer<typeof encounterTableChangeNoticeSchema>
>
export type WorldFaction = Readonly<z.infer<typeof worldFactionSchema>>
export type WorldFactionDraft = Readonly<
  z.infer<typeof worldFactionDraftSchema>
>
export type WorldFactionSnapshot = Readonly<
  z.infer<typeof worldFactionSnapshotSchema>
>
