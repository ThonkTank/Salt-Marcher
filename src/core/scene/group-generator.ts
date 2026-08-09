import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  Creature,
  CreatureCatalogQuery
} from '../../shared/contracts/encounter.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetConfigV3
} from '../../shared/contracts/generator-presets.js'
import { generatorChallengeRatings } from '../../shared/generator/generator-config-model.js'
import type { PartyMember } from '../../shared/contracts/live-session.js'
import {
  encounterSelectionEvaluationSchema,
  sceneGroupDraftEvaluationSchema,
  sceneGroupDraftGenerationSchema,
  type EncounterSelectionEvaluation,
  type GroupGenerationMode,
  type RunningScene,
  type SceneGroup,
  type SceneGroupDraftEntry,
  type SceneGroupDraftEvaluation,
  type SceneGroupDraftGeneration
} from '../../shared/contracts/scene.js'
import {
  creatureById,
  creatureMatchesQuery,
  creatures
} from '../creatures/catalog.js'
import { difficulty, multiplier, partyThresholds } from '../encounter/math.js'
import type { ResolvedEncounterSource } from '../application/encounter-source-service.js'
import {
  buildSelectionIndex,
  resolveRange,
  selectEncounter,
  statblockSlotsForBlocks,
  type CompositionCatalog,
  type FixedRoster
} from '../session-generation/encounter-selection-policy.js'
import { fingerprintGeneratorConfig } from '../session-generation/generator-config-fingerprint.js'

type DraftEntry = { creatureId: string; quantity: number }

export function evaluateSceneGroups(
  scene: RunningScene,
  assignedParty: readonly PartyMember[],
  groupIds: readonly string[]
): EncounterSelectionEvaluation {
  const selectedIds = Array.from(new Set(groupIds))
  const selected = selectedIds.map((id) =>
    scene.groups.find((group) => group.id === id)
  )
  if (selected.some((group) => group === undefined))
    throw new CapabilityError('not_found', false)
  const groups = selected as SceneGroup[]
  if (groups.some((group) => group.archived))
    throw new CapabilityError('validation_failed', false)
  const evaluation = evaluateSceneGroupDraft(
    scene.id,
    assignedParty,
    groups.flatMap((group) =>
      group.entries
        .filter((entry) => entry.aliveQuantity > 0)
        .map((entry) => ({
          creatureId: entry.creatureId,
          quantity: entry.aliveQuantity
        }))
    )
  )
  return encounterSelectionEvaluationSchema.parse({
    ...evaluation,
    selectedGroupIds: selectedIds,
    canStart: evaluation.canStart && groups.length > 0,
    message:
      groups.length === 0
        ? 'Mindestens eine Scene-Gruppe auswählen.'
        : evaluation.message === 'Gruppe ist kampfbereit.'
          ? 'Auswahl ist kampfbereit.'
          : evaluation.message
  })
}

export function evaluateSceneGroupDraft(
  sceneId: string,
  assignedParty: readonly PartyMember[],
  input: readonly SceneGroupDraftEntry[]
): SceneGroupDraftEvaluation {
  const entries = normalizeEntries(input)
  const creatureCount = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const baseXp = entries.reduce(
    (sum, entry) =>
      sum + (creatureById(entry.creatureId)?.xp ?? 0) * entry.quantity,
    0
  )
  const thresholds = partyThresholds(assignedParty)
  const appliedMultiplier = multiplier(
    creatureCount,
    Math.max(1, assignedParty.length)
  )
  const adjustedXp = Math.round(baseXp * appliedMultiplier)
  const completeLevels = assignedParty.every((member) => member.level !== null)
  const available = entries.every((entry) => creatureById(entry.creatureId))
  const canStart =
    assignedParty.length > 0 && completeLevels && creatureCount > 0 && available
  const difficultyLabel = completeLevels
    ? difficulty(adjustedXp, thresholds)
    : 'Party-Level fehlen'
  const difficultyBand = completeLevels
    ? difficultyLabel.toLowerCase()
    : 'unavailable'
  return sceneGroupDraftEvaluationSchema.parse({
    sceneId,
    partySize: assignedParty.length,
    creatureCount,
    partyThresholds: thresholds,
    baseXp,
    adjustedXp,
    multiplier: appliedMultiplier,
    difficultyBand,
    difficultyLabel,
    canStart,
    message:
      assignedParty.length === 0
        ? 'Der Scene sind keine aktiven PCs zugewiesen.'
        : !completeLevels
          ? 'Für das Balancing brauchen alle zugewiesenen PCs ein Level.'
          : creatureCount === 0
            ? 'Mindestens ein Monster hinzufügen.'
            : !available
              ? 'Die Gruppe enthält nicht verfügbare Monster.'
              : 'Gruppe ist kampfbereit.'
  })
}

