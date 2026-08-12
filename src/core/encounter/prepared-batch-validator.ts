import type { PreparedGeneratedEncounterBatch } from '../../shared/contracts/encounter-plans.js'
import { fingerprint } from '../fingerprint.js'
import { multiplier } from './math.js'

export function validatePreparedEncounterBatch(
  prepared: PreparedGeneratedEncounterBatch,
  creatureById: (id: string) => Readonly<{ xp: number }> | undefined,
  partySize: number
): boolean {
  return prepared.rosters.every((roster) => {
    if (
      roster.rosterFingerprint !==
        fingerprint({
          encounterNumber: roster.encounterNumber,
          creatures: roster.creatures
        }) ||
      new Set(roster.creatures.map((entry) => entry.creatureId)).size !==
        roster.creatures.length ||
      roster.creatures.some((entry, position) => entry.position !== position)
    )
      return false
    const resolved = roster.creatures.map((entry) => ({
      entry,
      creature: creatureById(entry.creatureId)
    }))
    if (resolved.some(({ creature }) => !creature)) return false
    const totalCreatureCount = resolved.reduce(
      (sum, { entry }) => sum + entry.quantity,
      0
    )
    const baseXp = resolved.reduce(
      (sum, { entry, creature }) => sum + creature!.xp * entry.quantity,
      0
    )
    return (
      roster.totalCreatureCount === totalCreatureCount &&
      roster.baseXp === baseXp &&
      roster.adjustedXp ===
        Math.round(
          baseXp * multiplier(totalCreatureCount, Math.max(1, partySize))
        )
    )
  })
}
