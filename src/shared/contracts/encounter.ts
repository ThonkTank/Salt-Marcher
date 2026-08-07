import { z } from 'zod'
import { creatureSchema } from './creature.js'

export {
  creatureActionSchema,
  creatureSchema,
  type Creature,
  type CreatureAction
} from './creature.js'

const textList = z.array(z.string())
const catalogOptionSchema = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict()

export const creatureCatalogQuerySchema = z
  .object({
    name: z.string().max(100).default(''),
    crMin: z.number().nonnegative().optional(),
    crMax: z.number().nonnegative().optional(),
    sizes: textList.default([]),
    types: textList.default([]),
    subtypes: textList.default([]),
    biomes: textList.default([]),
    alignments: textList.default([]),
    encounterTableIds: textList.default([]),
    factionIds: textList.default([]),
    locationId: z.string().nullable().default(null),
    sort: z.enum(['name', 'cr', 'xp']).default('name'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(100).default(50)
  })
  .strict()
  .refine(
    (query) =>
      query.crMin === undefined ||
      query.crMax === undefined ||
      query.crMin <= query.crMax,
    { message: 'CR minimum must not exceed maximum' }
  )

export const creatureFilterOptionsSchema = z
  .object({
    challengeRatings: textList,
    sizes: textList,
    types: textList,
    subtypes: textList,
    biomes: z.array(catalogOptionSchema),
    alignments: textList,
    encounterTables: z.array(catalogOptionSchema),
    factions: z.array(catalogOptionSchema),
    locations: z.array(catalogOptionSchema)
  })
  .strict()

export const creatureCatalogPageSchema = z
  .object({
    status: z.enum(['ready', 'empty', 'invalid', 'unavailable', 'failed']),
    rows: z.array(creatureSchema),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    message: z.string()
  })
  .strict()

export type CreatureCatalogQuery = Readonly<
  z.infer<typeof creatureCatalogQuerySchema>
>
export type CreatureCatalogPage = Readonly<
  z.infer<typeof creatureCatalogPageSchema>
>
export type CreatureFilterOptions = Readonly<
  z.infer<typeof creatureFilterOptionsSchema>
>
