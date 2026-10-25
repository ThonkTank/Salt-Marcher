import { generationNpcs, requiredGenerationNpcs } from './generation-npcs';
import {
  installWorldSources,
  saveWorldSource,
  pruneWorldStock,
  resolveWorldSources,
  validateWorldSources,
  canonicalSourceSnapshot,
} from './world-sources';
import { createHash, randomUUID } from 'node:crypto';
import artifact from '../campaign/generation/system-preset.json';
import { checkedGeneratorConfig } from '../campaign/generation/config';
import { canonicalJson } from '../campaign/generation/canonical-json';
import {
  buildSelectionIndex,
  selectEncounter,
  type CompositionCatalog,
} from '../campaign/generation/selector';
import {
  assessEncounter,
  validateEncounterPlanInput,
  type EncounterPlan,
} from '../catalog/encounter-contracts';
import {
  creatureInfo,
  readCreature,
  searchCreatures,
  saveEncounterPlan,
  readEncounterPlan,
} from './encounters';
import { makeTreasure } from './progression';
import { copper } from '../runtime/progression';
import {
  exactWeight,
  encounterWeight,
  integerWeights,
  encounterTableFields,
  generatorPresetFields,
  type EncounterTable,
  type LootTable,
  type LootRoll,
  type LootRollCommand,
  type GeneratorPreset,
  type GeneratorRegistry,
  type GenerationCommand,
  type GenerationRequest,
  type GenerationRun,
} from '../campaign/generation-contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  json = (v: unknown) => JSON.stringify(v),
  systemId = 'generator-system-v5';
