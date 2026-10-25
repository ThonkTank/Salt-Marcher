import { createHash, randomUUID } from 'node:crypto';
import type { TriggerField, TriggerAction, TriggerEvent } from '../trigger-contracts';
import type { DungeonGeometry, DungeonJourney, DungeonPose } from '../dungeon-contracts';
import { enteredTrigger } from '../trigger-model';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  parsed = (r: any) => {
    if (!r || hash(r.payload) !== r.checksum) throw new Error('Triggerfeld / Kontext beschädigt.');
    return JSON.parse(r.payload);
  };
export function installTriggers(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS dungeon_trigger_field(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,trap_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,trap_id) REFERENCES drawing_element(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_trigger_event(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scene_id TEXT NOT NULL,journey_id TEXT NOT NULL,trap_id TEXT NOT NULL,route_index INTEGER NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,journey_id,trap_id,route_index)) STRICT;`);
}
export function readTriggerFields(db: any, cam: string): TriggerField[] {
  return db
    .prepare('SELECT * FROM dungeon_trigger_field WHERE campaign_id=? ORDER BY rowid')
    .all(cam)
    .map(parsed);
}
export function triggerFieldRow(cam: string, field: TriggerField) {
  const payload = JSON.stringify(field);
  return {
    campaign_id: cam,
    id: field.id,
    scope_id: field.scopeId,
    trap_id: field.trapId,
    revision: field.revision,
    payload,
    checksum: hash(payload),
  };
}
export function validateTriggerField(db: any, cam: string, field: TriggerField) {
  if (
    !field.id ||
    !field.name.trim() ||
    field.name.length > 1000 ||
    !['interrupt', 'notify'].includes(field.mode) ||
    typeof field.archived !== 'boolean' ||
    field.fragments.length > 128
  )
    throw new Error('Triggername, Verhalten und Umfang prüfen.');
  const trap = parsed(
    db.prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?').get(cam, field.trapId),
  );
  if (trap.feature !== 'trap' || trap.kind !== 'feature' || trap.scopeId !== field.scopeId)
    throw new Error('Triggerfelder gehören zu einer Falle derselben Dungeonzeichnung.');
  let total = 0;
  const ids = new Set<string>();
  for (const fragment of field.fragments) {
    if (
      !fragment.id ||
      ids.has(fragment.id) ||
      !fragment.volumeId ||
      fragment.cells.length > 20000 ||
      fragment.cells.some((c) => ![c.x, c.y, c.z].every(Number.isSafeInteger)) ||
      fragment.orphanedWorld?.cells.some((c) => ![c.x, c.y, c.z].every(Number.isSafeInteger))
    )
      throw new Error('Triggerfragmente benötigen stabile IDs und ganze Voxelkoordinaten.');
    ids.add(fragment.id);
    total += fragment.cells.length + (fragment.orphanedWorld?.cells.length ?? 0);
    const cells = new Set(fragment.cells.map((c) => [c.x, c.y, c.z].join(',')));
    if (cells.size !== fragment.cells.length || total > 20000)
      throw new Error('Triggerfeld auf 20.000 verschiedene Zellen begrenzen.');
    if (!fragment.unbound) {
      const row = db
        .prepare('SELECT scope_id FROM dungeon_volume WHERE campaign_id=? AND id=?')
        .get(cam, fragment.volumeId);
      if (!row || row.scope_id !== field.scopeId)
        throw new Error('Triggerfragment benötigt ein Volumen derselben Zeichnung.');
    }
  }
}
export function executeTriggerAction(
  db: any,
  cam: string,
  a: TriggerAction,
  apply: (key: { table: string; id: string }, row: any) => void,
) {
  const row = db
    .prepare('SELECT revision FROM dungeon_trigger_field WHERE campaign_id=? AND id=?')
    .get(cam, a.field.id);
  if ((row?.revision ?? null) !== a.expectedRevision)
    throw new Error('Triggerfeld wurde geändert.');
  validateTriggerField(db, cam, a.field);
  apply({ table: 'dungeon_trigger_field', id: a.field.id }, triggerFieldRow(cam, a.field));
}
export function readTriggerEvents(db: any, cam: string, sceneId: string | null): TriggerEvent[] {
  if (!sceneId) return [];
  return db
    .prepare(
      'SELECT * FROM dungeon_trigger_event WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 100',
    )
    .all(cam, sceneId)
    .map(parsed);
}
export function saveTriggerEvent(db: any, cam: string, event: TriggerEvent) {
  const payload = JSON.stringify(event);
  db.prepare(
    'INSERT INTO dungeon_trigger_event VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(
    cam,
    event.id,
    event.sceneId,
    event.journeyId,
    event.trapId,
    event.routeIndex,
    event.revision,
    payload,
    hash(payload),
  );
}
export function createTriggerEvents(
  db: any,
  cam: string,
  g: DungeonGeometry,
  j: Pick<DungeonJourney, 'id' | 'nextIndex'> & {
    request: Pick<DungeonJourney['request'], 'sceneId'>;
  },
  from: DungeonPose,
  to: DungeonPose,
  instantMs: string,
) {
  const grouped = new Map<string, TriggerField[]>();
  for (const field of g.drawing.triggerFields ?? []) {
    if (!enteredTrigger(g, field, from, to)) continue;
    const trap = g.drawing.elements.find(
      (e) => e.id === field.trapId && !e.archived && e.feature === 'trap',
    );
    if (!trap) continue;
    const state = db
      .prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=? AND id=?')
      .get(cam, trap.id);
    if ((state ? parsed(state).charges : trap.maxCharges) <= 0) continue;
    const fields = grouped.get(trap.id) ?? [];
    fields.push(field);
    grouped.set(trap.id, fields);
  }
  const result: TriggerEvent[] = [];
  for (const [trapId, fields] of grouped) {
    const old = db
      .prepare(
        'SELECT * FROM dungeon_trigger_event WHERE campaign_id=? AND journey_id=? AND trap_id=? AND route_index=?',
      )
      .get(cam, j.id, trapId, j.nextIndex - 1);
    const event: TriggerEvent = old
      ? parsed(old)
      : {
          id: randomUUID(),
          revision: 1,
          sceneId: j.request.sceneId,
          journeyId: j.id,
          trapId,
          fieldIds: fields.map((f) => f.id),
          fieldNames: fields.map((f) => f.name),
          routeIndex: j.nextIndex - 1,
          pose: to,
          instantMs,
          mode: fields.some((f) => f.mode === 'interrupt') ? 'interrupt' : 'notify',
          status: 'open',
          activated: false,
          activatedMs: null,
        };
    if (!old) saveTriggerEvent(db, cam, event);
    result.push(event);
  }
  return result;
}

export function captureTriggerCells(
  db: any,
  cam: string,
  volumes: import('../volume-contracts').DungeonVolume[],
) {
  const selected = new Map(volumes.filter((v) => v.columns.length).map((v) => [v.id, v]));
  return readTriggerFields(db, cam)
    .filter((f) =>
      f.fragments.some((fragment) => !fragment.unbound && selected.has(fragment.volumeId)),
    )
    .map((field) => ({
      field,
      parts: field.fragments
        .filter((f) => !f.unbound && selected.has(f.volumeId))
        .map((fragment) => {
          const v = selected.get(fragment.volumeId)!,
            x = Math.min(...v.columns.map((c) => c.x)),
            y = Math.min(...v.columns.map((c) => c.y)),
            z = Math.min(...v.columns.flatMap((c) => c.spans.map((s) => s.z)));
          return {
            fragment,
            floorId: v.floorId,
            cells: fragment.cells.map((c) => ({ x: x + c.x, y: y + c.y, z: z + c.z })),
          };
        }),
    }));
}
export function rebindTriggerCells(
  cam: string,
  captured: ReturnType<typeof captureTriggerCells>,
  volumes: import('../volume-contracts').DungeonVolume[],
  apply: (key: { table: string; id: string }, row: any) => void,
) {
  for (const record of captured) {
    const field = {
      ...record.field,
      fragments: record.field.fragments.filter(
        (f) => !record.parts.some((p) => p.fragment.id === f.id),
      ),
    };
    for (const part of record.parts) {
      const groups = new Map<string, { x: number; y: number; z: number }[]>(),
        lost: { x: number; y: number; z: number }[] = [];
      for (const cell of part.cells) {
        const candidates = volumes.filter(
          (v) =>
            v.scopeId === field.scopeId &&
            v.floorId === part.floorId &&
            v.columns.some(
              (c) =>
                c.x === cell.x &&
                c.y === cell.y &&
                c.spans.some((s) => cell.z >= s.z && cell.z < s.z + s.height),
            ),
        );
        if (candidates.length !== 1) {
          lost.push(cell);
          continue;
        }
        const v = candidates[0]!,
          x = Math.min(...v.columns.map((c) => c.x)),
          y = Math.min(...v.columns.map((c) => c.y)),
          z = Math.min(...v.columns.flatMap((c) => c.spans.map((s) => s.z))),
          cells = groups.get(v.id) ?? [];
        cells.push({ x: cell.x - x, y: cell.y - y, z: cell.z - z });
        groups.set(v.id, cells);
      }
      let keepId = true;
      for (const [volumeId, cells] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
        field.fragments.push({ id: keepId ? part.fragment.id : randomUUID(), volumeId, cells });
        keepId = false;
      }
      if (lost.length)
        field.fragments.push({
          ...part.fragment,
          id: keepId ? part.fragment.id : randomUUID(),
          unbound: true,
          cells: [],
          orphanedWorld: { floorId: part.floorId, cells: lost },
        });
    }
    apply({ table: 'dungeon_trigger_field', id: field.id }, triggerFieldRow(cam, field));
  }
}
