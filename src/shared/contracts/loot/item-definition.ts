import { z } from 'zod'
import { itemReferenceKey } from '../../values/item-definition-values.js'

export {
  itemDefinitionLineValueCp,
  itemReferenceKey
} from '../../values/item-definition-values.js'

export const itemRaritySchema = z.enum([
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary'
])

export const catalogItemDefinitionReferenceSchema = z
  .object({
    kind: z.literal('catalog'),
    catalogVersion: z.string().min(1),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    entryKind: z.enum(['item', 'magic_item']),
    catalogId: z.string().min(1)
  })
  .strict()

export const generatedItemDefinitionReferenceSchema = z
  .object({
    kind: z.literal('generated'),
    runId: z.uuid(),
    definitionId: z.string().min(1)
  })
  .strict()

export const legacyItemDefinitionReferenceSchema = z
  .object({
    kind: z.literal('legacy'),
    definitionId: z.string().min(1)
  })
  .strict()

/**
 * Stable identity used by generated runs, mutable Treasure instances and the
 * character ledger. Definition facts never live on those owners.
 */
export const itemReferenceSchema = z.discriminatedUnion('kind', [
  catalogItemDefinitionReferenceSchema,
  generatedItemDefinitionReferenceSchema,
  legacyItemDefinitionReferenceSchema
])

export const coinDenominationComponentSchema = z
  .object({
    denominationId: z.enum(['pp', 'gp', 'ep', 'sp', 'cp']),
    quantity: z.number().int().positive()
  })
  .strict()

export const itemDefinitionComponentsSchema = z
  .object({
    baseItemId: z.string().min(1).nullable(),
    modifierId: z.string().min(1).nullable(),
    componentId: z.string().min(1).nullable(),
    magicItemId: z.string().min(1).nullable(),
    magicVariantId: z.string().min(1).nullable(),
    spellId: z.string().min(1).nullable(),
    enspelledRuleId: z.string().min(1).nullable(),
    curseId: z.string().min(1).nullable(),
    coinProfileId: z.string().min(1).nullable().optional(),
    coinDenominations: z.array(coinDenominationComponentSchema).max(5)
  })
  .strict()

export const itemDefinitionSchema = z
  .object({
    reference: itemReferenceSchema,
    name: z.string().min(1),
    unitValueCp: z.number().int().nonnegative(),
    exactUnitValueCp: z
      .object({
        numerator: z.string().regex(/^-?[0-9]+$/),
        denominator: z.string().regex(/^[1-9][0-9]*$/)
      })
      .strict()
      .optional(),
    unitCapacity: z.number().nonnegative(),
    stackable: z.boolean(),
    magic: z.boolean(),
    rarity: itemRaritySchema.nullable(),
    curse: z
      .object({
        catalogId: z.string().min(1).nullable(),
        name: z.string().min(1),
        effect: z.string().min(1)
      })
      .strict()
      .nullable(),
    components: itemDefinitionComponentsSchema
  })
  .strict()
  .superRefine((definition, context) => {
    if (!definition.magic && definition.rarity !== null)
      context.addIssue({
        code: 'custom',
        path: ['rarity'],
        message: 'Only magic definitions may have a rarity.'
      })
    if (!definition.magic && definition.curse !== null)
      context.addIssue({
        code: 'custom',
        path: ['curse'],
        message: 'Only magic definitions may have a curse.'
      })
    if (definition.magic && definition.rarity === null)
      context.addIssue({
        code: 'custom',
        path: ['rarity'],
        message: 'Magic definitions require a rarity.'
      })
    if (definition.components.curseId !== (definition.curse?.catalogId ?? null))
      context.addIssue({
        code: 'custom',
        path: ['components', 'curseId'],
        message: 'Curse component and resolved curse facts must agree.'
      })
  })

export const resolvedItemDefinitionSchema = z
  .object({
    itemReference: itemReferenceSchema,
    definition: itemDefinitionSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (
      itemReferenceKey(value.itemReference) !==
      itemReferenceKey(value.definition.reference)
    )
      context.addIssue({
        code: 'custom',
        path: ['definition', 'reference'],
        message: 'Resolved definition does not match the item reference.'
      })
  })

export type ItemRarity = z.infer<typeof itemRaritySchema>
export type ItemReference = Readonly<z.infer<typeof itemReferenceSchema>>
export type ItemDefinition = Readonly<z.infer<typeof itemDefinitionSchema>>
export type ResolvedItemDefinition = Readonly<
  z.infer<typeof resolvedItemDefinitionSchema>
>
export type ItemDefinitionComponents = Readonly<
  z.infer<typeof itemDefinitionComponentsSchema>
>

export const emptyItemDefinitionComponents: ItemDefinitionComponents =
  Object.freeze({
    baseItemId: null,
    modifierId: null,
    componentId: null,
    magicItemId: null,
    magicVariantId: null,
    spellId: null,
    enspelledRuleId: null,
    curseId: null,
    coinProfileId: null,
    coinDenominations: [] as Array<{
      denominationId: 'pp' | 'gp' | 'ep' | 'sp' | 'cp'
      quantity: number
    }>
  })
