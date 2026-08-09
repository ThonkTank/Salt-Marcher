import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  generatorConfigSchema,
  scaledRangeSchema
} from '../../src/shared/contracts/generator-presets.js'
import {
  generatorChallengeRatings,
  maximumCompositionComplexity
} from '../../src/shared/generator/generator-config-model.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import {
  catalogManifestSchema,
  parseEncounterCatalog
} from '../../src/core/session-generation/catalog.js'

const catalogRoot = join(
  process.cwd(),
  'resources/sessiongeneration/catalog-2026-07-16'
)

function catalog() {
  return parseEncounterCatalog({
    manifest: catalogManifestSchema.parse(
      JSON.parse(readFileSync(join(catalogRoot, 'manifest.json'), 'utf8'))
    ),
    tables: {
      progression: readFileSync(
        join(catalogRoot, 'DB_Progression.tsv'),
        'utf8'
      ),
      challengeRatings: readFileSync(join(catalogRoot, 'DB_CR.tsv'), 'utf8'),
      roleBands: readFileSync(
        join(catalogRoot, 'DB_EncounterRoleBands.tsv'),
        'utf8'
      ),
      patterns: readFileSync(
        join(catalogRoot, 'DB_EncounterPatterns.tsv'),
        'utf8'
      )
    }
  })
}

describe('encounter generator configuration', () => {
  it('pins the Sheet-derived role matrix, quantities, and combinations', () => {
    expect(generatorConfigSchema.parse(defaultGeneratorConfig)).toEqual(
      defaultGeneratorConfig
    )
    expect(defaultGeneratorConfig.composition.roleMatrix).toHaveLength(20)
    expect(
      defaultGeneratorConfig.composition.roleMatrix.every(
        (row) => row.length === generatorChallengeRatings.length
      )
    ).toBe(true)
    expect(
      defaultGeneratorConfig.composition.roleMatrix[0]?.slice(0, 6)
    ).toEqual(['minion', 'support', 'standard', 'elite', 'boss', 'boss'])
    expect(defaultGeneratorConfig.composition.roleQuantities).toEqual({
      minion: { min: 4, max: 10 },
      support: { min: 2, max: 5 },
      standard: { min: 1, max: 5 },
      elite: { min: 1, max: 2 },
      boss: { min: 1, max: 1 }
    })
    expect(defaultGeneratorConfig.composition.roleCombinations).toHaveLength(24)
    expect(defaultGeneratorConfig).toMatchObject({
      scene: {
        difficultyWeights: {
          trivial: 10,
          easy: 25,
          medium: 30,
          hard: 25,
          deadly: 10
        }
      },
      composition: {
        statblocks: { min: 2, max: 4 },
        crBlocks: { min: 1, max: 3 },
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
      combat: { mobThreshold: 6 }
    })

    const pinned = catalog()
    const crById = new Map(
      pinned.challengeRatings.map((rating) => [rating.id, rating.label])
    )
    const sheetMatrix = Array.from({ length: 20 }, (_, level) =>
      generatorChallengeRatings.map((rating) => {
        const band = pinned.roleBands.find(
          (entry) =>
            entry.active &&
            entry.partyLevel === level + 1 &&
            crById.get(entry.crId) === rating
        )
        return band?.role.toLowerCase()
      })
    )
    expect(defaultGeneratorConfig.composition.roleMatrix).toEqual(sheetMatrix)
    expect(defaultGeneratorConfig.composition.roleCombinations).toEqual(
      pinned.patterns
        .filter((pattern) => pattern.active)
        .map((pattern) => pattern.roles.map((role) => role.toLowerCase()))
    )
  })

  it('rejects invalid distributions and duplicate role combinations', () => {
    expect(
      generatorConfigSchema.safeParse({
        ...defaultGeneratorConfig,
        scene: {
          difficultyWeights: {
            ...defaultGeneratorConfig.scene.difficultyWeights,
            deadly: 11
          }
        }
      }).success
    ).toBe(false)
    for (const roleCombinations of [[], [['boss'], ['boss']]])
      expect(
        generatorConfigSchema.safeParse({
          ...defaultGeneratorConfig,
          composition: {
            ...defaultGeneratorConfig.composition,
            roleCombinations
          }
        }).success
      ).toBe(false)
    expect(
      generatorConfigSchema.safeParse({
        ...defaultGeneratorConfig,
        composition: {
          ...defaultGeneratorConfig.composition,
          roleQuantities: {
            ...defaultGeneratorConfig.composition.roleQuantities,
            boss: { min: 0, max: 1 }
          }
        }
      }).success
    ).toBe(false)
  })

  it('validates scaled ranges for every positive party size and bounds complexity', () => {
    expect(
      scaledRangeSchema.safeParse({
        min: { value: 2, perPlayer: false },
        max: { value: 1, perPlayer: false }
      }).success
    ).toBe(false)
    expect(
      scaledRangeSchema.safeParse({
        min: { value: 2, perPlayer: true },
        max: { value: 1, perPlayer: true }
      }).success
    ).toBe(false)
    expect(
      scaledRangeSchema.safeParse({
        min: { value: 2, perPlayer: false },
        max: { value: 1, perPlayer: true }
      }).success
    ).toBe(false)
    expect(
      scaledRangeSchema.safeParse({
        min: { value: 1, perPlayer: true },
        max: { value: 2, perPlayer: false }
      }).success
    ).toBe(false)
    expect(
      scaledRangeSchema.safeParse({
        min: { value: 0, perPlayer: true },
        max: { value: 2, perPlayer: false }
      }).success
    ).toBe(true)
    const complexity = maximumCompositionComplexity(
      defaultGeneratorConfig.composition
    )
    expect(complexity.partyLevel).toBeGreaterThanOrEqual(1)
    expect(complexity.count).toBe(97_985)

    const excessive = structuredClone(defaultGeneratorConfig)
    excessive.composition.roleMatrix[0] = generatorChallengeRatings.map(
      (_, index) =>
        index < 11 ? 'minion' : index < 22 ? 'support' : 'standard'
    )
    excessive.composition.roleQuantities = {
      ...excessive.composition.roleQuantities,
      minion: { min: 1, max: 99 },
      support: { min: 1, max: 99 },
      standard: { min: 1, max: 99 }
    }
    excessive.composition.roleCombinations = [['minion', 'support', 'standard']]
    excessive.composition.crBlocks = { min: 3, max: 3 }
    const invalid = generatorConfigSchema.safeParse(excessive)
    expect(invalid.success).toBe(false)
    if (!invalid.success)
      expect(invalid.error.issues[0]?.message).toMatch(
        /Party level 1 produces \d+ candidates; maximum is 250000/
      )
  })
})