/**
 * The Scene adapter materializes the same CR-block composition selected by the
 * Session generator with concrete statblocks from the effective encounter source.
 */
export function generateSceneGroupDraft(
  scene: RunningScene,
  assignedParty: readonly PartyMember[],
  input: readonly SceneGroupDraftEntry[],
  mode: GroupGenerationMode,
  filters: CreatureCatalogQuery,
  config: GeneratorPresetConfigV3,
  seed: number,
  sceneRevision: number,
  source: ResolvedEncounterSource = {
    candidates: null,
    effectiveEncounterTableIds: [],
    effectiveFactionIds: [],
    locationId: filters.locationId,
    catalogFallback: true,
    biomeFiltering: false,
    sourceIssue: null
  },
  preset: Readonly<{ id: string; revision: number }> = {
    id: systemGeneratorPresetId,
    revision: 0
  }
): SceneGroupDraftGeneration {
  if (
    assignedParty.length === 0 ||
    assignedParty.some((member) => member.level === null)
  )
    throw new CapabilityError('validation_failed', false)

  const base = mode === 'fill' ? normalizeEntries(input) : []
  const thresholds = partyThresholds(assignedParty)
  const resolvedDifficulty = resolveDifficulty(config, seed)
  const { lower, upper, target } = targetBand(resolvedDifficulty, thresholds)
  const baseEvaluation = evaluateSceneGroupDraft(scene.id, assignedParty, base)
  if (mode === 'fill' && baseEvaluation.adjustedXp >= lower) {
    const exact = baseEvaluation.adjustedXp < upper
    return generationResult(
      scene,
      assignedParty,
      base,
      sceneRevision,
      resolvedDifficulty,
      exact ? 'exact' : 'fallback',
      exact
        ? 'Die Scene-Gruppe liegt bereits im gewünschten Schwierigkeitsband.'
        : 'Die Scene-Gruppe erreicht oder überschreitet das gewünschte Schwierigkeitsband und wurde nicht verändert.',
      source,
      preset,
      config
    )
  }

  const sourceByCreature = new Map(
    source.candidates?.map((candidate) => [candidate.creatureId, candidate]) ??
      []
  )
  const pool = creatures.filter(
    (creature) =>
      (source.candidates === null || sourceByCreature.has(creature.id)) &&
      creatureMatchesQuery(creature, filters)
  )
  const partyLevel = clamp(
    Math.round(
      assignedParty.reduce((sum, member) => sum + (member.level ?? 1), 0) /
        assignedParty.length
    ),
    1,
    20
  )
  const capacities = creatureCapacities(pool, sourceByCreature, base)
  const catalog = catalogFromCreatures(pool, capacities)
  const index = buildSelectionIndex(catalog, partyLevel, config)
  const fixed = fixedRoster(base, config)
  const selected = selectEncounter(
    seed,
    1,
    target,
    index,
    seededEntropy,
    config,
    assignedParty.length,
    fixed
  )
  const additions = selected.composition
    ? materializeBlocks(
        selected.composition.blocks,
        pool,
        sourceByCreature,
        base,
        config,
        seed
      )
    : []
  const entries = mergeEntries(base, additions)
  const materializedDiagnostics = compositionDiagnostics(
    entries,
    config,
    assignedParty.length
  )
  const exact = selected.selectedFit && materializedDiagnostics.length === 0
  const message = !selected.candidate
    ? source.sourceIssue === 'location_missing_table'
      ? 'Der gewählte Ort benötigt mindestens eine Encounter-Tabelle.'
      : source.sourceIssue === 'location_empty_table'
        ? 'Die Encounter-Tabelle des gewählten Orts enthält keine Monster.'
        : pool.length === 0
          ? 'Keine Monster entsprechen den gewählten Filtern.'
          : 'Mit den Regeln für Rollen und CR-Blöcke konnte kein Encounter erzeugt werden.'
    : exact
      ? 'Das gewünschte Schwierigkeitsband und alle Zielbereiche wurden getroffen.'
      : `Beste verfügbare Annäherung. ${materializedDiagnostics.join(' ')}`.trim()

  return generationResult(
    scene,
    assignedParty,
    entries,
    sceneRevision,
    resolvedDifficulty,
    !selected.candidate || additions.length === 0
      ? 'none'
      : exact
        ? 'exact'
        : 'fallback',
    message,
    source,
    preset,
    config
  )
}

