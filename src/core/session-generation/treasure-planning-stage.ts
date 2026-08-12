import type { EncounterEntropy } from './deterministic-order.js'
import { treasurePlanningStream } from './entropy-streams.js'
import type { LootTheme } from './loot-catalog.js'
import { decimal, divide, multiply, rational, roundHalfUp } from './rational.js'
import { freezeStage, type RewardTreasurePlan } from './reward-stage-types.js'

export type SessionTreasurePlanningInput = Readonly<{
  seed: number
  adventureDayFraction: string
  goldBudgetCp: number
  encounterNumbers: readonly number[]
  themes: readonly LootTheme[]
}>

export type TreasurePlanningOutput = Readonly<{
  treasures: readonly RewardTreasurePlan[]
  normalTreasureCount: number
  overstockTreasureCount: number
}>

/**
 * Preconditions: the budget is non-negative and at least one active theme is
 * available. Postconditions: normal targets sum to the complete gold budget;
 * Encounter anchors are unique and every plan is immutable.
 */
export function planSessionTreasures(
  input: SessionTreasurePlanningInput,
  entropy: EncounterEntropy
): TreasurePlanningOutput {
  const themes = input.themes.filter((theme) => theme.active)
  if (themes.length === 0) throw new Error('reward_theme_unavailable')
  const fraction = decimal(input.adventureDayFraction)
  const fullDayTreasureCount =
    2 +
    entropy.modulo(treasurePlanningStream(input.seed, 'treasure-count', 0), 3)
  const totalTreasureCount = Math.max(
    2,
    Math.min(
      4,
      roundHalfUp(multiply(rational(BigInt(fullDayTreasureCount)), fraction))
    )
  )
  const overstockTreasureCount = 1
  const normalTreasureCount = totalTreasureCount - overstockTreasureCount
  const targets = [
    ...splitBudget(input.goldBudgetCp, normalTreasureCount),
    Math.max(
      1,
      roundHalfUp(
        multiply(rational(BigInt(input.goldBudgetCp)), rational(1n, 5n))
      )
    )
  ]
  let questUsed = false
  const usedAnchors = new Set<number>()
  const treasures = targets.map((targetValueCp, index) => {
    const stockClass =
      index === targets.length - 1
        ? ('overstock' as const)
        : ('normal' as const)
    const channelRoll = entropy.unit(
      treasurePlanningStream(input.seed, 'treasure-channel', index)
    )
    let rewardChannel: RewardTreasurePlan['rewardChannel'] = 'environment'
    let anchorEncounterNumber: number | null = null
    if (!questUsed && channelRoll < 0.4) {
      rewardChannel = 'quest'
      questUsed = true
    } else if (channelRoll < 0.8) {
      const candidates = input.encounterNumbers.filter(
        (anchor) => !usedAnchors.has(anchor)
      )
      if (candidates.length > 0) {
        rewardChannel = 'encounter'
        anchorEncounterNumber =
          candidates[
            entropy.modulo(
              treasurePlanningStream(input.seed, 'encounter-anchor', index),
              candidates.length
            )
          ]!
        usedAnchors.add(anchorEncounterNumber)
      }
    }
    return {
      id: `treasure:${index + 1}`,
      stockClass,
      rewardChannel,
      anchorEncounterNumber,
      theme:
        themes[
          entropy.modulo(
            treasurePlanningStream(input.seed, 'theme', index),
            themes.length
          )
        ]!,
      targetValueCp
    }
  })
  return freezeStage({
    treasures,
    normalTreasureCount,
    overstockTreasureCount
  })
}

export type GroupTreasurePlanningInput = Readonly<{
  seed: number
  goldBudgetCp: number
  themes: readonly LootTheme[]
}>

/**
 * Produces exactly one normal Encounter-channel plan and no side channel.
 * Saved scene/group IDs are provenance; selection entropy depends on the
 * explicit seed and reward facts, not on randomly allocated owner IDs.
 */
export function planGroupRewardTreasure(
  input: GroupTreasurePlanningInput,
  entropy: EncounterEntropy
): TreasurePlanningOutput {
  const themes = input.themes.filter((theme) => theme.active)
  if (themes.length === 0) throw new Error('group_reward_theme_unavailable')
  return freezeStage({
    treasures: [
      {
        id: 'treasure:1',
        stockClass: 'normal',
        rewardChannel: 'encounter',
        anchorEncounterNumber: null,
        theme:
          themes[
            entropy.modulo(
              treasurePlanningStream(input.seed, 'group-theme', 0),
              themes.length
            )
          ]!,
        targetValueCp: input.goldBudgetCp
      }
    ],
    normalTreasureCount: 1,
    overstockTreasureCount: 0
  })
}

function splitBudget(total: number, count: number): number[] {
  const weights = Array.from({ length: count }, (_, index) => count - index)
  const denominator = weights.reduce((sum, weight) => sum + weight, 0)
  let allocated = 0
  return weights.map((weight, index) => {
    const value =
      index === weights.length - 1
        ? total - allocated
        : Math.max(
            1,
            roundHalfUp(
              divide(
                rational(BigInt(total * weight)),
                rational(BigInt(denominator))
              )
            )
          )
    allocated += value
    return value
  })
}
