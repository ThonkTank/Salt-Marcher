import type {
  ChallengeRating,
  EncounterCatalog,
  EncounterPattern,
  EncounterRole
} from './catalog.js'
import { compareText, type EncounterEntropy } from './deterministic-order.js'
import {
  effectiveEncounterMultiplier,
  quantityMultiplier
} from '../encounter/xp-multipliers.js'

export type Block = Readonly<{
  id: string
  role: EncounterRole
  cr: ChallengeRating
  quantity: number
  rawXp: number
  adjustedXp: number
}>

type Candidate = Readonly<{
  id: string
  target: number
  pattern: EncounterPattern
  blocks: readonly Block[]
  adjustedXp: number
  delta: number
  monsterCount: number
  effectiveMonsterCount: number
  xpMultiplier: number
  maxCr: number
}>

export type SelectionIndex = ReadonlyMap<EncounterRole, readonly Block[]>

export type SelectedEncounter = Readonly<{
  encounterNumber: number
  target: number
  candidate: Candidate | undefined
  candidateCount: number
  fitCandidateCount: number
  selectedFit: boolean
}>

export function buildSelectionIndex(
  catalog: EncounterCatalog,
  partyLevel: number
): SelectionIndex {
  const crById = new Map(
    catalog.challengeRatings
      .filter((entry) => entry.active)
      .map((entry) => [entry.id, entry])
  )
  const blocksByRole = new Map<EncounterRole, Block[]>()
  for (const band of catalog.roleBands.filter(
    (entry) => entry.active && entry.partyLevel === partyLevel
  )) {
    const cr = crById.get(band.crId)
    if (!cr) continue
    const minimum = band.role === 'Minion' ? 4 : band.role === 'Support' ? 2 : 1
    const maximum =
      band.role === 'Minion'
        ? 10
        : band.role === 'Support' || band.role === 'Standard'
          ? 5
          : band.role === 'Elite'
            ? 2
            : 1
    for (let quantity = minimum; quantity <= maximum; quantity += 1) {
      const block = {
        id: `${band.role}_CR${cr.label.replace('/', '_')}_Nr${quantity}`,
        role: band.role,
        cr,
        quantity,
        rawXp: cr.xp * quantity,
        adjustedXp: Math.round(cr.xp * quantity * quantityMultiplier(quantity))
      }
      const current = blocksByRole.get(band.role) ?? []
      current.push(block)
      blocksByRole.set(band.role, current)
    }
  }
  return new Map(
    [...blocksByRole].map(([role, blocks]) => [
      role,
      blocks.toSorted(
        (left, right) =>
          left.adjustedXp - right.adjustedXp || compareText(left.id, right.id)
      )
    ])
  )
}

export function selectEncounter(
  seed: number,
  encounterNumber: number,
  target: number,
  blocksByRole: SelectionIndex,
  patterns: readonly EncounterPattern[],
  entropy: EncounterEntropy
): SelectedEncounter {
  const candidates: Candidate[] = []
  for (const pattern of patterns.filter((entry) => entry.active)) {
    const choices = pattern.roles.map((role) =>
      (blocksByRole.get(role) ?? [])
        .filter((block) => block.adjustedXp * 100 <= target * 105)
        .sort(
          (left, right) =>
            Math.abs(left.adjustedXp - target / pattern.roles.length) -
              Math.abs(right.adjustedXp - target / pattern.roles.length) ||
            compareText(left.id, right.id)
        )
        .slice(0, 4)
    )
    if (choices.some((choice) => choice.length === 0)) continue
    cartesian(choices).forEach((blocks) =>
      candidates.push(candidate(encounterNumber, target, pattern, blocks))
    )
  }
  const fit = candidates.filter(
    (entry) => Math.abs(entry.delta) * 100 <= target * 5
  )
  const pool = (fit.length > 0 ? fit : candidates).toSorted(
    (left, right) =>
      score(seed, encounterNumber, left, entropy) -
        score(seed, encounterNumber, right, entropy) ||
      compareText(left.id, right.id)
  )
  const chosen = pool[0]
  return {
    encounterNumber,
    target,
    candidate: chosen,
    candidateCount: candidates.length,
    fitCandidateCount: fit.length,
    selectedFit:
      chosen !== undefined && Math.abs(chosen.delta) * 100 <= target * 5
  }
}

