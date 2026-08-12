import { z } from 'zod'
import { treasureSchema } from './treasure.js'

export const distributionShareSchema = z
  .object({ characterId: z.uuid(), quantity: z.number().int().positive() })
  .strict()

export const distributionItemSchema = z
  .object({ itemId: z.uuid(), shares: z.array(distributionShareSchema).min(1) })
  .strict()

export const completeLootDistributionInputSchema = z
  .object({
    commandId: z.uuid(),
    treasureId: z.uuid(),
    expectedTreasureRevision: z.number().int().nonnegative(),
    expectedPartyRevision: z.number().int().nonnegative(),
    items: z.array(distributionItemSchema).min(1)
  })
  .strict()

export const characterLootStatusSchema = z.enum([
  'received',
  'given_away',
  'sold'
])

export const characterLootEntrySchema = z
  .object({
    id: z.uuid(),
    characterId: z.uuid(),
    treasureId: z.uuid().nullable(),
    treasureItemId: z.uuid().nullable(),
    source: z.enum(['award', 'manual', 'purchase', 'correction']),
    itemName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitValueCp: z.number().int().nonnegative(),
    status: characterLootStatusSchema,
    provenance: z
      .object({
        kind: z.literal('treasure_distribution'),
        treasureLabel: z.string().min(1),
        recipientName: z.string().min(1)
      })
      .strict(),
    rewardProvenance: z
      .object({
        runId: z.uuid(),
        generatedTreasureId: z.string().min(1),
        rewardChannel: z.enum(['encounter', 'quest', 'environment'])
      })
      .strict()
      .nullable()
      .default(null),
    correctsEntryId: z.uuid().nullable().default(null),
    supersededByEntryId: z.uuid().nullable().default(null),
    correctionReason: z.string().min(1).nullable().default(null),
    receivedAt: z.iso.datetime()
  })
  .strict()

export const characterLootLedgerSchema = z
  .object({
    characterId: z.uuid(),
    revision: z.number().int().nonnegative().default(0),
    entries: z.array(characterLootEntrySchema)
  })
  .strict()

export const characterLootInputSchema = z
  .object({ characterId: z.uuid() })
  .strict()

export const correctCharacterLootInputSchema = z
  .object({
    commandId: z.uuid(),
    characterId: z.uuid(),
    entryId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    itemName: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unitValueCp: z.number().int().nonnegative(),
    status: characterLootStatusSchema,
    reason: z.string().trim().min(1).max(500)
  })
  .strict()

export const lootDistributionResultSchema = z
  .object({
    treasure: treasureSchema,
    createdEntries: z.array(characterLootEntrySchema)
  })
  .strict()

export type CompleteLootDistributionInput = Readonly<
  z.infer<typeof completeLootDistributionInputSchema>
>
export type CharacterLootEntry = Readonly<
  z.infer<typeof characterLootEntrySchema>
>
export type CharacterLootLedger = Readonly<
  z.infer<typeof characterLootLedgerSchema>
>
export type CorrectCharacterLootInput = Readonly<
  z.infer<typeof correctCharacterLootInputSchema>
>
export type LootDistributionResult = Readonly<
  z.infer<typeof lootDistributionResultSchema>
>
