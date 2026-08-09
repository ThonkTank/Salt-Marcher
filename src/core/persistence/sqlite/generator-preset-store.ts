import type Database from 'better-sqlite3'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import {
  assignGeneratorPresetReceiptSchema,
  createGeneratorPresetReceiptSchema,
  deleteGeneratorPresetReceiptSchema,
  generatorPresetCommandReceiptSchema,
  generatorPresetEditorSnapshotSchema,
  generatorPresetRegistrySchema,
  generatorPresetSchema,
  generatorPresetSchemaVersion,
  systemGeneratorPresetId,
  updateGeneratorPresetReceiptSchema,
  type AssignGeneratorPresetCommand,
  type AssignGeneratorPresetReceipt,
  type CreateGeneratorPresetCommand,
  type CreateGeneratorPresetReceipt,
  type DeleteGeneratorPresetCommand,
  type DeleteGeneratorPresetReceipt,
  type GeneratorPresetConfigV3,
  type GeneratorPresetCommandReceipt,
  type GeneratorPresetEditorSnapshot,
  type GeneratorPresetRegistry,
  type UpdateGeneratorPresetCommand,
  type UpdateGeneratorPresetReceipt
} from '../../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../../shared/generator/system-generator-preset.js'

const commandReceiptLimit = 512

