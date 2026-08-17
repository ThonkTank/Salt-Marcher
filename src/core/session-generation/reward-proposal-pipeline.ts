import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import type {
  EncounterAudit,
  GeneratedRewardBasis,
  GeneratedTreasure,
  LedgerRewardPartyMember
} from '../../shared/contracts/session-generation.js'
import type { ItemDefinition } from '../../shared/contracts/loot.js'
import type { EncounterEntropy } from './deterministic-order.js'
import type { GenerationCatalogIndex } from './generation-catalog-index.js'
import type { LootRarity } from './loot-catalog.js'
import { selectMagicItems } from './magic-selection-stage.js'
import { selectNonMagicItems } from './non-magic-selection-stage.js'
import { packTreasures } from './packing-stage.js'
import { aggregateReward } from './reward-aggregation-stage.js'
import { calculateLedgerRewardBudget } from './reward-budget-stage.js'
import { freezeStage } from './reward-stage-types.js'
import { createRewardRandom } from './reward-random.js'
import { unitValue } from './reward-units.js'
import { planSlotsAndRoles } from './slot-role-stage.js'
import {
  planGroupRewardTreasure,
  planSessionTreasures
} from './treasure-planning-stage.js'

export type RewardPlanPolicy =
  | Readonly<{
      kind: 'session'
      adventureDayFraction: string
      encounterNumbers: readonly number[]
    }>
  | Readonly<{ kind: 'group_reward' }>

export type RewardProposal = Readonly<{
  rewardBasis: GeneratedRewardBasis
  goldBudgetCp: number
  magicTargets: Readonly<Record<LootRarity, number>>
  normalTreasureCount: number
  overstockTreasureCount: number
  itemDefinitions: readonly ItemDefinition[]
  treasures: readonly GeneratedTreasure[]
  rewardSummary: Readonly<{
    normalValueCp: number
    overstockValueCp: number
    magicCount: number
  }>
  audits: readonly EncounterAudit[]
}>

export type RewardProposalResult =
  | Readonly<{ status: 'success'; proposal: RewardProposal }>
  | Readonly<{
      status: 'unresolvable'
      issues: readonly Readonly<{
        code: 'hard_audit_failed'
        parameters: Readonly<{ stage: 'reward_aggregation' }>
      }>[]
    }>

export function generateRewardProposal(
  input: Readonly<{
    runId: string
    seed: number
    members: readonly LedgerRewardPartyMember[]
    rewardXp: number
    rules: GeneratorLootRules
    catalogIndex: GenerationCatalogIndex
    planPolicy: RewardPlanPolicy
  }>,
  entropy: EncounterEntropy
): RewardProposalResult {
  const random = createRewardRandom(input.seed, entropy)
  const profile = input.planPolicy.kind
  const budget = calculateLedgerRewardBudget(
    {
      members: input.members,
      rewardXp: input.rewardXp,
      rules: input.rules,
      profile
    },
    random
  )
  const goldBudgetCp = unitValue(budget.goldBudgetCp)
  if (
    goldBudgetCp === 0 &&
    Object.values(budget.magicTargets).every((count) => count === 0)
  )
    return success({
      rewardBasis: budget.rewardBasis,
      goldBudgetCp: 0,
      magicTargets: budget.magicTargets,
      normalTreasureCount: 0,
      overstockTreasureCount: 0,
      itemDefinitions: [],
      treasures: [],
      rewardSummary: {
        normalValueCp: 0,
        overstockValueCp: 0,
        magicCount: 0
      },
      audits: []
    })

  const catalog = input.catalogIndex.catalog
  const planning =
    input.planPolicy.kind === 'session'
      ? planSessionTreasures(
          {
            adventureDayFraction: input.planPolicy.adventureDayFraction,
            goldBudgetCp,
            encounterNumbers: input.planPolicy.encounterNumbers,
            themes: catalog.themes,
            rules: input.rules
          },
          random
        )
      : planGroupRewardTreasure(
          {
            goldBudgetCp,
            themes: catalog.themes,
            rules: input.rules
          },
          random
        )
  const rolePlans = planSlotsAndRoles(
    {
      profile,
      ...(input.planPolicy.kind === 'session'
        ? { adventureDayFraction: input.planPolicy.adventureDayFraction }
        : {}),
      treasures: planning.treasures,
      rules: input.rules
    },
    random
  )
  const selected = selectNonMagicItems(
    {
      runId: input.runId,
      treasures: rolePlans,
      catalogIndex: input.catalogIndex,
      rules: input.rules
    },
    random
  )
  const withMagic = selectMagicItems(
    {
      runId: input.runId,
      treasures: selected,
      targets: budget.magicTargets,
      catalogIndex: input.catalogIndex,
      rules: input.rules
    },
    random
  )
  const treasures = packTreasures(
    {
      treasures: withMagic,
      catalogIndex: input.catalogIndex,
      rules: input.rules
    },
    random
  )
  const itemDefinitions = withMagic.flatMap((treasure) =>
    treasure.items.map((item) => item.definition)
  )
  const aggregation = aggregateReward({
    treasures,
    itemDefinitions,
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    expectedTreasureCount: planning.treasures.length,
    profile,
    rules: input.rules,
    catalogIndex: input.catalogIndex
  })
  if (aggregation.audits.some((audit) => audit.hard && !audit.passed))
    return freezeStage({
      status: 'unresolvable',
      issues: [
        {
          code: 'hard_audit_failed',
          parameters: { stage: 'reward_aggregation' }
        }
      ]
    })
  return success({
    rewardBasis: budget.rewardBasis,
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    normalTreasureCount: planning.normalTreasureCount,
    overstockTreasureCount: planning.overstockTreasureCount,
    itemDefinitions,
    treasures,
    rewardSummary: {
      normalValueCp: aggregation.normalValueCp,
      overstockValueCp: aggregation.overstockValueCp,
      magicCount: aggregation.magicCount
    },
    audits: aggregation.audits
  })
}

function success(proposal: RewardProposal): RewardProposalResult {
  return freezeStage({ status: 'success', proposal })
}
