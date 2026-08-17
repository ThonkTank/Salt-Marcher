import { z } from 'zod'
import { itemDefinitionSchema, itemReferenceSchema } from './item-definition.js'

export const lootRaritySchema = z.enum([
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary'
])

const lootCatalogTextListSchema = z.array(z.string().min(1))

export const lootCatalogQuerySchema = z
  .object({
    runId: z.uuid().nullable().default(null),
    catalogContentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable()
      .default(null),
    search: z.string().trim().max(100).default(''),
    types: lootCatalogTextListSchema.default([]),
    categories: lootCatalogTextListSchema.default([]),
    rarities: z.array(lootRaritySchema).default([]),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(100).default(30)
  })
  .strict()

export const lootCatalogEntrySchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('item'),
      id: z.string().min(1),
      defaultName: z.string().min(1),
      type: z.string().min(1),
      category: z.string().min(1),
      unitValueCp: z.number().int().nonnegative().safe(),
      stackable: z.boolean(),
      magic: z.literal(false),
      rarity: z.null(),
      itemReference: itemReferenceSchema,
      definition: itemDefinitionSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('magic_item'),
      id: z.string().min(1),
      defaultName: z.string().min(1),
      type: z.string().min(1),
      category: z.null(),
      unitValueCp: z.literal(0),
      stackable: z.literal(false),
      magic: z.literal(true),
      rarity: lootRaritySchema,
      itemReference: itemReferenceSchema,
      definition: itemDefinitionSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('container'),
      id: z.string().min(1),
      defaultName: z.string().min(1),
      type: z.literal('container'),
      category: z.null(),
      capacity: z.number().nonnegative()
    })
    .strict()
])

export const lootCatalogPageSchema = z
  .object({
    runId: z.uuid().nullable(),
    catalogVersion: z.string().min(1),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    entries: z.array(lootCatalogEntrySchema),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    filterOptions: z
      .object({
        types: lootCatalogTextListSchema,
        categories: lootCatalogTextListSchema,
        rarities: z.array(lootRaritySchema)
      })
      .strict()
  })
  .strict()

export type LootRarity = z.infer<typeof lootRaritySchema>
export type LootCatalogQuery = Readonly<z.infer<typeof lootCatalogQuerySchema>>
export type LootCatalogEntry = Readonly<z.infer<typeof lootCatalogEntrySchema>>
export type LootCatalogPage = Readonly<z.infer<typeof lootCatalogPageSchema>>
