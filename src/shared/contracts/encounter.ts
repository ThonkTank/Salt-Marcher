import { z } from 'zod'

const textList = z.array(z.string())

export const creatureActionSchema = z
  .object({ name: z.string(), description: z.string() })
  .strict()

export const creatureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    cr: z.number().nonnegative(),
    challengeRating: z.string(),
    xp: z.number().int().nonnegative(),
    type: z.string(),
    subtype: z.string(),
    size: z.string(),
    alignment: z.string(),
    biomes: textList,
    ac: z.number().int(),
    hp: z.number().int(),
    hitDice: z.string(),
    speed: z.string(),
    initiative: z.number().int(),
    abilities: z
      .object({
        str: z.number().int(),
        dex: z.number().int(),
        con: z.number().int(),
        int: z.number().int(),
        wis: z.number().int(),
        cha: z.number().int()
      })
      .strict(),
    senses: z.string(),
    languages: z.string(),
    savingThrows: z.string(),
    skills: z.string(),
    damageVulnerabilities: z.string(),
    damageResistances: z.string(),
    damageImmunities: z.string(),
    conditionImmunities: z.string(),
    traits: z.array(creatureActionSchema),
    actions: z.array(creatureActionSchema),
    legendaryActions: z.array(creatureActionSchema),
    details: z.string()
  })
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
    biomes: textList,
    alignments: textList,
    encounterTables: z.array(
      z.object({ id: z.string(), label: z.string() }).strict()
    ),
    factions: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
    locations: z.array(z.object({ id: z.string(), label: z.string() }).strict())
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

export type Creature = Readonly<z.infer<typeof creatureSchema>>
export type CreatureCatalogQuery = Readonly<
  z.infer<typeof creatureCatalogQuerySchema>
>
export type CreatureCatalogPage = Readonly<
  z.infer<typeof creatureCatalogPageSchema>
>
export type CreatureFilterOptions = Readonly<
  z.infer<typeof creatureFilterOptionsSchema>
>
