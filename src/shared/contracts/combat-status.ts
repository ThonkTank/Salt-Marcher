import { z } from 'zod'

export const combatConditions = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious'
] as const

export const combatConditionSchema = z.enum(combatConditions)
export const exhaustionLevelSchema = z.number().int().min(0).max(6)
export const combatStatusSchema = z
  .object({
    conditions: z.array(combatConditionSchema),
    concentrating: z.boolean(),
    exhaustionLevel: exhaustionLevelSchema
  })
  .strict()

export type CombatCondition = z.infer<typeof combatConditionSchema>
export type CombatStatus = Readonly<z.infer<typeof combatStatusSchema>>
