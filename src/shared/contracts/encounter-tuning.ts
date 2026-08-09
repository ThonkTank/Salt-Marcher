import { z } from 'zod'
import type {
  GeneratorPresetConfigV3,
  ResolvedGeneratorTuning
} from './generator-presets.js'

export const encounterDifficultyOverrideSchema = z.enum([
  'preset',
  'trivial',
  'easy',
  'medium',
  'hard',
  'deadly'
])

export const encounterTuningOverrideSchema = z
  .object({
    difficulty: encounterDifficultyOverrideSchema,
    amount: z.enum(['preset', 'few', 'standard', 'many']),
    balance: z.enum(['preset', 'even', 'varied']),
    diversity: z.enum(['preset', 'low', 'high'])
  })
  .strict()

export type EncounterTuningOverride = Readonly<
  z.infer<typeof encounterTuningOverrideSchema>
>

export function resolveEncounterTuning(
  override: EncounterTuningOverride,
  defaults: GeneratorPresetConfigV3['generationDefaults']
): ResolvedGeneratorTuning {
  return {
    difficulty:
      override.difficulty === 'preset'
        ? defaults.difficulty
        : override.difficulty,
    amount: override.amount === 'preset' ? defaults.amount : override.amount,
    balance:
      override.balance === 'preset' ? defaults.balance : override.balance,
    diversity:
      override.diversity === 'preset' ? defaults.diversity : override.diversity
  }
}
