import { z } from 'zod'
import {
  anyBiomeEncounterTableId,
  placeholderBiomeId
} from '../biomes/constants.js'

export { anyBiomeEncounterTableId, placeholderBiomeId }

export const builtinBiomeIdSchema = z.enum([
  'grassland',
  'desert',
  'forest',
  'swamp',
  'mountain',
  'water',
  'arctic',
  'coastal',
  'hill',
  'tundra',
  'ice',
  'jungle',
  'cavern',
  'underdark',
  'lake',
  'ocean',
  'underwater',
  'volcano',
  'ruin',
  'settlement',
  'urban',
  'sewer',
  'temple',
  'tomb',
  'laboratory',
  'astral-plane',
  'ethereal-plane',
  'feywild',
  'shadowfell',
  'abyss',
  'hell',
  'plane-of-air',
  'plane-of-earth',
  'plane-of-fire',
  'plane-of-water'
])

export const customBiomeIdSchema = z.uuid()
export const paintableBiomeIdSchema = z.union([
  builtinBiomeIdSchema,
  customBiomeIdSchema
])
export const biomeIdSchema = z.union([
  paintableBiomeIdSchema,
  z.literal(placeholderBiomeId)
])

export const biomeDefinitionSchema = z
  .object({
    id: biomeIdSchema,
    kind: z.enum(['builtin', 'custom', 'placeholder']),
    displayName: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    passable: z.boolean(),
    travelCost: z.number().min(0.1).max(100),
    position: z.number().int().nonnegative(),
    protected: z.boolean(),
    aliases: z.array(z.string().min(1).max(100)),
    encounterTableIds: z.array(z.uuid())
  })
  .strict()

export const biomeDraftSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    passable: z.boolean(),
    travelCost: z.number().min(0.1).max(100),
    encounterTableIds: z
      .array(z.uuid())
      .refine((values) => new Set(values).size === values.length, {
        message: 'Biome encounter table references must be unique.'
      })
  })
  .strict()

export const biomePageSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(60),
    biomes: z.array(biomeDefinitionSchema).max(60)
  })
  .strict()

export const biomeSearchInputSchema = z
  .object({
    query: z.string().max(100).default(''),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(60).default(60)
  })
  .strict()

export const biomeDetailInputSchema = z.object({ id: biomeIdSchema }).strict()

export const biomeCatalogMutationResultSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    biome: biomeDefinitionSchema.nullable()
  })
  .strict()

const biomeMutationBaseSchema = z
  .object({
    commandId: z.uuid(),
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const createBiomeInputSchema = biomeMutationBaseSchema
  .extend({ biome: biomeDraftSchema })
  .strict()
export const updateBiomeInputSchema = createBiomeInputSchema
  .extend({ id: paintableBiomeIdSchema })
  .strict()
export const deleteBiomeInputSchema = biomeMutationBaseSchema
  .extend({ id: customBiomeIdSchema })
  .strict()

export const biomeUsageSchema = z
  .object({
    campaignId: z.uuid(),
    campaignName: z.string().min(1),
    trashed: z.boolean(),
    maps: z.array(
      z
        .object({
          mapId: z.uuid(),
          mapName: z.string().min(1),
          tileCount: z.number().int().positive()
        })
        .strict()
    )
  })
  .strict()

export const biomeDeleteImpactSchema = z
  .object({
    biomeId: customBiomeIdSchema,
    biomeName: z.string().min(1),
    totalMaps: z.number().int().nonnegative(),
    totalTiles: z.number().int().nonnegative(),
    usages: z.array(biomeUsageSchema)
  })
  .strict()

export const biomeChangeNoticeSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    changedBiomeIds: z.array(biomeIdSchema),
    reason: z.enum(['created', 'updated', 'deleted'])
  })
  .strict()

export type BuiltinBiomeId = z.infer<typeof builtinBiomeIdSchema>
export type BiomeId = z.infer<typeof biomeIdSchema>
export type PaintableBiomeId = z.infer<typeof paintableBiomeIdSchema>
export type BiomeDefinition = Readonly<z.infer<typeof biomeDefinitionSchema>>
export type BiomeDraft = Readonly<z.infer<typeof biomeDraftSchema>>
export type BiomePage = Readonly<z.infer<typeof biomePageSchema>>
export type BiomeCatalogMutationResult = Readonly<
  z.infer<typeof biomeCatalogMutationResultSchema>
>
export type BiomeDeleteImpact = Readonly<
  z.infer<typeof biomeDeleteImpactSchema>
>
export type BiomeChangeNotice = Readonly<
  z.infer<typeof biomeChangeNoticeSchema>
>
