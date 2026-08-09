import { describe, expect, it } from 'vitest'
import { generateSceneGroupDraft } from '../../src/core/scene/group-generator.js'
import type { ResolvedEncounterSource } from '../../src/core/application/encounter-source-service.js'
import { generateSessionEncounters } from '../../src/core/session-generation/encounter-engine.js'
import type { EncounterCatalog } from '../../src/core/session-generation/catalog.js'
import type { CreatureCatalogQuery } from '../../src/shared/contracts/encounter.js'
import {
  resolveEncounterTuning,
  type EncounterTuningOverride
} from '../../src/shared/contracts/encounter-tuning.js'
import type { PartyMember } from '../../src/shared/contracts/live-session.js'
import type {
  RunningScene,
  SceneGroupDraftEntry
} from '../../src/shared/contracts/scene.js'
import type { GeneratorPresetConfigV3 } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

const query: CreatureCatalogQuery = {
  name: '',
  sizes: [],
  types: [],
  subtypes: [],
  biomes: [],
  alignments: [],
  encounterTableIds: [],
  factionIds: [],
  locationId: null,
  sort: 'name',
  direction: 'asc',
  offset: 0,
  limit: 50
}

const tuning: EncounterTuningOverride = {
  difficulty: 'preset',
  amount: 'preset',
  balance: 'preset',
  diversity: 'preset'
}

const scene = {
  id: '00000000-0000-0000-0000-000000000000',
  groups: [],
  title: 'Generator test',
  locationId: null,
  locationName: ''
} as unknown as RunningScene

const party = [
  { level: 3, active: true },
  { level: 3, active: true },
  { level: 3, active: true },
  { level: 3, active: true }
] as unknown as PartyMember[]

function generate(
  seed: number,
  entries: readonly SceneGroupDraftEntry[] = [],
  mode: 'fill' | 'replace' = 'replace'
) {
  return generateSceneGroupDraft(
    scene,
    party,
    entries,
    mode,
    query,
    {
      ...defaultGeneratorConfig,
      generationDefaults: resolveEncounterTuning(
        tuning,
        defaultGeneratorConfig.generationDefaults
      )
    },
    seed,
    0
  )
}

function signature(result: ReturnType<typeof generate>): string {
  return result.entries
    .map((entry) => `${entry.creatureId}:${entry.quantity}`)
    .join('|')
}

function focusedConfig(
  mixing: 'mixed-within-cr-block' | 'one-per-cr-block'
): GeneratorPresetConfigV3 {
  const config = structuredClone(defaultGeneratorConfig)
  config.generationDefaults = {
    difficulty: 'easy',
    amount: 'neutral',
    balance: 'neutral',
    diversity: 'neutral'
  }
  config.composition.roleQuantities.minion = { min: 4, max: 4 }
  config.composition.roleCombinations = [['minion']]
  config.composition.crBlocks = { min: 1, max: 1 }
  config.composition.statblocks = { min: 2, max: 2 }
  config.composition.monsters = {
    min: { value: 4, perPlayer: false },
    max: { value: 4, perPlayer: false }
  }
  config.composition.initiativeSlots = {
    min: { value: 4, perPlayer: false },
    max: { value: 4, perPlayer: false }
  }
  config.composition.mixing = mixing
  return config
}

function source(maximum = 4): ResolvedEncounterSource {
  return {
    candidates: [
      { creatureId: 'wolf', weight: 1, maximum },
      { creatureId: 'acolyte', weight: 1, maximum }
    ],
    effectiveEncounterTableIds: ['table:test'],
    effectiveFactionIds: ['faction:test'],
    locationId: null,
    catalogFallback: false,
    biomeFiltering: false,
    sourceIssue: null
  }
}

function generateFocused(
  config: GeneratorPresetConfigV3,
  resolvedSource = source()
) {
  return generateSceneGroupDraft(
    scene,
    party,
    [],
    'replace',
    query,
    config,
    179974,
    7,
    resolvedSource,
    { id: '00000000-0000-4000-8000-000000000099', revision: 3 }
  )
}

