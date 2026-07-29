import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import {
  coreRequestSchema,
  type Campaign,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'

const suppliedDataRoot = process.argv[2]

if (suppliedDataRoot === undefined || process.parentPort === undefined) {
  throw new Error('Utility process requires a data root and parent port')
}
const dataRoot: string = suppliedDataRoot

const installationPath = join(dataRoot, 'installation.sqlite')
mkdirSync(dirname(installationPath), { recursive: true })
const installation = new Database(installationPath)
installation.pragma('journal_mode = WAL')
installation.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`)

function snapshot(): CampaignSnapshot {
  const campaigns = installation
    .prepare(
      'SELECT id, name, created_at AS createdAt FROM campaigns ORDER BY created_at ASC'
    )
    .all() as Campaign[]
  const active = installation
    .prepare("SELECT value FROM settings WHERE key = 'active_campaign_id'")
    .get() as { value: string } | undefined
  return { campaigns, activeCampaignId: active?.value ?? null }
}

function ensureCampaignStore(id: string): void {
  const campaignPath = join(dataRoot, 'campaigns', id, 'campaign.sqlite')
  mkdirSync(dirname(campaignPath), { recursive: true })
  const campaign = new Database(campaignPath)
  campaign.exec(
    'CREATE TABLE IF NOT EXISTS campaign_runtime (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  )
  campaign.close()
}

process.parentPort.on('message', (event) => {
  const raw: unknown = event.data
  const parsed = coreRequestSchema.safeParse(raw)
  if (!parsed.success) {
    process.parentPort?.postMessage({
      requestId: crypto.randomUUID(),
      ok: false,
      error: 'Invalid command'
    })
    return
  }

  try {
    if (parsed.data.kind === 'campaign.create') {
      const id = uuidv7()
      const createdAt = new Date().toISOString()
      installation
        .prepare(
          'INSERT INTO campaigns (id, name, created_at) VALUES (?, ?, ?)'
        )
        .run(id, parsed.data.input.name, createdAt)
      ensureCampaignStore(id)
      installation
        .prepare(
          "INSERT INTO settings (key, value) VALUES ('active_campaign_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .run(id)
    }
    if (parsed.data.kind === 'campaign.activate') {
      const exists = installation
        .prepare('SELECT 1 FROM campaigns WHERE id = ?')
        .get(parsed.data.input.id)
      if (exists === undefined) throw new Error('Campaign not found')
      installation
        .prepare(
          "INSERT INTO settings (key, value) VALUES ('active_campaign_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .run(parsed.data.input.id)
    }
    process.parentPort?.postMessage({
      requestId: parsed.data.requestId,
      ok: true,
      snapshot: snapshot()
    })
  } catch (error) {
    process.parentPort?.postMessage({
      requestId: parsed.data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : 'Utility process failure'
    })
  }
})
