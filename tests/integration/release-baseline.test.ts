import Database from 'better-sqlite3'
import { describe, it, expect } from 'vitest'
import { gunzipSync } from 'node:zlib'
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateProfile } from '../../src/core/maintenance/profile-snapshot.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { resolveSchemaMigrationPath } from '../../src/core/persistence/sqlite/schema-migrations.js'
import { readbackProfile } from '../../src/core/persistence/sqlite/profile-readback.js'
const fixture = 'tests/fixtures/release-0.2.0'
describe('permanent 0.2.0 persistence baseline', () => {
  it('always retains a complete path from every released database role', () => {
    expect(resolveSchemaMigrationPath('installation', 39)).not.toBeNull()
    expect(resolveSchemaMigrationPath('campaign', 34)).not.toBeNull()
  })
  it('opens the immutable baseline after migration with its campaign and settings intact', () => {
    const metadata = JSON.parse(
      readFileSync(join(fixture, 'manifest.json'), 'utf8')
    ) as { campaignId: string; name: string }
    const root = mkdtempSync(join(tmpdir(), 'salt-frozen-baseline-'))
    try {
      const campaign = join(root, 'campaigns', metadata.campaignId)
      mkdirSync(campaign, { recursive: true })
      writeFileSync(
        join(root, 'installation.sqlite'),
        gunzipSync(readFileSync(join(fixture, 'installation.sqlite.gz')))
      )
      writeFileSync(
        join(campaign, 'campaign.sqlite'),
        gunzipSync(readFileSync(join(fixture, 'campaign.sqlite.gz')))
      )
      const path = join(campaign, 'campaign.sqlite')
      const before = new Database(path, { readonly: true })
      expect(before.pragma('user_version', { simple: true })).toBe(34)
      const rows = dataRows(before)
      before.close()
      migrateProfile(root)
      const after = new Database(path, { readonly: true })
      try {
        expect(after.pragma('user_version', { simple: true })).toBe(35)
        expect(dataRows(after, Object.keys(rows))).toEqual(rows)
        expect(
          after
            .prepare(
              'SELECT COUNT(*) AS count FROM scene_group_command_receipt'
            )
            .get()
        ).toEqual({ count: 0 })
        expect(after.pragma('integrity_check', { simple: true })).toBe('ok')
      } finally {
        after.close()
      }
      readbackProfile(root)
      const store = new CampaignStore(root)
      try {
        expect(store.list().activeCampaignId).toBe(metadata.campaignId)
        expect(store.list().campaigns[0]?.name).toBe(metadata.name)
        expect(store.readSettings().preferences.theme).toBeDefined()
      } finally {
        store.close()
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

function dataRows(
  database: Database.Database,
  tables?: readonly string[]
): Record<string, unknown> {
  const names =
    tables ??
    (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'campaign_schema_migration'"
        )
        .all() as { name: string }[]
    ).map((row) => row.name)
  return Object.fromEntries(
    names.map((name) => [
      name,
      database.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()
    ])
  )
}
