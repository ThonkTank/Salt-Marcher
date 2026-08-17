import type Database from 'better-sqlite3'
import {
  campaignImportBundleSchema,
  type CampaignImportBundle
} from '../../shared/contracts/campaign-import.js'

export function initializeCampaignImportInstallationSchema(
  db: Database.Database
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_import_registry (
      source_id TEXT PRIMARY KEY NOT NULL,
      campaign_external_key TEXT NOT NULL,
      campaign_id TEXT NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
      source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
      export_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

export function initializeCampaignImportSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_import_provenance (
      source_id TEXT PRIMARY KEY NOT NULL,
      campaign_external_key TEXT NOT NULL,
      bundle_version INTEGER NOT NULL,
      source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
      export_hash TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      resolutions_json TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaign_import_entity (
      source_id TEXT NOT NULL,
      entity_kind TEXT NOT NULL CHECK(entity_kind IN ('party', 'locations', 'factions', 'npcs')),
      external_key TEXT NOT NULL,
      internal_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      PRIMARY KEY (source_id, entity_kind, external_key),
      UNIQUE (source_id, entity_kind, internal_id)
    );
  `)
}

export interface PreviousCampaignImport {
  readonly campaignId: string
  readonly campaignExternalKey: string
  readonly revision: number
  readonly exportHash: string
}

export interface CampaignImportEntityMapping {
  readonly kind: 'party' | 'locations' | 'factions' | 'npcs'
  readonly externalKey: string
  readonly internalId: string
}

export class CampaignImportStore {
  constructor(private readonly installation: Database.Database) {}

  previous(sourceId: string): PreviousCampaignImport | null {
    const row = this.installation
      .prepare(
        `SELECT campaign_id AS campaignId,
                campaign_external_key AS campaignExternalKey,
                source_revision AS revision, export_hash AS exportHash
           FROM campaign_import_registry registry
           JOIN campaigns campaign ON campaign.id = registry.campaign_id
          WHERE registry.source_id = ? AND campaign.status = 'ready'
            AND campaign.trashed_at IS NULL`
      )
      .get(sourceId) as PreviousCampaignImport | undefined
    return row ?? null
  }

  recordRegistry(bundle: CampaignImportBundle, campaignId: string): void {
    const parsed = campaignImportBundleSchema.parse(bundle)
    this.installation
      .prepare(
        `INSERT INTO campaign_import_registry
          (source_id, campaign_external_key, campaign_id, source_revision, export_hash, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id) DO UPDATE SET
           campaign_external_key = excluded.campaign_external_key,
           campaign_id = excluded.campaign_id,
           source_revision = excluded.source_revision,
           export_hash = excluded.export_hash,
           updated_at = excluded.updated_at`
      )
      .run(
        parsed.source.id,
        parsed.campaign.externalKey,
        campaignId,
        parsed.source.revision,
        parsed.source.exportHash,
        new Date().toISOString()
      )
  }

  entityHashes(
    db: Database.Database,
    sourceId: string
  ): ReadonlyMap<string, string> {
    const rows = db
      .prepare(
        `SELECT entity_kind AS kind, external_key AS externalKey,
                content_hash AS contentHash
           FROM campaign_import_entity WHERE source_id = ?`
      )
      .all(sourceId) as Array<{
      kind: string
      externalKey: string
      contentHash: string
    }>
    return new Map(
      rows.map((row) => [`${row.kind}:${row.externalKey}`, row.contentHash])
    )
  }

  entityMappings(
    db: Database.Database,
    sourceId: string
  ): readonly CampaignImportEntityMapping[] {
    return db
      .prepare(
        `SELECT entity_kind AS kind, external_key AS externalKey,
                internal_id AS internalId
           FROM campaign_import_entity WHERE source_id = ?
           ORDER BY entity_kind, external_key`
      )
      .all(sourceId) as CampaignImportEntityMapping[]
  }

  recordProvenance(
    db: Database.Database,
    bundle: CampaignImportBundle,
    entities: readonly Readonly<{
      kind: 'party' | 'locations' | 'factions' | 'npcs'
      externalKey: string
      internalId: string
      sourcePath: string
      contentHash: string
    }>[]
  ): void {
    const parsed = campaignImportBundleSchema.parse(bundle)
    const appliedAt = new Date().toISOString()
    db.prepare(
      `INSERT INTO campaign_import_provenance
        (source_id, campaign_external_key, bundle_version, source_revision,
         export_hash, sections_json, resolutions_json, applied_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET
         campaign_external_key = excluded.campaign_external_key,
         bundle_version = excluded.bundle_version,
         source_revision = excluded.source_revision,
         export_hash = excluded.export_hash,
         sections_json = excluded.sections_json,
         resolutions_json = excluded.resolutions_json,
         applied_at = excluded.applied_at`
    ).run(
      parsed.source.id,
      parsed.campaign.externalKey,
      parsed.bundleVersion,
      parsed.source.revision,
      parsed.source.exportHash,
      JSON.stringify(parsed.source.sections),
      JSON.stringify(parsed.resolutions),
      appliedAt
    )
    db.prepare('DELETE FROM campaign_import_entity WHERE source_id = ?').run(
      parsed.source.id
    )
    const insert = db.prepare(
      `INSERT INTO campaign_import_entity
        (source_id, entity_kind, external_key, internal_id, source_path, content_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    for (const entity of entities)
      insert.run(
        parsed.source.id,
        entity.kind,
        entity.externalKey,
        entity.internalId,
        entity.sourcePath,
        entity.contentHash
      )
  }
}
