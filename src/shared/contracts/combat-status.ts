import { z } from 'zod'
import { combatConditions } from '../values/combat-values.js'

export { combatConditions }

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
