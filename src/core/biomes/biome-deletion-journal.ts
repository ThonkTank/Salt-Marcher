import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export type PendingBiomeDeletion = Readonly<{
  commandId: string
  biomeId: string
  expectedRevision: number
}>

export class BiomeDeletionJournal {
  constructor(private readonly db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS biome_deletion (
        command_id TEXT PRIMARY KEY NOT NULL,
        biome_id TEXT NOT NULL,
        expected_revision INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('pending', 'completed'))
      );
      CREATE TABLE IF NOT EXISTS biome_deletion_campaign (
        command_id TEXT NOT NULL REFERENCES biome_deletion(command_id) ON DELETE CASCADE,
        campaign_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('pending', 'completed')),
        PRIMARY KEY (command_id, campaign_id)
      );
    `)
  }

  begin(job: PendingBiomeDeletion): void {
    const existing = this.db
      .prepare(
        `SELECT biome_id AS biomeId, expected_revision AS expectedRevision
         FROM biome_deletion WHERE command_id = ?`
      )
      .get(job.commandId) as
      { biomeId: string; expectedRevision: number } | undefined
    if (
      existing &&
      (existing.biomeId !== job.biomeId ||
        existing.expectedRevision !== job.expectedRevision)
    )
      throw new CapabilityError('validation_failed', false)
    if (!existing)
      this.db
        .prepare(
          `INSERT INTO biome_deletion
           (command_id, biome_id, expected_revision, state)
           VALUES (?, ?, ?, 'pending')`
        )
        .run(job.commandId, job.biomeId, job.expectedRevision)
  }

  beginCampaign(commandId: string, campaignId: string): boolean {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO biome_deletion_campaign
         (command_id, campaign_id, state) VALUES (?, ?, 'pending')`
      )
      .run(commandId, campaignId)
    const progress = this.db
      .prepare(
        `SELECT state FROM biome_deletion_campaign
         WHERE command_id = ? AND campaign_id = ?`
      )
      .get(commandId, campaignId) as { state: string }
    return progress.state !== 'completed'
  }

  completeCampaign(commandId: string, campaignId: string): void {
    this.db
      .prepare(
        `UPDATE biome_deletion_campaign SET state = 'completed'
         WHERE command_id = ? AND campaign_id = ?`
      )
      .run(commandId, campaignId)
  }

  complete(commandId: string): void {
    this.db
      .prepare(
        "UPDATE biome_deletion SET state = 'completed' WHERE command_id = ?"
      )
      .run(commandId)
  }

  pending(): readonly PendingBiomeDeletion[] {
    return this.db
      .prepare(
        `SELECT command_id AS commandId, biome_id AS biomeId,
                expected_revision AS expectedRevision
         FROM biome_deletion WHERE state = 'pending' ORDER BY rowid`
      )
      .all() as PendingBiomeDeletion[]
  }
}