function catalogFromCreatures(
  pool: readonly Creature[],
  capacities: ReadonlyMap<
    string,
    { quantity: number; maximumSingle: number; statblocks: number }
  >
): CompositionCatalog {
  const ratings = new Map<
    string,
    CompositionCatalog['challengeRatings'][number]
  >()
  for (const creature of pool) {
    const label = crLabel(creature.cr)
    const code = generatorChallengeRatings.indexOf(
      label as (typeof generatorChallengeRatings)[number]
    )
    if (code < 0 || ratings.has(label)) continue
    const capacity = capacities.get(label)
    ratings.set(label, {
      id: `scene-cr:${label.replace('/', '_')}`,
      code: code - 3,
      label,
      xp: creature.xp,
      active: true,
      availableQuantity: capacity?.quantity ?? 0,
      maximumSingleQuantity: capacity?.maximumSingle ?? 0,
      availableStatblocks: capacity?.statblocks ?? 0
    })
  }
  return { challengeRatings: [...ratings.values()] }
}

function creatureCapacities(
  pool: readonly Creature[],
  source: ReadonlyMap<string, { maximum: number | null }>,
  base: readonly DraftEntry[]
): ReadonlyMap<
  string,
  { quantity: number; maximumSingle: number; statblocks: number }
> {
  const result = new Map<
    string,
    { quantity: number; maximumSingle: number; statblocks: number }
  >()
  for (const creature of pool) {
    const already =
      base.find((entry) => entry.creatureId === creature.id)?.quantity ?? 0
    const maximum = source.get(creature.id)?.maximum
    const available = maximum == null ? 999 : Math.max(0, maximum - already)
    const label = crLabel(creature.cr)
    const current = result.get(label) ?? {
      quantity: 0,
      maximumSingle: 0,
      statblocks: 0
    }
    result.set(label, {
      quantity: current.quantity + available,
      maximumSingle: Math.max(current.maximumSingle, available),
      statblocks: current.statblocks + (available > 0 ? 1 : 0)
    })
  }
  return result
}

