import type Database from 'better-sqlite3'
import type {
  Campaign,
  CampaignCommandReceipt,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import {
  campaignCommandReceiptSchema,
  freezeCampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type { CampaignLifecycleReceipt } from '../../application/campaign-lifecycle-coordinator.js'

const registryRevisionKey = 'campaign_registry_revision'
const commandReceiptLimit = 512

export type CampaignCommandIdentity = Readonly<{
  commandId: string
  kind: CampaignCommandReceipt['kind']
  requestJson: string
  campaignId: string
}>

export function initializeCampaignRegistryRevision(
  database: Database.Database
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `)
  database
    .prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    .run(registryRevisionKey, '0')
}

export function initializeCampaignCommandReceiptSchema(
  database: Database.Database
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_commands (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation_kind TEXT NOT NULL,
      request_json TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      receipt_json TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

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
    `)
    initializeCampaignRegistryRevision(this.database)
    initializeCampaignCommandReceiptSchema(this.database)
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
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): void {
    this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.database
        .prepare(
          "INSERT INTO campaigns (id, name, created_at, status) VALUES (?, ?, ?, 'creating')"
        )
        .run(id, name, createdAt)
      if (command) this.reserveCommand(command)
    })()
  }

  insertImportCreation(id: string, name: string, createdAt: string): void {
    this.database
      .prepare(
        "INSERT INTO campaigns (id, name, created_at, status) VALUES (?, ?, ?, 'creating')"
      )
      .run(id, name, createdAt)
  }

  markReadyAndActivate(
    id: string,
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    return this.database.transaction(() => {
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
      return command ? this.completeCommand(command) : null
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

  rename(
    id: string,
    name: string,
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    return this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      const result = this.database
        .prepare(
          "UPDATE campaigns SET name = ? WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
        )
        .run(name, id)
      if (result.changes === 0) throw new CapabilityError('not_found', false)
      this.advanceRevision()
      return command ? this.completeCommand(command) : null
    })()
  }

  trash(
    id: string,
    trashedAt: string,
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    return this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.requireAvailable(id)
      this.database
        .prepare('UPDATE campaigns SET trashed_at = ? WHERE id = ?')
        .run(trashedAt, id)
      this.deleteActive(id)
      this.advanceRevision()
      return command ? this.completeCommand(command) : null
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

  restore(
    id: string,
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    return this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.requireTrashed(id)
      this.database
        .prepare('UPDATE campaigns SET trashed_at = NULL WHERE id = ?')
        .run(id)
      this.advanceRevision()
      return command ? this.completeCommand(command) : null
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

  delete(
    id: string,
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    return this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      const result = this.database
        .prepare('DELETE FROM campaigns WHERE id = ?')
        .run(id)
      if (result.changes === 0)
        return command ? this.completeCommand(command) : null
      this.deleteActive(id)
      this.advanceRevision()
      return command ? this.completeCommand(command) : null
    })()
  }

  setActive(
    id: string,
    expectedRevision = this.revision(),
    command?: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    return this.database.transaction(() => {
      this.assertRevision(expectedRevision)
      this.writeActive(id)
      this.advanceRevision()
      return command ? this.completeCommand(command) : null
    })()
  }

  commandReceipt(commandId: string): CampaignCommandReceipt | null {
    const row = this.commandRow(commandId)
    if (!row?.receiptJson) return null
    return deepFreeze(
      campaignCommandReceiptSchema.parse(parseJson(row.receiptJson))
    )
  }

  existingCommand(
    command: CampaignCommandIdentity
  ): CampaignCommandReceipt | null {
    const row = this.commandRow(command.commandId)
    if (!row) return null
    this.assertCommandIdentity(row, command)
    if (!row.receiptJson) throw new CapabilityError('outcome_unknown', true)
    return deepFreeze(
      campaignCommandReceiptSchema.parse(parseJson(row.receiptJson))
    )
  }

  existingCommandForRequest(
    commandId: string,
    kind: CampaignCommandReceipt['kind'],
    requestJson: string
  ): CampaignCommandReceipt | null {
    const row = this.commandRow(commandId)
    if (!row) return null
    if (row.operationKind !== kind || row.requestJson !== requestJson)
      throw new CapabilityError('idempotency_conflict', false)
    if (!row.receiptJson) throw new CapabilityError('outcome_unknown', true)
    return deepFreeze(
      campaignCommandReceiptSchema.parse(parseJson(row.receiptJson))
    )
  }

  pendingCreationCommand(campaignId: string): CampaignCommandIdentity | null {
    const row = this.database
      .prepare(
        `SELECT command_id AS commandId, operation_kind AS operationKind,
          request_json AS requestJson, campaign_id AS campaignId
         FROM campaign_commands
         WHERE campaign_id = ? AND operation_kind = 'created' AND receipt_json IS NULL`
      )
      .get(campaignId) as
      | {
          commandId: string
          operationKind: string
          requestJson: string
          campaignId: string
        }
      | undefined
    return row
      ? Object.freeze({
          commandId: row.commandId,
          kind: 'created',
          requestJson: row.requestJson,
          campaignId: row.campaignId
        })
      : null
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
      this.database
        .prepare(
          'DELETE FROM campaign_commands WHERE campaign_id = ? AND receipt_json IS NULL'
        )
        .run(id)
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

  private reserveCommand(command: CampaignCommandIdentity): void {
    const existing = this.commandRow(command.commandId)
    if (existing) {
      this.assertCommandIdentity(existing, command)
      throw new CapabilityError('outcome_unknown', true)
    }
    this.database
      .prepare(
        `INSERT INTO campaign_commands
          (command_id, operation_kind, request_json, campaign_id, receipt_json, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`
      )
      .run(
        command.commandId,
        command.kind,
        command.requestJson,
        command.campaignId,
        new Date().toISOString()
      )
  }

  private completeCommand(
    command: CampaignCommandIdentity
  ): CampaignCommandReceipt {
    const receipt = deepFreeze(
      campaignCommandReceiptSchema.parse({
        kind: command.kind,
        commandId: command.commandId,
        campaignId: command.campaignId,
        snapshot: this.snapshot()
      })
    )
    const existing = this.commandRow(command.commandId)
    if (existing) {
      this.assertCommandIdentity(existing, command)
      if (existing.receiptJson)
        return deepFreeze(
          campaignCommandReceiptSchema.parse(parseJson(existing.receiptJson))
        )
      this.database
        .prepare(
          'UPDATE campaign_commands SET receipt_json = ? WHERE command_id = ? AND receipt_json IS NULL'
        )
        .run(JSON.stringify(receipt), command.commandId)
    } else {
      this.database
        .prepare(
          `INSERT INTO campaign_commands
            (command_id, operation_kind, request_json, campaign_id, receipt_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          command.commandId,
          command.kind,
          command.requestJson,
          command.campaignId,
          JSON.stringify(receipt),
          new Date().toISOString()
        )
    }
    this.pruneCompletedCommands()
    return receipt
  }

  private commandRow(commandId: string):
    | {
        operationKind: string
        requestJson: string
        campaignId: string
        receiptJson: string | null
      }
    | undefined {
    return this.database
      .prepare(
        `SELECT operation_kind AS operationKind, request_json AS requestJson,
          campaign_id AS campaignId, receipt_json AS receiptJson
         FROM campaign_commands WHERE command_id = ?`
      )
      .get(commandId) as
      | {
          operationKind: string
          requestJson: string
          campaignId: string
          receiptJson: string | null
        }
      | undefined
  }

  private assertCommandIdentity(
    row: { operationKind: string; requestJson: string; campaignId: string },
    command: CampaignCommandIdentity
  ): void {
    if (
      row.operationKind !== command.kind ||
      row.requestJson !== command.requestJson ||
      row.campaignId !== command.campaignId
    )
      throw new CapabilityError('idempotency_conflict', false)
  }

  private pruneCompletedCommands(): void {
    this.database
      .prepare(
        `DELETE FROM campaign_commands WHERE command_id IN (
          SELECT command_id FROM campaign_commands
          WHERE receipt_json IS NOT NULL
          ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ${commandReceiptLimit}
        )`
      )
      .run()
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

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
