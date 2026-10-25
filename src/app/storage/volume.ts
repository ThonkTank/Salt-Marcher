import { captureSurfaces, transformSurfaces, rebindSurfaces } from './surfaces';
import { captureTriggerCells, rebindTriggerCells } from './triggers';
import { createHash, randomUUID } from 'node:crypto';
import type { Room } from '../contracts';
import type { DungeonVolume, VolumeAction } from '../atlas/volume-contracts';
import { MAX_VOLUME_COLUMNS, MAX_VOLUME_CELLS } from '../atlas/volume-contracts';
import type { DrawingElement } from '../atlas/drawing-contracts';
import { volumeFromRoom, editVolume, volumeProjection, volumeComponents } from '../atlas/volume-model';
import { inside, anchored } from '../atlas/drawing-model';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installVolumeSchema(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS dungeon_volume(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,room_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,room_id),FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;`,
  );
}
function checkedVolumeRow(db: any, row: any, checkOwner = true): DungeonVolume {
  if (!row || hash(row.payload) !== row.checksum) throw new Error('Dungeonvolumen beschädigt.');
  const v = JSON.parse(row.payload) as DungeonVolume;
  const fail = () => {
    throw new Error('Dungeonvolumen ungültig oder widersprüchlich.');
  };
  const integer = (n: unknown) => Number.isSafeInteger(n);
  if (
    !v ||
    typeof v !== 'object' ||
    v.id !== row.id ||
    v.roomId !== row.room_id ||
    v.scopeId !== row.scope_id ||
    v.revision !== row.revision ||
    !integer(v.revision) ||
    v.revision < 0 ||
    typeof v.floorId !== 'string' ||
    !v.floorId ||
    !Array.isArray(v.columns) ||
    v.columns.length > MAX_VOLUME_COLUMNS ||
    !v.faces ||
    typeof v.faces !== 'object' ||
    Array.isArray(v.faces)
  )
    fail();
  if (checkOwner) {
    const owner = db
      .prepare('SELECT scope_id,floor_id FROM room WHERE campaign_id=? AND id=?')
      .get(row.campaign_id, row.room_id);
    if (!owner || owner.scope_id !== v.scopeId || owner.floor_id !== v.floorId) fail();
  }
  const columns = new Set<string>();
  let total = 0;
  for (const column of v.columns) {
    if (
      !column ||
      !integer(column.x) ||
      !integer(column.y) ||
      !Array.isArray(column.spans) ||
      !column.spans.length
    )
      fail();
    const key = column.x + ',' + column.y;
    if (columns.has(key)) fail();
    columns.add(key);
    let end = -Infinity;
    for (const span of [...column.spans].sort((a, b) => a?.z - b?.z)) {
      if (
        !span ||
        !integer(span.z) ||
        !integer(span.height) ||
        span.height < 1 ||
        !integer(span.z + span.height) ||
        span.z < end ||
        typeof span.floor !== 'boolean' ||
        typeof span.ceiling !== 'boolean' ||
        !['air', 'water'].includes(span.medium)
      )
        fail();
      end = span.z + span.height;
      total += span.height;
      if (total > MAX_VOLUME_CELLS) fail();
    }
  }
  for (const [key, state] of Object.entries(v.faces)) {
    const parts = key.split(',');
    if (
      parts.length !== 4 ||
      !['north', 'east', 'south', 'west'].includes(parts[3]!) ||
      !['open', 'solid'].includes(state)
    )
      fail();
    for (const coordinate of parts.slice(0, 3))
      if (!integer(Number(coordinate)) || String(Number(coordinate)) !== coordinate) fail();
  }
  return v;
}
export function validateDungeonVolumes(db: any) {
  for (const row of db.prepare('SELECT * FROM dungeon_volume').iterate()) checkedVolumeRow(db, row);
}
export function validateVolumeHistoryRow(db: any, row: any) {
  checkedVolumeRow(db, row, false);
}
export function readDungeonVolumes(db: any, cam: string): DungeonVolume[] {
  const volumes: DungeonVolume[] = [];
  for (const row of db
    .prepare('SELECT * FROM dungeon_volume WHERE campaign_id=? ORDER BY room_id')
    .iterate(cam))
    volumes.push(checkedVolumeRow(db, row));
  return volumes;
}
export function readDungeonVolume(db: any, cam: string, roomId: string): DungeonVolume | undefined {
  const row = db
    .prepare('SELECT * FROM dungeon_volume WHERE campaign_id=? AND room_id=?')
    .get(cam, roomId);
  return row ? checkedVolumeRow(db, row) : undefined;
}
export function volumeRow(cam: string, v: DungeonVolume) {
  const payload = JSON.stringify(v);
  return {
    campaign_id: cam,
    id: v.id,
    scope_id: v.scopeId,
    room_id: v.roomId,
    revision: v.revision,
    payload,
    checksum: hash(payload),
  };
}
interface Owner {
  apply: (key: { table: string; id: string }, row: any) => void;
  room: (id: string) => Room;
  create: (scopeId: string, floorId: string, name: string, polygons: Room['polygons']) => Room;
  hide: (kind: 'room' | 'floor', scopeId: string, id: string, hidden: boolean) => void;
  element: (e: DrawingElement) => void;
  roomRow: (cam: string, r: Room) => any;
}
function executeVolumeActionRaw(db: any, cam: string, a: VolumeAction, owner: Owner) {
  if (
    db
      .prepare(
        "SELECT 1 FROM dungeon_path WHERE campaign_id=? AND room_id=? AND json_extract(payload,'$.mode')='path'",
      )
      .get(cam, a.roomId)
  )
    throw new Error('Generierten Pfad zuerst in eine feste Area umwandeln.');
  const room = owner.room(a.roomId),
    existing = readDungeonVolume(db, cam, room.id);
  if (
    room.revision !== a.expectedRoomRevision ||
    (existing?.revision ?? null) !== a.expectedVolumeRevision
  )
    throw new Error('Volumenstand geändert. Zeichnung aktualisieren.');
  let v: DungeonVolume;
  if (a.kind === 'volume-initialize') {
    if (!Number.isSafeInteger(a.heightSteps) || a.heightSteps < 1 || a.heightSteps > 40)
      throw new Error('Höhe benötigt 1–40 Fünf-Fuß-Schritte.');
    if (!['air', 'water'].includes(a.medium ?? 'air')) throw new Error('Volumenmedium prüfen.');
    v = volumeFromRoom(room, a.heightSteps, existing?.id ?? randomUUID());
    v.revision = existing?.revision ?? 0;
    for (const column of v.columns)
      for (const span of column.spans) span.medium = a.medium ?? 'air';
  } else {
    if (
      !Array.isArray(a.cells) ||
      !a.cells.length ||
      a.cells.length > 2000 ||
      !['fill', 'erase', 'floor', 'ceiling', 'wall'].includes(a.operation) ||
      !['air', 'water'].includes(a.medium) ||
      !['north', 'east', 'south', 'west'].includes(a.side) ||
      typeof a.enabled !== 'boolean'
    )
      throw new Error('Volumenzug prüfen.');
    v = editVolume(existing ?? volumeFromRoom(room, 2, randomUUID()), a);
  }
  const parts = volumeComponents(v);
  if (existing) {
    const old = new Map(existing.columns.map((c) => [c.x + ',' + c.y, c]));
    const overlap = (part: typeof v.columns) =>
      part.reduce(
        (n, c) =>
          n +
          c.spans.reduce(
            (n, s) =>
              n +
              (old.get(c.x + ',' + c.y)?.spans ?? []).reduce(
                (n, o) =>
                  n + Math.max(0, Math.min(s.z + s.height, o.z + o.height) - Math.max(s.z, o.z)),
                0,
              ),
            0,
          ),
        0,
      );
    parts.sort((a, b) => overlap(b) - overlap(a));
  }
  if (!parts.length) {
    owner.hide('room', room.scopeId, room.id, true);
    owner.apply({ table: 'dungeon_volume', id: v.id }, volumeRow(cam, v));
    return;
  }
  const results: Room[] = [];
  for (let i = 0; i < parts.length; i++) {
    const columns = parts[i]!,
      byPosition = new Map(columns.map((c) => [c.x + ',' + c.y, c]));
    const faces = Object.fromEntries(
      Object.entries(v.faces).filter(([key]) => {
        const [x, y, z] = key.split(',');
        return byPosition
          .get(x + ',' + y)
          ?.spans.some((s) => Number(z) >= s.z && Number(z) < s.z + s.height);
      }),
    );
    const piece = { ...v, columns, faces },
      polygons = volumeProjection(piece);
    const assigned =
      i === 0 ? room : owner.create(room.scopeId, room.floorId, 'Abgeteiltes Volumen', polygons);
    const volume = { ...piece, id: i === 0 ? v.id : randomUUID(), roomId: assigned.id },
      projectedRoom = { ...assigned, polygons };
    if (
      i === 0 &&
      db
        .prepare(
          "SELECT 1 FROM drawing_hidden WHERE campaign_id=? AND scope_id=? AND id=? AND kind='room' AND hidden=1",
        )
        .get(cam, room.scopeId, room.id)
    )
      owner.hide('room', room.scopeId, room.id, false);
    owner.apply({ table: 'room', id: assigned.id }, owner.roomRow(cam, projectedRoom));
    owner.apply({ table: 'dungeon_volume', id: volume.id }, volumeRow(cam, volume));
    results.push(projectedRoom);
  }
  for (const row of db
    .prepare('SELECT payload FROM drawing_element WHERE campaign_id=? AND room_id=?')
    .all(cam, room.id)) {
    const e = JSON.parse(row.payload) as DrawingElement,
      points = anchored(e, [room]);
    const point =
      e.kind === 'door'
        ? {
            x: points.reduce((n, p) => n + p.x, 0) / points.length,
            y: points.reduce((n, p) => n + p.y, 0) / points.length,
          }
        : points[0]!;
    const match = results.find((result) => inside(point, result.polygons));
    if (match) {
      e.roomId = match.id;
      if (e.anchor) {
        e.points = points;
        e.anchor = null;
      }
    } else {
      e.roomId = null;
      e.points = points;
      e.anchor = null;
    }
    owner.element(e);
  }
  db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(room.id, cam);
}
export function rebaseRoomVolume(
  db: any,
  cam: string,
  r: Room,
  apply: Owner['apply'],
  transform?: {
    dx: number;
    dy: number;
    scale: number;
    angle: number;
    origin: { x: number; y: number };
  },
) {
  const old = readDungeonVolume(db, cam, r.id);
  if (!old) return;
  const triggerCells = captureTriggerCells(db, cam, [old]),
    surfaceCells = captureSurfaces(db, cam, [old]);
  const base = volumeFromRoom(r, 2, old.id),
    columns = new Map(old.columns.map((c) => [c.x + ',' + c.y, c])),
    faces: typeof old.faces = {};
  if (transform) {
    if (
      Math.abs(transform.scale - 1) > 1e-6 ||
      Math.abs(transform.angle / (Math.PI / 2) - Math.round(transform.angle / (Math.PI / 2))) > 1e-6
    )
      throw new Error('3D-Volumen behalten ihren Maßstab und drehen in 90-Grad-Schritten.');
    columns.clear();
    const move = (x: number, y: number) => {
      const dx = (x + 0.5) * 1.524 - transform.origin.x,
        dy = (y + 0.5) * 1.524 - transform.origin.y;
      const nx =
        (transform.origin.x +
          transform.dx +
          dx * Math.cos(transform.angle) -
          dy * Math.sin(transform.angle)) /
        1.524;
      const ny =
        (transform.origin.y +
          transform.dy +
          dx * Math.sin(transform.angle) +
          dy * Math.cos(transform.angle)) /
        1.524;
      if (
        Math.abs(nx - (Math.floor(nx) + 0.5)) > 1e-6 ||
        Math.abs(ny - (Math.floor(ny) + 0.5)) > 1e-6
      )
        throw new Error('Volumenverschiebung und Drehzentrum müssen zum 5-Fuß-Raster passen.');
      return { x: Math.floor(nx), y: Math.floor(ny) };
    };
    for (const c of old.columns) {
      const n = move(c.x, c.y);
      columns.set(n.x + ',' + n.y, { ...c, ...n });
    }
    const sides = ['east', 'south', 'west', 'north'],
      turn = ((Math.round(transform.angle / (Math.PI / 2)) % 4) + 4) % 4;
    for (const [key, state] of Object.entries(old.faces)) {
      const [x, y, z, side] = key.split(','),
        n = move(Number(x), Number(y)),
        mapped = sides[(sides.indexOf(side!) + turn) % 4]!;
      faces[n.x + ',' + n.y + ',' + z + ',' + mapped] = state;
    }
  }
  base.revision = old.revision;
  base.faces = transform ? faces : structuredClone(old.faces);
  const uniform =
    old.columns.length &&
    old.columns.every((c) => JSON.stringify(c.spans) === JSON.stringify(old.columns[0]!.spans))
      ? old.columns[0]!.spans
      : null;
  base.columns = base.columns.map((c) => ({
    ...c,
    spans: structuredClone(columns.get(c.x + ',' + c.y)?.spans ?? uniform ?? c.spans),
  }));
  apply({ table: 'dungeon_volume', id: old.id }, volumeRow(cam, base));
  if (transform)
    for (const record of triggerCells)
      for (const part of record.parts)
        part.cells = part.cells.map((c) => {
          const x = (c.x + 0.5) * 1.524 - transform.origin.x,
            y = (c.y + 0.5) * 1.524 - transform.origin.y;
          return {
            x: Math.floor(
              (transform.origin.x +
                transform.dx +
                x * Math.cos(transform.angle) -
                y * Math.sin(transform.angle)) /
                1.524,
            ),
            y: Math.floor(
              (transform.origin.y +
                transform.dy +
                x * Math.sin(transform.angle) +
                y * Math.cos(transform.angle)) /
                1.524,
            ),
            z: c.z,
          };
        });
  if (triggerCells.length)
    rebindTriggerCells(cam, triggerCells, readDungeonVolumes(db, cam), apply);
  if (transform) transformSurfaces(surfaceCells, transform);
  if (surfaceCells.length) rebindSurfaces(cam, surfaceCells, readDungeonVolumes(db, cam), apply);
  return base;
}

export function executeVolumeAction(db: any, cam: string, a: VolumeAction, owner: Owner) {
  const old = readDungeonVolume(db, cam, a.roomId),
    origin = (v: DungeonVolume) => ({
      x: Math.min(...v.columns.map((c) => c.x)),
      y: Math.min(...v.columns.map((c) => c.y)),
      z: Math.min(...v.columns.flatMap((c) => c.spans.map((s) => s.z))),
    }),
    from = old?.columns.length ? origin(old) : null,
    captured: { id: string; x: number; y: number; z: number }[] = [];
  if (old && from)
    for (const row of db
      .prepare(
        "SELECT id,payload FROM drawing_element WHERE campaign_id=? AND room_id=? AND kind='feature'",
      )
      .all(cam, a.roomId)) {
      const e = JSON.parse(row.payload) as DrawingElement;
      if (!e.archived && e.content?.anchor.volumeId === old.id)
        captured.push({
          id: e.id,
          x: from.x + e.content.anchor.x,
          y: from.y + e.content.anchor.y,
          z: from.z + e.content.anchor.z,
        });
    }
  const triggerCells = old ? captureTriggerCells(db, cam, [old]) : [],
    surfaceCells = old ? captureSurfaces(db, cam, [old]) : [];
  executeVolumeActionRaw(db, cam, a, owner);
  if (triggerCells.length)
    rebindTriggerCells(cam, triggerCells, readDungeonVolumes(db, cam), owner.apply);
  if (surfaceCells.length)
    rebindSurfaces(cam, surfaceCells, readDungeonVolumes(db, cam), owner.apply);
  if (!old || !captured.length) return;
  const volumes = readDungeonVolumes(db, cam).filter(
    (v) => v.scopeId === old.scopeId && v.floorId === old.floorId && v.columns.length,
  );
  for (const anchor of captured) {
    const e = JSON.parse(
      db
        .prepare('SELECT payload FROM drawing_element WHERE campaign_id=? AND id=?')
        .get(cam, anchor.id).payload,
    ) as DrawingElement;
    if (!e.content) continue;
    const candidates = volumes.filter((v) =>
      v.columns.some(
        (c) =>
          c.x === anchor.x &&
          c.y === anchor.y &&
          c.spans.some((s) => anchor.z >= s.z && anchor.z < s.z + s.height),
      ),
    );
    if (candidates.length !== 1) {
      owner.element({ ...e, roomId: null });
      continue;
    }
    const target = candidates[0]!,
      o = origin(target);
    owner.element({
      ...e,
      roomId: target.roomId,
      floorId: target.floorId,
      points: [{ x: (anchor.x + 0.5) * 1.524, y: (anchor.y + 0.5) * 1.524 }],
      zOffsetMeters: anchor.z * 1.524,
      content: {
        ...e.content,
        anchor: { volumeId: target.id, x: anchor.x - o.x, y: anchor.y - o.y, z: anchor.z - o.z },
      },
    });
  }
}
