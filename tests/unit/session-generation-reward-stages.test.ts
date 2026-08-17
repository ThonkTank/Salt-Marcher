import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeRewardBasis } from '../../src/core/session-generation/reward-basis-stage.js'
import {
  calculateLedgerRewardBudget,
  calculateRewardBudget
} from '../../src/core/session-generation/reward-budget-stage.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'
import {
  rewardXp,
  unitValue
} from '../../src/core/session-generation/reward-units.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import { createRewardRandom } from '../../src/core/session-generation/reward-random.js'

const catalog = new BundledEncounterCatalogProvider(
  join(process.cwd(), 'resources/sessiongeneration/catalog-2026-08-16')
).loadFull()
const random = (seed: number) =>
  createRewardRandom(seed, sha256EncounterEntropy)

describe('session generation reward stages', () => {
  it('normalizes party order without mutating the source', () => {
    const party = [
      { level: 7, count: 0 },
      { level: 3, count: 4 },
      { level: 1, count: 1 }
    ]
    const output = normalizeRewardBasis({ party, rewardXp: rewardXp(3_480) })
    expect(output.party).toEqual([
      { level: 1, count: 1 },
      { level: 3, count: 4 }
    ])
    expect(output.partyCount).toBe(5)
    expect(party).toHaveLength(3)
    expect(Object.isFrozen(output)).toBe(true)
    expect(Object.isFrozen(output.party)).toBe(true)
    expect(output.party.every(Object.isFrozen)).toBe(true)
  })

  it('derives the sheet-backed budget independently of item selection', () => {
    const basis = normalizeRewardBasis({
      party: [{ level: 3, count: 4 }],
      rewardXp: rewardXp(2_880)
    })
    const output = calculateRewardBudget(
      { basis, catalog, profile: 'session' },
      random(179_974)
    )
    expect(output.perCharacterXp.value).toEqual({
      numerator: 720n,
      denominator: 1n
    })
    expect(unitValue(output.goldBudgetCp)).toBe(45_120)
    expect(Object.isFrozen(output)).toBe(true)
    expect(Object.isFrozen(output.magicTargets)).toBe(true)
  })

  it('rejects duplicate active level rows before progression lookup', () => {
    expect(() =>
      normalizeRewardBasis({
        party: [
          { level: 3, count: 2 },
          { level: 3, count: 2 }
        ],
        rewardXp: rewardXp(100)
      })
    ).toThrowError('duplicate_reward_party_level')
  })

  it('pays only the missing cumulative ledger wealth at projected XP', () => {
    const members = Array.from({ length: 4 }, (_, index) => ({
      characterId: `018f47db-e17a-7000-8000-00000000000${String(index + 1)}`,
      level: 3,
      currentXp: 400,
      ledgerRevision: 3,
      currentNonMagicCp: 10_000,
      currentMagic: {
        Common: 10,
        Uncommon: 0,
        Rare: 0,
        'Very Rare': 0,
        Legendary: 0
      }
    }))
    const output = calculateLedgerRewardBudget(
      {
        members,
        rewardXp: 400,
        rules: defaultGeneratorLootRules,
        profile: 'group_reward'
      },
      random(17)
    )
    expect(output.rewardBasis.targetGoldCp).toBe(100_267)
    expect(output.rewardBasis.currentGoldCp).toBe(40_000)
    expect(
      output.rewardBasis.members.map((member) => member.projectedXp)
    ).toEqual([100, 100, 100, 100])
    expect(unitValue(output.goldBudgetCp)).toBe(60_267)
    expect(output.magicTargets.Common).toBe(0)

    const settled = calculateLedgerRewardBudget(
      {
        members: members.map((member) => ({
          ...member,
          currentNonMagicCp: 30_000
        })),
        rewardXp: 400,
        rules: defaultGeneratorLootRules,
        profile: 'group_reward'
      },
      random(17)
    )
    expect(unitValue(settled.goldBudgetCp)).toBe(0)
    expect(
      Object.values(settled.magicTargets).every((value) => value === 0)
    ).toBe(true)
  })

  it('interpolates mixed post-XP gold targets and caps them at level 20', () => {
    const mixed = calculateLedgerRewardBudget(
      {
        members: [
          member('018f47db-e17a-7000-8000-000000000001', 0),
          member('018f47db-e17a-7000-8000-000000000002', 600),
          member('018f47db-e17a-7000-8000-000000000003', 13_700)
        ],
        rewardXp: 900,
        rules: defaultGeneratorLootRules,
        profile: 'session'
      },
      random(1)
    )
    expect(mixed.rewardBasis.targetGoldCp).toBe(596_800)

    const capped = calculateLedgerRewardBudget(
      {
        members: [
          member('018f47db-e17a-7000-8000-000000000001', 355_000),
          member('018f47db-e17a-7000-8000-000000000002', 950_000)
        ],
        rewardXp: 0,
        rules: defaultGeneratorLootRules,
        profile: 'session'
      },
      random(1)
    )
    expect(capped.rewardBasis.targetGoldCp).toBe(161_084_000)
  })

  it('integrates rarity bands before rounding and subtracts rarity balances', () => {
    const output = calculateLedgerRewardBudget(
      {
        members: [
          {
            ...member('018f47db-e17a-7000-8000-000000000001', 6_500),
            currentMagic: {
              Common: 1,
              Uncommon: 1,
              Rare: 0,
              'Very Rare': 0,
              Legendary: 0
            }
          }
        ],
        rewardXp: 7_500,
        rules: defaultGeneratorLootRules,
        profile: 'group_reward'
      },
      { modulo: () => 0, unit: () => 0 }
    )
    expect(output.rewardBasis.targetMagic).toEqual({
      Common: 2,
      Uncommon: 1,
      Rare: 0,
      'Very Rare': 0,
      Legendary: 0
    })
    expect(output.magicTargets).toEqual({
      Common: 1,
      Uncommon: 0,
      Rare: 0,
      'Very Rare': 0,
      Legendary: 0
    })
  })
})

function member(characterId: string, currentXp: number) {
  return {
    characterId,
    level: 1,
    currentXp,
    ledgerRevision: 0,
    currentNonMagicCp: 0,
    currentMagic: {
      Common: 0,
      Uncommon: 0,
      Rare: 0,
      'Very Rare': 0,
      Legendary: 0
    }
  }
}
