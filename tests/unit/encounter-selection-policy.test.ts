import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildSelectionIndex,
  emptyFixedRoster,
  sessionCompositionCatalog,
  selectEncounter,
  statblockSlotsForBlocks,
  type Block,
  type SelectionIndex
} from '../../src/core/session-generation/encounter-selection-policy.js'
import {
  catalogManifestSchema,
  parseEncounterCatalog,
  type EncounterRole
} from '../../src/core/session-generation/catalog.js'
import type { EncounterEntropy } from '../../src/core/session-generation/deterministic-order.js'
import type { GeneratorPresetConfigV3 } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { fingerprintGeneratorConfig } from '../../src/core/session-generation/generator-config-fingerprint.js'

const catalogRoot = join(
  process.cwd(),
  'resources/sessiongeneration/catalog-2026-07-16'
)
const entropy: EncounterEntropy = { modulo: () => 0, unit: () => 0 }

function loadCatalog() {
  const read = (name: string) => readFileSync(join(catalogRoot, name), 'utf8')
  return parseEncounterCatalog({
    manifest: catalogManifestSchema.parse(JSON.parse(read('manifest.json'))),
    tables: {
      progression: read('DB_Progression.tsv'),
      challengeRatings: read('DB_CR.tsv'),
      roleBands: read('DB_EncounterRoleBands.tsv'),
      patterns: read('DB_EncounterPatterns.tsv')
    }
  })
}

function configured(
  mutate: (config: GeneratorPresetConfigV3) => void
): GeneratorPresetConfigV3 {
  const config = structuredClone(defaultGeneratorConfig)
  mutate(config)
  return config
}

function block(
  role: EncounterRole,
  id: string,
  xp: number,
  quantity: number,
  availableStatblocks: number | null = null
): Block {
  return {
    id,
    role,
    cr: { id: `cr:${id}`, code: xp, label: id, xp, active: true },
    quantity,
    rawXp: xp * quantity,
    adjustedXp: 0,
    availableStatblocks
  }
}

function index(...blocks: Block[]): SelectionIndex {
  return new Map(
    ['Minion', 'Support', 'Standard', 'Elite', 'Boss'].flatMap((role) => {
      const matching = blocks.filter((entry) => entry.role === role)
      return matching.length > 0
        ? [[role as EncounterRole, matching] as const]
        : []
    })
  )
}

