import { createHash, randomUUID } from 'node:crypto';
import type {
  CampaignOverview,
  ConflictChoice,
  DefinitionConflict,
  SharedKind,
} from '../campaign/campaign-contracts';
import { canonicalJson } from '../campaign/generation/canonical-json';
import { checkedSessionRecapDraft } from '../runtime/live-contracts';
import { type CampaignRename, type Room } from '../shared/contracts';
import { validateRoom } from '../shared/room-validation';
import {
  assertTransferCoverage,
  transferContext,
  transferRow,
  transferTables,
} from '../transfer/registry';
import { createCampaignAtlas } from './campaign-atlas';
import { installCampaignCatalog, noteCampaignCreated } from './campaign-catalog';
import { drawingTables } from './drawing';
import { dungeonGeometry, dungeonGeometryBasis } from './dungeon-play';
import { dungeonTraceById } from './dungeon-senses';
import { readEncounterTables } from './generation';
import { ensureLiveOwners } from './live';
import { checkedAudioRegistry, musicStateAssetCount } from './music';
import { installNoteSourceHistory, validateNoteSourceHistory } from './note-source-history';
import { npcFingerprint, validateNpcRecovery } from './npcs';
import { readWorld, travelEnvironmentBasis } from './world';
import { validateWorldRelationPairs, worldRelationPairFingerprint } from './world-relation-pair';
import { resolveWorldSources } from './world-sources';
export const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
export const digest = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export function installCampaignSchema(db: any) {
  installCampaignCatalog(db);
  installNoteSourceHistory(db);
  db.exec(`CREATE TABLE IF NOT EXISTS campaign_lifecycle(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),revision INTEGER NOT NULL,trashed INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE TABLE IF NOT EXISTS campaign_origin(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),source_id TEXT NOT NULL,source_name TEXT NOT NULL,local_map TEXT NOT NULL,original_database BLOB NOT NULL,checksum TEXT NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS campaign_management_receipt(command_id TEXT PRIMARY KEY,subject_id TEXT NOT NULL,fingerprint TEXT NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS campaign_capability(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,capability TEXT NOT NULL,version INTEGER NOT NULL,references_json TEXT NOT NULL,body BLOB NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS campaign_erasure(id TEXT PRIMARY KEY,name TEXT NOT NULL,phase TEXT NOT NULL,recorded_at TEXT NOT NULL) STRICT;
 INSERT OR IGNORE INTO campaign_lifecycle(campaign_id,revision,trashed) SELECT id,0,0 FROM campaign;`);
}
export function validateCapabilityBytes(db: any) {
  for (const row of db
    .prepare('SELECT id,body,checksum,references_json FROM campaign_capability')
    .iterate()) {
    if (digest(row.body) !== row.checksum)
      throw new Error('Fremde Capabilitybytes sind beschädigt. Originaldaten bleiben erhalten.');
    try {
      JSON.parse(row.references_json);
    } catch {
      throw new Error(
        'Capability-Referenzdaten sind nicht lesbar. Originaldaten bleiben erhalten.',
      );
    }
  }
}
// The checksum covers only the opaque provenance bytes, not the ID map.
// A valid map shape therefore cannot authorize historical relationship repairs.
export function validateCampaignOrigins(db: any) {
  for (const row of db
    .prepare('SELECT original_database,checksum,local_map FROM campaign_origin')
    .iterate()) {
    if (digest(row.original_database) !== row.checksum)
      throw new Error('Kampagnenherkunft ist beschädigt. Originaldaten bleiben erhalten.');
    let mapping: unknown;
    try {
      mapping = JSON.parse(row.local_map);
    } catch {
      throw new Error(
        'Zuordnung der Kampagnenherkunft ist nicht lesbar. Originaldaten bleiben erhalten.',
      );
    }
    if (
      !mapping ||
      typeof mapping !== 'object' ||
      Array.isArray(mapping) ||
      Object.values(mapping).some((value) => typeof value !== 'string')
    )
      throw new Error(
        'Zuordnung der Kampagnenherkunft hat ein ungültiges Format. Originaldaten bleiben erhalten.',
      );
  }
}
function campaignSettingKeys(campaignId: string) {
  return [
    'preparation:' + campaignId,
    'default-scope:' + campaignId,
    'session-recap:' + campaignId,
  ];
}
export function validateCampaignSnapshotSettings(db: any, campaignId: string) {
  const allowed = new Set(campaignSettingKeys(campaignId));
  for (const row of db.prepare('SELECT key,value FROM settings').iterate()) {
    if (!allowed.has(row.key))
      throw new Error(
        'Kampagnenpaket enthält lokale oder fremde Einstellungen. Sie dürfen nicht übernommen werden.',
      );
    if (row.key === 'session-recap:' + campaignId) checkedSessionRecapDraft(JSON.parse(row.value));
  }
}
export function campaignOverview(db: any): CampaignOverview[] {
  return db
    .prepare(
      'SELECT c.*,l.revision AS trashRevision,l.trashed,u.created_at,u.last_opened_at FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id LEFT JOIN campaign_usage u ON u.campaign_id=c.id ORDER BY l.trashed,u.last_opened_at DESC,u.created_at DESC,c.id',
    )
    .all()
    .map((r: any) => {
      const count = (table: string) =>
        db.prepare(`SELECT count(*) n FROM ${quote(table)} WHERE campaign_id=?`).get(r.id).n;
      return {
        id: r.id,
        name: r.name,
        revision: r.revision,
        createdAt: r.created_at ?? null,
        lastOpenedAt: r.last_opened_at ?? null,
        trashRevision: r.trashRevision,
        trashed: !!r.trashed,
        rooms: count('room'),
        locations: count('location'),
        characters: count('roster_member'),
        notes: count('world_note'),
        maps: db
          .prepare("SELECT count(*) n FROM world_record WHERE campaign_id=? AND kind='map'")
          .get(r.id).n,
        audio: musicStateAssetCount(db, r.id),
      };
    });
}
export function tableInfo(db: any) {
  return db
    .prepare(
      "SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'note_search_%'",
    )
    .all()
    .map((r: any) => ({
      ...r,
      columns: db.prepare('SELECT name,type,pk FROM pragma_table_info(?) ORDER BY cid').all(r.name),
    }));
}
const sharedTables = [
  'authored_item',
  'item_definition',
  'item_definition_version',
  'generator_preset',
  'audio_asset',
];
export function pruneCampaignSnapshot(db: any, sourceId: string) {
  assertTransferCoverage(db);
  db.pragma('foreign_keys=OFF');
  const tables = tableInfo(db);
  if (!db.prepare('SELECT id FROM campaign WHERE id=?').get(sourceId))
    throw new Error('Quellkampagne fehlt.');
  db.transaction(() => {
    for (const t of tables) {
      if (t.name === 'campaign') {
        db.prepare('DELETE FROM campaign WHERE id!=?').run(sourceId);
        continue;
      }
      if (t.columns.some((c: any) => c.name === 'campaign_id'))
        db.prepare(
          `DELETE FROM ${quote(t.name)} WHERE campaign_id IS NOT NULL AND campaign_id!=?`,
        ).run(sourceId);
    }
    db.exec('DELETE FROM live_receipt WHERE command_id NOT IN(SELECT command_id FROM receipt);');
    db.prepare('DELETE FROM settings WHERE key NOT IN (?,?,?)').run(
      ...campaignSettingKeys(sourceId),
    );
    db.exec(
      'DELETE FROM campaign_management_receipt;DELETE FROM campaign_erasure;DELETE FROM campaign_catalog_receipt;DELETE FROM campaign_usage;DELETE FROM generator_registry_receipt;',
    ); // Installation collections remain closed inputs to generation and autoplay.
  }).immediate();
  db.exec('VACUUM');
  db.pragma('foreign_keys=ON');
}
export function snapshotCounts(db: any) {
  return tableInfo(db)
    .filter((t: any) => !t.name.startsWith('campaign_management'))
    .map((t: any) => ({
      table: t.name,
      records: db.prepare(`SELECT count(*) n FROM ${quote(t.name)}`).get().n,
    }))
    .filter((t: any) => t.records > 0);
}
function comparable(row: any) {
  if (row.payload) return canonicalJson(JSON.parse(row.payload));
  return canonicalJson(Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'checksum')));
}
export function definitionConflicts(destination: any, source: any): DefinitionConflict[] {
  const conflicts: DefinitionConflict[] = [],
    kinds: Record<string, SharedKind> = {
      item_definition: 'item',
      authored_item: 'item',
      generator_preset: 'preset',
      audio_asset: 'audio',
      encounter_table: 'table',
    };
  let campaignCount: number | undefined;
  const affected = () =>
    (campaignCount ??= destination.prepare('SELECT count(*) n FROM campaign').get().n);
  const definitionExists = source.prepare('SELECT id FROM item_definition WHERE id=?');
  for (const [table, kind] of Object.entries(kinds)) {
    const existingRow = destination.prepare(`SELECT * FROM ${quote(table)} WHERE id=?`);
    for (const row of source
      .prepare(
        `SELECT * FROM ${quote(table)}${table === 'encounter_table' ? ' WHERE campaign_id IS NULL' : ''}`,
      )
      .iterate()) {
      if (table === 'authored_item' && definitionExists.get(row.id)) continue;
      const old = existingRow.get(row.id);
      if (!old || comparable(old) === comparable(row)) continue;
      const incoming = row.payload ? JSON.parse(row.payload) : row,
        existing = old.payload ? JSON.parse(old.payload) : old;
      conflicts.push({
        key: kind + ':' + row.id,
        kind,
        id: row.id,
        name: incoming.name ?? row.id,
        incoming: JSON.stringify(incoming),
        existing: JSON.stringify(existing),
        affectedCampaigns: affected(),
      });
    }
  }
  const incoming = source.prepare("SELECT * FROM audio_registry WHERE id='main'").get(),
    existing = destination.prepare("SELECT * FROM audio_registry WHERE id='main'").get();
  if (incoming && existing) {
    const incomingRegistry = checkedAudioRegistry(incoming),
      existingAxes = new Map(checkedAudioRegistry(existing).axes.map((axis) => [axis.id, axis]));
    for (const axis of incomingRegistry.axes) {
      const old = existingAxes.get(axis.id);
      if (old && canonicalJson(old) !== canonicalJson(axis))
        conflicts.push({
          key: 'mood:' + axis.id,
          kind: 'mood',
          id: axis.id,
          name: axis.name,
          incoming: JSON.stringify(axis),
          existing: JSON.stringify(old),
          affectedCampaigns: affected(),
        });
    }
  }
  return conflicts;
}
export interface RemapResult {
  campaignId: string;
  local: Map<string, string>;
  shared: Map<string, string>;
  historical: Map<string, string>;
}
export interface SharedPlan {
  mapping: Map<string, string>;
  history: Map<string, string>;
  replace: { table: string; id: string }[];
  reuse: { table: string; id: string }[];
  archive: { db: 'source' | 'destination'; oldId: string; newId: string }[];
  axisChoices: Record<string, ConflictChoice>;
}
export function sharedPlan(
  destination: any,
  source: any,
  choices: Record<string, ConflictChoice>,
): SharedPlan {
  const conflicts = definitionConflicts(destination, source),
    byKey = new Map(conflicts.map((c) => [c.key, c])),
    archivedItems = new Set<string>(),
    result: SharedPlan = {
      mapping: new Map(),
      history: new Map(),
      replace: [],
      reuse: [],
      archive: [],
      axisChoices: {},
    };
  for (const conflict of conflicts)
    if (!['keep-current', 'keep-imported', 'keep-both'].includes(choices[conflict.key]!))
      throw new Error('Entscheide jeden Definitionskonflikt vor der Übernahme.');
  for (const table of [...sharedTables, 'encounter_table']) {
    const existingRow = destination.prepare(`SELECT id FROM ${quote(table)} WHERE id=?`);
    for (const row of source
      .prepare(
        `SELECT * FROM ${quote(table)}${table === 'encounter_table' ? ' WHERE campaign_id IS NULL' : ''}`,
      )
      .iterate()) {
      const kind: SharedKind = [
          'authored_item',
          'item_definition',
          'item_definition_version',
        ].includes(table)
          ? 'item'
          : table === 'audio_asset'
            ? 'audio'
            : table === 'generator_preset'
              ? 'preset'
              : 'table',
        conflict = byKey.get(kind + ':' + row.id),
        choice = conflict ? choices[conflict.key]! : 'keep-current',
        old = existingRow.get(row.id);
      if (!result.mapping.has(row.id))
        result.mapping.set(row.id, conflict && choice === 'keep-both' ? randomUUID() : row.id);
      if (old && (!conflict || choice === 'keep-current')) result.reuse.push({ table, id: row.id });
      if (old && conflict && choice === 'keep-imported') result.replace.push({ table, id: row.id });
      if (conflict && kind === 'item' && !archivedItems.has(row.id)) {
        archivedItems.add(row.id);
        if (choice === 'keep-current') {
          const id = randomUUID();
          result.history.set(row.id, id);
          result.archive.push({ db: 'source', oldId: row.id, newId: id });
        } else if (choice === 'keep-imported')
          result.archive.push({ db: 'destination', oldId: row.id, newId: randomUUID() });
      }
    }
  }
  const audio = source.prepare("SELECT * FROM audio_registry WHERE id='main'").get();
  if (audio)
    for (const axis of checkedAudioRegistry(audio).axes) {
      const key = 'mood:' + axis.id,
        conflict = byKey.get(key),
        choice = conflict ? choices[key]! : 'keep-current';
      result.mapping.set(axis.id, conflict && choice === 'keep-both' ? randomUUID() : axis.id);
      result.axisChoices[axis.id] = choice;
    }
  return result;
}
function archiveItem(db: any, oldId: string, newId: string) {
  const head = db.prepare('SELECT * FROM item_definition WHERE id=?').get(oldId),
    legacy = db.prepare('SELECT * FROM authored_item WHERE id=?').get(oldId);
  if (!legacy) throw new Error('Gegenstandsbestand fehlt.');
  const old = head
    ? JSON.parse(head.payload)
    : {
        id: oldId,
        revision: legacy.revision,
        name: legacy.name,
        category: legacy.category,
        magic: legacy.category === 'magic',
        rarity: '',
        attunement: 'unspecified',
        unitCopper: legacy.unit_copper,
        weightText: '',
        properties: [],
        description: '',
        source: { kind: 'authored', label: 'Eigener Gegenstand', license: null, url: null },
        trashed: false,
      };
  for (const row of db.prepare('SELECT * FROM item_definition_version WHERE id=?').all(oldId)) {
    const d = { ...JSON.parse(row.payload), id: newId },
      payload = JSON.stringify(d);
    db.prepare('INSERT INTO item_definition_version VALUES(?,?,?,?)').run(
      newId,
      d.revision,
      payload,
      digest(payload),
    );
  }
  const d = { ...old, id: newId, revision: old.revision + 1, trashed: true },
    payload = JSON.stringify(d);
  db.prepare('INSERT INTO authored_item VALUES(?,?,?,?,?)').run(
    newId,
    d.revision,
    d.name,
    d.category,
    d.unitCopper ?? '0',
  );
  db.prepare('INSERT INTO item_definition VALUES(?,?,?,?)').run(
    newId,
    d.revision,
    payload,
    digest(payload),
  );
  db.prepare('INSERT INTO item_definition_version VALUES(?,?,?,?)').run(
    newId,
    d.revision,
    payload,
    digest(payload),
  );
}
export function archiveSourceChoices(source: any, plan: SharedPlan) {
  for (const a of plan.archive) if (a.db === 'source') archiveItem(source, a.oldId, a.newId);
}
function historicalAliases(db: any, oldId: string, newId: string) {
  const context = transferContext(
    (value) => value,
    (id) => (id === oldId ? newId : undefined),
  );
  for (const table of tableInfo(db)) {
    if (
      sharedTables.includes(table.name) ||
      transferTables[table.name]?.mode !== 'copy' ||
      !table.columns.some((c: any) => c.name === 'payload')
    )
      continue;
    for (const original of mutableRows(db, table.name, oldId)) {
      const { __rowid, ...row } = original,
        next = transferRow(table.name, row, context);
      if (next.payload !== row.payload) {
        const columns = ['payload', ...(Object.hasOwn(next, 'checksum') ? ['checksum'] : [])];
        db.prepare(
          `UPDATE ${quote(table.name)} SET ${columns.map((c) => quote(c) + '=?').join(',')} WHERE rowid=?`,
        ).run(...columns.map((c) => next[c]), __rowid);
      }
    }
  }
}
// original_database retains a compact provenance envelope; authored/history rows carry the actual facts.
// Never embed SQLite backups here: successive imports would recursively duplicate earlier databases.
export function publishSnapshot(
  destination: any,
  source: any,
  remap: RemapResult,
  plan: SharedPlan,
  original: Buffer,
  sourceId: string,
  sourceName: string,
  confirmation?: { commandId: string; fingerprint: string },
) {
  validateCampaignSnapshotSettings(source, remap.campaignId);
  const tables = tableInfo(source),
    targetTables = new Map(tableInfo(destination).map((t: any) => [t.name, t]));
  for (const t of tables) {
    const target: any = targetTables.get(t.name);
    if (
      !target ||
      canonicalJson(t.columns.map((c: any) => [c.name, c.type])) !==
        canonicalJson(target.columns.map((c: any) => [c.name, c.type]))
    )
      throw new Error(
        'Kampagnenformat wird von dieser Version nicht vollständig unterstützt: ' + t.name,
      );
  } // Reuse is scoped to a table: item heads and version rows may share an ID.
  const reused = new Map<string, Set<string>>();
  for (const row of plan.reuse) {
    let ids = reused.get(row.table);
    if (!ids) reused.set(row.table, (ids = new Set()));
    ids.add(row.id);
  }
  return destination
    .transaction(() => {
      destination.pragma('defer_foreign_keys=ON');
      for (const a of plan.archive)
        if (a.db === 'destination') {
          archiveItem(destination, a.oldId, a.newId);
          historicalAliases(destination, a.oldId, a.newId);
        }
      for (const replacement of plan.replace) {
        if (replacement.table === 'item_definition_version') continue;
        destination
          .prepare(`DELETE FROM ${quote(replacement.table)} WHERE id=?`)
          .run(replacement.id);
      }
      for (const id of new Set(
        plan.replace
          .filter((r) => r.table === 'item_definition' || r.table === 'authored_item')
          .map((r) => r.id),
      ))
        destination.prepare('DELETE FROM item_definition_version WHERE id=?').run(id);
      for (const t of tables) {
        if (
          [
            'generator_meta',
            'audio_registry',
            'campaign_management_receipt',
            'campaign_erasure',
            'campaign_usage',
          ].includes(t.name)
        )
          continue;
        const columns = t.columns.map((c: any) => c.name),
          insert = destination.prepare(
            `INSERT INTO ${quote(t.name)}(${columns.map(quote).join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
          );
        const shared = sharedTables.includes(t.name) || t.name === 'encounter_table',
          existingRow = shared
            ? destination.prepare(
                t.name === 'item_definition_version'
                  ? 'SELECT payload FROM item_definition_version WHERE id=? AND revision=?'
                  : `SELECT id FROM ${quote(t.name)} WHERE id=?`,
              )
            : null;
        for (const row of source.prepare(`SELECT * FROM ${quote(t.name)}`).iterate()) {
          if (
            (t.name === 'encounter_table' && row.campaign_id === null) ||
            sharedTables.includes(t.name)
          ) {
            if (reused.get(t.name)?.has(row.id)) continue;
            const existing =
              t.name === 'item_definition_version'
                ? existingRow!.get(row.id, row.revision)
                : existingRow!.get(row.id);
            if (existing) {
              if (t.name === 'item_definition_version' && existing.payload !== row.payload)
                throw new Error(
                  'Historischer Definitionskonflikt wurde nicht vollständig entschieden.',
                );
              continue;
            }
          }
          if (t.name === 'campaign_origin') continue;
          if (
            t.name === 'settings' &&
            destination.prepare('SELECT key FROM settings WHERE key=?').get(row.key)
          )
            continue;
          insert.run(...columns.map((c: string) => row[c]));
        }
      }
      const srcRegistry = source.prepare("SELECT * FROM audio_registry WHERE id='main'").get();
      if (srcRegistry) {
        const existing = destination.prepare("SELECT * FROM audio_registry WHERE id='main'").get(),
          incoming = checkedAudioRegistry(srcRegistry),
          r = existing
            ? checkedAudioRegistry(existing)
            : { revision: 0, catalogRevision: 0, axes: [] };
        for (const axis of incoming.axes) {
          const index = r.axes.findIndex((a: any) => a.id === axis.id);
          if (index < 0) r.axes.push(axis);
          else if (plan.axisChoices[axis.id] === 'keep-imported') r.axes[index] = axis;
        }
        r.revision++;
        r.catalogRevision++;
        const payload = JSON.stringify(r),
          checksum = digest(payload);
        checkedAudioRegistry({ id: 'main', revision: r.revision, payload, checksum });
        destination
          .prepare(
            "INSERT INTO audio_registry VALUES('main',?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum",
          )
          .run(r.revision, payload, checksum);
      }
      noteCampaignCreated(destination, remap.campaignId);
      destination.prepare('UPDATE generator_meta SET revision=revision+1 WHERE id=1').run();
      destination
        .prepare('INSERT INTO campaign_origin VALUES(?,?,?,?,?,?)')
        .run(
          remap.campaignId,
          sourceId,
          sourceName,
          JSON.stringify(Object.fromEntries(remap.local)),
          original,
          digest(original),
        );
      if (confirmation)
        destination
          .prepare('INSERT INTO campaign_management_receipt VALUES(?,?,?)')
          .run(confirmation.commandId, remap.campaignId, confirmation.fingerprint);
      if (destination.pragma('foreign_key_check').length)
        throw new Error('Import enthält nicht aufgelöste Beziehungen.');
      return destination
        .prepare('SELECT id,name,revision FROM campaign WHERE id=?')
        .get(remap.campaignId);
    })
    .immediate();
}
export function trashCampaign(
  db: any,
  command: { commandId: string; id: string; expectedRevision: number; trashed: boolean },
) {
  return db
    .transaction(() => {
      const fp = digest(JSON.stringify(command)),
        receipt = db
          .prepare('SELECT fingerprint FROM campaign_management_receipt WHERE command_id=?')
          .get(command.commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp) throw new Error('Verwaltungskennung anders verwendet.');
        return;
      }
      const row = db
        .prepare('SELECT revision FROM campaign_lifecycle WHERE campaign_id=?')
        .get(command.id);
      if (!row || row.revision !== command.expectedRevision)
        throw new Error('Kampagnenstatus geändert.');
      db.prepare(
        'UPDATE campaign_lifecycle SET revision=revision+1,trashed=? WHERE campaign_id=?',
      ).run(command.trashed ? 1 : 0, command.id);
      db.prepare('INSERT INTO campaign_management_receipt VALUES(?,?,?)').run(
        command.commandId,
        command.id,
        fp,
      );
    })
    .immediate();
}
export function eraseCampaignRows(
  db: any,
  command: { commandId: string; id: string; expectedRevision: number; confirmName: string },
) {
  return db
    .transaction(() => {
      const c = db
        .prepare(
          'SELECT c.name,l.revision,l.trashed FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=?',
        )
        .get(command.id);
      if (
        !c ||
        c.revision !== command.expectedRevision ||
        !c.trashed ||
        command.confirmName !== c.name
      )
        throw new Error(
          'Permanente Löschung benötigt die aktuelle Kampagne im Papierkorb und ihren exakten Namen.',
        );
      db.pragma('defer_foreign_keys=ON');
      // Persist ownership before removing rows so a failed file cleanup can resume after restart.
      const images = [
        ...new Set(
          db
            .prepare('SELECT payload FROM player_asset WHERE campaign_id=?')
            .all(command.id)
            .map((r: any) => {
              const a = JSON.parse(r.payload);
              const name = 'images/' + a.sha256 + a.extension;
              if (!/^images\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(name))
                throw Error('Bilddateizuordnung beschädigt.');
              return name;
            }),
        ),
      ];
      db.prepare(
        'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      ).run('campaign-erasure-files:' + command.id, JSON.stringify(images));
      db.prepare("INSERT OR REPLACE INTO campaign_erasure VALUES(?,?,'cleanup',?)").run(
        command.id,
        'erased',
        new Date().toISOString(),
      );
      const receipts = db
        .prepare('SELECT command_id FROM receipt WHERE campaign_id=?')
        .all(command.id);
      for (const r of receipts)
        db.prepare('DELETE FROM live_receipt WHERE command_id=?').run(r.command_id);
      for (const t of tableInfo(db))
        if (t.columns.some((c: any) => c.name === 'campaign_id'))
          db.prepare(`DELETE FROM ${quote(t.name)} WHERE campaign_id=?`).run(command.id);
      db.prepare('DELETE FROM settings WHERE key IN(?,?,?)').run(
        ...campaignSettingKeys(command.id),
      );
      db.prepare("DELETE FROM settings WHERE key='active' AND value=?").run(command.id);
      db.prepare('DELETE FROM campaign WHERE id=?').run(command.id);
      db.prepare('DELETE FROM campaign_management_receipt WHERE subject_id=?').run(command.id);
    })
    .immediate();
}
// Finish each read before writing through the same SQLite connection.
// A live iterator forbids these writes; loading a whole table would retain all payloads.
function* mutableRows(db: any, table: string, containing?: string): Generator<any> {
  const filter = containing === undefined ? '' : 'instr(payload,?)>0';
  const args = containing === undefined ? [] : [containing];
  const first = db.prepare(
    `SELECT CAST(rowid AS TEXT) AS __rowid,* FROM ${quote(table)} ${filter ? 'WHERE ' + filter : ''} ORDER BY rowid LIMIT 1`,
  );
  const next = db.prepare(
    `SELECT CAST(rowid AS TEXT) AS __rowid,* FROM ${quote(table)} WHERE rowid>CAST(? AS INTEGER) ${filter ? 'AND ' + filter : ''} ORDER BY rowid LIMIT 1`,
  );
  let row = first.get(...args);
  while (row) {
    const cursor = row.__rowid;
    yield row;
    row = next.get(cursor, ...args);
  }
}
export function remapSnapshot(
  db: any,
  sourceId: string,
  name: string,
  shared: Map<string, string>,
  historical: Map<string, string>,
): RemapResult {
  validateCampaignOrigins(db);
  assertTransferCoverage(db);
  validateCampaignOrigins(db);
  validateCapabilityBytes(db);
  validateNoteSourceHistory(db);
  validateNpcRecovery(db);
  validateWorldRelationPairs(db);
  for (const row of db.prepare('SELECT * FROM audio_registry').iterate()) checkedAudioRegistry(row);
  const currentWorldRuns = new Set<string>();
  // ID remapping changes derived hashes, but must never bless an already stale route or track.
  const currentHexEnvironments = new Set<string>();
  let sourceWorld: ReturnType<typeof readWorld> | undefined;
  for (const row of db
    .prepare('SELECT id,payload,checksum FROM world_journey WHERE campaign_id=?')
    .iterate(sourceId)) {
    if (digest(row.payload) !== row.checksum) throw new Error('Hexreisestand beschädigt.');
    const journey = JSON.parse(row.payload);
    if (!['active', 'paused', 'interrupted'].includes(journey.status)) continue;
    if (
      journey.environmentBasis ===
      travelEnvironmentBasis(
        db,
        sourceId,
        journey.sceneId,
        journey.mapId,
        (sourceWorld ??= readWorld(db, sourceId)),
        journey.usePartyPace,
      )
    )
      currentHexEnvironments.add(row.id);
  }
  const currentDungeonGeometry = new Set<string>(),
    currentDungeonTraces = new Set<string>();
  let sourceDungeonGeometry: ReturnType<typeof dungeonGeometry> | undefined;
  for (const row of db
    .prepare('SELECT id,payload,checksum FROM dungeon_journey WHERE campaign_id=?')
    .iterate(sourceId)) {
    if (digest(row.payload) !== row.checksum) throw new Error('Dungeonlaufstand beschädigt.');
    const journey = JSON.parse(row.payload);
    if (!['active', 'paused', 'decision'].includes(journey.status)) continue;
    const scopeId = journey.request?.destination?.scopeId;
    if (
      typeof scopeId === 'string' &&
      journey.basis ===
        dungeonGeometryBasis((sourceDungeonGeometry ??= dungeonGeometry(db, sourceId)), scopeId)
    )
      currentDungeonGeometry.add(row.id);
    if (journey.pursuit)
      try {
        if (
          journey.pursuit.traceBasis ===
          digest(JSON.stringify(dungeonTraceById(db, sourceId, journey.pursuit.currentTraceId)))
        )
          currentDungeonTraces.add(row.id);
      } catch {
        /* An unavailable track retains its old, unusable basis. */
      }
  }
  // Only unchanged previews may acquire a basis for their new local identities.
  for (const row of db
    .prepare('SELECT id,payload,checksum FROM generation_run WHERE campaign_id=?')
    .iterate(sourceId)) {
    if (digest(row.payload) !== row.checksum)
      throw new Error('Generierungsvorschau ist beschädigt.');
    const run = JSON.parse(row.payload);
    if (typeof run.sourceBasis === 'string')
      try {
        if (
          resolveWorldSources(db, sourceId, run.request, readEncounterTables(db, sourceId, true))
            .basis === run.sourceBasis
        )
          currentWorldRuns.add(row.id);
      } catch {
        /* Unavailable or changed sources keep the old preview stale. */
      }
  }
  const local = new Map<string, string>([[sourceId, randomUUID()]]),
    tables = tableInfo(db);
  const collector = transferContext((id, role) => {
    if (id && (role === 'local' || (role === 'mixed' && !shared.has(id))) && !local.has(id))
      local.set(id, randomUUID());
    return id;
  });
  for (const table of tables) {
    if (transferTables[table.name]!.mode !== 'copy') continue;
    for (const row of db.prepare(`SELECT * FROM ${quote(table.name)}`).iterate())
      transferRow(table.name, row, collector);
  }
  const cid = local.get(sourceId)!;
  const context = transferContext(
    (id, role) =>
      role === 'local' || role === 'existing-local'
        ? (local.get(id) ?? id)
        : role === 'mixed'
          ? (local.get(id) ?? shared.get(id) ?? id)
          : (shared.get(id) ?? id),
    (id) => historical.get(id),
    { sourceId, campaignId: cid, name },
  );
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys=OFF');
  try {
    db.transaction(() => {
      // A distinct campaign starts its own author command timeline. Spatial facts and runtime state are remapped below.
      for (const table of ['atlas_command', 'atlas_receipt', 'atlas_travel_receipt'])
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
          db.prepare('DELETE FROM ' + table).run();
      if (
        db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='campaign_atlas'").get()
      )
        db.prepare('UPDATE campaign_atlas SET cursor=0').run();
      for (const table of tables) {
        if (transferTables[table.name]!.mode === 'derived') {
          if (table.name === 'note_search') db.exec('DELETE FROM note_search');
          continue;
        }
        if (transferTables[table.name]!.mode === 'discard') continue;
        for (const original of mutableRows(db, table.name)) {
          const { __rowid, ...value } = original,
            row = context.row(table.name, value);
          const columns = table.columns.map((c: any) => c.name),
            assignments = columns.map((c: string) => quote(c) + '=?').join(',');
          db.prepare(`UPDATE ${quote(table.name)} SET ${assignments} WHERE rowid=?`).run(
            ...columns.map((c: string) => row[c]),
            __rowid,
          );
        }
      }
      for (const id of currentWorldRuns) {
        const mapped = local.get(id)!,
          row = db
            .prepare('SELECT payload FROM generation_run WHERE campaign_id=? AND id=?')
            .get(cid, mapped),
          run = JSON.parse(row.payload);
        run.sourceBasis = resolveWorldSources(
          db,
          cid,
          run.request,
          readEncounterTables(db, cid, true),
        ).basis;
        const payload = JSON.stringify(run);
        db.prepare(
          'UPDATE generation_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(payload, digest(payload), cid, mapped);
      }
      let copiedWorld: ReturnType<typeof readWorld> | undefined;
      for (const id of currentHexEnvironments) {
        const mapped = local.get(id)!,
          row = db
            .prepare('SELECT payload FROM world_journey WHERE campaign_id=? AND id=?')
            .get(cid, mapped),
          journey = JSON.parse(row.payload);
        journey.environmentBasis = travelEnvironmentBasis(
          db,
          cid,
          journey.sceneId,
          journey.mapId,
          (copiedWorld ??= readWorld(db, cid)),
          journey.usePartyPace,
        );
        const payload = JSON.stringify(journey);
        db.prepare(
          'UPDATE world_journey SET payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(payload, digest(payload), cid, mapped);
      }
      let copiedDungeonGeometry: ReturnType<typeof dungeonGeometry> | undefined;
      for (const id of new Set([...currentDungeonGeometry, ...currentDungeonTraces])) {
        const mapped = local.get(id)!,
          row = db
            .prepare('SELECT payload FROM dungeon_journey WHERE campaign_id=? AND id=?')
            .get(cid, mapped),
          journey = JSON.parse(row.payload);
        if (currentDungeonGeometry.has(id))
          journey.basis = dungeonGeometryBasis(
            (copiedDungeonGeometry ??= dungeonGeometry(db, cid)),
            journey.request.destination.scopeId,
          );
        if (currentDungeonTraces.has(id))
          journey.pursuit.traceBasis = digest(
            JSON.stringify(dungeonTraceById(db, cid, journey.pursuit.currentTraceId)),
          );
        const payload = JSON.stringify(journey);
        db.prepare(
          'UPDATE dungeon_journey SET payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(payload, digest(payload), cid, mapped);
      }
      let drawingOrdinal = 0;
      while (true) {
        const h = db
          .prepare('SELECT * FROM drawing_history WHERE ordinal>? ORDER BY ordinal LIMIT 1')
          .get(drawingOrdinal);
        if (!h) break;
        drawingOrdinal = h.ordinal;
        const body = JSON.parse(h.payload);
        for (const d of body.changes) {
          const k = d.key,
            where =
              'campaign_id=? AND id=?' +
              (k.scopeId ? ' AND scope_id=?' : '') +
              (k.kind ? ' AND kind=?' : '');
          if (!drawingTables.has(k.table)) throw new Error('Unbekannte Zeichnungshistoryeinheit.');
          const current =
            db
              .prepare('SELECT * FROM ' + quote(k.table) + ' WHERE ' + where)
              .get(cid, k.id, ...(k.scopeId ? [k.scopeId] : []), ...(k.kind ? [k.kind] : [])) ??
            null;
          d.guard = digest(JSON.stringify(current));
        }
        const payload = JSON.stringify(body);
        db.prepare(
          'UPDATE drawing_history SET payload=?,checksum=? WHERE campaign_id=? AND ordinal=?',
        ).run(payload, digest(payload), cid, h.ordinal);
      }
      for (const row of db
        .prepare(
          "SELECT payload FROM npc_draft WHERE json_type(payload,'$.pendingCommand')='object'",
        )
        .all()) {
        const d = JSON.parse(row.payload);
        if (d.pendingCommand)
          db.prepare(
            'UPDATE npc_receipt SET fingerprint=? WHERE command_id=? AND campaign_id=?',
          ).run(npcFingerprint(d.pendingCommand), d.pendingCommand.commandId, cid);
      }
      for (const table of ['room_draft', 'preparation_draft', 'scene_creation_draft'].filter((t) =>
        db.prepare('SELECT 1 FROM sqlite_schema WHERE name=?').get(t),
      ))
        for (const row of db.prepare(`SELECT payload FROM ${quote(table)}`).all()) {
          const d = JSON.parse(row.payload),
            command = d.failedEdit ?? d.failedCommand ?? d.command;
          if (command)
            db.prepare('UPDATE receipt SET fingerprint=? WHERE command_id=?').run(
              digest(JSON.stringify({ ...command, token: undefined })),
              command.commandId,
            );
        }
      for (const row of mutableRows(db, 'world_relation_pair_draft')) {
        if (row.campaign_id !== cid) continue;
        const draft = JSON.parse(row.payload);
        db.prepare(
          'UPDATE world_relation_pair_receipt SET fingerprint=? WHERE command_id=? AND campaign_id=?',
        ).run(worldRelationPairFingerprint(draft.command), draft.command.commandId, cid);
      }
      const defaultScope = db
        .prepare(
          'SELECT id FROM scope WHERE campaign_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END,rowid LIMIT 1',
        )
        .get(cid, local.get('local') ?? 'local');
      if (defaultScope)
        db.prepare(
          'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        ).run('default-scope:' + cid, defaultScope.id);
      for (const row of db.prepare('SELECT * FROM world_note WHERE campaign_id=?').all(cid)) {
        const n = JSON.parse(row.payload);
        db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)').run(
          cid,
          n.id,
          n.title,
          n.readAloud + '\n' + n.gmNotes,
        );
      }
      if (db.pragma('foreign_key_check').length)
        throw new Error('Importreferenzen sind nicht vollständig gebunden.');
    }).immediate();
  } finally {
    db.pragma('foreign_keys=' + foreignKeys);
  }
  return { campaignId: cid, local, shared, historical };
}

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const commandFingerprint = (command: object) => hash(json({ ...command, token: undefined }));
const matchesReceipt = (receipt: Row, command: object) =>
  receipt.fingerprint === commandFingerprint(command) ||
  receipt.fingerprint === hash(json(command));
interface CreateContext {
  insertRoom: (campaignId: string, room: import('./../shared/contracts').Room) => void;
}
export function storedCreate(
  db: any,
  context: CreateContext,
  name: string,
  rooms: Room[] = [],
  source?: Buffer,
): import('./../shared/contracts').Campaign {
  if (typeof name !== 'string' || !name.trim() || name.length > 1000)
    throw new Error('Bitte einen Kampagnennamen eingeben.');
  const campaign = { id: randomUUID(), name, revision: 0 };
  db.transaction(() => {
    db.prepare('INSERT INTO campaign(id,name) VALUES(?,?)').run(campaign.id, name);
    noteCampaignCreated(db, campaign.id);
    db.prepare('INSERT INTO campaign_lifecycle VALUES(?,0,0)').run(campaign.id);
    ensureLiveOwners(db, campaign.id);
    createCampaignAtlas(db, campaign.id);
    const scopes = new Set(rooms.map((r) => r.scopeId));
    scopes.add('local');
    for (const id of scopes)
      db.prepare('INSERT INTO scope VALUES(?,?,?)').run(campaign.id, id, 'Dungeon');
    db.prepare("UPDATE scope SET name='Neue Zeichnung' WHERE campaign_id=? AND id='local'").run(
      campaign.id,
    );
    db.prepare("INSERT INTO drawing_floor VALUES(?,'local','ground','Erdgeschoss',0)").run(
      campaign.id,
    );
    if (source) {
      const document = JSON.parse(source.toString('utf8'));
      db.prepare('UPDATE scope SET name=? WHERE campaign_id=? AND id=?').run(
        document.settings.name,
        campaign.id,
        document.id,
      );
      for (const floor of document.floors)
        db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(
          campaign.id,
          document.id,
          floor.id,
          floor.name,
          floor.elevation,
        );
    }
    for (const room of rooms)
      db.prepare('INSERT OR IGNORE INTO drawing_floor VALUES(?,?,?,?,0)').run(
        campaign.id,
        room.scopeId,
        room.floorId,
        'Geschoss',
      );
    for (const scopeId of scopes)
      db.prepare('INSERT INTO atlas_binding VALUES(?,?,?,?,?,?,?,?,?,?)').run(
        campaign.id,
        randomUUID(),
        'dungeon',
        scopeId,
        'world',
        null,
        0,
        0,
        0,
        1,
      );
    for (const room of rooms) {
      validateRoom(room);
      context.insertRoom(campaign.id, room);
    }
    if (source)
      db.prepare('INSERT INTO source VALUES(?,?,?)').run(campaign.id, source, hash(source));
  }).immediate();
  return campaign;
}
interface RenameCampaignContext {
  guard: (token: string, campaignId?: string | undefined) => string;
}
export function storedRenameCampaign(
  db: any,
  context: RenameCampaignContext,
  command: CampaignRename,
): import('./../shared/contracts').Campaign {
  if (
    !command.commandId ||
    typeof command.name !== 'string' ||
    !command.name.trim() ||
    command.name.length > 1000 ||
    !Number.isSafeInteger(command.expectedRevision)
  )
    throw new Error('Ungültige Kampagnenumbenennung.');
  db.transaction(() => {
    const campaignId = context.guard(command.token, command.campaignId),
      fingerprint = commandFingerprint(command);
    const receipt = db
      .prepare('SELECT fingerprint,campaign_id FROM receipt WHERE command_id=?')
      .get(command.commandId);
    if (receipt) {
      if (receipt.campaign_id !== campaignId || !matchesReceipt(receipt, command))
        throw new Error('Änderungskennung bereits anders verwendet.');
      return;
    }
    const current = db.prepare('SELECT revision FROM campaign WHERE id=?').get(campaignId);
    if (current.revision !== command.expectedRevision)
      throw new Error('Kampagnenname wurde inzwischen geändert.');
    db.prepare('UPDATE campaign SET name=?,revision=revision+1 WHERE id=?').run(
      command.name,
      campaignId,
    );
    db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
      command.commandId,
      fingerprint,
      campaignId,
      campaignId,
      current.revision + 1,
    );
  }).immediate();
  return db.prepare('SELECT id,name,revision FROM campaign WHERE id=?').get(command.campaignId);
}

const json = (value: unknown) => JSON.stringify(value);
type Row = Record<string, any>;
