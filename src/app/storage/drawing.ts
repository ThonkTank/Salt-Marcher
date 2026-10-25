import { roomGeometries } from './room-reads';
import { readTriggerFields, executeTriggerAction } from './triggers';
import { validateDrawingElement } from '../atlas/drawing-contracts';
import { validateGraphLayouts, validateGraphHistoryRow } from './graph';
import { dungeonContentAnchors } from '../atlas/dungeon-content-model';
import { validateDungeonPlacement } from './dungeon-budget';
import { executeGraphEdit } from './graph-edit';
import {
  readDungeonKeys,
  executeKeyAction,
  validateDungeonKeys,
  validateKeyHistoryRow,
} from './dungeon-key';
import {
  readDungeonPaths,
  readDungeonPassages,
  validateDungeonPaths,
  validatePathHistoryRow,
  pathState,
  executePathAction,
  passageStatuses,
} from './paths';
import { dungeonGeometry } from './dungeon-play';
import { volumeProjection } from '../atlas/volume-model';
import {
  readDungeonVolumes,
  readDungeonVolume,
  validateDungeonVolumes,
  validateVolumeHistoryRow,
  executeVolumeAction,
  rebaseRoomVolume,
  volumeRow,
} from './volume';
import { createHash, randomUUID } from 'node:crypto';
import { validateRoom, type Room, type Polygon } from '../shared/contracts';
import type {
  DrawingCommand,
  DrawingElement,
  DrawingView,
  RoomStyle,
} from '../atlas/drawing-contracts';
import {
  combineRooms,
  anchored,
  deformedBoundaryPoints,
  nearestAnchor,
} from '../atlas/drawing-model';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  json = (v: any) => JSON.stringify(v);
export function installDrawingSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS drawing_hidden(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,scope_id TEXT NOT NULL,kind TEXT NOT NULL,revision INTEGER NOT NULL,hidden INTEGER NOT NULL,PRIMARY KEY(campaign_id,id,scope_id,kind)) STRICT;
CREATE TABLE IF NOT EXISTS drawing_profile(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,scope_id TEXT NOT NULL,target_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,scope_id,target_id)) STRICT;
CREATE TABLE IF NOT EXISTS drawing_element(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,floor_id TEXT NOT NULL,room_id TEXT,kind TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id),FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS drawing_history(campaign_id TEXT NOT NULL,ordinal INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,ordinal),FOREIGN KEY(campaign_id,ordinal) REFERENCES history(campaign_id,ordinal) ON DELETE CASCADE) STRICT;
CREATE TABLE IF NOT EXISTS drawing_revision(campaign_id TEXT NOT NULL REFERENCES campaign(id),table_name TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,kind TEXT NOT NULL,last_revision INTEGER NOT NULL,PRIMARY KEY(campaign_id,table_name,id,scope_id,kind)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_feature_state(campaign_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES drawing_element(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_feature_receipt(campaign_id TEXT NOT NULL REFERENCES campaign(id),command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL) STRICT;`);
}
function parsed<T = any>(row: any): T {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Dungeonstand fehlt oder ist beschädigt.');
  return JSON.parse(row.payload);
}
export function drawingRoomFromRow(r: any): Room {
  if (!r || hash(r.payload) !== r.checksum) throw new Error('Raum fehlt oder ist beschädigt.');
  return {
    id: r.id,
    scopeId: r.scope_id,
    floorId: r.floor_id,
    number: r.number,
    name: r.name,
    revision: r.revision,
    ...JSON.parse(r.payload),
  };
}
export function drawingRoom(db: any, cam: string, id: string): Room {
  return drawingRoomFromRow(
    db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(cam, id),
  );
}
// Cache only the two SQL programs, never style/secret values across snapshots.
const roomStyleQueries = new WeakMap<object, { profile: any; key: any }>();
function roomStyleStatements(db: any) {
  let queries = roomStyleQueries.get(db);
  if (!queries) {
    queries = {
      profile: db.prepare(
        'SELECT p.* FROM room r JOIN drawing_profile p ON p.campaign_id=r.campaign_id AND p.scope_id=r.scope_id AND p.target_id=r.id WHERE r.campaign_id=? AND r.id=?',
      ),
      key: db.prepare(
        "SELECT id,scope_id,kind,revision,payload,checksum,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.id','$.scopeId','$.kind','$.revision','$.secret') END header FROM dungeon_key_content WHERE campaign_id=? AND id=? AND kind='room'",
      ),
    };
    roomStyleQueries.set(db, queries);
  }
  return queries;
}
/** Selected display style; secret Key metadata does not create an author revision. */
export function roomMapStyle(
  db: any,
  cam: string,
  id: string,
): (RoomStyle & { authorRevision?: number | null }) | undefined {
  const queries = roomStyleStatements(db),
    profile = queries.profile.get(cam, id);
  let style: (RoomStyle & { authorRevision?: number | null }) | undefined = profile
    ? parsed<RoomStyle>(profile)
    : undefined;
  const row = queries.key.get(cam, id);
  if (row) {
    const header = JSON.parse(row.header ?? 'null');
    if (
      hash(row.payload) !== row.checksum ||
      !Array.isArray(header) ||
      header.length !== 5 ||
      header[0] !== row.id ||
      header[1] !== row.scope_id ||
      header[2] !== row.kind ||
      !Number.isSafeInteger(row.revision) ||
      row.revision < 0 ||
      header[3] !== row.revision ||
      typeof header[4] !== 'boolean'
    )
      throw new Error('Dungeon-Key beschädigt.');
    if (header[4])
      style = style
        ? { ...style, secret: true }
        : {
            id,
            revision: 0,
            scopeId: row.scope_id,
            ceilingMeters: 3.048,
            fill: '#c5b998',
            wall: '#56493e',
            publicLabel: '',
            secret: true,
            authorRevision: null,
          };
  }
  return style;
}
export function drawingView(db: any, cam: string): DrawingView;
export function drawingView(
  db: any,
  cam: string,
  projection: true,
): import('../atlas/drawing-contracts').DrawingView<
  import('../shared/contracts').RoomGeometry,
  import('../atlas/drawing-contracts').DrawingElementGeometry
>;
export function drawingView(db: any, cam: string, projection = false): any {
  const passages = readDungeonPassages(db, cam);
  const value = {
    triggerFields: readTriggerFields(db, cam),
    ...(projection ? {} : { keyContent: readDungeonKeys(db, cam) }),
    passageStatuses: passageStatuses(db, cam, passages),
    paths: readDungeonPaths(db, cam).map((p) => ({ ...p, status: pathState(db, cam, p) })),
    passages,
    volumes: readDungeonVolumes(db, cam),
    elements: readDrawingElements(db, cam),
    styles: db
      .prepare('SELECT * FROM drawing_profile WHERE campaign_id=?')
      .all(cam)
      .map((r: any) => parsed<RoomStyle>(r)),
    hiddenRooms: projection
      ? roomGeometries(db, cam, true).rooms
      : db
          .prepare(
            "SELECT r.id FROM room r JOIN drawing_hidden h ON h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' WHERE r.campaign_id=? AND h.hidden=1",
          )
          .all(cam)
          .map((r: any) => drawingRoom(db, cam, r.id)),
    hiddenFloors: db
      .prepare(
        "SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation sourceElevation FROM drawing_floor f JOIN drawing_hidden h ON h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' WHERE f.campaign_id=? AND h.hidden=1",
      )
      .all(cam),
    features: db
      .prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=?')
      .all(cam)
      .map((r: any) => parsed(r)),
  };
  if (projection)
    for (const row of db
      .prepare(
        "SELECT id,scope_id scopeId,revision,payload,checksum,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.id','$.scopeId','$.kind','$.revision','$.secret') END header FROM dungeon_key_content WHERE campaign_id=? AND kind='room'",
      )
      .iterate(cam)) {
      if (hash(row.payload) !== row.checksum) throw new Error('Dungeon-Key beschädigt.');
      const header = JSON.parse(row.header ?? 'null');
      if (
        !Array.isArray(header) ||
        header.length !== 5 ||
        header[0] !== row.id ||
        header[1] !== row.scopeId ||
        header[2] !== 'room' ||
        !Number.isSafeInteger(row.revision) ||
        row.revision < 0 ||
        header[3] !== row.revision ||
        typeof header[4] !== 'boolean'
      )
        throw new Error('Dungeon-Key-Metadaten widersprüchlich.');
      if (!header[4]) continue;
      const style = value.styles.find((s: RoomStyle) => s.id === row.id);
      if (style) style.secret = true;
      else
        value.styles.push({
          id: row.id,
          revision: 0,
          scopeId: row.scopeId,
          ceilingMeters: 3.048,
          fill: '#c5b998',
          wall: '#56493e',
          publicLabel: '',
          secret: true,
          authorRevision: null,
        });
    }
  const anchors = dungeonContentAnchors({ drawing: value }, value.elements);
  for (const element of value.elements) {
    const anchor = anchors.get(element.id);
    if (anchor) {
      element.points = [anchor.point];
      element.zOffsetMeters = anchor.zOffsetMeters;
    }
  }
  if (projection)
    return { ...value, elements: value.elements.map(({ notes, content, ...e }) => e) };
  return value;
}
type Key = { table: string; id: string; scopeId?: string; kind?: string };
type Delta = { key: Key; before: any; after: any; guard: string };
export const drawingTables = new Set([
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
]);
function where(k: Key) {
  if (!drawingTables.has(k.table)) throw new Error('Unbekannte Zeichnungseinheit.');
  return (
    'campaign_id=? AND id=?' + (k.scopeId ? ' AND scope_id=?' : '') + (k.kind ? ' AND kind=?' : '')
  );
}
function read(db: any, cam: string, k: Key) {
  return (
    db
      .prepare('SELECT * FROM ' + k.table + ' WHERE ' + where(k))
      .get(cam, k.id, ...(k.scopeId ? [k.scopeId] : []), ...(k.kind ? [k.kind] : [])) ?? null
  );
}
function fingerprint(v: any) {
  return hash(json(v));
}
function put(db: any, cam: string, k: Key, row: any) {
  const current = read(db, cam, k);
  if (!row && k.table === 'drawing_element' && current) {
    const body = JSON.parse(current.payload);
    body.archived = true;
    row = { ...current, payload: json(body), checksum: hash(json(body)) };
  }
  if (!row) {
    db.prepare('DELETE FROM ' + k.table + ' WHERE ' + where(k)).run(
      cam,
      k.id,
      ...(k.scopeId ? [k.scopeId] : []),
      ...(k.kind ? [k.kind] : []),
    );
    return;
  }
  const n = { ...row, campaign_id: cam };
  if (Object.hasOwn(n, 'revision')) {
    const scope = n.scope_id ?? current?.scope_id ?? k.scopeId ?? cam,
      last = db
        .prepare(
          'SELECT last_revision FROM drawing_revision WHERE campaign_id=? AND table_name=? AND id=? AND scope_id=? AND kind=?',
        )
        .get(cam, k.table, k.id, scope, k.kind ?? '');
    n.revision = Math.max(current?.revision ?? -1, last?.last_revision ?? -1) + 1;
    db.prepare(
      'INSERT INTO drawing_revision VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,table_name,id,scope_id,kind) DO UPDATE SET last_revision=excluded.last_revision',
    ).run(cam, k.table, k.id, scope, k.kind ?? '', n.revision);
    if (n.payload && k.table !== 'room') {
      const body = JSON.parse(n.payload);
      body.revision = n.revision;
      n.payload = json(body);
      n.checksum = hash(n.payload);
    }
  }
  const keys = Object.keys(n);
  db.prepare(
    'INSERT OR REPLACE INTO ' +
      k.table +
      '(' +
      keys.join(',') +
      ') VALUES(' +
      keys.map(() => '?').join(',') +
      ')',
  ).run(...keys.map((k) => n[k]));
}
function roomRow(cam: string, r: Room) {
  const payload = json({ polygons: r.polygons, sections: r.sections });
  return {
    campaign_id: cam,
    id: r.id,
    scope_id: r.scopeId,
    number: r.number,
    name: r.name,
    revision: r.revision,
    payload,
    checksum: hash(payload),
    floor_id: r.floorId,
  };
}
export function drawingElement(db: any, cam: string, id: string): DrawingElement {
  if (typeof id !== 'string' || !id) throw new Error('Elementkennung prüfen.');
  const row = db.prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?').get(cam, id);
  if (!row) throw new Error('Zeichnungselement fehlt.');
  return checkedElementRow(row);
}
function checkedElementRow(row: any): DrawingElement {
  const e = parsed<DrawingElement>(row);
  validateDrawingElement(e);
  if (
    e.id !== row.id ||
    e.scopeId !== row.scope_id ||
    e.floorId !== row.floor_id ||
    e.roomId !== row.room_id ||
    e.kind !== row.kind ||
    e.revision !== row.revision
  )
    throw new Error('Zeichnungsidentität widersprüchlich.');
  return e;
}
function checkElementLocation(db: any, cam: string, e: DrawingElement) {
  if (
    !db
      .prepare('SELECT 1 FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?')
      .get(cam, e.scopeId, e.floorId)
  )
    throw new Error('Geschoss fehlt.');
  if (e.roomId) {
    const r = drawingRoom(db, cam, e.roomId);
    if (r.scopeId !== e.scopeId || r.floorId !== e.floorId)
      throw new Error('Raum gehört zu einem anderen Geschoss.');
  }
}
function recordPlacement(references: Set<string>, cam: string, e: DrawingElement) {
  if (e.archived || !e.roomId || !e.content?.reference) return;
  const key = json([cam, e.content.reference.kind, e.content.reference.id]);
  if (references.has(key))
    throw new Error(
      'Dieser konkrete Encounter / Loot besitzt bereits eine Dungeonplatzierung. Für eine weitere Platzierung eine unabhängige Inhaltskopie verwenden.',
    );
  references.add(key);
}
export function readDrawingElements(db: any, cam: string) {
  const elements: DrawingElement[] = [],
    references = new Set<string>();
  for (const row of db
    .prepare('SELECT * FROM drawing_element WHERE campaign_id=? ORDER BY rowid')
    .iterate(cam)) {
    const e = checkedElementRow(row);
    recordPlacement(references, cam, e);
    elements.push(e);
  }
  return elements;
}
function validateDrawingElements(db: any) {
  const references = new Set<string>();
  for (const row of db.prepare('SELECT * FROM drawing_element').iterate()) {
    const e = checkedElementRow(row);
    checkElementLocation(db, row.campaign_id, e);
    recordPlacement(references, row.campaign_id, e);
  }
}
function elementRow(cam: string, e: DrawingElement) {
  const payload = json(e);
  return {
    campaign_id: cam,
    id: e.id,
    scope_id: e.scopeId,
    floor_id: e.floorId,
    room_id: e.roomId,
    kind: e.kind,
    revision: e.revision,
    payload,
    checksum: hash(payload),
  };
}
function featureState(db: any, cam: string, e: DrawingElement) {
  const r = db
    .prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=? AND id=?')
    .get(cam, e.id);
  return r
    ? parsed(r)
    : { id: e.id, revision: 0, charges: e.maxCharges, resetStartedMs: null, epochId: null };
}
function saveFeature(db: any, cam: string, s: any) {
  s = { ...s, revision: s.revision + 1 };
  const payload = json(s);
  db.prepare(
    'INSERT INTO dungeon_feature_state VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, s.id, s.revision, payload, hash(payload));
  return s;
}
export function executeDrawing(db: any, c: DrawingCommand, guard: () => void) {
  return db
    .transaction(() => {
      guard();
      if (
        ![
          'trigger-field',
          'graph-move',
          'graph-create',
          'graph-duplicate',
          'graph-hide',
          'graph-layout',
          'graph-commit',
          'key-content',
          'key-batch',
          'key-copy',
          'path-publish',
          'path-convert',
          'path-hide',
          'passage',
          'volume-initialize',
          'volume-edit',
          'create-room',
          'shape',
          'merge',
          'room-hide',
          'style',
          'floor',
          'element',
          'elements',
          'element-hide',
        ].includes(c.action?.kind)
      )
        throw new Error('Unbekannte Zeichnungsaktion.');
      const cam = c.campaignId,
        fp = hash(json({ ...c, token: undefined })),
        receipt = db.prepare('SELECT fingerprint FROM receipt WHERE command_id=?').get(c.commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp) throw new Error('Zeichnungskennung anders verwendet.');
        return;
      }
      const changes: Delta[] = [],
        apply = (key: Key, target: any) => {
          const before = read(db, cam, key);
          put(db, cam, key, target);
          const after = read(db, cam, key);
          const old = changes.find((d) => json(d.key) === json(key));
          if (old) {
            old.after = after;
            old.guard = fingerprint(after);
          } else changes.push({ key, before, after, guard: fingerprint(after) });
        },
        hide = (kind: 'room' | 'floor', scopeId: string, id: string, hidden: boolean) => {
          const key = { table: 'drawing_hidden', id, scopeId, kind };
          apply(key, {
            campaign_id: cam,
            id,
            scope_id: scopeId,
            kind,
            revision: 0,
            hidden: Number(hidden),
          });
        },
        room = (id: string) => drawingRoom(db, cam, id),
        create = (
          scopeId: string,
          floorId: string,
          name: string,
          polygons: Polygon[],
          sections: Room['sections'] = [{ id: randomUUID(), kind: 'markdown', markdown: '' }],
        ) => {
          const n = db
              .prepare(
                'SELECT coalesce(max(CAST(number AS INTEGER)),0)+1 n FROM room WHERE campaign_id=?',
              )
              .get(cam).n,
            r: Room = {
              id: randomUUID(),
              scopeId,
              floorId,
              name,
              number: String(n),
              revision: 0,
              polygons,
              sections,
            };
          validateRoom(r);
          db.prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)').run(
            cam,
            r.id,
            scopeId,
            r.number,
            r.name,
            0,
            json({ polygons, sections: r.sections }),
            hash(json({ polygons, sections: r.sections })),
            floorId,
          );
          db.prepare("INSERT INTO drawing_hidden VALUES(?,?,?,'room',0,1)").run(cam, r.id, scopeId);
          hide('room', scopeId, r.id, false);
          db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(r.id, cam);
          return r;
        },
        storeElement = (e: DrawingElement) => {
          validateDrawingElement(e);
          validateDungeonPlacement(db, cam, e);
          checkElementLocation(db, cam, e);
          apply({ table: 'drawing_element', id: e.id }, elementRow(cam, e));
          if (
            e.kind === 'feature' &&
            !db
              .prepare('SELECT 1 FROM dungeon_feature_state WHERE campaign_id=? AND id=?')
              .get(cam, e.id)
          )
            saveFeature(db, cam, featureState(db, cam, e));
          else if (e.kind === 'feature') {
            const state = featureState(db, cam, e);
            if (state.charges > e.maxCharges)
              saveFeature(db, cam, { ...state, charges: e.maxCharges });
          }
        };
      const a = c.action;
      if (a.kind === 'trigger-field') {
        executeTriggerAction(db, cam, a, apply);
      } else if (a.kind === 'graph-commit') {
        for (const change of a.changes) {
          if (fingerprint(read(db, cam, change.key)) !== fingerprint(change.before))
            throw new Error('Dungeonstand vor Graphübernahme geändert.');
          apply(change.key, change.after);
        }
        validateDrawingElements(db);
        validateDungeonKeys(db);
      } else if (
        a.kind === 'graph-move' ||
        a.kind === 'graph-create' ||
        a.kind === 'graph-duplicate' ||
        a.kind === 'graph-hide' ||
        a.kind === 'graph-layout'
      ) {
        executeGraphEdit(db, cam, a, { apply, room, roomRow, create, hide, element: storeElement });
      } else if (a.kind === 'key-content' || a.kind === 'key-batch' || a.kind === 'key-copy') {
        executeKeyAction(db, cam, a, { apply, room, roomRow });
      } else if (
        a.kind === 'path-publish' ||
        a.kind === 'path-convert' ||
        a.kind === 'path-hide' ||
        a.kind === 'passage'
      ) {
        executePathAction(db, cam, a, dungeonGeometry(db, cam), {
          apply,
          room,
          create,
          hide,
          element: storeElement,
          roomRow,
        });
      } else if (a.kind === 'volume-initialize' || a.kind === 'volume-edit') {
        executeVolumeAction(db, cam, a, {
          apply,
          room,
          create,
          hide,
          element: storeElement,
          roomRow,
        });
      } else if (a.kind === 'create-room') {
        if (
          !db
            .prepare('SELECT 1 FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?')
            .get(cam, a.scopeId, a.floorId)
        )
          throw new Error('Geschoss fehlt.');
        // Free contours remain canonical. Only an explicit volume command quantizes them.
        create(a.scopeId, a.floorId, a.name, a.polygons);
      } else if (a.kind === 'shape' || a.kind === 'merge') {
        const ids = a.kind === 'shape' ? [a.roomId] : a.roomIds,
          rs = ids.map(room);
        if (
          !rs.length ||
          rs.some((r) => r.scopeId !== rs[0]!.scopeId || r.floorId !== rs[0]!.floorId)
        )
          throw new Error('Räume desselben Geschosses auswählen.');
        for (let i = 0; i < rs.length; i++)
          if (
            rs[i]!.revision !== (a.kind === 'shape' ? a.expectedRevision : a.expectedRevisions[i])
          )
            throw new Error('Konturstand geändert. Vorschau aktualisieren.');
        const target = {
          ...rs[0]!,
          polygons: a.kind === 'shape' ? a.polygons : combineRooms(rs.map((r) => r.polygons)),
        };
        validateRoom(target);
        const preserveBoundary = a.kind === 'shape' && a.preserveBoundaryAnchors === true;
        if (
          a.kind === 'shape' &&
          a.preserveBoundaryAnchors !== undefined &&
          typeof a.preserveBoundaryAnchors !== 'boolean'
        )
          throw new Error('Wandanker-Zuordnung prüfen.');
        // Only an explicit, topology-preserving deformation carries boundary positions.
        // Boolean cuts/merges cannot infer edge identity from coincident index counts.
        if (
          preserveBoundary &&
          (a.kind !== 'shape' ||
            a.transform ||
            rs[0]!.polygons.length !== target.polygons.length ||
            rs[0]!.polygons.some((p, i) => {
              const next = target.polygons[i]!;
              return (
                p.outer.length !== next.outer.length ||
                p.holes.length !== next.holes.length ||
                p.holes.some((h, j) => h.length !== next.holes[j]!.length) ||
                next.outer.some(
                  (v, j) =>
                    Math.hypot(
                      v.x - next.outer[(j + 1) % next.outer.length]!.x,
                      v.y - next.outer[(j + 1) % next.outer.length]!.y,
                    ) < 1e-8,
                )
              );
            }))
        )
          throw new Error(
            'Wandanker benötigen dieselbe Konturtopologie ohne zusätzliche Transformation.',
          );
        const boundaryTarget = preserveBoundary ? { ...target } : null;
        apply({ table: 'room', id: target.id }, roomRow(cam, target));
        const rebasedVolume = rebaseRoomVolume(
          db,
          cam,
          target,
          apply,
          a.kind === 'shape' ? a.transform : undefined,
        );
        if (rebasedVolume) {
          target.polygons = volumeProjection(rebasedVolume);
          apply({ table: 'room', id: target.id }, roomRow(cam, target));
        }
        for (const r of rs.slice(1)) hide('room', r.scopeId, r.id, true);
        for (const row of db
          .prepare('SELECT * FROM drawing_element WHERE campaign_id=?')
          .all(cam)) {
          const e = parsed<DrawingElement>(row);
          if (a.kind === 'shape' && a.transform && e.roomId === target.id) {
            const t = a.transform,
              move = (p: { x: number; y: number }) => ({
                x:
                  t.origin.x +
                  (p.x - t.origin.x) * t.scale * Math.cos(t.angle) -
                  (p.y - t.origin.y) * t.scale * Math.sin(t.angle) +
                  t.dx,
                y:
                  t.origin.y +
                  (p.x - t.origin.x) * t.scale * Math.sin(t.angle) +
                  (p.y - t.origin.y) * t.scale * Math.cos(t.angle) +
                  t.dy,
              });
            e.points = e.points.map(move);
            e.angle += (t.angle * 180) / Math.PI;
            if (e.kind !== 'light') e.width *= t.scale;
            if (e.kind === 'object') e.height *= t.scale;
            storeElement(e);
            continue;
          }
          if (e.anchor && rs.some((r) => r.id === e.anchor!.roomId)) {
            const old = anchored(e, rs),
              mapped = boundaryTarget ? deformedBoundaryPoints(e, rs[0]!, boundaryTarget) : old,
              center =
                mapped.length > 1
                  ? { x: (mapped[0]!.x + mapped[1]!.x) / 2, y: (mapped[0]!.y + mapped[1]!.y) / 2 }
                  : mapped[0]!,
              binding = nearestAnchor(center, target);
            e.anchor =
              binding && binding.distance < 0.25
                ? { roomId: target.id, polygon: binding.polygon, edge: binding.edge, t: binding.t }
                : null;
            e.roomId = e.anchor ? target.id : null;
            e.points = e.anchor && boundaryTarget ? anchored(e, [target]) : old;
            storeElement(e);
          } else if (rs.slice(1).some((r) => r.id === e.roomId)) {
            e.roomId = target.id;
            storeElement(e);
          }
          if (e.targetRoomId && rs.slice(1).some((r) => r.id === e.targetRoomId)) {
            e.targetRoomId = target.id;
            storeElement(e);
          }
        }
      } else if (a.kind === 'room-hide') {
        const r = room(a.roomId);
        hide('room', r.scopeId, r.id, a.hidden);
      } else if (a.kind === 'style') {
        const r = room(a.style.id),
          old = db
            .prepare(
              'SELECT * FROM drawing_profile WHERE campaign_id=? AND scope_id=? AND target_id=?',
            )
            .get(cam, r.scopeId, r.id);
        if (
          (old?.revision ?? null) !== a.expectedRevision ||
          !Number.isFinite(a.style.ceilingMeters) ||
          a.style.ceilingMeters <= 0 ||
          a.style.ceilingMeters > 1000 ||
          !/^#[a-f0-9]{6}$/i.test(a.style.fill) ||
          !/^#[a-f0-9]{6}$/i.test(a.style.wall)
        )
          throw new Error('Raumstil oder Deckenhöhe prüfen.');
        const style = { ...a.style, scopeId: r.scopeId },
          id = old?.id ?? randomUUID(),
          p = json(style);
        apply(
          { table: 'drawing_profile', id },
          {
            campaign_id: cam,
            id,
            scope_id: r.scopeId,
            target_id: r.id,
            revision: a.style.revision,
            payload: p,
            checksum: hash(p),
          },
        );
      } else if (a.kind === 'floor') {
        if (!a.name.trim() || !Number.isFinite(a.elevation) || Math.abs(a.elevation) > 10000)
          throw new Error('Geschossname und metrische Höhe prüfen.');
        const existing = db
          .prepare('SELECT * FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?')
          .get(cam, a.scopeId, a.id);
        if (existing)
          apply(
            { table: 'drawing_floor', id: a.id, scopeId: a.scopeId },
            { ...existing, name: a.name, source_elevation: a.elevation },
          );
        else {
          db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(
            cam,
            a.scopeId,
            a.id,
            a.name,
            a.elevation,
          );
          db.prepare("INSERT INTO drawing_hidden VALUES(?,?,?,'floor',0,1)").run(
            cam,
            a.id,
            a.scopeId,
          );
        }
        hide('floor', a.scopeId, a.id, a.hidden);
        if (a.cloneId && !existing) {
          if (
            !db
              .prepare('SELECT 1 FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?')
              .get(cam, a.scopeId, a.cloneId)
          )
            throw new Error('Quellgeschoss fehlt.');
          const mapping = new Map<string, string>(),
            elementIds = new Map<string, string>();
          const sourceSelection = db
            .prepare('SELECT selected_id FROM campaign WHERE id=?')
            .get(cam).selected_id;
          let copiedSelection: string | null = null;
          for (const row of db
            .prepare(
              'SELECT id FROM drawing_element WHERE campaign_id=? AND scope_id=? AND floor_id=?',
            )
            .iterate(cam, a.scopeId, a.cloneId))
            elementIds.set(row.id, randomUUID());
          for (const source of db
            .prepare('SELECT id FROM room WHERE campaign_id=? AND scope_id=? AND floor_id=?')
            .all(cam, a.scopeId, a.cloneId)) {
            const r = room(source.id);
            validateRoom(r);
            const sections =
              a.copyKeys === false
                ? [{ id: randomUUID(), kind: 'markdown' as const, markdown: '' }]
                : r.sections.map((section) => ({
                    ...structuredClone(section),
                    id: randomUUID(),
                    ...(section.kind === 'passage'
                      ? { doorId: elementIds.get(section.doorId!) ?? section.doorId }
                      : {}),
                  }));
            const n = create(
              a.scopeId,
              a.id,
              r.name + ' · Kopie',
              structuredClone(r.polygons),
              sections,
            );
            mapping.set(r.id, n.id);
            const volume = readDungeonVolume(db, cam, r.id);
            if (volume) {
              const clone = {
                ...structuredClone(volume),
                id: randomUUID(),
                roomId: n.id,
                floorId: a.id,
                revision: 0,
              };
              apply({ table: 'dungeon_volume', id: clone.id }, volumeRow(cam, clone));
            }
            const hidden = db
              .prepare(
                "SELECT hidden FROM drawing_hidden WHERE campaign_id=? AND scope_id=? AND id=? AND kind='room'",
              )
              .get(cam, r.scopeId, r.id);
            if (hidden?.hidden) hide('room', n.scopeId, n.id, true);
            else if (!copiedSelection || r.id === sourceSelection) copiedSelection = n.id;
            const profile = db
              .prepare(
                'SELECT * FROM drawing_profile WHERE campaign_id=? AND scope_id=? AND target_id=?',
              )
              .get(cam, r.scopeId, r.id);
            if (profile) {
              const style = parsed<RoomStyle>(profile),
                id = randomUUID(),
                payload = json({ ...style, id: n.id, scopeId: n.scopeId, revision: 0 });
              apply(
                { table: 'drawing_profile', id },
                {
                  campaign_id: cam,
                  id,
                  scope_id: n.scopeId,
                  target_id: n.id,
                  revision: 0,
                  payload,
                  checksum: hash(payload),
                },
              );
            }
          }
          if (copiedSelection)
            db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(copiedSelection, cam);
          if (a.copyKeys !== false)
            for (const surface of readDungeonKeys(db, cam).filter(
              (k) => k.kind === 'surface' && k.surface && mapping.has(k.surface.roomId),
            )) {
              const body = {
                ...structuredClone(surface),
                id: randomUUID(),
                revision: 0,
                name: surface.name + ' · Kopie',
                blocks: surface.blocks.map((b) => ({ ...structuredClone(b), id: randomUUID() })),
              };
              body.surface!.roomId = mapping.get(surface.surface!.roomId)!;
              body.surface!.fragments = body.surface!.fragments.map((f) => {
                const source = readDungeonVolumes(db, cam).find((v) => v.id === f.volumeId),
                  target = source
                    ? readDungeonVolumes(db, cam).find(
                        (v) => v.roomId === mapping.get(source.roomId),
                      )
                    : null;
                return {
                  ...f,
                  id: randomUUID(),
                  volumeId: target?.id ?? f.volumeId,
                  unbound: f.unbound || !target,
                };
              });
              const payload = json(body);
              apply(
                { table: 'dungeon_key_content', id: body.id },
                {
                  campaign_id: cam,
                  id: body.id,
                  scope_id: a.scopeId,
                  kind: 'surface',
                  revision: 0,
                  payload,
                  checksum: hash(payload),
                },
              );
            }
          for (const [sourceId, copyId] of elementIds) {
            const row = db
                .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?')
                .get(cam, sourceId),
              e = checkedElementRow(row),
              n = {
                ...e,
                id: copyId,
                floorId: a.id,
                roomId: e.roomId ? (mapping.get(e.roomId) ?? null) : null,
                anchor: e.anchor
                  ? { ...e.anchor, roomId: mapping.get(e.anchor.roomId) ?? e.anchor.roomId }
                  : null,
                targetFloorId: e.targetFloorId === a.cloneId ? a.id : e.targetFloorId,
                targetRoomId: e.targetRoomId
                  ? (mapping.get(e.targetRoomId) ?? e.targetRoomId)
                  : null,
              };
            if (n.content) {
              n.content = structuredClone(n.content);
              const copiedVolume = readDungeonVolume(db, cam, n.roomId ?? '');
              if (copiedVolume) n.content.anchor.volumeId = copiedVolume.id;
              if (n.content.reference) {
                n.content.sourceReference = n.content.reference;
                n.content.reference = null;
              }
            }
            storeElement(n);
          }
        }
      } else if (a.kind === 'element') {
        if (a.expectedRoom) {
          const r = room(a.expectedRoom.id);
          if (
            r.revision !== a.expectedRoom.revision ||
            r.scopeId !== a.element.scopeId ||
            r.floorId !== a.element.floorId ||
            a.element.roomId !== r.id ||
            a.element.anchor?.roomId !== r.id
          )
            throw new Error(
              'Raumwand inzwischen geändert. Ansicht laden und Tür erneut platzieren.',
            );
        }
        const old = db
          .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?')
          .get(cam, a.element.id);
        if (old) checkedElementRow(old);
        if ((old?.revision ?? null) !== a.expectedRevision)
          throw new Error('Element wurde geändert.');
        storeElement(a.element);
      } else if (a.kind === 'elements') {
        if (a.elements.length > 2000) throw new Error('Höchstens 2000 Elemente pro Zug.');
        for (const e of a.elements) {
          if (
            db.prepare('SELECT 1 FROM drawing_element WHERE campaign_id=? AND id=?').get(cam, e.id)
          )
            throw new Error('Streuelement existiert bereits.');
          storeElement(e);
        }
      } else {
        const e = checkedElementRow(
          db.prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?').get(cam, a.id),
        );
        if (e.revision !== a.expectedRevision) throw new Error('Element wurde geändert.');
        storeElement({ ...e, archived: a.archived });
      }
      const cursor = db.prepare('SELECT cursor FROM campaign WHERE id=?').get(cam).cursor;
      db.prepare('DELETE FROM history WHERE campaign_id=? AND ordinal>?').run(cam, cursor);
      const marker = json({ kind: 'drawing', scope: 'shared', version: 1 });
      db.prepare('INSERT INTO history VALUES(?,?,?,?,?,?)').run(
        cam,
        cursor + 1,
        'drawing',
        marker,
        marker,
        0,
      );
      const payload = json({ changes });
      db.prepare('INSERT INTO drawing_history VALUES(?,?,?,?)').run(
        cam,
        cursor + 1,
        payload,
        hash(payload),
      );
      db.prepare('UPDATE campaign SET cursor=? WHERE id=?').run(cursor + 1, cam);
      db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
        c.commandId,
        fp,
        cam,
        'drawing',
        cursor + 1,
      );
    })
    .immediate();
}
export function drawingHistory(db: any, cam: string, ordinal: number, direction: 'undo' | 'redo') {
  const row = db
    .prepare('SELECT * FROM drawing_history WHERE campaign_id=? AND ordinal=?')
    .get(cam, ordinal);
  if (!row) return false;
  const h = checkedDrawingHistory(db, row);
  for (const d of h.changes)
    if (fingerprint(read(db, cam, d.key)) !== d.guard)
      throw new Error('Zeichnung wurde außerhalb dieser History geändert.');
  for (const d of direction === 'undo' ? [...h.changes].reverse() : h.changes) {
    put(db, cam, d.key, direction === 'undo' ? d.before : d.after);
    d.guard = fingerprint(read(db, cam, d.key));
    if (d.key.table === 'room') {
      const current = read(db, cam, d.key);
      for (const neighbor of db
        .prepare(
          `SELECT ordinal FROM history WHERE campaign_id=? AND room_id=? AND ordinal ${direction === 'undo' ? '<' : '>'}? ORDER BY ordinal ${direction === 'undo' ? 'DESC' : 'ASC'} LIMIT 1`,
        )
        .all(cam, d.key.id, ordinal))
        db.prepare('UPDATE history SET guard_revision=? WHERE campaign_id=? AND ordinal=?').run(
          current.revision,
          cam,
          neighbor.ordinal,
        );
    }
  }
  validateDrawingElements(db);
  validateDungeonKeys(db);
  const payload = json(h);
  db.prepare(
    'UPDATE drawing_history SET payload=?,checksum=? WHERE campaign_id=? AND ordinal=?',
  ).run(payload, hash(payload), cam, ordinal);
  const remaining = new Set(h.changes.map((d) => json(d.key)));
  let search = ordinal;
  while (remaining.size) {
    const candidate = db
      .prepare(
        `SELECT * FROM drawing_history WHERE campaign_id=? AND ordinal ${direction === 'undo' ? '<' : '>'}? ORDER BY ordinal ${direction === 'undo' ? 'DESC' : 'ASC'} LIMIT 1`,
      )
      .get(cam, search);
    if (!candidate) break;
    search = candidate.ordinal;
    const next = checkedDrawingHistory(db, candidate);
    let changed = false;
    for (const d of next.changes)
      if (remaining.has(json(d.key))) {
        d.guard = fingerprint(read(db, cam, d.key));
        remaining.delete(json(d.key));
        changed = true;
      }
    if (changed) {
      const p = json(next);
      db.prepare(
        'UPDATE drawing_history SET payload=?,checksum=? WHERE campaign_id=? AND ordinal=?',
      ).run(p, hash(p), cam, candidate.ordinal);
    }
  }
  return true;
}
export function rebaseDrawingRoomHistory(
  db: any,
  cam: string,
  roomId: string,
  ordinal: number,
  direction: 'undo' | 'redo',
) {
  let search = ordinal;
  while (true) {
    const row = db
      .prepare(
        `SELECT * FROM drawing_history WHERE campaign_id=? AND ordinal ${direction === 'undo' ? '<' : '>'}? ORDER BY ordinal ${direction === 'undo' ? 'DESC' : 'ASC'} LIMIT 1`,
      )
      .get(cam, search);
    if (!row) break;
    search = row.ordinal;
    const h = parsed<{ changes: Delta[] }>(row),
      d = h.changes.find((d) => d.key.table === 'room' && d.key.id === roomId);
    if (!d) continue;
    d.guard = fingerprint(read(db, cam, d.key));
    const p = json(h);
    db.prepare(
      'UPDATE drawing_history SET payload=?,checksum=? WHERE campaign_id=? AND ordinal=?',
    ).run(p, hash(p), cam, row.ordinal);
    break;
  }
}
export function activateDungeonFeature(
  db: any,
  cam: string,
  id: string,
  sceneId: string,
  expected: number,
  action: 'activate' | 'reset' | 'correct',
  charges: number | null,
  commandId: string,
) {
  return db
    .transaction(() => {
      if (!['activate', 'reset', 'correct'].includes(action))
        throw new Error('Unbekannte Featureaktion.');
      const e = checkedElementRow(
          db
            .prepare(
              "SELECT * FROM drawing_element WHERE campaign_id=? AND id=? AND kind='feature'",
            )
            .get(cam, id),
        ),
        fp = hash(json({ id, sceneId, expected, action, charges })),
        receipt = db
          .prepare('SELECT fingerprint FROM dungeon_feature_receipt WHERE command_id=?')
          .get(commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp) throw new Error('Featurekennung anders verwendet.');
        return;
      }
      const clock = db
        .prepare('SELECT * FROM scene_clock WHERE campaign_id=? AND scene_id=?')
        .get(cam, sceneId);
      if (!clock || e.archived || e.feature !== 'trap')
        throw new Error('Feature oder Gruppenzeit fehlt.');
      let s = featureState(db, cam, e);
      if (s.revision !== expected) throw new Error('Featurezustand geändert.');
      if (action === 'activate') {
        if (s.charges <= 0) throw new Error('Keine Charges.');
        s.charges--;
        if (
          s.resetStartedMs === null &&
          e.resetSeconds > 0 &&
          (e.resetMode === 'used' || s.charges === 0)
        ) {
          s.resetStartedMs = clock.instant_ms;
          s.epochId = clock.epoch_id;
        }
      } else if (action === 'reset') {
        s.charges = e.maxCharges;
        s.resetStartedMs = null;
        s.epochId = null;
      } else {
        if (charges === null || !Number.isInteger(charges) || charges < 0 || charges > e.maxCharges)
          throw new Error('Charges zwischen 0 und Maximum eingeben.');
        s.charges = charges;
        s.resetStartedMs = null;
        s.epochId = null;
      }
      saveFeature(db, cam, s);
      db.prepare('INSERT INTO dungeon_feature_receipt VALUES(?,?,?)').run(cam, commandId, fp);
    })
    .immediate();
}
export function advanceDungeonFeatures(db: any, cam: string, epochId: string, toMs: string) {
  for (const row of db
    .prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=?')
    .all(cam)) {
    const s = parsed(row);
    if (s.resetStartedMs === null || s.epochId !== epochId) continue;
    const e = checkedElementRow(
      db.prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?').get(cam, s.id),
    );
    if (
      !e.archived &&
      e.feature === 'trap' &&
      e.resetSeconds > 0 &&
      BigInt(toMs) >= BigInt(s.resetStartedMs) + BigInt(e.resetSeconds) * 1000n
    )
      saveFeature(db, cam, { ...s, charges: e.maxCharges, resetStartedMs: null, epochId: null });
  }
}
export function resetDungeonFeatureByNpc(db: any, cam: string, id: string) {
  const e = checkedElementRow(
    db
      .prepare("SELECT * FROM drawing_element WHERE campaign_id=? AND id=? AND kind='feature'")
      .get(cam, id),
  );
  if (e.archived || !e.roomId || e.feature !== 'trap')
    throw new Error('Feature ist nicht mehr verlässlich verankert.');
  saveFeature(db, cam, {
    ...featureState(db, cam, e),
    charges: e.maxCharges,
    resetStartedMs: null,
    epochId: null,
  });
}
function checkedDrawingHistory(db: any, row: any) {
  const history = parsed<{ changes: Delta[] }>(row);
  if (!Array.isArray(history?.changes)) throw new Error('Zeichnungshistory ungültig.');
  for (const delta of history.changes) {
    if (
      !delta?.key ||
      !drawingTables.has(delta.key.table) ||
      typeof delta.key.id !== 'string' ||
      !delta.key.id ||
      typeof delta.guard !== 'string' ||
      !/^([a-f0-9]{64})$/.test(delta.guard)
    )
      throw new Error('Unbekannte Zeichnungshistoryeinheit.');
    for (const state of [delta.before, delta.after])
      if (state) {
        if (
          typeof state !== 'object' ||
          Array.isArray(state) ||
          state.campaign_id !== row.campaign_id ||
          state.id !== delta.key.id ||
          (delta.key.scopeId !== undefined && state.scope_id !== delta.key.scopeId) ||
          (delta.key.kind !== undefined && state.kind !== delta.key.kind)
        )
          throw new Error('Zeichnungshistory widersprüchlich.');
        if (delta.key.table === 'drawing_element') checkedElementRow(state);
        if (delta.key.table === 'dungeon_volume') validateVolumeHistoryRow(db, state);
        if (delta.key.table === 'dungeon_path' || delta.key.table === 'dungeon_passage')
          validatePathHistoryRow(db, delta.key.table, state);
        if (delta.key.table === 'dungeon_graph_layout') validateGraphHistoryRow(state);
        if (delta.key.table === 'dungeon_key_content') validateKeyHistoryRow(state);
      }
  }
  return history;
}
export function validateFeatureStates(db: any) {
  for (const row of db.prepare('SELECT * FROM dungeon_feature_state').iterate()) {
    const state = parsed<any>(row),
      element = checkedElementRow(
        db
          .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?')
          .get(row.campaign_id, row.id),
      );
    if (
      element.kind !== 'feature' ||
      state.id !== row.id ||
      state.revision !== row.revision ||
      !Number.isSafeInteger(state.revision) ||
      state.revision < 0 ||
      !Number.isSafeInteger(state.charges) ||
      state.charges < 0 ||
      state.charges > element.maxCharges ||
      !(
        state.resetStartedMs === null ||
        (typeof state.resetStartedMs === 'string' &&
          /^(0|[1-9][0-9]{0,29})$/.test(state.resetStartedMs))
      ) ||
      !(state.epochId === null || (typeof state.epochId === 'string' && !!state.epochId)) ||
      (state.resetStartedMs === null) !== (state.epochId === null)
    )
      throw Error('Gespeicherte Fallenladung oder Resetzeit ungültig.');
  }
}
export function validateDrawing(db: any) {
  validateFeatureStates(db);
  validateDungeonKeys(db);
  validateGraphLayouts(db);
  validateDungeonVolumes(db);
  validateDungeonPaths(db);
  validateDrawingElements(db);
  for (const row of db.prepare('SELECT * FROM drawing_history').iterate())
    checkedDrawingHistory(db, row);
}
