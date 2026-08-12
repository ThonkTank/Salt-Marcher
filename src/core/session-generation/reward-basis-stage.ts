import type { RewardXp } from './reward-units.js'

export type RewardPartyLevel = Readonly<{
  level: number
  count: number
}>

export type RewardBasisInput = Readonly<{
  party: readonly RewardPartyLevel[]
  rewardXp: RewardXp
}>

export type NormalizedRewardBasis = Readonly<{
  party: readonly RewardPartyLevel[]
  partyCount: number
  rewardXp: RewardXp
}>

/**
 * Preconditions: party levels are unique and counts are non-negative.
 * Postconditions: party order is canonical, zero-count rows are absent, and
 * partyCount is positive.
 */
export function normalizeRewardBasis(
  input: RewardBasisInput
): NormalizedRewardBasis {
  const active = input.party
    .filter((entry) => entry.count > 0)
    .toSorted((left, right) => left.level - right.level)
    .map((entry) => Object.freeze({ ...entry }))
  if (active.length === 0) throw new Error('invalid_reward_party')
  if (new Set(active.map((entry) => entry.level)).size !== active.length)
    throw new Error('duplicate_reward_party_level')
  const partyCount = active.reduce((total, entry) => total + entry.count, 0)
  return Object.freeze({
    party: Object.freeze(active),
    partyCount,
    rewardXp: input.rewardXp
  })
}
