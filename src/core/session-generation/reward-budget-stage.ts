import type { EncounterEntropy } from './deterministic-order.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import type {
  GeneratedRewardBasis,
  LedgerRewardPartyMember
} from '../../shared/contracts/session-generation.js'
import { generatedRewardBasisSchema } from '../../shared/contracts/session-generation.js'
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
  copperPieces,
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

export type LedgerRewardBudgetStageOutput = Readonly<{
  goldBudgetCp: CopperPieces
  magicTargets: Readonly<Record<LootRarity, number>>
  rewardBasis: GeneratedRewardBasis
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

/** Calculates the missing cumulative reward at projected post-reward XP. */
export function calculateLedgerRewardBudget(
  input: Readonly<{
    members: readonly LedgerRewardPartyMember[]
    rules: GeneratorLootRules
    seed: number
    profile: RewardBudgetProfile
  }>,
  entropy: EncounterEntropy
): LedgerRewardBudgetStageOutput {
  if (input.members.length === 0) throw new Error('missing_ledger_reward_party')
  const targetGoldCp = Math.round(
    input.members.reduce(
      (sum, member) =>
        sum +
        goldTargetAtXp(member.currentXp + member.projectedXp, input.rules),
      0
    )
  )
  const currentGoldCp = input.members.reduce(
    (sum, member) => sum + member.currentNonMagicCp,
    0
  )
  const targetMagic = Object.fromEntries(
    lootRarities.map((rarity, index) => {
      const expected = input.members.reduce(
        (sum, member) =>
          sum +
          magicTargetAtXp(
            member.currentXp + member.projectedXp,
            rarity,
            input.rules
          ),
        0
      )
      const base = Math.floor(expected)
      const streamKind =
        input.profile === 'session' ? 'magic-target' : 'group-magic-target'
      return [
        rarity,
        base +
          (entropy.unit(rewardBudgetStream(input.seed, streamKind, index)) <
          expected - base
            ? 1
            : 0)
      ]
    })
  ) as Record<LootRarity, number>
  const currentMagic = Object.fromEntries(
    lootRarities.map((rarity) => [
      rarity,
      input.members.reduce(
        (sum, member) => sum + member.currentMagic[rarity],
        0
      )
    ])
  ) as Record<LootRarity, number>
  const magicDeficit = Object.fromEntries(
    lootRarities.map((rarity) => [
      rarity,
      Math.max(0, targetMagic[rarity] - currentMagic[rarity])
    ])
  ) as Record<LootRarity, number>
  const goldDeficitCp = Math.max(0, targetGoldCp - currentGoldCp)
  return Object.freeze({
    goldBudgetCp: copperPieces(goldDeficitCp),
    magicTargets: Object.freeze(magicDeficit),
    rewardBasis: generatedRewardBasisSchema.parse({
      members: input.members,
      targetGoldCp,
      currentGoldCp,
      goldDeficitCp,
      targetMagic,
      currentMagic,
      magicDeficit
    })
  })
}

function goldTargetAtXp(xp: number, rules: GeneratorLootRules): number {
  const rows = rules.progression
  const last = rows.at(-1)!
  if (xp >= last.xpAtLevel) return last.goldAtLevelCp
  const lowerIndex = Math.max(
    0,
    rows.findLastIndex((row) => row.xpAtLevel <= xp)
  )
  const lower = rows[lowerIndex]!
  const upper = rows[lowerIndex + 1]!
  const fraction = (xp - lower.xpAtLevel) / (upper.xpAtLevel - lower.xpAtLevel)
  return (
    lower.goldAtLevelCp + (upper.goldAtLevelCp - lower.goldAtLevelCp) * fraction
  )
}

function magicTargetAtXp(
  xp: number,
  rarity: LootRarity,
  rules: GeneratorLootRules
): number {
  let target = 0
  for (let index = 0; index < rules.progression.length - 1; index += 1) {
    const row = rules.progression[index]!
    const upper = rules.progression[index + 1]!.xpAtLevel
    const elapsed = Math.max(0, Math.min(xp, upper) - row.xpAtLevel)
    target += elapsed * row.magicPerXp[rarity]
    if (xp <= upper) break
  }
  return target
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
