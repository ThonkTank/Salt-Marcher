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
import type { SessionGenerationEncounterInput } from '../../src/shared/contracts/session-generation.js'
import type { EncounterEntropy } from '../../src/core/session-generation/deterministic-order.js'

const catalog = new BundledEncounterCatalogProvider(
  join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
).loadFull()
const preset = {
  id: systemGeneratorPresetId,
  revision: 0,
  config: defaultGeneratorConfig
}
const input: SessionGenerationEncounterInput = {
  party: [{ level: 3, count: 4 }],
  adventureDayFraction: '0.6',
  encounterCount: 2,
  seed: 179_974
}

describe('session generation loot engine', () => {
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
    // Sheet 00_Session!B9: session XP / party count × SUMPRODUCT(party,
    // Gold_Per_XP) × 100. Keeping the progression sum (rather than averaging
    // it a second time) is observable for every multi-character party.
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
    expect(() =>
      generateGroupRewardDraft(
        { ...groupInput, rewardXp: groupInput.adjustedXp },
        catalog,
        sha256EncounterEntropy
      )
    ).toThrowError('group_reward_xp_basis_mismatch')
  })

  it('keeps opaque group provenance out of reward entropy', () => {
    const groupInput = {
      party: [{ level: 3, count: 4 }],
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
          treasure.items.reduce((sum, item) => sum + item.totalValueCp, 0)
        ).toBe(treasure.actualValueCp)
        for (const item of treasure.items) {
          expect(item.totalValueCp).toBe(item.quantity * item.unitValueCp)
          expect(
            item.containerId === null ||
              treasure.containers.some(
                (container) => container.id === item.containerId
              )
          ).toBe(true)
          if (item.curseName) {
            expect(item.magic).toBe(true)
            expect(item.curseEffect).toBeTruthy()
          }
          if (!item.magic)
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
})
