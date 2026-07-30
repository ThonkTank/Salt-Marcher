import { existsSync, mkdirSync, renameSync, rmSync, rmdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type {
  Campaign,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'
import { freezeCampaignSnapshot } from '../../../shared/contracts/campaign.js'

export type CampaignCreatePhase =
  | 'before-registry-entry'
  | 'after-creating-entry'
  | 'after-store-created'
  | 'before-ready'

export interface CampaignStoreOptions {
  /** Test seam for simulating a process interruption at durable create boundaries. */
  onCreatePhase?: (phase: CampaignCreatePhase) => void
}

export class CampaignStore {
  private readonly installation: Database.Database
  private readonly onCreatePhase:
    ((phase: CampaignCreatePhase) => void) | undefined

  constructor(
    private readonly dataRoot: string,
    options: CampaignStoreOptions = {}
  ) {
    this.onCreatePhase = options.onCreatePhase
    const installationPath = join(dataRoot, 'installation.sqlite')
    mkdirSync(dirname(installationPath), { recursive: true })
    this.installation = new Database(installationPath)
    this.installation.pragma('journal_mode = WAL')
    this.installation.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('creating', 'ready'))
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `)
    this.addCreationStatusToPreCutoverStore()
    this.recoverIncompleteCreations()
  }

  list(): CampaignSnapshot {
    const campaigns = this.installation
      .prepare(
        "SELECT id, name, created_at AS createdAt FROM campaigns WHERE status = 'ready' ORDER BY created_at ASC"
      )
      .all() as Campaign[]
    const active = this.installation
      .prepare("SELECT value FROM settings WHERE key = 'active_campaign_id'")
      .get() as { value: string } | undefined
    return freezeCampaignSnapshot({
      campaigns,
      activeCampaignId: active?.value ?? null
    })
  }

  create(name: string): CampaignSnapshot {
    const id = uuidv7()
    const createdAt = new Date().toISOString()
    this.onCreatePhase?.('before-registry-entry')
    this.installation.transaction(() => {
      this.installation
        .prepare(
          "INSERT INTO campaigns (id, name, created_at, status) VALUES (?, ?, ?, 'creating')"
        )
        .run(id, name, createdAt)
    })()
    this.onCreatePhase?.('after-creating-entry')
    this.createStagedCampaignStore(id)
    this.onCreatePhase?.('after-store-created')
    this.finalizeCampaignCreation(id)
    return this.list()
  }

  activate(id: string): CampaignSnapshot {
    const exists = this.installation
      .prepare("SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready'")
      .get(id)
    if (exists === undefined) throw new Error('Campaign not found')
    this.setActive(id)
    return this.list()
  }

  close(): void {
    this.installation.close()
  }

  private addCreationStatusToPreCutoverStore(): void {
    const columns = this.installation
      .prepare('PRAGMA table_info(campaigns)')
      .all() as {
      name: string
    }[]
    if (!columns.some((column) => column.name === 'status'))
      this.installation.exec(
        "ALTER TABLE campaigns ADD COLUMN status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('creating', 'ready'))"
      )
  }

  private createStagedCampaignStore(id: string): void {
    const campaignPath = this.stagedCampaignPath(id)
    mkdirSync(dirname(campaignPath), { recursive: true })
    const campaign = new Database(campaignPath)
    campaign.exec(
      'CREATE TABLE IF NOT EXISTS campaign_runtime (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
    )
    campaign.close()
  }

  private finalizeCampaignCreation(id: string): void {
    const stagedDirectory = this.stagedCampaignDirectory(id)
    const campaignDirectory = this.campaignDirectory(id)
    if (existsSync(stagedDirectory) && !existsSync(campaignDirectory))
      renameSync(stagedDirectory, campaignDirectory)
    if (!this.isValidCampaignStore(this.campaignPath(id)))
      throw new Error('Campaign store creation did not complete')
    this.onCreatePhase?.('before-ready')
    this.installation.transaction(() => {
      this.installation
        .prepare(
          "UPDATE campaigns SET status = 'ready' WHERE id = ? AND status = 'creating'"
        )
        .run(id)
      this.setActive(id)
    })()
  }

  private recoverIncompleteCreations(): void {
    const incomplete = this.installation
      .prepare("SELECT id FROM campaigns WHERE status = 'creating'")
      .all() as { id: string }[]
    for (const { id } of incomplete) {
      if (!this.isSafeCampaignId(id)) {
        this.installation.prepare('DELETE FROM campaigns WHERE id = ?').run(id)
        continue
      }
      try {
        this.finalizeCampaignCreation(id)
      } catch {
        this.removeIncompleteCreation(id)
      }
    }
  }

  private removeIncompleteCreation(id: string): void {
    rmSync(this.stagedCampaignDirectory(id), { recursive: true, force: true })
    rmSync(this.campaignDirectory(id), { recursive: true, force: true })
    try {
      rmdirSync(join(this.dataRoot, 'campaigns', '.creating'))
    } catch {
      // Another incomplete creation may still own the shared staging parent.
    }
    this.installation.transaction(() => {
      this.installation.prepare('DELETE FROM campaigns WHERE id = ?').run(id)
      this.installation
        .prepare(
          "DELETE FROM settings WHERE key = 'active_campaign_id' AND value = ?"
        )
        .run(id)
    })()
  }

  private isValidCampaignStore(path: string): boolean {
    if (!existsSync(path)) return false
    let campaign: Database.Database | undefined
    try {
      campaign = new Database(path, { readonly: true })
      return (
        campaign
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'campaign_runtime'"
          )
          .get() !== undefined
      )
    } catch {
      return false
    } finally {
      campaign?.close()
    }
  }

  private campaignDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', id)
  }

  private stagedCampaignDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.creating', id)
  }

  private campaignPath(id: string): string {
    return join(this.campaignDirectory(id), 'campaign.sqlite')
  }

  private stagedCampaignPath(id: string): string {
    return join(this.stagedCampaignDirectory(id), 'campaign.sqlite')
  }

  private isSafeCampaignId(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  }

  private setActive(id: string): void {
    this.installation
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('active_campaign_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(id)
  }
}
