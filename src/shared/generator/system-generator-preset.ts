import {
  generatorConfigSchema,
  type GeneratorPresetConfigV5
} from '../contracts/generator-presets.js'
import {
  generatorChallengeRatings,
  type GeneratorRole,
  type GeneratorRoleCell
} from './generator-config-model.js'
import { defaultGeneratorLootRules } from './default-loot-rules.js'

/**
 * Generated from catalog-2026-08-16/DB_EncounterRoleBands.tsv and
 * DB_EncounterPatterns.tsv. The session-generation artifact check verifies the
 * compact generated representation against the pinned source tables.
 */
export const systemGeneratorPresetSource = Object.freeze({
  catalogVersion: 'catalog-2026-08-16',
  roleBandsSha256:
    '4575163d8ab46e30f0c1a2b9835b96bac8dfe0008c4b04509b9419aa3f55a0ae',
  patternsSha256:
    '7ecf49d71b5c800ec24b9ab47fbbfa5d46825fac4b22f3b28cacc66a730fb548'
})

const roleBandStarts = [
  [1, 2, 3, 4],
  [2, 3, 4, 5],
  [3, 4, 5, 6],
  [3, 4, 5, 7],
  [3, 5, 6, 8],
  [4, 5, 6, 9],
  [4, 5, 7, 10],
  [4, 5, 7, 11],
  [4, 6, 8, 12],
  [4, 6, 8, 13],
  [5, 7, 12, 17],
  [5, 7, 12, 18],
  [5, 8, 13, 20],
  [5, 8, 14, 21],
  [5, 8, 15, 22],
  [5, 9, 15, 23],
  [6, 12, 19, 25],
  [6, 12, 20, 26],
  [7, 13, 21, 27],
  [7, 13, 21, 28]
] as const

export function systemGeneratorRoleMatrix(): GeneratorRoleCell[][] {
  return roleBandStarts.map(([support, standard, elite, boss]) =>
    generatorChallengeRatings.map((_, index) =>
      index >= boss
        ? 'boss'
        : index >= elite
          ? 'elite'
          : index >= standard
            ? 'standard'
            : index >= support
              ? 'support'
              : 'minion'
    )
  )
}

export const systemGeneratorRoleCombinations: GeneratorRole[][] = [
  ['minion'],
  ['support'],
  ['support', 'minion'],
  ['standard'],
  ['standard', 'support'],
  ['standard', 'minion'],
  ['elite'],
  ['elite', 'standard'],
  ['elite', 'support'],
  ['elite', 'minion'],
  ['elite', 'standard', 'support'],
  ['elite', 'standard', 'minion'],
  ['elite', 'support', 'minion'],
  ['boss'],
  ['boss', 'elite'],
  ['boss', 'standard'],
  ['boss', 'support'],
  ['boss', 'minion'],
  ['boss', 'elite', 'standard'],
  ['boss', 'elite', 'support'],
  ['boss', 'elite', 'minion'],
  ['boss', 'standard', 'support'],
  ['boss', 'standard', 'minion'],
  ['boss', 'support', 'minion']
]

export const defaultGeneratorConfig: GeneratorPresetConfigV5 =
  generatorConfigSchema.parse({
    composition: {
      roleMatrix: systemGeneratorRoleMatrix(),
      roleQuantities: {
        minion: { min: 4, max: 10 },
        support: { min: 2, max: 5 },
        standard: { min: 1, max: 5 },
        elite: { min: 1, max: 2 },
        boss: { min: 1, max: 1 }
      },
      roleCombinations: systemGeneratorRoleCombinations,
      crBlocks: { min: 1, max: 3 },
      statblocks: { min: 2, max: 4 },
      monsters: {
        min: { value: 3, perPlayer: false },
        max: { value: 8, perPlayer: false }
      },
      initiativeSlots: {
        min: { value: 1, perPlayer: true },
        max: { value: 1.5, perPlayer: true }
      },
      mixing: 'mixed-within-cr-block'
    },
    generationDefaults: {
      difficulty: 'weighted',
      amount: 'standard',
      balance: 'neutral',
      diversity: 'neutral'
    },
    scene: {
      difficultyWeights: {
        trivial: 10,
        easy: 25,
        medium: 30,
        hard: 25,
        deadly: 10
      }
    },
    combat: { mobThreshold: 6 },
    loot: defaultGeneratorLootRules
  })
