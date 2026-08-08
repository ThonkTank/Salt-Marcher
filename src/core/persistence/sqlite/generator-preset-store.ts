import type Database from 'better-sqlite3'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import {
  defaultGeneratorConfig,
  generatorPresetSchema,
  generatorPresetSnapshotSchema,
  legacySystemGeneratorPresetId,
  systemGeneratorPresetId,
  type GeneratorConfig,
  type GeneratorPresetSnapshot
} from '../../../shared/contracts/generator-presets.js'

export function initializeGeneratorPresetSchema(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS generator_presets (id TEXT PRIMARY KEY, name TEXT NOT NULL, schema_version INTEGER NOT NULL, protected INTEGER NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, config_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS campaign_generator_presets (campaign_id TEXT PRIMARY KEY, preset_id TEXT NOT NULL REFERENCES generator_presets(id) ON DELETE RESTRICT);`)
  const migrateLegacySystemPreset = db.transaction(() => {
    db.prepare(
      'UPDATE campaign_generator_presets SET preset_id=? WHERE preset_id=?'
    ).run(systemGeneratorPresetId, legacySystemGeneratorPresetId)
    db.prepare('UPDATE generator_presets SET id=? WHERE id=?').run(
      systemGeneratorPresetId,
      legacySystemGeneratorPresetId
    )
  })
  migrateLegacySystemPreset()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT OR IGNORE INTO generator_presets (id,name,schema_version,protected,revision,created_at,updated_at,config_json) VALUES (?,?,?,?,?,?,?,?)'
  ).run(
    systemGeneratorPresetId,
    'System-Default',
    1,
    1,
    0,
    now,
    now,
    JSON.stringify(defaultGeneratorConfig)
  )
}

export class GeneratorPresetStore {
  constructor(private readonly db: Database.Database) {
    initializeGeneratorPresetSchema(db)
  }
  read(activeCampaignId: string | null): GeneratorPresetSnapshot {
    const rows = this.db
      .prepare(
        'SELECT id,name,schema_version AS schemaVersion,revision,protected,created_at AS createdAt,updated_at AS updatedAt,config_json AS configJson FROM generator_presets ORDER BY protected DESC, name ASC'
      )
      .all() as Array<Record<string, unknown>>
    const presets = rows.map((row) => parsePresetRow(row))
    const assignments = this.db
      .prepare(
        'SELECT campaign_id AS campaignId,preset_id AS presetId FROM campaign_generator_presets'
      )
      .all() as Array<{ campaignId: string; presetId: string }>
    const assignment = activeCampaignId
      ? assignments.find((a) => a.campaignId === activeCampaignId)
      : undefined
    const revision = presets.reduce((max, p) => Math.max(max, p.revision), 0)
    return generatorPresetSnapshotSchema.parse({
      revision,
      presets,
      assignments,
      activeCampaignId,
      activePresetId: assignment?.presetId ?? null
    })
  }
  create(
    name: string,
    config: GeneratorConfig,
    expectedRevision: number,
    activeCampaignId: string | null
  ) {
    this.assertRevision(expectedRevision)
    const id = uuidv7()
    const now = new Date().toISOString()
    this.db
      .prepare('INSERT INTO generator_presets VALUES (?,?,?,?,?,?,?,?)')
      .run(id, name, 1, 0, 0, now, now, JSON.stringify(config))
    return this.read(activeCampaignId)
  }
  update(
    id: string,
    name: string,
    config: GeneratorConfig,
    expectedRevision: number,
    activeCampaignId: string | null
  ) {
    this.assertRevision(expectedRevision)
    const current = this.get(id)
    if (current.protected) throw new CapabilityError('validation_failed', false)
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        'UPDATE generator_presets SET name=?,config_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?'
      )
      .run(name, JSON.stringify(config), now, id, current.revision)
    if (result.changes !== 1) throw new CapabilityError('stale', true)
    return this.read(activeCampaignId)
  }
  delete(
    id: string,
    expectedRevision: number,
    activeCampaignId: string | null
  ) {
    this.assertRevision(expectedRevision)
    const current = this.get(id)
    if (current.protected) throw new CapabilityError('validation_failed', false)
    this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM campaign_generator_presets WHERE preset_id=?')
        .run(id)
      this.db.prepare('DELETE FROM generator_presets WHERE id=?').run(id)
    })()
    return this.read(activeCampaignId)
  }
  assign(
    campaignId: string,
    presetId: string | null,
    expectedRevision: number,
    activeCampaignId: string | null
  ) {
    this.assertRevision(expectedRevision)
    if (presetId) this.get(presetId)
    this.db
      .prepare(
        'INSERT INTO campaign_generator_presets(campaign_id,preset_id) VALUES(?,?) ON CONFLICT(campaign_id) DO UPDATE SET preset_id=excluded.preset_id'
      )
      .run(campaignId, presetId ?? systemGeneratorPresetId)
    return this.read(activeCampaignId)
  }
  configFor(campaignId: string | null): {
    config: GeneratorConfig
    id: string
    revision: number
  } {
    const snap = this.read(campaignId)
    const id = snap.activePresetId ?? systemGeneratorPresetId
    const preset =
      snap.presets.find((p) => p.id === id) ??
      snap.presets.find((p) => p.id === systemGeneratorPresetId)!
    return { config: preset.config, id: preset.id, revision: preset.revision }
  }
  private get(id: string) {
    const row = this.db
      .prepare(
        'SELECT id,name,schema_version AS schemaVersion,revision,protected,created_at AS createdAt,updated_at AS updatedAt,config_json AS configJson FROM generator_presets WHERE id=?'
      )
      .get(id) as Record<string, unknown> | undefined
    if (!row) throw new CapabilityError('not_found', false)
    return parsePresetRow(row)
  }
  private assertRevision(expected: number) {
    const rows = this.db
      .prepare('SELECT revision FROM generator_presets')
      .all() as Array<{ revision: number }>
    const current = rows.reduce((m, r) => Math.max(m, r.revision), 0)
    if (current !== expected) throw new CapabilityError('stale', true)
  }
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown
}

function parsePresetRow(row: Record<string, unknown>) {
  return generatorPresetSchema.parse({
    id: row['id'],
    name: row['name'],
    schemaVersion: row['schemaVersion'],
    revision: row['revision'],
    protected: row['protected'] === 1,
    createdAt: row['createdAt'],
    updatedAt: row['updatedAt'],
    config: parseJson(row['configJson'] as string)
  })
}