export function initializeGeneratorPresetSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generator_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      protected INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      config_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaign_generator_presets (
      campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
      preset_id TEXT NOT NULL REFERENCES generator_presets(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS generator_preset_registry (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1),
      revision INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generator_preset_commands (
      command_id TEXT PRIMARY KEY,
      operation_kind TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO generator_preset_registry(singleton,revision) VALUES(1,0);
  `)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT OR IGNORE INTO generator_presets
      (id,name,schema_version,protected,revision,created_at,updated_at,config_json)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    systemGeneratorPresetId,
    'System-Default',
    generatorPresetSchemaVersion,
    1,
    0,
    now,
    now,
    JSON.stringify(defaultGeneratorConfig)
  )
}

export class GeneratorPresetStore {
  constructor(private readonly db: Database.Database) {}

  readEditor(activeCampaignId: string | null): GeneratorPresetEditorSnapshot {
    const registry = this.registry()
    const assignedPresetId = activeCampaignId
      ? this.assignedPresetId(activeCampaignId)
      : null
    return deepFreeze(
      generatorPresetEditorSnapshotSchema.parse({
        registry,
        assignment: activeCampaignId
          ? {
              campaignId: activeCampaignId,
              assignedPresetId,
              effectivePresetId: assignedPresetId ?? systemGeneratorPresetId
            }
          : null
      })
    )
  }

  registry(): GeneratorPresetRegistry {
    const rows = this.db
      .prepare(
        `SELECT id,name,schema_version AS schemaVersion,revision,protected,
          created_at AS createdAt,updated_at AS updatedAt,config_json AS configJson
         FROM generator_presets ORDER BY protected DESC, name ASC, id ASC`
      )
      .all() as Array<Record<string, unknown>>
    return deepFreeze(
      generatorPresetRegistrySchema.parse({
        revision: this.registryRevision(),
        presets: rows.map(parsePresetRow)
      })
    )
  }

  create(input: CreateGeneratorPresetCommand): CreateGeneratorPresetReceipt {
    const receipt = this.db.transaction(() => {
      const existing = this.existingReceipt(input.commandId, 'created')
      if (existing) return createGeneratorPresetReceiptSchema.parse(existing)
      this.assertRevision(input.expectedRegistryRevision)
      const id = uuidv7()
      const now = new Date().toISOString()
      this.db
        .prepare(
          `INSERT INTO generator_presets
            (id,name,schema_version,protected,revision,created_at,updated_at,config_json)
           VALUES (?,?,?,?,?,?,?,?)`
        )
        .run(
          id,
          input.name,
          generatorPresetSchemaVersion,
          0,
          0,
          now,
          now,
          JSON.stringify(input.config)
        )
      this.bumpRegistry(input.expectedRegistryRevision)
      const saved = this.get(id)
      const next = createGeneratorPresetReceiptSchema.parse({
        kind: 'created',
        commandId: input.commandId,
        registry: this.registry(),
        saved
      })
      this.writeReceipt(next)
      return next
    })()
    return deepFreeze(receipt)
  }

  update(input: UpdateGeneratorPresetCommand): UpdateGeneratorPresetReceipt {
    const receipt = this.db.transaction(() => {
      const existing = this.existingReceipt(input.commandId, 'updated')
      if (existing) return updateGeneratorPresetReceiptSchema.parse(existing)
      this.assertRevision(input.expectedRegistryRevision)
      const current = this.get(input.id)
      if (current.protected)
        throw new CapabilityError('validation_failed', false)
      const now = new Date().toISOString()
      const result = this.db
        .prepare(
          `UPDATE generator_presets
           SET name=?,config_json=?,revision=revision+1,updated_at=?
           WHERE id=? AND revision=?`
        )
        .run(
          input.name,
          JSON.stringify(input.config),
          now,
          input.id,
          current.revision
        )
      if (result.changes !== 1) throw new CapabilityError('stale', true)
      this.bumpRegistry(input.expectedRegistryRevision)
      const next = updateGeneratorPresetReceiptSchema.parse({
        kind: 'updated',
        commandId: input.commandId,
        registry: this.registry(),
        saved: this.get(input.id)
      })
      this.writeReceipt(next)
      return next
    })()
    return deepFreeze(receipt)
  }

  delete(input: DeleteGeneratorPresetCommand): DeleteGeneratorPresetReceipt {
    const receipt = this.db.transaction(() => {
      const existing = this.existingReceipt(input.commandId, 'deleted')
      if (existing) return deleteGeneratorPresetReceiptSchema.parse(existing)
      this.assertRevision(input.expectedRegistryRevision)
      const current = this.get(input.id)
      if (current.protected)
        throw new CapabilityError('validation_failed', false)
      const affectedCampaignIds = (
        this.db
          .prepare(
            'SELECT campaign_id AS campaignId FROM campaign_generator_presets WHERE preset_id=? ORDER BY campaign_id'
          )
          .all(input.id) as Array<{ campaignId: string }>
      ).map((row) => row.campaignId)
      this.db
        .prepare('DELETE FROM campaign_generator_presets WHERE preset_id=?')
        .run(input.id)
      this.db.prepare('DELETE FROM generator_presets WHERE id=?').run(input.id)
      this.bumpRegistry(input.expectedRegistryRevision)
      const next = deleteGeneratorPresetReceiptSchema.parse({
        kind: 'deleted',
        commandId: input.commandId,
        registry: this.registry(),
        deletedId: input.id,
        affectedCampaignIds
      })
      this.writeReceipt(next)
      return next
    })()
    return deepFreeze(receipt)
  }

  assign(input: AssignGeneratorPresetCommand): AssignGeneratorPresetReceipt {
    const receipt = this.db.transaction(() => {
      const existing = this.existingReceipt(input.commandId, 'assigned')
      if (existing) return assignGeneratorPresetReceiptSchema.parse(existing)
      this.assertRevision(input.expectedRegistryRevision)
      const presetId =
        input.presetId === systemGeneratorPresetId ? null : input.presetId
      if (presetId) this.get(presetId)
      const existingPresetId = this.assignedPresetId(input.campaignId)
      if (presetId === null) {
        if (existingPresetId)
          this.db
            .prepare(
              'DELETE FROM campaign_generator_presets WHERE campaign_id=?'
            )
            .run(input.campaignId)
      } else if (existingPresetId !== presetId) {
        this.db
          .prepare(
            `INSERT INTO campaign_generator_presets(campaign_id,preset_id)
             VALUES(?,?) ON CONFLICT(campaign_id)
             DO UPDATE SET preset_id=excluded.preset_id`
          )
          .run(input.campaignId, presetId)
      }
      if (existingPresetId !== presetId)
        this.bumpRegistry(input.expectedRegistryRevision)
      const assignedPresetId = this.assignedPresetId(input.campaignId)
      const effectivePreset = this.get(
        assignedPresetId ?? systemGeneratorPresetId
      )
      const next = assignGeneratorPresetReceiptSchema.parse({
        kind: 'assigned',
        commandId: input.commandId,
        registry: this.registry(),
        assignment: {
          campaignId: input.campaignId,
          assignedPresetId,
          effectivePresetId: assignedPresetId ?? systemGeneratorPresetId
        },
        effectivePreset
      })
      this.writeReceipt(next)
      return next
    })()
    return deepFreeze(receipt)
  }

  commandReceipt(commandId: string): GeneratorPresetCommandReceipt | null {
    const row = this.db
      .prepare(
        'SELECT receipt_json AS receiptJson FROM generator_preset_commands WHERE command_id=?'
      )
      .get(commandId) as { receiptJson: string } | undefined
    return row
      ? deepFreeze(
          generatorPresetCommandReceiptSchema.parse(parseJson(row.receiptJson))
        )
      : null
  }

  configFor(campaignId: string | null): {
    config: GeneratorPresetConfigV3
    id: string
    revision: number
  } {
    const id = campaignId
      ? (this.assignedPresetId(campaignId) ?? systemGeneratorPresetId)
      : systemGeneratorPresetId
    const preset = this.get(id)
    return { config: preset.config, id: preset.id, revision: preset.revision }
  }

  private get(id: string) {
    const row = this.db
      .prepare(
        `SELECT id,name,schema_version AS schemaVersion,revision,protected,
          created_at AS createdAt,updated_at AS updatedAt,config_json AS configJson
         FROM generator_presets WHERE id=?`
      )
      .get(id) as Record<string, unknown> | undefined
    if (!row) throw new CapabilityError('not_found', false)
    return parsePresetRow(row)
  }

  private assignedPresetId(campaignId: string): string | null {
    const row = this.db
      .prepare(
        'SELECT preset_id AS presetId FROM campaign_generator_presets WHERE campaign_id=?'
      )
      .get(campaignId) as { presetId: string } | undefined
    return row?.presetId ?? null
  }

  private assertRevision(expected: number): void {
    if (this.registryRevision() !== expected)
      throw new CapabilityError('stale', true)
  }

  private registryRevision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM generator_preset_registry WHERE singleton=1'
        )
        .get() as { revision: number }
    ).revision
  }

  private bumpRegistry(expected: number): void {
    const result = this.db
      .prepare(
        `UPDATE generator_preset_registry SET revision=revision+1
         WHERE singleton=1 AND revision=?`
      )
      .run(expected)
    if (result.changes !== 1) throw new CapabilityError('stale', true)
  }

  private existingReceipt(
    commandId: string,
    expectedKind: GeneratorPresetCommandReceipt['kind']
  ): GeneratorPresetCommandReceipt | null {
    const receipt = this.commandReceipt(commandId)
    if (receipt && receipt.kind !== expectedKind)
      throw new CapabilityError('validation_failed', false)
    return receipt
  }

  private writeReceipt(receipt: GeneratorPresetCommandReceipt): void {
    this.db
      .prepare(
        `INSERT INTO generator_preset_commands
          (command_id,operation_kind,receipt_json,created_at) VALUES(?,?,?,?)`
      )
      .run(
        receipt.commandId,
        receipt.kind,
        JSON.stringify(receipt),
        new Date().toISOString()
      )
    this.db
      .prepare(
        `DELETE FROM generator_preset_commands WHERE command_id IN (
        SELECT command_id FROM generator_preset_commands
        ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ${commandReceiptLimit}
      )`
      )
      .run()
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
