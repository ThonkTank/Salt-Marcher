import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GeneratedEncounterPlanService,
  generatedEncounterBatchFingerprint
} from '../../src/core/encounter/generated-plan-service.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import { fingerprint } from '../../src/core/fingerprint.js'
import { SESSION_GENERATION_ENGINE_VERSION } from '../../src/shared/contracts/session-generation.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('generated Encounter plans', () => {
  it('prepares and atomically commits an idempotent ordered batch', () => {
    const { service, campaigns } = harness()
    const prepared = prepare(service, randomUUID(), ['Erster', 'Zweiter'])
    const first = service.commit({ prepared })
    const retried = service.commit({ prepared })

    expect(first.status).toBe('SUCCESS')
    expect(retried).toEqual(first)
    if (first.status !== 'SUCCESS') return
    expect(first.mappings.map((entry) => entry.encounterNumber)).toEqual([1, 2])
    expect(new Set(first.mappings.map((entry) => entry.planId)).size).toBe(2)
    const db = activeCampaignDatabase(campaigns)
    expect(count(db, 'generated_encounter_plan_batches')).toBe(1)
    expect(count(db, 'generated_encounter_plan_origins')).toBe(2)
    expect(count(db, 'saved_encounter_plans')).toBe(2)

    const summaries = service.summaries({
      planIds: [
        first.mappings[1]!.planId,
        randomUUID(),
        first.mappings[0]!.planId
      ]
    })
    expect(summaries.entries.map((entry) => entry.status)).toEqual([
      'READY',
      'MISSING',
      'READY'
    ])
  })

  it('ignores display relabeling and rejects malformed creature truth without partial rows', () => {
    const { service, campaigns } = harness()
    const runId = randomUUID()
    const prepared = prepare(service, runId, ['Beständig'])
    expect(service.commit({ prepared }).status).toBe('SUCCESS')

    const sameSemanticBatch = prepare(service, runId, ['Anderer UI-Text'])
    expect(sameSemanticBatch.batchFingerprint).toBe(prepared.batchFingerprint)
    expect(service.commit({ prepared: sameSemanticBatch }).status).toBe(
      'SUCCESS'
    )
    expect(
      count(activeCampaignDatabase(campaigns), 'saved_encounter_plans')
    ).toBe(1)

    const invalidRunId = randomUUID()
    const valid = prepare(service, invalidRunId, ['Ungültig'])
    const invalidCreatures = valid.rosters[0]!.creatures.map(
      (creature, position) =>
        position === 0
          ? { ...creature, creatureId: 'missing:creature' }
          : creature
    )
    const invalidRoster = {
      ...valid.rosters[0]!,
      creatures: invalidCreatures,
      rosterFingerprint: fingerprint({
        encounterNumber: valid.rosters[0]!.encounterNumber,
        creatures: invalidCreatures
      })
    }
    const invalid = {
      ...valid,
      rosters: [invalidRoster],
      batchFingerprint: generatedEncounterBatchFingerprint({
        runId: valid.runId,
        engineVersion: valid.engineVersion,
        rosters: [invalidRoster]
      })
    }
    expect(service.commit({ prepared: invalid }).status).toBe('INVALID_REQUEST')
    expect(
      count(activeCampaignDatabase(campaigns), 'saved_encounter_plans')
    ).toBe(1)
    expect(
      activeCampaignDatabase(campaigns)
        .prepare(
          'SELECT 1 FROM generated_encounter_plan_batches WHERE batch_origin_fingerprint = ?'
        )
        .get(invalid.batchFingerprint)
    ).toBeUndefined()
  })

  it('bounds demand-driven saved-plan search at eight plus overflow', () => {
    const { service } = harness()
    let creatureQuery = ''
    for (let index = 0; index < 10; index += 1) {
      const prepared = prepare(service, randomUUID(), [
        `Gemeinsamer Plan ${index}`
      ])
      const committed = service.commit({ prepared })
      expect(committed.status).toBe('SUCCESS')
      if (committed.status === 'SUCCESS')
        creatureQuery = committed.mappings[0]!.summary.creatures[0]!.name
    }

    const result = service.search({ query: creatureQuery })
    expect(result.hits).toHaveLength(8)
    expect(result.hasMore).toBe(true)
    expect(service.search({ query: 'nicht vorhanden' })).toEqual({
      hits: [],
      hasMore: false
    })
  })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-encounter-plans-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Encounter plan test')
  return {
    campaigns,
    service: new GeneratedEncounterPlanService(
      campaigns.activeCampaignPersistence()
    )
  }
}

function prepare(
  service: GeneratedEncounterPlanService,
  runId: string,
  labels: readonly string[]
) {
  const result = service.prepare({
    runId,
    engineVersion: SESSION_GENERATION_ENGINE_VERSION,
    seed: 680,
    intents: labels.map((_, position) => ({
      encounterNumber: position + 1,
      targetXp: 25,
      difficulty: 'EASY' as const,
      blocks: [
        {
          role: 'Minion' as const,
          challengeRating: '1/8',
          challengeRatingCode: -2,
          quantity: 1,
          statblockSlots: 1,
          unitXp: 25
        }
      ]
    }))
  })
  expect(result.status).toBe('SUCCESS')
  if (result.status !== 'SUCCESS') throw new Error(result.code)
  return result.prepared
}

function count(db: Database.Database, table: string) {
  return (
    db.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
      value: number
    }
  ).value
}
