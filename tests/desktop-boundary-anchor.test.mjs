import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {newElement,anchored,nearestAnchor} from './src/app/drawing-model';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/boundary-anchor-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, newElement, anchored, nearestAnchor } = createRequire(import.meta.url)(
  '../.build/boundary-anchor-store.cjs',
);
function fixture(t) {
  const dir = mkdtempSync(tmpdir() + '/boundary-anchor-'),
    file = dir + '/store.sqlite';
  let store = new CampaignStore(file);
  const rooms = [0, 12.192].map((x, i) => ({
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: String(i + 1),
    name: ['Torhalle', 'Archiv'][i],
    revision: 0,
    polygons: [
      {
        outer: [
          { x, y: 0 },
          { x: x + 6.096, y: 0 },
          { x: x + 6.096, y: 6.096 },
          { x, y: 6.096 },
        ],
        holes: [],
      },
    ],
    sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Originalprosa\r\n' }],
  }));
  const campaign = store.create('Wandtüren', rooms);
  let w = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    }),
    send = (action) => store.executeDrawing(command(action));
  const doors = rooms.map((r, i) => ({
    ...newElement('door', r.scopeId, r.floorId, r.id, [{ x: i * 12.192 + 1.524, y: 0 }]),
    anchor: { roomId: r.id, polygon: 0, edge: 0, t: 0.25 },
    name: 'Tür ' + i,
    notes: '  Originaltür\r\n',
  }));
  for (const element of doors) send({ kind: 'element', element, expectedRevision: null });
  const read = () => store.drawing(w.token),
    position = (id) => {
      const e = read().elements.find((e) => e.id === id),
        points = anchored(e, store.workspace().rooms);
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    };
  return {
    get store() {
      return store;
    },
    rooms,
    doors,
    read,
    position,
    send,
    command,
    get w() {
      return w;
    },
    fresh() {
      store.close();
      store = new CampaignStore(file);
      w = store.activate(campaign.id);
    },
  };
}
const moveWall = (x) => ({
  ...x.rooms[0],
  polygons: x.rooms[0].polygons.map((p) => ({
    ...p,
    outer: p.outer.map((v, i) => (i < 2 ? { ...v, y: v.y - 3.048 } : v)),
  })),
});
test('explicit boundary deformation carries the wall door through commit, replay, undo/redo and Fresh', (t) => {
  const x = fixture(t),
    changed = moveWall(x),
    other = structuredClone(x.read().elements.find((e) => e.id === x.doors[1].id)),
    action = {
      kind: 'shape',
      roomId: changed.id,
      expectedRevision: 0,
      polygons: changed.polygons,
      preserveBoundaryAnchors: true,
    },
    command = x.command(action);
  x.store.executeDrawing(command);
  assert.deepEqual(x.position(x.doors[0].id), { x: 1.524, y: -3.048 });
  const door = x.read().elements.find((e) => e.id === x.doors[0].id);
  assert.equal(door.roomId, changed.id);
  assert(door.anchor);
  assert.equal(door.name, x.doors[0].name);
  assert.equal(door.notes, x.doors[0].notes);
  assert.equal(door.width, x.doors[0].width);
  assert.deepEqual(
    x.read().elements.find((e) => e.id === other.id),
    other,
  );
  assert.deepEqual(x.store.workspace().rooms[0].sections, x.rooms[0].sections);
  const bytes = x.store.db.serialize();
  x.store.executeDrawing(command);
  assert.deepEqual(x.store.db.serialize(), bytes);
  assert.throws(() => x.store.executeDrawing({ ...command, commandId: randomUUID() }), /geändert/);
  assert.deepEqual(x.store.db.serialize(), bytes);
  x.store.history(x.w.token, 'undo');
  assert.deepEqual(x.position(door.id), { x: 1.524, y: 0 });
  x.store.history(x.w.token, 'redo');
  assert.deepEqual(x.position(door.id), { x: 1.524, y: -3.048 });
  x.fresh();
  assert.deepEqual(x.position(door.id), { x: 1.524, y: -3.048 });
  assert.deepEqual(x.store.workspace().rooms[0].sections, x.rooms[0].sections);
});
test('a corner extension leaves a door at its physical position on a surviving wall segment', (t) => {
  const x = fixture(t),
    polygons = structuredClone(x.rooms[0].polygons);
  polygons[0].outer[1].x += 3.048;
  x.send({
    kind: 'shape',
    roomId: x.rooms[0].id,
    expectedRevision: 0,
    polygons,
    preserveBoundaryAnchors: true,
  });
  assert(Math.hypot(x.position(x.doors[0].id).x - 1.524, x.position(x.doors[0].id).y) < 1e-9);
});
test('generic contour replacement retains the existing conservative unbound result', (t) => {
  const x = fixture(t),
    changed = moveWall(x);
  x.send({ kind: 'shape', roomId: changed.id, expectedRevision: 0, polygons: changed.polygons });
  const door = x.read().elements.find((e) => e.id === x.doors[0].id);
  assert.equal(door.anchor, null);
  assert.equal(door.roomId, null);
  assert.deepEqual(x.position(door.id), { x: 1.524, y: 0 });
});
for (const invalid of ['flag', 'topology', 'transform', 'collapsed-edge'])
  test(`invalid boundary deformation rejects ${invalid} atomically`, (t) => {
    const x = fixture(t),
      action = {
        kind: 'shape',
        roomId: x.rooms[0].id,
        expectedRevision: 0,
        polygons: moveWall(x).polygons,
        preserveBoundaryAnchors: true,
      };
    if (invalid === 'flag') action.preserveBoundaryAnchors = 'yes';
    if (invalid === 'topology') action.polygons[0].outer.splice(1, 0, { x: 3.048, y: -3.048 });
    if (invalid === 'transform')
      action.transform = { dx: 0, dy: 0, scale: 1, angle: 0, origin: { x: 0, y: 0 } };
    if (invalid === 'collapsed-edge')
      action.polygons[0].outer[1] = { ...action.polygons[0].outer[0] };
    const bytes = x.store.db.serialize();
    assert.throws(() => x.send(action));
    assert.deepEqual(x.store.db.serialize(), bytes);
  });