const fingerprint = (v: object) => hash(canonicalJson({ ...v, token: undefined }));
function decoded<T>(row: any): T {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Generator- oder Tabellendaten nicht verfügbar.');
  return JSON.parse(row.payload);
}
export function installGenerationSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS encounter_table(id TEXT PRIMARY KEY,campaign_id TEXT REFERENCES campaign(id),revision INTEGER NOT NULL,trashed INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS loot_table(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,trashed INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS generator_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS generator_preset(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,system INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS generator_assignment(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),preset_id TEXT NOT NULL REFERENCES generator_preset(id) ON DELETE CASCADE) STRICT;
 CREATE TABLE IF NOT EXISTS generation_run(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS generation_acceptance(campaign_id TEXT NOT NULL,run_id TEXT NOT NULL,proposal_index INTEGER NOT NULL,plan_id TEXT NOT NULL,PRIMARY KEY(campaign_id,run_id,proposal_index),FOREIGN KEY(campaign_id,run_id) REFERENCES generation_run(campaign_id,id),FOREIGN KEY(campaign_id,plan_id) REFERENCES encounter_plan(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS generation_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
  db.exec(
    'CREATE TABLE IF NOT EXISTS generator_registry_receipt(command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;',
  );
  installWorldSources(db);
  db.prepare('INSERT OR IGNORE INTO generator_meta VALUES(1,0)').run();
  const config = checkedGeneratorConfig(artifact.config as GeneratorPreset['config']),
    preset: GeneratorPreset = {
      id: systemId,
      revision: 1,
      name: 'Systempreset',
      system: true,
      config,
      hash: hash(canonicalJson(config)),
    },
    payload = json(preset);
  db.prepare('INSERT OR IGNORE INTO generator_preset VALUES(?,?,1,?,?)').run(
    systemId,
    1,
    payload,
    hash(payload),
  );
}
export function readEncounterTables(
  db: any,
  cam: string,
  includeTrashed: boolean,
): EncounterTable[] {
  return db
    .prepare(
      'SELECT * FROM encounter_table WHERE (campaign_id=? OR campaign_id IS NULL) AND (? OR trashed=0) ORDER BY id',
    )
    .all(cam, includeTrashed ? 1 : 0)
    .map((r: any) => decodeTable(r));
}
function decodeLootTable(row: any): LootTable {
  const table = decoded<LootTable>(row);
  if (
    !table ||
    typeof table !== 'object' ||
    Array.isArray(table) ||
    table.id !== row.id ||
    table.revision !== row.revision ||
    !Number.isSafeInteger(table.revision) ||
    table.revision < 1 ||
    Number(table.trashed) !== row.trashed ||
    typeof table.trashed !== 'boolean' ||
    typeof table.name !== 'string' ||
    !table.name.trim() ||
    typeof table.description !== 'string' ||
    !Number.isSafeInteger(table.rolls) ||
    table.rolls < 1 ||
    table.rolls > 100 ||
    !Array.isArray(table.entries) ||
    !table.entries.length ||
    table.entries.length > 1000 ||
    new Set(table.entries.map((e) => e?.id)).size !== table.entries.length
  )
    throw new Error('Loot-Tabelle hat ein unbekanntes Format. Originaldaten bleiben erhalten.');
  for (const e of table.entries) {
    if (
      !e?.id ||
      typeof e.item?.name !== 'string' ||
      !e.item.name.trim() ||
      !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(e.item.category) ||
      !Number.isSafeInteger(e.minimum) ||
      !Number.isSafeInteger(e.maximum) ||
      e.minimum < 1 ||
      e.maximum < e.minimum ||
      e.maximum > 1000000
    )
      throw new Error(
        'Loot-Tabelle enthält einen ungültigen Eintrag. Originaldaten bleiben erhalten.',
      );
    exactWeight(e.weight);
    copper(e.item.valueGold);
  }
  if (!integerWeights(table.entries.map((e) => e.weight)).some((w) => w > 0n))
    throw new Error(
      'Loot-Tabelle besitzt keine positive Gewichtung. Originaldaten bleiben erhalten.',
    );
  return table;
}
export function readLootTables(db: any, cam: string, includeTrashed: boolean): LootTable[] {
  return db
    .prepare('SELECT * FROM loot_table WHERE campaign_id=? AND (? OR trashed=0) ORDER BY id')
    .all(cam, includeTrashed ? 1 : 0)
    .map((r: any) => decodeLootTable(r));
}
function readLootTable(db: any, cam: string, id: string): LootTable {
  return decodeLootTable(
    db.prepare('SELECT * FROM loot_table WHERE campaign_id=? AND id=?').get(cam, id),
  );
}
/** Stored content remains readable with legacy decimal weights; new edits have a narrower authoring rule. */
function checkTableContent(table: EncounterTable) {
  if (
    !table ||
    typeof table !== 'object' ||
    Array.isArray(table) ||
    Object.keys(table).some((key) => !Object.hasOwn(encounterTableFields, key)) ||
    typeof table.id !== 'string' ||
    !table.id ||
    typeof table.name !== 'string' ||
    !table.name.trim() ||
    table.name.length > 1000 ||
    typeof table.description !== 'string' ||
    table.description.length > 2000000 ||
    !['campaign', 'installation'].includes(table.scope) ||
    !Array.isArray(table.habitats) ||
    table.habitats.some((h) => typeof h !== 'string' || h.length > 1000) ||
    !['any', 'day', 'night'].includes(table.time) ||
    !Array.isArray(table.entries) ||
    !table.entries.length ||
    table.entries.length > 1000
  )
    throw new Error(
      'Encounter-Tabelle benötigt Namen, gültige Bedingungen und Kreaturen. Originaldaten bleiben erhalten.',
    );
  if (
    table.entries.some((e) => !e || typeof e.creatureId !== 'string' || !e.creatureId) ||
    new Set(table.entries.map((e) => e.creatureId)).size !== table.entries.length
  )
    throw new Error(
      'Encounter-Tabelle benötigt eindeutige Kreaturkennungen. Originaldaten bleiben erhalten.',
    );
  const weights = integerWeights(table.entries.map((e) => e.weight));
  if (!weights.some((w) => w > 0n))
    throw new Error(
      'Mindestens ein Tabellengewicht muss positiv sein. Originaldaten bleiben erhalten.',
    );
  if (
    table.lootTableId !== null &&
    (typeof table.lootTableId !== 'string' ||
      !table.lootTableId ||
      table.lootTableId.length > 1000 ||
      table.scope === 'installation')
  )
    throw new Error(
      'Encounter-Tabelle besitzt eine ungültige Loot-Tabellenreferenz. Originaldaten bleiben erhalten.',
    );
}
function decodeTable(row: any): EncounterTable {
  const table = decoded<EncounterTable>(row);
  checkTableContent(table);
  if (
    table.id !== row.id ||
    table.revision !== row.revision ||
    !Number.isSafeInteger(table.revision) ||
    table.revision < 1 ||
    typeof table.trashed !== 'boolean' ||
    Number(table.trashed) !== row.trashed ||
    table.scope !== (row.campaign_id === null ? 'installation' : 'campaign')
  )
    throw new Error('Encounter-Tabelle besitzt widersprüchliche Identität oder Revision.');
  return table;
}
function readTable(db: any, cam: string, id: string): EncounterTable {
  const row = db
    .prepare('SELECT * FROM encounter_table WHERE id=? AND (campaign_id=? OR campaign_id IS NULL)')
    .get(id, cam);
  return decodeTable(row);
}
function decodePreset(row: any): GeneratorPreset {
  const preset = decoded<GeneratorPreset>(row);
  if (
    !preset ||
    typeof preset !== 'object' ||
    Array.isArray(preset) ||
    Object.keys(preset).some((key) => !Object.hasOwn(generatorPresetFields, key)) ||
    typeof preset.name !== 'string' ||
    !preset.name.trim() ||
    typeof preset.system !== 'boolean' ||
    preset.id !== row.id ||
    preset.revision !== row.revision ||
    !Number.isSafeInteger(preset.revision) ||
    preset.revision < 1 ||
    Number(preset.system) !== row.system
  )
    throw new Error(
      'Preset besitzt ein unbekanntes Format oder eine widersprüchliche Identität. Originaldaten bleiben erhalten.',
    );
  const config = checkedGeneratorConfig(preset.config);
  if (preset.hash !== hash(canonicalJson(config)))
    throw new Error('Preset-Regelhash widerspricht seinem Inhalt. Originaldaten bleiben erhalten.');
  return preset;
}
export function validateGenerationBackup(db: any) {
  for (const row of db.prepare('SELECT * FROM encounter_table').iterate()) decodeTable(row);
  for (const row of db.prepare('SELECT * FROM loot_table').iterate()) decodeLootTable(row);
  for (const row of db.prepare('SELECT * FROM generator_preset').iterate()) decodePreset(row);
  validateWorldSources(db);
  for (const row of db.prepare('SELECT * FROM generation_run').iterate()) generationRunRow(db, row);
  for (const row of db.prepare('SELECT campaign_id,id FROM encounter_plan').iterate())
    readEncounterPlan(db, row.campaign_id, row.id);
}
export function readGeneratorRegistry(db: any, cam: string): GeneratorRegistry {
  const presets = db
      .prepare('SELECT * FROM generator_preset ORDER BY system DESC,id')
      .all()
      .map((r: any) => decodePreset(r)),
    assignedId =
      db.prepare('SELECT preset_id FROM generator_assignment WHERE campaign_id=?').get(cam)
        ?.preset_id ?? null;
  return {
    revision: db.prepare('SELECT revision FROM generator_meta WHERE id=1').get().revision,
    presets,
    assignedId,
    effectiveId: assignedId ?? systemId,
  };
}
export function executeGeneration(db: any, command: GenerationCommand, guard: () => void) {
  return db
    .transaction(() => {
      guard();
      if (!command.commandId || command.commandId.length > 1000)
        throw new Error('Änderungskennung fehlt.');
      const cam = command.campaignId,
        fp = fingerprint(command),
        prior = db
          .prepare('SELECT * FROM generation_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (prior.campaign_id !== cam || prior.fingerprint !== fp)
          throw new Error('Änderungskennung bereits anders verwendet.');
        const result = decoded<any>(prior);
        if (!Array.isArray(result.lootTables)) result.lootTables = readLootTables(db, cam, true);
        return result;
      }
      const a = command.action;
      if (a.kind === 'source-save') {
        saveWorldSource(db, cam, a.source, a.expectedRevision, readEncounterTables(db, cam, true));
      } else if (a.kind === 'table-save') {
        const t = structuredClone(a.table);
        checkTableContent(t);
        const old = db.prepare('SELECT * FROM encounter_table WHERE id=?').get(t.id);
        if (
          (old && old.campaign_id !== null && old.campaign_id !== cam) ||
          (a.expectedRevision === null ? !!old : !old || old.revision !== a.expectedRevision)
        )
          throw new Error('Encounter-Tabelle geändert. Bitte den gespeicherten Stand laden.');
        const previous = old ? decodeTable(old) : null;
        if (previous && previous.scope !== t.scope)
          throw new Error(
            'Geltungsbereich einer bestehenden Encounter-Tabelle bleibt erhalten. Für einen anderen Geltungsbereich eine neue Tabelle anlegen.',
          );
        const previousWeights = new Map(previous?.entries.map((e) => [e.creatureId, e.weight]));
        t.entries = t.entries.map((e) => {
          readCreature(e.creatureId);
          return {
            creatureId: e.creatureId,
            weight: encounterWeight(e.weight, previousWeights.get(e.creatureId)),
          };
        });
        if (t.lootTableId !== null) {
          const loot = readLootTable(db, cam, t.lootTableId);
          if (loot.trashed) throw new Error('Die verknüpfte Loot-Tabelle liegt im Papierkorb.');
        }
        t.revision = (old?.revision ?? 0) + 1;
        t.trashed = false;
        const payload = json(t);
        db.prepare(
          'INSERT INTO encounter_table VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET campaign_id=excluded.campaign_id,revision=excluded.revision,trashed=excluded.trashed,payload=excluded.payload,checksum=excluded.checksum',
        ).run(t.id, t.scope === 'installation' ? null : cam, t.revision, 0, payload, hash(payload));
        pruneWorldStock(db, cam, t);
      } else if (a.kind === 'table-trash') {
        const t = readTable(db, cam, a.id);
        if (t.revision !== a.expectedRevision) throw new Error('Encounter-Tabelle geändert.');
        t.revision++;
        t.trashed = a.trashed;
        const payload = json(t);
        db.prepare(
          'UPDATE encounter_table SET revision=?,trashed=?,payload=?,checksum=? WHERE id=?',
        ).run(t.revision, t.trashed ? 1 : 0, payload, hash(payload), t.id);
      } else if (a.kind === 'loot-save') {
        const t = structuredClone(a.table),
          old = db.prepare('SELECT * FROM loot_table WHERE campaign_id=? AND id=?').get(cam, t?.id);
        if (
          !t?.id ||
          typeof t.name !== 'string' ||
          !t.name.trim() ||
          t.name.length > 1000 ||
          typeof t.description !== 'string' ||
          t.description.length > 2000000 ||
          !Number.isSafeInteger(t.rolls) ||
          t.rolls < 1 ||
          t.rolls > 100 ||
          !Array.isArray(t.entries) ||
          !t.entries.length ||
          t.entries.length > 1000 ||
          new Set(t.entries.map((e) => e.id)).size !== t.entries.length
        )
          throw new Error('Loot-Tabelle benötigt Namen, 1–100 Würfe und eindeutige Einträge.');
        if (a.expectedRevision === null ? !!old : !old || old.revision !== a.expectedRevision)
          throw new Error('Loot-Tabelle geändert. Bitte den gespeicherten Stand laden.');
        if (old) readLootTable(db, cam, t.id);
        t.entries = t.entries.map((e) => {
          if (
            !e?.id ||
            typeof e.item?.name !== 'string' ||
            !e.item.name.trim() ||
            e.item.name.length > 1000 ||
            !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(e.item.category) ||
            !Number.isSafeInteger(e.minimum) ||
            !Number.isSafeInteger(e.maximum) ||
            e.minimum < 1 ||
            e.maximum < e.minimum ||
            e.maximum > 1000000
          )
            throw new Error(
              'Loot-Einträge benötigen Name, Kategorie und einen gültigen Mengenbereich.',
            );
          copper(e.item.valueGold);
          return {
            ...e,
            weight: exactWeight(e.weight),
            item: { ...e.item, valueGold: e.item.valueGold.trim() },
          };
        });
        if (!integerWeights(t.entries.map((e) => e.weight)).some((w) => w > 0n))
          throw new Error('Mindestens ein Loot-Gewicht muss positiv sein.');
        t.revision = (old?.revision ?? 0) + 1;
        t.trashed = false;
        const payload = json(t);
        db.prepare(
          'INSERT INTO loot_table VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,trashed=excluded.trashed,payload=excluded.payload,checksum=excluded.checksum',
        ).run(cam, t.id, t.revision, 0, payload, hash(payload));
      } else if (a.kind === 'loot-trash') {
        const t = readLootTable(db, cam, a.id);
        if (t.revision !== a.expectedRevision) throw new Error('Loot-Tabelle geändert.');
        t.revision++;
        t.trashed = a.trashed;
        const payload = json(t);
        db.prepare(
          'UPDATE loot_table SET revision=?,trashed=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(t.revision, t.trashed ? 1 : 0, payload, hash(payload), cam, t.id);
      } else {
        mutatePreset(db, cam, a);
      }
      const result = {
          tables: readEncounterTables(db, cam, true),
          lootTables: readLootTables(db, cam, true),
          registry: readGeneratorRegistry(db, cam),
        },
        payload = json(result);
      db.prepare('INSERT INTO generation_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}
function weightedIndex(weights: readonly string[], stream: string): number {
  const ints = integerWeights(weights),
    sum = ints.reduce((a, b) => a + b, 0n);
  if (!sum) throw new Error('Keine positiven Gewichte.');
  const bits = sum.toString(2).length,
    mask = (1n << BigInt(bits)) - 1n;
  let draw = 0n,
    counter = 0;
  do {
    let bytes = '';
    for (let i = 0; i < Math.ceil(bits / 256); i++) bytes += hash(stream + '|' + counter + '|' + i);
    draw = BigInt('0x' + bytes) & mask;
    counter++;
  } while (draw >= sum);
  let running = 0n;
  for (let i = 0; i < ints.length; i++) {
    running += ints[i]!;
    if (draw < running) return i;
  }
  throw new Error('Gewichtete Auswahl fehlgeschlagen.');
}
export function previewLoot(
  db: any,
  cam: string,
  tableId: string,
  expectedRevision: number,
  seed: string,
) {
  const table = readLootTable(db, cam, tableId);
  if (table.trashed || table.revision !== expectedRevision)
    throw new Error('Beutetabelle geändert. Begegnungsvorschlag neu erzeugen.');
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 1000)
    throw new Error('Beute benötigt gültigen Seed.');
  return lootItems(table, seed);
}
function lootItems(table: LootTable, seed: string) {
  const grouped = new Map<string, import('../runtime/progression').ItemInput>();
  for (let roll = 0; roll < table.rolls; roll++) {
    const entry =
        table.entries[
          weightedIndex(
            table.entries.map((e) => e.weight),
            seed + '|entry|' + roll,
          )
        ]!,
      span = entry.maximum - entry.minimum + 1,
      quantity =
        entry.minimum +
        Number(BigInt('0x' + hash(seed + '|quantity|' + roll).slice(0, 16)) % BigInt(span)),
      key = json(entry.item),
      present = grouped.get(key);
    if (present) present.quantity += quantity;
    else grouped.set(key, { ...entry.item, quantity });
  }
  return [...grouped.values()];
}
export function rollLoot(db: any, command: LootRollCommand, guard: () => void): LootRoll {
  return db
    .transaction(() => {
      guard();
      if (!command.commandId || command.commandId.length > 1000)
        throw new Error('Änderungskennung fehlt.');
      const cam = command.campaignId,
        fp = fingerprint(command),
        prior = db
          .prepare('SELECT * FROM generation_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (prior.campaign_id !== cam || prior.fingerprint !== fp)
          throw new Error('Änderungskennung bereits anders verwendet.');
        return decoded<LootRoll>(prior);
      }
      if (
        typeof command.seed !== 'string' ||
        !command.seed.trim() ||
        command.seed.length > 1000 ||
        typeof command.title !== 'string' ||
        command.title.length > 1000
      )
        throw new Error('Loot-Wurf benötigt Seed und gültigen Titel.');
      const table = readLootTable(db, cam, command.tableId);
      if (table.trashed || table.revision !== command.expectedRevision)
        throw new Error('Loot-Tabelle geändert oder im Papierkorb.');
      const items = lootItems(table, command.seed),
        treasureId = makeTreasure(db, cam, command.title, null, null, items);
      if (!treasureId) throw new Error('Loot-Tabelle erzeugte keine Beute.');
      const result: LootRoll = {
          tableId: table.id,
          tableRevision: table.revision,
          seed: command.seed,
          treasureId,
          items,
        },
        payload = json(result);
      db.prepare('INSERT INTO generation_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}
/** Read frozen proposals without requiring their sources to still be current. */
function generationRunRow(db: any, row: any): GenerationRun {
  const run = decoded<GenerationRun>(row),
    cam = row.campaign_id;
  const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: any) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  const unsigned = (v: any) => Number.isSafeInteger(v) && v >= 0;
  const revision = (v: any) => unsigned(v) && v >= 1;
  const digest = (v: any) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
  const fail = () => {
    throw new Error('Generierungsvorschau beschädigt. Originaldaten bleiben erhalten.');
  };
  if (
    !object(run) ||
    run.id !== row.id ||
    !id(run.id) ||
    run.revision !== 1 ||
    !id(run.seed) ||
    !object(run.request) ||
    run.seed !== run.request.seed ||
    !object(run.preset) ||
    !id(run.preset.id) ||
    typeof run.preset.name !== 'string' ||
    !revision(run.preset.revision) ||
    !digest(run.preset.hash) ||
    !unsigned(run.preset.mobThreshold) ||
    !digest(run.catalogHash) ||
    (run.sourceBasis !== undefined && run.sourceBasis !== null && !digest(run.sourceBasis))
  )
    fail();
  const r = run.request;
  const fixed = run.fixedRoster;
  if (r.fillPlan !== undefined) {
    if (
      !object(r.fillPlan) ||
      !id(r.fillPlan.id) ||
      !revision(r.fillPlan.revision) ||
      !fixed ||
      fixed.id !== r.fillPlan.id ||
      fixed.revision !== r.fillPlan.revision
    )
      fail();
    validateEncounterPlanInput(fixed!);
  } else if (fixed !== undefined) fail();
  if (
    !unsigned(r.count) ||
    r.count < 1 ||
    r.count > 20 ||
    typeof r.title !== 'string' ||
    r.title.length > 1000 ||
    typeof r.habitat !== 'string' ||
    !['any', 'day', 'night'].includes(r.time) ||
    !Array.isArray(r.party) ||
    !r.party.length ||
    !Array.isArray(r.tableIds) ||
    r.tableIds.length > 1000 ||
    r.tableIds.some((v) => !id(v)) ||
    new Set(r.tableIds).size !== r.tableIds.length ||
    !object(r.filters) ||
    (r.npcOnly !== undefined && typeof r.npcOnly !== 'boolean') ||
    !Array.isArray(run.plans) ||
    run.plans.length !== r.count ||
    new Set(run.plans.map((p) => p?.id)).size !== run.plans.length ||
    !Array.isArray(run.warnings) ||
    run.warnings.some((s) => typeof s !== 'string') ||
    !Array.isArray(run.acceptedPlanIds) ||
    run.acceptedPlanIds.length > run.plans.length ||
    !Array.isArray(run.candidates) ||
    new Set(run.candidates.map((c) => c?.creatureId)).size !== run.candidates.length
  )
    fail();
  for (const refs of [run.tables, run.lootTables ?? []]) {
    if (
      !Array.isArray(refs) ||
      refs.length > 1000 ||
      new Set(refs.map((v) => v?.id)).size !== refs.length ||
      refs.some((v) => !object(v) || !id(v.id) || !revision(v.revision))
    )
      fail();
  }
  for (const c of run.candidates)
    if (!object(c) || !id(c.creatureId) || integerWeights([exactWeight(c.weight)])[0]! <= 0n)
      fail();
  const required = r.requiredNpcIds ?? [],
    excluded = r.excludedNpcIds ?? [],
    basis = run.npcBasis;
  for (const ids of [required, excluded])
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((v) => !id(v)) ||
      new Set(ids).size !== ids.length
    )
      fail();
  if (
    required.some((v) => excluded.includes(v)) ||
    (r.includeNpcs !== undefined && typeof r.includeNpcs !== 'boolean')
  )
    fail();
  const usesNpcs = r.npcOnly === true || r.includeNpcs === true || required.length > 0;
  if (usesNpcs ? !Array.isArray(basis) : basis !== undefined) fail();
  if (!run.candidates.length && !required.length && !fixed?.entries.length) fail();
  if (basis !== undefined) {
    if (new Set(basis.map((n) => n?.id)).size !== basis.length) fail();
    for (const n of basis) {
      if (
        !object(n) ||
        !id(n.id) ||
        typeof n.name !== 'string' ||
        n.name.length > 1000 ||
        !id(n.creatureId) ||
        !revision(n.noteRevision) ||
        !revision(n.recordRevision) ||
        !revision(n.actorRevision) ||
        (n.positionRevision !== null && !revision(n.positionRevision)) ||
        (n.locationId !== null && !id(n.locationId)) ||
        n.role !== 'hostile' ||
        !db.prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?').get(cam, n.id)
      )
        fail();
    }
  }
  if (
    required.some((v) => !basis?.some((n) => n.id === v)) ||
    basis?.some((n) => excluded.includes(n.id))
  )
    fail();
  if (run.sourceSnapshot !== undefined) canonicalSourceSnapshot(run.sourceSnapshot);
  const party = (rows: EncounterPlan['party']) => rows.map(({ id, ...p }) => p);
  for (const p of run.plans) {
    if (
      !object(p) ||
      !id(p.id) ||
      p.revision !== 0 ||
      p.catalogHash !== run.catalogHash ||
      !Array.isArray(p.sources) ||
      new Set(p.sources.map((c) => c?.id)).size !== p.sources.length
    )
      fail();
    validateEncounterPlanInput(p);
    if (canonicalJson(party(p.party)) !== canonicalJson(party(r.party))) fail();
    if (
      fixed &&
      (p.entries.length < fixed.entries.length ||
        fixed.entries.some((entry, i) => {
          const { id, ...original } = entry,
            { id: newId, ...copied } = p.entries[i]!;
          return canonicalJson(original) !== canonicalJson(copied);
        }))
    )
      fail();
    const opponents = p.entries.map((e, index) => {
      const source = p.sources.find((c) => c.id === e.creatureId);
      if (!source || !unsigned(source.xp)) fail();
      if (fixed && index < fixed.entries.length) {
        if (
          canonicalJson(source) !== canonicalJson(fixed.sources.find((c) => c.id === e.creatureId))
        )
          fail();
        return { xp: source!.xp, count: e.count };
      }
      const named = e.worldActorIds ?? [],
        anonymous = e.count - named.length;
      if (
        (r.npcOnly && anonymous) ||
        (!run.candidates.some((c) => c.creatureId === e.creatureId) &&
          (anonymous || named.some((actorId) => !required.includes(actorId))))
      )
        fail();
      if (named.length) {
        if (!basis || !e.actorNames) fail();
        for (const [i, actorId] of named.entries()) {
          const n = basis!.find((n) => n.id === actorId);
          if (
            !n ||
            n.creatureId !== e.creatureId ||
            n.name !== e.actorNames![i] ||
            (!r.npcOnly && !r.includeNpcs && !required.includes(actorId))
          )
            fail();
        }
      } else if (e.actorNames?.length) fail();
      return { xp: source!.xp, count: e.count };
    });
    if (required.some((v) => !p.entries.some((e) => e.worldActorIds?.includes(v)))) fail();
    if (canonicalJson(assessEncounter(p.party, opponents)) !== canonicalJson(p.assessment)) fail();
  }
  const accepted = new Map<number, string>();
  for (const a of db
    .prepare(
      'SELECT proposal_index,plan_id FROM generation_acceptance WHERE campaign_id=? AND run_id=?',
    )
    .all(cam, run.id)) {
    if (
      !unsigned(a.proposal_index) ||
      !run.plans[a.proposal_index] ||
      !id(a.plan_id) ||
      !db.prepare('SELECT 1 FROM encounter_plan WHERE campaign_id=? AND id=?').get(cam, a.plan_id)
    )
      fail();
    accepted.set(a.proposal_index, a.plan_id);
  }
  for (const [index, value] of run.acceptedPlanIds.entries())
    if (value !== null && value !== undefined && value !== accepted.get(index)) fail();
  for (const [index, value] of accepted) run.acceptedPlanIds[index] = value;
  return run;
}
export function readGenerationRun(db: any, cam: string, id: string): GenerationRun {
  return generationRunRow(
    db,
    db.prepare('SELECT * FROM generation_run WHERE campaign_id=? AND id=?').get(cam, id),
  );
}
export function readGenerationRuns(db: any, cam: string) {
  return db
    .prepare('SELECT * FROM generation_run WHERE campaign_id=? ORDER BY rowid DESC LIMIT 50')
    .all(cam)
    .map((r: any) => {
      const run = generationRunRow(db, r);
      return { id: run.id, seed: run.seed, title: run.request.title, count: run.plans.length };
    });
}
export function generateEncounters(
  db: any,
  cam: string,
  request: GenerationRequest,
): GenerationRun {
  return db
    .transaction(() => {
      const r = structuredClone(request);
      if (
        !r ||
        typeof r.seed !== 'string' ||
        !r.seed.trim() ||
        r.seed.length > 1000 ||
        !Array.isArray(r.tableIds) ||
        new Set(r.tableIds).size !== r.tableIds.length ||
        r.tableIds.length > 1000 ||
        !Array.isArray(r.party) ||
        !r.party.length ||
        !Number.isSafeInteger(r.count) ||
        r.count < 1 ||
        r.count > 20 ||
        typeof r.title !== 'string' ||
        r.title.length > 1000 ||
        typeof r.habitat !== 'string' ||
        !['any', 'day', 'night'].includes(r.time)
      )
        throw new Error('Generierung benötigt Seed, bekannte Planungsparty und 1–20 Vorschläge.');
      if (
        r.xpCeiling !== undefined &&
        r.xpCeiling !== null &&
        (!Number.isSafeInteger(r.xpCeiling) || r.xpCeiling < 0)
      )
        throw new Error('XP-Obergrenze benötigt eine nichtnegative ganze Zahl.');
      const basis = assessEncounter(r.party, []);
      if (basis.unknownLevels) throw new Error('Für die Generierung fehlen Party-Level.');
      const registry = readGeneratorRegistry(db, cam),
        preset = registry.presets.find((p) => p.id === registry.effectiveId)!,
        config = checkedGeneratorConfig({
          ...preset.config,
          generationDefaults: {
            difficulty: r.difficulty,
            amount: r.amount,
            balance: r.balance,
            diversity: r.diversity,
          },
        });
      if (
        r.fillPlan !== undefined &&
        (!r.fillPlan ||
          typeof r.fillPlan !== 'object' ||
          Array.isArray(r.fillPlan) ||
          typeof r.fillPlan.id !== 'string' ||
          !r.fillPlan.id ||
          !Number.isSafeInteger(r.fillPlan.revision) ||
          r.fillPlan.revision < 1)
      )
        throw new Error('Auffüllen benötigt eine gespeicherte Vorlage mit gültiger Revision.');
      const fixed = r.fillPlan ? readEncounterPlan(db, cam, r.fillPlan.id) : undefined;
      if (
        r.fillPlan &&
        (!Number.isSafeInteger(r.fillPlan.revision) ||
          r.fillPlan.revision < 1 ||
          fixed!.revision !== r.fillPlan.revision)
      )
        throw new Error('Auffüllbasis geändert. Vorlage speichern und Vorschau neu erzeugen.');
      if (fixed && !fixed.entries.length)
        throw new Error('Zum Auffüllen benötigt die Vorlage mindestens einen vorhandenen Gegner.');
      const fixedActors = fixed?.entries.flatMap((e) => e.worldActorIds ?? []) ?? [];
      if (
        Array.isArray(r.requiredNpcIds) &&
        r.requiredNpcIds.some((id) => fixedActors.includes(id))
      )
        throw new Error(
          'Ein verbindlicher NPC ist bereits in der festen Vorlage enthalten. Nicht erneut als Ergänzung auswählen.',
        );
      const required = requiredGenerationNpcs(db, cam, r);
      const npcOnly = r.npcOnly === true,
        mixed = r.includeNpcs === true && !npcOnly,
        named = npcOnly || mixed ? generationNpcs(db, cam, r, fixedActors) : null;
      const world = npcOnly
        ? { tableIds: r.tableIds, caps: new Map<string, number>(), basis: null, snapshot: null }
        : resolveWorldSources(db, cam, r, readEncounterTables(db, cam, true));
      for (const e of fixed?.entries ?? []) {
        const available = world.caps.get(e.creatureId);
        if (available !== undefined) {
          if (available < e.count)
            throw new Error(
              'Die feste Vorlage überschreitet den verfügbaren Fraktionsbestand. Quelle oder Vorlage prüfen.',
            );
          world.caps.set(e.creatureId, available - e.count);
        }
      }
      for (const n of required) {
        const available = world.caps.get(n.creatureId);
        if (available !== undefined) {
          if (available < 1)
            throw new Error(
              n.name + ': verbindliche NPCs überschreiten den verfügbaren Fraktionsbestand.',
            );
          world.caps.set(n.creatureId, available - 1);
        }
      }
      const selected = world.tableIds.map((id) => readTable(db, cam, id));
      if (selected.some((t) => t.trashed)) throw new Error('Gewählte Tabelle liegt im Papierkorb.');
      const tables = selected.filter(
        (t) =>
          (!t.habitats.length || t.habitats.includes(r.habitat)) &&
          (t.time === 'any' || t.time === r.time),
      );
      if (selected.length && !tables.length)
        throw new Error('Die gewählten Tabellen passen nicht zu Umgebung und Tageszeit.');
      const rows = [];
      let offset = 0;
      do {
        const page = searchCreatures({
          ...r.filters,
          ...(named ? { text: '' } : {}),
          offset,
          limit: 100,
        });
        rows.push(...page.rows);
        offset += 100;
        if (offset >= page.total) break;
      } while (true);
      const catalogMatches = new Set(rows.map((c) => c.id));
      if (mixed && r.filters.text) {
        catalogMatches.clear();
        let cursor = 0;
        do {
          const page = searchCreatures({ ...r.filters, offset: cursor, limit: 100 });
          for (const c of page.rows) catalogMatches.add(c.id);
          cursor += 100;
          if (cursor >= page.total) break;
        } while (true);
      }
      const namedTypes = new Set(named?.npcs.map((n) => n.creatureId) ?? []);
      if (named)
        for (const id of namedTypes) {
          const quantity = named.npcs.filter((n) => n.creatureId === id).length;
          if (npcOnly) world.caps.set(id, quantity);
          else if (!catalogMatches.has(id))
            world.caps.set(id, Math.min(quantity, world.caps.get(id) ?? Infinity));
        }

      const entries = new Map<string, string[]>();
      for (const t of tables)
        for (const e of t.entries) {
          const list = entries.get(e.creatureId) ?? [];
          list.push(e.weight);
          entries.set(e.creatureId, list);
        }
      const candidates = rows
        .filter(
          (c) =>
            (!npcOnly || namedTypes.has(c.id)) &&
            (!mixed || catalogMatches.has(c.id) || namedTypes.has(c.id)) &&
            (!selected.length || entries.has(c.id)) &&
            (r.xpCeiling === undefined || r.xpCeiling === null || c.xp <= r.xpCeiling),
        )
        .map((c) => {
          const weights = entries.get(c.id) ?? ['1'],
            scale = Math.max(...weights.map((w) => exactWeight(w).split('.')[1]?.length ?? 0)),
            integer = integerWeights(weights).reduce((a, b) => a + b, 0n);
          const denominator = 10n ** BigInt(scale),
            weight =
              (integer / denominator).toString() +
              (scale ? '.' + (integer % denominator).toString().padStart(scale, '0') : '');
          return { creature: readCreature(c.id), weight: exactWeight(weight) };
        })
        .filter(
          (c) =>
            (world.caps.get(c.creature.id) ?? Infinity) > 0 &&
            integerWeights([c.weight])[0]! > 0n &&
            (!r.habitat || c.creature.biomes.includes(r.habitat)),
        );
      if (!candidates.length && !required.length && !fixed?.entries.length)
        throw new Error(
          npcOnly
            ? 'Keine verfügbaren feindlichen NPCs mit Statblock und positiven HP nach Ort, Fraktion, Tabellen und Filtern. Es werden keine Ersatzfiguren erzeugt.'
            : mixed
              ? 'Keine passenden Tabellen- oder NPC-Kandidaten innerhalb der gewählten Quellen und Bestandsgrenzen.'
              : 'Keine Kreaturen nach Tabellenbedingungen und Katalogfiltern. Es wird keine Ersatzquelle gewählt.',
        );
      const challengeRatings: CompositionCatalog['challengeRatings'][number][] = [];
      const grouped = new Map<string, typeof candidates>();
      for (const c of candidates) {
        const cr =
            c.creature.cr === 0.125
              ? '1/8'
              : c.creature.cr === 0.25
                ? '1/4'
                : c.creature.cr === 0.5
                  ? '1/2'
                  : String(c.creature.cr),
          key = cr + '|' + c.creature.xp,
          list = grouped.get(key) ?? [];
        list.push(c);
        grouped.set(key, list);
      }
      for (const [key, list] of grouped)
        challengeRatings.push({
          id: key,
          code: list[0]!.creature.cr,
          label: key.split('|')[0]!,
          xp: list[0]!.creature.xp,
          active: true,
          availableQuantity: list.some((c) => !world.caps.has(c.creature.id))
            ? null
            : list.reduce((n, c) => n + world.caps.get(c.creature.id)!, 0),
          maximumSingleQuantity: list.some((c) => !world.caps.has(c.creature.id))
            ? null
            : Math.max(...list.map((c) => world.caps.get(c.creature.id)!)),
          availableStatblocks: list.length,
        });
      const average = Math.max(
          1,
          Math.min(
            20,
            Math.round(r.party.reduce((sum, p) => sum + p.level! * p.count, 0) / basis.partySize),
          ),
        ),
        index = buildSelectionIndex({ challengeRatings }, average, config),
        seed = parseInt(hash(r.seed).slice(0, 8), 16),
        warnings: string[] = [];
      if (fixed)
        warnings.push(
          'Auffüllen: ' +
            fixed.name +
            ' r' +
            fixed.revision +
            ' bleibt mit ' +
            fixed.entries.reduce((n, e) => n + e.count, 0) +
            ' vorhandenen Gegnern unverändert. Filter und Kompositionsregeln gelten den Ergänzungen; XP-Ziel und weiche Bereiche gelten der gesamten Begegnung.',
        );
      if (new Set(tables.map((t) => t.lootTableId).filter(Boolean)).size > 1)
        warnings.push(
          'Loot-Konflikt: Die gewählten Encounter-Tabellen verweisen auf unterschiedliche Loot-Tabellen.',
        );
      const plans: GenerationRun['plans'] = [];
      for (let ordinal = 0; ordinal < r.count; ordinal++) {
        const difficulty =
          r.difficulty === 'weighted'
            ? (['trivial', 'easy', 'medium', 'hard', 'deadly'] as const)[
                weightedIndex(
                  Object.values(config.scene.difficultyWeights).map(String),
                  r.seed + '|difficulty|' + ordinal,
                )
              ]!
            : r.difficulty;
        const totals = basis.thresholds,
          target =
            r.targetXp ??
            (difficulty === 'trivial'
              ? Math.max(1, Math.round(totals[0]! / 2))
              : difficulty === 'easy'
                ? Math.round((totals[0]! + totals[1]!) / 2)
                : difficulty === 'medium'
                  ? Math.round((totals[1]! + totals[2]!) / 2)
                  : difficulty === 'hard'
                    ? Math.round((totals[2]! + totals[3]!) / 2)
                    : Math.round(totals[3]! * 1.1));
        const entropy = {
            modulo: (stream: string, modulus: number) =>
              Number(BigInt('0x' + hash(stream)) % BigInt(modulus)),
            unit: (stream: string) => parseInt(hash(stream).slice(0, 13), 16) / 0x10000000000000,
          },
          result = selectEncounter(
            seed,
            ordinal,
            target,
            index,
            entropy,
            config,
            basis.partySize,
            {
              units: [
                ...(fixed?.entries ?? []).map((e) => ({
                  unitXp: fixed!.sources.find((c) => c.id === e.creatureId)!.xp,
                  quantity: e.count,
                })),
                ...required.map((n) => ({ unitXp: readCreature(n.creatureId).xp, quantity: 1 })),
              ],
              statblockCount: new Set([
                ...(fixed?.entries ?? []).map((e) => e.creatureId),
                ...required.map((n) => n.creatureId),
              ]).size,
              initiativeSlots:
                (fixed?.entries ?? []).reduce((n, e) => n + (e.grouped ? 1 : e.count), 0) +
                required.length,
            },
            r.xpCeiling ?? Infinity,
          );
        if (!result.composition || !result.candidate)
          throw new Error(
            'Keine Lösung: Preset, Quellen, verfügbare Bestände und XP-Obergrenze ergeben keine gültige Komposition.',
          );
        const remaining = new Map(world.caps);
        const blocks = result.composition.blocks,
          planEntries: EncounterPlan['entries'] = [
            ...(fixed?.entries ?? []).map((e) => ({ ...structuredClone(e), id: randomUUID() })),
            ...required.map((n) => ({
              id: randomUUID(),
              creatureId: n.creatureId,
              count: 1,
              grouped: false,
              worldActorIds: [n.id],
              actorNames: [n.name],
            })),
          ],
          sources: EncounterPlan['sources'] = [
            ...new Map(
              [...(fixed?.sources ?? []), ...required.map((n) => readCreature(n.creatureId))].map(
                (c) => [c.id, c],
              ),
            ).values(),
          ];
        for (let b = 0; b < blocks.length; b++) {
          const block = blocks[b]!,
            source = challengeRatings.find(
              (c) =>
                c.label === block.challengeRating && c.xp === result.candidate!.blocks[b]!.cr.xp,
            );
          const pool = grouped.get(source!.id)!.slice();
          if (pool.length < block.statblockSlots)
            throw new Error(
              'Die konkrete Statblockkapazität reicht nicht für die gewählte Komposition.',
            );
          for (let slot = 0; slot < block.statblockSlots; slot++) {
            const quantity =
                Math.floor(block.quantity / block.statblockSlots) +
                (slot < block.quantity % block.statblockSlots ? 1 : 0),
              eligible = pool.filter((c) => (remaining.get(c.creature.id) ?? Infinity) >= quantity);
            if (!eligible.length)
              throw new Error(
                'Keine Lösung für diese Komposition innerhalb des Fraktionsbestands. Menge, Schwierigkeit oder Quellen ändern.',
              );
            const chosen =
              eligible[
                weightedIndex(
                  eligible.map((c) => c.weight),
                  r.seed + '|materialize|' + ordinal + '|' + b + '|' + slot,
                )
              ]!;
            pool.splice(pool.indexOf(chosen), 1);
            if (remaining.has(chosen.creature.id))
              remaining.set(chosen.creature.id, remaining.get(chosen.creature.id)! - quantity);
            const identities = named?.npcs
              .filter(
                (n) =>
                  n.creatureId === chosen.creature.id &&
                  !planEntries.some((e) => e.worldActorIds?.includes(n.id)),
              )
              .sort((a, b) =>
                hash(r.seed + '|npc|' + ordinal + '|' + a.id).localeCompare(
                  hash(r.seed + '|npc|' + ordinal + '|' + b.id),
                ),
              )
              .slice(0, quantity);
            if (npcOnly && identities?.length !== quantity)
              throw new Error('NPC-Bestand reicht nicht für diese Komposition.');
            planEntries.push({
              id: randomUUID(),
              creatureId: chosen.creature.id,
              count: quantity,
              grouped: config.combat.mobThreshold > 0 && quantity >= config.combat.mobThreshold,
              ...(mixed ? { allowAnonymous: true } : {}),
              ...(identities?.length
                ? {
                    worldActorIds: identities.map((n) => n.id),
                    actorNames: identities.map((n) => n.name),
                  }
                : {}),
            });
            if (!sources.some((c) => c.id === chosen.creature.id)) sources.push(chosen.creature);
          }
        }
        const assessment = assessEncounter(
          r.party,
          planEntries.map((e) => ({
            xp: sources.find((c) => c.id === e.creatureId)!.xp,
            count: e.count,
          })),
        );
        if (!result.selectedFit)
          warnings.push(
            'Vorschlag ' +
              (ordinal + 1) +
              ': nächster gültiger Treffer außerhalb des ±5%-XP-Zielbands.',
          );
        for (const d of result.composition.diagnostics)
          warnings.push(
            'Vorschlag ' +
              (ordinal + 1) +
              ': ' +
              {
                statblocks: 'Statblocks',
                monsters: 'Kreaturen',
                initiativeSlots: 'Initiativeplätze',
              }[d.constraint] +
              ' ' +
              d.value +
              ' statt ' +
              d.minimum +
              '–' +
              d.maximum +
              '.',
          );
        plans.push({
          id: randomUUID(),
          revision: 0,
          name: (r.title || 'Generierte Begegnung') + (r.count > 1 ? ' ' + (ordinal + 1) : ''),
          notes:
            (fixed
              ? fixed.notes + '\n\nAuffüllbasis: ' + fixed.name + ' r' + fixed.revision + '\n'
              : '') +
            'Generiert mit Seed ' +
            r.seed +
            ' · Ziel ' +
            target +
            ' angepasste XP · ' +
            assessment.difficulty,
          party: r.party.map((p) => ({ ...p, id: randomUUID() })),
          entries: planEntries,
          sources,
          catalogHash: creatureInfo().hash,
          assessment,
          composition: result.composition,
        });
      }
      const lootTables = [
        ...new Set(tables.map((t) => t.lootTableId).filter((id): id is string => !!id)),
      ].map((id) => {
        const table = readLootTable(db, cam, id);
        return { id: table.id, revision: table.revision };
      });
      const run: GenerationRun = {
        ...(fixed ? { fixedRoster: structuredClone(fixed) } : {}),
        ...(named || required.length ? { npcBasis: [...required, ...(named?.basis ?? [])] } : {}),
        sourceBasis: world.basis,
        sourceSnapshot: world.snapshot,
        id: randomUUID(),
        revision: 1,
        seed: r.seed,
        request: r,
        preset: {
          id: preset.id,
          name: preset.name,
          revision: preset.revision,
          hash: preset.hash,
          mobThreshold: preset.config.combat.mobThreshold,
        },
        tables: selected.map((t) => ({ id: t.id, revision: t.revision })),
        lootTables,
        catalogHash: creatureInfo().hash,
        plans,
        warnings,
        candidates: candidates.map((c) => ({ creatureId: c.creature.id, weight: c.weight })),
        acceptedPlanIds: [],
      };
      const payload = json(run);
      db.prepare('INSERT INTO generation_run VALUES(?,?,?,?)').run(
        cam,
        run.id,
        payload,
        hash(payload),
      );
      return run;
    })
    .immediate();
}
export function assertGenerationSourcesCurrent(
  db: any,
  cam: string,
  run: GenerationRun,
  expectedRegistryRevision?: number,
) {
  if (run.request.fillPlan) {
    const plan = readEncounterPlan(db, cam, run.request.fillPlan.id);
    if (plan.revision !== run.request.fillPlan.revision)
      throw new Error(
        'Auffüllbasis geändert. Vorschau neu erzeugen; die bisherige Vorschau bleibt lesbar.',
      );
  }
  if (
    run.npcBasis !== undefined &&
    canonicalJson(
      [
        ...requiredGenerationNpcs(db, cam, run.request),
        ...(run.request.npcOnly || run.request.includeNpcs
          ? generationNpcs(
              db,
              cam,
              run.request,
              run.fixedRoster?.entries.flatMap((e) => e.worldActorIds ?? []),
            ).basis
          : []),
      ].sort((a, b) => a.id.localeCompare(b.id)),
    ) !== canonicalJson(run.npcBasis.slice().sort((a, b) => a.id.localeCompare(b.id)))
  )
    throw new Error('NPC-Zustand, Haltung oder Standort geändert. Vorschau neu erzeugen.');
  if (!run.request.npcOnly) {
    const current = resolveWorldSources(db, cam, run.request, readEncounterTables(db, cam, true));
    if (
      run.sourceSnapshot !== undefined
        ? canonicalJson(canonicalSourceSnapshot(current.snapshot)) !==
          canonicalJson(canonicalSourceSnapshot(run.sourceSnapshot))
        : run.sourceBasis !== undefined && current.basis !== run.sourceBasis
    )
      throw new Error('Weltquellen oder Fraktionsbestand geändert. Vorschau neu erzeugen.');
  }
  const registry = readGeneratorRegistry(db, cam);
  if (
    (expectedRegistryRevision !== undefined && registry.revision !== expectedRegistryRevision) ||
    registry.effectiveId !== run.preset.id ||
    registry.presets.find((p) => p.id === run.preset.id)?.hash !== run.preset.hash
  )
    throw new Error('Wirksames Preset hat sich geändert. Vorschau neu erzeugen.');
  for (const table of run.tables)
    if (readTable(db, cam, table.id).revision !== table.revision)
      throw new Error('Encounter-Tabelle geändert. Vorschau neu erzeugen.');
  if (run.catalogHash !== creatureInfo().hash)
    throw new Error('Katalog geändert. Vorschau neu erzeugen.');
}
export function acceptGeneration(
  db: any,
  command: {
    commandId: string;
    campaignId: string;
    token: string;
    runId: string;
    index: number;
    expectedRegistryRevision: number;
  },
  guard: () => void,
): EncounterPlan {
  return db
    .transaction(() => {
      guard();
      const cam = command.campaignId,
        fp = fingerprint(command),
        prior = db
          .prepare('SELECT * FROM generation_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (prior.campaign_id !== cam || prior.fingerprint !== fp)
          throw new Error('Änderungskennung bereits anders verwendet.');
        return decoded<EncounterPlan>(prior);
      }
      const run = readGenerationRun(db, cam, command.runId),
        plan = run.plans[command.index];
      if (!plan) throw new Error('Vorschlag nicht verfügbar.');
      // Existing preparations are independent authored records, not a new adoption.
      if (run.acceptedPlanIds[command.index])
        return readEncounterPlan(db, cam, run.acceptedPlanIds[command.index]!);
      assertGenerationSourcesCurrent(db, cam, run, command.expectedRegistryRevision);
      plan.generationOrigin = {
        runId: run.id,
        index: command.index,
        seed: run.seed,
        preset: run.preset,
      };
      const saved = saveEncounterPlan(
        db,
        {
          commandId: command.commandId + '|plan',
          campaignId: cam,
          token: command.token,
          plan,
          expectedRevision: null,
        },
        guard,
      );
      db.prepare('INSERT INTO generation_acceptance VALUES(?,?,?,?)').run(
        cam,
        run.id,
        command.index,
        saved.id,
      );
      const payload = json(saved);
      db.prepare('INSERT INTO generation_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return saved;
    })
    .immediate();
}

/** The installation editor and campaign generator use the same policy mutation. */
export function mutatePreset(
  db: any,
  cam: string | null,
  a: import('../campaign/generation-contracts').PresetAction,
) {
  const registry = readGeneratorRegistry(db, cam ?? '');
  if (registry.revision !== a.expectedRegistryRevision)
    throw new Error(
      'Preset-Registry geändert. Entwurf erhalten; Registry aktualisieren und bewusst erneut wählen.',
    );
  if (a.kind === 'preset-save') {
    const p = structuredClone(a.preset);
    if (
      !p?.id ||
      p.id === systemId ||
      p.system ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 1000
    )
      throw new Error('Nur benannte Preset-Kopien sind editierbar.');
    const old = registry.presets.find((c) => c.id === p.id);
    if (old ? old.revision !== p.revision : p.revision !== 0) throw new Error('Preset geändert.');
    p.config = checkedGeneratorConfig(p.config);
    p.revision = (old?.revision ?? 0) + 1;
    p.hash = hash(canonicalJson(p.config));
    const payload = json(p);
    db.prepare(
      'INSERT INTO generator_preset VALUES(?,?,0,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
    ).run(p.id, p.revision, payload, hash(payload));
  } else if (a.kind === 'preset-assign') {
    if (a.id !== null && !registry.presets.some((p) => p.id === a.id))
      throw new Error('Preset nicht verfügbar.');
    if (!cam) throw new Error('Wähle eine Kampagne für die Zuweisung.');
    if (a.id === null || a.id === systemId)
      db.prepare('DELETE FROM generator_assignment WHERE campaign_id=?').run(cam);
    else
      db.prepare(
        'INSERT INTO generator_assignment VALUES(?,?) ON CONFLICT(campaign_id) DO UPDATE SET preset_id=excluded.preset_id',
      ).run(cam, a.id);
  } else if (a.kind === 'preset-delete') {
    if (!a.id || a.id === systemId) throw new Error('Systempreset ist geschützt.');
    if (!registry.presets.some((p) => p.id === a.id)) throw new Error('Preset nicht verfügbar.');
    db.prepare('DELETE FROM generator_preset WHERE id=?').run(a.id);
  } else throw new Error('Unbekannte Generatoraktion.');
  db.prepare('UPDATE generator_meta SET revision=revision+1 WHERE id=1').run();
}
