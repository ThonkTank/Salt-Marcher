import { z } from 'zod'

export const encounterDifficultySchema = z.enum([
  'auto',
  'easy',
  'medium',
  'hard',
  'deadly'
])

export const encounterTuningSchema = z
  .object({
    difficulty: encounterDifficultySchema,
    amount: z.enum(['auto', 'few', 'standard', 'many']),
    balance: z.enum(['auto', 'even', 'varied']),
    diversity: z.enum(['auto', 'low', 'high'])
  })
  .strict()

export type EncounterTuning = Readonly<z.infer<typeof encounterTuningSchema>>
