import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  adjustedXp,
  baseXp,
  goldPerXp,
  magicPerXp,
  partyXp,
  perCharacterRewardXp,
  rawMagicTarget,
  rewardGoldBudget,
  rewardXp,
  rewardXpFromAdjustedXp,
  rewardXpFromBaseXp,
  rewardXpFromPartyXp,
  unitValue,
  type AdjustedXp,
  type BaseXp,
  type PartyXp,
  type RewardXp
} from '../../src/core/session-generation/reward-units.js'
import { rational } from '../../src/core/session-generation/rational.js'

describe('session generation reward units', () => {
  it('keeps XP dimensions nominal and requires explicit conversions', () => {
    expectTypeOf<PartyXp>().not.toEqualTypeOf<RewardXp>()
    expectTypeOf<BaseXp>().not.toEqualTypeOf<RewardXp>()
    expectTypeOf<BaseXp>().not.toEqualTypeOf<AdjustedXp>()
    expectTypeOf<AdjustedXp>().not.toEqualTypeOf<RewardXp>()

    const party = partyXp(1_200)
    const base = baseXp(1_500)
    const adjusted = adjustedXp(1_800)
    expect(unitValue(rewardXpFromPartyXp(party))).toBe(1_200)
    expect(unitValue(rewardXpFromBaseXp(base))).toBe(1_500)
    expect(unitValue(rewardXpFromAdjustedXp(adjusted))).toBe(1_800)

    // @ts-expect-error nominal dimensions deliberately prohibit assignment
    const invalidReward: RewardXp = party
    expect(invalidReward).toBe(party)

    // @ts-expect-error base and adjusted XP are separate dimensions
    const invalidAdjusted: AdjustedXp = base
    expect(invalidAdjusted).toBe(base)
  })

  it('retains rationals until each documented rounding point', () => {
    const perCharacter = perCharacterRewardXp(rewardXp(7), 4)
    expect(perCharacter.value).toEqual(rational(7n, 4n))
    expect(
      unitValue(rewardGoldBudget(perCharacter, goldPerXp(rational(3n, 2n))))
    ).toBe(263)
    expect(rawMagicTarget(perCharacter, magicPerXp(rational(1n, 7n)))).toEqual(
      rational(1n, 4n)
    )
  })

  it('rejects invalid dimensions at their Core boundary', () => {
    expect(() => partyXp(-1)).toThrowError('invalid_party_xp')
    expect(() => baseXp(-1)).toThrowError('invalid_base_xp')
    expect(() => rewardXp(1.5)).toThrowError('invalid_reward_xp')
    expect(() => perCharacterRewardXp(rewardXp(1), 0)).toThrowError(
      'invalid_party_count'
    )
  })
})
