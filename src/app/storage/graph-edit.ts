import { readTriggerFields, triggerFieldRow } from './triggers';
import { validateGraphLayout } from '../atlas/graph-contracts';
import { randomUUID, createHash } from 'node:crypto';
import type { Room } from '../shared/contracts';
import type { GraphEdit, GraphLayout } from '../atlas/graph-contracts';
import type { DrawingElement } from '../atlas/drawing-contracts';
import { readDungeonVolumes, rebaseRoomVolume, volumeRow, executeVolumeAction } from './volume';
import { readDungeonPaths, readDungeonPassages } from './paths';
import { readDungeonKeys } from './dungeon-key';
import { volumeProjection } from '../atlas/volume-model';
import { graphLayout } from './graph';
interface Owner {
  apply: (key: { table: string; id: string; scopeId?: string; kind?: string }, row: any) => void;
  room: (id: string) => Room;
  roomRow: (cam: string, r: Room) => any;
  create: (
    scopeId: string,
    floorId: string,
    name: string,
    polygons: Room['polygons'],
    sections?: Room['sections'],
  ) => Room;
  hide: (kind: 'room' | 'floor', scopeId: string, id: string, hidden: boolean) => void;
  element: (e: DrawingElement) => void;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function graphLayoutRow(cam: string, p: GraphLayout) {
  const body = { ...p };
  delete body.stored;
  const payload = JSON.stringify(body);
  return {
    campaign_id: cam,
    id: p.id,
    scope_id: p.scopeId,
    revision: p.revision,
    payload,
    checksum: hash(payload),
  };
}
export function executeGraphEdit(db: any, cam: string, a: GraphEdit, owner: Owner) {
  if (a.kind === 'graph-layout') {
    validateGraphLayout(a.layout);
    const current = db
      .prepare('SELECT revision FROM dungeon_graph_layout WHERE campaign_id=? AND id=?')
      .get(cam, a.layout.id);
    if ((current?.revision ?? null) !== a.expectedRevision)
      throw new Error('Graphstand oder Positionen prüfen.');
    owner.apply({ table: 'dungeon_graph_layout', id: a.layout.id }, graphLayoutRow(cam, a.layout));
    return;
  }
  if (a.kind === 'graph-create') {
    if (
      !a.name.trim() ||
      ![a.widthSteps, a.depthSteps, a.heightSteps].every(
        (n) => Number.isInteger(n) && n >= 1 && n <= 100,
      ) ||
      a.widthSteps * a.depthSteps > 20000 ||
      !Number.isFinite(a.point.x + a.point.y)
    )
      throw new Error('Raumname, Rasterposition und Raumgröße prüfen.');
    const x = Math.round(a.point.x / 1.524) * 1.524,
      y = Math.round(a.point.y / 1.524) * 1.524,
      w = a.widthSteps * 1.524,
      h = a.depthSteps * 1.524,
      polygons = [
        {
          outer: [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ],
          holes: [],
        },
      ],
      room = owner.create(a.scopeId, a.floorId, a.name, polygons);
    executeVolumeAction(
      db,
      cam,
      {
        kind: 'volume-initialize',
        roomId: room.id,
        expectedRoomRevision: room.revision,
        expectedVolumeRevision: null,
        heightSteps: a.heightSteps,
      },
      owner,
    );
    return;
  }
  if (!a.roomIds.length || a.roomIds.length > 1000 || new Set(a.roomIds).size !== a.roomIds.length)
    throw new Error('Verschiedene Räume auswählen.');
  const selected = new Set(a.roomIds),
    paths = readDungeonPaths(db, cam);
  if (a.kind === 'graph-duplicate' || a.kind === 'graph-move')
    for (const p of paths)
      if (p.roomId && selected.has(p.from.roomId) && selected.has(p.to.roomId))
        selected.add(p.roomId);
  const rooms = [...selected].map(owner.room),
    scopeId = rooms[0]!.scopeId;
  if (rooms.some((r) => r.scopeId !== scopeId))
    throw new Error('Graphanordnung bleibt in einer Dungeonzeichnung.');
  if (a.kind === 'graph-hide') {
    for (const r of rooms) {
      owner.hide('room', scopeId, r.id, true);
      for (const p of db
        .prepare('SELECT * FROM dungeon_passage WHERE campaign_id=? AND room_id=?')
        .all(cam, r.id)) {
        const body = JSON.parse(p.payload);
        body.assigned = false;
        const payload = JSON.stringify(body);
        owner.apply(
          { table: 'dungeon_passage', id: p.id },
          { ...p, payload, checksum: hash(payload) },
        );
      }
    }
    return;
  }
  if (
    !Number.isSafeInteger(a.dxSteps) ||
    !Number.isSafeInteger(a.dySteps) ||
    Math.abs(a.dxSteps) > 100000 ||
    Math.abs(a.dySteps) > 100000
  )
    throw new Error('Verschiebung in ganzen 5-Fuß-Schritten eingeben.');
  const dx = a.dxSteps * 1.524,
    dy = a.dySteps * 1.524,
    move = (r: Room) => ({
      ...r,
      polygons: r.polygons.map((p) => ({
        outer: p.outer.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        holes: p.holes.map((h) => h.map((p) => ({ x: p.x + dx, y: p.y + dy }))),
      })),
    }),
    layout = graphLayout(db, cam, scopeId),
    volumes = readDungeonVolumes(db, cam),
    keys = readDungeonKeys(db, cam),
    elements: DrawingElement[] = db
      .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId)
      .map((r: any) => JSON.parse(r.payload) as DrawingElement);
  if (a.kind === 'graph-move') {
    for (const r of rooms) {
      const updated = move(r),
        v = rebaseRoomVolume(db, cam, updated, owner.apply, {
          dx,
          dy,
          scale: 1,
          angle: 0,
          origin: { x: 0, y: 0 },
        });
      owner.apply(
        { table: 'room', id: r.id },
        owner.roomRow(cam, v ? { ...updated, polygons: volumeProjection(v) } : updated),
      );
      const position = layout.positions.find((p) => p.roomId === r.id);
      if (position) {
        position.x += dx;
        position.y += dy;
      }
      for (const e of elements.filter((e) => e.roomId === r.id && !e.archived))
        owner.element({ ...e, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
    }
    for (const path of paths.filter(
      (p) =>
        p.roomId &&
        selected.has(p.roomId) &&
        selected.has(p.from.roomId) &&
        selected.has(p.to.roomId),
    )) {
      const body = {
          ...path,
          route: path.route.map((p) => ({ ...p, x: p.x + a.dxSteps, y: p.y + a.dySteps })),
          waypoints: path.waypoints.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
        },
        payload = JSON.stringify(body),
        old = db
          .prepare('SELECT * FROM dungeon_path WHERE campaign_id=? AND id=?')
          .get(cam, path.id);
      owner.apply(
        { table: 'dungeon_path', id: path.id },
        { ...old, payload, checksum: hash(payload) },
      );
    }
    owner.apply({ table: 'dungeon_graph_layout', id: layout.id }, graphLayoutRow(cam, layout));
    return;
  }
  const passages = readDungeonPassages(db, cam);
  const elementCopies = new Map(
    elements
      .filter((e) => e.roomId && selected.has(e.roomId) && !e.archived)
      .map((e) => [e.id, randomUUID()]),
  );
  const groupCopies = new Map<string, string>();
  for (const group of keys.filter((k) => k.kind === 'group')) {
    const members = keys.filter((k) => k.kind === 'room' && k.groupId === group.id);
    if (members.length && members.every((k) => selected.has(k.id))) {
      const id = randomUUID(),
        body = { ...structuredClone(group), id, revision: 0, name: group.name + ' – Kopie' },
        payload = JSON.stringify(body);
      groupCopies.set(group.id, id);
      owner.apply(
        { table: 'dungeon_key_content', id },
        {
          campaign_id: cam,
          id,
          scope_id: scopeId,
          kind: 'group',
          revision: 0,
          payload,
          checksum: hash(payload),
        },
      );
    }
  }
  const map = new Map<string, string>(),
    volumeCopies = new Map<string, string>();
  for (const r of rooms) {
    const moved = move(r),
      copy = owner.create(
        scopeId,
        r.floorId,
        r.name + ' – Kopie',
        moved.polygons,
        r.sections.map((s) => ({
          ...s,
          id: randomUUID(),
          ...(s.kind === 'passage'
            ? { doorId: s.doorId ? (elementCopies.get(s.doorId) ?? s.doorId) : undefined }
            : {}),
        })),
      );
    map.set(r.id, copy.id);
    const profile = db
      .prepare('SELECT * FROM drawing_profile WHERE campaign_id=? AND scope_id=? AND target_id=?')
      .get(cam, scopeId, r.id);
    if (profile) {
      if (hash(profile.payload) !== profile.checksum) throw new Error('Raumstil beschädigt.');
      const id = randomUUID(),
        payload = JSON.stringify({
          ...JSON.parse(profile.payload),
          id: copy.id,
          scopeId,
          revision: 0,
        });
      owner.apply(
        { table: 'drawing_profile', id },
        { ...profile, id, target_id: copy.id, revision: 0, payload, checksum: hash(payload) },
      );
    }
    const old = volumes.find((v) => v.roomId === r.id);
    if (old) {
      const v = {
        ...structuredClone(old),
        id: randomUUID(),
        revision: 0,
        roomId: copy.id,
        columns: old.columns.map((c) => ({
          ...structuredClone(c),
          x: c.x + a.dxSteps,
          y: c.y + a.dySteps,
        })),
        faces: Object.fromEntries(
          Object.entries(old.faces).map(([key, value]) => {
            const [x, y, z, face] = key.split(',');
            return [
              Number(x) + a.dxSteps + ',' + (Number(y) + a.dySteps) + ',' + z + ',' + face,
              value,
            ];
          }),
        ),
      };
      volumeCopies.set(old.id, v.id);
      owner.apply({ table: 'dungeon_volume', id: v.id }, volumeRow(cam, v));
    }
    const key = keys.find((k) => k.id === r.id && k.kind === 'room');
    if (key) {
      const body = {
          ...structuredClone(key),
          id: copy.id,
          revision: 0,
          name: copy.name,
          groupId: key.groupId ? (groupCopies.get(key.groupId) ?? key.groupId) : null,
          blocks: key.blocks.map((b) => ({ ...structuredClone(b), id: randomUUID() })),
        },
        payload = JSON.stringify(body);
      owner.apply(
        { table: 'dungeon_key_content', id: copy.id },
        {
          campaign_id: cam,
          id: copy.id,
          scope_id: scopeId,
          kind: 'room',
          revision: 0,
          payload,
          checksum: hash(payload),
        },
      );
    }
  }
  const copiedPaths = paths.filter(
    (p) => p.roomId && map.has(p.roomId) && map.has(p.from.roomId) && map.has(p.to.roomId),
  );
  const pathCopies = new Map(copiedPaths.map((p) => [p.id, randomUUID()]));
  for (const surface of keys.filter(
    (k) => k.kind === 'surface' && k.surface && selected.has(k.surface.roomId),
  )) {
    const body = {
      ...structuredClone(surface),
      id: randomUUID(),
      revision: 0,
      name: surface.name + ' – Kopie',
      blocks: surface.blocks.map((b) => ({ ...structuredClone(b), id: randomUUID() })),
    };
    body.surface!.roomId = map.get(surface.surface!.roomId)!;
    body.surface!.fragments = body.surface!.fragments.map((f) => ({
      ...f,
      id: randomUUID(),
      volumeId: volumeCopies.get(f.volumeId) ?? f.volumeId,
      unbound: f.unbound || !volumeCopies.has(f.volumeId),
    }));
    const payload = JSON.stringify(body);
    owner.apply(
      { table: 'dungeon_key_content', id: body.id },
      {
        campaign_id: cam,
        id: body.id,
        scope_id: scopeId,
        kind: 'surface',
        revision: 0,
        payload,
        checksum: hash(payload),
      },
    );
  }
  const neededPassages = new Set(passages.filter((p) => map.has(p.roomId)).map((p) => p.id));
  for (const path of copiedPaths) {
    neededPassages.add(path.fromPassageId);
    neededPassages.add(path.toPassageId);
  }
  const passageCopies = new Map([...neededPassages].map((id) => [id, randomUUID()]));
  for (const path of copiedPaths) {
    const id = pathCopies.get(path.id)!,
      body = {
        ...structuredClone(path),
        id,
        revision: 0,
        roomId: map.get(path.roomId!)!,
        volumeId: volumeCopies.get(path.volumeId!)!,
        from: {
          ...path.from,
          roomId: map.get(path.from.roomId)!,
          volumeId: volumeCopies.get(path.from.volumeId!)!,
        },
        to: {
          ...path.to,
          roomId: map.get(path.to.roomId)!,
          volumeId: volumeCopies.get(path.to.volumeId!)!,
        },
        fromPassageId: passageCopies.get(path.fromPassageId)!,
        toPassageId: passageCopies.get(path.toPassageId)!,
        route: path.route.map((p) => ({ ...p, x: p.x + a.dxSteps, y: p.y + a.dySteps })),
        waypoints: path.waypoints.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
      },
      payload = JSON.stringify(body);
    owner.apply(
      { table: 'dungeon_path', id },
      {
        campaign_id: cam,
        id,
        scope_id: scopeId,
        room_id: body.roomId,
        revision: 0,
        payload,
        checksum: hash(payload),
      },
    );
  }
  for (const source of passages.filter((p) => neededPassages.has(p.id))) {
    const id = passageCopies.get(source.id)!,
      pathId = source.pathId ? (pathCopies.get(source.pathId) ?? null) : null;
    const internalGeometry = [source.outbound, source.inbound].every(
      (s) => s.target.kind !== 'geometry' || (s.target.id !== null && map.has(s.target.id)),
    );
    const side = (s: typeof source.outbound) => ({
      ...s,
      target: {
        ...s.target,
        id: s.target.id
          ? ((s.target.kind === 'geometry'
              ? map.get(s.target.id)
              : s.target.kind === 'passage'
                ? passageCopies.get(s.target.id)
                : null) ?? s.target.id)
          : null,
      },
    });
    const passage = {
        ...structuredClone(source),
        id,
        revision: 0,
        pathId,
        roomId: map.get(source.roomId) ?? source.roomId,
        otherRoomId: source.otherRoomId
          ? (map.get(source.otherRoomId) ?? source.otherRoomId)
          : null,
        volumeId: volumeCopies.get(source.volumeId) ?? source.volumeId,
        anchor: {
          ...source.anchor,
          roomId: map.get(source.anchor.roomId) ?? source.anchor.roomId,
          volumeId: source.anchor.volumeId
            ? (volumeCopies.get(source.anchor.volumeId) ?? source.anchor.volumeId)
            : null,
        },
        outbound: side(source.outbound),
        inbound: side(source.inbound),
        assigned:
          source.assigned &&
          map.has(source.roomId) &&
          internalGeometry &&
          (!source.pathId || pathId !== null),
      },
      payload = JSON.stringify(passage);
    owner.apply(
      { table: 'dungeon_passage', id },
      {
        campaign_id: cam,
        id,
        scope_id: scopeId,
        room_id: passage.roomId,
        volume_id: passage.volumeId,
        revision: 0,
        payload,
        checksum: hash(payload),
      },
    );
  }
  for (const e of elements.filter((e) => e.roomId && map.has(e.roomId) && !e.archived)) {
    const copy = {
      ...structuredClone(e),
      id: elementCopies.get(e.id)!,
      revision: 0,
      roomId: map.get(e.roomId!)!,
      targetRoomId: e.targetRoomId ? (map.get(e.targetRoomId) ?? e.targetRoomId) : null,
      points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      anchor: e.anchor
        ? { ...e.anchor, roomId: map.get(e.anchor.roomId) ?? e.anchor.roomId }
        : null,
    };
    if (copy.content) {
      copy.content.anchor.volumeId =
        volumeCopies.get(copy.content.anchor.volumeId) ?? copy.content.anchor.volumeId;
      if (copy.content.reference) {
        copy.content.sourceReference = copy.content.reference;
        copy.content.reference = null;
      }
    }
    owner.element(copy);
  }
  for (const field of readTriggerFields(db, cam).filter((f) => elementCopies.has(f.trapId))) {
    const copy = {
      ...structuredClone(field),
      id: randomUUID(),
      revision: 0,
      trapId: elementCopies.get(field.trapId)!,
      fragments: field.fragments.map((f) => ({
        ...structuredClone(f),
        id: randomUUID(),
        volumeId: volumeCopies.get(f.volumeId) ?? f.volumeId,
        unbound: !volumeCopies.has(f.volumeId) || f.unbound,
      })),
    };
    owner.apply({ table: 'dungeon_trigger_field', id: copy.id }, triggerFieldRow(cam, copy));
  }
  owner.apply({ table: 'dungeon_graph_layout', id: layout.id }, graphLayoutRow(cam, layout));
}
