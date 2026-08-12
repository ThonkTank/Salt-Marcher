import type { EncounterEntropy } from './deterministic-order.js'
import { rewardBudgetStream } from './entropy-streams.js'
import {
  lootRarities,
  type FullSessionGenerationCatalog,
  type LootRarity
} from './loot-catalog.js'
import {
  add,
  floor,
  multiply,
  rational,
  subtract,
  toNumber
} from './rational.js'
import type { NormalizedRewardBasis } from './reward-basis-stage.js'
import {
  goldPerXp,
  magicPerXp,
  perCharacterRewardXp,
  rawMagicTarget,
  rewardGoldBudget,
  type CopperPieces,
  type GoldPerXp,
  type MagicPerXp,
  type PerCharacterXp
} from './reward-units.js'

export type RewardBudgetProfile = 'session' | 'group_reward'

export type RewardBudgetStageInput = Readonly<{
  basis: NormalizedRewardBasis
  catalog: FullSessionGenerationCatalog
  seed: number
  profile: RewardBudgetProfile
}>

export type RewardBudgetStageOutput = Readonly<{
  perCharacterXp: PerCharacterXp
  goldBudgetCp: CopperPieces
  magicTargets: Readonly<Record<LootRarity, number>>
}>

/**
 * Preconditions: every active party level has one progression row.
 * Postconditions: copper and rarity targets are non-negative integers; all
 * rational rounding happens exactly once in this stage.
 */
export function calculateRewardBudget(
  input: RewardBudgetStageInput,
  entropy: EncounterEntropy
): RewardBudgetStageOutput {
  const rates = weightedProgressionRates(input.basis, input.catalog)
  const perCharacterXp = perCharacterRewardXp(
    input.basis.rewardXp,
    input.basis.partyCount
  )
  const magicTargets = Object.fromEntries(
    lootRarities.map((rarity, index) => {
      const raw = rawMagicTarget(perCharacterXp, rates.magicPerXp[rarity])
      const base = floor(raw)
      const remainder = subtract(raw, rational(BigInt(base)))
      const streamKind =
        input.profile === 'session' ? 'magic-target' : 'group-magic-target'
      return [
        rarity,
        base +
          (entropy.unit(rewardBudgetStream(input.seed, streamKind, index)) <
          toNumber(remainder)
            ? 1
            : 0)
      ]
    })
  ) as Record<LootRarity, number>
  return Object.freeze({
    perCharacterXp,
    goldBudgetCp: rewardGoldBudget(perCharacterXp, rates.goldPerXp),
    magicTargets: Object.freeze(magicTargets)
  })
}

function weightedProgressionRates(
  basis: NormalizedRewardBasis,
  catalog: FullSessionGenerationCatalog
): Readonly<{
  goldPerXp: GoldPerXp
  magicPerXp: Readonly<Record<LootRarity, MagicPerXp>>
}> {
  const rows = basis.party.map((entry) => {
    const row = catalog.progression.find(
      (candidate) => candidate.level === entry.level
    )
    if (!row) throw new Error('missing_reward_progression')
    return { entry, row }
  })
  const weightedGold = rows.reduce(
    (sum, { entry, row }) =>
      add(sum, multiply(row.goldPerXp.value, rational(BigInt(entry.count)))),
    rational(0n)
  )
  const weightedMagic = Object.fromEntries(
    lootRarities.map((rarity) => [
      rarity,
      magicPerXp(
        rows.reduce(
          (sum, { entry, row }) =>
            add(
              sum,
              multiply(
                row.magicPerXp[rarity].value,
                rational(BigInt(entry.count))
              )
            ),
          rational(0n)
        )
      )
    ])
  ) as Record<LootRarity, MagicPerXp>
  return Object.freeze({
    goldPerXp: goldPerXp(weightedGold),
    magicPerXp: Object.freeze(weightedMagic)
  })
}
