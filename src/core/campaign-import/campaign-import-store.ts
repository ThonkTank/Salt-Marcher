import type Database from 'better-sqlite3'
import { fingerprint } from '../fingerprint.js'
import {
  campaignImportBundleSchema,
  type CampaignImportBundle
} from '../../shared/contracts/campaign-import.js'
import { z } from 'zod'

export const campaignImportSagaPhaseSchema = z.enum([
  'planned',
  'staging',
  'campaign_replaced',
  'registry_committed',
  'complete',
  'failed'
])

export type CampaignImportSagaPhase = z.infer<
  typeof campaignImportSagaPhaseSchema
>

export const campaignImportSagaReceiptSchema = z
  .object({
    importId: z.uuid(),
    sourceId: z.string().min(1),
    sourceRevision: z.number().int().nonnegative(),
    exportHash: z.string().regex(/^[0-9a-f]{64}$/),
    targetCampaignId: z.uuid(),
    previousActiveCampaignId: z.uuid().nullable(),
    previousCampaignFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    replacementCampaignFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    phase: campaignImportSagaPhaseSchema,
    bundle: campaignImportBundleSchema,
    sectionPlans: z.record(z.string(), z.unknown()),
    sectionResults: z.record(z.string(), z.unknown()),
    directoryTransition: z.unknown().nullable(),
    quickCheck: z.literal('ok').nullable(),
    domainReadbacks: z.array(
      z
        .object({
          name: z.string().min(1),
          expected: z.unknown(),
          actual: z.unknown(),
          passed: z.boolean()
        })
        .strict()
    ),
    terminalResult: z.enum(['applied', 'recovered', 'rolled_back']).nullable(),
    error: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export type CampaignImportSagaReceipt = Readonly<
  z.infer<typeof campaignImportSagaReceiptSchema>
>

export function initializeCampaignImportInstallationSchema(
  db: Database.Database
): void {
  initializeCampaignImportRegistrySchema(db)
  initializeCampaignImportSagaSchema(db)
}

export function initializeCampaignImportRegistrySchema(
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

export function initializeCampaignImportSagaSchema(
  db: Database.Database
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_import_saga (
      import_id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
      export_hash TEXT NOT NULL,
      target_campaign_id TEXT NOT NULL,
      previous_active_campaign_id TEXT,
      previous_campaign_fingerprint TEXT,
      replacement_campaign_fingerprint TEXT,
      phase TEXT NOT NULL CHECK(phase IN ('planned', 'staging', 'campaign_replaced', 'registry_committed', 'complete', 'failed')),
      bundle_json TEXT NOT NULL,
      section_plans_json TEXT NOT NULL,
      section_results_json TEXT NOT NULL,
      directory_transition_json TEXT,
      quick_check TEXT CHECK(quick_check IS NULL OR quick_check = 'ok'),
      domain_readbacks_json TEXT NOT NULL,
      terminal_result TEXT CHECK(terminal_result IS NULL OR terminal_result IN ('applied', 'recovered', 'rolled_back')),
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS campaign_import_saga_pending
      ON campaign_import_saga(phase, updated_at);
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

export interface CampaignImportProvenance {
  readonly sourceId: string
  readonly sourceRevision: number
  readonly exportHash: string
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

  beginSaga(input: {
    importId: string
    bundle: CampaignImportBundle
    targetCampaignId: string
    previousActiveCampaignId: string | null
    previousCampaignFingerprint: string | null
    sectionPlans: Readonly<Record<string, unknown>>
  }): CampaignImportSagaReceipt {
    const bundle = campaignImportBundleSchema.parse(input.bundle)
    const timestamp = new Date().toISOString()
    this.installation
      .prepare(
        `INSERT INTO campaign_import_saga
          (import_id, source_id, source_revision, export_hash,
           target_campaign_id, previous_active_campaign_id,
           previous_campaign_fingerprint,
           replacement_campaign_fingerprint, phase, bundle_json,
           section_plans_json, section_results_json,
           directory_transition_json, quick_check, domain_readbacks_json,
           terminal_result, error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'planned', ?, ?, '{}', NULL, NULL,
                 '[]', NULL, NULL, ?, ?)`
      )
      .run(
        input.importId,
        bundle.source.id,
        bundle.source.revision,
        bundle.source.exportHash,
        input.targetCampaignId,
        input.previousActiveCampaignId,
        input.previousCampaignFingerprint,
        JSON.stringify(bundle),
        JSON.stringify(input.sectionPlans),
        timestamp,
        timestamp
      )
    return this.requireSaga(input.importId)
  }

  advanceSaga(
    importId: string,
    expected: CampaignImportSagaPhase,
    phase: CampaignImportSagaPhase,
    evidence: Partial<
      Pick<
        CampaignImportSagaReceipt,
        | 'replacementCampaignFingerprint'
        | 'sectionResults'
        | 'directoryTransition'
        | 'quickCheck'
        | 'domainReadbacks'
        | 'terminalResult'
        | 'error'
      >
    > = {}
  ): CampaignImportSagaReceipt {
    const current = this.requireSaga(importId)
    if (current.phase !== expected)
      throw new Error(
        `Campaign import saga ${importId} expected ${expected}, got ${current.phase}`
      )
    const next = campaignImportSagaReceiptSchema.parse({
      ...current,
      ...evidence,
      phase,
      updatedAt: new Date().toISOString()
    })
    const result = this.installation
      .prepare(
        `UPDATE campaign_import_saga
            SET replacement_campaign_fingerprint = ?, phase = ?,
                section_results_json = ?, directory_transition_json = ?,
                quick_check = ?, domain_readbacks_json = ?,
                terminal_result = ?, error = ?, updated_at = ?
          WHERE import_id = ? AND phase = ?`
      )
      .run(
        next.replacementCampaignFingerprint,
        next.phase,
        JSON.stringify(next.sectionResults),
        next.directoryTransition === null
          ? null
          : JSON.stringify(next.directoryTransition),
        next.quickCheck,
        JSON.stringify(next.domainReadbacks),
        next.terminalResult,
        next.error,
        next.updatedAt,
        importId,
        expected
      )
    if (result.changes !== 1)
      throw new Error('Campaign import saga phase changed concurrently')
    return next
  }

  pendingSagas(): readonly CampaignImportSagaReceipt[] {
    return (
      this.installation
        .prepare(
          "SELECT * FROM campaign_import_saga WHERE phase NOT IN ('complete', 'failed') ORDER BY created_at"
        )
        .all() as CampaignImportSagaRow[]
    ).map(parseSagaRow)
  }

  saga(importId: string): CampaignImportSagaReceipt | null {
    const row = this.installation
      .prepare('SELECT * FROM campaign_import_saga WHERE import_id = ?')
      .get(importId) as CampaignImportSagaRow | undefined
    return row ? parseSagaRow(row) : null
  }

  latestSagaForSource(sourceId: string): CampaignImportSagaReceipt | null {
    const row = this.installation
      .prepare(
        `SELECT * FROM campaign_import_saga WHERE source_id = ?
         ORDER BY created_at DESC, import_id DESC LIMIT 1`
      )
      .get(sourceId) as CampaignImportSagaRow | undefined
    return row ? parseSagaRow(row) : null
  }

  commitRegistryForSaga(importId: string): CampaignImportSagaReceipt {
    const saga = this.requireSaga(importId)
    if (saga.phase !== 'campaign_replaced')
      throw new Error(`Campaign import saga cannot commit from ${saga.phase}`)
    this.installation.transaction(() => {
      // New work is registered atomically by CampaignLifecycleCoordinator.
      // Missing registration identifies a pre-coordinator pending saga and is
      // reconciled here so schema-35 recovery remains lossless.
      if (!this.registryMatchesSaga(importId))
        this.recordRegistry(saga.bundle, saga.targetCampaignId)
      this.advanceSaga(importId, 'campaign_replaced', 'registry_committed')
    })()
    return this.requireSaga(importId)
  }

  recordRegistryForSaga(importId: string): void {
    const saga = this.requireSaga(importId)
    this.recordRegistry(saga.bundle, saga.targetCampaignId)
  }

  registryMatchesSaga(importId: string): boolean {
    const saga = this.requireSaga(importId)
    const previous = this.previous(saga.sourceId)
    return (
      previous?.campaignId === saga.targetCampaignId &&
      previous.revision === saga.sourceRevision &&
      previous.exportHash === saga.exportHash
    )
  }

  completeSaga(
    importId: string,
    terminalResult: 'applied' | 'recovered'
  ): CampaignImportSagaReceipt {
    return this.advanceSaga(importId, 'registry_committed', 'complete', {
      terminalResult
    })
  }

  failSaga(
    importId: string,
    error: string,
    terminalResult: 'rolled_back' = 'rolled_back'
  ): CampaignImportSagaReceipt {
    const current = this.requireSaga(importId)
    if (current.phase === 'complete' || current.phase === 'failed')
      return current
    return this.advanceSaga(importId, current.phase, 'failed', {
      error,
      terminalResult
    })
  }

  private requireSaga(importId: string): CampaignImportSagaReceipt {
    const saga = this.saga(importId)
    if (!saga) throw new Error(`Campaign import saga not found: ${importId}`)
    return saga
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

  provenance(
    db: Database.Database,
    sourceId: string
  ): CampaignImportProvenance | null {
    const row = db
      .prepare(
        `SELECT source_id AS sourceId, source_revision AS sourceRevision,
                export_hash AS exportHash
           FROM campaign_import_provenance WHERE source_id = ?`
      )
      .get(sourceId) as CampaignImportProvenance | undefined
    return row ?? null
  }

  campaignFingerprint(db: Database.Database, sourceId: string): string | null {
    const provenance = this.provenance(db, sourceId)
    if (!provenance) return null
    const entities = db
      .prepare(
        `SELECT entity_kind AS kind, external_key AS externalKey,
                internal_id AS internalId, content_hash AS contentHash
           FROM campaign_import_entity WHERE source_id = ?
           ORDER BY entity_kind, external_key`
      )
      .all(sourceId)
    return fingerprint({ provenance, entities })
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

interface CampaignImportSagaRow {
  import_id: string
  source_id: string
  source_revision: number
  export_hash: string
  target_campaign_id: string
  previous_active_campaign_id: string | null
  previous_campaign_fingerprint: string | null
  replacement_campaign_fingerprint: string | null
  phase: string
  bundle_json: string
  section_plans_json: string
  section_results_json: string
  directory_transition_json: string | null
  quick_check: string | null
  domain_readbacks_json: string
  terminal_result: string | null
  error: string | null
  created_at: string
  updated_at: string
}

function parseSagaRow(row: CampaignImportSagaRow): CampaignImportSagaReceipt {
  return campaignImportSagaReceiptSchema.parse({
    importId: row.import_id,
    sourceId: row.source_id,
    sourceRevision: row.source_revision,
    exportHash: row.export_hash,
    targetCampaignId: row.target_campaign_id,
    previousActiveCampaignId: row.previous_active_campaign_id,
    previousCampaignFingerprint: row.previous_campaign_fingerprint,
    replacementCampaignFingerprint: row.replacement_campaign_fingerprint,
    phase: row.phase,
    bundle: JSON.parse(row.bundle_json) as unknown,
    sectionPlans: JSON.parse(row.section_plans_json) as unknown,
    sectionResults: JSON.parse(row.section_results_json) as unknown,
    directoryTransition:
      row.directory_transition_json === null
        ? null
        : (JSON.parse(row.directory_transition_json) as unknown),
    quickCheck: row.quick_check,
    domainReadbacks: JSON.parse(row.domain_readbacks_json) as unknown,
    terminalResult: row.terminal_result,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}
