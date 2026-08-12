import {
  SESSION_GENERATION_ENGINE_VERSION,
  sessionGenerationEncounterInputSchema,
  sessionGenerationEncounterSuccessSchema,
  type SessionGenerationEncounterInput,
  type SessionGenerationEncounterResult
} from '../../shared/contracts/session-generation.js'
import {
  calculateSessionContext,
  encounterTargets
} from './encounter-target-policy.js'
import {
  buildEncounterIntents,
  buildSelectionIndex,
  sessionCompositionCatalog,
  selectEncounter
} from './encounter-selection-policy.js'
import { canonicalDecimal } from './rational.js'
import type { EncounterCatalog } from './catalog.js'
import type { EncounterEntropy } from './deterministic-order.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetConfigV3
} from '../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../shared/generator/system-generator-preset.js'
import { fingerprintGeneratorConfig } from './generator-config-fingerprint.js'

export type { EncounterEntropy } from './deterministic-order.js'

export function generateSessionEncounters(
  input: unknown,
  catalog: EncounterCatalog,
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
): SessionGenerationEncounterResult {
  const parsed = sessionGenerationEncounterInputSchema.safeParse(input)
  if (!parsed.success)
    return deepFreeze({
      status: 'invalid_input',
      issues: parsed.error.issues.map((issue) => ({
        code: issueCodeForPath(issue.path[0]),
        path: issue.path.map(String),
        parameters: { validationCode: issue.code }
      }))
    })

  const normalized = normalizeInput(parsed.data)
  const context = calculateSessionContext(normalized, catalog)
  const targets = encounterTargets(
    normalized,
    context.encounterCount,
    context.sessionXpTarget,
    catalog
  )
  const partyLevel = clamp(Math.round(context.averageLevel), 1, 20)
  if (targets.some((target) => target <= 0))
    return deepFreeze({
      status: 'unresolvable',
      issues: [
        {
          code: 'no_candidate',
          parameters: { reason: 'non_positive_target' }
        }
      ]
    })
  const selectionIndex = buildSelectionIndex(
    sessionCompositionCatalog(catalog),
    partyLevel,
    preset.config
  )
  const selected = targets.map((targetXp, index) =>
    selectEncounter(
      normalized.seed,
      index + 1,
      targetXp,
      selectionIndex,
      entropy,
      preset.config,
      context.partyCount
    )
  )

  if (selected.some((entry) => entry.candidate === undefined))
    return deepFreeze({
      status: 'unresolvable',
      issues: [
        {
          code: 'no_candidate',
          parameters: { reason: 'candidate_set_empty' }
        }
      ]
    })

  const encounters = buildEncounterIntents(selected, normalized.party)
  const warnings: Array<{
    code: 'candidate_outside_tolerance' | 'constraints_approximated'
    encounterNumber: number
    parameters: Readonly<Record<string, string | number | boolean | null>>
  }> = [
    ...selected
      .filter((entry) => !entry.selectedFit)
      .map((entry) => ({
        code: 'candidate_outside_tolerance' as const,
        encounterNumber: entry.encounterNumber,
        parameters: {
          targetXp: entry.target,
          fitCandidateCount: entry.fitCandidateCount
        }
      })),
    ...selected
      .filter((entry) => !entry.selectedSoftFit)
      .map((entry) => ({
        code: 'constraints_approximated' as const,
        encounterNumber: entry.encounterNumber,
        parameters: {
          constraintCount: entry.composition?.diagnostics.length ?? 0
        }
      }))
  ]
  const audits = [
    {
      code: 'encounter_target_sum' as const,
      passed:
        targets.reduce((sum, value) => sum + value, 0) ===
        context.sessionXpTarget,
      hard: true,
      parameters: {
        actual: targets.reduce((sum, value) => sum + value, 0),
        expected: context.sessionXpTarget
      }
    },
    {
      code: 'candidate_coverage' as const,
      passed: selected.every((entry) => entry.candidateCount > 0),
      hard: true,
      parameters: {
        encounterCount: selected.length,
        zeroCandidateCount: selected.filter(
          (entry) => entry.candidateCount === 0
        ).length
      }
    },
    {
      code: 'encounter_selector_fit' as const,
      passed: selected.every((entry) => entry.selectedFit),
      hard: false,
      parameters: {
        encounterCount: selected.length,
        fitCount: selected.filter((entry) => entry.selectedFit).length
      }
    },
    {
      code: 'deterministic_seed_path' as const,
      passed: true,
      hard: true,
      parameters: { algorithm: 'sha256_named_streams' }
    }
  ]
  if (audits.some((audit) => audit.hard && !audit.passed))
    return deepFreeze({
      status: 'unresolvable',
      issues: [
        {
          code: 'hard_audit_failed',
          parameters: { stage: 'encounter_aggregation' }
        }
      ]
    })

  const result = sessionGenerationEncounterSuccessSchema.parse({
    status: 'success',
    engineVersion: SESSION_GENERATION_ENGINE_VERSION,
    catalogVersion: catalog.catalogVersion,
    catalogContentHash: catalog.catalogContentHash,
    generatorPreset: {
      id: preset.id,
      revision: preset.revision,
      configHash: fingerprintGeneratorConfig(preset.config)
    },
    input: normalized,
    session: {
      partyCount: context.partyCount,
      dayXpBudget: context.dayXpBudget,
      sessionXpTarget: context.sessionXpTarget,
      averageLevel: context.averageLevel,
      encounterCount: context.encounterCount
    },
    encounters,
    warnings,
    audits
  })
  return deepFreeze(result)
}

function normalizeInput(
  input: SessionGenerationEncounterInput
): SessionGenerationEncounterInput {
  return {
    ...input,
    party: [...input.party].sort((left, right) => left.level - right.level),
    adventureDayFraction: canonicalDecimal(input.adventureDayFraction)
  }
}

function issueCodeForPath(
  path: PropertyKey | undefined
): 'invalid_party' | 'invalid_fraction' | 'invalid_encounter_count' {
  if (path === 'adventureDayFraction') return 'invalid_fraction'
  if (path === 'encounterCount') return 'invalid_encounter_count'
  return 'invalid_party'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
