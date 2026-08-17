import type Database from 'better-sqlite3'
import {
  itemDefinitionSchema,
  type ItemDefinition,
  type ItemReference
} from '../../shared/contracts/loot.js'

type OldGeneratedItem = Readonly<{
  runId: string
  treasureId: string
  id: string
  position: number
  catalogItemId: string | null
  role: string
  name: string
  modifier: string | null
  quantity: number
  unitValueCp: number
  stackable: number
  magic: number
  rarity: ItemDefinition['rarity']
  curseName: string | null
  curseEffect: string | null
  containerId: string | null
  capacity: number
}>

export function migrateLootSchema30To31(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loot_legacy_item_definition (
      definition_id TEXT PRIMARY KEY NOT NULL,
      definition_json TEXT NOT NULL
    );
  `)
  migrateGeneratedItems(db)
  migrateGenerationAudits(db)
  migrateTreasureItems(db)
  migrateLedgerItems(db)
  // Schema-30 receipts contain result projections with copied item facts and
  // cannot be replayed against schema-31 contracts. Preserve the opaque rows
  // for diagnosis while freeing the canonical name for the current schema.
  if (tableExists(db, 'loot_operation_receipt'))
    db.exec(
      'ALTER TABLE loot_operation_receipt RENAME TO loot_operation_receipt_v30_archive'
    )
}

function migrateGenerationAudits(db: Database.Database): void {
  if (
    !tableExists(db, 'session_generation_audit') ||
    !tableExists(db, 'session_generation_audit_parameter')
  )
    return
  db.exec(`
    ALTER TABLE session_generation_audit_parameter
      RENAME TO session_generation_audit_parameter_v30;
    ALTER TABLE session_generation_audit
      RENAME TO session_generation_audit_v30;
    CREATE TABLE session_generation_audit (
      run_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      code TEXT NOT NULL CHECK(code IN (
        'encounter_target_sum','candidate_coverage','encounter_selector_fit',
        'deterministic_seed_path','treasure_count','unique_encounter_anchors',
        'treasure_assignment_complete','normal_loot_budget_tolerance',
        'magic_item_count','packing_validity','item_definition_complete',
        'item_value_consistency','container_capacity',
        'coin_denomination_integrity','role_magic_consistency',
        'stock_class_policy'
      )),
      passed INTEGER NOT NULL CHECK(passed IN (0,1)),
      hard INTEGER NOT NULL CHECK(hard IN (0,1)),
      PRIMARY KEY (run_id, position),
      FOREIGN KEY (run_id) REFERENCES session_generation_run(id)
        ON DELETE RESTRICT
    );
    CREATE TABLE session_generation_audit_parameter (
      run_id TEXT NOT NULL,
      audit_position INTEGER NOT NULL CHECK(audit_position >= 0),
      parameter_key TEXT NOT NULL,
      value_type TEXT NOT NULL CHECK(value_type IN ('string','number','boolean','null')),
      text_value TEXT,
      number_value REAL,
      boolean_value INTEGER CHECK(boolean_value IN (0,1)),
      CHECK(
        (value_type = 'string' AND text_value IS NOT NULL AND number_value IS NULL AND boolean_value IS NULL) OR
        (value_type = 'number' AND text_value IS NULL AND number_value IS NOT NULL AND boolean_value IS NULL) OR
        (value_type = 'boolean' AND text_value IS NULL AND number_value IS NULL AND boolean_value IS NOT NULL) OR
        (value_type = 'null' AND text_value IS NULL AND number_value IS NULL AND boolean_value IS NULL)
      ),
      PRIMARY KEY (run_id, audit_position, parameter_key),
      FOREIGN KEY (run_id, audit_position)
        REFERENCES session_generation_audit(run_id, position)
        ON DELETE RESTRICT
    );
    INSERT INTO session_generation_audit
      SELECT * FROM session_generation_audit_v30;
    INSERT INTO session_generation_audit_parameter
      SELECT * FROM session_generation_audit_parameter_v30;
    DROP TABLE session_generation_audit_parameter_v30;
    DROP TABLE session_generation_audit_v30;
  `)
}

function migrateGeneratedItems(db: Database.Database): void {
  if (!tableExists(db, 'session_generation_item')) return
  const rows = db
    .prepare(
      `SELECT run_id AS runId, treasure_id AS treasureId, id, position,
              catalog_item_id AS catalogItemId, role, name, modifier,
              quantity, unit_value_cp AS unitValueCp, stackable, magic,
              rarity, curse_name AS curseName, curse_effect AS curseEffect,
              container_id AS containerId, capacity
         FROM session_generation_item ORDER BY run_id, treasure_id, position`
    )
    .all() as OldGeneratedItem[]
  db.exec(`
    ALTER TABLE session_generation_item RENAME TO session_generation_item_v30;
    CREATE TABLE session_generation_item (
      run_id TEXT NOT NULL,
      treasure_id TEXT NOT NULL,
      id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      item_reference_json TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('compact_value','complex_value','useful','flavor','magic')),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      container_id TEXT,
      PRIMARY KEY (run_id, treasure_id, id),
      UNIQUE (run_id, treasure_id, position),
      FOREIGN KEY (run_id, treasure_id)
        REFERENCES session_generation_treasure(run_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (run_id, treasure_id, container_id)
        REFERENCES session_generation_container(run_id, treasure_id, id) ON DELETE RESTRICT
    );
    CREATE TABLE session_generation_item_definition (
      run_id TEXT NOT NULL REFERENCES session_generation_run(id) ON DELETE RESTRICT,
      definition_id TEXT NOT NULL,
      reference_json TEXT NOT NULL,
      definition_json TEXT NOT NULL,
      PRIMARY KEY (run_id, definition_id),
      UNIQUE (run_id, reference_json)
    );
  `)
  const insertDefinition = db.prepare(
    `INSERT INTO session_generation_item_definition (
       run_id, definition_id, reference_json, definition_json
     ) VALUES (?, ?, ?, ?)`
  )
  const insertItem = db.prepare(
    `INSERT INTO session_generation_item (
       run_id, treasure_id, id, position, item_reference_json, role,
       quantity, container_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const row of rows) {
    const reference = generatedReference(row.runId, row.id)
    const definition = itemDefinitionSchema.parse({
      reference,
      name: row.name,
      unitValueCp: row.unitValueCp,
      unitCapacity:
        row.quantity > 0 ? row.capacity / row.quantity : row.capacity,
      stackable: Boolean(row.stackable),
      magic: Boolean(row.magic),
      rarity: row.magic ? row.rarity : null,
      curse:
        row.magic && row.curseName
          ? {
              catalogId: null,
              name: row.curseName,
              effect: row.curseEffect || 'Historischer Flucheffekt unbekannt'
            }
          : null,
      components: {
        baseItemId: row.magic ? null : row.catalogItemId,
        modifierId: null,
        componentId: null,
        magicItemId: row.magic ? row.catalogItemId : null,
        magicVariantId: null,
        spellId: null,
        enspelledRuleId: null,
        curseId: null,
        coinDenominations: []
      }
    })
    insertDefinition.run(
      row.runId,
      reference.definitionId,
      JSON.stringify(reference),
      JSON.stringify(definition)
    )
    insertItem.run(
      row.runId,
      row.treasureId,
      row.id,
      row.position,
      JSON.stringify(reference),
      row.role,
      row.quantity,
      row.containerId
    )
  }
  db.exec('DROP TABLE session_generation_item_v30;')
}