function materializeBlocks(
  blocks: readonly { challengeRating: string; quantity: number }[],
  pool: readonly Creature[],
  source: ReadonlyMap<string, { weight: number; maximum: number | null }>,
  base: readonly DraftEntry[],
  config: GeneratorPresetConfigV3,
  seed: number
): DraftEntry[] {
  const remaining = new Map(
    pool.map((creature) => {
      const maximum = source.get(creature.id)?.maximum
      const current =
        base.find((entry) => entry.creatureId === creature.id)?.quantity ?? 0
      return [
        creature.id,
        maximum == null ? 999 : Math.max(0, maximum - current)
      ] as const
    })
  )
  const result: DraftEntry[] = []
  const desiredStatblocks = statblockSlotsForBlocks(blocks, config)
  for (const [blockIndex, block] of blocks.entries()) {
    const candidates = pool
      .filter(
        (creature) =>
          crLabel(creature.cr) === block.challengeRating &&
          (config.composition.mixing === 'one-per-cr-block'
            ? (remaining.get(creature.id) ?? 0) >= block.quantity
            : (remaining.get(creature.id) ?? 0) > 0)
      )
      .toSorted(
        (left, right) =>
          optionOrder(seed, blockIndex, left, source) -
            optionOrder(seed, blockIndex, right, source) ||
          left.id.localeCompare(right.id)
      )
    const count =
      config.composition.mixing === 'one-per-cr-block'
        ? 1
        : clamp(
            desiredStatblocks[blockIndex] ?? 1,
            1,
            Math.min(candidates.length, block.quantity)
          )
    const chosen = candidates
      .toSorted(
        (left, right) =>
          (remaining.get(right.id) ?? 0) - (remaining.get(left.id) ?? 0) ||
          optionOrder(seed, blockIndex, left, source) -
            optionOrder(seed, blockIndex, right, source) ||
          left.id.localeCompare(right.id)
      )
      .slice(0, count)
    if (chosen.length !== count)
      throw new Error('Selected composition cannot be materialized exactly.')
    const allocations = new Map(chosen.map((creature) => [creature.id, 1]))
    let unassigned = block.quantity - chosen.length
    while (unassigned > 0) {
      const available = chosen
        .filter(
          (creature) =>
            (allocations.get(creature.id) ?? 0) <
            (remaining.get(creature.id) ?? 0)
        )
        .toSorted(
          (left, right) =>
            (allocations.get(left.id) ?? 0) -
              (allocations.get(right.id) ?? 0) ||
            left.id.localeCompare(right.id)
        )[0]
      if (!available) break
      allocations.set(available.id, (allocations.get(available.id) ?? 0) + 1)
      unassigned -= 1
    }
    if (unassigned !== 0)
      throw new Error('Selected composition exceeds concrete source stock.')
    for (const creature of chosen) {
      const quantity = allocations.get(creature.id) ?? 0
      if (quantity <= 0) continue
      result.push({ creatureId: creature.id, quantity })
      remaining.set(creature.id, (remaining.get(creature.id) ?? 0) - quantity)
    }
  }
  return mergeEntries([], result)
}

function optionOrder(
  seed: number,
  block: number,
  creature: Creature,
  source: ReadonlyMap<string, { weight: number }>
): number {
  const weight = Math.max(1, source.get(creature.id)?.weight ?? 1)
  return (mixSeed(seed + block * 131 + textSeed(creature.id)) % 10_000) / weight
}

function resolveDifficulty(
  config: GeneratorPresetConfigV3,
  seed: number
): 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly' {
  if (config.generationDefaults.difficulty !== 'weighted')
    return config.generationDefaults.difficulty
  const ordered = ['trivial', 'easy', 'medium', 'hard', 'deadly'] as const
  let cursor = mixSeed(seed) % 100
  for (const band of ordered) {
    cursor -= config.scene.difficultyWeights[band]
    if (cursor < 0) return band
  }
  return 'medium'
}

function compositionDiagnostics(
  entries: readonly DraftEntry[],
  config: GeneratorPresetConfigV3,
  partySize: number
): string[] {
  const monsterCount = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const initiativeSlots = entries.reduce(
    (sum, entry) =>
      sum +
      (config.combat.mobThreshold > 0 &&
      entry.quantity >= config.combat.mobThreshold
        ? 1
        : entry.quantity),
    0
  )
  return [
    softRangeMessage(
      'Statblöcke',
      entries.length,
      config.composition.statblocks
    ),
    softRangeMessage(
      'Monster',
      monsterCount,
      resolveRange(config.composition.monsters, partySize)
    ),
    softRangeMessage(
      'Init-Slots',
      initiativeSlots,
      resolveRange(config.composition.initiativeSlots, partySize)
    )
  ].filter((entry): entry is string => entry !== null)
}

function fixedRoster(
  entries: readonly DraftEntry[],
  config: GeneratorPresetConfigV3
): FixedRoster {
  return {
    units: entries.flatMap((entry) => {
      const creature = creatureById(entry.creatureId)
      return creature ? [{ unitXp: creature.xp, quantity: entry.quantity }] : []
    }),
    statblockCount: entries.length,
    initiativeSlots: entries.reduce(
      (sum, entry) =>
        sum +
        (config.combat.mobThreshold > 0 &&
        entry.quantity >= config.combat.mobThreshold
          ? 1
          : entry.quantity),
      0
    )
  }
}

