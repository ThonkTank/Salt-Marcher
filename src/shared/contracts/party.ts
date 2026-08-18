import { z } from 'zod'

export const partyCharacterSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(100),
    playerName: z.string().max(100).nullable(),
    species: z.string().max(100).nullable(),
    characterClass: z.string().max(100).nullable(),
    languages: z.array(z.string().min(1).max(100)).max(100),
    level: z.number().int().min(1).max(20),
    passivePerception: z.number().int().min(0).max(99).nullable(),
    passiveInvestigation: z.number().int().min(0).max(99).nullable(),
    passiveInsight: z.number().int().min(0).max(99).nullable(),
    armorClass: z.number().int().min(0).max(99).nullable(),
    movementSpeedFeet: z.number().int().min(0).max(999).nullable(),
    travelPosition: z
      .object({
        kind: z.literal('hex'),
        mapId: z.uuid(),
        q: z.number().int().safe(),
        r: z.number().int().safe()
      })
      .strict()
      .nullable(),
    attachedToPartyToken: z.boolean(),
    active: z.boolean(),
    xp: z.number().int().nonnegative().safe(),
    currentLevelFloor: z.number().int().nonnegative(),
    nextLevelXp: z.number().int().nonnegative().nullable(),
    xpSinceShortRest: z.number().int().nonnegative(),
    xpSinceLongRest: z.number().int().nonnegative()
  })
  .strict()

export const adventuringDaySummarySchema = z
  .object({
    available: z.boolean(),
    partySize: z.number().int().nonnegative(),
    dailyBudget: z.number().int().nonnegative(),
    shortRestXp: z.number().int().nonnegative(),
    longRestXp: z.number().int().nonnegative()
  })
  .strict()

export const partySnapshotSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    members: z.array(partyCharacterSchema),
    adventuringDay: adventuringDaySummarySchema
  })
  .strict()

export const partyCharacterDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    playerName: z.string().trim().max(100).nullable(),
    species: z.string().trim().max(100).nullable().default(null),
    characterClass: z.string().trim().max(100).nullable().default(null),
    languages: z
      .array(z.string().trim().min(1).max(100))
      .max(100)
      .refine(
        (values) =>
          new Set(values.map((value) => value.toLocaleLowerCase())).size ===
          values.length,
        { message: 'Languages must be unique' }
      )
      .default([]),
    level: z.number().int().min(1).max(20).nullable().default(null),
    passivePerception: z.number().int().min(0).max(99).nullable(),
    passiveInvestigation: z
      .number()
      .int()
      .min(0)
      .max(99)
      .nullable()
      .default(null),
    passiveInsight: z.number().int().min(0).max(99).nullable().default(null),
    armorClass: z.number().int().min(0).max(99).nullable(),
    movementSpeedFeet: z.number().int().min(0).max(999).nullable().default(null)
  })
  .strict()

export const partyMutationBaseSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict()

export const createPartyCharacterInputSchema = partyMutationBaseSchema
  .extend({ character: partyCharacterDraftSchema })
  .strict()

export const updatePartyCharacterInputSchema = createPartyCharacterInputSchema
  .extend({ id: z.uuid() })
  .strict()

export const deletePartyCharacterInputSchema = partyMutationBaseSchema
  .extend({ id: z.uuid() })
  .strict()

export const setMembershipInputSchema = deletePartyCharacterInputSchema
  .extend({ active: z.boolean() })
  .strict()

export const adjustPartyXpInputSchema = deletePartyCharacterInputSchema
  .extend({ delta: z.number().int().min(-1_000_000).max(1_000_000) })
  .strict()

export const restPartyInputSchema = partyMutationBaseSchema
  .extend({ type: z.enum(['short', 'long']) })
  .strict()

export const adventuringDayInputSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            level: z.number().int().min(1).max(20),
            count: z.number().int().min(1).max(99)
          })
          .strict()
      )
      .max(20),
    totalXp: z.number().int().nonnegative().optional()
  })
  .strict()

export const adventuringDayCalculationSchema = z
  .object({
    dailyBudget: z.number().int().nonnegative(),
    totalXp: z.number().int().nonnegative(),
    completedDays: z.number().int().nonnegative(),
    dayProgress: z.number().min(0).max(1),
    shortRests: z.number().int().nonnegative(),
    longRests: z.number().int().nonnegative(),
    timeline: z.array(z.string())
  })
  .strict()

export type PartyCharacter = Readonly<z.infer<typeof partyCharacterSchema>>
export type PartySnapshot = Readonly<z.infer<typeof partySnapshotSchema>>
export type PartyCharacterDraft = Readonly<
  z.input<typeof partyCharacterDraftSchema>
>
export type AdventuringDaySummary = Readonly<
  z.infer<typeof adventuringDaySummarySchema>
>
export type AdventuringDayCalculation = Readonly<
  z.infer<typeof adventuringDayCalculationSchema>
>
