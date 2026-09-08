import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { applySchemaMigrations } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { initializeCampaignSchemaMetadata } from '../../src/core/persistence/sqlite/campaign-schema-migrations.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import type { SaveSceneGroupInput } from '../../src/shared/contracts/scene.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

describe('converging schema 35 variants', () => {
  it.each(['main-burden', 'candidate-receipts'] as const)(
    'preserves %s data through failure, migration and restart',
    (variant) => {
      const root = mkdtempSync(join(tmpdir(), 'salt-schema-35-'))
      let store = new CampaignStore(root)
      try {
        store.create('Existing campaign')
        const db = activeCampaignDatabase(store)
        seedExampleParty(db)
        const play = new LivePlayService(store.activeCampaignPersistence())
        const scene = play.readSession().scene
        const input: SaveSceneGroupInput = {
          commandId: randomUUID(),
          sceneId: scene.focusedSceneId,
          groupId: null,
          name: 'Existing group',
          note: '',
          disposition: 'hostile',
          entries: [],
          expectedRevision: scene.revision,
          expectedGroupRevision: null
        }
        const saved = play.saveSceneGroupCommand(input)
        db.exec(
          'UPDATE player_characters SET xp_since_short_rest = 123, xp_since_long_rest = 456, short_rest_trusted = 1, long_rest_trusted = 0'
        )
        initializeCampaignSchemaMetadata(db)
        if (variant === 'main-burden')
          db.exec('DROP TABLE scene_group_command_receipt')
        else
          db.exec(
            'ALTER TABLE player_characters DROP COLUMN short_rest_trusted; ALTER TABLE player_characters DROP COLUMN long_rest_trusted'
          )
        const priorId =
          variant === 'main-burden'
            ? 'campaign-34-to-35-party-burden'
            : 'campaign-34-to-35-scene-group-receipts'
        db.prepare('INSERT INTO campaign_schema_migration VALUES (?, ?)').run(
          priorId,
          '2026-09-08T00:00:00.000Z'
        )
        db.pragma('user_version = 35')
        const columns = db.pragma('table_info(player_characters)')
        const rows = db
          .prepare('SELECT * FROM player_characters ORDER BY id')
          .all()
        db.exec(
          "CREATE TEMP TRIGGER fail_transition BEFORE INSERT ON campaign_schema_migration WHEN NEW.migration_id = 'campaign-35-to-36-unified-burden-and-group-receipts' BEGIN SELECT RAISE(ABORT, 'interrupted migration'); END"
        )
        expect(() =>
          applySchemaMigrations(db, { path: root, role: 'campaign' })
        ).toThrow('interrupted migration')
        expect(db.pragma('user_version', { simple: true })).toBe(35)
        expect(db.pragma('table_info(player_characters)')).toEqual(columns)
        expect(
          db.prepare('SELECT * FROM player_characters ORDER BY id').all()
        ).toEqual(rows)
        db.exec('DROP TRIGGER fail_transition')
        applySchemaMigrations(db, { path: root, role: 'campaign' })
        expect(db.pragma('user_version', { simple: true })).toBe(37)
        expect(
          db.prepare('SELECT * FROM player_characters ORDER BY id').all()
        ).toEqual(
          rows.map((row) => ({
            ...(row as Record<string, unknown>),
            short_rest_trusted: variant === 'main-burden' ? 1 : 0,
            long_rest_trusted: 0
          }))
        )
        expect(
          db
            .prepare(
              'SELECT applied_at FROM campaign_schema_migration WHERE migration_id = ?'
            )
            .get(priorId)
        ).toEqual({ applied_at: '2026-09-08T00:00:00.000Z' })
        const receipt = variant === 'main-burden' ? null : saved
        expect(play.sceneGroupSaveReceipt(input)).toEqual(receipt)
        const snapshot = play.readSession()
        expect(snapshot.scene.scenes[0]?.groups[0]?.name).toBe('Existing group')
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
        store.close()
        store = new CampaignStore(root)
        const restarted = new LivePlayService(store.activeCampaignPersistence())
        expect(restarted.sceneGroupSaveReceipt(input)).toEqual(receipt)
        expect(restarted.readSession()).toEqual(snapshot)
      } finally {
        store.close()
        rmSync(root, { recursive: true, force: true })
      }
    }
  )
})
