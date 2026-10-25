import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url);
for (const [name, file] of [
  ['store', 'src/app/storage/store.ts'],
  ['reads', 'src/app/storage/room-reads.ts'],
  ['service', 'desktop/room-directory.ts'],
  ['worker', 'desktop/room-directory-worker.ts'],
  ['projection', 'src/app/atlas/atlas-render-view.ts'],
  ['author', 'src/app/atlas/campaign-atlas-author.ts'],
])
  buildSync({
    entryPoints: [file],
    outfile: '.build/room-reads-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore } = require('../../.build/room-reads-store.cjs'),
  { roomDirectoryRows } = require('../../.build/room-reads-reads.cjs'),
  { RoomDirectoryService } = require('../../.build/room-reads-service.cjs');
const room = (i, scopeId = 'local', floorId = 'ground') => ({
  id: 'room-' + String(i).padStart(5, '0'),
  scopeId,
  floorId,
  number: String(i),
  name: 'Kammer ' + i,
  revision: 0,
  polygons: [
    {
      outer: [
        { x: i * 5, y: 0 },
        { x: i * 5 + 3, y: 0 },
        { x: i * 5 + 3, y: 3 },
        { x: i * 5, y: 3 },
      ],
      holes: [],
    },
  ],
  sections: [{ id: randomUUID(), kind: 'markdown', markdown: 'PRIVATE\r\n' + i }],
});
function fixture(t, rooms = [room(1), room(2)]) {
  const dir = mkdtempSync(tmpdir() + '/room-reads-'),
    filename = dir + '/campaign.sqlite';
  let store = new CampaignStore(filename);
  const cam = store.create('Lesen', rooms);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    cam,
    filename,
    fresh() {
      store.close();
      store = new CampaignStore(filename);
    },
  };
}
const hash = (s) => createHash('sha256').update(s).digest('hex');
test('activation and Atlas opening project 4000 rooms without decoding room prose or old full views', (t) => {
  const f = fixture(
    t,
    Array.from({ length: 4000 }, (_, i) => room(i + 1, i >= 2000 ? 'tower' : 'local')),
  );
  for (const key of ['workspace', 'campaignAtlas', 'dungeon', 'decode'])
    f.store[key] = () => {
      throw new Error('full ' + key + ' forbidden');
    };
  const shell = f.store.activateShell(f.cam.id);
  assert(!('rooms' in shell));
  assert.equal(shell.selectedId, 'room-00001');
  const w = f.store.workspaceGeometry(shell.token);
  assert.equal(w.rooms.length, 4000);
  assert(!JSON.stringify(w).includes('PRIVATE'));
  assert(w.rooms.every((r) => !('sections' in r)));
  const atlas = f.store.atlasRenderView(shell.token);
  assert.equal(atlas.workspace.rooms.length, 4000);
  assert(!JSON.stringify(atlas).includes('PRIVATE'));
  assert(!('keyContent' in atlas.geometry.drawing));
});
test('directory preserves natural order, complete Markdown search, scopes, hidden floors and long IDs', (t) => {
  const rooms = Array.from({ length: 83 }, (_, i) => room(i + 1));
  rooms[81].id = 'old-' + 'x'.repeat(1500);
  rooms[81].scopeId = 'tower';
  rooms[81].floorId = 'up';
  rooms[82].floorId = 'up';
  const f = fixture(t, rooms),
    w = f.store.activateShell(f.cam.id);
  f.store.db
    .prepare("INSERT INTO drawing_hidden VALUES(?,?,'local','floor',1,1)")
    .run(f.cam.id, 'up');
  let cursor,
    ids = [];
  do {
    const q = { text: '', limit: 40, cursor },
      source = f.store.roomReadSource(w.token, q),
      page = roomDirectoryRows(f.store.db, f.cam.id, q);
    assert(page.items.length <= 40);
    assert(!JSON.stringify(page).includes('PRIVATE'));
    ids.push(...page.items.map((r) => r.id));
    cursor = page.more
      ? { token: w.token, fence: source.fence, text: '', after: page.items.at(-1) }
      : undefined;
  } while (cursor);
  assert.equal(ids.length, 82);
  assert.equal(ids[9], rooms[9].id);
  assert.equal(ids.at(-1), rooms[81].id);
  assert.equal(
    roomDirectoryRows(f.store.db, f.cam.id, { text: 'PRIVATE\r\n81' }).items[0].id,
    rooms[80].id,
  );
  assert.equal(
    roomDirectoryRows(f.store.db, f.cam.id, { text: '', scopeId: 'local', floorId: 'up' }).total,
    0,
  );
  assert.equal(
    roomDirectoryRows(f.store.db, f.cam.id, { text: '', scopeId: 'tower', floorId: 'up' }).items[0]
      .id,
    rooms[81].id,
  );
  assert.equal(roomDirectoryRows(f.store.db, f.cam.id, { text: '', scopeId: 'absent' }).total, 0);
  const source = f.store.roomReadSource(w.token);
  f.store.select(w.token, rooms[9].id);
  assert.throws(
    () =>
      f.store.roomReadSource(w.token, {
        text: '',
        cursor: {
          token: w.token,
          fence: source.fence,
          text: '',
          after: { id: rooms[0].id, number: '1' },
        },
      }),
    /inzwischen/,
  );
});
test('damaged offscreen content does not block the map or a different exact editor; original bytes survive', (t) => {
  const f = fixture(t),
    w = f.store.activateShell(f.cam.id);
  f.store.db
    .prepare('UPDATE room SET payload=? WHERE campaign_id=? AND id=?')
    .run('{bad', f.cam.id, 'room-00002');
  const map = f.store.workspaceGeometry(w.token);
  assert.equal(map.rooms.length, 1);
  assert.equal(map.problems[0].id, 'room-00002');
  assert.equal(f.store.atlasRenderView(w.token).workspace.rooms.length, 1);
  assert.equal(f.store.atlasRoom(w.token, 'room-00001').sections[0].markdown, 'PRIVATE\r\n1');
  assert.throws(() => f.store.atlasRoom(w.token, 'room-00002'), /Originaldaten/);
  assert.equal(roomDirectoryRows(f.store.db, f.cam.id, { text: 'PRIVATE' }).unreadable, 1);
  assert.equal(
    f.store.db.prepare('SELECT payload FROM room WHERE id=?').get('room-00002').payload,
    '{bad',
  );
});
test('compact exact room commits preserve receipts, text bytes, undo and restart without a full response', (t) => {
  const f = fixture(t),
    w = f.store.activateShell(f.cam.id),
    r = f.store.atlasRoom(w.token, 'room-00001'),
    edit = {
      commandId: randomUUID(),
      token: w.token,
      campaignId: f.cam.id,
      roomId: r.id,
      expectedRevision: r.revision,
      name: 'Neu',
      polygons: r.polygons,
      sections: r.sections,
    };
  const ack = f.store.atlasRoomCommit(edit);
  assert.equal(ack.room.name, 'Neu');
  assert.equal(ack.room.sections[0].markdown, 'PRIVATE\r\n1');
  assert.deepEqual(f.store.atlasRoomCommit(edit), ack);
  assert(!('workspace' in ack));
  assert.equal(
    f.store.db
      .prepare('SELECT count(*) n FROM atlas_receipt WHERE command_id=?')
      .get(edit.commandId).n,
    1,
  );
  f.store.executeAtlas({
    commandId: randomUUID(),
    token: w.token,
    campaignId: f.cam.id,
    action: { kind: 'undo' },
  });
  assert.equal(f.store.atlasRoom(w.token, r.id).name, r.name);
  f.fresh();
  const next = f.store.activateShell(f.cam.id);
  assert.equal(f.store.atlasRoom(next.token, r.id).sections[0].markdown, r.sections[0].markdown);
});
test('geometry reads defer malformed text validation to the selected editor, never invent sections', (t) => {
  const f = fixture(t),
    w = f.store.activateShell(f.cam.id),
    r = f.store.db.prepare('SELECT * FROM room WHERE id=?').get('room-00002'),
    value = JSON.parse(r.payload);
  value.sections = 'broken';
  const payload = JSON.stringify(value);
  f.store.db
    .prepare('UPDATE room SET payload=?,checksum=? WHERE id=?')
    .run(payload, hash(payload), r.id);
  assert.equal(f.store.workspaceGeometry(w.token).rooms.length, 2);
  assert.throws(() => f.store.atlasRoom(w.token, r.id), /Key/);
});
test('readonly room jobs replace predecessors and reject abandoned work', async (t) => {
  const f = fixture(
      t,
      Array.from({ length: 100 }, (_, i) => room(i + 1)),
    ),
    w = f.store.activateShell(f.cam.id),
    source = f.store.roomReadSource(w.token),
    service = new RoomDirectoryService(path.resolve('.build/room-reads-worker.cjs'));
  t.after(() => service.close());
  const one = service.read(source, { text: 'PRIVATE' }).then(
      () => false,
      () => true,
    ),
    two = service.read(source, { text: '', limit: 40 });
  assert.equal(await one, true);
  const page = await two;
  assert.equal(page.items.length, 40);
  assert.equal(page.next.after.number, '40');
  await service
    .read(source, { text: 'PRIVATE\r\n100' })
    .then((p) => assert.equal(p.items[0].number, '100'));
  await service.close();
  await assert.rejects(service.read(source, { text: '' }), /abgebrochen/);
});
test('drawing projections omit all keys, archived room prose and element notes; exact selection and tools retain them', (t) => {
  const f = fixture(t),
    w = f.store.activateShell(f.cam.id),
    send = (action) =>
      f.store.executeDrawing({
        commandId: randomUUID(),
        token: w.token,
        campaignId: f.cam.id,
        action,
      });
  send({
    kind: 'key-batch',
    rooms: [{ id: 'room-00001', expectedRevision: 0, keyRevision: null }],
    patch: { gmNotes: { mode: 'replace', text: 'KEY-PRIVATE' } },
  });
  send({ kind: 'room-hide', roomId: 'room-00002', hidden: true });
  const drawing = f.store.drawingMap(w.token);
  assert(!JSON.stringify(drawing).includes('PRIVATE'));
  assert.equal(drawing.hiddenRooms[0].id, 'room-00002');
  assert(!('sections' in drawing.hiddenRooms[0]));
  assert(!('keyContent' in drawing));
  assert(JSON.stringify(f.store.drawing(w.token)).includes('KEY-PRIVATE'));
  assert(JSON.stringify(f.store.atlasRenderView(w.token)).includes('KEY-PRIVATE') === false);
});
test('protected graph geometry and exact details come from the same shadow, source bytes unchanged until acceptance', (t) => {
  const f = fixture(t),
    w = f.store.activateShell(f.cam.id),
    source = f.store.atlasRoom(w.token, 'room-00001'),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: f.cam.id,
      scopeId: 'local',
      action,
    });
  f.store.executeGraph(command({ kind: 'raster' }));
  const shape = f.store.workspaceGeometry(w.token);
  assert(shape.graphPreview);
  assert(!('sections' in shape.rooms[0]));
  assert.equal(
    f.store.atlasRoom(w.token, source.id).sections[0].markdown,
    source.sections[0].markdown,
  );
  const read = f.store.roomReadSource(w.token);
  assert(read.filename.includes('preview.sqlite'));
  assert.equal(f.store.atlasRenderView(w.token).workspace.graphPreview.protected, true);
  f.store.executeGraph(command({ kind: 'restore' }));
  assert.deepEqual(f.store.atlasRoom(w.token, source.id), source);
});
test('map projection preserves party visibility, public labels and NPC markers without narrative room keys', (t) => {
  const r = room(1);
  r.polygons = [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 6.096, y: 0 },
        { x: 6.096, y: 6.096 },
        { x: 0, y: 6.096 },
      ],
      holes: [],
    },
  ];
  const f = fixture(t, [r]),
    w = f.store.activateShell(f.cam.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: f.cam.id,
      action,
    });
  f.store.executeDrawing(
    command({
      kind: 'volume-initialize',
      roomId: r.id,
      expectedRoomRevision: 0,
      expectedVolumeRevision: null,
      heightSteps: 4,
    }),
  );
  const character = f.store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character,
    live = f.store.live(w.token);
  f.store.executeLive(
    command({
      kind: 'membership',
      characterId: character.id,
      expectedRevision: character.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const scene = f.store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: f.store.live(w.token).rosterRevision }),
  ).scene;
  f.store.executeDungeon(
    command({
      kind: 'place',
      sceneId: scene.id,
      expectedPositionRevision: 0,
      pose: { scopeId: 'local', floorId: 'ground', roomId: r.id, x: 1.524, y: 1.524, z: 0 },
    }),
  );
  const locationId = randomUUID();
  f.store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: f.cam.id,
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: locationId,
        name: 'Torhaus',
        type: 'poi',
        sections: [
          { id: randomUUID(), title: 'Beschreibung', markdown: '' },
          { id: randomUUID(), title: 'Notizen', markdown: '' },
        ],
        detailMaps: [{ kind: 'dungeon', documentId: 'local' }],
        keyLinks: [],
      },
    },
  });
  const npcId = randomUUID();
  f.store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: f.cam.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: npcId,
        revision: 1,
        kind: 'npc',
        title: 'Nera',
        readAloud: '',
        gmNotes: 'NPC-PRIVATE',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  f.store.executeDungeon(
    command({
      kind: 'npc-place',
      actorId: npcId,
      expectedRevision: null,
      pose: { scopeId: 'local', floorId: 'ground', roomId: r.id, x: 3.048, y: 1.524, z: 0 },
    }),
  );
  const full = f.store.campaignAtlas(w.token),
    map = f.store.atlasRenderView(w.token);
  assert(map.perception);
  for (const field of ['known', 'visible', 'markers', 'labels'])
    assert.deepEqual(map.perception[field], full.perception[field]);
  assert.equal(map.geometry.npcs.length, 1);
  assert.deepEqual(map.geometry.npcs, full.geometry.npcs);
  assert(!('description' in map.perception));
  assert(!JSON.stringify(map).includes('PRIVATE'));
});
for (const field of ['secret', 'id', 'scopeId', 'kind', 'revision'])
  test('map projection rejects checksummed key metadata damage: ' + field, (t) => {
    const f = fixture(t),
      w = f.store.activateShell(f.cam.id);
    f.store.executeDrawing({
      commandId: randomUUID(),
      token: w.token,
      campaignId: f.cam.id,
      action: {
        kind: 'key-batch',
        rooms: [{ id: 'room-00001', expectedRevision: 0, keyRevision: null }],
        patch: { gmNotes: { mode: 'replace', text: 'key' } },
      },
    });
    const row = f.store.db
        .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
        .get(f.cam.id, 'room-00001'),
      key = JSON.parse(row.payload);
    key[field] = field === 'secret' ? 0 : field === 'revision' ? '0' : 'different';
    const payload = JSON.stringify(key);
    f.store.db
      .prepare('UPDATE dungeon_key_content SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, hash(payload), f.cam.id, row.id);
    assert.throws(() => f.store.drawing(w.token), /Key/);
    assert.throws(() => f.store.drawingMap(w.token), /Key/);
    assert.throws(() => f.store.drawingMap(w.token, 'room-00001'), /Key/);
    assert.equal(
      f.store.db
        .prepare('SELECT payload FROM dungeon_key_content WHERE campaign_id=? AND id=?')
        .get(f.cam.id, row.id).payload,
      payload,
    );
  });

test('reader cancellation joins its worker before a disposable source can be removed', async (t) => {
  const f = fixture(t),
    w = f.store.activateShell(f.cam.id),
    source = f.store.roomReadSource(w.token),
    service = new RoomDirectoryService(path.resolve('.build/room-reads-worker.cjs'));
  t.after(() => service.close());
  // read() first awaits the previous exit. Resume after that microtask, before
  // yielding to worker result events: a small source may already finish in one turn.
  const read = service.read(source, { text: 'PRIVATE' }).catch((e) => e);
  await Promise.resolve();
  const worker = service.job?.worker;
  assert(worker, 'the source reader must have started');
  await service.cancelAndWait();
  assert.equal(worker.threadId, -1, 'snapshot cleanup must wait for actual worker exit');
  assert.match((await read).message, /abgebrochen/);
});
