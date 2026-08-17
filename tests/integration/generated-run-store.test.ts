import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { GeneratedRunStore } from '../../src/core/session-generation/generated-run-store.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { SessionGenerationService } from '../../src/utility/session-generation/session-generation-service.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('GeneratedRunStore relational persistence', () => {
  it('writes reward-v3 while hydrating reward-v2 and rejecting unknown versions', () => {
    const { db, run } = generatedSession()
    expect(run.rewardEngineVersion).toBe('reward-v3')
    db.prepare(
      'UPDATE session_generation_run SET reward_engine_version = ? WHERE id = ?'
    ).run('reward-v2', run.id)
    const legacy = new GeneratedRunStore(db).read(run.id)
    expect(legacy?.rewardEngineVersion).toBe('reward-v2')
    db.prepare(
      'UPDATE session_generation_run SET reward_engine_version = ? WHERE id = ?'
    ).run('reward-unknown', run.id)
    expect(() => new GeneratedRunStore(db).read(run.id)).toThrow(
      /reward-v2|reward-v3/
    )
  })

  it('stores no aggregate run blob, keeps item facts central, and rejects invalid rows', () => {
    const { db, run } = generatedSession()
    const tables = (
      db
        .prepare(
          `SELECT name FROM sqlite_master
            WHERE type = 'table' AND name LIKE 'session_generation_%'
            ORDER BY name`
        )
        .all() as { name: string }[]
    ).map(({ name }) => name)
    expect(tables.length).toBeGreaterThan(10)
    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as {
        name: string
        type: string
      }[]
      expect(
        columns.some((column) => column.name === 'run_json'),
        `${table} retains an aggregate run blob`
      ).toBe(false)
    }
    const itemColumns = (
      db.prepare('PRAGMA table_info(session_generation_item)').all() as Array<{
        name: string
      }>
    ).map((column) => column.name)
    expect(itemColumns).toEqual([
      'run_id',
      'treasure_id',
      'id',
      'position',
      'item_reference_json',
      'role',
      'quantity',
      'container_id'
    ])
    expect(
      db
        .prepare(
          'SELECT count(*) FROM session_generation_item_definition WHERE run_id = ?'
        )
        .pluck()
        .get(run.id)
    ).toBe(run.itemDefinitions.length)

    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_run (
             id, run_kind, origin_fingerprint, generated_at,
             encounter_engine_version, reward_engine_version, catalog_version,
             catalog_content_hash, preset_id, preset_revision,
             preset_config_hash, seed
           ) VALUES (?, 'unknown', ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`
        )
        .run(
          randomUUID(),
          'f'.repeat(64),
          '2026-08-09T10:00:00.000Z',
          run.engineVersion,
          run.rewardEngineVersion,
          run.catalogVersion,
          run.catalogContentHash,
          systemGeneratorPresetId,
          'e'.repeat(64)
        )
    ).toThrow()
    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_party_level
             (run_id, position, level, quantity) VALUES (?, -1, 20, 1)`
        )
        .run(run.id)
    ).toThrow()
    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_party_level
             (run_id, position, level, quantity) VALUES (?, 99, 20, 0)`
        )
        .run(run.id)
    ).toThrow()
    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_treasure (
             run_id, run_kind, id, position, stock_class, reward_channel,
             anchor_encounter_number, theme_id, theme, target_value_cp,
             actual_value_cp
           ) VALUES (?, 'session', ?, 999, 'normal', 'sale', NULL,
                     'test', 'test', '1', 1)`
        )
        .run(run.id, randomUUID())
    ).toThrow()
    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_container (
             run_id, treasure_id, id, position, name, capacity
           ) VALUES (?, ?, ?, 0, 'orphan', 1)`
        )
        .run(run.id, randomUUID(), randomUUID())
    ).toThrow()

    const treasureId = (
      db
        .prepare(
          `SELECT id FROM session_generation_treasure
            WHERE run_id = ? ORDER BY position LIMIT 1`
        )
        .get(run.id) as { id: string }
    ).id
    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_item (
             run_id, treasure_id, id, position, item_reference_json, role,
             quantity, container_id
           ) VALUES (?, ?, ?, 999, ?, 'invalid', 1, NULL)`
        )
        .run(run.id, treasureId, randomUUID(), '{"kind":"unknown"}')
    ).toThrow()
    expect(() =>
      db
        .prepare(
          `INSERT INTO session_generation_treasure (
             run_id, run_kind, id, position, stock_class, reward_channel,
             anchor_encounter_number, theme_id, theme, target_value_cp,
             actual_value_cp
           ) VALUES (?, 'group_reward', ?, 999, 'normal', 'encounter', NULL,
                     'test', 'test', '1', 1)`
        )
        .run(run.id, randomUUID())
    ).toThrow()
  })

  it('round-trips one deeply frozen run through bounded child reads', () => {
    const { db, run } = generatedSession()
    const readCounter = countingDatabase(db)
    const read = new GeneratedRunStore(readCounter.database).read(run.id)
    expect(read).toEqual(run)
    expect(readCounter.queries()).toBeLessThanOrEqual(14)
    expect(readCounter.queries()).toBeGreaterThan(5)
    expectDeepFrozen(read)

    const fingerprintCounter = countingDatabase(db)
    const found = new GeneratedRunStore(
      fingerprintCounter.database
    ).findByFingerprint(run.originFingerprint)
    expect(found).toEqual(run)
    expect(fingerprintCounter.queries()).toBeLessThanOrEqual(14)
    expectDeepFrozen(found)
  })
})

function generatedSession() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-generated-run-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Generated run test')
  const db = campaigns.activeCampaignDatabase()
  const generation = new SessionGenerationService(
    new BundledEncounterCatalogProvider(
      join(process.cwd(), 'resources/sessiongeneration/catalog-2026-08-16')
    ),
    sha256EncounterEntropy,
    () => ({
      id: systemGeneratorPresetId,
      revision: 0,
      config: defaultGeneratorConfig
    }),
    () => db,
    () => new Date('2026-08-09T10:00:00.000Z')
  )
  const result = generation.generate({
    party: [{ level: 3, count: 4 }],
    ledgerParty: Array.from({ length: 4 }, (_, index) => ({
      characterId: `018f47db-e17a-7000-8000-${String(index + 1).padStart(12, '0')}`,
      level: 3,
      currentXp: 900,
      ledgerRevision: 0,
      currentNonMagicCp: 37_600,
      currentMagic: emptyMagicCounts()
    })),
    adventureDayFraction: '0.6',
    encounterCount: 3,
    seed: 179_974
  })
  if (result.status !== 'success') throw new Error('Expected generated run')
  return { campaigns, db, run: result.run }
}

function emptyMagicCounts() {
  return {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    'Very Rare': 0,
    Legendary: 0
  }
}

function countingDatabase(database: Database.Database): {
  database: Database.Database
  queries: () => number
} {
  let queries = 0
  const proxy = new Proxy(database, {
    get(target, property) {
      if (property === 'prepare')
        return (sql: string) => {
          queries += 1
          return target.prepare(sql)
        }
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === 'function'
        ? (value.bind(target) as unknown)
        : value
    }
  })
  return { database: proxy, queries: () => queries }
}

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  expect(Object.isFrozen(value)).toBe(true)
  for (const child of Object.values(value)) expectDeepFrozen(child)
}
