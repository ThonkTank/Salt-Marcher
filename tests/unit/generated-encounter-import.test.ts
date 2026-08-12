import { describe, expect, it } from 'vitest'
import { parseChallengeRating } from '../../src/core/encounter/challenge-rating.js'
import { selectGeneratedRosters } from '../../src/core/encounter/generated-roster-selector.js'
import { validatePreparedEncounterBatch } from '../../src/core/encounter/prepared-batch-validator.js'
import { generatedEncounterBatchFingerprint } from '../../src/core/encounter/generated-plan-service.js'

const command = {
  runId: '01900000-0000-7000-8000-000000000001',
  engineVersion: 'encounter-test-v1',
  seed: 680,
  intents: [
    {
      encounterNumber: 1,
      targetXp: 25,
      difficulty: 'EASY' as const,
      blocks: [
        {
          role: 'Minion' as const,
          challengeRating: '1/8',
          challengeRatingCode: -2,
          quantity: 2,
          statblockSlots: 1,
          unitXp: 25
        }
      ]
    }
  ]
}

const catalog = [
  { id: 'creature:a', name: 'A', cr: 0.125, xp: 25 },
  { id: 'creature:b', name: 'B', cr: 0.125, xp: 25 }
]

describe('internal generated Encounter import', () => {
  it('parses canonical fractional and decimal Challenge Ratings', () => {
    expect(parseChallengeRating('1/8')).toBe(0.125)
    expect(parseChallengeRating('0.125')).toBe(0.125)
    expect(parseChallengeRating(' 2 / 4 ')).toBe(0.5)
    expect(parseChallengeRating('1/0')).toBeNull()
    expect(parseChallengeRating('⅛')).toBeNull()
  })

  it('selects deterministic structural rosters without display summaries', () => {
    const first = selectGeneratedRosters(command, catalog, 4)
    const second = selectGeneratedRosters(command, catalog, 4)
    expect(first).toEqual(second)
    expect(first.status).toBe('success')
    if (first.status !== 'success') return
    expect(first.rosters[0]).not.toHaveProperty('label')
    expect(first.rosters[0]).not.toHaveProperty('displaySummary')
  })

  it('validates fingerprint, positions, catalog XP, and adjusted XP', () => {
    const selected = selectGeneratedRosters(command, catalog, 4)
    if (selected.status !== 'success') throw new Error(selected.code)
    const prepared = {
      runId: command.runId,
      engineVersion: command.engineVersion,
      rosters: selected.rosters,
      batchFingerprint: generatedEncounterBatchFingerprint({
        runId: command.runId,
        engineVersion: command.engineVersion,
        rosters: selected.rosters
      })
    }
    const creature = (id: string) => catalog.find((entry) => entry.id === id)
    expect(validatePreparedEncounterBatch(prepared, creature, 4)).toBe(true)
    expect(
      validatePreparedEncounterBatch(
        {
          ...prepared,
          rosters: prepared.rosters.map((roster) => ({
            ...roster,
            adjustedXp: roster.adjustedXp + 1
          }))
        },
        creature,
        4
      )
    ).toBe(false)
  })
})
