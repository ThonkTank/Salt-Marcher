import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  generateGroupRewardDraft,
  generateSessionRunDraft
} from '../../src/core/session-generation/loot-engine.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import {
  sessionGenerationRunInputSchema,
  type SessionGenerationRunInput
} from '../../src/shared/contracts/session-generation.js'
import type { EncounterEntropy } from '../../src/core/session-generation/deterministic-order.js'

const catalog = new BundledEncounterCatalogProvider(
  join(process.cwd(), 'resources/sessiongeneration/catalog-2026-08-16')
).loadFull()
const preset = {
  id: systemGeneratorPresetId,
  revision: 0,
  config: defaultGeneratorConfig
}
const input: SessionGenerationRunInput = {
  party: [{ level: 3, count: 4 }],
  ledgerParty: sessionLedger([{ level: 3, count: 4 }], '0.6'),
  adventureDayFraction: '0.6',
  encounterCount: 2,
  seed: 179_974
}

describe('session generation loot engine', () => {
  it('rejects new reward generation without the cumulative ledger basis', () => {
    const result = sessionGenerationRunInputSchema.safeParse({
      ...input,
      ledgerParty: undefined
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['ledgerParty'])
  })

  it('parses all source-backed loot tables and produces audited treasures', () => {
    expect(catalog.items).toHaveLength(681)
    expect(catalog.magicItems).toHaveLength(552)

    const result = generateSessionRunDraft(
      input,
      catalog,
      sha256EncounterEntropy,
      preset
    )
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    // The fixture starts every member exactly at the level-3 gold anchor, so
    // the cumulative post-session deficit equals the Sheet's band increment.
    expect(result.draft.session.goldBudgetCp).toBe(45_120)
    expect(result.draft.treasures).toHaveLength(2)
    expect(
      result.draft.treasures.every((treasure) => treasure.items.length > 0)
    ).toBe(true)
    expect(
      result.draft.audits
        .filter((audit) => audit.hard)
        .every((audit) => audit.passed)
    ).toBe(true)
    expect(result.draft.treasures.at(-1)?.stockClass).toBe('overstock')
  })

  it('is deterministic for the same semantic origin and changes with the seed', () => {
    const first = generateSessionRunDraft(
      input,
      catalog,
      sha256EncounterEntropy,
      preset
    )
    const second = generateSessionRunDraft(
      input,
      catalog,
      sha256EncounterEntropy,
      preset
    )
    const changed = generateSessionRunDraft(
      { ...input, seed: input.seed + 1 },
      catalog,
      sha256EncounterEntropy,
      preset
    )
    expect(second).toEqual(first)
    expect(changed).not.toEqual(first)
  })

  it('converts the selected base or adjusted group XP dimension explicitly', () => {
    const groupInput = {
      party: [{ level: 3, count: 4 }],
      ledgerParty: groupLedger([{ level: 3, count: 4 }], 200),
      sceneId: '018f47db-e17a-7000-8000-000000000001',
      groupId: '018f47db-e17a-7000-8000-000000000002',
      sceneRevision: 1,
      groupRevision: 2,
      groupEntries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 0 }],
      partyRevision: 3,
      campaignRulesRevision: 4,
      rewardXpBasis: 'base' as const,
      baseXp: 200,
      adjustedXp: 400,
      rewardXp: 200,
      seed: 179_974
    }
    const base = generateGroupRewardDraft(
      groupInput,
      catalog,
      sha256EncounterEntropy
    )
    const adjusted = generateGroupRewardDraft(
      {
        ...groupInput,
        rewardXpBasis: 'adjusted',
        rewardXp: groupInput.adjustedXp
      },
      catalog,
      sha256EncounterEntropy
    )
    expect(base.input.rewardXp).toBe(base.input.baseXp)
    expect(adjusted.input.rewardXp).toBe(adjusted.input.adjustedXp)
    expect(base.treasures).toHaveLength(1)
    expect(base.treasures[0]?.stockClass).toBe('normal')
    expect(base.rewardSummary.overstockValueCp).toBe(0)
    expect(() =>
      generateGroupRewardDraft(
        { ...groupInput, rewardXp: groupInput.adjustedXp },
        catalog,
        sha256EncounterEntropy
      )
    ).toThrowError('group_reward_xp_basis_mismatch')
  })

  it('returns structurally empty session and group rewards when the ledger is overprovided', () => {
    const ledgerParty = Array.from({ length: 4 }, (_, index) => ({
      characterId: `018f47db-e17a-7000-8000-00000000000${String(index + 1)}`,
      currentXp: 400_000,
      projectedXp: 1_000,
      ledgerRevision: index,
      currentNonMagicCp: 100_000_000,
      currentMagic: {
        Common: 100,
        Uncommon: 100,
        Rare: 100,
        'Very Rare': 100,
        Legendary: 100
      }
    }))
    const session = generateSessionRunDraft(
      { ...input, ledgerParty },
      catalog,
      sha256EncounterEntropy,
      preset
    )
    expect(session.status).toBe('success')
    if (session.status !== 'success') return
    expect(session.draft.treasures).toEqual([])
    expect(session.draft.itemDefinitions).toEqual([])
    expect(session.draft.session).toMatchObject({
      goldBudgetCp: 0,
      normalTreasureCount: 0,
      overstockTreasureCount: 0
    })

    const group = generateGroupRewardDraft(
      {
        party: [{ level: 3, count: 4 }],
        ledgerParty,
        sceneId: '018f47db-e17a-7000-8000-000000000010',
        groupId: '018f47db-e17a-7000-8000-000000000011',
        sceneRevision: 1,
        groupRevision: 2,
        groupEntries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 0 }],
        partyRevision: 3,
        campaignRulesRevision: 4,
        rewardXpBasis: 'base',
        baseXp: 200,
        adjustedXp: 400,
        rewardXp: 200,
        seed: 9
      },
      catalog,
      sha256EncounterEntropy,
      preset
    )
    expect(group.treasures).toEqual([])
    expect(group.itemDefinitions).toEqual([])
    expect(group.rewardSummary).toEqual({
      normalValueCp: 0,
      overstockValueCp: 0,
      magicCount: 0
    })
  })

  it('keeps opaque group provenance out of reward entropy', () => {
    const groupInput = {
      party: [{ level: 3, count: 4 }],
      ledgerParty: groupLedger([{ level: 3, count: 4 }], 400),
      sceneId: '018f47db-e17a-7000-8000-000000000001',
      groupId: '018f47db-e17a-7000-8000-000000000002',
      sceneRevision: 1,
      groupRevision: 2,
      groupEntries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 0 }],
      partyRevision: 3,
      campaignRulesRevision: 4,
      rewardXpBasis: 'adjusted' as const,
      baseXp: 200,
      adjustedXp: 400,
      rewardXp: 400,
      seed: 9_003
    }
    const first = generateGroupRewardDraft(
      groupInput,
      catalog,
      sha256EncounterEntropy
    )
    const sameRewardForAnotherSavedGroup = generateGroupRewardDraft(
      {
        ...groupInput,
        sceneId: '018f47db-e17a-7000-8000-000000000003',
        groupId: '018f47db-e17a-7000-8000-000000000004',
        sceneRevision: 11,
        groupRevision: 12
      },
      catalog,
      sha256EncounterEntropy
    )
    expect(sameRewardForAnotherSavedGroup.treasures).toEqual(first.treasures)
    expect(sameRewardForAnotherSavedGroup.rewardSummary).toEqual(
      first.rewardSummary
    )
  })

  it('keeps named entropy streams independent', () => {
    const shiftedThemeEntropy: EncounterEntropy = {
      modulo(stream, modulus) {
        const value = sha256EncounterEntropy.modulo(stream, modulus)
        return stream.includes('|theme|') ? (value + 1) % modulus : value
      },
      unit(stream) {
        return sha256EncounterEntropy.unit(stream)
      }
    }
    const baseline = generateSessionRunDraft(
      input,
      catalog,
      sha256EncounterEntropy,
      preset
    )
    const shifted = generateSessionRunDraft(
      input,
      catalog,
      shiftedThemeEntropy,
      preset
    )
    expect(baseline.status).toBe('success')
    expect(shifted.status).toBe('success')
    if (baseline.status !== 'success' || shifted.status !== 'success') return

    expect(shifted.draft.encounters).toEqual(baseline.draft.encounters)
    expect(shifted.draft.session).toEqual(baseline.draft.session)
    expect(
      shifted.draft.treasures.map((treasure) => ({
        id: treasure.id,
        stockClass: treasure.stockClass,
        rewardChannel: treasure.rewardChannel,
        anchorEncounterNumber: treasure.anchorEncounterNumber,
        targetValueCp: treasure.targetValueCp
      }))
    ).toEqual(
      baseline.draft.treasures.map((treasure) => ({
        id: treasure.id,
        stockClass: treasure.stockClass,
        rewardChannel: treasure.rewardChannel,
        anchorEncounterNumber: treasure.anchorEncounterNumber,
        targetValueCp: treasure.targetValueCp
      }))
    )
    expect(
      shifted.draft.treasures.map((treasure) => treasure.themeId)
    ).not.toEqual(baseline.draft.treasures.map((treasure) => treasure.themeId))
  })

  it('holds budget, role, magic, curse, packing, and audit invariants across seeds', () => {
    const roleCounts = new Map<string, number>()
    for (let seed = 0; seed < 32; seed += 1) {
      const result = generateSessionRunDraft(
        { ...input, seed },
        catalog,
        sha256EncounterEntropy,
        preset
      )
      expect(result.status, `seed ${seed}`).toBe('success')
      if (result.status !== 'success') continue
      const run = result.draft
      expect(
        run.audits.filter((audit) => audit.hard).every((audit) => audit.passed)
      ).toBe(true)
      const normalTargets = run.treasures
        .filter((treasure) => treasure.stockClass === 'normal')
        .reduce((sum, treasure) => sum + Number(treasure.targetValueCp), 0)
      const overstock = run.treasures.find(
        (treasure) => treasure.stockClass === 'overstock'
      )
      expect(normalTargets).toBe(run.session.goldBudgetCp)
      expect(Number(overstock?.targetValueCp)).toBe(
        Math.round(run.session.goldBudgetCp / 5)
      )
      const expectedMagic = Object.values(run.session.magicTargets).reduce(
        (sum, value) => sum + value,
        0
      )
      expect(run.rewardSummary.magicCount).toBe(expectedMagic)
      for (const treasure of run.treasures) {
        expect(treasure.items.map((item) => item.position)).toEqual(
          treasure.items.map((_, position) => position)
        )
        expect(
          treasure.containers.map((container) => container.position)
        ).toEqual(treasure.containers.map((_, position) => position))
        expect(
          treasure.items.reduce((sum, item) => {
            const definition = run.itemDefinitions.find(
              (candidate) =>
                candidate.reference.kind === 'generated' &&
                item.itemReference.kind === 'generated' &&
                candidate.reference.definitionId ===
                  item.itemReference.definitionId
            )!
            return sum + item.quantity * definition.unitValueCp
          }, 0)
        ).toBe(treasure.actualValueCp)
        for (const item of treasure.items) {
          const definition = run.itemDefinitions.find(
            (candidate) =>
              candidate.reference.kind === 'generated' &&
              item.itemReference.kind === 'generated' &&
              candidate.reference.definitionId ===
                item.itemReference.definitionId
          )!
          expect(
            item.containerId === null ||
              treasure.containers.some(
                (container) => container.id === item.containerId
              )
          ).toBe(true)
          if (definition.curse) {
            expect(definition.magic).toBe(true)
            expect(definition.curse.effect).toBeTruthy()
          }
          if (!definition.magic)
            roleCounts.set(item.role, (roleCounts.get(item.role) ?? 0) + 1)
        }
      }
    }
    expect([...roleCounts.keys()].toSorted()).toEqual([
      'compact_value',
      'complex_value',
      'flavor',
      'useful'
    ])
  })

  it.each([
    ['M0-01', 101, '0.6', undefined, [{ level: 1, count: 4 }]],
    [
      'M0-02',
      202,
      '1',
      3,
      [
        { level: 2, count: 2 },
        { level: 3, count: 2 }
      ]
    ],
    ['M0-03', 303, '0.6', undefined, [{ level: 5, count: 4 }]],
    [
      'M0-04',
      404,
      '1',
      undefined,
      [
        { level: 5, count: 1 },
        { level: 6, count: 2 },
        { level: 7, count: 1 }
      ]
    ],
    ['M0-05', 505, '0.6', undefined, [{ level: 9, count: 4 }]],
    [
      'M0-06',
      606,
      '1',
      4,
      [
        { level: 11, count: 2 },
        { level: 12, count: 2 }
      ]
    ],
    ['M0-07', 707, '0.6', undefined, [{ level: 13, count: 4 }]],
    [
      'M0-08',
      808,
      '1',
      undefined,
      [
        { level: 14, count: 1 },
        { level: 15, count: 2 },
        { level: 16, count: 1 }
      ]
    ],
    ['M0-09', 909, '0.6', undefined, [{ level: 17, count: 4 }]],
    ['M0-10', 1010, '1', 6, [{ level: 20, count: 4 }]],
    ['M0-11', 1111, '1', 2, [{ level: 5, count: 1 }]],
    ['M0-12', 1212, '1', undefined, [{ level: 8, count: 8 }]]
  ] as const)(
    'matches Sheet regression structure %s',
    (_caseId, seed, adventureDayFraction, encounterCount, party) => {
      const result = generateSessionRunDraft(
        {
          party: party.map((entry) => ({ ...entry })),
          ledgerParty: sessionLedger(party, adventureDayFraction),
          adventureDayFraction,
          ...(encounterCount === undefined ? {} : { encounterCount }),
          seed
        },
        catalog,
        sha256EncounterEntropy,
        preset
      )
      expect(result.status).toBe('success')
      if (result.status !== 'success') return
      const run = result.draft
      const definitions = new Map(
        run.itemDefinitions.map((definition) => [
          definition.reference.kind === 'generated'
            ? definition.reference.definitionId
            : '',
          definition
        ])
      )
      expect(run.encounters).toHaveLength(run.session.encounterCount)
      expect(
        run.treasures.filter((entry) => entry.stockClass === 'overstock')
      ).toHaveLength(1)
      expect(
        run.treasures
          .filter((entry) => entry.stockClass === 'normal')
          .reduce((sum, entry) => sum + Number(entry.targetValueCp), 0)
      ).toBe(run.session.goldBudgetCp)
      expect(
        run.treasures.every((treasure) =>
          treasure.items.every((item) => {
            if (item.itemReference.kind !== 'generated') return false
            const definition = definitions.get(item.itemReference.definitionId)
            return (
              Boolean(definition) &&
              (item.containerId === null ||
                treasure.containers.some(
                  (container) => container.id === item.containerId
                ))
            )
          })
        )
      ).toBe(true)
      expect(
        run.itemDefinitions.some(
          (definition) =>
            definition.components.baseItemId ||
            definition.components.coinDenominations.length > 0
        )
      ).toBe(true)
      expect(
        run.audits.filter((audit) => audit.hard).every((audit) => audit.passed)
      ).toBe(true)
    }
  )
})

