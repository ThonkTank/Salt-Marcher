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
        message: issue.message
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
          message: 'Encounter targets must be positive.'
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
          message: 'No encounter candidate can satisfy the requested target.'
        }
      ]
    })

  const encounters = buildEncounterIntents(selected, normalized.party)
  const warnings: Array<{
    code: 'candidate_outside_tolerance' | 'constraints_approximated'
    encounterNumber: number
    message: string
  }> = [
    ...selected
      .filter((entry) => !entry.selectedFit)
      .map((entry) => ({
        code: 'candidate_outside_tolerance' as const,
        encounterNumber: entry.encounterNumber,
        message:
          'No candidate was within the target tolerance; the closest available candidate was selected.'
      })),
    ...selected
      .filter((entry) => !entry.selectedSoftFit)
      .map((entry) => ({
        code: 'constraints_approximated' as const,
        encounterNumber: entry.encounterNumber,
        message:
          entry.composition?.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(' ') ?? ''
      }))
  ]
  const audits = [
    {
      name: 'Encounter target sum',
      passed:
        targets.reduce((sum, value) => sum + value, 0) ===
        context.sessionXpTarget,
      hard: true,
      detail: `${targets.join('+')}=${context.sessionXpTarget}`
    },
    {
      name: 'Candidate coverage',
      passed: selected.every((entry) => entry.candidateCount > 0),
      hard: true,
      detail: selected
        .map((entry) => `${entry.encounterNumber}:${entry.candidateCount}`)
        .join(', ')
    },
    {
      name: 'Encounter selector fit',
      passed: selected.every((entry) => entry.selectedFit),
      hard: false,
      detail: selected
        .map((entry) => `${entry.encounterNumber}:${entry.fitCandidateCount}`)
        .join(', ')
    },
    {
      name: 'Deterministic seed path',
      passed: true,
      hard: true,
      detail: 'Named SHA-256 entropy streams'
    }
  ]
  if (audits.some((audit) => audit.hard && !audit.passed))
    return deepFreeze({
      status: 'unresolvable',
      issues: [
        {
          code: 'hard_audit_failed',
          message: 'Encounter generation failed an integrity audit.'
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
