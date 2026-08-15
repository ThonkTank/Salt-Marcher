import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type {
  Campaign,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { freezeCampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'
import { initializePartySchema, PartyStore } from '../../party/party-store.js'
import { initializeSceneSchema } from '../../scene/scene-store.js'
import { initializeCombatSchema } from '../../encounter/live-combat.js'
import { initializeWorldLocationSchema } from '../../worldplanner/location-store.js'
import { initializeEncounterTableSchema } from '../../encounter/encounter-table-store.js'
import { initializeWorldFactionSchema } from '../../worldplanner/faction-store.js'
import { initializeHexSchema } from '../../hex/hex-map-store.js'
import {
  assertSchemaVersion,
  configureSqlite,
  currentSchemaVersion,
  IncompatibleDataError,
  initializeSchemaVersion
} from './database.js'
import { preflightPersistence } from './persistence-preflight.js'
import { initializeInstallationSchemaMetadata } from './installation-schema-migrations.js'
import { initializeCampaignSchemaMetadata } from './campaign-schema-migrations.js'
import {
  defaultInstallationPreferences,
  type InstallationPreferencesPatch,
  type InstallationSettings
} from '../../../shared/contracts/settings.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import { InstallationSettingsStore } from './installation-settings-store.js'
import { initializeCreatureSchema } from '../../creatures/catalog.js'
import { initializeLocationSymbolSchema } from '../../worldplanner/location-symbol-store.js'
import { initializeBiomeCatalogSchema } from '../../biomes/biome-catalog.js'
import { initializeWorldLocationSaveJournalSchema } from '../../worldplanner/world-location-save-journal.js'
import { initializeGeneratorPresetSchema } from './generator-preset-store.js'
import { initializeSessionGenerationSchema } from '../../session-generation/generated-run-store.js'
import { initializeLootSchema } from '../../loot/loot-schema.js'
import { initializeCharacterLootSchema } from '../../loot/character-loot-store.js'
import { initializeEncounterPlanSchema } from '../../encounter/encounter-plan-store.js'
import { initializeSessionPlannerSchema } from '../../session-planner/session-planner-store.js'
import { initializeCampaignRulesSchema } from '../../application/campaign-rules-service.js'
import type { IncompatibleDataPolicy } from '../../../shared/contracts/runtime.js'

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
  private readonly installationSettings: InstallationSettingsStore
  private activeCampaign: Database.Database | undefined
  private readonly onCreatePhase:
    ((phase: CampaignCreatePhase) => void) | undefined

  constructor(
    private readonly dataRoot: string,
    options: CampaignStoreOptions = {}
  ) {
    this.onCreatePhase = options.onCreatePhase
    const installationPath = join(dataRoot, 'installation.sqlite')
    const preflight = preflightPersistence(dataRoot)
    if (preflight.kind === 'migration-required')
      throw new IncompatibleDataError(dataRoot)
    const installationExists = preflight.kind === 'ready'
    mkdirSync(dirname(installationPath), { recursive: true })
    this.installation = new Database(installationPath)
    this.installationSettings = new InstallationSettingsStore(this.installation)
    try {
      configureSqlite(this.installation)
      if (installationExists)
        assertSchemaVersion(this.installation, this.dataRoot, 'installation')
      this.installation.exec(`
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
      CREATE TABLE IF NOT EXISTS installation_settings (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
        revision INTEGER NOT NULL CHECK(revision >= 0),
        preferences_json TEXT NOT NULL
      );
      `)
      initializeGeneratorPresetSchema(this.installation)
      this.installation
        .prepare(
          'INSERT OR IGNORE INTO installation_settings (singleton, revision, preferences_json) VALUES (1, 0, ?)'
        )
        .run(JSON.stringify(defaultInstallationPreferences))
      initializeCreatureSchema(this.installation)
      initializeBiomeCatalogSchema(this.installation)
      initializeLocationSymbolSchema(this.installation)
      if (!installationExists) {
        initializeInstallationSchemaMetadata(this.installation)
        initializeSchemaVersion(this.installation, 'installation')
      }
      this.recoverIncompleteCreations()
      this.recoverCampaignDirectoryTransitions()
      this.openRecordedActiveCampaign()
    } catch (error) {
      this.installation.close()
      throw error
    }
  }

  list(): CampaignSnapshot {
    const campaigns = this.installation
      .prepare(
        "SELECT id, name, created_at AS createdAt FROM campaigns WHERE status = 'ready' AND trashed_at IS NULL ORDER BY created_at ASC"
      )
      .all() as Campaign[]
    const trashedCampaigns = this.installation
      .prepare(
        "SELECT id, name, created_at AS createdAt, trashed_at AS trashedAt FROM campaigns WHERE status = 'ready' AND trashed_at IS NOT NULL ORDER BY trashed_at DESC"
      )
      .all() as CampaignSnapshot['trashedCampaigns']
    const active = this.installation
      .prepare("SELECT value FROM settings WHERE key = 'active_campaign_id'")
      .get() as { value: string } | undefined
    return freezeCampaignSnapshot({
      campaigns,
      trashedCampaigns: [...trashedCampaigns],
      activeCampaignId:
        active !== undefined &&
        campaigns.some((campaign) => campaign.id === active.value)
          ? active.value
          : null
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
      .prepare(
        "SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
      )
      .get(id)
    if (exists === undefined) throw new CapabilityError('not_found', false)
    this.switchActiveCampaign(id)
    this.setActive(id)
    return this.list()
  }

  rename(id: string, name: string): CampaignSnapshot {
    const result = this.installation
      .prepare(
        "UPDATE campaigns SET name = ? WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
      )
      .run(name, id)
    if (result.changes === 0) throw new CapabilityError('not_found', false)
    return this.list()
  }

  trash(id: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    const campaign = this.installation
      .prepare(
        "SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NULL"
      )
      .get(id)
    if (campaign === undefined) throw new CapabilityError('not_found', false)

    if (this.list().activeCampaignId === id) {
      this.activeCampaign?.close()
      this.activeCampaign = undefined
    }
    this.installation.transaction(() => {
      this.installation
        .prepare('UPDATE campaigns SET trashed_at = ? WHERE id = ?')
        .run(new Date().toISOString(), id)
      this.clearActive(id)
    })()
    this.moveDirectory(this.campaignDirectory(id), this.trashDirectory(id))
    return this.list()
  }

  restore(id: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    const campaign = this.installation
      .prepare(
        "SELECT 1 FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NOT NULL"
      )
      .get(id)
    if (campaign === undefined) throw new CapabilityError('not_found', false)

    this.moveDirectory(this.trashDirectory(id), this.campaignDirectory(id))
    const result = this.installation
      .prepare('UPDATE campaigns SET trashed_at = NULL WHERE id = ?')
      .run(id)
    if (result.changes === 0) throw new CapabilityError('not_found', false)
    return this.list()
  }

  deleteForever(id: string, confirmationName: string): CampaignSnapshot {
    this.requireSafeCampaignId(id)
    const campaign = this.installation
      .prepare(
        "SELECT name FROM campaigns WHERE id = ? AND status = 'ready' AND trashed_at IS NOT NULL"
      )
      .get(id) as { name: string } | undefined
    if (campaign === undefined) throw new CapabilityError('not_found', false)
    if (campaign.name !== confirmationName)
      throw new CapabilityError('validation_failed', false)

    this.moveDirectory(this.trashDirectory(id), this.deletingDirectory(id))
    this.installation.transaction(() => {
      this.clearActive(id)
      this.installation.prepare('DELETE FROM campaigns WHERE id = ?').run(id)
    })()
    rmSync(this.deletingDirectory(id), { recursive: true, force: true })
    return this.list()
  }

  readSettings(): InstallationSettings {
    return this.installationSettings.read()
  }

  updateSettings(
    patch: InstallationPreferencesPatch,
    expectedRevision: number
  ): InstallationSettings {
    return this.installationSettings.update(patch, expectedRevision)
  }

  close(): void {
    this.activeCampaign?.close()
    this.activeCampaign = undefined
    this.installation.close()
  }

  activeCampaignDatabase(): Database.Database {
    if (this.activeCampaign === undefined)
      throw new CapabilityError('not_found', false)
    return this.activeCampaign
  }

  installationDatabase(): Database.Database {
    return this.installation
  }

  visitCampaignDatabases<T>(
    visitor: (campaign: {
      id: string
      name: string
      trashed: boolean
      database: Database.Database
    }) => T
  ): T[] {
    const activeId = this.list().activeCampaignId
    const rows = this.installation
      .prepare(
        "SELECT id, name, trashed_at AS trashedAt FROM campaigns WHERE status = 'ready' ORDER BY created_at"
      )
      .all() as { id: string; name: string; trashedAt: string | null }[]
    return rows.map((row) => {
      if (row.id === activeId && this.activeCampaign)
        return visitor({
          id: row.id,
          name: row.name,
          trashed: false,
          database: this.activeCampaign
        })
      const path = row.trashedAt
        ? join(this.trashDirectory(row.id), 'campaign.sqlite')
        : this.campaignPath(row.id)
      const database = new Database(path)
      try {
        configureSqlite(database)
        assertSchemaVersion(database, undefined, 'campaign')
        return visitor({
          id: row.id,
          name: row.name,
          trashed: row.trashedAt !== null,
          database
        })
      } finally {
        database.close()
      }
    })
  }

  activeCampaignId(): string {
    const id = this.list().activeCampaignId
    if (id === null) throw new CapabilityError('not_found', false)
    return id
  }

  /** Diagnostic path used by integration fixtures and incompatibility reports. */
  activeCampaignPath(): string {
    const id = this.list().activeCampaignId
    if (id === null) throw new CapabilityError('not_found', false)
    return this.campaignPath(id)
  }

  private createStagedCampaignStore(id: string): void {
    const campaignPath = this.stagedCampaignPath(id)
    mkdirSync(dirname(campaignPath), { recursive: true })
    const campaign = new Database(campaignPath)
    configureSqlite(campaign)
    campaign.exec(
      'CREATE TABLE IF NOT EXISTS campaign_runtime (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
    )
    initializePartySchema(campaign)
    initializeSceneSchema(
      campaign,
      new PartyStore(campaign)
        .read()
        .members.filter((member) => member.active)
        .map((member) => member.id)
    )
    initializeCombatSchema(campaign)
    initializeWorldLocationSchema(campaign)
    initializeEncounterTableSchema(campaign)
    initializeWorldFactionSchema(campaign)
    initializeHexSchema(campaign)
    initializeWorldLocationSaveJournalSchema(campaign)
    initializeCampaignRulesSchema(campaign)
    initializeSessionGenerationSchema(campaign)
    initializeEncounterPlanSchema(campaign)
    initializeSessionPlannerSchema(campaign)
    initializeLootSchema(campaign)
    initializeCharacterLootSchema(campaign)
    initializeCampaignSchemaMetadata(campaign)
    initializeSchemaVersion(campaign, 'campaign')
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
    this.switchActiveCampaign(id)
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

  private recoverCampaignDirectoryTransitions(): void {
    const deletingParent = join(this.dataRoot, 'campaigns', '.deleting')
    if (existsSync(deletingParent))
      for (const id of readdirSync(deletingParent)) {
        if (!this.isSafeCampaignId(id)) continue
        this.installation.transaction(() => {
          this.clearActive(id)
          this.installation
            .prepare('DELETE FROM campaigns WHERE id = ?')
            .run(id)
        })()
        rmSync(this.deletingDirectory(id), { recursive: true, force: true })
      }

    const trashed = this.installation
      .prepare(
        "SELECT id FROM campaigns WHERE status = 'ready' AND trashed_at IS NOT NULL"
      )
      .all() as { id: string }[]
    for (const { id } of trashed) {
      if (!this.isSafeCampaignId(id))
        throw new Error('Unsafe campaign identifier in trash registry')
      const source = this.campaignDirectory(id)
      const destination = this.trashDirectory(id)
      if (existsSync(source) && existsSync(destination))
        throw new Error('Campaign exists in both active and trash storage')
      this.moveDirectory(source, destination)
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
      assertSchemaVersion(campaign, undefined, 'campaign')
      return (
        campaign
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'campaign_runtime'"
          )
          .get() !== undefined &&
        campaign.pragma('quick_check', { simple: true }) === 'ok'
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

  private trashDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.trash', id)
  }

  private deletingDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.deleting', id)
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

  private requireSafeCampaignId(id: string): void {
    if (!this.isSafeCampaignId(id))
      throw new CapabilityError('validation_failed', false)
  }

  private moveDirectory(source: string, destination: string): void {
    const sourceExists = existsSync(source)
    const destinationExists = existsSync(destination)
    if (!sourceExists && destinationExists) return
    if (!sourceExists || destinationExists)
      throw new Error('Campaign directory transition is inconsistent')
    mkdirSync(dirname(destination), { recursive: true })
    renameSync(source, destination)
  }

  private setActive(id: string): void {
    this.installation
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('active_campaign_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(id)
  }

  private clearActive(id: string): void {
    this.installation
      .prepare(
        "DELETE FROM settings WHERE key = 'active_campaign_id' AND value = ?"
      )
      .run(id)
  }

  private openRecordedActiveCampaign(): void {
    const id = this.list().activeCampaignId
    if (id !== null) {
      this.switchActiveCampaign(id)
      return
    }
    this.installation
      .prepare("DELETE FROM settings WHERE key = 'active_campaign_id'")
      .run()
  }

  private switchActiveCampaign(id: string): void {
    const next = new Database(this.campaignPath(id))
    try {
      configureSqlite(next)
      assertSchemaVersion(next, this.campaignDirectory(id), 'campaign')
    } catch (error) {
      next.close()
      throw error
    }
    this.activeCampaign?.close()
    this.activeCampaign = next
  }
}

/** The caller owns the data-retention decision; paths never imply policy. */
export function openCampaignStore(
  dataRoot: string,
  incompatibleDataPolicy: IncompatibleDataPolicy
): CampaignStore {
  try {
    return new CampaignStore(dataRoot)
  } catch (error) {
    if (!(error instanceof IncompatibleDataError)) throw error
    if (incompatibleDataPolicy === 'preserve') throw error
    rmSync(dataRoot, { recursive: true, force: true })
    console.info(
      JSON.stringify({
        component: 'campaign-store',
        event: 'schema-reset',
        schemaVersion: currentSchemaVersion
      })
    )
    return new CampaignStore(dataRoot)
  }
}
