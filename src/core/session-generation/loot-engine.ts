import {
  REWARD_ENGINE_VERSION,
  type GroupRewardGeneratedRun,
  type GroupRewardGenerationInput,
  type SessionGeneratedRun,
  type SessionGenerationEncounterFailure,
  type SessionGenerationEncounterInput
} from '../../shared/contracts/session-generation.js'
import type { GeneratorPresetConfigV3 } from '../../shared/contracts/generator-presets.js'
import type { EncounterEntropy } from './deterministic-order.js'
import { generateSessionEncounters } from './encounter-engine.js'
import type { FullSessionGenerationCatalog } from './loot-catalog.js'
import { selectMagicItems } from './magic-selection-stage.js'
import { selectNonMagicItems } from './non-magic-selection-stage.js'
import { packTreasures } from './packing-stage.js'
import { aggregateReward } from './reward-aggregation-stage.js'
import { normalizeRewardBasis } from './reward-basis-stage.js'
import { calculateRewardBudget } from './reward-budget-stage.js'
import { freezeStage } from './reward-stage-types.js'
import {
  adjustedXp,
  baseXp,
  partyXp,
  rewardXpFromAdjustedXp,
  rewardXpFromBaseXp,
  rewardXpFromPartyXp,
  unitValue
} from './reward-units.js'
import { planSlotsAndRoles } from './slot-role-stage.js'
import {
  planGroupRewardTreasure,
  planSessionTreasures
} from './treasure-planning-stage.js'

export type GeneratedRunDraft = Omit<
  SessionGeneratedRun,
  'id' | 'originFingerprint' | 'generatedAt'
>

export type GeneratedRunDraftResult =
  | Readonly<{ status: 'success'; draft: GeneratedRunDraft }>
  | SessionGenerationEncounterFailure

export type GroupRewardDraft = Omit<
  GroupRewardGeneratedRun,
  'id' | 'originFingerprint' | 'generatedAt'
>

export function generateSessionRunDraft(
  input: SessionGenerationEncounterInput,
  catalog: FullSessionGenerationCatalog,
  entropy: EncounterEntropy,
  preset: Readonly<{
    id: string
    revision: number
    config: GeneratorPresetConfigV3
  }>
): GeneratedRunDraftResult {
  const encounter = generateSessionEncounters(
    input,
    catalog.encounter,
    entropy,
    preset
  )
  if (encounter.status !== 'success') return encounter

  const basis = normalizeRewardBasis({
    party: encounter.input.party,
    rewardXp: rewardXpFromPartyXp(partyXp(encounter.session.sessionXpTarget))
  })
  const budget = calculateRewardBudget(
    { basis, catalog, seed: input.seed, profile: 'session' },
    entropy
  )
  const goldBudgetCp = unitValue(budget.goldBudgetCp)
  const planning = planSessionTreasures(
    {
      seed: input.seed,
      adventureDayFraction: encounter.input.adventureDayFraction,
      goldBudgetCp,
      encounterNumbers: encounter.encounters.map(
        (entry) => entry.encounterNumber
      ),
      themes: catalog.themes
    },
    entropy
  )
  const rolePlans = planSlotsAndRoles(
    {
      profile: 'session',
      seed: input.seed,
      adventureDayFraction: encounter.input.adventureDayFraction,
      treasures: planning.treasures
    },
    entropy
  )
  const selected = selectNonMagicItems(
    { seed: input.seed, treasures: rolePlans, catalog },
    entropy
  )
  const withMagic = selectMagicItems(
    {
      seed: input.seed,
      treasures: selected,
      targets: budget.magicTargets,
      catalog
    },
    entropy
  )
  const treasures = packTreasures(
    { seed: input.seed, treasures: withMagic, catalog },
    entropy
  )
  const aggregation = aggregateReward({
    treasures,
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    expectedTreasureCount: planning.treasures.length
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

  return freezeStage({
    status: 'success',
    draft: {
      runKind: 'session',
      engineVersion: encounter.engineVersion,
      rewardEngineVersion: REWARD_ENGINE_VERSION,
      catalogVersion: encounter.catalogVersion,
      catalogContentHash: encounter.catalogContentHash,
      generatorPreset: encounter.generatorPreset,
      input: encounter.input,
      session: {
        ...encounter.session,
        goldBudgetCp,
        normalTreasureCount: planning.normalTreasureCount,
        overstockTreasureCount: planning.overstockTreasureCount,
        magicTargets: budget.magicTargets
      },
      encounters: encounter.encounters,
      treasures: [...treasures],
      rewardSummary: {
        normalValueCp: aggregation.normalValueCp,
        overstockValueCp: aggregation.overstockValueCp,
        magicCount: aggregation.magicCount
      },
      warnings: encounter.warnings,
      audits: [...encounter.audits, ...aggregation.audits]
    }
  })
}

export function generateGroupRewardDraft(
  input: GroupRewardGenerationInput,
  catalog: FullSessionGenerationCatalog,
  entropy: EncounterEntropy
): GroupRewardDraft {
  const selectedRewardXp =
    input.rewardXpBasis === 'base'
      ? rewardXpFromBaseXp(baseXp(input.baseXp))
      : rewardXpFromAdjustedXp(adjustedXp(input.adjustedXp))
  if (unitValue(selectedRewardXp) !== input.rewardXp)
    throw new Error('group_reward_xp_basis_mismatch')
  const basis = normalizeRewardBasis({
    party: input.party,
    rewardXp: selectedRewardXp
  })
  const budget = calculateRewardBudget(
    { basis, catalog, seed: input.seed, profile: 'group_reward' },
    entropy
  )
  const goldBudgetCp = unitValue(budget.goldBudgetCp)
  const planning = planGroupRewardTreasure(
    {
      seed: input.seed,
      goldBudgetCp,
      themes: catalog.themes
    },
    entropy
  )
  const rolePlans = planSlotsAndRoles(
    {
      profile: 'group_reward',
      seed: input.seed,
      treasures: planning.treasures
    },
    entropy
  )
  const selected = selectNonMagicItems(
    { seed: input.seed, treasures: rolePlans, catalog },
    entropy
  )
  const withMagic = selectMagicItems(
    {
      seed: input.seed,
      treasures: selected,
      targets: budget.magicTargets,
      catalog
    },
    entropy
  )
  const treasures = packTreasures(
    { seed: input.seed, treasures: withMagic, catalog },
    entropy
  )
  const aggregation = aggregateReward({
    treasures: [treasures[0]!],
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    expectedTreasureCount: 1
  })
  if (aggregation.audits.some((audit) => audit.hard && !audit.passed))
    throw new Error('group_reward_hard_audit_failed')

  return freezeStage({
    runKind: 'group_reward',
    rewardEngineVersion: REWARD_ENGINE_VERSION,
    catalogVersion: catalog.encounter.catalogVersion,
    catalogContentHash: catalog.encounter.catalogContentHash,
    input,
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    treasures: [treasures[0]!],
    rewardSummary: {
      normalValueCp: aggregation.normalValueCp,
      overstockValueCp: 0,
      magicCount: aggregation.magicCount
    },
    audits: [...aggregation.audits]
  })
}
