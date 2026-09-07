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
      migrateProfile(root)
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