function softRangeMessage(
  label: string,
  value: number,
  range: { min: number; max: number }
): string | null {
  if (value >= range.min && value <= range.max) return null
  return `${label}: ${value} liegt außerhalb ${range.min}–${range.max}.`
}

function targetBand(
  band: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly',
  thresholds: readonly number[]
): { lower: number; upper: number; target: number } {
  const index = { trivial: -1, easy: 0, medium: 1, hard: 2, deadly: 3 }[band]
  const lower = index < 0 ? 0 : (thresholds[index] ?? 0)
  const upper =
    index < 0
      ? (thresholds[0] ?? 0)
      : index < 3
        ? (thresholds[index + 1] ?? lower)
        : Math.round(lower * 1.35)
  return { lower, upper, target: Math.round((lower + upper) / 2) }
}

function generationResult(
  scene: RunningScene,
  assignedParty: readonly PartyMember[],
  entries: readonly DraftEntry[],
  sceneRevision: number,
  resolvedDifficulty: string,
  quality: 'exact' | 'fallback' | 'none',
  message: string,
  source: ResolvedEncounterSource,
  preset: Readonly<{ id: string; revision: number }>,
  config: GeneratorPresetConfigV3
): SceneGroupDraftGeneration {
  return sceneGroupDraftGenerationSchema.parse({
    sceneId: scene.id,
    sceneRevision,
    name: `${title(resolvedDifficulty)}-Gruppe`,
    entries: entries.map((entry) => {
      const creature = creatureById(entry.creatureId)
      return {
        ...entry,
        displayName:
          creature?.name ?? existingDisplayName(scene, entry.creatureId),
        cr: creature?.cr ?? 0,
        xp: creature?.xp ?? 0,
        available: creature !== undefined
      }
    }),
    evaluation: evaluateSceneGroupDraft(scene.id, assignedParty, entries),
    context: {
      sceneTitle: scene.title,
      locationId: source.locationId,
      locationName: scene.locationName,
      existingGroupCount: scene.groups.length,
      effectiveEncounterTableIds: source.effectiveEncounterTableIds,
      effectiveFactionIds: source.effectiveFactionIds,
      catalogFallback: source.catalogFallback,
      sourceIssue: source.sourceIssue,
      generatorPresetId: preset.id,
      generatorPresetRevision: preset.revision,
      generatorConfigHash: fingerprintGeneratorConfig(config)
    },
    quality,
    message: source.catalogFallback
      ? `Keine wirksame Encounter-Tabelle; Katalog-Fallback. ${message}`
      : message
  })
}

function existingDisplayName(scene: RunningScene, creatureId: string): string {
  for (const group of scene.groups) {
    const entry = group.entries.find(
      (candidate) => candidate.creatureId === creatureId
    )
    if (entry) return entry.displayName
  }
  return `Nicht verfügbares Monster (${creatureId})`
}

function crLabel(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

function normalizeEntries(
  input: readonly SceneGroupDraftEntry[]
): DraftEntry[] {
  return mergeEntries([], input)
}

function mergeEntries(
  base: readonly DraftEntry[],
  additions: readonly DraftEntry[]
): DraftEntry[] {
  const quantities = new Map<string, number>()
  for (const entry of [...base, ...additions])
    quantities.set(
      entry.creatureId,
      Math.min(999, (quantities.get(entry.creatureId) ?? 0) + entry.quantity)
    )
  return [...quantities.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([creatureId, quantity]) => ({ creatureId, quantity }))
    .sort((left, right) => left.creatureId.localeCompare(right.creatureId))
}

const seededEntropy = {
  modulo(stream: string, modulus: number): number {
    return mixSeed(textSeed(stream)) % modulus
  },
  unit(stream: string): number {
    return mixSeed(textSeed(stream)) / 0x1_0000_0000
  }
}

function textSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mixSeed(seed: number): number {
  let value = (seed >>> 0) + 0x9e3779b9
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b)
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35)
  return (value ^ (value >>> 16)) >>> 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
