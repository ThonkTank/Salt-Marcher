import type Database from 'better-sqlite3'
import type {
  Campaign,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { freezeCampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type { CampaignLifecycleReceipt } from '../../application/campaign-lifecycle-coordinator.js'

const registryRevisionKey = 'campaign_registry_revision'

/** Owns installation-level campaign metadata and its transaction boundaries. */
export class CampaignRegistryRepository {
  constructor(private readonly database: Database.Database) {}

  initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        trashed_at TEXT,
        status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('creating', 'ready'))
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `)
    this.database
      .prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
      .run(registryRevisionKey, '0')
  }

  snapshot(): CampaignSnapshot {
    const campaigns = this.database
      .prepare(
        "SELECT id, name, created_at AS createdAt FROM campaigns WHERE status = 'ready' AND trashed_at IS NULL ORDER BY created_at ASC"
      )
      .all() as Campaign[]
    const trashedCampaigns = this.database
      .prepare(
        "SELECT id, name, created_at AS createdAt, trashed_at AS trashedAt FROM campaigns WHERE status = 'ready' AND trashed_at IS NOT NULL ORDER BY trashed_at DESC"
      )
      .all() as CampaignSnapshot['trashedCampaigns']
    const activeId = this.recordedActiveId()
    return freezeCampaignSnapshot({
      revision: this.revision(),
      campaigns,
      trashedCampaigns: [...trashedCampaigns],
      activeCampaignId:
        activeId !== null &&
        campaigns.some((campaign) => campaign.id === activeId)
          ? activeId
          : null
    })
  }

  revision(): number {
    const value = this.setting(registryRevisionKey)
    if (value === null)
      throw new Error('Campaign registry revision is unavailable')
    const revision = Number(value)
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error('Campaign registry revision is invalid')
    return revision
  }

  assertRevision(expectedRevision: number): void {
    if (this.revision() !== expectedRevision)
      throw new CapabilityError('stale', true)
  }

  beginCreation(
    id: string,
    name: string,
    createdAt: string,
    expectedRevision = this.revision()
  ): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.database
        .prepare(
          "INSERT INTO campaigns (id, name, created_at, status) VALUES (?, ?, ?, 'creating')"
        )
        .run(id, name, createdAt)
    })()
  }

  insertImportCreation(id: string, name: string, createdAt: string): void {
    this.database
      .prepare(
        "INSERT INTO campaigns (id, name, created_at, status) VALUES (?, ?, ?, 'creating')"
      )
      .run(id, name, createdAt)
  }

  markReadyAndActivate(id: string, expectedRevision = this.revision()): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      const result = this.database
        .prepare(
          "UPDATE campaigns SET status = 'ready' WHERE id = ? AND status = 'creating'"
        )
        .run(id)
      if (result.changes !== 1)
        throw new Error('Campaign creation registry target is unavailable')
      this.writeActive(id)
      this.advanceRevision()
    })()
  }

  requireAvailable(id: string): void {
    const exists = this.database
      .prepare(
        "SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
      )
      .get(id)
    if (exists === undefined) throw new CapabilityError('not_found', false)
  }

  rename(id: string, name: string, expectedRevision = this.revision()): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      const result = this.database
        .prepare(
          "UPDATE campaigns SET name = ? WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
        )
        .run(name, id)
      if (result.changes === 0) throw new CapabilityError('not_found', false)
      this.advanceRevision()
    })()
  }

  trash(
    id: string,
    trashedAt: string,
    expectedRevision = this.revision()
  ): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.requireAvailable(id)
      this.database
        .prepare('UPDATE campaigns SET trashed_at = ? WHERE id = ?')
        .run(trashedAt, id)
      this.deleteActive(id)
      this.advanceRevision()
    })()
  }

  requireTrashed(id: string): void {
    const exists = this.database
      .prepare(
        "SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NOT NULL"
      )
      .get(id)
    if (exists === undefined) throw new CapabilityError('not_found', false)
  }

  restore(id: string, expectedRevision = this.revision()): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.requireTrashed(id)
      this.database
        .prepare('UPDATE campaigns SET trashed_at = NULL WHERE id = ?')
        .run(id)
      this.advanceRevision()
    })()
  }

  requireDeletionName(id: string, confirmationName: string): void {
    const campaign = this.database
      .prepare(
        "SELECT name FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NOT NULL"
      )
      .get(id) as { name: string } | undefined
    if (campaign === undefined) throw new CapabilityError('not_found', false)
    if (campaign.name !== confirmationName)
      throw new CapabilityError('validation_failed', false)
  }

  delete(id: string, expectedRevision = this.revision()): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      const result = this.database
        .prepare('DELETE FROM campaigns WHERE id = ?')
        .run(id)
      if (result.changes === 0) return
      this.deleteActive(id)
      this.advanceRevision()
    })()
  }

  previousName(id: string): string {
    const campaign = this.database
      .prepare(
        "SELECT name FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
      )
      .get(id) as { name: string } | undefined
    if (!campaign) throw new CapabilityError('not_found', false)
    return campaign.name
  }

  readyRows(): readonly Readonly<{
    id: string
    name: string
    trashedAt: string | null
  }>[] {
    return this.database
      .prepare(
        "SELECT id, name, trashed_at AS trashedAt FROM campaigns WHERE status = 'ready' ORDER BY created_at"
      )
      .all() as Array<{ id: string; name: string; trashedAt: string | null }>
  }

  creatingIds(): readonly string[] {
    return (
      this.database
        .prepare("SELECT id FROM campaigns WHERE status = 'creating'")
        .all() as { id: string }[]
    ).map(({ id }) => id)
  }

  trashedIds(): readonly string[] {
    return (
      this.database
        .prepare(
          "SELECT id FROM campaigns WHERE status = 'ready' AND trashed_at IS NOT NULL"
        )
        .all() as { id: string }[]
    ).map(({ id }) => id)
  }

  removeIncompleteCreation(id: string): void {
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM campaigns WHERE id = ?').run(id)
      this.deleteActive(id)
    })()
  }

  commitLifecycle(
    receipt: CampaignLifecycleReceipt,
    registerOperation: () => void = () => undefined
  ): void {
    this.database.transaction(() => {
      const result =
        receipt.mode === 'create'
          ? this.database
              .prepare(
                "UPDATE campaigns SET name = ?, status = 'ready' WHERE id = ? AND status = 'creating' AND trashed_at IS NULL"
              )
              .run(receipt.replacementName, receipt.campaignId)
          : this.database
              .prepare(
                "UPDATE campaigns SET name = ? WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
              )
              .run(receipt.replacementName, receipt.campaignId)
      if (result.changes !== 1)
        throw new Error('Campaign lifecycle registry target is unavailable')
      this.writeActive(receipt.campaignId)
      registerOperation()
      this.database
        .prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(this.lifecycleCommitKey(receipt.campaignId), receipt.lifecycleId)
      this.advanceRevision()
    })()
  }

  lifecycleCommit(receipt: CampaignLifecycleReceipt): boolean {
    const committed = this.setting(this.lifecycleCommitKey(receipt.campaignId))
    const legacy = this.setting(this.legacyCommitKey(receipt.campaignId))
    return committed === receipt.lifecycleId || legacy === receipt.lifecycleId
  }

  lifecycleReadback(receipt: CampaignLifecycleReceipt): boolean {
    const campaign = this.database
      .prepare(
        'SELECT name, status, trashed_at AS trashedAt FROM campaigns WHERE id = ?'
      )
      .get(receipt.campaignId) as
      { name: string; status: string; trashedAt: string | null } | undefined
    return (
      this.lifecycleCommit(receipt) &&
      campaign?.name === receipt.replacementName &&
      campaign.status === 'ready' &&
      campaign.trashedAt === null &&
      this.recordedActiveId() === receipt.campaignId
    )
  }

  restoreLifecycleRegistry(receipt: CampaignLifecycleReceipt): void {
    this.database.transaction(() => {
      const restoresVisibleState = this.lifecycleCommit(receipt)
      if (receipt.mode === 'create')
        this.database
          .prepare("DELETE FROM campaigns WHERE id = ? AND status = 'creating'")
          .run(receipt.campaignId)
      else
        this.database
          .prepare('UPDATE campaigns SET name = ? WHERE id = ?')
          .run(receipt.previousName, receipt.campaignId)
      if (receipt.previousActiveId === null) this.deleteRecordedActive()
      else this.writeActive(receipt.previousActiveId)
      this.database
        .prepare('DELETE FROM settings WHERE key = ?')
        .run(this.lifecycleCommitKey(receipt.campaignId))
      this.database
        .prepare('DELETE FROM settings WHERE key = ?')
        .run(this.legacyCommitKey(receipt.campaignId))
      if (restoresVisibleState) this.advanceRevision()
    })()
  }

  clearLifecycleCommit(receipt: CampaignLifecycleReceipt): void {
    this.database
      .prepare('DELETE FROM settings WHERE key = ? AND value = ?')
      .run(this.lifecycleCommitKey(receipt.campaignId), receipt.lifecycleId)
    this.database
      .prepare('DELETE FROM settings WHERE key = ? AND value = ?')
      .run(this.legacyCommitKey(receipt.campaignId), receipt.lifecycleId)
  }

  recordedActiveId(): string | null {
    const row = this.database
      .prepare("SELECT value FROM settings WHERE key = 'active_campaign_id'")
      .get() as { value: string } | undefined
    return row?.value ?? null
  }

  setActive(id: string, expectedRevision = this.revision()): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.writeActive(id)
      this.advanceRevision()
    })()
  }

  clearRecordedActive(): void {
    this.deleteRecordedActive()
  }

  private writeActive(id: string): void {
    this.database
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('active_campaign_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(id)
  }

  private deleteActive(id: string): void {
    this.database
      .prepare(
        "DELETE FROM settings WHERE key = 'active_campaign_id' AND value = ?"
      )
      .run(id)
  }

  private deleteRecordedActive(): void {
    this.database
      .prepare("DELETE FROM settings WHERE key = 'active_campaign_id'")
      .run()
  }

  private advanceRevision(): void {
    const result = this.database
      .prepare(
        'UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = ?'
      )
      .run(registryRevisionKey)
    if (result.changes !== 1)
      throw new Error('Campaign registry revision is unavailable')
  }

  private lifecycleCommitKey(campaignId: string): string {
    return `campaign_lifecycle:${campaignId}`
  }

  private legacyCommitKey(campaignId: string): string {
    return `campaign_directory_transition:${campaignId}`
  }

  private setting(key: string): string | null {
    const row = this.database
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined
    return row?.value ?? null
  }
}
