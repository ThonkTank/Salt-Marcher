import { test } from 'node:test';
import { parseHTML } from './helpers/dom.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {newElement} from './src/app/drawing-model';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/dungeon-authoring-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, newElement } = createRequire(import.meta.url)(
  '../.build/dungeon-authoring-store.cjs',
);
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dungeon-author-')),
    store = new CampaignStore(path.join(dir, 'workbench.sqlite'));
  const rooms = ['Torhalle', 'Wachstube', 'Keller'].map((name, i) => ({
    id: randomUUID(),
    scopeId: 'local',
    floorId: i === 0 ? 'ground' : 'upper',
    number: String(i + 1),
    name,
    revision: 0,
    polygons: [
      {
        outer: [
          { x: i * 12, y: 0 },
          { x: i * 12 + 6, y: 0 },
          { x: i * 12 + 6, y: 6 },
          { x: i * 12, y: 6 },
        ],
        holes: [],
      },
    ],
    sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Original ' + name + '\r\n' }],
  }));
  const campaign = store.create('Autorenstand', rooms),
    w = store.activateShell(campaign.id),
    send = (action) =>
      store.executeDrawing({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, rooms, campaign, w, send };
}
test('authoring reads all active floors without travel, does not write, and retains authored bytes', (t) => {
  const x = fixture(t);
  x.store.db
    .prepare('INSERT INTO dungeon_trace VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(x.campaign.id, 'bad-trace', null, null, 'local', 'ground', 'epoch', '0', '{}', 'broken');
  const before = x.store.db.serialize();
  assert.throws(() => x.store.dungeon(x.w.token), /wahrnehmung beschädigt/);
  const view = x.store.dungeonAuthoring(x.w.token);
  assert.deepEqual(
    new Map(view.rooms.map((r) => [r.id, r])),
    new Map(x.rooms.map((r) => [r.id, r])),
  );
  assert(!('sceneId' in view));
  assert(!('senses' in view));
  assert(!('npcs' in view));
  assert(!('tracks' in view));
  assert.deepEqual(x.store.db.serialize(), before);
  assert.throws(() => x.store.dungeonAuthoring('retired-token'));
});
test('archived floors and rooms keep their keys available once and remain excluded from map geometry', (t) => {
  const x = fixture(t);
  x.send({ kind: 'room-hide', roomId: x.rooms[1].id, hidden: true });
  // Exercise an archived floor including a room that is also archived individually.
  x.store.db
    .prepare("INSERT INTO drawing_hidden VALUES(?,'upper','local','floor',1,1)")
    .run(x.campaign.id);
  const before = x.store.db.serialize(),
    view = x.store.dungeonAuthoring(x.w.token);
  assert.deepEqual(
    view.rooms.map((r) => r.id),
    [x.rooms[0].id],
  );
  assert.deepEqual(
    new Set(view.drawing.hiddenRooms.map((r) => r.id)),
    new Set(x.rooms.slice(1).map((r) => r.id)),
  );
  assert.equal(view.drawing.hiddenRooms.length, 2);
  for (const original of x.rooms.slice(1))
    assert.deepEqual(
      view.drawing.hiddenRooms.find((r) => r.id === original.id).sections,
      original.sections,
    );
  assert.deepEqual(x.store.db.serialize(), before);
});
test('protected graph geometry is the authoring source while persisted geometry remains untouched', (t) => {
  const x = fixture(t),
    command = (action) =>
      x.store.executeGraph({
        commandId: randomUUID(),
        token: x.w.token,
        campaignId: x.campaign.id,
        scopeId: 'local',
        action,
      });
  const original = x.store.dungeonAuthoring(x.w.token);
  command({ kind: 'graph-move', roomIds: [x.rooms[0].id], dxSteps: 2, dySteps: 0 });
  const preview = x.store.dungeonAuthoring(x.w.token);
  assert.equal(preview.drawing.graphPreview.protected, true);
  assert.notDeepEqual(
    preview.rooms.find((r) => r.id === x.rooms[0].id).polygons,
    original.rooms.find((r) => r.id === x.rooms[0].id).polygons,
  );
  assert.deepEqual(
    preview.rooms.find((r) => r.id === x.rooms[0].id).sections,
    original.rooms.find((r) => r.id === x.rooms[0].id).sections,
  );
  command({ kind: 'restore' });
  assert.deepEqual(x.store.dungeonAuthoring(x.w.token), original);
});

test('author commits and receipt replay avoid the runtime snapshot, retain normal history, and reject stale edits atomically', (t) => {
  const x = fixture(t),
    id = x.rooms[0].id;
  x.store.db
    .prepare('INSERT INTO dungeon_trace VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(x.campaign.id, 'bad-trace', null, null, 'local', 'ground', 'epoch', '0', '{}', 'broken');
  const command = {
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.campaign.id,
    action: {
      kind: 'key-batch',
      rooms: [{ id, expectedRevision: 0, keyRevision: null }],
      patch: { gmNotes: { mode: 'replace', text: 'Bestätigte Nachtwache' } },
    },
  };
  const ack = x.store.atlasDrawingCommit(command);
  assert(
    ack.view.keyContent
      .find((k) => k.id === id)
      .blocks.some((b) => b.text === 'Bestätigte Nachtwache'),
  );
  assert(ack.atlasRevision > 0);
  assert.deepEqual(ack.workspace.rooms.find((r) => r.id === id).sections, x.rooms[0].sections);
  const saved = x.store.db.serialize();
  assert.deepEqual(x.store.atlasDrawingCommit(command), ack);
  assert.deepEqual(x.store.db.serialize(), saved);
  assert.throws(
    () => x.store.atlasDrawingCommit({ ...command, commandId: randomUUID() }),
    /geändert/,
  );
  assert.deepEqual(x.store.db.serialize(), saved);
  for (const kind of ['undo', 'redo'])
    x.store.executeAtlasCommit({
      commandId: randomUUID(),
      token: x.w.token,
      campaignId: x.campaign.id,
      action: { kind },
    });
  const fresh = x.store.dungeonAuthoring(x.w.token);
  assert(
    fresh.drawing.keyContent
      .find((k) => k.id === id)
      .blocks.some((b) => b.text === 'Bestätigte Nachtwache'),
  );
  assert.deepEqual(fresh.rooms.find((r) => r.id === id).sections, x.rooms[0].sections);
  assert.throws(() => x.store.dungeon(x.w.token), /wahrnehmung beschädigt/);
});

test('a lost author acknowledgement retains the original command and recovers through the compact receipt path', async (t) => {
  const x = fixture(t);
  buildSync({
    entryPoints: ['src/app/campaign-atlas-author.ts'],
    outfile: '.build/dungeon-authoring-client.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
  const require = createRequire(import.meta.url),
    file = require.resolve('../.build/dungeon-authoring-client.cjs');
  delete require.cache[file];
  const client = require(file);
  const prior = {
      document: globalThis.document,
      window: globalThis.window,
      Event: globalThis.Event,
      CustomEvent: globalThis.CustomEvent,
    },
    dom = parseHTML('<html><body></body></html>');
  Object.assign(globalThis, {
    document: dom.document,
    window: dom.window,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
  });
  t.after(() => Object.assign(globalThis, prior));
  const command = {
      commandId: randomUUID(),
      token: x.w.token,
      campaignId: x.campaign.id,
      action: {
        kind: 'key-batch',
        rooms: [{ id: x.rooms[0].id, expectedRevision: 0, keyRevision: null }],
        patch: { gmNotes: { mode: 'replace', text: 'Nur einmal gespeichert' } },
      },
    },
    original = structuredClone(command),
    calls = [];
  window.campaign = {
    atlasDrawingCommit: async (c) => {
      calls.push(c);
      x.store.atlasDrawingCommit(c);
      throw Error('Antwort verloren');
    },
    reconcileAtlasCommit: async (c) => {
      calls.push(c);
      return { ok: true, value: x.store.reconcileAtlasCommit(c) };
    },
  };
  const answer = await client.atlasDrawingWrite(command);
  assert.equal(answer.ok, false);
  const saved = x.store.db.serialize();
  command.action.patch.gmNotes.text = 'Darf nicht rückwirkend ändern';
  const blocked = await client.atlasDrawingWrite({ ...command, commandId: randomUUID() });
  assert.equal(blocked.ok, false);
  assert.equal(calls.length, 1);
  assert.deepEqual(client.pendingAtlasWrite(x.w.token).action.command, original);
  const recovered = await client.recoverAtlasCommit(x.w.token);
  assert.equal(recovered.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].action.command, original);
  assert.equal(client.pendingAtlasWrite(x.w.token), null);
  assert.deepEqual(x.store.db.serialize(), saved);
});

test('editing a room on an archived floor returns its complete saved author row without unarchiving it', (t) => {
  const x = fixture(t),
    room = x.rooms[1];
  x.store.db
    .prepare("INSERT INTO drawing_hidden VALUES(?,'upper','local','floor',1,1)")
    .run(x.campaign.id);
  const result = x.store.atlasDrawingCommit({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.campaign.id,
    action: {
      kind: 'key-batch',
      rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
      patch: { gmNotes: { mode: 'replace', text: 'Erhalten im Archiv' } },
    },
  });
  assert(!result.workspace.rooms.some((r) => r.id === room.id));
  assert.deepEqual(result.view.hiddenRooms.find((r) => r.id === room.id).sections, room.sections);
  assert(
    result.view.keyContent
      .find((k) => k.id === room.id)
      .blocks.some((b) => b.text === 'Erhalten im Archiv'),
  );
});

test('direct door authoring rejects a stale wall atomically and keeps placement undoable and idempotent', (t) => {
  const x = fixture(t),
    r = x.rooms[0],
    e = newElement('door', r.scopeId, r.floorId, r.id, [{ x: 6, y: 3 }]);
  e.anchor = { roomId: r.id, polygon: 0, edge: 1, t: 0.5 };
  const action = {
    kind: 'element',
    element: e,
    expectedRevision: null,
    expectedRoom: { id: r.id, revision: 0 },
  };
  x.send({
    kind: 'shape',
    roomId: r.id,
    expectedRevision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 7, y: 0 },
          { x: 7, y: 6 },
          { x: 0, y: 6 },
        ],
        holes: [],
      },
    ],
  });
  const before = x.store.db.serialize();
  assert.throws(() => x.send(action), /Raumwand inzwischen geändert/);
  assert.deepEqual(x.store.db.serialize(), before);
  action.expectedRoom.revision = x.store.atlasRoom(x.w.token, r.id).revision;
  const command = { commandId: randomUUID(), token: x.w.token, campaignId: x.campaign.id, action };
  x.store.atlasDrawingCommit(command);
  x.store.atlasDrawingCommit(command);
  assert.equal(x.store.drawing(x.w.token).elements.filter((n) => n.id === e.id).length, 1);
  x.store.executeAtlasCommit({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.campaign.id,
    action: { kind: 'undo' },
  });
  assert.equal(
    x.store.drawing(x.w.token).elements.some((n) => n.id === e.id),
    false,
  );
  assert.equal(x.store.atlasRoom(x.w.token, r.id).polygons[0].outer[1].x, 7);
  x.store.executeAtlasCommit({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.campaign.id,
    action: { kind: 'redo' },
  });
  assert.equal(x.store.drawing(x.w.token).elements.filter((n) => n.id === e.id).length, 1);
});
