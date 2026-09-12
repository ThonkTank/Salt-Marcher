import {
  initializeLootOperationJournalSchema,
  LootOperationJournal
} from '../../src/core/loot/loot-operation-journal.js'
import { LootService } from '../../src/core/application/loot-service.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { expectedHistoricalGeneratedLoot } from '../../scripts/qualification/historical-loot-expectations.js'
import { TreasureStore } from '../../src/core/loot/loot-store.js'
import { CharacterLootStore } from '../../src/core/loot/character-loot-store.js'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import Database from 'better-sqlite3'
import { expect, it } from 'vitest'
import { z } from 'zod'
import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import {
  persistedSessionGeneratedRunSchema,
  sessionGeneratedRunSchema
} from '../../src/shared/contracts/session-generation.js'
import { GeneratedRunStore } from '../../src/core/session-generation/generated-run-store.js'

it('hydrates the actual reward-v1 run after migrating its original schema-30 database', () => {
  const fixture = join(process.cwd(), 'tests/fixtures/historical-loot30')
  const provenance = z
    .object({
      databaseSha256: z.string(),
      runSha256: z.string(),
      profileSha256: z.string()
    })
    .parse(JSON.parse(readFileSync(join(fixture, 'provenance.json'), 'utf8')))
  const bytes = gunzipSync(readFileSync(join(fixture, 'campaign.sqlite.gz')))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    provenance.databaseSha256
  )
  const originalBytes = readFileSync(join(fixture, 'source-run.json'))
  expect(createHash('sha256').update(originalBytes).digest('hex')).toBe(
    provenance.runSha256
  )
  const original = z
    .object({
      id: z.string(),
      originFingerprint: z.string(),
      generatedAt: z.string(),
      rewardEngineVersion: z.literal('reward-v1'),
      catalogVersion: z.string(),
      catalogContentHash: z.string(),
      encounters: z.array(z.unknown()),
      audits: z.array(z.unknown())
    })
    .parse(JSON.parse(originalBytes.toString()))
  const profileBytes = readFileSync(join(fixture, 'source-profile.json'))
  expect(createHash('sha256').update(profileBytes).digest('hex')).toBe(
    provenance.profileSha256
  )
  const sourceProfile: unknown = JSON.parse(profileBytes.toString())
  const expected = expectedHistoricalGeneratedLoot(sourceProfile)
  expect(
    z.object({ generated: z.object({ run: z.unknown() }) }).parse(sourceProfile)
      .generated.run
  ).toEqual(JSON.parse(originalBytes.toString()))
  const root = mkdtempSync(join(tmpdir(), 'salt-original-loot-'))
  const path = join(root, 'campaign.sqlite')
  writeFileSync(path, bytes)
  let db = new Database(path)
  try {
    db.pragma('foreign_keys = ON')
    expect(db.pragma('user_version', { simple: true })).toBe(30)
    const receipts = db
      .prepare('SELECT * FROM loot_operation_receipt ORDER BY command_id')
      .all()
    expect(receipts).toHaveLength(4)
    applySchemaMigrations(db, { path, role: 'campaign' })
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(db.pragma('foreign_key_check')).toEqual([])
    const run = new GeneratedRunStore(db).read(original.id)
    expect(run).toMatchObject(original)
    expect(run).toEqual(expected.generated.run)
    expect(new TreasureStore(db).read(expected.treasure.id)).toEqual(
      expected.treasure
    )
    expect(new TreasureStore(db).read(expected.generated.treasure.id)).toEqual(
      expected.generated.treasure
    )
    const characterId = z.string().parse(expected.ledger['characterId'])
    const ledger = new CharacterLootStore(db)
    const beforeCorrection = ledger.ledger(characterId)
    expect(beforeCorrection).toEqual(expected.ledger)
    expect(
      db
        .prepare(
          'SELECT * FROM loot_operation_receipt_v30_archive ORDER BY command_id'
        )
        .all()
    ).toEqual(receipts)
    const entry = beforeCorrection.entries.find(
      (item) => item.itemReference.kind === 'generated'
    )!
    expect(entry).toBeDefined()
    const corrected = ledger.correct(
      {
        commandId: randomUUID(),
        characterId,
        entryId: entry.id,
        expectedRevision: beforeCorrection.revision,
        quantity: entry.quantity,
        status: 'sold',
        reason: 'Verkauf nach Migration'
      },
      '2026-09-09T10:00:00.000Z'
    )
    expect(corrected.revision).toBe(beforeCorrection.revision + 1)
    const correction = corrected.entries.find(
      (item) => item.correctsEntryId === entry.id
    )!
    expect(correction).toMatchObject({
      itemReference: entry.itemReference,
      definition: entry.definition,
      status: 'sold',
      correctionReason: 'Verkauf nach Migration',
      quantity: entry.quantity
    })
    expect(corrected.entries.find((item) => item.id === entry.id)).toEqual({
      ...entry,
      supersededByEntryId: correction.id
    })
    db.close()
    db = new Database(path, { fileMustExist: true })
    expect(new CharacterLootStore(db).ledger(characterId)).toEqual(corrected)
    expect(new GeneratedRunStore(db).read(original.id)).toEqual(run)
    expect(
      db
        .prepare(
          'SELECT * FROM loot_operation_receipt_v30_archive ORDER BY command_id'
        )
        .all()
    ).toEqual(receipts)
    const treasure = new TreasureStore(db).read(expected.treasure.id)!
    const command = {
      commandId: randomUUID(),
      treasureId: treasure.id,
      expectedTreasureRevision: treasure.revision,
      expectedPartyRevision: new PartyStore(db).read().revision,
      items: [
        {
          itemId: treasure.items[0]!.id,
          shares: [{ characterId, quantity: 1 }]
        }
      ]
    }
    const distributed = new LootService(
      fixedSqliteDatabaseAccess(db)
    ).distribute(command)
    const afterDistribution = new CharacterLootStore(db).ledger(characterId)
    expect(afterDistribution.entries).toHaveLength(corrected.entries.length + 1)
    expect(
      new LootService(fixedSqliteDatabaseAccess(db)).distribute(command)
    ).toEqual(distributed)
    db.close()
    db = new Database(path, { fileMustExist: true })
    expect(
      new LootService(fixedSqliteDatabaseAccess(db)).distribute(command)
    ).toEqual(distributed)
    expect(new CharacterLootStore(db).ledger(characterId)).toEqual(
      afterDistribution
    )
    expect(
      db
        .prepare(
          'SELECT * FROM loot_operation_receipt_v30_archive ORDER BY command_id'
        )
        .all()
    ).toEqual(receipts)
    expect(sessionGeneratedRunSchema.safeParse(run).success).toBe(false)
    expect(
      persistedSessionGeneratedRunSchema.safeParse({
        ...run,
        rewardEngineVersion: 'reward-unknown'
      }).success
    ).toBe(false)
    expect(
      db
        .prepare(
          'SELECT reward_engine_version FROM session_generation_run WHERE id = ?'
        )
        .pluck()
        .get(original.id)
    ).toBe('reward-v1')
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('preserves existing schema-41 command receipts when applying the repair', () => {
  const db = new Database(':memory:')
  try {
    initializeLootOperationJournalSchema(db)
    db.pragma('user_version = 41')
    const journal = new LootOperationJournal(db)
    const command = {
      commandId: randomUUID(),
      operationType: 'distribute' as const,
      requestFingerprint: 'existing-request',
      targetId: randomUUID(),
      schema: z.object({ revision: z.number() }),
      result: { revision: 7 }
    }
    journal.record(command)
    const before = db.prepare('SELECT * FROM loot_operation_receipt').all()
    applySchemaMigrations(db, { path: ':memory:', role: 'campaign' })
    expect(db.pragma('user_version', { simple: true })).toBe(43)
    expect(db.prepare('SELECT * FROM loot_operation_receipt').all()).toEqual(
      before
    )
    expect(journal.read(command)).toEqual({
      targetId: command.targetId,
      result: command.result
    })
    applySchemaMigrations(db, { path: ':memory:', role: 'campaign' })
    expect(db.prepare('SELECT * FROM loot_operation_receipt').all()).toEqual(
      before
    )
  } finally {
    db.close()
  }
})
