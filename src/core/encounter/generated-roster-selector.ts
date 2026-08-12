import { createHash } from 'node:crypto'
import type {
  PrepareGeneratedEncounterBatchCommand,
  PreparedGeneratedEncounterBatch
} from '../../shared/contracts/encounter-plans.js'
import { fingerprint } from '../fingerprint.js'
import { multiplier } from './math.js'
import { parseChallengeRating } from './challenge-rating.js'

type CatalogCreature = Readonly<{
  id: string
  name: string
  cr: number
  xp: number
}>

export type RosterSelectionResult =
  | Readonly<{
      status: 'success'
      rosters: PreparedGeneratedEncounterBatch['rosters']
    }>
  | Readonly<{
      status: 'unresolvable'
      code: 'challenge_rating_invalid' | 'catalog_candidate_missing'
      parameters: Readonly<Record<string, string | number>>
    }>

export function selectGeneratedRosters(
  input: PrepareGeneratedEncounterBatchCommand,
  catalog: readonly CatalogCreature[],
  partySize: number
): RosterSelectionResult {
  const priorSignatures = new Set<string>()
  const rosters: PreparedGeneratedEncounterBatch['rosters'][number][] = []
  for (const intent of input.intents) {
    const resolved = new Map<
      string,
      { creatureId: string; quantity: number; lastKnownName: string }
    >()
    for (const [blockPosition, block] of intent.blocks.entries()) {
      const requestedCr = parseChallengeRating(block.challengeRating)
      if (requestedCr === null)
        return {
          status: 'unresolvable',
          code: 'challenge_rating_invalid',
          parameters: { challengeRating: block.challengeRating }
        }
      const candidates = catalog.filter(
        (candidate) =>
          candidate.cr === requestedCr && candidate.xp === block.unitXp
      )
      if (candidates.length === 0)
        return {
          status: 'unresolvable',
          code: 'catalog_candidate_missing',
          parameters: {
            challengeRating: block.challengeRating,
            xp: block.unitXp
          }
        }
      const ordered = candidates.toSorted((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0
      )
      const start = hashModulo(
        `${input.seed}|encounter-roster|${intent.encounterNumber}|${blockPosition}|${block.role}|${block.challengeRating}`,
        ordered.length
      )
      let selected = ordered[start]!
      for (let offset = 0; offset < ordered.length; offset += 1) {
        const candidate = ordered[(start + offset) % ordered.length]!
        const projected = [
          ...resolved.values(),
          { creatureId: candidate.id, quantity: block.quantity }
        ]
          .map((entry) => `${entry.creatureId}:${entry.quantity}`)
          .sort()
          .join('|')
        selected = candidate
        if (!priorSignatures.has(projected)) break
      }
      const current = resolved.get(selected.id)
      resolved.set(selected.id, {
        creatureId: selected.id,
        lastKnownName: selected.name,
        quantity: (current?.quantity ?? 0) + block.quantity
      })
    }
    const rosterCreatures = [...resolved.values()]
      .toSorted((left, right) =>
        left.creatureId < right.creatureId
          ? -1
          : left.creatureId > right.creatureId
            ? 1
            : 0
      )
      .map((creature, position) => ({ ...creature, position }))
    priorSignatures.add(
      rosterCreatures
        .map((entry) => `${entry.creatureId}:${entry.quantity}`)
        .join('|')
    )
    const baseXp = rosterCreatures.reduce(
      (sum, entry) =>
        sum +
        (catalog.find(({ id }) => id === entry.creatureId)?.xp ?? 0) *
          entry.quantity,
      0
    )
    const totalCreatureCount = rosterCreatures.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    )
    rosters.push({
      encounterNumber: intent.encounterNumber,
      targetXp: intent.targetXp,
      declaredDifficulty: intent.difficulty,
      rosterFingerprint: fingerprint({
        encounterNumber: intent.encounterNumber,
        creatures: rosterCreatures
      }),
      creatures: rosterCreatures,
      totalCreatureCount,
      baseXp,
      adjustedXp: Math.round(
        baseXp * multiplier(totalCreatureCount, Math.max(1, partySize))
      )
    })
  }
  return { status: 'success', rosters }
}

function hashModulo(value: string, modulus: number): number {
  const hash = createHash('sha256').update(value).digest()
  return hash.readUInt32BE(0) % modulus
}
