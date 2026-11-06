import { createHash } from 'node:crypto';
import type { DrawingElement, RoomStyle } from '../atlas/drawing-element-contracts';
import type { DrawingView } from '../atlas/drawing-view-contracts';
import { validateDrawingElement } from '../atlas/drawing-contracts';
import { dungeonContentAnchors } from '../atlas/dungeon-content-model';
import { type Room } from '../shared/contracts';
import { readDungeonKeys } from './dungeon-key';
import { passageStatuses, pathState, readDungeonPassages, readDungeonPaths } from './paths';
import { roomGeometries } from './room-reads';
import { readTriggerFields } from './triggers';
import { readDungeonVolumes } from './volume';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export const json = (v: any) => JSON.stringify(v);

export function parsed<T = any>(row: any): T {
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

export function drawingView(db: any, cam: string): DrawingView;

export function drawingView(
  db: any,
  cam: string,
  projection: true,
): import('../atlas/drawing-view-contracts').DrawingView<
  import('../shared/contracts').RoomGeometry,
  import('../atlas/drawing-element-contracts').DrawingElementGeometry
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

export function drawingElement(db: any, cam: string, id: string): DrawingElement {
  if (typeof id !== 'string' || !id) throw new Error('Elementkennung prüfen.');
  const row = db.prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?').get(cam, id);
  if (!row) throw new Error('Zeichnungselement fehlt.');
  return checkedElementRow(row);
}

export function checkedElementRow(row: any): DrawingElement {
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

export function recordPlacement(references: Set<string>, cam: string, e: DrawingElement) {
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