function migrateTreasureItems(db: Database.Database): void {
  if (!tableExists(db, 'loot_item')) return
  const rows = db
    .prepare(
      `SELECT item.*, treasure.source_run_id AS sourceRunId
         FROM loot_item item
         JOIN loot_treasure treasure ON treasure.id = item.treasure_id
        ORDER BY item.treasure_id, item.position`
    )
    .all() as Array<Record<string, unknown>>
  db.exec(`
    CREATE TABLE IF NOT EXISTS loot_legacy_item_definition (
      definition_id TEXT PRIMARY KEY NOT NULL,
      definition_json TEXT NOT NULL
    );
    ALTER TABLE loot_item RENAME TO loot_item_v30;
    CREATE TABLE loot_item (
      id TEXT PRIMARY KEY NOT NULL,
      treasure_id TEXT NOT NULL REFERENCES loot_treasure(id) ON DELETE CASCADE,
      source_line_id TEXT,
      item_reference_json TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      container_id TEXT REFERENCES loot_container(id) ON DELETE SET NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(treasure_id, position),
      UNIQUE(treasure_id, source_line_id)
    );
  `)
  const insert = db.prepare(
    `INSERT INTO loot_item (
       id, treasure_id, source_line_id, item_reference_json, quantity,
       container_id, position
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  for (const row of rows) {
    const reference = treasureReference(db, row)
    insert.run(
      row['id'],
      row['treasure_id'],
      row['source_line_id'],
      JSON.stringify(reference),
      row['quantity'],
      row['container_id'],
      row['position']
    )
  }
  db.exec('DROP TABLE loot_item_v30;')
}

function treasureReference(
  db: Database.Database,
  row: Record<string, unknown>
): ItemReference {
  const sourceRunId = row['sourceRunId'] as string | null
  const sourceLineId = row['source_line_id'] as string | null
  if (
    sourceRunId &&
    sourceLineId &&
    tableExists(db, 'session_generation_item')
  ) {
    const generated = db
      .prepare(
        `SELECT item_reference_json AS referenceJson
           FROM session_generation_item
          WHERE run_id = ? AND id = ?`
      )
      .get(sourceRunId, sourceLineId) as { referenceJson: string } | undefined
    if (generated) return JSON.parse(generated.referenceJson) as ItemReference
  }
  const catalogId = row['catalog_item_id'] as string | null
  const entryKind = row['catalog_entry_kind'] as 'item' | 'magic_item' | null
  if (
    catalogId &&
    entryKind &&
    sourceRunId &&
    tableExists(db, 'session_generation_run')
  ) {
    const run = db
      .prepare(
        `SELECT catalog_version AS catalogVersion,
                catalog_content_hash AS catalogContentHash
           FROM session_generation_run WHERE id = ?`
      )
      .get(sourceRunId) as
      { catalogVersion: string; catalogContentHash: string } | undefined
    if (run)
      return {
        kind: 'catalog',
        ...run,
        entryKind,
        catalogId
      }
  }
  const reference = {
    kind: 'legacy' as const,
    definitionId: `treasure:${String(row['id'])}`
  }
  saveLegacy(db, {
    reference,
    name: String(row['name']),
    unitValueCp: Number(row['unit_value_cp']),
    unitCapacity: 1,
    stackable: Boolean(row['stackable']),
    magic: Boolean(row['magic']),
    rarity: row['magic'] ? (row['rarity'] as ItemDefinition['rarity']) : null,
    curse:
      row['magic'] && row['curse_name']
        ? {
            catalogId: null,
            name:
              typeof row['curse_name'] === 'string'
                ? row['curse_name']
                : 'Historischer Fluch',
            effect: 'Historischer Flucheffekt unbekannt'
          }
        : null,
    components: emptyComponents()
  })
  return reference
}

function migrateLedgerItems(db: Database.Database): void {
  if (!tableExists(db, 'character_loot_entry')) return
  const rows = db
    .prepare('SELECT * FROM character_loot_entry ORDER BY received_at, id')
    .all() as Array<Record<string, unknown>>
  db.exec(`
    ALTER TABLE character_loot_entry RENAME TO character_loot_entry_v30;
    CREATE TABLE character_loot_entry (
      id TEXT PRIMARY KEY NOT NULL,
      command_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      treasure_id TEXT,
      treasure_item_id TEXT,
      source TEXT NOT NULL CHECK(source IN ('award', 'manual', 'purchase', 'correction')),
      item_reference_json TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      status TEXT NOT NULL CHECK(status IN ('received', 'given_away', 'sold')),
      provenance_kind TEXT NOT NULL CHECK(provenance_kind = 'treasure_distribution'),
      provenance_treasure_label TEXT NOT NULL,
      provenance_recipient_name TEXT NOT NULL,
      source_run_id TEXT,
      generated_treasure_id TEXT,
      reward_channel TEXT CHECK(reward_channel IN ('encounter', 'quest', 'environment')),
      corrects_entry_id TEXT UNIQUE,
      correction_reason TEXT,
      received_at TEXT NOT NULL,
      UNIQUE(command_id, treasure_item_id, character_id),
      CHECK((source_run_id IS NULL AND generated_treasure_id IS NULL AND reward_channel IS NULL)
         OR (source_run_id IS NOT NULL AND generated_treasure_id IS NOT NULL AND reward_channel IS NOT NULL)),
      CHECK((source = 'correction' AND corrects_entry_id IS NOT NULL AND correction_reason IS NOT NULL)
         OR (source != 'correction' AND corrects_entry_id IS NULL AND correction_reason IS NULL))
    );
  `)
  const insert = db.prepare(
    `INSERT INTO character_loot_entry (
       id, command_id, character_id, treasure_id, treasure_item_id, source,
       item_reference_json, quantity, status, provenance_kind,
       provenance_treasure_label, provenance_recipient_name, source_run_id,
       generated_treasure_id, reward_channel, corrects_entry_id,
       correction_reason, received_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const row of rows) {
    let reference = linkedTreasureReference(db, row['treasure_item_id'])
    const linkedDefinition = reference ? resolveLocal(db, reference) : null
    if (
      !reference ||
      !linkedDefinition ||
      linkedDefinition.name !== row['item_name'] ||
      linkedDefinition.unitValueCp !== row['unit_value_cp']
    ) {
      reference = {
        kind: 'legacy',
        definitionId: `ledger:${String(row['id'])}`
      }
      saveLegacy(db, {
        reference,
        name: String(row['item_name']),
        unitValueCp: Number(row['unit_value_cp']),
        unitCapacity: 1,
        stackable: Number(row['quantity']) > 1,
        magic: false,
        rarity: null,
        curse: null,
        components: emptyComponents()
      })
    }
    insert.run(
      row['id'],
      row['command_id'],
      row['character_id'],
      row['treasure_id'],
      row['treasure_item_id'],
      row['source'],
      JSON.stringify(reference),
      row['quantity'],
      row['status'],
      row['provenance_kind'],
      row['provenance_treasure_label'],
      row['provenance_recipient_name'],
      row['source_run_id'],
      row['generated_treasure_id'],
      row['reward_channel'],
      row['corrects_entry_id'],
      row['correction_reason'],
      row['received_at']
    )
  }
  db.exec(`
    DROP TABLE character_loot_entry_v30;
    CREATE INDEX character_loot_entry_character
      ON character_loot_entry(character_id, received_at, id);
    CREATE INDEX character_loot_entry_correction
      ON character_loot_entry(corrects_entry_id);
  `)
}

function linkedTreasureReference(
  db: Database.Database,
  itemId: unknown
): ItemReference | null {
  if (!itemId || !tableExists(db, 'loot_item')) return null
  const row = db
    .prepare(
      'SELECT item_reference_json AS referenceJson FROM loot_item WHERE id = ?'
    )
    .get(itemId) as { referenceJson: string } | undefined
  return row ? (JSON.parse(row.referenceJson) as ItemReference) : null
}

function resolveLocal(
  db: Database.Database,
  reference: ItemReference
): ItemDefinition | null {
  if (reference.kind === 'generated') {
    if (!tableExists(db, 'session_generation_item_definition')) return null
    const row = db
      .prepare(
        `SELECT definition_json AS definitionJson
           FROM session_generation_item_definition
          WHERE run_id = ? AND definition_id = ?`
      )
      .get(reference.runId, reference.definitionId) as
      { definitionJson: string } | undefined
    return row
      ? itemDefinitionSchema.parse(JSON.parse(row.definitionJson))
      : null
  }
  if (reference.kind === 'legacy') {
    const row = db
      .prepare(
        `SELECT definition_json AS definitionJson
           FROM loot_legacy_item_definition WHERE definition_id = ?`
      )
      .get(reference.definitionId) as { definitionJson: string } | undefined
    return row
      ? itemDefinitionSchema.parse(JSON.parse(row.definitionJson))
      : null
  }
  return null
}

function generatedReference(runId: string, itemId: string) {
  return {
    kind: 'generated' as const,
    runId,
    definitionId: itemId.replace(':item:', ':definition:')
  }
}

function saveLegacy(db: Database.Database, candidate: ItemDefinition): void {
  const definition = itemDefinitionSchema.parse(candidate)
  if (definition.reference.kind !== 'legacy')
    throw new Error('Invalid legacy definition')
  db.prepare(
    `INSERT OR IGNORE INTO loot_legacy_item_definition
       (definition_id, definition_json) VALUES (?, ?)`
  ).run(definition.reference.definitionId, JSON.stringify(definition))
}

function emptyComponents() {
  return {
    baseItemId: null,
    modifierId: null,
    componentId: null,
    magicItemId: null,
    magicVariantId: null,
    spellId: null,
    enspelledRuleId: null,
    curseId: null,
    coinDenominations: []
  }
}

function tableExists(db: Database.Database, name: string): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM sqlite_master
          WHERE type = 'table' AND name = ?`
      )
      .get(name)
  )
}
