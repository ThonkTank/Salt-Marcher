import {
  REWARD_ENGINE_VERSION,
  type GroupRewardGeneratedRun,
  type GroupRewardGenerationInput,
  type SessionGeneratedRun,
  type SessionGenerationEncounterFailure,
  type SessionGenerationRunInput
} from '../../shared/contracts/session-generation.js'
import type { GeneratorPresetConfigV3 } from '../../shared/contracts/generator-presets.js'
import { systemGeneratorPresetId } from '../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../shared/generator/system-generator-preset.js'
import type { EncounterEntropy } from './deterministic-order.js'
import { generateSessionEncounters } from './encounter-engine.js'
import type { FullSessionGenerationCatalog } from './loot-catalog.js'
import { fingerprintGeneratorConfig } from './generator-config-fingerprint.js'
import { createGenerationCatalogIndex } from './generation-catalog-index.js'
import { generateRewardProposal } from './reward-proposal-pipeline.js'
import { freezeStage } from './reward-stage-types.js'
import {
  adjustedXp,
  baseXp,
  rewardXpFromAdjustedXp,
  rewardXpFromBaseXp,
  unitValue
} from './reward-units.js'

const standaloneRunId = '00000000-0000-4000-8000-000000000099'

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

export type GroupRewardDraftResult =
  | Readonly<{ status: 'success'; draft: GroupRewardDraft }>
  | SessionGenerationEncounterFailure

export function generateSessionRunDraft(
  input: SessionGenerationRunInput,
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
  },
  runId = standaloneRunId
): GeneratedRunDraftResult {
  if (!input.ledgerParty || input.ledgerParty.length === 0)
    return freezeStage({
      status: 'invalid_input',
      issues: [
        {
          code: 'invalid_party',
          path: ['ledgerParty'],
          parameters: { reason: 'missing_ledger_reward_party' }
        }
      ]
    })
  const encounter = generateSessionEncounters(
    input,
    catalog.encounter,
    entropy,
    preset
  )
  if (encounter.status !== 'success') return encounter

  const proposalResult = generateRewardProposal(
    {
      runId,
      seed: input.seed,
      members: input.ledgerParty,
      rewardXp: encounter.session.sessionXpTarget,
      rules: preset.config.loot,
      catalogIndex: createGenerationCatalogIndex(catalog),
      planPolicy: {
        kind: 'session',
        adventureDayFraction: encounter.input.adventureDayFraction,
        encounterNumbers: encounter.encounters.map(
          (entry) => entry.encounterNumber
        )
      }
    },
    entropy
  )
  if (proposalResult.status !== 'success')
    return freezeStage({
      status: 'unresolvable',
      issues: proposalResult.issues.map((issue) => ({
        code: issue.code,
        parameters: { ...issue.parameters }
      }))
    })
  const proposal = proposalResult.proposal

  return freezeStage({
    status: 'success',
    draft: {
      runKind: 'session',
      engineVersion: encounter.engineVersion,
      rewardEngineVersion: REWARD_ENGINE_VERSION,
      catalogVersion: encounter.catalogVersion,
      catalogContentHash: encounter.catalogContentHash,
      generatorPreset: encounter.generatorPreset,
      input: { ...encounter.input, ledgerParty: input.ledgerParty },
      session: {
        ...encounter.session,
        goldBudgetCp: proposal.goldBudgetCp,
        normalTreasureCount: proposal.normalTreasureCount,
        overstockTreasureCount: proposal.overstockTreasureCount,
        magicTargets: proposal.magicTargets
      },
      rewardBasis: proposal.rewardBasis,
      encounters: encounter.encounters,
      itemDefinitions: [...proposal.itemDefinitions],
      treasures: [...proposal.treasures],
      rewardSummary: proposal.rewardSummary,
      warnings: encounter.warnings,
      audits: [...encounter.audits, ...proposal.audits]
    }
  })
}

export function generateGroupRewardDraftResult(
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
  },
  runId = standaloneRunId
): GroupRewardDraftResult {
  if (!input.ledgerParty || input.ledgerParty.length === 0)
    return freezeStage({
      status: 'invalid_input',
      issues: [
        {
          code: 'invalid_party',
          path: ['ledgerParty'],
          parameters: { reason: 'missing_ledger_reward_party' }
        }
      ]
    })
  const selectedRewardXp =
    input.rewardXpBasis === 'base'
      ? rewardXpFromBaseXp(baseXp(input.baseXp))
      : rewardXpFromAdjustedXp(adjustedXp(input.adjustedXp))
  if (unitValue(selectedRewardXp) !== input.rewardXp)
    return freezeStage({
      status: 'invalid_input',
      issues: [
        {
          code: 'invalid_party',
          path: ['rewardXp'],
          parameters: { reason: 'reward_xp_basis_mismatch' }
        }
      ]
    })
  const proposalResult = generateRewardProposal(
    {
      runId,
      seed: input.seed,
      members: input.ledgerParty,
      rewardXp: input.rewardXp,
      rules: preset.config.loot,
      catalogIndex: createGenerationCatalogIndex(catalog),
      planPolicy: { kind: 'group_reward' }
    },
    entropy
  )
  if (proposalResult.status !== 'success')
    return freezeStage({
      status: 'unresolvable',
      issues: proposalResult.issues.map((issue) => ({
        code: issue.code,
        parameters: { ...issue.parameters }
      }))
    })
  const proposal = proposalResult.proposal

  return freezeStage({
    status: 'success',
    draft: {
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
      rewardBasis: proposal.rewardBasis,
      goldBudgetCp: proposal.goldBudgetCp,
      magicTargets: proposal.magicTargets,
      itemDefinitions: [...proposal.itemDefinitions],
      treasures: [...proposal.treasures],
      rewardSummary: {
        normalValueCp: proposal.rewardSummary.normalValueCp,
        overstockValueCp: 0,
        magicCount: proposal.rewardSummary.magicCount
      },
      audits: [...proposal.audits]
    }
  })
}

/** @deprecated Prefer the typed result when expected failures must cross a boundary. */
export function generateGroupRewardDraft(
  ...parameters: Parameters<typeof generateGroupRewardDraftResult>
): GroupRewardDraft {
  const result = generateGroupRewardDraftResult(...parameters)
  if (result.status !== 'success')
    throw new Error(
      String(result.issues[0]?.parameters['reason'] ?? result.status)
    )
  return result.draft
}