describe('scene group generator variation', () => {
  it('keeps the same seed deterministic', () => {
    expect(generate(0x12345678)).toEqual(generate(0x12345678))
  })

  it('spreads consecutive seeds across multiple candidates', () => {
    const signatures = new Set(
      [1, 2, 3, 4, 5].map((seed) => signature(generate(seed)))
    )
    expect(signatures.size).toBeGreaterThan(1)
  })

  it('keeps fill idempotent after the requested band is reached', () => {
    const first = generate(1)
    const entries = first.entries.map(({ creatureId, quantity }) => ({
      creatureId,
      quantity
    }))
    const filled = generate(1, entries, 'fill')
    expect(
      filled.entries.map(({ creatureId, quantity }) => ({
        creatureId,
        quantity
      }))
    ).toEqual(entries)
    expect(filled.quality).toBe('exact')
  })

  it('materializes mixed and single statblocks without exceeding source stock', () => {
    const mixed = generateFocused(focusedConfig('mixed-within-cr-block'))
    expect(mixed.entries).toHaveLength(2)
    expect(mixed.entries.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(
      4
    )
    expect(mixed.entries.every((entry) => entry.cr === 0.25)).toBe(true)
    expect(mixed.context).toMatchObject({
      effectiveEncounterTableIds: ['table:test'],
      effectiveFactionIds: ['faction:test'],
      generatorPresetId: '00000000-0000-4000-8000-000000000099',
      generatorPresetRevision: 3
    })
    expect(mixed.context.generatorConfigHash).toMatch(/^[0-9a-f]{64}$/)

    const single = generateFocused(focusedConfig('one-per-cr-block'))
    expect(single.entries).toHaveLength(1)
    expect(single.entries[0]?.quantity).toBe(4)

    const exhausted = generateFocused(focusedConfig('mixed-within-cr-block'), {
      ...source(),
      candidates: [
        { creatureId: 'wolf', weight: 1, maximum: 2 },
        { creatureId: 'acolyte', weight: 1, maximum: 1 }
      ]
    })
    expect(exhausted.entries).toEqual([])
    expect(exhausted.quality).toBe('none')
  })

  it('uses the same abstract CR-block composition in Scene and Session', () => {
    const config = focusedConfig('mixed-within-cr-block')
    const catalog: EncounterCatalog = {
      catalogVersion: 'test',
      catalogContentHash: '0'.repeat(64),
      progression: [
        {
          level: 3,
          dayXpPerCharacter: 1_200,
          dayXpParty4: 4_800,
          mediumXpPerCharacter: 150,
          hardXpPerCharacter: 225,
          deadlyXpPerCharacter: 400
        }
      ],
      challengeRatings: [
        {
          id: 'scene-cr:1_4',
          code: -1,
          label: '1/4',
          xp: 50,
          active: true
        }
      ],
      roleBands: [],
      patterns: []
    }
    const session = generateSessionEncounters(
      {
        party: [{ level: 3, count: 4 }],
        adventureDayFraction: '0.09375',
        encounterCount: 1,
        seed: 179974
      },
      catalog,
      { modulo: () => 0, unit: () => 0 },
      {
        id: '00000000-0000-4000-8000-000000000099',
        revision: 3,
        config
      }
    )
    const materialized = generateFocused(config)

    expect(session.status).toBe('success')
    if (session.status !== 'success') return
    expect(
      session.encounters[0]?.blocks.map((block) => [
        block.challengeRating,
        block.quantity,
        block.statblockSlots
      ])
    ).toEqual([['1/4', 4, 2]])
    expect(
      materialized.entries.map((entry) => [String(entry.cr), entry.quantity])
    ).toEqual([
      ['0.25', 2],
      ['0.25', 2]
    ])
    expect(session.generatorPreset).toMatchObject({
      id: materialized.context.generatorPresetId,
      revision: materialized.context.generatorPresetRevision,
      configHash: materialized.context.generatorConfigHash
    })
  })
})