function sessionLedger(
  party: readonly Readonly<{ level: number; count: number }>[],
  adventureDayFraction: string
) {
  const partyCount = party.reduce((sum, entry) => sum + entry.count, 0)
  const sessionXpTarget = Math.round(
    party.reduce((sum, entry) => {
      const row = catalog.encounter.progression.find(
        (candidate) => candidate.level === entry.level
      )!
      return sum + row.dayXpPerCharacter * entry.count
    }, 0) * Number(adventureDayFraction)
  )
  return ledgerAtLevelAnchors(party, Math.floor(sessionXpTarget / partyCount))
}

function groupLedger(
  party: readonly Readonly<{ level: number; count: number }>[],
  rewardXp: number
) {
  const partyCount = party.reduce((sum, entry) => sum + entry.count, 0)
  return ledgerAtLevelAnchors(party, Math.floor(rewardXp / partyCount))
}

function ledgerAtLevelAnchors(
  party: readonly Readonly<{ level: number; count: number }>[],
  projectedXp: number
) {
  let ordinal = 0
  return party.flatMap((entry) => {
    const progression =
      defaultGeneratorConfig.loot.progression[entry.level - 1]!
    return Array.from({ length: entry.count }, () => {
      ordinal += 1
      return {
        characterId: `018f47db-e17a-7000-8000-${String(ordinal).padStart(12, '0')}`,
        currentXp: progression.xpAtLevel,
        projectedXp,
        ledgerRevision: 0,
        currentNonMagicCp: progression.goldAtLevelCp,
        currentMagic: {
          Common: 0,
          Uncommon: 0,
          Rare: 0,
          'Very Rare': 0,
          Legendary: 0
        }
      }
    })
  })
}
