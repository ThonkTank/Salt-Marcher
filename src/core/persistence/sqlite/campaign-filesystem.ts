import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { assertSchemaVersion, configureSqlite } from './database.js'
import type { CampaignSchemaBootstrapper } from './campaign-schema-bootstrapper.js'

const safeCampaignId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSafeCampaignId(id: string): boolean {
  return safeCampaignId.test(id)
}

/** Owns campaign storage layout and non-transactional file operations. */
export class CampaignFilesystem {
  constructor(
    private readonly dataRoot: string,
    private readonly schemaBootstrapper: CampaignSchemaBootstrapper
  ) {}

  campaignDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', id)
  }

  trashDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.trash', id)
  }

  campaignPath(id: string): string {
    return join(this.campaignDirectory(id), 'campaign.sqlite')
  }

  stagedCampaignDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.creating', id)
  }

  stagedCampaignPath(id: string): string {
    return join(this.stagedCampaignDirectory(id), 'campaign.sqlite')
  }

  createStagedCampaign(id: string): void {
    const path = this.stagedCampaignPath(id)
    mkdirSync(dirname(path), { recursive: true })
    const campaign = new Database(path)
    try {
      configureSqlite(campaign)
      this.schemaBootstrapper.initialize(campaign)
    } finally {
      campaign.close()
    }
  }

  cloneCampaignToStage(id: string, source: Database.Database): void {
    const stagedPath = this.stagedCampaignPath(id)
    mkdirSync(dirname(stagedPath), { recursive: true })
    configureSqlite(source)
    assertSchemaVersion(source, this.campaignDirectory(id), 'campaign')
    source.pragma('wal_checkpoint(FULL)')
    copyFileSync(this.campaignPath(id), stagedPath)
  }

  promoteStagedCreation(id: string): void {
    const staged = this.stagedCampaignDirectory(id)
    const current = this.campaignDirectory(id)
    if (existsSync(staged) && !existsSync(current)) renameSync(staged, current)
    if (!this.isValidCampaignStore(this.campaignPath(id)))
      throw new Error('Campaign store creation did not complete')
  }

  moveCampaignToTrash(id: string): void {
    this.moveDirectory(this.campaignDirectory(id), this.trashDirectory(id))
  }

  restoreCampaignFromTrash(id: string): void {
    this.moveDirectory(this.trashDirectory(id), this.campaignDirectory(id))
  }

  stageTrashForDeletion(id: string): void {
    this.moveDirectory(this.trashDirectory(id), this.deletingDirectory(id))
  }

  finishDeletion(id: string): void {
    rmSync(this.deletingDirectory(id), { recursive: true, force: true })
  }

  discardStagedCampaign(id: string): void {
    rmSync(this.stagedCampaignDirectory(id), { recursive: true, force: true })
  }

  discardCurrentCampaign(id: string): void {
    rmSync(this.campaignDirectory(id), { recursive: true, force: true })
  }

  discardIncompleteCampaign(id: string): void {
    this.discardStagedCampaign(id)
    this.discardCurrentCampaign(id)
    try {
      rmdirSync(join(this.dataRoot, 'campaigns', '.creating'))
    } catch {
      // Another incomplete creation may still own the shared staging parent.
    }
  }

  legacyReplacementIds(): readonly string[] {
    return this.childNames(join(this.dataRoot, 'campaigns', '.replacing'))
  }

  pendingDeletionIds(): readonly string[] {
    return this.childNames(join(this.dataRoot, 'campaigns', '.deleting'))
  }

  assertAndConvergeTrashedCampaign(id: string): void {
    const source = this.campaignDirectory(id)
    const destination = this.trashDirectory(id)
    if (existsSync(source) && existsSync(destination))
      throw new Error('Campaign exists in both active and trash storage')
    this.moveDirectory(source, destination)
  }

  isValidCampaignStore(path: string): boolean {
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

  private deletingDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.deleting', id)
  }

  private childNames(parent: string): readonly string[] {
    return existsSync(parent) ? readdirSync(parent).sort() : []
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
}

/** The caller owns the data-retention decision; paths never imply policy. */
export function resetPersistenceRoot(dataRoot: string): void {
  rmSync(dataRoot, { recursive: true, force: true })
}