function oneRoleConfig(): GeneratorPresetConfigV3 {
  return configured((config) => {
    config.composition.roleCombinations = [['minion']]
    config.composition.crBlocks = { min: 1, max: 1 }
    config.composition.statblocks = { min: 1, max: 1 }
    config.composition.monsters = {
      min: { value: 1, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    config.composition.initiativeSlots = {
      min: { value: 1, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    config.combat.mobThreshold = 0
  })
}

describe('streaming encounter selection policy', () => {
  it('enumerates the generated system composition deterministically', () => {
    const catalog = loadCatalog()
    const config = structuredClone(defaultGeneratorConfig)
    const selectionIndex = buildSelectionIndex(
      sessionCompositionCatalog(catalog),
      4,
      config
    )
    const selected = selectEncounter(
      179974,
      1,
      680,
      selectionIndex,
      entropy,
      config,
      4
    )

    expect(selected.candidateCount).toBeGreaterThan(100)
    expect(selected.candidate).toBeDefined()
    expect(
      selectEncounter(179974, 1, 680, selectionIndex, entropy, config, 4)
    ).toEqual(selected)
  })

  it('enumerates every Cartesian variant and returns the explicit composition', () => {
    const config = oneRoleConfig()
    const selected = selectEncounter(
      7,
      1,
      100,
      index(
        block('Minion', 'a', 25, 1),
        block('Minion', 'b', 50, 1),
        block('Minion', 'c', 75, 1),
        block('Minion', 'd', 100, 1)
      ),
      entropy,
      config,
      4
    )

    expect(selected.candidateCount).toBe(4)
    expect(selected.fitCandidateCount).toBe(1)
    expect(selected.composition).toEqual({
      blocks: [
        {
          role: 'minion',
          challengeRating: 'd',
          quantity: 1,
          statblockSlots: 1
        }
      ],
      metrics: {
        adjustedXp: 100,
        xpDelta: 0,
        monsterCount: 1,
        statblockCount: 1,
        initiativeSlots: 1,
        effectiveMonsterCount: 1,
        xpMultiplier: 1
      },
      diagnostics: [],
      candidateCount: 4,
      fitCandidateCount: 1
    })
  })

  it('treats role cells, combinations, CR blocks, and stock as hard rules', () => {
    const catalog = loadCatalog()
    const unavailable = configured((config) => {
      config.composition.roleMatrix = config.composition.roleMatrix.map((row) =>
        row.map(() => 'none' as const)
      )
    })
    expect(
      buildSelectionIndex(sessionCompositionCatalog(catalog), 4, unavailable)
        .size
    ).toBe(0)

    const noCombinations = configured((config) => {
      config.composition.roleCombinations = []
    })
    expect(
      selectEncounter(
        1,
        1,
        100,
        index(block('Minion', 'stock', 100, 1)),
        entropy,
        noCombinations,
        4
      ).candidate
    ).toBeUndefined()

    const stockLimited = oneRoleConfig()
    stockLimited.composition.statblocks = { min: 2, max: 2 }
    expect(
      selectEncounter(
        1,
        1,
        100,
        index(block('Minion', 'stock', 100, 2, 0)),
        entropy,
        stockLimited,
        4
      ).candidate
    ).toBeUndefined()
  })

  it('ranks lexicographically: target band, soft fit, tuning, XP, entropy, id', () => {
    const targetBand = oneRoleConfig()
    const byBand = selectEncounter(
      1,
      1,
      100,
      index(
        block('Minion', 'outside', 106, 1),
        block('Minion', 'inside', 104, 1)
      ),
      entropy,
      targetBand,
      4
    )
    expect(byBand.candidate?.blocks[0]?.id).toBe('inside')

    const softFirst = structuredClone(targetBand)
    softFirst.composition.monsters = {
      min: { value: 2, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    softFirst.composition.initiativeSlots = {
      min: { value: 2, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    const bySoftFit = selectEncounter(
      1,
      1,
      100,
      index(
        block('Minion', 'exact-but-soft-miss', 100, 1),
        block('Minion', 'soft-fit', 33, 2)
      ),
      entropy,
      softFirst,
      4
    )
    expect(bySoftFit.candidate?.blocks[0]?.id).toBe('soft-fit')
    expect(bySoftFit.candidate?.adjustedXp).toBe(99)

    const tuningFirst = structuredClone(targetBand)
    tuningFirst.composition.monsters = {
      min: { value: 1, perPlayer: false },
      max: { value: 3, perPlayer: false }
    }
    tuningFirst.composition.initiativeSlots = {
      min: { value: 1, perPlayer: false },
      max: { value: 3, perPlayer: false }
    }
    tuningFirst.generationDefaults.amount = 'few'
    const byTuning = selectEncounter(
      1,
      1,
      100,
      index(
        block('Minion', 'few', 104, 1),
        block('Minion', 'many-closer-xp', 17, 3)
      ),
      entropy,
      tuningFirst,
      4
    )
    expect(byTuning.candidate?.blocks[0]?.id).toBe('few')

    const byXp = selectEncounter(
      1,
      1,
      100,
      index(
        block('Minion', 'four-away', 104, 1),
        block('Minion', 'one-away', 99, 1)
      ),
      entropy,
      targetBand,
      4
    )
    expect(byXp.candidate?.blocks[0]?.id).toBe('one-away')
  })

  it('consults named entropy only after every domain rank component ties', () => {
    const config = oneRoleConfig()
    let entropyCalls = 0
    const observedEntropy: EncounterEntropy = {
      modulo: () => 0,
      unit: () => {
        entropyCalls += 1
        return 0
      }
    }
    selectEncounter(
      1,
      1,
      100,
      index(
        block('Minion', 'exact', 100, 1),
        block('Minion', 'different-domain-rank', 80, 1)
      ),
      observedEntropy,
      config,
      4
    )
    expect(entropyCalls).toBe(0)

    const tied = selectEncounter(
      1,
      1,
      100,
      index(block('Minion', 'b', 100, 1), block('Minion', 'a', 100, 1)),
      observedEntropy,
      config,
      4
    )
    expect(entropyCalls).toBe(2)
    expect(tied.composition?.blocks[0]?.challengeRating).toBe('a')
  })

  it('evaluates fill against the complete fixed plus generated roster', () => {
    const config = oneRoleConfig()
    config.composition.monsters = {
      min: { value: 2, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    config.composition.statblocks = { min: 2, max: 2 }
    config.composition.initiativeSlots = {
      min: { value: 2, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    const fixed = {
      units: [{ unitXp: 50, quantity: 1 }],
      statblockCount: 1,
      initiativeSlots: 1
    }
    const selected = selectEncounter(
      1,
      1,
      150,
      index(block('Minion', 'addition', 50, 1)),
      entropy,
      config,
      4,
      fixed
    )

    expect(selected.candidate).toMatchObject({
      adjustedXp: 150,
      monsterCount: 2,
      statblockCount: 2,
      initiativeSlots: 2,
      softFit: true
    })
    expect(emptyFixedRoster).toEqual({
      units: [],
      statblockCount: 0,
      initiativeSlots: 0
    })
  })

  it('reports the normalized distance to each missed soft range', () => {
    const config = oneRoleConfig()
    config.composition.monsters = {
      min: { value: 2, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    config.composition.initiativeSlots = {
      min: { value: 2, perPlayer: false },
      max: { value: 2, perPlayer: false }
    }
    const selected = selectEncounter(
      1,
      1,
      100,
      index(block('Minion', 'soft-miss', 100, 1)),
      entropy,
      config,
      4
    )

    expect(selected.composition?.diagnostics).toEqual([
      expect.objectContaining({
        constraint: 'monsters',
        value: 1,
        minimum: 2,
        maximum: 2,
        normalizedDistance: 0.5
      }),
      expect.objectContaining({
        constraint: 'initiativeSlots',
        value: 1,
        minimum: 2,
        maximum: 2,
        normalizedDistance: 0.5
      })
    ])
  })

  it('allocates statblock slots without mutating the config', () => {
    const mixed = oneRoleConfig()
    mixed.composition.mixing = 'mixed-within-cr-block'
    mixed.composition.statblocks = { min: 4, max: 4 }
    expect(
      statblockSlotsForBlocks([{ quantity: 2 }, { quantity: 4 }], mixed)
    ).toEqual([2, 2])
    const single = structuredClone(mixed)
    single.composition.mixing = 'one-per-cr-block'
    expect(
      statblockSlotsForBlocks([{ quantity: 2 }, { quantity: 4 }], single)
    ).toEqual([1, 1])
  })

  it('preserves deterministic composition and hard invariants across generated inputs', () => {
    const catalog = loadCatalog()
    const config = oneRoleConfig()
    config.composition.roleQuantities.minion = { min: 1, max: 2 }
    config.composition.statblocks = { min: 1, max: 2 }
    const fingerprint = fingerprintGeneratorConfig(config)

    for (let seed = 0; seed < 64; seed += 1) {
      const partyLevel = (seed % 20) + 1
      const selectionIndex = buildSelectionIndex(
        sessionCompositionCatalog(catalog),
        partyLevel,
        config
      )
      const first = selectEncounter(
        seed,
        1,
        100 + seed * 25,
        selectionIndex,
        entropy,
        config,
        1 + (seed % 6)
      )
      const normalizedClone = structuredClone(config)
      const second = selectEncounter(
        seed,
        1,
        100 + seed * 25,
        buildSelectionIndex(
          sessionCompositionCatalog(catalog),
          partyLevel,
          normalizedClone
        ),
        entropy,
        normalizedClone,
        1 + (seed % 6)
      )

      expect(fingerprintGeneratorConfig(normalizedClone)).toBe(fingerprint)
      expect(second.composition).toEqual(first.composition)
      expect(first.candidateCount).toBe(selectionIndex.get('Minion')?.length)
      const composition = first.composition
      expect(composition?.blocks).toHaveLength(1)
      for (const block of composition?.blocks ?? []) {
        expect(block.role).toBe('minion')
        expect(block.quantity).toBeGreaterThanOrEqual(1)
        expect(block.quantity).toBeLessThanOrEqual(2)
        expect(block.statblockSlots).toBeGreaterThanOrEqual(1)
        expect(block.statblockSlots).toBeLessThanOrEqual(block.quantity)
      }
    }
  })
})
