import { createHash, randomUUID } from 'node:crypto';
import type { CityUnit } from '../city-contracts';
import { validateRoom } from '../contracts';
import { validateDrawingElement } from '../drawing-contracts';
import {
  checkGroupRecipe,
  generateRoomGroup,
  type GroupRecipe,
  type GroupDraft,
} from '../room-group-generator';
import { combineRooms, carveRoom, anchored, inside, nearestAnchor } from '../drawing-model';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installRoomGroups(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS room_group(campaign_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES scope(campaign_id,id)) STRICT; CREATE INDEX IF NOT EXISTS room_scope_floor ON room(campaign_id,scope_id,floor_id); CREATE INDEX IF NOT EXISTS drawing_element_scope ON drawing_element(campaign_id,scope_id);`,
  );
}
export function storeGroupDraft(
  db: any,
  cam: string,
  id: string,
  name: string,
  recipe: GroupRecipe,
): GroupDraft {
  const draft = generateRoomGroup(id, recipe);
  db.prepare('INSERT INTO scope VALUES(?,?,?)').run(cam, id, name);
  for (const f of draft.floors)
    db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(
      cam,
      id,
      f.id,
      f.name,
      f.elevation,
    );
  let number = db
    .prepare('SELECT coalesce(max(CAST(number AS INTEGER)),0) n FROM room WHERE campaign_id=?')
    .get(cam).n;
  const roomInsert = db.prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)'),
    elementInsert = db.prepare('INSERT INTO drawing_element VALUES(?,?,?,?,?,?,?,?,?)');
  for (const room of draft.rooms) {
    room.number = String(++number);
    validateRoom(room);
    const p = JSON.stringify({ polygons: room.polygons, sections: room.sections });
    roomInsert.run(cam, room.id, id, room.number, room.name, 0, p, hash(p), room.floorId);
  }
  for (const e of draft.elements) {
    validateDrawingElement(e);
    const p = JSON.stringify(e);
    elementInsert.run(cam, e.id, id, e.floorId, e.roomId, e.kind, e.revision, p, hash(p));
  }
  const door = draft.elements.find((e) => e.name === 'Eingang')!,
    entrance = {
      id: id + ':entrance',
      scopeId: id,
      roomId: door.roomId!,
      floorId: 'ground',
      inside: { x: 0, y: -recipe.depth / 2 + 0.8 },
      outside: { x: 0, y: -recipe.depth / 2 - 0.8 },
      revision: 1,
    };
  const ep = JSON.stringify(entrance);
  db.prepare('INSERT INTO atlas_entrance VALUES(?,?,?,?)').run(cam, entrance.id, ep, hash(ep));
  const p = JSON.stringify({ id, recipe, protected: false });
  db.prepare('INSERT INTO room_group VALUES(?,?,0,?,?)').run(cam, id, p, hash(p));
  return draft;
}
export function groupRecipeForHouse(u: CityUnit): GroupRecipe {
  if (u.groupRecipe) return u.groupRecipe;
  const p = u.outline!;
  return {
    version: 1,
    seed: u.recipe?.seed ?? u.id,
    profile: ['Wohnhaus', 'Werkstatt', 'Handel', 'Taverne', 'Tempel', 'Lager'].includes(u.use ?? '')
      ? (u.use as GroupRecipe['profile'])
      : 'Wohnhaus',
    width: Math.max(3, Math.max(...p.map((p) => p.x)) - Math.min(...p.map((p) => p.x))),
    depth: Math.max(3, Math.max(...p.map((p) => p.y)) - Math.min(...p.map((p) => p.y))),
  };
}
/** Only derived rendering data lives in city_unit; rooms own the geometry. */
export function refreshGroupHull(db: any, cam: string, id: string, protect = false) {
  const row = db
    .prepare("SELECT payload FROM city_unit WHERE campaign_id=? AND id=? AND kind='building'")
    .get(cam, id);
  const meta = db.prepare('SELECT * FROM room_group WHERE campaign_id=? AND id=?').get(cam, id);
  if (!meta) return;
  if (protect) {
    const value = JSON.parse(meta.payload);
    if (!value.protected) {
      value.protected = true;
      const p = JSON.stringify(value);
      db.prepare(
        'UPDATE room_group SET revision=revision+1,payload=?,checksum=? WHERE campaign_id=? AND id=?',
      ).run(p, hash(p), cam, id);
    }
  }
  if (!row) return;
  const rooms = db
    .prepare(
      "SELECT r.payload FROM room r WHERE r.campaign_id=? AND r.scope_id=? AND r.floor_id='ground' AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1)",
    )
    .all(cam, id);
  const footprint = combineRooms(rooms.map((r: any) => JSON.parse(r.payload).polygons)),
    u = JSON.parse(row.payload);
  u.footprint = footprint;
  u.outline = footprint[0]?.outer ?? u.outline;
  u.interior = true;
  u.groupId = id;
  delete u.rooms;
  if (protect) u.protected = true;
  const p = JSON.stringify(u);
  if (p !== row.payload)
    db.prepare('UPDATE city_unit SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
      p,
      hash(p),
      cam,
      id,
    );
}
export function refreshChangedGroupHulls(db: any, cam: string, protect: boolean) {
  const ids = db
    .prepare(
      "SELECT DISTINCT coalesce(json_extract(after_json,'$.scope_id'),json_extract(before_json,'$.scope_id')) id FROM atlas_delta WHERE table_name IN ('room','drawing_element','drawing_floor','drawing_hidden','drawing_profile','dungeon_volume','dungeon_key_content','dungeon_path','dungeon_passage','dungeon_trigger_field')",
    )
    .all();
  for (const { id } of ids) if (id) refreshGroupHull(db, cam, id, protect);
}
export function removeGeneratedGroup(db: any, cam: string, id: string, explicit = false) {
  const group = db
    .prepare('SELECT payload FROM room_group WHERE campaign_id=? AND id=?')
    .get(cam, id);
  if (!group) return;
  if (!explicit && JSON.parse(group.payload).protected)
    throw Error('Bearbeitete Raumgruppe bleibt geschützt.');
  const u = db.prepare('SELECT payload FROM city_unit WHERE campaign_id=? AND id=?').get(cam, id);
  if (!explicit && u && JSON.parse(u.payload).protected)
    throw Error('Bearbeitetes Gebäude bleibt geschützt.');
  // A live/explored group has campaign references beyond geometry history.
  // Keep it intact; the user can move actors and resolve these references first.
  for (const table of ['dungeon_memory', 'dungeon_slice_memory', 'dungeon_trace', 'dungeon_signal'])
    if (
      db
        .prepare('SELECT 1 FROM ' + table + ' WHERE campaign_id=? AND scope_id=? LIMIT 1')
        .get(cam, id)
    )
      throw Error('Raumgruppe wird im Spiel verwendet und kann nicht gelöscht werden.');
  for (const table of ['scene_position', 'npc_dungeon_position'])
    if (
      db
        .prepare(
          'SELECT 1 FROM ' +
            table +
            " WHERE campaign_id=? AND (json_extract(payload,'$.scopeId')=? OR json_extract(payload,'$.dungeon.scopeId')=?) LIMIT 1",
        )
        .get(cam, id, id)
    )
      throw Error('Zuerst die Figuren aus der Raumgruppe bewegen.');
  if (
    db
      .prepare(
        'SELECT 1 FROM room_draft d JOIN room r ON r.campaign_id=d.campaign_id AND r.id=d.room_id WHERE r.campaign_id=? AND r.scope_id=? LIMIT 1',
      )
      .get(cam, id)
  )
    throw Error('Zuerst den offenen Raumentwurf speichern oder verwerfen.');
  if (
    db
      .prepare(
        'SELECT 1 FROM dungeon_reveal d JOIN room r ON r.campaign_id=d.campaign_id AND r.id=d.room_id WHERE r.campaign_id=? AND r.scope_id=? LIMIT 1',
      )
      .get(cam, id)
  )
    throw Error('Bereits erkundete Raumgruppen bleiben erhalten.');
  if (
    db
      .prepare(
        'SELECT 1 FROM dungeon_feature_state d JOIN drawing_element e ON e.campaign_id=d.campaign_id AND e.id=d.id WHERE e.campaign_id=? AND e.scope_id=? LIMIT 1',
      )
      .get(cam, id)
  )
    throw Error('Raumgruppe enthält bereits bespielte Einrichtungen.');
  for (const table of [
    'dungeon_trigger_field',
    'dungeon_passage',
    'dungeon_path',
    'dungeon_volume',
    'dungeon_key_content',
    'dungeon_graph_layout',
    'drawing_element',
    'drawing_profile',
    'drawing_hidden',
    'room',
    'drawing_floor',
  ])
    db.prepare('DELETE FROM ' + table + ' WHERE campaign_id=? AND scope_id=?').run(cam, id);
  db.prepare(
    "DELETE FROM atlas_entrance WHERE campaign_id=? AND json_extract(payload,'$.scopeId')=?",
  ).run(cam, id);
  db.prepare('DELETE FROM atlas_binding WHERE campaign_id=? AND owner_id=?').run(cam, id);
  db.prepare('DELETE FROM location_map WHERE campaign_id=? AND scope_id=?').run(cam, id);
  db.prepare('DELETE FROM room_group WHERE campaign_id=? AND id=?').run(cam, id);
  db.prepare('DELETE FROM scope WHERE campaign_id=? AND id=?').run(cam, id);
}
export function validateRoomGroups(db: any) {
  for (const row of db.prepare('SELECT * FROM room_group').iterate()) {
    if (hash(row.payload) !== row.checksum) throw Error('Raumgruppe beschädigt.');
    const g = JSON.parse(row.payload);
    checkGroupRecipe(g.recipe);
    if (g.id !== row.id || typeof g.protected !== 'boolean')
      throw Error('Raumgruppenidentität widersprüchlich.');
    const binding = db
      .prepare(
        "SELECT owner_id,parent_id FROM atlas_binding WHERE campaign_id=? AND kind='dungeon' AND owner_id=?",
      )
      .get(row.campaign_id, row.id);
    if (!binding || (binding.parent_id && binding.parent_id !== row.id))
      throw Error('Gebäude und Raumgruppe benötigen dieselbe Identität.');
  }
}
/** Horizontal group scale: authored identities/heights survive, every object follows. */
export function scaleRoomGroup(db: any, cam: string, id: string, factor: number) {
  if (!Number.isFinite(factor) || factor < 0.1 || factor > 10)
    throw Error('Skalierungsfaktor zwischen 0,1 und 10 wählen.');
  if (!db.prepare('SELECT 1 FROM scope WHERE campaign_id=? AND id=?').get(cam, id))
    throw Error('Raumgruppe fehlt.');
  if (
    db
      .prepare('SELECT 1 FROM dungeon_volume WHERE campaign_id=? AND scope_id=? LIMIT 1')
      .get(cam, id)
  )
    throw Error('Volumen im festen 5-Fuß-Raster zuerst mit dem Volumenwerkzeug bearbeiten.');
  const point = (p: any) => ({ ...p, x: p.x * factor, y: p.y * factor });
  for (const row of db
    .prepare('SELECT * FROM room WHERE campaign_id=? AND scope_id=?')
    .all(cam, id)) {
    const value = JSON.parse(row.payload);
    value.polygons = value.polygons.map((p: any) => ({
      outer: p.outer.map(point),
      holes: p.holes.map((h: any) => h.map(point)),
    }));
    validateRoom({ name: row.name, ...value });
    const payload = JSON.stringify(value);
    db.prepare(
      'UPDATE room SET revision=revision+1,payload=?,checksum=? WHERE campaign_id=? AND id=?',
    ).run(payload, hash(payload), cam, row.id);
  }
  for (const row of db
    .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND scope_id=?')
    .all(cam, id)) {
    const e = JSON.parse(row.payload);
    e.points = e.points.map(point);
    e.width *= factor;
    if (e.kind === 'object' || e.kind === 'text') e.height *= factor;
    e.revision++;
    validateDrawingElement(e);
    const payload = JSON.stringify(e);
    db.prepare(
      'UPDATE drawing_element SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
    ).run(e.revision, payload, hash(payload), cam, e.id);
  }
  for (const row of db
    .prepare(
      "SELECT * FROM atlas_entrance WHERE campaign_id=? AND json_extract(payload,'$.scopeId')=?",
    )
    .all(cam, id)) {
    const e = JSON.parse(row.payload);
    e.inside = point(e.inside);
    e.outside = point(e.outside);
    e.revision++;
    const p = JSON.stringify(e);
    db.prepare('UPDATE atlas_entrance SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
      p,
      hash(p),
      cam,
      e.id,
    );
  }
  for (const table of ['scene_position', 'npc_dungeon_position'])
    for (const row of db.prepare('SELECT * FROM ' + table + ' WHERE campaign_id=?').all(cam)) {
      const body = JSON.parse(row.payload),
        pose = table === 'scene_position' ? body.dungeon : body;
      if (pose?.scopeId !== id) continue;
      const next =
          table === 'scene_position'
            ? { ...body, dungeon: point(pose), revision: body.revision + 1 }
            : point(pose),
        p = JSON.stringify(next);
      db.prepare(
        'UPDATE ' +
          table +
          ' SET ' +
          (table === 'scene_position' ? 'revision=?,' : '') +
          'payload=?,checksum=? WHERE campaign_id=? AND ' +
          (table === 'scene_position' ? 'scene_id' : 'actor_id') +
          '=?',
      ).run(
        ...(table === 'scene_position' ? [next.revision] : []),
        p,
        hash(p),
        cam,
        table === 'scene_position' ? row.scene_id : row.actor_id,
      );
    }
  refreshGroupHull(db, cam, id, true);
}

/** Split retains the old identity and all authored sections on the larger side;
 * the other side starts with an empty key. Objects follow their physical center. */
export function splitGroupRoom(
  db: any,
  cam: string,
  roomId: string,
  expected: number,
  axis: 'x' | 'y',
  ratio: number,
) {
  if (!['x', 'y'].includes(axis) || !Number.isFinite(ratio) || ratio < 0.1 || ratio > 0.9)
    throw Error('Teilung zwischen 10 und 90 Prozent wählen.');
  const row = db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(cam, roomId);
  if (!row || row.revision !== expected) throw Error('Raum inzwischen geändert.');
  if (db.prepare('SELECT 1 FROM dungeon_volume WHERE campaign_id=? AND room_id=?').get(cam, roomId))
    throw Error('Rasterräume mit dem Volumenwerkzeug teilen.');
  const value = JSON.parse(row.payload),
    points = value.polygons.flatMap((p: any) => p.outer),
    min = Math.min(...points.map((p: any) => p[axis])),
    max = Math.max(...points.map((p: any) => p[axis])),
    cut = min + (max - min) * ratio;
  const box = {
    x: Math.min(...points.map((p: any) => p.x)) - 1,
    y: Math.min(...points.map((p: any) => p.y)) - 1,
    xx: Math.max(...points.map((p: any) => p.x)) + 1,
    yy: Math.max(...points.map((p: any) => p.y)) + 1,
  };
  const clip = {
    outer:
      axis === 'x'
        ? [
            { x: cut, y: box.y },
            { x: box.xx, y: box.y },
            { x: box.xx, y: box.yy },
            { x: cut, y: box.yy },
          ]
        : [
            { x: box.x, y: cut },
            { x: box.xx, y: cut },
            { x: box.xx, y: box.yy },
            { x: box.x, y: box.yy },
          ],
    holes: [],
  };
  const one = carveRoom(value.polygons, [clip]),
    two = carveRoom(value.polygons, one);
  if (!one.length || !two.length) throw Error('Die Teilung muss zwei Flächen ergeben.');
  const area = (polygons: any[]) =>
    polygons.reduce(
      (s, p) =>
        s +
        Math.abs(
          p.outer.reduce((n: number, a: any, i: number) => {
            const b = p.outer[(i + 1) % p.outer.length];
            return n + a.x * b.y - b.x * a.y;
          }, 0),
        ),
      0,
    );
  const first = area(one) >= area(two) ? one : two,
    second = first === one ? two : one,
    id = randomUUID(),
    sections = [{ id: randomUUID(), kind: 'markdown' as const, markdown: '' }];
  validateRoom({ name: row.name, polygons: first, sections: value.sections });
  validateRoom({ name: row.name + ' · Teil', polygons: second, sections });
  const contains = (point: any, polygons: any) =>
    inside(point, polygons) ||
    (nearestAnchor(point, { id: 'piece', polygons } as any)?.distance ?? Infinity) < 1e-6;
  const inSecond = (point: any) => !contains(point, first) && contains(point, second);
  const p = JSON.stringify({ ...value, polygons: first }),
    q = JSON.stringify({ polygons: second, sections });
  db.prepare(
    'UPDATE room SET revision=revision+1,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(p, hash(p), cam, roomId);
  const number = String(
    db
      .prepare('SELECT coalesce(max(CAST(number AS INTEGER)),0)+1 n FROM room WHERE campaign_id=?')
      .get(cam).n,
  );
  db.prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)').run(
    cam,
    id,
    row.scope_id,
    number,
    row.name + ' · Teil',
    0,
    q,
    hash(q),
    row.floor_id,
  );
  for (const eRow of db
    .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND scope_id=?')
    .all(cam, row.scope_id)) {
    const e = JSON.parse(eRow.payload);
    if (e.roomId !== roomId && e.targetRoomId !== roomId) continue;
    const oldRoom = { id: roomId, polygons: value.polygons } as any,
      at = anchored(e, [oldRoom]),
      center = {
        x: at.reduce((s, p) => s + p.x, 0) / at.length,
        y: at.reduce((s, p) => s + p.y, 0) / at.length,
      };
    const moved = inSecond(center);
    if (e.roomId === roomId) {
      e.roomId = moved ? id : roomId;
      e.points = at;
      if (e.anchor) {
        const a = nearestAnchor(center, { id: e.roomId, polygons: moved ? second : first } as any);
        e.anchor = a ? { roomId: a.roomId, polygon: a.polygon, edge: a.edge, t: a.t } : null;
      }
    }
    if (e.targetRoomId === roomId && moved) e.targetRoomId = id;
    e.revision++;
    const ep = JSON.stringify(e);
    db.prepare(
      'UPDATE drawing_element SET room_id=?,revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
    ).run(e.roomId, e.revision, ep, hash(ep), cam, e.id);
  }
  // Existing external entrances keep pointing at whichever piece contains them.
  for (const eRow of db
    .prepare(
      "SELECT * FROM atlas_entrance WHERE campaign_id=? AND json_extract(payload,'$.roomId')=?",
    )
    .all(cam, roomId)) {
    const e = JSON.parse(eRow.payload);
    if (!inSecond(e.inside)) continue;
    e.roomId = id;
    e.revision++;
    const ep = JSON.stringify(e);
    db.prepare('UPDATE atlas_entrance SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
      ep,
      hash(ep),
      cam,
      e.id,
    );
  }
  for (const table of ['scene_position', 'npc_dungeon_position'])
    for (const actor of db.prepare('SELECT * FROM ' + table + ' WHERE campaign_id=?').all(cam)) {
      const body = JSON.parse(actor.payload),
        pose = table === 'scene_position' ? body.dungeon : body;
      if (pose?.roomId !== roomId || !inSecond(pose)) continue;
      const nextPose = { ...pose, roomId: id },
        next =
          table === 'scene_position'
            ? { ...body, dungeon: nextPose, revision: body.revision + 1 }
            : nextPose,
        p = JSON.stringify(next);
      db.prepare(
        'UPDATE ' +
          table +
          ' SET ' +
          (table === 'scene_position' ? 'revision=?,' : '') +
          'payload=?,checksum=? WHERE campaign_id=? AND ' +
          (table === 'scene_position' ? 'scene_id' : 'actor_id') +
          '=?',
      ).run(
        ...(table === 'scene_position' ? [next.revision] : []),
        p,
        hash(p),
        cam,
        table === 'scene_position' ? actor.scene_id : actor.actor_id,
      );
    }
  refreshGroupHull(db, cam, row.scope_id, true);
  return { id };
}
