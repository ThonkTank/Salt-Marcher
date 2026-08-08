import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  catalogManifestSchema,
  parseEncounterCatalog
} from '../../src/core/session-generation/catalog.js'
import { generateSessionEncounters } from '../../src/core/session-generation/encounter-engine.js'
import { coreOperations } from '../../src/shared/contracts/operations.js'
import type { EncounterEntropy } from '../../src/core/session-generation/deterministic-order.js'
import { automaticEncounterCount } from '../../src/core/session-generation/encounter-target-policy.js'
import { decimal } from '../../src/core/session-generation/rational.js'

const catalogRoot = join(
  process.cwd(),
  'resources/sessiongeneration/catalog-2026-07-16'
)

function loadCatalog() {
  const manifest = catalogManifestSchema.parse(
    JSON.parse(readFileSync(join(catalogRoot, 'manifest.json'), 'utf8'))
  )
  return parseEncounterCatalog({
    manifest,
    tables: {
      progression: read('DB_Progression.tsv'),
      challengeRatings: read('DB_CR.tsv'),
      roleBands: read('DB_EncounterRoleBands.tsv'),
      patterns: read('DB_EncounterPatterns.tsv')
    }
  })
}

function read(file: string): string {
  return readFileSync(join(catalogRoot, file), 'utf8')
}

const testEntropy: EncounterEntropy = {
  modulo: () => 0,
  unit: () => 0
}

const goldenInput = {
  party: [
    { level: 3, count: 2 },
    { level: 4, count: 2 }
  ],
  adventureDayFraction: '0.6',
  encounterCount: 3,
  seed: 179974
} as const

describe('session generation encounter engine', () => {
  it('publishes the generator through the guarded core operation table', () => {
    const operation =
      coreOperations['sessionGeneration.generateEncounterIntents']
    expect(operation.channel).toBe('session-generation:generate-intents')
    expect(operation.mode).toBe('read')
    expect(operation.roles).toEqual(['gm'])
  })

  it('loads the spreadsheet encounter catalog and reproduces the target golden', () => {
    const catalog = loadCatalog()
    const result = generateSessionEncounters(goldenInput, catalog, testEntropy)

    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    expect(result.session.sessionXpTarget).toBe(3480)
    expect(result.session.averageLevel).toBeCloseTo(3.5, 2)
    expect(result.encounters.map((encounter) => encounter.targetXp)).toEqual([
      680, 1000, 1800
    ])
    expect(result.encounters).toHaveLength(3)
    expect(
      result.encounters.every((encounter) => encounter.blocks.length > 0)
    ).toBe(true)
    expect(result.encounters.map((encounter) => encounter.difficulty)).toEqual([
      'EASY',
      'MEDIUM',
      'DEADLY'
    ])
  })

  it('is deterministic and independent of catalog row order', () => {
    const catalog = loadCatalog()
    const shuffled = {
      ...catalog,
      progression: [...catalog.progression].reverse(),
      challengeRatings: [...catalog.challengeRatings].reverse(),
      roleBands: [...catalog.roleBands].reverse(),
      patterns: [...catalog.patterns].reverse()
    }
    const first = generateSessionEncounters(goldenInput, catalog, testEntropy)
    const second = generateSessionEncounters(goldenInput, shuffled, testEntropy)
    expect(second).toEqual(first)
    expect(
      generateSessionEncounters(
        { ...goldenInput, adventureDayFraction: '0.600' },
        catalog,
        testEntropy
      )
    ).toEqual(first)
  })

  it('keeps encounter targets contiguous and exact for automatic counts', () => {
    const catalog = loadCatalog()
    for (const seed of [1, 2, 3, 17, 179974]) {
      const result = generateSessionEncounters(
        {
          party: [{ level: 4, count: 4 }],
          adventureDayFraction: '0.6',
          seed
        },
        catalog,
        testEntropy
      )
      expect(result.status).toBe('success')
      if (result.status !== 'success') continue
      expect(
        result.encounters.map((encounter) => encounter.encounterNumber)
      ).toEqual(result.encounters.map((_, index) => index + 1))
      expect(
        result.encounters.reduce(
          (sum, encounter) => sum + encounter.targetXp,
          0
        )
      ).toBe(result.session.sessionXpTarget)
    }
  })

  it('matches the Sheet-v1 automatic encounter-count golden cases', () => {
    const cases = [
      [1, '0', 1],
      [1, '0.1', 1],
      [1, '0.25', 2],
      [1, '0.5', 4],
      [1, '1', 8],
      [2, '0.6', 4],
      [17, '0.6', 4],
      [179974, '0.6', 4],
      [999999, '0.25', 2],
      [900719, '1', 8]
    ] as const
    for (const [seed, fraction, expected] of cases)
      expect(automaticEncounterCount(seed, decimal(fraction))).toBe(expected)
  })

  it('returns typed failures for invalid and unresolvable requests', () => {
    const catalog = loadCatalog()
    expect(
      generateSessionEncounters(
        { party: [], adventureDayFraction: '0.6', seed: 1 },
        catalog,
        testEntropy
      ).status
    ).toBe('invalid_input')
    expect(
      generateSessionEncounters(
        {
          party: [{ level: 1, count: 1 }],
          adventureDayFraction: '0',
          encounterCount: 1,
          seed: 1
        },
        catalog,
        testEntropy
      ).status
    ).toBe('unresolvable')
  })
})
