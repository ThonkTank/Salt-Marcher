import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import type { RewardRandom } from './reward-random.js'
import type { LootTheme } from './loot-catalog.js'
import { decimal, divide, multiply, rational, roundHalfUp } from './rational.js'
import { freezeStage, type RewardTreasurePlan } from './reward-stage-types.js'

export type SessionTreasurePlanningInput = Readonly<{
  adventureDayFraction: string
  goldBudgetCp: number
  encounterNumbers: readonly number[]
  themes: readonly LootTheme[]
  rules?: GeneratorLootRules
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
  random: RewardRandom
): TreasurePlanningOutput {
  const themes = input.themes.filter((theme) => theme.active)
  if (themes.length === 0) throw new Error('reward_theme_unavailable')
  const rules = input.rules ?? defaultGeneratorLootRules
  const fraction = decimal(input.adventureDayFraction)
  const variance = rules.treasure.treasureCountVariance
  const fullDayTreasureCount =
    rules.treasure.treasuresPerAdventureDay +
    random.modulo('treasure-count', 0, variance * 2 + 1) -
    variance
  const totalTreasureCount = Math.max(
    rules.treasure.overstockShare > 0 ? 2 : 1,
    roundHalfUp(multiply(rational(BigInt(fullDayTreasureCount)), fraction))
  )
  const overstockTreasureCount =
    rules.treasure.overstockShare > 0 && totalTreasureCount > 1 ? 1 : 0
  const normalTreasureCount = totalTreasureCount - overstockTreasureCount
  const targets = [
    ...splitBudget(input.goldBudgetCp, normalTreasureCount),
    ...(overstockTreasureCount
      ? [
          Math.max(
            1,
            Math.round(input.goldBudgetCp * rules.treasure.overstockShare)
          )
        ]
      : [])
  ]
  let questUsed = false
  const usedAnchors = new Set<number>()
  const treasures = targets.map((targetValueCp, index) => {
    const stockClass =
      overstockTreasureCount > 0 && index === targets.length - 1
        ? ('overstock' as const)
        : ('normal' as const)
    const channelRoll = random.unit('treasure-channel', index)
    let rewardChannel: RewardTreasurePlan['rewardChannel'] = 'environment'
    let anchorEncounterNumber: number | null = null
    if (!questUsed && channelRoll < rules.treasure.channels.quest) {
      rewardChannel = 'quest'
      questUsed = true
    } else if (
      channelRoll <
      rules.treasure.channels.quest + rules.treasure.channels.encounter
    ) {
      const candidates = input.encounterNumbers.filter(
        (anchor) => !usedAnchors.has(anchor)
      )
      if (candidates.length > 0) {
        rewardChannel = 'encounter'
        anchorEncounterNumber =
          candidates[
            random.modulo('encounter-anchor', index, candidates.length)
          ]!
        usedAnchors.add(anchorEncounterNumber)
      }
    }
    return {
      id: `treasure:${index + 1}`,
      stockClass,
      rewardChannel,
      anchorEncounterNumber,
      theme: themes[random.modulo('theme', index, themes.length)]!,
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
  goldBudgetCp: number
  themes: readonly LootTheme[]
  rules?: GeneratorLootRules
}>

/**
 * Produces exactly one normal Encounter-channel plan and no side channel.
 * Saved scene/group IDs are provenance; selection entropy depends on the
 * explicit seed and reward facts, not on randomly allocated owner IDs.
 */
export function planGroupRewardTreasure(
  input: GroupTreasurePlanningInput,
  random: RewardRandom
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
        theme: themes[random.modulo('group-theme', 0, themes.length)]!,
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
