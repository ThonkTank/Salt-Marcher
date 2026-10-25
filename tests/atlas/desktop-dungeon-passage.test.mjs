import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/dungeon-passage-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/atlas/dungeon-ui.ts'],
  outfile: '.build/dungeon-passage-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/dungeon-passage-store.cjs'),
  u = 1.524;
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'dungeon-passage-')),
    file = path.join(root, 'campaign.sqlite'),
    store = new CampaignStore(file);
  const room = (name, floorId, x = 0) => ({
    id: randomUUID(),
    scopeId: 'local',
    floorId,
    number: name,
    name,
    revision: 0,
    polygons: [
      {
        outer: [
          { x, y: 0 },
          { x: x + 4 * u, y: 0 },
          { x: x + 4 * u, y: 4 * u },
          { x, y: 4 * u },
        ],
        holes: [],
      },
    ],
    sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Unveränderte Raumprosa\r\n' }],
  });
  const rooms = [
      room('Torraum', 'ground'),
      room('Anderes Geschoss', 'upper'),
      room('Zielraum', 'ground', 6 * u),
    ],
    cam = store.create('Passagenreise', rooms),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  for (const r of rooms)
    store.executeDrawing(
      command({
        kind: 'volume-initialize',
        roomId: r.id,
        expectedRoomRevision: 0,
        expectedVolumeRevision: null,
        heightSteps: 4,
      }),
    );
  const hero = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
  ).character;
  store.executeLive(
    command({
      kind: 'membership',
      characterId: hero.id,
      expectedRevision: hero.membershipRevision,
      expectedRosterRevision: store.live(w.token).rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: null,
    }),
  );
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const side = (target) => ({
    description: '  Lokale Passage\r\n',
    passable: true,
    sight: false,
    light: false,
    sound: false,
    additionalSeconds: 17,
    target,
  });
  const passage = (r, target) => {
    const volume = store.drawing(w.token).volumes.find((v) => v.roomId === r.id);
    return {
      id: randomUUID(),
      revision: 0,
      scopeId: r.scopeId,
      roomId: r.id,
      volumeId: volume.id,
      pathId: null,
      otherRoomId: null,
      anchor: {
        roomId: r.id,
        volumeId: volume.id,
        pinned: true,
        local: { x: 0, y: 1, z: 0, face: 'west' },
      },
      widthSteps: 1,
      heightSteps: 2,
      outbound: side(target),
      inbound: { ...side({ kind: 'geometry', id: r.id }), passable: false },
      assigned: true,
    };
  };
  const target = passage(rooms[2], { kind: 'passage', id: 'missing-return' }),
    source = passage(rooms[0], { kind: 'passage', id: target.id });
  for (const p of [target, source])
    store.executeDrawing(command({ kind: 'passage', passage: p, expectedRevision: null }));
  const current = () => store.dungeon(w.token),
    place = (r) =>
      store.executeDungeon(
        command({
          kind: 'place',
          sceneId: scene.id,
          expectedPositionRevision: current().positionRevision,
          pose: {
            scopeId: r.scopeId,
            floorId: r.floorId,
            roomId: r.id,
            x: 0.5 * u,
            y: 1.5 * u,
            z: 0,
          },
        }),
      ),
    traverse = () =>
      command({
        kind: 'passage-traverse',
        sceneId: scene.id,
        passageId: source.id,
        expectedRevision: 0,
        side: 'outbound',
        movement: 'walk',
      });
  return { store, file, rooms, cam, w, scene, source, target, command, current, place, traverse };
}
test('a passage on another floor cannot be used at overlapping coordinates and changes no state', (t) => {
  const x = fixture(t);
  x.place(x.rooms[1]);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeDungeon(x.traverse()), /Passage|Geschoss|Raum/);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('a valid independent passage side lands inside its target, books its additional time once and preserves authored text', (t) => {
  const x = fixture(t);
  x.place(x.rooms[0]);
  const drawing = x.store.drawing(x.w.token),
    c = x.traverse(),
    v = x.store.executeDungeon(c);
  assert.equal(v.position.roomId, x.rooms[2].id);
  assert.equal(v.position.floorId, 'ground');
  assert.equal(v.position.x, 6.5 * u);
  assert.equal(v.instantMs, '17000');
  const bytes = x.store.db.serialize();
  x.store.executeDungeon(c);
  assert.deepEqual(x.store.db.serialize(), bytes);
  assert.deepEqual(x.store.drawing(x.w.token), drawing);
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.dungeon(w.token).position, v.position);
    assert.equal(fresh.dungeon(w.token).instantMs, '17000');
  } finally {
    fresh.close();
  }
});
test('missing and unassigned passage targets fail atomically without deleting the local description', (t) => {
  const x = fixture(t);
  x.place(x.rooms[0]);
  x.store.executeDrawing(
    x.command({ kind: 'passage', passage: { ...x.target, assigned: false }, expectedRevision: 0 }),
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeDungeon(x.traverse()), /Passagenziel/);
  assert.deepEqual(x.store.db.serialize(), before);
  const local = x.store.drawing(x.w.token).passages.find((p) => p.id === x.source.id);
  assert.equal(local.outbound.description, '  Lokale Passage\r\n');
  assert.equal(local.outbound.passable, true);
  assert.equal(local.inbound.passable, false);
});

test('travel UI keeps broken-link descriptions visible and disables missing or unbound destinations', async (t) => {
  const x = fixture(t);
  x.place(x.rooms[0]);
  for (const [kind, id, description] of [
    ['passage', 'missing-passage', 'Fehlende Passage'],
    ['location', 'missing-place', 'Fehlender Ort'],
  ])
    x.store.executeDrawing(
      x.command({
        kind: 'passage',
        passage: {
          ...x.source,
          id: randomUUID(),
          outbound: { ...x.source.outbound, description, target: { kind, id } },
        },
        expectedRevision: null,
      }),
    );
  const previous = {
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
      ResizeObserver: globalThis.ResizeObserver,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    ResizeObserver: class {
      observe() {}
    },
  });
  t.after(() => Object.assign(globalThis, previous));
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.options[0]?.value ?? '',
    });
  window.campaign = { dungeon: async () => ({ ok: true, value: x.current() }) };
  delete require.cache[require.resolve('../../.build/dungeon-passage-ui.cjs')];
  const ui = require('../../.build/dungeon-passage-ui.cjs');
  ui.initDungeon(() => {});
  ui.activateDungeon(x.w);
  await ui.openDungeon();
  const buttons = () => [...document.querySelectorAll('#dungeon-passage-links button')];
  assert.equal(buttons().length, 3);
  assert.equal(buttons().find((b) => b.textContent.includes('Fehlende Passage')).disabled, true);
  assert.equal(buttons().find((b) => b.textContent.includes('Fehlender Ort')).disabled, true);
  assert.equal(buttons().find((b) => b.textContent.includes('Lokale Passage')).disabled, false);
  x.store.executeDrawing(
    x.command({ kind: 'passage', passage: { ...x.target, assigned: false }, expectedRevision: 0 }),
  );
  await ui.openDungeon();
  assert.equal(
    buttons().every((b) => b.disabled),
    true,
  );
  assert.match(
    document.getElementById('dungeon-passage-links').textContent,
    /Lokale Passage.*Passagenziel fehlt/s,
  );
});
