import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  Creature,
  CreatureCatalogQuery
} from '../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../shared/contracts/encounter-tuning.js'
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

type DraftEntry = { creatureId: string; quantity: number }

type GeneratedOption = {
  entries: DraftEntry[]
  adjustedXp: number
  exact: boolean
  score: number
  weight: number
}

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

export function generateSceneGroupDraft(
  scene: RunningScene,
  assignedParty: readonly PartyMember[],
  input: readonly SceneGroupDraftEntry[],
  mode: GroupGenerationMode,
  filters: CreatureCatalogQuery,
  tuning: EncounterTuning,
  seed: number,
  sceneRevision: number,
  source: ResolvedEncounterSource = {
    candidates: null,
    effectiveEncounterTableIds: [],
    effectiveFactionIds: [],
    locationId: filters.locationId,
    catalogFallback: true,
    biomeFiltering: false
  }
): SceneGroupDraftGeneration {
  if (
    assignedParty.length === 0 ||
    assignedParty.some((member) => member.level === null)
  )
    throw new CapabilityError('validation_failed', false)

  const base = mode === 'fill' ? normalizeEntries(input) : []
  const thresholds = partyThresholds(assignedParty)
  const resolvedDifficulty =
    tuning.difficulty === 'auto' ? 'medium' : tuning.difficulty
  const band = { easy: 0, medium: 1, hard: 2, deadly: 3 }[resolvedDifficulty]
  const lower = thresholds[band] ?? 0
  const upper =
    band < 3
      ? (thresholds[band + 1] ?? Math.round(lower * 1.35))
      : Math.round(lower * 1.35)
  const target = Math.round((lower + upper) / 2)
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
        ? 'Die Gruppe liegt bereits im gewünschten Schwierigkeitsband.'
        : 'Die Gruppe erreicht oder überschreitet das gewünschte Schwierigkeitsband und wurde nicht verändert.',
      source
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
  const maxCount = preferredMaximum(tuning.amount)
  const options = generateOptions(
    base,
    pool,
    lower,
    upper,
    target,
    assignedParty.length,
    maxCount,
    tuning,
    sourceByCreature
  )
  const option =
    options.length > 0 ? weightedOption(options.slice(0, 5), seed) : undefined
  const entries = option?.entries ?? base

  return generationResult(
    scene,
    assignedParty,
    entries,
    sceneRevision,
    resolvedDifficulty,
    !option ? 'none' : option.exact ? 'exact' : 'fallback',
    !option
      ? pool.length === 0
        ? 'Keine Monster entsprechen den gewählten Filtern.'
        : 'Mit den gewählten Mengenregeln konnte die Gruppe nicht ergänzt werden.'
      : option.exact
        ? 'Das gewünschte Schwierigkeitsband wurde getroffen.'
        : 'Beste verfügbare Annäherung.',
    source
  )
}

