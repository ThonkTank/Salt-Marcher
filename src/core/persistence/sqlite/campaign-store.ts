import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type {
  Campaign,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'

export class CampaignStore {
  private readonly installation: Database.Database

  constructor(private readonly dataRoot: string) {
    const installationPath = join(dataRoot, 'installation.sqlite')
    mkdirSync(dirname(installationPath), { recursive: true })
    this.installation = new Database(installationPath)
    this.installation.pragma('journal_mode = WAL')
    this.installation.exec(`
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
  }

  list(): CampaignSnapshot {
    const campaigns = this.installation
      .prepare(
        'SELECT id, name, created_at AS createdAt FROM campaigns ORDER BY created_at ASC'
      )
      .all() as Campaign[]
    const active = this.installation
      .prepare("SELECT value FROM settings WHERE key = 'active_campaign_id'")
      .get() as { value: string } | undefined
    return { campaigns, activeCampaignId: active?.value ?? null }
  }

  create(name: string): CampaignSnapshot {
    const id = uuidv7()
    const createdAt = new Date().toISOString()
    this.installation
      .prepare('INSERT INTO campaigns (id, name, created_at) VALUES (?, ?, ?)')
      .run(id, name, createdAt)
    this.ensureCampaignStore(id)
    this.setActive(id)
    return this.list()
  }

  activate(id: string): CampaignSnapshot {
    const exists = this.installation
      .prepare('SELECT 1 FROM campaigns WHERE id = ?')
      .get(id)
    if (exists === undefined) throw new Error('Campaign not found')
    this.setActive(id)
    return this.list()
  }

  close(): void {
    this.installation.close()
  }

  private ensureCampaignStore(id: string): void {
    const campaignPath = join(this.dataRoot, 'campaigns', id, 'campaign.sqlite')
    mkdirSync(dirname(campaignPath), { recursive: true })
    const campaign = new Database(campaignPath)
    campaign.exec(
      'CREATE TABLE IF NOT EXISTS campaign_runtime (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
    )
    campaign.close()
  }

  private setActive(id: string): void {
    this.installation
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('active_campaign_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(id)
  }
}