test('canonical volume projection may reorder edges without losing the transported wall position', (t) => {
  const x = fixture(t),
    id = x.rooms[0].id;
  x.send({
    kind: 'volume-initialize',
    roomId: id,
    expectedRoomRevision: 0,
    expectedVolumeRevision: null,
    heightSteps: 2,
  });
  const room = x.store.workspace().rooms.find((r) => r.id === id),
    door = x.read().elements.find((e) => e.id === x.doors[0].id),
    binding = nearestAnchor({ x: 1.524, y: 0 }, room);
  x.send({
    kind: 'element',
    expectedRevision: door.revision,
    element: {
      ...door,
      roomId: id,
      anchor: { roomId: id, polygon: binding.polygon, edge: binding.edge, t: binding.t },
    },
  });
  const polygons = room.polygons.map((p) => ({
    ...p,
    outer: p.outer.map((v) => (v.y === 0 ? { ...v, y: -3.048 } : v)),
  }));
  x.send({
    kind: 'shape',
    roomId: id,
    expectedRevision: room.revision,
    polygons,
    preserveBoundaryAnchors: true,
  });
  assert.deepEqual(x.position(door.id), { x: 1.524, y: -3.048 });
  assert(x.read().elements.find((e) => e.id === door.id).anchor);
  x.fresh();
  assert.deepEqual(x.position(door.id), { x: 1.524, y: -3.048 });
});

test('a corner turning the wall carries its door fraction onto the new wall line', (t) => {
  const x = fixture(t),
    polygons = structuredClone(x.rooms[0].polygons);
  polygons[0].outer[1].y = -3.048;
  x.send({
    kind: 'shape',
    roomId: x.rooms[0].id,
    expectedRevision: 0,
    polygons,
    preserveBoundaryAnchors: true,
  });
  assert.deepEqual(x.position(x.doors[0].id), { x: 1.524, y: -0.762 });
});
