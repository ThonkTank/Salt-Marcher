import {
  REWARD_ENGINE_VERSION,
  type GroupRewardGeneratedRun,
  type GroupRewardGenerationInput,
  type SessionGeneratedRun,
  type SessionGenerationEncounterFailure,
  type SessionGenerationEncounterInput
} from '../../shared/contracts/session-generation.js'
import type { GeneratorPresetConfigV3 } from '../../shared/contracts/generator-presets.js'
import { systemGeneratorPresetId } from '../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../shared/generator/system-generator-preset.js'
import type { EncounterEntropy } from './deterministic-order.js'
import { generateSessionEncounters } from './encounter-engine.js'
import type { FullSessionGenerationCatalog } from './loot-catalog.js'
import { selectMagicItems } from './magic-selection-stage.js'
import { selectNonMagicItems } from './non-magic-selection-stage.js'
import { packTreasures } from './packing-stage.js'
import { aggregateReward } from './reward-aggregation-stage.js'
import { normalizeRewardBasis } from './reward-basis-stage.js'
import { calculateRewardBudget } from './reward-budget-stage.js'
import { calculateLedgerRewardBudget } from './reward-budget-stage.js'
import { fingerprintGeneratorConfig } from './generator-config-fingerprint.js'
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
  }> = {
    id: systemGeneratorPresetId,
    revision: 0,
    config: defaultGeneratorConfig
  }
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
  const budget =
    (input.ledgerParty?.length ?? 0) > 0
      ? calculateLedgerRewardBudget(
          {
            members: input.ledgerParty!,
            rules: preset.config.loot,
            seed: input.seed,
            profile: 'session'
          },
          entropy
        )
      : calculateRewardBudget(
          { basis, catalog, seed: input.seed, profile: 'session' },
          entropy
        )
  const goldBudgetCp = unitValue(budget.goldBudgetCp)
  if (
    goldBudgetCp === 0 &&
    Object.values(budget.magicTargets).every((count) => count === 0)
  )
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
          goldBudgetCp: 0,
          normalTreasureCount: 0,
          overstockTreasureCount: 0,
          magicTargets: budget.magicTargets
        },
        rewardBasis: 'rewardBasis' in budget ? budget.rewardBasis : null,
        encounters: encounter.encounters,
        treasures: [],
        rewardSummary: {
          normalValueCp: 0,
          overstockValueCp: 0,
          magicCount: 0
        },
        warnings: encounter.warnings,
        audits: encounter.audits
      }
    })
  const planning = planSessionTreasures(
    {
      seed: input.seed,
      adventureDayFraction: encounter.input.adventureDayFraction,
      goldBudgetCp,
      encounterNumbers: encounter.encounters.map(
        (entry) => entry.encounterNumber
      ),
      themes: catalog.themes,
      rules: preset.config.loot
    },
    entropy
  )
  const rolePlans = planSlotsAndRoles(
    {
      profile: 'session',
      seed: input.seed,
      adventureDayFraction: encounter.input.adventureDayFraction,
      treasures: planning.treasures,
      rules: preset.config.loot
    },
    entropy
  )
  const selected = selectNonMagicItems(
    {
      seed: input.seed,
      treasures: rolePlans,
      catalog,
      rules: preset.config.loot
    },
    entropy
  )
  const withMagic = selectMagicItems(
    {
      seed: input.seed,
      treasures: selected,
      targets: budget.magicTargets,
      catalog,
      rules: preset.config.loot
    },
    entropy
  )
  const treasures = packTreasures(
    {
      seed: input.seed,
      treasures: withMagic,
      catalog,
      rules: preset.config.loot
    },
    entropy
  )
  const aggregation = aggregateReward({
    treasures,
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    expectedTreasureCount: planning.treasures.length,
    rules: preset.config.loot
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
      rewardBasis: 'rewardBasis' in budget ? budget.rewardBasis : null,
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
  entropy: EncounterEntropy,
  preset: Readonly<{
    id: string
    revision: number
    config: GeneratorPresetConfigV3
  }> = {
    id: systemGeneratorPresetId,
    revision: 0,
    config: defaultGeneratorConfig
  }
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
  const budget =
    (input.ledgerParty?.length ?? 0) > 0
      ? calculateLedgerRewardBudget(
          {
            members: input.ledgerParty!,
            rules: preset.config.loot,
            seed: input.seed,
            profile: 'group_reward'
          },
          entropy
        )
      : calculateRewardBudget(
          { basis, catalog, seed: input.seed, profile: 'group_reward' },
          entropy
        )
  const goldBudgetCp = unitValue(budget.goldBudgetCp)
  if (
    goldBudgetCp === 0 &&
    Object.values(budget.magicTargets).every((count) => count === 0)
  )
    return freezeStage({
      runKind: 'group_reward',
      rewardEngineVersion: REWARD_ENGINE_VERSION,
      catalogVersion: catalog.encounter.catalogVersion,
      catalogContentHash: catalog.encounter.catalogContentHash,
      generatorPreset: {
        id: preset.id,
        revision: preset.revision,
        configHash: fingerprintGeneratorConfig(preset.config)
      },
      input,
      rewardBasis: 'rewardBasis' in budget ? budget.rewardBasis : null,
      goldBudgetCp: 0,
      magicTargets: budget.magicTargets,
      treasures: [],
      rewardSummary: {
        normalValueCp: 0,
        overstockValueCp: 0,
        magicCount: 0
      },
      audits: []
    })
  const planning = planGroupRewardTreasure(
    {
      seed: input.seed,
      goldBudgetCp,
      themes: catalog.themes,
      rules: preset.config.loot
    },
    entropy
  )
  const rolePlans = planSlotsAndRoles(
    {
      profile: 'group_reward',
      seed: input.seed,
      treasures: planning.treasures,
      rules: preset.config.loot
    },
    entropy
  )
  const selected = selectNonMagicItems(
    {
      seed: input.seed,
      treasures: rolePlans,
      catalog,
      rules: preset.config.loot
    },
    entropy
  )
  const withMagic = selectMagicItems(
    {
      seed: input.seed,
      treasures: selected,
      targets: budget.magicTargets,
      catalog,
      rules: preset.config.loot
    },
    entropy
  )
  const treasures = packTreasures(
    {
      seed: input.seed,
      treasures: withMagic,
      catalog,
      rules: preset.config.loot
    },
    entropy
  )
  const aggregation = aggregateReward({
    treasures: [treasures[0]!],
    goldBudgetCp,
    magicTargets: budget.magicTargets,
    expectedTreasureCount: 1,
    rules: preset.config.loot
  })
  if (aggregation.audits.some((audit) => audit.hard && !audit.passed))
    throw new Error('group_reward_hard_audit_failed')

  return freezeStage({
    runKind: 'group_reward',
    rewardEngineVersion: REWARD_ENGINE_VERSION,
    catalogVersion: catalog.encounter.catalogVersion,
    catalogContentHash: catalog.encounter.catalogContentHash,
    generatorPreset: {
      id: preset.id,
      revision: preset.revision,
      configHash: fingerprintGeneratorConfig(preset.config)
    },
    input,
    rewardBasis: 'rewardBasis' in budget ? budget.rewardBasis : null,
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
