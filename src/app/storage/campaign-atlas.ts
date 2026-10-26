import { type SqliteDatabase, checkedQuery, checkedRow } from './sqlite-connection';
import { ensureAtlasShapeSource } from './atlas-shape-source';
import { advanceTerrainEnvironment } from './terrain-environment';
import { executeTerritory, validateTerritories } from './atlas-territories';
import { validateRoute } from '../atlas/terrain-route';
import { validateVegetation } from '../atlas/vegetation';
import { validateTerrain } from '../atlas/terrain-height';
import { validateMask } from '../atlas/land-mask';
import { validateLine } from '../atlas/landscape-line';
import { validateColor } from '../atlas/landscape-brush';
import { dungeonDisplay, dungeonGeometry, dungeonGeometryBasis } from './dungeon-play';
import { poseSpace } from '../atlas/spatial-3d';
import { inside, nearestAnchor } from '../atlas/drawing-model';
import { createHash, randomUUID } from 'node:crypto';
import type { AtlasBinding, AtlasCommand } from '../atlas/campaign-atlas-contracts';
import type { AtlasMap } from '../runtime/world-contracts';
import { newLocation } from '../../features/location/location-schema';
import { atlasFrame, atlasHexAt, localToAtlas } from '../atlas/campaign-atlas-model';
import { terrainTraceMeasure } from '../atlas/terrain-timing';
import { validateRoom, type Room } from '../shared/contracts';
import { executeLandscape } from './atlas-landscape';
import { narrowTerrainJournal } from './atlas-read-journal';
import {
  atlasEntrances,
  atlasLocalGeometryBasis,
  atlasLocalJourney,
  putAtlasEntrance,
} from './atlas-travel';
import { readCityHeader, readCitySite } from './city';
import { playerObservers, playerSettings } from './player';
import {
  groupRecipeForHouse,
  refreshChangedGroupHulls,
  refreshGroupHull,
  removeGeneratedGroup,
  scaleRoomGroup,
  splitGroupRoom,
  storeGroupDraft,
} from './room-groups';
import { changedHeightBounds, unionTerrainBounds } from './terrain-invalidation';
import { readWorld, travelEnvironmentBasis } from './world';
const hash = (v: string) => createHash('sha256').update(v).digest('hex'),
  json = JSON.stringify;