export function buildEncounterIntents(
  selected: readonly SelectedEncounter[],
  party: readonly { level: number; count: number }[]
) {
  const totalAdjustedXp = selected.reduce(
    (sum, entry) => sum + entry.candidate!.adjustedXp,
    0
  )
  const maxLevel = Math.max(...party.map((entry) => entry.level))
  const scores = selected.map((entry) => {
    const candidate = entry.candidate!
    const difficulty = difficultyFor(entry.encounterNumber, selected.length)
    const difficultyMultiplier =
      difficulty === 'MEDIUM'
        ? 1.5
        : difficulty === 'HARD'
          ? 2
          : difficulty === 'DEADLY'
            ? 3
            : 1
    return (
      (candidate.adjustedXp / Math.max(1, totalAdjustedXp)) *
      difficultyMultiplier *
      Math.min(2.5, 1 + candidate.maxCr / Math.max(1, maxLevel))
    )
  })
  const ranks = scores.map(
    (score, index) =>
      1 +
      scores.filter(
        (other, otherIndex) =>
          other > score || (other === score && otherIndex < index)
      ).length
  )
  return selected.map((entry, index) => {
    const candidate = entry.candidate!
    return {
      encounterNumber: entry.encounterNumber,
      targetXp: entry.target,
      adjustedXp: candidate.adjustedXp,
      xpDelta: candidate.delta,
      difficulty: difficultyFor(entry.encounterNumber, selected.length),
      patternId: candidate.pattern.id,
      blocks: candidate.blocks.map((block) => ({
        role: block.role,
        challengeRating: block.cr.label,
        challengeRatingCode: block.cr.code,
        quantity: block.quantity,
        unitXp: block.cr.xp
      })),
      monsterCount: candidate.monsterCount,
      effectiveMonsterCount: candidate.effectiveMonsterCount,
      xpMultiplier: candidate.xpMultiplier,
      bossinessRank: ranks[index]!
    }
  })
}

function candidate(
  encounterNumber: number,
  target: number,
  pattern: EncounterPattern,
  blocks: readonly Block[]
): Candidate {
  const rawXp = blocks.reduce((sum, block) => sum + block.rawXp, 0)
  const maximumUnitXp = Math.max(1, ...blocks.map((block) => block.cr.xp))
  const effectiveMonsterCount = blocks.reduce(
    (sum, block) =>
      sum + block.quantity * Math.sqrt(block.cr.xp / maximumUnitXp),
    0
  )
  const xpMultiplier = effectiveEncounterMultiplier(effectiveMonsterCount)
  const adjustedXp = Math.round(rawXp * xpMultiplier)
  return {
    id: `${encounterNumber}:${blocks.map((block) => block.id).join('|')}`,
    target,
    pattern,
    blocks,
    adjustedXp,
    delta: adjustedXp - target,
    monsterCount: blocks.reduce((sum, block) => sum + block.quantity, 0),
    effectiveMonsterCount,
    xpMultiplier,
    maxCr: Math.max(...blocks.map((block) => block.cr.code))
  }
}

function cartesian(choices: readonly Block[][]): Block[][] {
  return choices.reduce<Block[][]>(
    (result, choice) =>
      result.flatMap((prefix) => choice.map((block) => [...prefix, block])),
    [[]]
  )
}

function score(
  seed: number,
  encounterNumber: number,
  candidate: Candidate,
  entropy: EncounterEntropy
): number {
  return (
    Math.abs(candidate.delta) / Math.max(1, candidate.target) +
    entropy.unit(`${seed}|encounter:${encounterNumber}:${candidate.id}`) * 0.05
  )
}

function difficultyFor(
  number: number,
  count: number
): 'EASY' | 'MEDIUM' | 'HARD' | 'DEADLY' {
  if (count === 1 || number === count) return 'DEADLY'
  if (number === 1) return 'EASY'
  return number / (count + 1) <= 0.5 ? 'MEDIUM' : 'HARD'
}