function generationResult(
  scene: RunningScene,
  assignedParty: readonly PartyMember[],
  entries: readonly DraftEntry[],
  sceneRevision: number,
  resolvedDifficulty: string,
  quality: 'exact' | 'fallback' | 'none',
  message: string,
  source: ResolvedEncounterSource
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
      locationId: scene.locationId,
      locationName: scene.locationName,
      existingGroupCount: scene.groups.length,
      effectiveEncounterTableIds: source.effectiveEncounterTableIds,
      effectiveFactionIds: source.effectiveFactionIds,
      catalogFallback: source.catalogFallback
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

function preferredMaximum(amount: EncounterTuning['amount']): number {
  return amount === 'few' ? 3 : amount === 'many' ? 10 : 6
}

function generateOptions(
  base: readonly DraftEntry[],
  pool: readonly Creature[],
  lower: number,
  upper: number,
  target: number,
  partySize: number,
  maxCount: number,
  tuning: EncounterTuning,
  sourceByCreature: ReadonlyMap<
    string,
    { weight: number; maximum: number | null }
  >
): GeneratedOption[] {
  const baseCount = count(base)
  const remaining = maxCount - baseCount
  if (remaining <= 0 || pool.length === 0) return []

  const additions: DraftEntry[][] = []
  for (const creature of pool) {
    const maximum = sourceByCreature.get(creature.id)?.maximum ?? null
    const already =
      base.find((entry) => entry.creatureId === creature.id)?.quantity ?? 0
    const available =
      maximum === null ? remaining : Math.max(0, maximum - already)
    for (
      let quantity = 1;
      quantity <= Math.min(remaining, available);
      quantity += 1
    )
      additions.push([{ creatureId: creature.id, quantity }])
  }

  const rankedPool = [...pool]
    .sort((a, b) => Math.abs(target - a.xp) - Math.abs(target - b.xp))
    .slice(0, 24)
  if (remaining >= 2) {
    for (let left = 0; left < rankedPool.length; left += 1) {
      for (let right = left + 1; right < rankedPool.length; right += 1) {
        if (!canAdd(rankedPool[left]!.id, base, sourceByCreature)) continue
        if (!canAdd(rankedPool[right]!.id, base, sourceByCreature)) continue
        additions.push([
          { creatureId: rankedPool[left]!.id, quantity: 1 },
          { creatureId: rankedPool[right]!.id, quantity: 1 }
        ])
      }
    }
  }

  if (remaining >= 3) {
    const diversePool = rankedPool.slice(0, 12)
    for (let first = 0; first < diversePool.length; first += 1) {
      for (let second = first + 1; second < diversePool.length; second += 1) {
        for (let third = second + 1; third < diversePool.length; third += 1) {
          if (!canAdd(diversePool[first]!.id, base, sourceByCreature)) continue
          if (!canAdd(diversePool[second]!.id, base, sourceByCreature)) continue
          if (!canAdd(diversePool[third]!.id, base, sourceByCreature)) continue
          additions.push([
            { creatureId: diversePool[first]!.id, quantity: 1 },
            { creatureId: diversePool[second]!.id, quantity: 1 },
            { creatureId: diversePool[third]!.id, quantity: 1 }
          ])
        }
      }
    }
  }

  const unique = new Map<string, GeneratedOption>()
  for (const addition of additions) {
    const entries = mergeEntries(base, addition)
    const baseXp = entries.reduce(
      (sum, entry) =>
        sum + (creatureById(entry.creatureId)?.xp ?? 0) * entry.quantity,
      0
    )
    const adjustedXp = Math.round(
      baseXp * multiplier(count(entries), partySize)
    )
    const exact = adjustedXp >= lower && adjustedXp < upper
    const score =
      bandDistance(adjustedXp, lower, upper) * 1000 +
      Math.abs(target - adjustedXp) +
      tuningPenalty(entries, target, tuning)
    const weight = addition.reduce(
      (sum, entry) =>
        sum +
        (sourceByCreature.get(entry.creatureId)?.weight ?? 1) * entry.quantity,
      0
    )
    const key = entries
      .map((entry) => `${entry.creatureId}:${entry.quantity}`)
      .join('|')
    const current = unique.get(key)
    if (!current || score < current.score)
      unique.set(key, { entries, adjustedXp, exact, score, weight })
  }

  return [...unique.values()].sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      a.score - b.score ||
      b.weight - a.weight ||
      a.adjustedXp - b.adjustedXp ||
      rosterKey(a.entries).localeCompare(rosterKey(b.entries))
  )
}

function canAdd(
  creatureId: string,
  base: readonly DraftEntry[],
  source: ReadonlyMap<string, { maximum: number | null }>
): boolean {
  const maximum = source.get(creatureId)?.maximum ?? null
  const current =
    base.find((entry) => entry.creatureId === creatureId)?.quantity ?? 0
  return maximum === null || current < maximum
}

function weightedOption(
  options: readonly GeneratedOption[],
  seed: number
): GeneratedOption | undefined {
  const total = options.reduce(
    (sum, option) => sum + Math.max(1, option.weight),
    0
  )
  if (total === 0) return undefined
  let cursor = seed % total
  for (const option of options) {
    cursor -= Math.max(1, option.weight)
    if (cursor < 0) return option
  }
  return options.at(-1)
}

function tuningPenalty(
  entries: readonly DraftEntry[],
  target: number,
  tuning: EncounterTuning
): number {
  const distinct = entries.length
  const desiredCount =
    tuning.amount === 'few' ? 2 : tuning.amount === 'many' ? 8 : 4
  const amountPenalty = Math.abs(count(entries) - desiredCount) * target * 0.02
  const diversityPenalty =
    tuning.diversity === 'low'
      ? Math.max(0, distinct - 1) * target * 0.08
      : tuning.diversity === 'high'
        ? Math.max(0, 3 - distinct) * target * 0.08
        : 0
  const xp = entries.map((entry) => creatureById(entry.creatureId)?.xp ?? 0)
  const maximum = Math.max(1, ...xp)
  const spread = (Math.max(...xp) - Math.min(...xp)) / maximum
  const balancePenalty =
    tuning.balance === 'even'
      ? spread * target * 0.08
      : tuning.balance === 'varied'
        ? (1 - spread) * target * 0.08
        : 0
  return amountPenalty + diversityPenalty + balancePenalty
}

function bandDistance(
  adjustedXp: number,
  lower: number,
  upper: number
): number {
  return adjustedXp < lower
    ? lower - adjustedXp
    : adjustedXp >= upper
      ? adjustedXp - upper + 1
      : 0
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
    .sort((a, b) => a.creatureId.localeCompare(b.creatureId))
}

function count(entries: readonly DraftEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0)
}

function rosterKey(entries: readonly DraftEntry[]): string {
  return entries
    .map((entry) => `${entry.creatureId}:${entry.quantity}`)
    .join('|')
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