export function installCampaignAtlas(db: SqliteDatabase) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS atlas_import_source(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,source TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS campaign_atlas(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),map_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_binding(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,kind TEXT NOT NULL,owner_id TEXT NOT NULL,parent TEXT NOT NULL,parent_id TEXT,x REAL NOT NULL,y REAL NOT NULL,angle REAL NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,kind,owner_id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_command(campaign_id TEXT NOT NULL REFERENCES campaign(id),ordinal INTEGER NOT NULL,command_id TEXT NOT NULL,label TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,ordinal)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,fingerprint TEXT NOT NULL) STRICT;
 `);
}
export function createCampaignAtlas(db: SqliteDatabase, cam: string) {
  const id = randomUUID(),
    m: AtlasMap = {
      id,
      revision: 1,
      name: 'Atlas',
      hexMeters: 4828.032,
      metricVersion: 2,
      climate: 'temperate',
      seed: cam,
      cells: [],
    },
    payload = json(m);
  db.prepare('INSERT INTO world_record VALUES(?,?,?,?,?,?)').run(
    cam,
    'map',
    id,
    1,
    payload,
    hash(payload),
  );
  db.prepare('INSERT INTO campaign_atlas(campaign_id,map_id) VALUES(?,?)').run(cam, id);
  ensureAtlasShapeSource(db, cam);
}
export function atlasRoot(db: SqliteDatabase, cam: string) {
  const root = checkedQuery(db, 'SELECT * FROM campaign_atlas WHERE campaign_id=?', {
    campaign_id: 'text',
    map_id: 'text',
    revision: 'integer',
    cursor: 'integer',
  }).get(cam);
  if (!root)
    throw new Error(
      'Dieser alte Testbestand besitzt noch keinen gemeinsamen Atlas. Neue Kampagne anlegen.',
    );
  return root;
}
export function decodeAtlasBinding(value: unknown): AtlasBinding {
  const r = checkedRow(value, {
    id: 'text',
    kind: 'text',
    owner_id: 'text',
    parent: 'text',
    parent_id: 'nullable-text',
    x: 'number',
    y: 'number',
    angle: 'number',
    revision: 'integer',
  });
  if (
    (r.kind !== 'city' && r.kind !== 'dungeon') ||
    (r.parent !== 'world' && r.parent !== 'building')
  )
    throw Error('Räumliche Einordnung prüfen.');
  return {
    id: r.id,
    kind: r.kind,
    ownerId: r.owner_id,
    parent: r.parent,
    parentId: r.parent_id,
    x: r.x,
    y: r.y,
    angle: r.angle,
    revision: r.revision,
  };
}
export function atlasBindings(db: SqliteDatabase, cam: string): AtlasBinding[] {
  return db
    .prepare('SELECT * FROM atlas_binding WHERE campaign_id=? ORDER BY rowid')
    .all(cam)
    .map(decodeAtlasBinding);
}
export function bindAtlas(
  db: SqliteDatabase,
  cam: string,
  b: AtlasBinding,
  expected: number | null,
) {
  if (
    !b ||
    !['city', 'dungeon'].includes(b.kind) ||
    !['world', 'building'].includes(b.parent) ||
    !b.id ||
    !b.ownerId ||
    ![b.x, b.y, b.angle].every(Number.isFinite)
  )
    throw new Error('Räumliche Einordnung prüfen.');
  const old = checkedQuery(db, 'SELECT revision FROM atlas_binding WHERE campaign_id=? AND id=?', {
    revision: 'integer',
  }).get(cam, b.id);
  if ((old?.revision ?? null) !== expected)
    throw new Error('Räumliche Einordnung inzwischen geändert.');
  const owner = db
    .prepare(
      b.kind === 'city'
        ? 'SELECT id FROM city_document WHERE campaign_id=? AND id=?'
        : 'SELECT id FROM scope WHERE campaign_id=? AND id=?',
    )
    .get(cam, b.ownerId);
  if (!owner) throw new Error('Räumliches Objekt fehlt.');
  if (
    b.parent === 'building' &&
    (b.kind !== 'dungeon' ||
      !checkedQuery(
        db,
        "SELECT id FROM city_unit WHERE campaign_id=? AND id=? AND kind='building'",
        { id: 'text' },
      ).get(cam, b.parentId))
  )
    throw new Error('Gebäude fehlt.');
  db.prepare(
    'INSERT INTO atlas_binding VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET parent=excluded.parent,parent_id=excluded.parent_id,x=excluded.x,y=excluded.y,angle=excluded.angle,revision=excluded.revision',
  ).run(cam, b.id, b.kind, b.ownerId, b.parent, b.parentId, b.x, b.y, b.angle, (expected ?? 0) + 1);
}
// Capture only canonical rows written by the existing domain commands. Their own
// old receipts/histories remain immutable; the Atlas exposes one chronological history.
const tracked = [
  'atlas_territory_layer',
  'atlas_territory',
  'atlas_import_source',
  'scope',
  'room_group',
  'room',
  'drawing_floor',
  'drawing_hidden',
  'drawing_profile',
  'drawing_element',
  'dungeon_volume',
  'dungeon_path',
  'dungeon_passage',
  'dungeon_key_content',
  'dungeon_graph_layout',
  'dungeon_trigger_field',
  'city_document',
  'city_unit',
  'world_record',
  'atlas_place',
  'location',
  'location_map',
  'world_note',
  'atlas_binding',
  'atlas_landscape',
  'atlas_entrance',
  'atlas_local_journey',
  'npc_position',
  'npc_dungeon_position',
  'scene_position',
  'world_journey',
  'dungeon_journey',
];
type CapturedRow = Record<string, string | number | null>;
function capturedRow(value: unknown): CapturedRow {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.values(value).some(
      (v) => v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)),
    )
  )
    throw Error(
      'Atlasänderung enthält eine ungültige Datenbankzeile. Originaldaten bleiben erhalten.',
    );
  return value as CapturedRow;
}
interface Delta {
  table: string;
  key: CapturedRow;
  before: CapturedRow | null;
  after: CapturedRow | null;
  guard: string;
}
function readDeltas(payload: string): Delta[] {
  const values: unknown = JSON.parse(payload);
  if (!Array.isArray(values)) throw Error('Atlasverlauf ist beschädigt.');
  return values.map((value) => {
    const r = checkedRow(value, { table: 'text', guard: 'text' });
    if (!tracked.includes(r.table)) throw Error('Atlasverlauf enthält eine unbekannte Tabelle.');
    const fields = value as Record<string, unknown>;
    capturedRow(fields.key);
    if (fields.before !== null) capturedRow(fields.before);
    if (fields.after !== null) capturedRow(fields.after);
    // Preserve the original property order and any retained historical fields.
    return value as Delta;
  });
}
function captureSetup(db: SqliteDatabase) {
  // TEMP DDL participates in an enclosing transaction. A JavaScript cache can
  // survive its rollback even though SQLite removed every capture table/trigger.
  if (
    db.prepare("SELECT 1 FROM temp.sqlite_schema WHERE type='table' AND name='atlas_capture'").get()
  )
    return;
  db.exec(
    'CREATE TEMP TABLE atlas_capture(campaign_id TEXT); CREATE TEMP TABLE atlas_delta(table_name TEXT,key_json TEXT,before_json TEXT,after_json TEXT);',
  );
  for (const table of tracked) {
    const cols = checkedQuery(db, 'PRAGMA table_info(' + table + ')', {
      name: 'text',
      pk: 'integer',
    }).all();
    if (!cols.length) continue;
    const pk = cols.filter((c) => c.pk).sort((a, b) => a.pk - b.pk);
    const object = (prefix: string, fields: { name: string }[]) =>
      'json_object(' +
      fields.flatMap((c) => ["'" + c.name + "'", prefix + '."' + c.name + '"']).join(',') +
      ')';
    // INSERT OR REPLACE does not emit DELETE triggers with SQLite's default
    // recursive_triggers setting. Capture the existing row before INSERT too.
    // Use the same row on both sides so INSERT OR IGNORE remains a no-op.
    const prior =
        '(SELECT ' +
        object('prior', cols) +
        ' FROM main.' +
        table +
        ' AS prior WHERE ' +
        pk.map((c) => 'prior."' + c.name + '"=NEW."' + c.name + '"').join(' AND ') +
        ')',
      insertFilter =
        table === 'world_record' ? " AND NEW.kind IN ('map','place-presentation')" : '';
    db.exec(
      `CREATE TEMP TRIGGER atlas_${table}_prior BEFORE INSERT ON main.${table} WHEN EXISTS(SELECT 1 FROM atlas_capture WHERE campaign_id=NEW.campaign_id)${insertFilter} BEGIN INSERT INTO atlas_delta VALUES('${table}',${object('NEW', pk)},${prior},${prior}); END;`,
    );
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      const ref = op === 'DELETE' ? 'OLD' : 'NEW',
        filter =
          table === 'world_record' ? ' AND ' + ref + ".kind IN ('map','place-presentation')" : '';
      db.exec(
        `CREATE TEMP TRIGGER atlas_${table}_${op} AFTER ${op} ON main.${table} WHEN EXISTS(SELECT 1 FROM atlas_capture WHERE campaign_id=${ref}.campaign_id)${filter} BEGIN INSERT INTO atlas_delta VALUES('${table}',${object(ref, pk)},${op === 'INSERT' ? 'NULL' : object('OLD', cols)},${op === 'DELETE' ? 'NULL' : object('NEW', cols)}); END;`,
      );
    }
  }
}
function currentRow(db: SqliteDatabase, d: Pick<Delta, 'table' | 'key'>) {
  const row =
    db
      .prepare(
        'SELECT * FROM ' +
          d.table +
          ' WHERE ' +
          Object.keys(d.key)
            .map((k) => k + '=?')
            .join(' AND '),
      )
      .get(...Object.values(d.key)) ?? null;
  return row === null ? null : capturedRow(row);
}
function fp(v: object | null) {
  return hash(json(v));
}
function restore(db: SqliteDatabase, d: Delta, row: CapturedRow | null) {
  const current = currentRow(db, d);
  if (!row) {
    db.prepare(
      'DELETE FROM ' +
        d.table +
        ' WHERE ' +
        Object.keys(d.key)
          .map((k) => k + '=?')
          .join(' AND '),
    ).run(...Object.values(d.key));
    return;
  }
  const next = { ...row };
  if (d.table.endsWith('_journey') && typeof next.payload === 'string') {
    const p = JSON.parse(next.payload);
    if (p.status === 'active') {
      p.status = 'paused';
      p.reason = 'Atlasgeometrie rückgenommen. Reise vor Fortsetzung neu prüfen.';
      next.payload = json(p);
      if (next.checksum) next.checksum = hash(next.payload);
      if (next.status) next.status = 'paused';
    }
  }
  if (typeof next.revision === 'number') {
    next.revision =
      Math.max(typeof current?.revision === 'number' ? current.revision : 0, next.revision) + 1;
    if (typeof next.payload === 'string') {
      const p = JSON.parse(next.payload);
      if (typeof p.revision === 'number') {
        p.revision = next.revision;
        next.payload = json(p);
        if (next.checksum) next.checksum = hash(next.payload);
      }
    }
  }
  if (typeof next.payload === 'string' && typeof next.revision !== 'number') {
    const p = JSON.parse(next.payload);
    if (typeof p.revision === 'number') {
      const old = typeof current?.payload === 'string' ? JSON.parse(current.payload) : null;
      p.revision = Math.max(p.revision, old?.revision ?? 0) + 1;
      next.payload = json(p);
      if (next.checksum) next.checksum = hash(next.payload);
    }
  }
  const cols = Object.keys(next),
    nonKeys = cols.filter((k) => !Object.hasOwn(d.key, k));
  db.prepare(
    'INSERT INTO ' +
      d.table +
      '(' +
      cols.join(',') +
      ') VALUES(' +
      cols.map(() => '?').join(',') +
      ') ON CONFLICT(' +
      Object.keys(d.key).join(',') +
      ') DO UPDATE SET ' +
      nonKeys.map((k) => k + '=excluded.' + k).join(','),
  ).run(...cols.map((k) => next[k]!));
}
/** Used only inside an active Atlas capture, before secondary map/environment updates. */
export function atlasCapturedChanges(db: SqliteDatabase) {
  return !!db
    .prepare('SELECT 1 FROM temp.atlas_delta WHERE before_json IS NOT after_json LIMIT 1')
    .get();
}
export function atlasHistoryState(db: SqliteDatabase, cam: string) {
  const root = atlasRoot(db, cam),
    max =
      checkedQuery(db, 'SELECT max(ordinal) n FROM atlas_command WHERE campaign_id=?', {
        n: 'nullable-integer',
      }).required(cam).n ?? 0;
  return { canUndo: root.cursor > 0, canRedo: root.cursor < max };
}
function history(db: SqliteDatabase, cam: string, direction: 'undo' | 'redo') {
  const root = atlasRoot(db, cam),
    ordinal = direction === 'undo' ? root.cursor : root.cursor + 1,
    row = checkedQuery(db, 'SELECT * FROM atlas_command WHERE campaign_id=? AND ordinal=?', {
      ordinal: 'integer',
      payload: 'text',
      label: 'text',
    }).get(cam, ordinal);
  if (!row) throw new Error('Keine weitere Atlasänderung.');
  const changes: Delta[] = readDeltas(row.payload);
  for (const d of changes)
    if (fp(currentRow(db, d)) !== d.guard)
      throw new Error('Spätere Änderung an ' + d.table + ' verhindert die gemeinsame Rücknahme.');
  db.pragma('defer_foreign_keys=ON');
  for (const d of direction === 'undo' ? [...changes].reverse() : changes)
    restore(db, d, direction === 'undo' ? d.before : d.after);
  if (changes.some((d) => d.table === 'atlas_landscape')) advanceTerrainEnvironment(db, cam);
  const cursor = direction === 'undo' ? ordinal - 1 : ordinal;
  db.prepare('UPDATE campaign_atlas SET cursor=? WHERE campaign_id=?').run(cursor, cam);
  // Rebase only the next touching command in either direction after revision increments.
  for (const d of changes) {
    const guard = fp(currentRow(db, d));
    for (const [sign, order] of [
      ['<=', 'DESC'],
      ['>', 'ASC'],
    ]) {
      for (const candidate of checkedQuery(
        db,
        'SELECT ordinal,payload FROM atlas_command WHERE campaign_id=? AND ordinal ' +
          sign +
          '? ORDER BY ordinal ' +
          order,
        { ordinal: 'integer', payload: 'text' },
      ).all(cam, cursor)) {
        const items: Delta[] = readDeltas(candidate.payload),
          target = items.find((x) => x.table === d.table && json(x.key) === json(d.key));
        if (!target) continue;
        target.guard = guard;
        db.prepare('UPDATE atlas_command SET payload=? WHERE campaign_id=? AND ordinal=?').run(
          json(items),
          cam,
          candidate.ordinal,
        );
        break;
      }
    }
  }
}
function checkPositions(db: SqliteDatabase, cam: string) {
  const geometry = dungeonGeometry(db, cam);
  // Check each position against its own room group. A generated town can have
  // thousands of entrances; scanning all furnishing for each is quadratic.
  const groups = new Map<string, typeof geometry>();
  for (const room of geometry.rooms) {
    let g = groups.get(room.scopeId);
    if (!g) {
      g = {
        rooms: [],
        floors: [],
        drawing: {
          ...geometry.drawing,
          elements: [],
          styles: [],
          volumes: [],
          paths: [],
          passages: [],
        },
      };
      groups.set(room.scopeId, g);
    }
    g.rooms.push(room);
  }
  for (const floor of geometry.floors) groups.get(floor.scopeId)?.floors.push(floor);
  for (const kind of ['elements', 'styles', 'volumes', 'paths', 'passages'] as const)
    for (const item of geometry.drawing[kind] ?? [])
      (groups.get(item.scopeId)?.drawing[kind] as any[])?.push(item);

  const rooms = new Map(
    checkedQuery(db, 'SELECT * FROM room WHERE campaign_id=?', {
      id: 'text',
      scope_id: 'text',
      floor_id: 'text',
      number: 'text',
      name: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    })
      .all(cam)
      .map((r) => [r.id, r] as const),
  );
  const check = (p: any) => {
    if (!p) return;
    const r = rooms.get(p.roomId);
    if (
      !r ||
      r.scope_id !== p.scopeId ||
      r.floor_id !== p.floorId ||
      !inside(p, JSON.parse(r.payload).polygons) ||
      !poseSpace(
        groups.get(p.scopeId) ?? geometry,
        {
          ...p,
          z:
            p.z ??
            geometry.floors.find((f) => f.scopeId === p.scopeId && f.id === p.floorId)?.elevation ??
            0,
        },
        p.movement ?? 'walk',
      )
    )
      throw new Error(
        'Änderung würde eine Gruppe oder einen NPC außerhalb ihres Raums zurücklassen. Position zuerst klären.',
      );
  };
  for (const r of checkedQuery(db, 'SELECT payload FROM scene_position WHERE campaign_id=?', {
    payload: 'text',
  }).all(cam))
    check(JSON.parse(r.payload).dungeon);
  for (const r of checkedQuery(db, 'SELECT payload FROM npc_dungeon_position WHERE campaign_id=?', {
    payload: 'text',
  }).all(cam))
    check(JSON.parse(r.payload));
  for (const r of checkedQuery(db, 'SELECT payload FROM atlas_entrance WHERE campaign_id=?', {
    payload: 'text',
  }).all(cam)) {
    const e = JSON.parse(r.payload);
    check({
      ...e.inside,
      scopeId: e.scopeId,
      floorId: e.floorId,
      roomId: e.roomId,
    });
  }
}
const atlasActionKinds: Record<AtlasCommand['action']['kind'], true> = {
  'territory-layer': true,
  'territory-put': true,
  'territory-remove': true,
  'territory-stroke': true,
  'territory-vertex': true,
  'drawing-import': true,
  'room-default': true,
  'graph-accept': true,
  world: true,
  city: true,
  drawing: true,
  'room-edit': true,
  bind: true,
  'group-room-split': true,
  'group-scale': true,
  'group-generate': true,
  'city-create': true,
  'dungeon-create': true,
  entrance: true,
  'room-create': true,
  undo: true,
  redo: true,
  'landscape-prominence': true,
  'landscape-route': true,
  'landscape-vegetation-edit': true,
  'landscape-terrain-style': true,
  'landscape-height-stroke': true,
  'landscape-sea-level': true,
  'landscape-land-stroke': true,
  'landscape-color-stroke': true,
  'landscape-brush': true,
  'landscape-batch': true,
  'landscape-put': true,
  'landscape-reset': true,
  'landscape-remove': true,
  'landscape-place': true,
};
export const atlasCommandFingerprint = (c: AtlasCommand) =>
  fp(c.terrainStroke ? { action: c.action, terrainStroke: c.terrainStroke } : c.action);
/** No replay or projection reads: the transaction receipt alone establishes application. */
export function hasAtlasReceipt(db: SqliteDatabase, c: AtlasCommand): boolean {
  if (
    !c ||
    typeof c.commandId !== 'string' ||
    !c.commandId ||
    !c.action ||
    !Object.hasOwn(atlasActionKinds, c.action.kind)
  )
    throw new Error('Unbekannten oder unvollständigen Atlasauftrag nicht geprüft.');
  const row = checkedQuery(db, 'SELECT * FROM atlas_receipt WHERE command_id=?', {
    campaign_id: 'text',
    fingerprint: 'text',
  }).get(c.commandId);
  if (!row) return false;
  if (row.campaign_id !== c.campaignId || row.fingerprint !== atlasCommandFingerprint(c))
    throw new Error('Atlasbefehlskennung anders verwendet.');
  return true;
}
export function executeAtlasWrite(
  db: SqliteDatabase,
  c: AtlasCommand,
  apply: () => unknown,
  after?: () => void,
  validatePositions = true,
): unknown {
  if (
    !c ||
    typeof c.commandId !== 'string' ||
    !c.commandId ||
    !c.action ||
    !Object.hasOwn(atlasActionKinds, c.action.kind)
  )
    throw new Error('Unbekannten oder unvollständigen Atlasauftrag nicht gespeichert.');
  captureSetup(db);
  return db
    .transaction(() => {
      const fingerprint = atlasCommandFingerprint(c),
        old = checkedQuery(db, 'SELECT * FROM atlas_receipt WHERE command_id=?', {
          campaign_id: 'text',
          fingerprint: 'text',
        }).get(c.commandId);
      if (old) {
        if (old.campaign_id !== c.campaignId || old.fingerprint !== fingerprint)
          throw new Error('Atlasbefehlskennung anders verwendet.');
        return null;
      }
      const rootBefore = atlasRoot(db, c.campaignId),
        stroke = c.terrainStroke;
      let continuation: { ordinal: number; payload: string; label: string } | undefined;
      if (stroke) {
        if (
          !['landscape-height-stroke', 'landscape-color-stroke'].includes(c.action.kind) ||
          typeof stroke.id !== 'string' ||
          !stroke.id ||
          stroke.id.length > 128 ||
          !Number.isSafeInteger(stroke.expectedRevision) ||
          stroke.expectedRevision !== rootBefore.revision ||
          typeof c.sourceFence !== 'string' ||
          Object.keys(stroke).some((k) => !['id', 'expectedRevision'].includes(k))
        )
          throw Error('Geländezug inzwischen geändert. Neuen Pinselzug beginnen.');
        continuation = checkedQuery(
          db,
          'SELECT ordinal,payload,label FROM atlas_command WHERE campaign_id=? AND command_id=?',
          { ordinal: 'integer', payload: 'text', label: 'text' },
        ).get(c.campaignId, stroke.id);
        if (continuation) {
          const last = checkedQuery(
            db,
            'SELECT max(ordinal) n FROM atlas_command WHERE campaign_id=?',
            { n: 'nullable-integer' },
          ).required(c.campaignId).n;
          if (
            continuation.ordinal !== rootBefore.cursor ||
            last !== rootBefore.cursor ||
            continuation.label !== c.action.kind
          )
            throw Error('Geländezug bereits abgeschlossen. Neuen Pinselzug beginnen.');
          for (const delta of readDeltas(continuation.payload))
            if (fp(currentRow(db, delta)) !== delta.guard)
              throw Error('Gelände inzwischen anderweitig geändert. Neuen Pinselzug beginnen.');
        }
      }
      let result: unknown;
      if (c.action.kind === 'undo' || c.action.kind === 'redo') {
        history(db, c.campaignId, c.action.kind);
        checkPositions(db, c.campaignId);
      } else {
        db.prepare('DELETE FROM atlas_delta').run();
        db.prepare('INSERT INTO atlas_capture VALUES(?)').run(c.campaignId);
        try {
          result = apply();
          after?.();
          if (validatePositions) checkPositions(db, c.campaignId);
        } finally {
          db.prepare('DELETE FROM atlas_capture').run();
        }
        const changes = new Map<string, Delta>();
        for (const row of checkedQuery(db, 'SELECT * FROM atlas_delta ORDER BY rowid', {
          table_name: 'text',
          key_json: 'text',
          before_json: 'nullable-text',
          after_json: 'nullable-text',
        }).all()) {
          const key = row.table_name + ':' + row.key_json,
            old = changes.get(key),
            after = row.after_json ? capturedRow(JSON.parse(row.after_json)) : null;
          changes.set(key, {
            table: row.table_name,
            key: capturedRow(JSON.parse(row.key_json)),
            before: old
              ? old.before
              : row.before_json
                ? capturedRow(JSON.parse(row.before_json))
                : null,
            after,
            guard: fp(after),
          });
        }
        const meaningful = [...changes.values()].filter((d) => fp(d.before) !== fp(d.after));
        if (meaningful.some((d) => d.table === 'atlas_landscape'))
          advanceTerrainEnvironment(db, c.campaignId);
        if (meaningful.length) {
          const root = atlasRoot(db, c.campaignId);
          if (continuation) {
            const combined = new Map<string, Delta>();
            const key = (d: Delta) => d.table + ':' + json(d.key);
            for (const delta of readDeltas(continuation.payload)) combined.set(key(delta), delta);
            for (const delta of meaningful) {
              const prior = combined.get(key(delta));
              combined.set(key(delta), { ...delta, before: prior ? prior.before : delta.before });
            }
            db.prepare('UPDATE atlas_command SET payload=? WHERE campaign_id=? AND ordinal=?').run(
              json([...combined.values()]),
              c.campaignId,
              root.cursor,
            );
          } else {
            db.prepare('DELETE FROM atlas_command WHERE campaign_id=? AND ordinal>?').run(
              c.campaignId,
              root.cursor,
            );
            db.prepare('INSERT INTO atlas_command VALUES(?,?,?,?,?)').run(
              c.campaignId,
              root.cursor + 1,
              stroke?.id ?? c.commandId,
              c.action.kind,
              json(meaningful),
            );
            db.prepare('UPDATE campaign_atlas SET cursor=cursor+1 WHERE campaign_id=?').run(
              c.campaignId,
            );
          }
        }
        db.prepare('DELETE FROM atlas_delta').run();
      }
      db.prepare('UPDATE campaign_atlas SET revision=revision+1 WHERE campaign_id=?').run(
        c.campaignId,
      );
      db.prepare('INSERT INTO atlas_receipt VALUES(?,?,?)').run(
        c.commandId,
        c.campaignId,
        fingerprint,
      );
      return result;
    })
    .immediate();
}

/** Atlas invariants also apply to snapshots before they are published. */
export function validateCampaignAtlases(db: SqliteDatabase) {
  validateTerritories(db);
  for (const table of [
    'campaign_atlas',
    'atlas_binding',
    'atlas_landscape',
    'atlas_reference_asset',
    'atlas_command',
    'atlas_receipt',
    'atlas_import_source',
    'atlas_entrance',
    'atlas_local_journey',
    'atlas_travel_receipt',
  ])
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
      throw new Error('Atlasstore unvollständig: ' + table);
  for (const row of checkedQuery(
    db,
    "SELECT payload FROM atlas_landscape WHERE json_extract(payload,'$.line') IS NOT NULL OR json_extract(payload,'$.paint') IS NOT NULL OR json_extract(payload,'$.surface') IS NOT NULL OR json_extract(payload,'$.mask') IS NOT NULL OR json_extract(payload,'$.propertyOnly') IS NOT NULL OR json_extract(payload,'$.height') IS NOT NULL OR json_extract(payload,'$.terrainSettings') IS NOT NULL OR json_extract(payload,'$.vegetation') IS NOT NULL OR json_extract(payload,'$.route') IS NOT NULL OR json_extract(payload,'$.kind')='vegetation'",
    { payload: 'text' },
  ).iterate()) {
    const record = JSON.parse(row.payload);
    validateLine(record);
    validateColor(record);
    validateMask(record);
    validateTerrain(record);
    validateVegetation(record);
    validateRoute(record);
  }
  {
    if (
      checkedQuery(
        db,
        "SELECT campaign_id FROM atlas_landscape WHERE json_extract(payload,'$.terrainSettings') IS NOT NULL GROUP BY campaign_id HAVING count(*)>1",
        { campaign_id: 'text' },
      ).get()
    )
      throw Error('Doppelter Meeresspiegel.');
    if (
      checkedQuery(
        db,
        "SELECT campaign_id FROM atlas_landscape WHERE json_extract(payload,'$.height') IS NOT NULL GROUP BY campaign_id,json_extract(payload,'$.height.version'),json_extract(payload,'$.height.pixel'),json_extract(payload,'$.height.x'),json_extract(payload,'$.height.y') HAVING count(*)>1",
        { campaign_id: 'text' },
      ).get()
    )
      throw Error('Doppelte Höhenkachel.');
  }
  for (const root of checkedQuery(db, 'SELECT * FROM campaign_atlas', {
    campaign_id: 'text',
    map_id: 'text',
    revision: 'integer',
    cursor: 'integer',
  }).iterate()) {
    const maps = checkedQuery(
      db,
      "SELECT id FROM world_record WHERE campaign_id=? AND kind='map'",
      { id: 'text' },
    ).all(root.campaign_id);
    if (maps.length !== 1 || maps[0]?.id !== root.map_id)
      throw new Error('Kampagne besitzt nicht genau eine Atlaswurzel.');
    const count = checkedQuery(db, 'SELECT count(*) n FROM atlas_command WHERE campaign_id=?', {
      n: 'integer',
    }).required(root.campaign_id).n;
    if (root.cursor < 0 || root.cursor > count) throw new Error('Atlashistorie widersprüchlich.');
    for (const b of atlasBindings(db, root.campaign_id)) {
      if (![b.x, b.y, b.angle].every(Number.isFinite) || !['world', 'building'].includes(b.parent))
        throw new Error('Atlasposition ungültig.');
      if (
        !db
          .prepare(
            b.kind === 'city'
              ? 'SELECT 1 FROM city_document WHERE campaign_id=? AND id=?'
              : 'SELECT 1 FROM scope WHERE campaign_id=? AND id=?',
          )
          .get(root.campaign_id, b.ownerId)
      )
        throw new Error('Räumlicher Eigentümer fehlt.');
      if (
        b.parent === 'building' &&
        !db
          .prepare("SELECT 1 FROM city_unit WHERE campaign_id=? AND id=? AND kind='building'")
          .get(root.campaign_id, b.parentId)
      )
        throw new Error('Gebäudeanker fehlt.');
    }
  }
  for (const r of checkedQuery(db, 'SELECT source,checksum FROM atlas_import_source', {
    source: 'text',
    checksum: 'text',
  }).iterate())
    if (hash(r.source) !== r.checksum) throw new Error('Dungeonimport-Original beschädigt.');
}

/** Cross-domain commands keep their existing guards and receipt owners. */
interface AtlasCommandEffects {
  reconcileAtlasGeometry: (token: string) => void;
  coupleAtlasWall: (
    c: import('../atlas/campaign-atlas-contracts').AtlasCommand,
    before: import('../shared/contracts').Room,
    elements: import('../atlas/drawing-contracts').DrawingElement[],
  ) => void;
  atlasRoom: (token: string, id: string) => import('../shared/contracts').Room;
  atlasRegionSource: (
    token: string,
    cursor?: import('../atlas/atlas-region-contracts').AtlasRegionCursor | undefined,
  ) => import('../atlas/atlas-region-contracts').AtlasRegionSource;
  campaignAtlas: (
    token: string,
  ) => import('../atlas/campaign-atlas-contracts').CampaignAtlas<
    import('../shared/contracts').Room,
    import('../atlas/drawing-contracts').DrawingElement,
    import('../atlas/city-contracts').CityView
  >;
  insertRoom: (campaignId: string, room: import('../shared/contracts').Room) => void;
  guard: (token: string, campaignId?: string | undefined) => string;
  workspace: () => import('../shared/contracts').Workspace;
  addRoom: (token: string, atlasInternal?: boolean) => import('../shared/contracts').Workspace;
  edit: (edit: import('../shared/contracts').Edit) => import('../shared/contracts').RoomCommit;
  drawing: (
    token: string,
  ) => import('../atlas/drawing-contracts').DrawingView<
    import('../shared/contracts').Room,
    import('../atlas/drawing-contracts').DrawingElement
  >;
  executeDrawing: (c: import('../atlas/drawing-contracts').DrawingCommand) => {
    workspace: import('../shared/contracts').Workspace;
    view: import('../atlas/drawing-contracts').DrawingView<
      import('../shared/contracts').Room,
      import('../atlas/drawing-contracts').DrawingElement
    >;
  };
  executeGraph: (c: import('../atlas/graph-contracts').GraphCommand) => {
    workspace: import('../shared/contracts').Workspace;
    view: import('../atlas/graph-contracts').GraphView;
  };
  city: (token: string, id: string) => import('../atlas/city-contracts').CityView;
  executeCity: (
    command: import('../atlas/city-contracts').CityCommand,
  ) => import('../atlas/city-contracts').CityView;
  executeWorld: (
    command: import('../runtime/world-contracts').WorldCommand,
  ) => import('../runtime/world-contracts').WorldAck;
  commitPreparation: (
    command: import('../campaign/preparation-contracts').PreparationCommand,
  ) => void;
  readonly terrainAuthorCache: import('./terrain-author-cache').TerrainAuthorCache;
}
export function applyAtlasCommand(
  db: SqliteDatabase,
  effects: AtlasCommandEffects,
  c: AtlasCommand,
  prepared?: import('./terrain-scale').PreparedTerrainStroke,
) {
  effects.guard(c.token, c.campaignId);
  if (
    c.sourceFence !== undefined &&
    (typeof c.sourceFence !== 'string' ||
      (!db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=?').get(c.commandId) &&
        effects.atlasRegionSource(c.token).fence !== c.sourceFence))
  )
    throw new Error('Atlas inzwischen geändert. Ausschnitt vor dem Zeichnen erneut laden.');
  if (
    prepared &&
    (c.action.kind !== 'landscape-height-stroke' ||
      prepared.stroke !== JSON.stringify(c.action.stroke) ||
      prepared.fence !== effects.atlasRegionSource(c.token).fence ||
      prepared.revision !== atlasRoot(db, c.campaignId).revision)
  )
    throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
  let landscapeEnvironment = false;
  const landscapeOnly =
    typeof c.action?.kind === 'string' && c.action.kind.startsWith('landscape-');
  const terrainSourceBefore = landscapeOnly ? effects.atlasRegionSource(c.token) : undefined,
    terrainBefore = terrainSourceBefore?.fence;
  const terrainChange: import('../atlas/terrain-frame').TerrainInvalidation = {
    reset: false,
    bounds: [],
  };
  const visibility =
    c.action.kind === 'landscape-height-stroke'
      ? c.action.stroke.visibility
      : c.action.kind === 'landscape-color-stroke'
        ? c.action.record.paint?.visibility
        : undefined;
  const visibilityGrid =
    !prepared &&
    visibility &&
    !db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=?').get(c.commandId)
      ? terrainTraceMeasure('author.visibility', () =>
          effects.terrainAuthorCache.read(db, c.campaignId, visibility, terrainBefore!),
        )
      : undefined;
  const nested = (v: { token: string; campaignId: string; commandId: string }) => {
    if (v.token !== c.token || v.campaignId !== c.campaignId || v.commandId !== c.commandId)
      throw new Error('Atlasbefehl gehört zu einem anderen Kontext.');
  };
  const result = executeAtlasWrite(
    db,
    c,
    () => {
      const a = c.action,
        cam = c.campaignId;
      if (
        a.kind === 'territory-layer' ||
        a.kind === 'territory-put' ||
        a.kind === 'territory-remove' ||
        a.kind === 'territory-stroke' ||
        a.kind === 'territory-vertex'
      )
        return executeTerritory(db, cam, a);
      if (
        a.kind === 'landscape-prominence' ||
        a.kind === 'landscape-route' ||
        a.kind === 'landscape-terrain-style' ||
        a.kind === 'landscape-vegetation-edit' ||
        a.kind === 'landscape-height-stroke' ||
        a.kind === 'landscape-sea-level' ||
        a.kind === 'landscape-land-stroke' ||
        a.kind === 'landscape-color-stroke' ||
        a.kind === 'landscape-brush' ||
        a.kind === 'landscape-batch' ||
        a.kind === 'landscape-put' ||
        a.kind === 'landscape-reset' ||
        a.kind === 'landscape-remove' ||
        a.kind === 'landscape-place'
      ) {
        if (a.kind === 'landscape-place')
          effects.commitPreparation({
            commandId: c.commandId + ':key',
            token: c.token,
            campaignId: cam,
            change: {
              kind: 'location',
              document: a.document,
              expectedRevision: a.expectedLocationRevision,
            },
          });
        const physical = (kind: string | undefined) =>
          kind !== undefined && ['patch', 'road', 'river', 'vegetation'].includes(kind);
        const wasPhysical = (id: string) =>
          physical(
            checkedQuery(
              db,
              "SELECT json_extract(payload,'$.kind') kind FROM atlas_landscape WHERE campaign_id=? AND id=?",
              { kind: 'nullable-text' },
            ).get(cam, id)?.kind ?? undefined,
          );
        landscapeEnvironment =
          a.kind === 'landscape-terrain-style' || a.kind === 'landscape-prominence'
            ? false
            : a.kind === 'landscape-vegetation-edit' ||
              a.kind === 'landscape-height-stroke' ||
              a.kind === 'landscape-sea-level' ||
              a.kind === 'landscape-land-stroke' ||
              a.kind === 'landscape-color-stroke' ||
              a.kind === 'landscape-brush' ||
              a.kind === 'landscape-reset' ||
              (a.kind === 'landscape-remove'
                ? wasPhysical(a.id)
                : a.kind === 'landscape-batch'
                  ? a.records.some((x) => physical(x.record.kind) || wasPhysical(x.record.id)) ||
                    (a.remove ?? []).some((x) => wasPhysical(x.id))
                  : physical(a.record.kind) || wasPhysical(a.record.id));
        let liveColorRevision: number | null = null;
        if (c.terrainStroke && a.kind === 'landscape-color-stroke') {
          if (a.record.id !== c.terrainStroke.id)
            throw Error('Farbzug gehört zu einer anderen Pinselgeste.');
          const prior = checkedQuery(
            db,
            'SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?',
            { revision: 'integer' },
          ).get(cam, a.record.id);
          if (
            prior &&
            !db
              .prepare('SELECT 1 FROM atlas_command WHERE campaign_id=? AND command_id=?')
              .get(cam, c.terrainStroke.id)
          )
            throw Error('Farbzugkennung bereits verwendet.');
          liveColorRevision = prior?.revision ?? null;
        }
        executeLandscape(db, cam, a, liveColorRevision, visibilityGrid, prepared);
        if (c.terrainStroke && !atlasCapturedChanges(db)) {
          landscapeEnvironment = false;
          return;
        }
        if (a.kind === 'landscape-place') {
          const root = atlasRoot(db, cam),
            m = JSON.parse(
              checkedQuery(
                db,
                "SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
                { payload: 'text' },
              ).required(cam, root.map_id).payload,
            ),
            old = checkedQuery(
              db,
              'SELECT revision FROM atlas_place WHERE campaign_id=? AND location_id=?',
              { revision: 'integer' },
            ).get(cam, a.document.id);
          effects.executeWorld({
            commandId: c.commandId + ':place',
            token: c.token,
            campaignId: cam,
            action: {
              kind: 'place',
              mapId: m.id,
              locationId: a.document.id,
              expectedRevision: old?.revision ?? null,
              hex: atlasHexAt(a.point ?? a.record.points[0]!, m.hexMeters),
            },
          });
        }

        return;
      }
      if (a.kind === 'room-default') return effects.addRoom(c.token, true);
      if (a.kind === 'drawing-import') {
        const doc = JSON.parse(a.source),
          ids = new Map<string, string>();
        const id = (s: string) => {
          if (!ids.has(s)) ids.set(s, randomUUID());
          return ids.get(s)!;
        };
        for (const r of a.rooms) {
          id(r.scopeId);
          id(r.floorId);
          id(r.id);
          for (const section of r.sections) id(section.id);
        }
        for (const f of doc.floors ?? []) id(f.id);
        if (doc.id) id(doc.id);
        // Identity fields are references; authored prose and room numbers are not.
        const rewrite = (room: Room): Room => ({
          ...room,
          id: id(room.id),
          scopeId: id(room.scopeId),
          floorId: id(room.floorId),
          sections: room.sections.map((section) => ({
            ...section,
            id: id(section.id),
            ...(section.doorId ? { doorId: ids.get(section.doorId) ?? section.doorId } : {}),
          })),
        });
        const scopes = new Set(a.rooms.map((r) => r.scopeId));
        for (const original of scopes) {
          const scopeId = id(original);
          db.prepare('INSERT INTO scope VALUES(?,?,?)').run(cam, scopeId, a.name);
          const floors = new Map(
            (doc.floors ?? [])
              .filter((f: any) => Number.isFinite(f.elevation))
              .map((f: any) => [f.id, { id: id(f.id), name: f.name, elevation: f.elevation }]),
          );
          for (const r of a.rooms.filter((r) => r.scopeId === original))
            if (!floors.has(r.floorId))
              floors.set(r.floorId, { id: id(r.floorId), name: 'Geschoss', elevation: 0 });
          for (const f of floors.values() as Iterable<{
            id: string;
            name: string;
            elevation: number;
          }>)
            db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(
              cam,
              scopeId,
              f.id,
              f.name,
              f.elevation,
            );
          bindAtlas(
            db,
            cam,
            {
              id: randomUUID(),
              kind: 'dungeon',
              ownerId: scopeId,
              parent: 'world',
              parentId: null,
              x: a.x,
              y: a.y,
              angle: 0,
              revision: 0,
            },
            null,
          );
        }
        for (const original of a.rooms) {
          const room = rewrite(original) as Room;
          validateRoom(room);
          effects.insertRoom(cam, room);
        }
        db.prepare('INSERT INTO atlas_import_source VALUES(?,?,?,?)').run(
          cam,
          c.commandId,
          a.source,
          hash(a.source),
        );
        return { roomId: a.rooms.length ? id(a.rooms[0]!.id) : null };
      }
      if (a.kind === 'graph-accept') {
        nested(a.command);
        if (a.command.action.kind !== 'accept') throw new Error('Nur bestätigte Graphübernahme.');
        return effects.executeGraph(a.command);
      }
      if (a.kind === 'world') {
        nested(a.command);
        if (
          a.command.action.kind === 'map' &&
          a.command.action.map.id !== atlasRoot(db, cam).map_id
        )
          throw new Error(
            'Jede Kampagne besitzt genau einen Atlas. Inhalte in die bestehende Welt einfügen.',
          );
        return effects.executeWorld(a.command);
      }
      if (a.kind === 'drawing') {
        nested(a.command);
        const action = a.command.action,
          before =
            action.kind === 'shape'
              ? effects.workspace().rooms.find((r) => r.id === action.roomId)
              : null,
          elements = before ? effects.drawing(c.token).elements : [];
        const result = effects.executeDrawing(a.command);
        if (before) effects.coupleAtlasWall(c, before, elements);
        return result;
      }
      if (a.kind === 'room-edit') {
        nested(a.edit);
        const before = effects.atlasRoom(c.token, a.edit.roomId),
          elements = before ? effects.drawing(c.token).elements : [];
        const result = effects.edit(a.edit);
        if (before) effects.coupleAtlasWall(c, before, elements);
        return result;
      }
      if (a.kind === 'city') {
        nested(a.command);
        const before =
          a.command.action.kind === 'change' ? effects.city(c.token, a.command.cityId) : null;
        if (a.command.action.kind === 'change')
          for (const id of a.command.action.remove)
            removeGeneratedGroup(db, cam, id, a.command.action.removeGroups === true);
        const result = effects.executeCity(a.command);
        if (a.command.action.kind === 'change')
          for (const u of a.command.action.upsert)
            if (
              u.kind === 'building' &&
              !db.prepare('SELECT 1 FROM scope WHERE campaign_id=? AND id=?').get(cam, u.id)
            ) {
              storeGroupDraft(db, cam, u.id, u.name || u.use || 'Gebäude', groupRecipeForHouse(u));
              const locationId = checkedQuery(
                db,
                'SELECT location_id FROM city_document WHERE campaign_id=? AND id=?',
                { location_id: 'text' },
              ).required(cam, a.command.cityId).location_id;
              db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(cam, u.id, locationId);
              bindAtlas(
                db,
                cam,
                {
                  id: randomUUID(),
                  kind: 'dungeon',
                  ownerId: u.id,
                  parent: 'building',
                  parentId: u.id,
                  x: 0,
                  y: 0,
                  angle: 0,
                  revision: 0,
                },
                null,
              );
              refreshGroupHull(db, cam, u.id, u.protected);
            }
        // Building pose is inherited by its interiors. Scale their local geometry
        // in the very same command, retaining heights and room IDs/text.
        const oldUnits = new Map(before?.units.map((u) => [u.id, u]) ?? []),
          houseBindings = new Map(
            atlasBindings(db, cam)
              .filter((b) => b.parent === 'building')
              .map((b) => [b.parentId, b]),
          );
        if (before && a.command.action.kind === 'change')
          for (const u of a.command.action.upsert) {
            const old = oldUnits.get(u.id),
              binding = houseBindings.get(u.id);
            if (!old?.outline || !u.outline || !binding) continue;
            const bounds = (p: { x: number; y: number }[]) => ({
                x: Math.max(...p.map((p) => p.x)) - Math.min(...p.map((p) => p.x)),
                y: Math.max(...p.map((p) => p.y)) - Math.min(...p.map((p) => p.y)),
              }),
              o = bounds(old.outline),
              n = bounds(u.outline),
              sx = n.x / o.x,
              sy = n.y / o.y;
            if (!Number.isFinite(sx + sy) || sx <= 0 || sy <= 0)
              throw new Error('Ungültige Gebäudeskalierung.');
            if (
              u.outline.length !== old.outline.length ||
              u.outline.some(
                (p, i) =>
                  Math.abs(p.x - old.outline![i]!.x * sx) > 1e-6 ||
                  Math.abs(p.y - old.outline![i]!.y * sy) > 1e-6,
              )
            )
              throw Error('Gebäudeform an den gemeinsamen Räumen bearbeiten.');
            if (Math.abs(sx - sy) > 1e-7)
              throw Error('Die gesamte Raumgruppe proportional skalieren.');
            if (Math.abs(sx - 1) > 1e-7) scaleRoomGroup(db, cam, binding.ownerId, sx);
          }
        if (a.command.action.kind === 'change')
          for (const u of a.command.action.upsert)
            if (u.kind === 'building') {
              db.prepare('UPDATE scope SET name=? WHERE campaign_id=? AND id=?').run(
                u.name || u.use || 'Gebäude',
                cam,
                u.id,
              );
              refreshGroupHull(db, cam, u.id, u.protected);
            }
        return result;
      }
      if (a.kind === 'entrance') {
        putAtlasEntrance(db, effects.campaignAtlas(c.token), a.entrance);
        return;
      }
      if (a.kind === 'bind') {
        bindAtlas(db, cam, a.binding, a.expectedRevision);
        return;
      }
      if (a.kind === 'city-create') {
        const id = randomUUID(),
          locationId = randomUUID();
        effects.commitPreparation({
          commandId: c.commandId + ':location',
          token: c.token,
          campaignId: cam,
          change: {
            kind: 'location',
            document: newLocation(locationId, a.name, 'city', [randomUUID(), randomUUID()]),
            expectedRevision: null,
          },
        });
        effects.executeCity({
          commandId: c.commandId + ':city',
          token: c.token,
          campaignId: cam,
          cityId: id,
          expectedRevision: 0,
          action: {
            kind: 'create',
            header: {
              id,
              locationId,
              revision: 1,
              name: a.name,
              width: a.width,
              height: a.height,
              paper: '#e9dfc8',
              roof: '#9c604c',
            },
          },
        });
        bindAtlas(
          db,
          cam,
          {
            id: randomUUID(),
            kind: 'city',
            ownerId: id,
            parent: 'world',
            parentId: null,
            x: a.x,
            y: a.y,
            angle: 0,
            revision: 0,
          },
          null,
        );
        const root = effects.campaignAtlas(c.token);
        effects.executeWorld({
          commandId: c.commandId + ':anchor',
          token: c.token,
          campaignId: cam,
          action: {
            kind: 'place',
            locationId,
            mapId: root.terrain.id,
            expectedRevision: null,
            hex: atlasHexAt({ x: a.x, y: a.y }, root.terrain.hexMeters),
          },
        });
        return { id };
      }
      if (a.kind === 'group-room-split')
        return splitGroupRoom(db, cam, a.roomId, a.expectedRevision, a.axis, a.ratio);
      if (a.kind === 'group-scale') {
        scaleRoomGroup(db, cam, a.scopeId, a.factor);
        return;
      }
      if (a.kind === 'group-generate') {
        if (typeof a.name !== 'string' || !a.name.trim()) throw Error('Name benötigt.');
        const id = randomUUID(),
          locationId = randomUUID();
        storeGroupDraft(db, cam, id, a.name, a.recipe);
        effects.commitPreparation({
          commandId: c.commandId + ':location',
          token: c.token,
          campaignId: cam,
          change: {
            kind: 'location',
            document: newLocation(locationId, a.name, 'poi', [randomUUID(), randomUUID()]),
            expectedRevision: null,
          },
        });
        db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(cam, id, locationId);
        bindAtlas(
          db,
          cam,
          {
            id: randomUUID(),
            kind: 'dungeon',
            ownerId: id,
            parent: 'world',
            parentId: null,
            x: a.x,
            y: a.y,
            angle: 0,
            revision: 0,
          },
          null,
        );
        return { id };
      }
      if (a.kind === 'dungeon-create') {
        const id = randomUUID();
        if (!a.name.trim()) throw new Error('Name benötigt.');
        db.prepare('INSERT INTO scope VALUES(?,?,?)').run(cam, id, a.name);
        db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(
          cam,
          id,
          'ground',
          'Erdgeschoss',
          0,
        );
        if ('buildingId' in a)
          throw Error('Gebäude besitzen bereits dieselbe Raumgruppe. Direkt Räume bearbeiten.');
        const locationId = randomUUID();
        effects.commitPreparation({
          commandId: c.commandId + ':location',
          token: c.token,
          campaignId: cam,
          change: {
            kind: 'location',
            document: newLocation(locationId, a.name, 'poi', [randomUUID(), randomUUID()]),
            expectedRevision: null,
          },
        });
        db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(cam, id, locationId);
        bindAtlas(
          db,
          cam,
          {
            id: randomUUID(),
            kind: 'dungeon',
            ownerId: id,
            parent: 'world',
            parentId: null,
            x: a.x,
            y: a.y,
            angle: 0,
            revision: 0,
          },
          null,
        );
        return { id };
      }
      if (a.kind === 'room-create') {
        if (
          !db
            .prepare('SELECT 1 FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?')
            .get(cam, a.scopeId, a.floorId)
        )
          throw new Error('Geschoss fehlt.');
        const room: Room = {
          id: randomUUID(),
          scopeId: a.scopeId,
          floorId: a.floorId,
          name: a.name,
          number: String(
            checkedQuery(db, 'SELECT count(*) n FROM room WHERE campaign_id=?', {
              n: 'integer',
            }).required(cam).n + 1,
          ),
          revision: 0,
          polygons: a.polygons,
          sections: [{ id: randomUUID(), kind: 'markdown', markdown: '' }],
        };
        validateRoom(room);
        effects.insertRoom(cam, room);
        return { id: room.id };
      }
    },
    () => {
      if (!landscapeOnly) {
        refreshChangedGroupHulls(
          db,
          c.campaignId,
          !['city', 'group-generate', 'dungeon-create', 'drawing-import'].includes(c.action.kind),
        );
        effects.reconcileAtlasGeometry(c.token);
        return;
      }
      const changedBounds = new Map<string, import('../atlas/atlas-landscape').LandscapeBox>();
      for (const delta of checkedQuery(
        db,
        "SELECT before_json,after_json FROM atlas_delta WHERE table_name='atlas_landscape'",
        { before_json: 'nullable-text', after_json: 'nullable-text' },
      ).iterate()) {
        if (delta.before_json === delta.after_json) continue;
        const rows = [delta.before_json, delta.after_json].map((value) =>
          value ? JSON.parse(value) : undefined,
        );
        let malformed = false;
        const records = rows.map((row) => {
          try {
            return row ? JSON.parse(row.payload) : undefined;
          } catch {
            malformed = true;
            terrainChange.reset = true;
            return undefined;
          }
        });
        const precise = malformed ? undefined : changedHeightBounds(records[0], records[1]);
        const boxes = precise
          ? [precise]
          : rows.filter(Boolean).map((row) => ({
              x: row.min_x,
              y: row.min_y,
              width: row.max_x - row.min_x,
              height: row.max_y - row.min_y,
            }));
        for (const b of boxes) {
          if (terrainChange.bounds.length >= 2048) terrainChange.reset = true;
          else terrainChange.bounds.push(b);
          const id = (rows[1] ?? rows[0]).id,
            previous = changedBounds.get(id);
          changedBounds.set(id, previous ? unionTerrainBounds(previous, b) : b);
        }
        if (records.some((r) => r?.terrainSettings)) terrainChange.reset = true;
      }
      narrowTerrainJournal(db, c.campaignId, terrainSourceBefore!.sequence, changedBounds);
      if (!landscapeEnvironment) return;
      // Terrain cannot move an indoor actor or change a room boundary. It can
      // invalidate outdoor routes; pause them atomically without loading rooms.
      for (const table of ['world_journey', 'atlas_local_journey'])
        for (const row of checkedQuery(
          db,
          'SELECT rowid,payload FROM ' + table + ' WHERE campaign_id=?',
          { rowid: 'integer', payload: 'text' },
        ).all(c.campaignId)) {
          const journey = JSON.parse(row.payload);
          if (!['active', 'paused'].includes(journey.status)) continue;
          journey.status = 'paused';
          journey.reason = 'Atlaslandschaft geändert. Reise vor Fortsetzung neu planen.';
          journey.revision++;
          const payload = json(journey);
          if (table === 'world_journey')
            db.prepare(
              "UPDATE world_journey SET status='paused',revision=?,payload=?,checksum=? WHERE rowid=?",
            ).run(journey.revision, payload, hash(payload), row.rowid);
          else
            db.prepare('UPDATE atlas_local_journey SET payload=?,checksum=? WHERE rowid=?').run(
              payload,
              hash(payload),
              row.rowid,
            );
        }
    },
    !landscapeOnly,
  );
  if (terrainBefore)
    effects.terrainAuthorCache.advance(
      terrainBefore,
      effects.atlasRegionSource(c.token).fence,
      terrainChange,
    );
  return result;
}

interface ReconcileAtlasGeometryContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  cities: (token: string) => import('./../atlas/city-contracts').CityOverview;
  city: (token: string, id: string) => import('./../atlas/city-contracts').CityView;
}
export function storedReconcileAtlasGeometry(
  db: SqliteDatabase,
  context: ReconcileAtlasGeometryContext,
  token: string,
): void {
  const cam = context.guard(token);
  if (
    !db
      .prepare(
        "SELECT 1 FROM scene_position WHERE campaign_id=? AND (json_type(payload,'$.dungeon')='object' OR json_type(payload,'$.city')='object') LIMIT 1",
      )
      .get(cam) &&
    !['world_journey', 'dungeon_journey', 'atlas_local_journey'].some((table) =>
      db
        .prepare(
          'SELECT 1 FROM ' +
            table +
            " WHERE campaign_id=? AND json_extract(payload,'$.status')='active' LIMIT 1",
        )
        .get(cam),
    )
  )
    return;
  const root = atlasRoot(db, cam),
    geometry = dungeonGeometry(db, cam);
  // Reconcile spatial facts only; descriptions, perceptions and traces are consumers.
  const a = {
    terrain: JSON.parse(
      checkedQuery(
        db,
        "SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
        { payload: 'text' },
      ).required(cam, root.map_id).payload,
    ),
    bindings: atlasBindings(db, cam),
    cities: context.cities(token).cities.map((h) => context.city(token, h.id)),
  };
  for (const row of checkedQuery(db, 'SELECT * FROM scene_position WHERE campaign_id=?', {
    scene_id: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  }).all(cam)) {
    const p = JSON.parse(row.payload),
      binding = p.dungeon
        ? a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === p.dungeon.scopeId)
        : p.city
          ? a.bindings.find((b) => b.kind === 'city' && b.ownerId === p.city.cityId)
          : null;
    if (!binding) continue;
    const point = localToAtlas(p.dungeon ?? p.city, atlasFrame(a, binding)),
      basis = hash(json(point));
    if (p.spatialBasis === basis) continue;
    const next = {
        ...p,
        ...atlasHexAt(point, a.terrain.hexMeters),
        spatialBasis: basis,
        revision: p.revision + 1,
      },
      payload = json(next);
    db.prepare(
      'UPDATE scene_position SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND scene_id=?',
    ).run(next.revision, payload, hash(payload), cam, row.scene_id);
  }
  for (const table of ['world_journey', 'dungeon_journey', 'atlas_local_journey'])
    for (const row of checkedQuery(db, 'SELECT * FROM ' + table + ' WHERE campaign_id=?', {
      payload: 'text',
    }).all(cam)) {
      const j = JSON.parse(row.payload);
      if (j.status !== 'active') continue;
      const stale =
        table === 'world_journey'
          ? j.environmentBasis !==
            travelEnvironmentBasis(
              db,
              cam,
              j.sceneId,
              j.mapId,
              readWorld(db, cam, false),
              j.usePartyPace,
            )
          : table === 'dungeon_journey'
            ? j.basis !== dungeonGeometryBasis(geometry, j.request.destination.scopeId)
            : j.basis !== atlasLocalGeometryBasis(a);
      if (!stale) continue;
      j.status = 'paused';
      j.reason = 'Atlasgeometrie geändert. Reise vor Fortsetzung neu planen.';
      j.revision++;
      const payload = json(j);
      db.prepare(
        'UPDATE ' +
          table +
          ' SET ' +
          (table === 'world_journey' ? "status='paused'," : '') +
          (table !== 'atlas_local_journey' ? 'revision=?,' : '') +
          'payload=?,checksum=? WHERE campaign_id=? AND ' +
          (table === 'atlas_local_journey' ? 'scene_id' : 'id') +
          '=?',
      ).run(
        ...(table !== 'atlas_local_journey' ? [j.revision] : []),
        payload,
        hash(payload),
        cam,
        table === 'atlas_local_journey' ? j.sceneId : j.id,
      );
    }
}
interface CoupleAtlasWallContext {
  workspace: () => import('./../shared/contracts').Workspace;
  edit: (edit: import('./../shared/contracts').Edit) => import('./../shared/contracts').RoomCommit;
  drawing: (
    token: string,
  ) => import('./../atlas/drawing-contracts').DrawingView<
    import('./../shared/contracts').Room,
    import('./../atlas/drawing-contracts').DrawingElement
  >;
  executeDrawing: (c: import('./../atlas/drawing-contracts').DrawingCommand) => {
    workspace: import('./../shared/contracts').Workspace;
    view: import('./../atlas/drawing-contracts').DrawingView<
      import('./../shared/contracts').Room,
      import('./../atlas/drawing-contracts').DrawingElement
    >;
  };
}
export function storedCoupleAtlasWall(
  db: SqliteDatabase,
  context: CoupleAtlasWallContext,
  c: AtlasCommand,
  before: Room,
  elements: import('../atlas/drawing-contracts').DrawingElement[],
): void {
  const binding = atlasBindings(db, c.campaignId).find(
    (b) => b.kind === 'dungeon' && b.ownerId === before.scopeId,
  );
  if (!binding) return;
  const after = context.workspace().rooms.find((r) => r.id === before.id);
  if (!after) return;
  const pairs: {
    before: import('../shared/contracts').Point;
    after: import('../shared/contracts').Point;
  }[] = [];
  before.polygons.forEach((p, pi) => {
    const n = after.polygons[pi];
    if (p.outer.length === n?.outer.length)
      p.outer.forEach((v, i) => {
        const next = n.outer[i]!;
        if (v.x !== next.x || v.y !== next.y) pairs.push({ before: v, after: next });
      });
  });
  if (!pairs.length) return;
  const move = (p: import('../shared/contracts').Point) => {
    const match = pairs.find((v) => Math.hypot(v.before.x - p.x, v.before.y - p.y) < 1e-7);
    return match ? { ...match.after } : p;
  };
  const ring = (points: import('../shared/contracts').Point[]) =>
    points.flatMap((a, i) => {
      const b = points[(i + 1) % points.length]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        l = dx * dx + dy * dy;
      return [
        a,
        ...pairs
          .map((p) => p.before)
          .filter((p) => {
            const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (l || 1);
            return t > 1e-7 && t < 1 - 1e-7 && Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) < 1e-7;
          })
          .sort((p, q) => (p.x - q.x) * dx + (p.y - q.y) * dy),
      ].map(move);
    });
  const changedRooms = new Map<string, { before: Room; after: Room }>([
    [before.id, { before, after }],
  ]);
  for (const r of context
    .workspace()
    .rooms.filter(
      (r) => r.scopeId === before.scopeId && r.floorId === before.floorId && r.id !== before.id,
    )) {
    const polygons = r.polygons.map((p) => ({ outer: ring(p.outer), holes: p.holes.map(ring) }));
    if (JSON.stringify(polygons) !== JSON.stringify(r.polygons)) {
      changedRooms.set(r.id, { before: r, after: { ...r, polygons } });
      context.edit({
        commandId: c.commandId + ':shared-wall:' + r.id,
        token: c.token,
        campaignId: c.campaignId,
        roomId: r.id,
        expectedRevision: r.revision,
        name: r.name,
        sections: r.sections,
        polygons,
      });
    }
  }
  for (const original of elements.filter(
    (e) => e.anchor && changedRooms.has(e.anchor.roomId) && !e.archived,
  )) {
    const changed = changedRooms.get(original.anchor!.roomId)!,
      oldRing = changed.before.polygons[original.anchor!.polygon]?.outer;
    if (!oldRing) continue;
    const start = oldRing[original.anchor!.edge],
      end = oldRing[(original.anchor!.edge + 1) % oldRing.length];
    if (!start || !end) continue;
    const a = move(start),
      b = move(end),
      point = {
        x: a.x + (b.x - a.x) * original.anchor!.t,
        y: a.y + (b.y - a.y) * original.anchor!.t,
      },
      anchor = nearestAnchor(point, changed.after);
    if (!anchor) continue;
    const current = context.drawing(c.token).elements.find((e) => e.id === original.id);
    if (!current) continue;
    context.executeDrawing({
      commandId: c.commandId + ':anchor:' + original.id,
      token: c.token,
      campaignId: c.campaignId,
      action: {
        kind: 'element',
        expectedRevision: current.revision,
        element: {
          ...current,
          roomId: changed.after.id,
          anchor: {
            roomId: anchor.roomId,
            polygon: anchor.polygon,
            edge: anchor.edge,
            t: anchor.t,
          },
          points: [point],
        },
      },
    });
  }
}
interface AtlasOverviewContext {
  guard: (token: string, campaignId?: string | undefined) => string;
}
export function storedAtlasOverview(
  db: SqliteDatabase,
  context: AtlasOverviewContext,
  token: string,
): import('./../atlas/campaign-atlas-contracts').AtlasOverview {
  const cam = context.guard(token);
  return db.transaction(() => {
    const root = atlasRoot(db, cam),
      b = db
        .prepare(
          "SELECT min(min_x) x,max(max_x) xmax,min(min_y) y,max(max_y) ymax FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.terrainSettings') IS NULL",
        )
        .get(cam);
    const bounds =
      b?.x === null
        ? null
        : checkedRow(b, { x: 'number', y: 'number', xmax: 'number', ymax: 'number' });
    return {
      campaignId: cam,
      token,
      revision: root.revision,
      ...atlasHistoryState(db, cam),
      counts: {
        rooms: checkedQuery(
          db,
          "SELECT count(*) n FROM room r WHERE campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1)",
          { n: 'integer' },
        ).required(cam).n,
        cities: checkedQuery(db, 'SELECT count(*) n FROM city_document WHERE campaign_id=?', {
          n: 'integer',
        }).required(cam).n,
        landscape: checkedQuery(db, 'SELECT count(*) n FROM atlas_landscape WHERE campaign_id=?', {
          n: 'integer',
        }).required(cam).n,
      },
      landscapeBounds:
        bounds === null
          ? null
          : {
              x: bounds.x,
              y: bounds.y,
              width: bounds.xmax - bounds.x,
              height: bounds.ymax - bounds.y,
            },
    };
  })();
}
interface AtlasCitySiteContext {
  guard: (token: string, campaignId?: string | undefined) => string;
}
export function storedAtlasCitySite(
  db: SqliteDatabase,
  context: AtlasCitySiteContext,
  token: string,
  cityId: string,
  id?: string,
): import('./../atlas/atlas-region-contracts').AtlasCitySite {
  return db.transaction(() => {
    const cam = context.guard(token),
      site = id
        ? readCitySite(db, cam, cityId, id)
        : { header: readCityHeader(db, cam, cityId), unit: null };
    const related = (site.unit?.nodeIds ?? []).map((n) => readCitySite(db, cam, cityId, n).unit);
    const faction = site.unit?.factionId
      ? checkedQuery(
          db,
          'SELECT id,payload,checksum FROM world_note WHERE campaign_id=? AND id=?',
          { id: 'text', payload: 'text', checksum: 'text' },
        ).get(cam, site.unit.factionId)
      : null;
    const factions =
      faction && hash(faction.payload) === faction.checksum
        ? [{ id: faction.id, name: JSON.parse(faction.payload).title }]
        : [];
    return { ...site, related, factions, ...atlasHistoryState(db, cam) };
  })();
}
interface CampaignAtlasContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  dungeon: (
    token: string,
  ) => import('./../atlas/dungeon-contracts').DungeonView<
    import('./../shared/contracts').Room,
    import('./../atlas/drawing-contracts').DrawingElement
  >;
  sceneWorld: (token: string, id: string) => import('../runtime/world-contracts').SceneWorld;
  cities: (token: string) => import('./../atlas/city-contracts').CityOverview;
  city: (token: string, id: string) => import('./../atlas/city-contracts').CityView;
  workspace: () => import('./../shared/contracts').Workspace;
}
export function storedCampaignAtlas(
  db: SqliteDatabase,
  context: CampaignAtlasContext,
  token: string,
): import('./../atlas/campaign-atlas-contracts').CampaignAtlas<
  import('./../shared/contracts').Room,
  import('./../atlas/drawing-contracts').DrawingElement,
  import('./../atlas/city-contracts').CityView
> {
  const cam = context.guard(token);
  return db.transaction(() => {
    const root = atlasRoot(db, cam),
      terrain = JSON.parse(
        checkedQuery(
          db,
          "SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
          { payload: 'text' },
        ).required(cam, root.map_id).payload,
      );
    if (!terrain) throw new Error('Kampagnenatlas fehlt.');
    const geometry = context.dungeon(token),
      scene = geometry.sceneId ? context.sceneWorld(token, geometry.sceneId) : null;
    const perception =
      geometry.position && geometry.sceneId
        ? dungeonDisplay(
            db,
            cam,
            geometry.sceneId,
            playerSettings(db, cam),
            playerObservers(db, cam).list,
          )
        : null;
    return {
      scopes: checkedQuery(db, 'SELECT id,name FROM scope WHERE campaign_id=?', {
        id: 'text',
        name: 'text',
      }).all(cam),
      perception,
      entrances: atlasEntrances(db, cam),
      localJourney: geometry.sceneId ? atlasLocalJourney(db, cam, geometry.sceneId) : null,
      campaignId: cam,
      revision: root.revision,
      terrain,
      bindings: atlasBindings(db, cam),
      cities: context.cities(token).cities.map((h) => context.city(token, h.id)),
      geometry,
      workspace: context.workspace(),
      scene,
      ...atlasHistoryState(db, cam),
    };
  })();
}
