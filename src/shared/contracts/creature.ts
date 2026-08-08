import { z } from 'zod'

const textList = z.array(z.string())

export const creatureActionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string()
  })
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

export type Creature = Readonly<z.infer<typeof creatureSchema>>
export type CreatureAction = Readonly<z.infer<typeof creatureActionSchema>>
