import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
for (const [name, file] of [
  ['store', 'src/app/storage/store.ts'],
  ['reader', 'src/app/storage/atlas-region.ts'],
  ['drawing-model', 'src/app/atlas/drawing-model.ts'],
  ['service', 'desktop/atlas-region.ts'],
  ['worker', 'desktop/atlas-region-worker.ts'],
])
  buildSync({
    entryPoints: [file],
    outfile: '.build/atlas-region-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore } = require('../../.build/atlas-region-store.cjs'),
  { AtlasRegionReader } = require('../../.build/atlas-region-reader.cjs'),
  { AtlasRegionService } = require('../../.build/atlas-region-service.cjs');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const room = (i) => ({
  id: 'r' + i,
  scopeId: 'local',
  floorId: 'ground',
  number: String(i),
  name: 'Raum ' + i,
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
  sections: [
    { id: randomUUID(), kind: 'markdown', markdown: 'PRIVATE-TEXT\r\n' + 'x'.repeat(4096) },
  ],
});
const query = (box = { x: 0, y: -2, width: 30, height: 10 }) => ({
  box,
  width: 1024,
  height: 768,
  scopeId: 'local',
  floorId: 'ground',
  slice: null,
  roofs: true,
});
function fixture(t, n = 100) {
  const dir = mkdtempSync(tmpdir() + '/atlas-regions-'),
    store = new CampaignStore(dir + '/campaign.sqlite'),
    campaign = store.create(
      'Regionen',
      Array.from({ length: n }, (_, i) => room(i)),
    ),
    shell = store.activateShell(campaign.id),
    db = new Database(store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db);
  let source;
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    store,
    db,
    reader,
    shell,
    campaign,
    async read(q = query()) {
      const next = store.atlasRegionSource(
        shell.token,
        source && { epoch: source.epoch, sequence: source.sequence },
      );
      await reader.sync(next);
      source = next;
      return reader.read(next, q);
    },
    get source() {
      return source;
    },
  };
}
function put(store, table, cam, id, payload, city) {
  const value = JSON.stringify(payload);
  if (table === 'city_unit')
    store.db
      .prepare('INSERT INTO city_unit VALUES(?,?,?,?,?,?)')
      .run(cam, city, id, payload.kind, value, hash(value));
}
test('region replies exclude 5000 offscreen entrances but retain a chosen entrance and canonical checksums', async (t) => {
  const f = fixture(t, 1),
    token = f.shell.token,
    cam = f.campaign.id;
  const write = (action) =>
    f.store.executeAtlasCommit({ commandId: randomUUID(), token, campaignId: cam, action });
  const farScope = write({ kind: 'dungeon-create', name: 'Ferne Gruppe', x: 1e6, y: 1e6 }).result
    .id;
  const farRoom = write({
    kind: 'room-create',
    scopeId: farScope,
    floorId: 'ground',
    name: 'Ferne Halle',
    polygons: room(0).polygons,
  }).result.id;
  const entry = {
    id: 'near-door',
    scopeId: 'local',
    roomId: 'r0',
    floorId: 'ground',
    inside: { x: 1, y: 1 },
    outside: { x: -1, y: 1 },
    revision: 0,
  };
  write({ kind: 'entrance', entrance: entry });
  const insert = f.store.db.prepare('INSERT INTO atlas_entrance VALUES(?,?,?,?)');
  f.store.db.transaction(() => {
    for (let i = 0; i < 5000; i++) {
      const value = JSON.stringify({
        ...entry,
        id: 'far-door-' + i,
        scopeId: farScope,
        roomId: farRoom,
        revision: 1,
      });
      insert.run(cam, 'far-door-' + i, value, hash(value));
    }
  })();
  const near = f.store.atlasRegionView(token, await f.read());
  assert.deepEqual(
    near.entrances.map((e) => e.id),
    ['near-door'],
  );
  const awayQuery = {
    ...query({ x: 2e6, y: 2e6, width: 100, height: 100 }),
    scopeId: null,
    terrainRaster: false,
  };
  const away = await f.read(awayQuery);
  assert.equal(away.bindings.length, 0);
  assert.deepEqual(f.store.atlasRegionView(token, away).entrances, []);
  const chosen = f.store.atlasRegionView(token, away, false, 'far-door-42');
  assert.deepEqual(
    chosen.entrances.map((e) => e.id),
    ['far-door-42'],
  );
  assert.equal(
    f.store.campaignAtlas(token).entrances.length,
    5001,
    'canonical reader remains complete',
  );
  assert.deepEqual(f.store.atlasRegionView(token, away, false, 'deleted-door').entrances, []);
  f.store.db
    .prepare('UPDATE atlas_entrance SET checksum=? WHERE campaign_id=? AND id=?')
    .run('broken', cam, 'far-door-42');
  const fresh = await f.read(awayQuery);
  assert.throws(() => f.store.atlasRegionView(token, fresh, false, 'far-door-42'), /beschädigt/);
  assert.throws(
    () => f.store.campaignAtlas(token),
    /beschädigt/,
    'canonical reader must still detect damaged entries',
  );
});
test('chosen entrance outside the viewport and indoor party context retain canonical enter and exit', async (t) => {
  const f = fixture(t, 1),
    token = f.shell.token,
    campaignId = f.campaign.id;
  const command = (action) => ({ commandId: randomUUID(), token, campaignId, action });
  f.store.executeAtlasCommit(
    command({
      kind: 'entrance',
      entrance: {
        id: 'party-door',
        scopeId: 'local',
        roomId: 'r0',
        floorId: 'ground',
        inside: { x: 1, y: 1 },
        outside: { x: -1, y: 1 },
        revision: 0,
      },
    }),
  );
  const pc = f.store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
  ).character;
  const live = f.store.live(token);
  f.store.executeLive(
    command({
      kind: 'membership',
      characterId: pc.id,
      expectedRevision: pc.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const scene = f.store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: f.store.live(token).rosterRevision }),
  ).scene;
  const travel = (action, view) =>
    f.store.executeAtlasTravel({
      ...command({
        ...action,
        expectedPositionRevision: view.scene.position.revision,
        expectedMembershipRevision: view.scene.scene.membershipRevision,
      }),
      sceneId: scene.id,
    });
  travel({ kind: 'place', point: { x: -1, y: 1 } }, f.store.campaignAtlas(token));
  const awayQuery = {
    ...query({ x: 2e6, y: 2e6, width: 100, height: 100 }),
    scopeId: null,
    terrainRaster: false,
  };
  const outside = f.store.atlasRegionView(token, await f.read(awayQuery), false, 'party-door');
  assert.equal(outside.geometry.position, null);
  assert.equal(outside.bindings.length, 0);
  assert.deepEqual(
    outside.entrances.map((e) => e.id),
    ['party-door'],
  );
  travel(
    {
      kind: 'entrance',
      id: 'party-door',
      revision: outside.entrances[0].revision,
      direction: 'enter',
    },
    outside,
  );
  const inside = f.store.atlasRegionView(token, await f.read(awayQuery));
  assert.equal(inside.geometry.position.roomId, 'r0');
  assert(inside.bindings.some((b) => b.kind === 'dungeon' && b.ownerId === 'local'));
  assert.deepEqual(
    inside.entrances.map((e) => e.id),
    ['party-door'],
    'current party scope is retained without an explicitly selected entrance',
  );
  travel(
    {
      kind: 'entrance',
      id: 'party-door',
      revision: inside.entrances[0].revision,
      direction: 'exit',
    },
    inside,
  );
  assert.equal(f.store.campaignAtlas(token).geometry.position, null);
});
test('4000 rooms: opening reads one selected room; region excludes offscreen prose and geometry', async (t) => {
  const f = fixture(t, 4000),
    initial = f.store.workspaceInitial(f.shell.token);
  assert.equal(initial.rooms.length, 1);
  assert(!JSON.stringify(initial).includes('PRIVATE-TEXT'));
  f.store.workspaceGeometry =
    f.store.campaignAtlas =
    f.store.cities =
    f.store.city =
      () => {
        throw new Error('full read forbidden');
      };
  const r = await f.read();
  assert(r.rooms.length > 0 && r.rooms.length < 10);
  assert.equal(r.coverage.index, 'rtree');
  assert.throws(
    () => f.reader.read(f.source, { ...query(), fence: 'stale-export-frame' }),
    /inzwischen geändert/,
  );
  assert(!JSON.stringify(r).includes('PRIVATE-TEXT'));
  assert(Buffer.byteLength(JSON.stringify(r)) < 2 * 1024 * 1024);
  const view = f.store.atlasRegionView(f.shell.token, r);
  assert.equal(view.workspace.rooms.length, r.rooms.length);
  assert(!JSON.stringify(view).includes('PRIVATE-TEXT'));
  const q = query({ x: 19000, y: -2, width: 30, height: 10 }),
    away = await f.read(q);
  assert(away.rooms.every((r) => r.polygons[0].outer[0].x >= 18995));
  const focus = f.reader.focus(f.source, 'room', 'r3999');
  assert.equal(focus.id, 'r3999');
  assert(focus.point.x > 19990);
});
test('incremental projections follow exact edits, rollback, hidden rooms, undo and fresh rebuild', async (t) => {
  const f = fixture(t);
  let r = await f.read();
  assert(r.rooms.some((r) => r.id === 'r0'));
  const before = f.store.atlasRoom(f.shell.token, 'r0');
  const polygons = before.polygons.map((p) => ({
    ...p,
    outer: p.outer.map((p) => ({ x: p.x + 1000, y: p.y })),
  }));
  f.store.atlasRoomCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    roomId: before.id,
    expectedRevision: before.revision,
    name: before.name,
    polygons,
    sections: before.sections,
  });
  r = await f.read();
  assert(!r.rooms.some((r) => r.id === 'r0'));
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: { kind: 'undo' },
  });
  r = await f.read();
  assert(r.rooms.some((r) => r.id === 'r0'));
  const sequence = f.source.sequence;
  assert.throws(() =>
    f.store.db.transaction(() => {
      f.store.db
        .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
        .run('rollback', f.campaign.id, 'r0');
      throw new Error('rollback');
    })(),
  );
  assert.equal(
    f.store.atlasRegionSource(f.shell.token, { epoch: f.source.epoch, sequence }).sequence,
    sequence,
  );
  f.store.db
    .prepare("INSERT INTO drawing_hidden VALUES(?,?,'local','room',1,1)")
    .run(f.campaign.id, 'r0');
  r = await f.read();
  assert(!r.rooms.some((r) => r.id === 'r0'));
  assert.throws(() => f.reader.focus(f.source, 'room', 'r0'), /archiviert/);
  const external = new Database(f.store.filename);
  external
    .prepare('UPDATE room SET payload=? WHERE campaign_id=? AND id=?')
    .run('{broken', f.campaign.id, 'r2');
  external.close();
  r = await f.read();
  assert.equal(r.coverage.unreadable, 1);
  assert(!r.rooms.some((r) => r.id === 'r2'));
  assert.equal(
    f.store.db
      .prepare('SELECT payload FROM room WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, 'r2').payload,
    '{broken',
  );
});
test('rotated city with 5000 buildings: resolved roads, targeted author details and embedded dungeon frames', async (t) => {
  const f = fixture(t, 1),
    cam = f.campaign.id,
    token = f.shell.token;
  const created = f.store.executeAtlasCommit({
      commandId: randomUUID(),
      token,
      campaignId: cam,
      action: { kind: 'city-create', name: 'Stadt', x: 10000, y: 20000, width: 1000, height: 1000 },
    }),
    city = created.result.id;
  f.store.db
    .prepare("UPDATE atlas_binding SET angle=? WHERE campaign_id=? AND kind='city' AND owner_id=?")
    .run(Math.PI / 2, cam, city);
  f.store.db.transaction(() => {
    for (let i = 0; i < 5000; i++)
      put(
        f.store,
        'city_unit',
        cam,
        'b' + i,
        {
          id: 'b' + i,
          kind: 'building',
          name: 'Haus ' + i,
          protected: true,
          position: { x: (i % 100) * 9 + 10, y: Math.floor(i / 100) * 9 + 10 },
          outline: [
            { x: -2, y: -2 },
            { x: 2, y: -2 },
            { x: 2, y: 2 },
            { x: -2, y: 2 },
          ],
          angle: 0,
          notes: 'PRIVATE-HOUSE' + 'x'.repeat(4096),
          residentIds: [],
          workerIds: [],
          households: [],
          jobs: [],
        },
        city,
      );
    for (const [id, point] of [
      ['n1', { x: 5, y: 5 }],
      ['n2', { x: 900, y: 900 }],
    ])
      put(
        f.store,
        'city_unit',
        cam,
        id,
        { id, kind: 'node', name: '', protected: true, point },
        city,
      );
    put(
      f.store,
      'city_unit',
      cam,
      'road',
      {
        id: 'road',
        kind: 'road',
        name: 'Lange Straße',
        protected: true,
        nodeIds: ['n1', 'n2'],
        via: [],
        width: 3,
      },
      city,
    );
  })();
  const r = await f.read(query({ x: 9960, y: 20000, width: 40, height: 40 }));
  assert.equal(r.cities.length, 1);
  assert(r.cities[0].units.length < 30);
  assert(!JSON.stringify(r).includes('PRIVATE-HOUSE'));
  const road = r.cities[0].units.find((u) => u.id === 'road');
  assert.equal(road.outline.length, 2);
  assert(!('nodeIds' in road));
  const focus = f.reader.focus(f.source, 'building', 'b4999');
  assert.equal(focus.cityId, city);
  const site = f.store.atlasCitySite(token, city, 'b4999');
  assert(site.unit.notes.startsWith('PRIVATE-HOUSE'));
  assert.equal(site.related.length, 0);
  const made = { result: { id: 'b4999' } };
  const fullCity = f.store.city(token, city);
  const unit = fullCity.units.find((u) => u.id === 'b4999');
  const commandId = randomUUID();
  f.store.executeAtlasCommit({
    commandId,
    token,
    campaignId: cam,
    action: {
      kind: 'city',
      command: {
        commandId,
        token,
        campaignId: cam,
        cityId: fullCity.header.id,
        expectedRevision: fullCity.header.revision,
        action: { kind: 'change', upsert: [unit], remove: [], label: 'Raumgruppe ausarbeiten' },
      },
    },
  });
  assert(made.result.id);
  const around = await f.read({
    ...query({ x: focus.point.x - 10, y: focus.point.y - 10, width: 20, height: 20 }),
    scopeId: made.result.id,
  });
  const binding = around.bindings.find((b) => b.ownerId === made.result.id);
  assert(binding, 'The selected empty interior retains its exact parent transform');
  assert.equal(around.frames[binding.id].x, focus.point.x);
  assert.equal(around.frames[binding.id].y, focus.point.y);
  // Focus remains independent of loaded city records.
  const far = f.reader.focus(f.source, 'building', 'b4999');
  assert.equal(far.point.x, focus.point.x);
  assert.equal(far.point.y, focus.point.y);
  f.store.db
    .prepare('UPDATE city_unit SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(
      JSON.stringify({ ...site.unit, position: { x: 50, y: 60 } }),
      hash(JSON.stringify({ ...site.unit, position: { x: 50, y: 60 } })),
      cam,
      'b4999',
    );
  await f.read();
  assert.notDeepEqual(f.reader.focus(f.source, 'building', 'b4999').point, focus.point);
  f.store.db.prepare('DELETE FROM city_unit WHERE campaign_id=? AND id=?').run(cam, 'b4999');
  const detached = await f.read();
  assert.equal(
    detached.coverage.complete,
    false,
    'a missing parent frame is explicit incomplete coverage',
  );
  assert(detached.coverage.unreadable > 0);
});
test('dense region is a bounded raster; exact hit honors holes and source fence', async (t) => {
  const f = fixture(t, 5000),
    q = query({ x: -2, y: -2, width: 25010, height: 10 });
  const shape = f.reader.roomShape.bind(f.reader),
    prepare = f.db.prepare.bind(f.db);
  let shapes = 0,
    stylePrograms = 0;
  f.reader.roomShape = (...args) => {
    shapes++;
    return shape(...args);
  };
  f.db.prepare = (sql) => {
    if (sql.includes('JOIN drawing_profile') || sql.includes('FROM dungeon_key_content'))
      stylePrograms++;
    return prepare(sql);
  };
  const r = await f.read(q);
  assert.equal(shapes, 5000, 'dense raster must not reread every room');
  assert.equal(stylePrograms, 2, 'only two style SQL programs per connection');
  assert.equal(r.coverage.mode, 'raster');
  assert(r.raster.data.startsWith('data:image/png;base64,'));
  assert.equal(r.rooms.length, 0);
  assert(
    r.bindings.some((b) => b.ownerId === 'local'),
    'selected author frame survives raster mode',
  );
  assert(Buffer.byteLength(JSON.stringify(r)) <= 2 * 1024 * 1024);
  const hit = f.reader.hit(f.source, q, { x: 501, y: 1 });
  assert.equal(hit.id, 'r100');
  const old = r;
  f.store.db
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('changed', f.campaign.id, 'r1');
  assert.throws(() => f.store.atlasRegionView(f.shell.token, old), /inzwischen/);
  const p = f.store.atlasRoom(f.shell.token, 'r0'),
    payload = JSON.stringify({
      polygons: [
        {
          outer: p.polygons[0].outer,
          holes: [
            [
              { x: 0.5, y: 0.5 },
              { x: 2.5, y: 0.5 },
              { x: 2.5, y: 2.5 },
              { x: 0.5, y: 2.5 },
            ],
          ],
        },
      ],
      sections: p.sections,
    });
  f.store.db
    .prepare('UPDATE room SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, hash(payload), f.campaign.id, 'r0');
  await f.read();
  assert.equal(f.reader.hit(f.source, query(), { x: 1, y: 1 }), null);
  f.store.db
    .prepare(
      'INSERT INTO drawing_profile(campaign_id,id,scope_id,target_id,revision,payload,checksum) VALUES(?,?,?,?,?,?,?)',
    )
    .run(f.campaign.id, 'r4999', 'local', 'r4999', 1, '{}', 'bad-checksum');
  const incomplete = await f.read(q);
  assert.equal(incomplete.coverage.mode, 'raster');
  assert.equal(incomplete.coverage.unreadable, 1);
  assert.equal(
    incomplete.coverage.complete,
    false,
    'corruption beyond the vector cutoff is still reported',
  );
  assert.equal(stylePrograms, 2, 'reuse statements, while reading current style values each time');
});
test('worker lifecycle, warm index reuse, cancellation and invalid requests', async (t) => {
  const f = fixture(t),
    service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  let source = f.store.atlasRegionSource(f.shell.token, service.cursor),
    r = await service.read(source, query());
  assert.equal(r.token, f.shell.token);
  source = f.store.atlasRegionSource(f.shell.token, service.cursor);
  assert.equal(source.reset, false);
  assert.deepEqual(source.changes, []);
  const focus = await service.focus(source, 'room', 'r99');
  assert.equal(focus.id, 'r99');
  const cancelled = service.read(source, query({ x: 30, y: 0, width: 30, height: 10 }));
  service.cancel();
  await assert.rejects(cancelled, /abgebrochen/);
  await service.cancelAndWait();
  source = f.store.atlasRegionSource(f.shell.token, service.cursor);
  r = await service.read(source, query());
  assert(r.rooms.length);
  await assert.rejects(service.read(source, { ...query(), width: 0 }), /prüfen/);
  for (const entranceId of ['', null, 42])
    await assert.rejects(service.read(source, { ...query(), entranceId }), /Karteneingang prüfen/);
  await service.close();
  await assert.rejects(service.read(source, query()), /abgebrochen/);
});
test('Rtree unavailable falls back atomically; slices retain upper volume contours', async (t) => {
  const f = fixture(t, 3),
    db = new Database(f.store.filename, { readonly: true }),
    exec = db.exec.bind(db);
  t.after(() => db.close());
  db.exec = (sql) => {
    if (sql.includes('CREATE VIRTUAL TABLE temp.region_index'))
      throw new Error('rtree unavailable');
    return exec(sql);
  };
  const scan = new AtlasRegionReader(db);
  await f.read();
  await scan.sync({ ...f.source, reset: true });
  assert.equal(scan.read(f.source, query()).coverage.index, 'scan');
  assert.deepEqual(
    scan.read(f.source, query()).rooms.map((r) => r.id),
    (await f.read()).rooms.map((r) => r.id),
  );
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: {
      kind: 'volume-initialize',
      roomId: 'r0',
      expectedRoomRevision: 0,
      expectedVolumeRevision: null,
      heightSteps: 4,
    },
  });
  const high = await f.read({ ...query(), slice: 4.5 });
  assert(
    high.rooms.some((r) => r.id === 'r0'),
    'a volume above the fallback ceiling is not discarded',
  );
  const outside = await f.read({ ...query(), slice: 7 });
  assert(!outside.rooms.some((r) => r.id === 'r0'));
});
test('external source writes cannot hit an older cached region; journal overflow rebuilds', async (t) => {
  const f = fixture(t, 5),
    service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  let source = f.store.atlasRegionSource(f.shell.token, service.cursor);
  await service.read(source, query());
  const fence = source.fence;
  const external = new Database(f.store.filename);
  external
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('Extern aktualisiert', f.campaign.id, 'r0');
  external.close();
  source = f.store.atlasRegionSource(f.shell.token, service.cursor);
  assert.notEqual(source.fence, fence);
  assert.equal(source.reset, true);
  assert.equal(
    (await service.read(source, query())).rooms.find((r) => r.id === 'r0').name,
    'Extern aktualisiert',
  );
  const cursor = service.cursor;
  f.store.db.transaction(() => {
    const update = f.store.db.prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?');
    for (let i = 0; i < 10010; i++) update.run('Stand ' + i, f.campaign.id, 'r0');
  })();
  source = f.store.atlasRegionSource(f.shell.token, cursor);
  assert.equal(source.reset, true);
  assert.deepEqual(source.changes, []);
  assert.equal(
    (await service.read(source, query())).rooms.find((r) => r.id === 'r0').name,
    'Stand 10009',
  );
});
test('bad city headers are explicit incomplete coverage, not a fabricated empty city', async (t) => {
  const f = fixture(t, 1),
    ack = f.store.executeAtlasCommit({
      commandId: randomUUID(),
      token: f.shell.token,
      campaignId: f.campaign.id,
      action: { kind: 'city-create', name: 'Defekt', x: 0, y: 0, width: 500, height: 500 },
    });
  await f.read();
  const id = ack.result.id,
    row = f.store.db
      .prepare('SELECT payload FROM city_document WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, id),
    broken = JSON.stringify({ ...JSON.parse(row.payload), id: 'wrong-identity' });
  f.store.db
    .prepare('UPDATE city_document SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(broken, hash(broken), f.campaign.id, id);
  const r = await f.read();
  assert.equal(r.coverage.complete, false);
  assert.equal(r.coverage.unreadable, 1);
  assert.equal(r.cities.length, 0);
  assert(r.rooms.some((r) => r.id === 'r0'));
  assert.equal(
    f.store.db
      .prepare('SELECT payload FROM city_document WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, id).payload,
    broken,
  );
});
test('text-only edits retain source overlap order and exact hit target', async (t) => {
  const f = fixture(t, 2),
    a = f.store.atlasRoom(f.shell.token, 'r0'),
    b = f.store.atlasRoom(f.shell.token, 'r1'),
    payload = JSON.stringify({ polygons: a.polygons, sections: b.sections });
  f.store.db
    .prepare('UPDATE room SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, hash(payload), f.campaign.id, b.id);
  const before = await f.read(),
    hit = f.reader.hit(f.source, query(), { x: 1, y: 1 });
  f.store.db
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('Textänderung', f.campaign.id, 'r0');
  const after = await f.read();
  assert.deepEqual(
    after.rooms.map((r) => r.id),
    before.rooms.map((r) => r.id),
  );
  assert.equal(f.reader.hit(f.source, query(), { x: 1, y: 1 }).id, hit.id);
});
test('compact travel receipt is idempotent and does not build a post-write full display', (t) => {
  const f = fixture(t, 1),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: f.campaign.id,
      token: f.shell.token,
      action,
    }),
    scene = f.store.executeLive(
      command({
        kind: 'initialize',
        expectedRosterRevision: f.store.live(f.shell.token).rosterRevision,
      }),
    ).scene;
  const character = f.store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Ada', speedFeet: 30 } }),
    ).character,
    live = f.store.live(f.shell.token);
  f.store.executeLive(
    command({
      kind: 'membership',
      characterId: character.id,
      expectedRevision: character.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  f.store.executeAtlasCommit(
    command({
      kind: 'landscape-put',
      record: {
        id: randomUUID(),
        revision: 0,
        kind: 'patch',
        name: 'Testland',
        points: [],
        polygons: [
          {
            outer: [
              { x: -100, y: -100 },
              { x: 100, y: -100 },
              { x: 100, y: 100 },
              { x: -100, y: 100 },
            ],
            holes: [],
          },
        ],
        resolution: 1,
        width: 0,
        values: { terrain: 'plains' },
      },
      expectedRevision: null,
    }),
  );
  const preview = f.store.previewAtlasTravel(f.shell.token, { x: 20, y: 0 }),
    c = {
      ...command({
        kind: 'place',
        point: { x: 20, y: 0 },
        expectedPositionRevision: preview.positionRevision,
        expectedMembershipRevision: preview.membershipRevision,
      }),
      sceneId: scene.id,
    };
  let reads = 0;
  const exact = f.store.campaignAtlas.bind(f.store);
  f.store.campaignAtlas = (...args) => {
    reads++;
    return exact(...args);
  };
  const ack = f.store.executeAtlasTravelCommit(c);
  assert.deepEqual(ack, { campaignId: c.campaignId, commandId: c.commandId, sceneId: c.sceneId });
  assert.equal(reads, 1, 'only the canonical rule read runs, with no full post-write display');
  const after = f.store.sceneWorld(f.shell.token, scene.id);
  assert.deepEqual(f.store.executeAtlasTravelCommit(c), ack);
  assert.deepEqual(f.store.sceneWorld(f.shell.token, scene.id).position, after.position);
  assert.equal(
    f.store.sceneWorld(f.shell.token, scene.id).scene.clock.instantMs,
    after.scene.clock.instantMs,
  );
});
buildSync({
  entryPoints: ['src/app/atlas/campaign-atlas-author.ts'],
  outfile: '.build/atlas-region-author.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
test('unknown compact write checks exactly the same command read-only and clears pending after receipt', async (t) => {
  const { parseHTML } = await import('linkedom'),
    { window, document } = parseHTML('<html></html>'),
    before = {
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
      CustomEvent: globalThis.CustomEvent,
    };
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
  });
  t.after(() => Object.assign(globalThis, before));
  const author = require('../../.build/atlas-region-author.cjs'),
    sent = [],
    c = {
      commandId: randomUUID(),
      campaignId: 'campaign',
      token: randomUUID(),
      action: { kind: 'undo' },
    };
  window.campaign = {
    executeAtlasCommit: async (command) => {
      sent.push(structuredClone(command));
      throw new Error('transport lost');
    },
    reconcileAtlasCommit: async (command) => {
      sent.push(structuredClone(command));
      return {
        ok: true,
        value: {
          outcome: 'applied',
          ack: {
            campaignId: c.campaignId,
            commandId: c.commandId,
            revision: 1,
            canUndo: false,
            canRedo: true,
          },
        },
      };
    },
  };
  assert.equal((await author.writeAtlasCommit(c)).ok, false);
  assert.deepEqual(author.pendingAtlasWrite(c.token), c);
  assert.equal((await author.recoverAtlasCommit(c.token)).ok, true);
  assert.deepEqual(sent, [c, c]);
  assert.equal(author.pendingAtlasWrite(c.token), null);
});
test('external binding IDs are own keys and derived secret styles retain absent author revision', async (t) => {
  const f = fixture(t, 1);
  f.store.db
    .prepare("UPDATE atlas_binding SET id='__proto__' WHERE campaign_id=? AND kind='dungeon'")
    .run(f.campaign.id);
  const region = await f.read();
  assert(Object.hasOwn(region.frames, '__proto__'));
  assert.equal(region.frames.__proto__.x, 0);
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: {
      kind: 'key-batch',
      rooms: [{ id: 'r0', expectedRevision: 0, keyRevision: null }],
      patch: { secret: true },
    },
  });
  const secretRegion = await f.read();
  assert.equal(secretRegion.drawing.styles.find((s) => s.id === 'r0').secret, true);
  const drawing = f.store.drawingMap(f.shell.token, 'r0');
  assert.equal(drawing.coverage, 'selected');
  assert.equal(drawing.styles[0].secret, true);
  assert.equal(drawing.styles[0].authorRevision, null);
  assert.equal(
    f.store.db
      .prepare('SELECT count(*) n FROM drawing_profile WHERE campaign_id=?')
      .get(f.campaign.id).n,
    0,
  );
});
test('content anchors resolve from the canonical volume and refresh after a room move', async (t) => {
  const f = fixture(t, 1),
    command = (action) => ({
      commandId: randomUUID(),
      token: f.shell.token,
      campaignId: f.campaign.id,
      action,
    });
  f.store.executeDrawing(
    command({
      kind: 'volume-initialize',
      roomId: 'r0',
      expectedRoomRevision: 0,
      expectedVolumeRevision: null,
      heightSteps: 2,
    }),
  );
  const volume = f.store.drawing(f.shell.token).volumes[0];
  assert.equal(f.store.drawingMap(f.shell.token, 'r0').volumes[0].id, volume.id);
  const { newElement } = require('../../.build/atlas-region-drawing-model.cjs'),
    element = {
      ...newElement('feature', 'local', 'ground', 'r0', [{ x: 9000, y: 9000 }]),
      content: {
        reference: null,
        publicText: 'PRIVATE-CONTENT',
        categories: [],
        tags: [],
        trapXp: null,
        anchor: { volumeId: volume.id, x: 0, y: 0, z: 0 },
      },
    };
  f.store.executeDrawing(command({ kind: 'element', element, expectedRevision: null }));
  let region = await f.read(),
    projected = region.drawing.elements.find((e) => e.id === element.id),
    canonical = f.store.drawingMap(f.shell.token).elements.find((e) => e.id === element.id);
  assert.deepEqual(projected.points, canonical.points);
  assert.equal(projected.zOffsetMeters, canonical.zOffsetMeters);
  assert(!JSON.stringify(region).includes('PRIVATE-CONTENT'));
  const room = f.store.atlasRoom(f.shell.token, 'r0');
  const move = command({
    kind: 'shape',
    roomId: 'r0',
    expectedRevision: room.revision,
    polygons: room.polygons.map((p) => ({
      ...p,
      outer: p.outer.map((v) => ({ x: v.x + 3.048, y: v.y })),
    })),
    transform: { dx: 3.048, dy: 0, scale: 1, angle: 0, origin: { x: 0, y: 0 } },
  });
  f.store.executeAtlasCommit({ ...move, action: { kind: 'drawing', command: move } });
  region = await f.read();
  projected = region.drawing.elements.find((e) => e.id === element.id);
  canonical = f.store.drawingMap(f.shell.token).elements.find((e) => e.id === element.id);
  assert.deepEqual(projected.points, canonical.points);
});
test('a displayed source fence rejects stale geometry writes but permits exact receipt recovery', async (t) => {
  const f = fixture(t, 1),
    region = await f.read(),
    command = {
      commandId: randomUUID(),
      token: f.shell.token,
      campaignId: f.campaign.id,
      sourceFence: region.fence,
      action: { kind: 'city-create', name: 'Neu', x: 30, y: 30, width: 100, height: 100 },
    },
    before = f.store.atlasOverview(f.shell.token).counts.cities;
  f.store.db
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('Neuer Quellstand', f.campaign.id, 'r0');
  assert.throws(() => f.store.executeAtlasCommit(command), /inzwischen geändert/);
  assert.equal(f.store.atlasOverview(f.shell.token).counts.cities, before);
  const fresh = { ...command, sourceFence: (await f.read()).fence },
    ack = f.store.executeAtlasCommit(fresh);
  assert.equal(ack.commandId, fresh.commandId);
  assert.equal(f.store.executeAtlasCommit(fresh).revision, ack.revision);
  assert.equal(f.store.atlasOverview(f.shell.token).counts.cities, before + 1);
});
test('older landscape vector display fails explicitly at its byte budget; exact reader preserves all source points', (t) => {
  const f = fixture(t, 1),
    record = {
      id: randomUUID(),
      revision: 0,
      kind: 'road',
      name: 'Dichter Verlauf',
      points: Array.from({ length: 130000 }, (_, i) => ({ x: i % 100, y: Math.floor(i / 100) })),
      polygons: [],
      resolution: 1,
      width: 1,
      values: {},
    },
    payload = JSON.stringify(record);
  f.store.db
    .prepare(
      'INSERT INTO atlas_landscape(campaign_id,id,revision,payload,min_x,max_x,min_y,max_y) VALUES(?,?,?,?,?,?,?,?)',
    )
    .run(f.campaign.id, record.id, 0, payload, 0, 100, 0, 1400);
  assert.throws(
    () =>
      f.store.landscapeRegion(f.shell.token, { x: 0, y: 0, width: 200, height: 1500 }, 0, false),
    /Darstellungsbudget/,
  );
  assert.equal(
    f.store.landscapeRegion(f.shell.token, { x: 0, y: 0, width: 200, height: 1500 }).records[0]
      .points.length,
    record.points.length,
  );
  assert.equal(
    f.store.db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, record.id).payload,
    payload,
  );
});
test('default Room metadata is cached for warm reads and invalidated by local and external ordering changes', (t) => {
  const f = fixture(t, 3),
    token = f.shell.token,
    prepare = f.store.db.prepare.bind(f.store.db);
  let scans = 0;
  f.store.db.prepare = (sql) => {
    if (sql.startsWith('SELECT r.id,r.number FROM room r WHERE')) scans++;
    return prepare(sql);
  };
  assert.equal(f.store.workspaceShell().selectedId, 'r0');
  assert.equal(f.store.workspaceShell().selectedId, 'r0');
  assert.equal(scans, 0, 'activation already resolved the unchanged default');
  f.store.db
    .prepare('UPDATE room SET number=? WHERE campaign_id=? AND id=?')
    .run('99', f.campaign.id, 'r0');
  assert.equal(f.store.workspaceShell().selectedId, 'r1');
  assert.equal(scans, 1);
  assert.equal(f.store.workspaceShell().selectedId, 'r1');
  assert.equal(scans, 1);
  const external = new Database(f.store.filename);
  external
    .prepare('UPDATE room SET number=? WHERE campaign_id=? AND id=?')
    .run('99', f.campaign.id, 'r1');
  external.close();
  assert.equal(f.store.workspaceShell().selectedId, 'r2');
  assert.equal(scans, 2);
  f.store.select(token, 'r0');
  assert.equal(
    f.store.workspaceShell().selectedId,
    'r0',
    'explicit user selection overrides the derived default',
  );
});
test('Graph preview overlays only its scope, keeps City context and joins before preview disposal', async (t) => {
  const f = fixture(t, 1),
    service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  const token = f.shell.token,
    cam = f.campaign.id,
    command = (kind) => ({
      commandId: randomUUID(),
      token,
      campaignId: cam,
      scopeId: 'local',
      action: { kind },
    }),
    original = f.store.db
      .prepare('SELECT payload FROM room WHERE campaign_id=? AND id=?')
      .get(cam, 'r0').payload;
  const city = f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token,
    campaignId: cam,
    action: {
      kind: 'city-create',
      name: 'Außerhalb Vorschau',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    },
  }).result.id;
  const neighbor = f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token,
    campaignId: cam,
    action: { kind: 'dungeon-create', name: 'Nachbar', x: 20, y: 0 },
  }).result.id;
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token,
    campaignId: cam,
    action: {
      kind: 'room-create',
      scopeId: neighbor,
      floorId: 'ground',
      name: 'Bestätigter Nachbar',
      polygons: room(0).polygons,
    },
  });
  await service.read(f.store.atlasRegionSource(token, service.cursor), query());
  f.store.executeGraph(command('raster'));
  let source = f.store.atlasRegionSource(token, service.cursor);
  assert.equal(source.filename, f.store.filename);
  assert(source.shadow.filename.includes('preview.sqlite'));
  const graphDb = f.store.graphShadow.db;
  f.store.executeDrawing({
    commandId: randomUUID(),
    token,
    campaignId: cam,
    action: {
      kind: 'create-room',
      scopeId: 'local',
      floorId: 'ground',
      name: 'Nur Vorschau',
      polygons: [
        {
          outer: [
            { x: 10, y: 0 },
            { x: 13, y: 0 },
            { x: 13, y: 3 },
            { x: 10, y: 3 },
          ],
          holes: [],
        },
      ],
    },
  });
  source = f.store.atlasRegionSource(token, service.cursor);
  const region = await service.read(source, query());
  assert(region.rooms.some((r) => r.name === 'Nur Vorschau'));
  assert(region.rooms.some((r) => r.name === 'Bestätigter Nachbar'));
  assert(region.cities.some((c) => c.header.id === city));
  assert.deepEqual(
    f.store.atlasRegionView(token, region).workspace.rooms.map((r) => r.id),
    region.rooms.map((r) => r.id),
  );
  assert.equal(
    f.store.db.prepare('SELECT payload FROM room WHERE campaign_id=? AND id=?').get(cam, 'r0')
      .payload,
    original,
  );
  source = f.store.atlasRegionSource(token, service.cursor);
  assert.equal(source.reset, false);
  assert.deepEqual(source.changes, []);
  const readonly = new Database(f.store.filename, { readonly: true });
  try {
    const overlay = new AtlasRegionReader(readonly, source.shadow);
    assert(overlay);
    assert.throws(() => readonly.prepare('DELETE FROM graph_preview.room').run(), /readonly/);
  } finally {
    readonly.close();
  }
  await service.cancelAndWait();
  f.store.executeGraph(command('restore'));
  assert.equal(graphDb.open, false);
  source = f.store.atlasRegionSource(token, service.cursor);
  assert.equal(source.shadow, undefined);
  assert(!(await service.read(source, query())).rooms.some((r) => r.name === 'Nur Vorschau'));
});
test('dense room contours remain visible while empty city ground stays transparent', async (t) => {
  const f = fixture(t, 1502),
    payload = JSON.stringify({ polygons: room(0).polygons, sections: [] });
  f.store.db
    .prepare('UPDATE room SET payload=?,checksum=? WHERE campaign_id=?')
    .run(payload, hash(payload), f.campaign.id);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: {
      kind: 'city-create',
      name: 'Überlappende Stadt',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    },
  });
  const q = query({ x: 0, y: 0, width: 30, height: 10 }),
    r = await f.read(q);
  assert.equal(r.coverage.mode, 'raster');
  const p = require('pngjs').PNG.sync.read(Buffer.from(r.raster.data.split(',')[1], 'base64')),
    i =
      (Math.floor((1.5 / q.box.height) * p.height) * p.width +
        Math.floor((1.5 / q.box.width) * p.width)) *
      4;
  assert.deepEqual(
    [...p.data.slice(i, i + 4)],
    [226, 218, 196, 255],
    'room contours remain visible over the landscape',
  );
  assert(f.reader.hit(f.source, q, { x: 1, y: 1 }).id.startsWith('r'));
  const empty =
    (Math.floor((5 / q.box.height) * p.height) * p.width +
      Math.floor((10 / q.box.width) * p.width)) *
    4;
  assert.equal(p.data[empty + 3], 0, 'empty city ground must not cover the Atlas landscape');
});
test('dense City roofs remain above roads, matching the vector City layer order', async (t) => {
  const f = fixture(t, 1),
    city = f.store.executeAtlasCommit({
      commandId: randomUUID(),
      token: f.shell.token,
      campaignId: f.campaign.id,
      action: {
        kind: 'city-create',
        name: 'Dichte Stadt',
        x: 1000,
        y: 1000,
        width: 300,
        height: 300,
      },
    }).result.id,
    building = (id, x, y) => ({
      id,
      kind: 'building',
      name: id,
      protected: true,
      position: { x, y },
      outline: [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 2, y: 2 },
        { x: -2, y: 2 },
      ],
      angle: 0,
      notes: '',
      residentIds: [],
      workerIds: [],
    });
  f.store.db.transaction(() => {
    put(f.store, 'city_unit', f.campaign.id, 'a-roof', building('a-roof', 5, 5), city);
    for (let i = 0; i < 1501; i++)
      put(
        f.store,
        'city_unit',
        f.campaign.id,
        'grid-' + i,
        building('grid-' + i, 30 + (i % 40) * 6, 30 + Math.floor(i / 40) * 6),
        city,
      );
    for (const [id, x] of [
      ['n1', 0],
      ['n2', 10],
    ])
      put(
        f.store,
        'city_unit',
        f.campaign.id,
        id,
        { id, kind: 'node', name: '', protected: true, point: { x, y: 5 } },
        city,
      );
    put(
      f.store,
      'city_unit',
      f.campaign.id,
      'z-road',
      {
        id: 'z-road',
        kind: 'road',
        name: '',
        protected: true,
        nodeIds: ['n1', 'n2'],
        via: [],
        width: 2,
      },
      city,
    );
  })();
  const q = query({ x: 1000, y: 1000, width: 300, height: 300 }),
    r = await f.read(q);
  assert.equal(r.coverage.mode, 'raster');
  const p = require('pngjs').PNG.sync.read(Buffer.from(r.raster.data.split(',')[1], 'base64')),
    i = (Math.floor((5 / 300) * p.height) * p.width + Math.floor((5 / 300) * p.width)) * 4,
    roof = f.store.atlasCitySite(f.shell.token, city).header.roof;
  assert.deepEqual(
    [...p.data.slice(i, i + 3)],
    [1, 3, 5].map((n) => parseInt(roof.slice(n, n + 2), 16)),
  );
  const empty =
    (Math.floor((290 / 300) * p.height) * p.width + Math.floor((290 / 300) * p.width)) * 4;
  assert.equal(
    p.data[empty + 3],
    0,
    'dense city rasters must preserve the landscape between objects',
  );
});
buildSync({
  entryPoints: ['src/app/atlas/city-ui.ts'],
  outfile: '.build/atlas-region-city-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
test('targeted City editing preserves an unavailable faction reference during an unrelated name edit', async (t) => {
  const { parseHTML } = await import('linkedom'),
    { readFileSync } = await import('node:fs'),
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    before = {
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
      CustomEvent: globalThis.CustomEvent,
      DOMParser: globalThis.DOMParser,
    };
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    DOMParser: window.DOMParser,
  });
  t.after(() => Object.assign(globalThis, before));
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.options[0]?.value ?? '',
    });
  for (const dialog of document.querySelectorAll('dialog')) dialog.close = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  let unit = {
      id: 'house',
      kind: 'building',
      name: 'Alt',
      protected: true,
      position: { x: 10, y: 10 },
      outline: [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 2, y: 2 },
        { x: -2, y: 2 },
      ],
      angle: 0,
      notes: 'PRIVATE\r\nProsa',
      factionId: 'unavailable-faction',
      districtId: 'keep-district',
      residentIds: [],
      workerIds: [],
      households: [],
      jobs: [],
      recipe: { seed: 'keep' },
      externalExtension: { keep: true },
    },
    revision = 0;
  const header = () => ({
      id: 'city',
      name: 'Stadt',
      revision,
      width: 100,
      height: 100,
      paper: '#e9dfc8',
      roof: '#996644',
    }),
    sent = [];
  window.campaign = {
    atlasCitySite: async () => ({
      ok: true,
      value: { header: header(), unit, related: [], factions: [], canUndo: false, canRedo: false },
    }),
    npcs: async () => ({ ok: true, value: { rows: [], total: 0 } }),
    executeAtlasCommit: async (command) => {
      sent.push(structuredClone(command));
      unit = structuredClone(command.action.command.action.upsert[0]);
      revision++;
      return {
        ok: true,
        value: {
          campaignId: 'campaign',
          commandId: command.commandId,
          revision,
          canUndo: true,
          canRedo: false,
        },
      };
    },
  };
  const ui = require('../../.build/atlas-region-city-ui.cjs');
  ui.initCity(() => {});
  ui.activateCity({
    campaign: { id: 'campaign', name: 'Kampagne', revision: 0 },
    token: 'token',
    rooms: [],
    floors: [],
    selectedId: null,
    problems: [],
    canUndo: false,
    canRedo: false,
  });
  await ui.openCityReference('city', 'house', true);
  assert.equal(document.getElementById('city-unit-faction').value, 'unavailable-faction');
  const name = document.getElementById('city-unit-name');
  name.value = 'Neu';
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(await ui.flushCity(), true);
  assert.equal(sent.length, 1);
  assert.equal(unit.name, 'Neu');
  assert.equal(unit.factionId, 'unavailable-faction');
  assert.equal(unit.districtId, 'keep-district');
  assert.equal(unit.notes, 'PRIVATE\r\nProsa');
  assert.deepEqual(unit.recipe, { seed: 'keep' });
  assert.deepEqual(unit.externalExtension, { keep: true });
});

function landscape(f, r) {
  const { points, polygons } = r,
    all = [...points, ...polygons.flatMap((p) => [p.outer, ...p.holes].flat())],
    pad = r.width / 2;
  const x = Math.min(...all.map((p) => p.x)) - pad,
    y = Math.min(...all.map((p) => p.y)) - pad,
    xx = Math.max(...all.map((p) => p.x)) + pad,
    yy = Math.max(...all.map((p) => p.y)) + pad;
  f.store.db
    .prepare('INSERT OR REPLACE INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)')
    .run(f.campaign.id, r.id, r.revision, x, xx, y, yy, JSON.stringify(r));
}
const road = (id, x = 0) => ({
  id,
  revision: 0,
  kind: 'road',
  name: id,
  points: [
    { x, y: 0 },
    { x: x + 10, y: 0 },
  ],
  polygons: [],
  resolution: 1,
  width: 1,
  values: { description: 'PRIVATE LANDSCAPE DETAILS' },
});
test('one source-bound frame preserves dense landscape and paginates exact overlapping choices without author details', async (t) => {
  const f = fixture(t, 2);
  f.store.db.transaction(() => {
    for (let i = 0; i < 601; i++) landscape(f, road('road' + i));
  })();
  const q = query({ x: -10, y: -10, width: 40, height: 40 }),
    r = await f.read(q);
  assert.equal(r.landscape.state, 'ready');
  assert.equal(r.landscape.coverage.mode, 'raster');
  assert.equal(r.landscape.coverage.objects, 601);
  assert(r.landscape.tiles.length > 0 && r.landscape.tiles.length <= 4);
  assert.equal(r.landscape.records.length, 0);
  assert(Buffer.byteLength(JSON.stringify(r)) < 2 * 1024 * 1024);
  assert(!JSON.stringify(r).includes('PRIVATE LANDSCAPE'));
  const ids = [];
  let offset = 0;
  for (;;) {
    const page = f.reader.candidatesAt(f.source, q, { x: 1, y: 0 }, offset, 'landscape');
    assert.equal(page.total, 601);
    assert.equal(page.fence, r.fence);
    assert(page.items.length <= 40);
    ids.push(...page.items.map((h) => h.id));
    if (page.next === null) break;
    offset = page.next;
  }
  assert.equal(new Set(ids).size, 601);
  assert.equal(
    f.store.atlasLandscapeObject(f.shell.token, 'road600').values.description,
    'PRIVATE LANDSCAPE DETAILS',
  );
  const first = f.reader.candidatesAt(f.source, q, { x: 1, y: 0 }, 0, 'all');
  assert(first.items.some((h) => h.kind === 'room'));
  assert(first.items.some((h) => h.kind === 'landscape'));
  assert.equal(first.total, 602);
  assert.throws(
    () => f.reader.candidatesAt(f.source, { ...q, fence: 'old' }, { x: 1, y: 0 }),
    /inzwischen geändert/,
  );
});
test('landscape cache invalidates both moved and removed bounds, while thin display cannot overwrite original values', async (t) => {
  const f = fixture(t, 1),
    r = road('road');
  landscape(f, r);
  let view = await f.read();
  assert.equal(view.landscape.state, 'ready');
  assert.deepEqual(view.landscape.records[0].values, {});
  landscape(f, { ...r, revision: 1, points: r.points.map((p) => ({ ...p, x: p.x + 100 })) });
  view = await f.read();
  assert.equal(view.landscape.records.length, 0);
  view = await f.read(query({ x: 90, y: -2, width: 30, height: 10 }));
  assert.equal(view.landscape.records[0].id, r.id);
  assert.equal(
    f.store.atlasLandscapeObject(f.shell.token, r.id).values.description,
    r.values.description,
  );
  f.store.db
    .prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?')
    .run(f.campaign.id, r.id);
  view = await f.read(query({ x: 90, y: -2, width: 30, height: 10 }));
  assert.equal(view.landscape.records.length, 0);
  assert.equal(
    f.reader.candidatesAt(
      f.source,
      query({ x: 90, y: -2, width: 30, height: 10 }),
      { x: 101, y: 0 },
      0,
      'landscape',
    ).total,
    0,
  );
});
test('broken landscape is a local layer error and never removes usable Room geometry', async (t) => {
  const f = fixture(t, 1);
  landscape(f, road('bad'));
  f.store.db.prepare('UPDATE atlas_landscape SET payload=? WHERE id=?').run('{bad', 'bad');
  const r = await f.read();
  assert.equal(r.landscape.state, 'error');
  assert.equal(r.landscape.coverage.complete, false);
  assert(r.rooms.some((r) => r.id === 'r0'));
  assert.equal(
    f.store.db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get('bad').payload,
    '{bad',
  );
});
test('camera request burst retains one worker/index with one replaceable successor', async (t) => {
  const f = fixture(t, 500),
    service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  const source = f.store.atlasRegionSource(f.shell.token);
  const calls = [];
  for (let i = 0; i < 20; i++)
    calls.push(service.read(source, query({ x: i, y: -2, width: 30, height: 10 })));
  const results = await Promise.allSettled(calls);
  assert.equal(results[0].status, 'rejected');
  assert.match(results[0].reason.message, /neuere Anfrage/);
  assert.equal(results.at(-1).status, 'fulfilled');
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(service.diagnostics.regionCancelled, 1);
  assert.equal(service.diagnostics.workerStarts, 1);
  assert.equal(service.diagnostics.active, false);
  assert.equal(service.diagnostics.queued, false);
  const warm = await service.read(
    f.store.atlasRegionSource(f.shell.token, service.cursor),
    query({ x: 21, y: -2, width: 30, height: 10 }),
  );
  assert(warm.rooms.length);
  assert.equal(service.diagnostics.workerStarts, 1);
});

test('terrain tile cache follows local move/delete and preserves coarse/fine holes in source order', async (t) => {
  const f = fixture(t, 1),
    patch = (id, x, terrain, holes = []) => ({
      id,
      revision: 0,
      kind: 'patch',
      name: id,
      points: [],
      polygons: [
        {
          outer: [
            { x, y: 0 },
            { x: x + 10, y: 0 },
            { x: x + 10, y: 10 },
            { x, y: 10 },
          ],
          holes,
        },
      ],
      resolution: id === 'coarse' ? 10 : 1,
      width: 0,
      values: { terrain },
    });
  landscape(f, patch('coarse', 0, 'forest'));
  landscape(
    f,
    patch('fine', 0, 'water', [
      [
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 },
      ],
    ]),
  );
  const q = query({ x: -1, y: -1, width: 12, height: 12 });
  let r = await f.read(q);
  assert.equal(r.landscape.state, 'ready');
  const png = require('pngjs').PNG;
  const pixel = (view, x, y) => {
    const tile = view.landscape.tiles.find(
        (t) =>
          x >= t.box.x && y >= t.box.y && x < t.box.x + t.box.width && y < t.box.y + t.box.height,
      ),
      image = png.sync.read(Buffer.from(tile.data.split(',')[1], 'base64')),
      i =
        (Math.floor(((y - tile.box.y) / tile.box.height) * image.height) * image.width +
          Math.floor(((x - tile.box.x) / tile.box.width) * image.width)) *
        4;
    return [...image.data.slice(i, i + 4)];
  };
  const forest = pixel(r, 5, 5),
    water = pixel(r, 1, 1);
  assert.notDeepEqual(forest, water);
  assert.equal(forest[3], 255);
  assert.equal(water[3], 255);
  landscape(f, { ...patch('fine', 100, 'water'), revision: 1 });
  r = await f.read(q);
  assert.deepEqual(pixel(r, 1, 1), forest);
  f.store.db.prepare('DELETE FROM atlas_landscape WHERE id=?').run('coarse');
  r = await f.read(q);
  assert.equal(r.landscape.tiles.length, 0);
});
test('dense reference bounds remain selectable; hidden references and export omission remain explicit', async (t) => {
  const f = fixture(t, 1);
  for (let i = 0; i < 18; i++)
    landscape(f, {
      ...road('ref' + i),
      kind: 'reference',
      points: [{ x: 0, y: 0 }],
      width: 10,
      imageWidth: 10,
      imageHeight: 10,
      angle: Math.PI / 2,
      visible: i !== 17,
      assetId: 'asset' + i,
    });
  const q = query({ x: -12, y: -2, width: 24, height: 15 }),
    r = await f.read(q);
  assert.equal(r.landscape.coverage.references, 17);
  assert.equal(r.landscape.coverage.mode, 'raster');
  const hits = f.reader.candidatesAt(f.source, q, { x: -5, y: 5 }, 0, 'landscape');
  assert.equal(hits.total, 17);
  assert(!hits.items.some((h) => h.id === 'ref17'));
  const exported = await f.read({ ...q, references: false });
  assert.equal(exported.landscape.coverage.references, 0);
  assert.equal(exported.landscape.records.length, 0);
});

test('dense roads do not demote a bounded image template to an outline', async (t) => {
  const f = fixture(t, 1);
  f.store.db.transaction(() => {
    for (let i = 0; i < 501; i++) landscape(f, road('road' + i));
    landscape(f, {
      ...road('template'),
      kind: 'reference',
      assetId: 'asset',
      imageWidth: 10,
      imageHeight: 10,
      points: [{ x: 0, y: 0 }],
      width: 10,
    });
  })();
  const r = await f.read(query({ x: -2, y: -2, width: 15, height: 15 }));
  assert.equal(r.landscape.coverage.mode, 'raster');
  assert.equal(r.landscape.records.length, 1);
  assert.equal(r.landscape.records[0].id, 'template');
  assert.equal(r.landscape.records[0].assetId, 'asset');
  assert(r.landscape.tiles.length > 0);
});

test('unavailable landscape reads and index builds never turn intact Room hits into an empty world', async (t) => {
  const f = fixture(t, 1),
    q = query(),
    p = { x: 1, y: 0.1 };
  landscape(f, road('bad'));
  f.store.db.prepare('UPDATE atlas_landscape SET payload=? WHERE id=?').run('{broken', 'bad');
  let r = await f.read(q);
  assert.equal(r.landscape.state, 'error');
  let hits = f.reader.candidatesAt(f.source, q, p, 0, 'all');
  assert(hits.items.some((h) => h.id === 'r0'));
  assert.deepEqual(hits.unavailable, ['landscape']);
  const valid = road('bad');
  f.store.db
    .prepare('UPDATE atlas_landscape SET payload=?,min_x=10,max_x=-10 WHERE id=?')
    .run(JSON.stringify(valid), 'bad');
  r = await f.read(q);
  assert.equal(r.landscape.state, 'error');
  assert(r.rooms.some((r) => r.id === 'r0'));
  hits = f.reader.candidatesAt(f.source, q, p, 0, 'all');
  assert(hits.items.some((h) => h.id === 'r0'));
  assert.deepEqual(hits.unavailable, ['landscape']);
  f.store.db
    .prepare('UPDATE atlas_landscape SET payload=? WHERE id=?')
    .run(JSON.stringify({ ...valid, kind: 'patch' }), 'bad');
  r = await f.read(q);
  assert.equal(
    r.landscape.state,
    'error',
    'Terrain bounds remain validated when patches use canonical Btrees.',
  );
  r = await f.read(q);
  assert.equal(
    r.landscape.state,
    'error',
    'A failed projection cannot lose the bad change by advancing its source cursor.',
  );
  f.store.db.prepare('UPDATE atlas_landscape SET min_x=-20,max_x=20 WHERE id=?').run('bad');
  r = await f.read(q);
  assert.equal(r.landscape.state, 'ready');
  assert.equal(f.reader.candidatesAt(f.source, q, p, 0, 'all').unavailable, undefined);
});

test('sample-grid rejection is pixel-identical to the full source stream across pages, negative coordinates and holes', async (t) => {
  const f = fixture(t, 1);
  let seed = 534723;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  f.store.db.transaction(() => {
    for (let i = 0; i < 2000; i++) {
      const x = rand() * 64 - 32,
        y = rand() * 64 - 32,
        size = i % 3 === 0 ? 0.01 : rand() * 2 + 0.001;
      landscape(f, {
        id: 'sample' + i,
        revision: 0,
        kind: 'patch',
        name: 'sample',
        points: [],
        polygons: [
          {
            outer: [
              { x, y },
              { x: x + size, y },
              { x: x + size, y: y + size },
              { x, y: y + size },
            ],
            holes:
              i % 5 === 0
                ? [
                    [
                      { x: x + size * 0.2, y: y + size * 0.2 },
                      { x: x + size * 0.8, y: y + size * 0.2 },
                      { x: x + size * 0.8, y: y + size * 0.8 },
                      { x: x + size * 0.2, y: y + size * 0.8 },
                    ],
                  ]
                : [],
          },
        ],
        resolution: (i % 3) + 1,
        width: 0,
        values: { terrain: i % 2 ? 'water' : 'forest' },
      });
    }
  })();
  const q = query({ x: -17, y: -11, width: 32, height: 24 }),
    r = await f.read(q),
    db = new Database(f.store.filename, { readonly: true });
  t.after(() => db.close());
  const unfiltered = new AtlasRegionReader(db);
  unfiltered.landscape.sampleMath = false;
  await unfiltered.sync(f.source);
  const expected = unfiltered.read(f.source, q);
  assert.deepEqual(r.landscape.tiles, expected.landscape.tiles);
  assert.deepEqual(r.landscape.coverage, expected.landscape.coverage);
});

test('exact glyph union preserves overlapping hits, paging, source fence and floor/archive filters', async (t) => {
  const f = fixture(t, 45),
    { newElement } = require('../../.build/atlas-region-drawing-model.cjs');
  const polygons = room(0).polygons,
    payload = JSON.stringify({ polygons, sections: [] });
  f.store.db.prepare('UPDATE room SET payload=?,checksum=?').run(payload, hash(payload));
  const element = {
    ...newElement('feature', 'local', 'ground', 'r0', [{ x: 20, y: 0 }]),
    name: 'Großes Glyph',
    width: 20,
    height: 20,
  };
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: { kind: 'element', element, expectedRevision: null },
  });
  const q = query();
  await f.read(q);
  let page = f.reader.candidatesAt(f.source, q, { x: 1, y: 1 }, 0, 'all', element.id);
  assert.equal(page.total, 46);
  assert.equal(page.items[0].id, element.id);
  assert.equal(page.items[0].name, element.name);
  assert.equal(page.next, 40);
  const second = f.reader.candidatesAt(f.source, q, { x: 1, y: 1 }, 40, 'all', element.id);
  assert.equal(second.items.length, 6);
  assert.equal(second.next, null);
  assert.equal(new Set([...page.items, ...second.items].map((h) => h.id)).size, 46);
  assert.equal(
    f.reader
      .candidatesAt(f.source, q, { x: 20, y: 0 }, 0, 'all', element.id)
      .items.filter((h) => h.id === element.id).length,
    1,
    'canonical and glyph hits are unioned once',
  );
  assert.throws(
    () =>
      f.reader.candidatesAt(f.source, { ...q, fence: 'old' }, { x: 1, y: 1 }, 0, 'all', element.id),
    /geändert/,
  );
  const hidden = { ...q, floorId: 'upper' };
  assert.equal(
    f.reader.candidatesAt(f.source, hidden, { x: 1, y: 1 }, 0, 'all', element.id).total,
    0,
  );
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: { kind: 'element', element: { ...element, archived: true }, expectedRevision: 0 },
  });
  await f.read(q);
  assert.equal(
    f.reader.candidatesAt(f.source, q, { x: 1, y: 1 }, 0, 'all', element.id).total,
    45,
    'an archived/stale glyph cannot return',
  );
});

test('camera successors cannot replace queued object selection; both lanes remain bounded and cancellable', async (t) => {
  const f = fixture(t, 5),
    source = f.store.atlasRegionSource(f.shell.token);
  for (const kind of ['focus', 'hit', 'candidates']) {
    const service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
    t.after(() => service.close());
    const first = service.read(source, query()),
      selection =
        kind === 'focus'
          ? service.focus(source, 'room', 'r0')
          : kind === 'hit'
            ? service.hit(source, query(), { x: 1, y: 1 })
            : service.candidates(source, query(), { x: 1, y: 1 });
    const cameras = Array.from({ length: 20 }, (_, i) =>
      service.read(source, query({ x: i / 10, y: -2, width: 30, height: 10 })),
    );
    const [initial, selected, ...frames] = await Promise.allSettled([first, selection, ...cameras]);
    assert.equal(initial.status, 'rejected');
    assert.match(initial.reason.message, /neuere Anfrage/);
    assert.equal(selected.status, 'fulfilled', kind + ' must survive background camera requests');
    assert.equal(kind === 'candidates' ? selected.value.items[0].id : selected.value.id, 'r0');
    assert.equal(frames.at(-1).status, 'fulfilled');
    assert.equal(frames.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(service.diagnostics.workerStarts, 1);
    assert.equal(service.diagnostics.queued, false);
    const pending = Promise.allSettled([
      service.read(source, query({ x: 50, y: 50, width: 30, height: 10 })),
      service.focus(source, 'room', 'r0'),
      service.read(source, query({ x: 60, y: 50, width: 30, height: 10 })),
    ]);
    await service.cancelAndWait();
    assert(
      (await pending).every((r) => r.status === 'rejected' && /abgebrochen/.test(r.reason.message)),
    );
    await service.close();
  }
});

test('dense raster picks a rotated object against its exact rectangle away from the anchor', async (t) => {
  const f = fixture(t, 1600),
    { newElement } = require('../../.build/atlas-region-drawing-model.cjs'),
    polygons = room(0).polygons,
    payload = JSON.stringify({ polygons, sections: [] });
  f.store.db.prepare('UPDATE room SET payload=?,checksum=?').run(payload, hash(payload));
  const element = {
    ...newElement('object', 'local', 'ground', 'r0', [{ x: 20, y: 0 }]),
    width: 30,
    height: 10,
    angle: 45,
    name: 'Gedrehte Truhe',
  };
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: { kind: 'element', element, expectedRevision: null },
  });
  const q = query({ x: 0, y: -10, width: 50, height: 40 }),
    region = await f.read(q);
  assert.equal(region.coverage.mode, 'raster');
  assert.equal(f.reader.hit(f.source, q, { x: 30, y: 10 })?.id, element.id);
  assert.deepEqual(
    f.reader.candidatesAt(f.source, q, { x: 30, y: 10 }, 0, 'all').items.map((h) => h.id),
    [element.id],
    'a raster has no glyph ID; its exact object extent must still be selectable',
  );
  assert.equal(
    f.reader
      .candidatesAt(f.source, q, { x: 20, y: 12 }, 0, 'all')
      .items.some((h) => h.id === element.id),
    false,
    'the spatial-index envelope must not act as an exact hit',
  );
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: { kind: 'element', element: { ...element, variant: 'barrel' }, expectedRevision: 0 },
  });
  await f.read(q);
  assert.equal(f.reader.hit(f.source, q, { x: 34, y: 0 })?.id, element.id);
  assert.equal(
    f.reader
      .candidatesAt(f.source, q, { x: 34, y: 4 }, 0, 'all')
      .items.some((h) => h.id === element.id),
    false,
    'ellipse corners are outside the exact footprint',
  );
});

test('an interior containing only authored objects is visible outside the origin and picks filled areas and narrow walls precisely', async (t) => {
  const f = fixture(t, 0),
    { newElement } = require('../../.build/atlas-region-drawing-model.cjs'),
    put = (element) =>
      f.store.executeDrawing({
        commandId: randomUUID(),
        token: f.shell.token,
        campaignId: f.campaign.id,
        action: { kind: 'element', element, expectedRevision: null },
      });
  const wall = {
      ...newElement('wall', 'local', 'ground', null, [
        { x: -100, y: 50 },
        { x: -80, y: 50 },
      ]),
      width: 0.2,
      height: 6,
      name: 'Freie Wand',
    },
    water = {
      ...newElement('water', 'local', 'ground', null, [
        { x: -100, y: 60 },
        { x: -80, y: 60 },
        { x: -80, y: 80 },
        { x: -100, y: 80 },
      ]),
      name: 'Wasserfläche',
    };
  put(wall);
  put(water);
  const door = {
    ...newElement('door', 'local', 'ground', null, [{ x: -70, y: 70 }]),
    name: 'Punkttür',
  };
  put(door);
  const q = query({ x: -110, y: 40, width: 50, height: 50 }),
    r = await f.read(q);
  assert.deepEqual(
    new Set(r.drawing.elements.map((e) => e.id)),
    new Set([wall.id, water.id, door.id]),
    'an object-only dungeon cannot become an empty world',
  );
  assert(
    f.reader
      .candidatesAt(f.source, q, { x: -70, y: 70 }, 0, 'all')
      .items.some((h) => h.id === door.id),
    'single-point door symbols remain reachable',
  );
  assert(f.reader.focus(f.source, 'scope', 'local').box.x < 0);
  assert(
    f.reader
      .candidatesAt(f.source, q, { x: -90, y: 70 }, 0, 'all')
      .items.some((h) => h.id === water.id),
    'filled object interiors are exact hits',
  );
  assert.equal(
    f.reader
      .candidatesAt(f.source, q, { x: -90, y: 52 }, 0, 'all')
      .items.some((h) => h.id === wall.id),
    false,
    'vertical height does not inflate horizontal wall selection',
  );
  assert(
    f.reader
      .candidatesAt(f.source, q, { x: -90, y: 50.05 }, 0, 'all')
      .items.some((h) => h.id === wall.id),
  );
  f.store.executeDrawing({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: {
      kind: 'element',
      element: {
        ...wall,
        points: [
          { x: -300, y: 50 },
          { x: -280, y: 50 },
        ],
      },
      expectedRevision: 0,
    },
  });
  const moved = query({ x: -310, y: 40, width: 50, height: 50 }),
    after = await f.read(moved);
  assert(
    after.drawing.elements.some((e) => e.id === wall.id),
    'element-only edits must update the scope extent too',
  );
});

test('authored room colors follow their target identity through selected reads, region projection and Undo/Redo', async (t) => {
  const f = fixture(t, 1),
    style = {
      id: 'r0',
      scopeId: 'local',
      revision: 0,
      ceilingMeters: 3.048,
      fill: '#3f7c9e',
      wall: '#8b2e4b',
      publicLabel: 'Zollhaus',
      secret: false,
    };
  f.store.atlasDrawingCommit({
    commandId: randomUUID(),
    campaignId: f.campaign.id,
    token: f.shell.token,
    action: { kind: 'style', style, expectedRevision: null },
  });
  const profile = f.store.db
    .prepare('SELECT id,target_id FROM drawing_profile WHERE campaign_id=?')
    .get(f.campaign.id);
  assert.notEqual(profile.id, style.id);
  assert.equal(profile.target_id, style.id);
  assert.deepEqual(f.store.drawingMap(f.shell.token, style.id).styles, [style]);
  const region = await f.read();
  assert.deepEqual(region.drawing.styles, [style]);
  assert.deepEqual(f.store.atlasRegionView(f.shell.token, region).geometry.drawing.styles, [style]);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: f.campaign.id,
    token: f.shell.token,
    action: { kind: 'undo' },
  });
  assert.deepEqual((await f.read()).drawing.styles, []);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: f.campaign.id,
    token: f.shell.token,
    action: { kind: 'redo' },
  });
  const restored = await f.read();
  assert.equal(restored.drawing.styles[0].fill, style.fill);
  assert.equal(restored.drawing.styles[0].wall, style.wall);
  f.store.atlasDrawingCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: {
      kind: 'key-batch',
      rooms: [{ id: 'r0', expectedRevision: 0, keyRevision: null }],
      patch: { secret: true },
    },
  });
  const secret = await f.read();
  assert.equal(secret.drawing.styles[0].secret, true);
  assert.equal(secret.drawing.styles[0].fill, style.fill);
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: f.campaign.id,
    token: f.shell.token,
    action: { kind: 'undo' },
  });
  assert.equal(
    (await f.read()).drawing.styles[0].secret,
    false,
    'prepared SQL must not retain old secret values',
  );
});

test('empty author frames remain focusable but never create map labels or hit targets', async (t) => {
  const f = fixture(t, 0),
    token = f.shell.token,
    campaignId = f.campaign.id;
  const write = (action) =>
    f.store.executeAtlasCommit({ commandId: randomUUID(), token, campaignId, action });
  const scopeId = write({ kind: 'dungeon-create', name: 'Abendgrundriss', x: 0, y: 0 }).result.id;
  write({ kind: 'dungeon-create', name: 'Leerer Nachbar', x: 40, y: 0 });
  const planned = write({ kind: 'dungeon-create', name: 'Geplanter Ort', x: 0, y: 0 }).result.id;
  const polygons = [
    {
      outer: [
        { x: -5, y: -5 },
        { x: 5, y: -5 },
        { x: 5, y: 5 },
        { x: -5, y: 5 },
      ],
      holes: [],
    },
  ];
  const id = write({ kind: 'room-create', scopeId, floorId: 'ground', name: 'Wachstube', polygons })
    .result.id;
  const q = { ...query({ x: -10, y: -10, width: 60, height: 20 }), scopeId };
  let region = await f.read(q);
  assert(region.labels.some((l) => l.text.includes('Wachstube')));
  assert(
    !region.labels.some((l) => l.id === 'scope:local'),
    'an empty drawing inside the room cannot replace its name',
  );
  assert(
    !region.labels.some((l) => l.text === 'Leerer Nachbar'),
    'empty documents do not represent places',
  );
  assert(!region.labels.some((l) => l.id === 'scope:' + planned));
  assert(
    !f.reader
      .candidatesAt(f.source, q, { x: 0, y: 0 }, 0, 'all')
      .items.some((h) => h.kind === 'scope' && h.id === planned),
  );
  assert(
    !f.reader
      .candidatesAt(f.source, q, { x: 0, y: 0 }, 0, 'all')
      .items.some((h) => h.kind === 'scope' && h.id === 'local'),
  );
  assert.equal(f.reader.focus(f.source, 'scope', 'local').id, 'local');
  // Neither a room hole nor focusing the empty frame may manufacture geometry.
  let room = f.store.atlasRoom(token, id);
  f.store.atlasRoomCommit({
    commandId: randomUUID(),
    token,
    campaignId,
    roomId: id,
    expectedRevision: room.revision,
    name: room.name,
    polygons: [
      {
        ...polygons[0],
        holes: [
          [
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 },
          ],
        ],
      },
    ],
    sections: room.sections,
  });
  region = await f.read(q);
  assert(!region.labels.some((l) => l.id === 'scope:local'));
  region = await f.read({ ...q, scopeId: 'local' });
  assert(region.bindings.some((b) => b.ownerId === 'local'));
  assert(!region.scopeBounds.local);
  assert.equal(region.labels.filter((l) => l.id.startsWith('scope:')).length, 0);
});

test('the empty initial drawing keeps its author frame without inventing a map label or hit target', async (t) => {
  const f = fixture(t, 0),
    q = query({ x: -20, y: -20, width: 40, height: 40 }),
    before = f.store.db.serialize();
  const region = await f.read(q),
    binding = region.bindings.find((b) => b.ownerId === 'local');
  assert(binding);
  assert(region.frames[binding.id]);
  assert(!region.labels.some((l) => l.id === 'scope:local'));
  assert.equal(region.coverage.objects, 0);
  assert(
    !f.reader
      .candidatesAt(f.source, q, { x: 0, y: 0 }, 0, 'all')
      .items.some((h) => h.kind === 'scope' && h.id === 'local'),
  );
  assert.equal(f.reader.focus(f.source, 'scope', 'local').id, 'local');
  assert.ok(f.store.db.serialize().equals(before));
  // Actual geometry stays searchable without inventing a large marker at world scale.
  f.store.executeAtlasCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    action: {
      kind: 'room-create',
      scopeId: 'local',
      floorId: 'ground',
      name: 'Zollhaus',
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 3 },
            { x: 0, y: 3 },
          ],
          holes: [],
        },
      ],
    },
  });
  const far = query({ x: -5000, y: -5000, width: 10000, height: 10000 }),
    coarse = await f.read(far);
  assert(!coarse.labels.some((l) => l.id === 'scope:local'));
  assert.equal(coarse.coverage.objects, 0);
  assert(!coarse.raster);
  assert(
    coarse.bindings.some((b) => b.ownerId === 'local'),
    'selected author frame survives scale filtering',
  );
  assert(
    !f.reader
      .candidatesAt(f.source, far, { x: 1.5, y: 1.5 }, 0, 'all')
      .items.some((h) => h.kind === 'scope' && h.id === 'local'),
  );
  assert.equal(
    f.reader.focus(f.source, 'scope', 'local').id,
    'local',
    'search/focus retains real geometry',
  );
  const edge = query({ x: -100, y: -100, width: 1536, height: 1536 }),
    visible = await f.read(edge);
  assert.equal(visible.rooms.length, 1, 'actual room geometry remains at two pixels');
  assert(
    !visible.labels.some((l) => l.id === 'scope:local'),
    'a group name must not become an automatic place label',
  );
  assert(
    f.reader
      .candidatesAt(f.source, edge, { x: 1.5, y: 1.5 }, 0, 'all')
      .items.some((h) => h.kind === 'room' && h.name.includes('Zollhaus')),
  );
  const unselected = await f.read({ ...far, scopeId: null });
  assert.equal(unselected.bindings.length, 0);
  const near = await f.read(query({ x: -1, y: -1, width: 10, height: 10 }));
  assert.equal(near.rooms.length, 1);
  assert(near.labels.some((l) => l.text.includes('Zollhaus')));
});

test('rejected writes preserve published frames and search cursors; corrected drafts commit without reloading', async (t) => {
  const f = fixture(t, 3),
    token = f.shell.token,
    cam = f.campaign.id;
  const write = (action, sourceFence) =>
    f.store.executeAtlasCommit({
      commandId: randomUUID(),
      token,
      campaignId: cam,
      sourceFence,
      action,
    });
  for (const id of ['road-a', 'road-b'])
    write({ kind: 'landscape-put', record: road(id), expectedRevision: null });
  const before = ['road-a', 'road-b'].map((id) => f.store.atlasLandscapeObject(token, id));
  const region = await f.read(),
    source = f.source,
    roomSource = f.store.roomReadSource(token),
    q = { kind: 'room', text: '', limit: 1 },
    page = f.store.atlasObjects(token, q);
  const root = f.store.atlasIdentity(token),
    receipts = f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n;
  const stable = () => {
    assert.equal(f.store.atlasRegionSource(token).fence, source.fence);
    assert.equal(f.store.roomReadSource(token).fence, roomSource.fence);
    assert.equal(f.store.atlasObjects(token, { ...q, cursor: page.next }).items.length, 1);
    assert.doesNotThrow(() => f.store.atlasRegionView(token, region));
    assert.deepEqual(
      ['road-a', 'road-b'].map((id) => f.store.atlasLandscapeObject(token, id)),
      before,
    );
    assert.deepEqual(f.store.atlasIdentity(token), root);
    assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n, receipts);
  };
  assert.throws(() =>
    write(
      {
        kind: 'landscape-put',
        record: { ...before[0], width: -2 },
        expectedRevision: before[0].revision,
      },
      source.fence,
    ),
  );
  stable();
  // The first member really writes before the second member aborts the transaction.
  assert.throws(
    () =>
      write(
        {
          kind: 'landscape-batch',
          records: [
            { record: { ...before[0], width: 6 }, expectedRevision: before[0].revision },
            { record: before[1], expectedRevision: 0 },
          ],
        },
        source.fence,
      ),
    /inzwischen/,
  );
  stable();
  f.store.db.exec(
    'CREATE TEMP TABLE source_scratch(x);INSERT INTO source_scratch VALUES(1);DROP TABLE source_scratch',
  );
  stable();
  const command = {
    commandId: randomUUID(),
    token,
    campaignId: cam,
    sourceFence: source.fence,
    action: {
      kind: 'landscape-put',
      record: { ...before[0], width: 6 },
      expectedRevision: before[0].revision,
    },
  };
  const ack = f.store.executeAtlasCommit(command);
  assert.equal(f.store.atlasLandscapeObject(token, 'road-a').width, 6);
  assert.notEqual(f.store.atlasRegionSource(token).fence, source.fence);
  assert.throws(() => f.store.atlasObjects(token, { ...q, cursor: page.next }), /inzwischen/);
  assert.throws(() => f.store.atlasRegionView(token, region), /inzwischen/);
  assert.equal(
    f.store.executeAtlasCommit(command).revision,
    ack.revision,
    'exact receipt replay survives its own commit',
  );
});

test('source fences cover committed metadata outside the spatial journal and external connections', (t) => {
  const f = fixture(t, 2),
    token = f.shell.token,
    q = { kind: 'room', text: '', limit: 1 };
  for (const external of [false, true]) {
    const source = f.store.atlasRegionSource(token),
      rooms = f.store.roomReadSource(token),
      page = f.store.atlasObjects(token, q),
      db = external ? new Database(f.store.filename) : f.store.db;
    try {
      assert.throws(
        () =>
          db.transaction(() => {
            db.prepare('UPDATE campaign SET name=? WHERE id=?').run('rollback', f.campaign.id);
            throw Error('rollback');
          })(),
        /rollback/,
      );
      assert.equal(f.store.atlasRegionSource(token).fence, source.fence);
      assert.equal(f.store.roomReadSource(token).fence, rooms.fence);
      db.prepare('UPDATE campaign SET name=? WHERE id=?').run(
        'Committed ' + external,
        f.campaign.id,
      );
    } finally {
      if (external) db.close();
    }
    assert.notEqual(f.store.atlasRegionSource(token).fence, source.fence);
    assert.notEqual(f.store.roomReadSource(token).fence, rooms.fence);
    assert.throws(() => f.store.atlasObjects(token, { ...q, cursor: page.next }), /inzwischen/);
  }
});

test('graph preview source revisions survive rollback and release observers on restore, accept and close', (t) => {
  const f = fixture(t, 2),
    token = f.shell.token,
    command = (kind) => ({
      commandId: randomUUID(),
      token,
      campaignId: f.campaign.id,
      scopeId: 'local',
      action: { kind },
    });
  for (const finish of ['restore', 'accept']) {
    f.store.executeGraph(command('raster'));
    const source = f.store.atlasRegionSource(token),
      shadow = f.store.graphShadow.db;
    assert.throws(
      () =>
        shadow.transaction(() => {
          shadow.prepare('UPDATE room SET name=? WHERE id=?').run('rollback', 'r0');
          throw Error('rollback');
        })(),
      /rollback/,
    );
    assert.equal(f.store.atlasRegionSource(token).fence, source.fence);
    shadow.prepare('UPDATE room SET name=? WHERE id=?').run('preview', 'r0');
    assert.notEqual(f.store.atlasRegionSource(token).fence, source.fence);
    const observer = f.store.committedSources.readers.get(shadow).db;
    f.store.executeGraph(command(finish));
    assert.equal(observer.open, false);
    assert.equal(shadow.open, false);
  }
  const observer = f.store.committedSources.readers.get(f.store.db).db;
  f.store.committedSources.close();
  assert.equal(observer.open, false);
});

test('external commits during a source or search read cannot label an old snapshot as current', (t) => {
  const f = fixture(t, 3),
    token = f.shell.token,
    external = new Database(f.store.filename);
  t.after(() => external.close());
  for (const target of ['source', 'search']) {
    f.store.atlasRegionSource(token);
    const prepare = f.store.db.prepare.bind(f.store.db);
    let changed = false;
    f.store.db.prepare = (sql) => {
      const statement = prepare(sql);
      if (
        !changed &&
        sql.startsWith(
          target === 'source' ? 'SELECT coalesce(min(sequence)' : 'SELECT r.id,r.name,r.number',
        )
      ) {
        changed = true;
        external.prepare('UPDATE room SET name=? WHERE id=?').run('external ' + target, 'r0');
      }
      return statement;
    };
    try {
      assert.throws(
        () =>
          target === 'source'
            ? f.store.atlasRegionSource(token)
            : f.store.atlasObjects(token, { kind: 'room', text: '', limit: 1 }),
        /inzwischen geändert/,
      );
      assert(changed);
    } finally {
      f.store.db.prepare = prepare;
    }
  }
});

test('closing the Store closes main and active graph source observers', () => {
  const dir = mkdtempSync(tmpdir() + '/source-lifecycle-'),
    store = new CampaignStore(dir + '/campaign.sqlite');
  try {
    const cam = store.create('Lifecycle', [room(0)]),
      w = store.activateShell(cam.id);
    store.executeGraph({
      commandId: randomUUID(),
      token: w.token,
      campaignId: cam.id,
      scopeId: 'local',
      action: { kind: 'raster' },
    });
    store.atlasRegionSource(w.token);
    const readers = [...store.committedSources.readers.values()].map((r) => r.db);
    assert.equal(readers.length, 2);
    store.close();
    assert(readers.every((db) => !db.open));
  } finally {
    if (store.db.open) store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('objects ignore legacy city sheets; painted areas neither own nor mutate their geometry', async (t) => {
  const f = fixture(t, 1),
    write = (action) =>
      f.store.executeAtlasCommit({
        commandId: randomUUID(),
        token: f.shell.token,
        campaignId: f.campaign.id,
        action,
      });
  const city = write({
    kind: 'city-create',
    name: 'Legacy storage title',
    x: 1000,
    y: 1000,
    width: 20,
    height: 20,
  }).result.id;
  const house = {
    id: 'independent-house',
    kind: 'building',
    name: 'Gasthaus',
    protected: false,
    position: { x: 500, y: 500 },
    angle: 0,
    outline: [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ],
    use: 'Taverne',
    notes: '',
    interior: false,
  };
  put(f.store, 'city_unit', f.campaign.id, house.id, house, city);
  const node = (id, x) => ({ id, kind: 'node', name: '', protected: false, point: { x, y: 480 } });
  put(f.store, 'city_unit', f.campaign.id, 'street-a', node('street-a', 450), city);
  put(f.store, 'city_unit', f.campaign.id, 'street-b', node('street-b', 550), city);
  put(
    f.store,
    'city_unit',
    f.campaign.id,
    'independent-road',
    {
      id: 'independent-road',
      kind: 'road',
      name: 'Feldweg',
      protected: false,
      nodeIds: ['street-a', 'street-b'],
      via: [],
      width: 6,
    },
    city,
  );
  const q = query({ x: 1400, y: 1400, width: 200, height: 200 }),
    initial = await f.read(q),
    units = () =>
      f.store.db
        .prepare('SELECT id,payload,checksum FROM city_unit WHERE campaign_id=? ORDER BY id')
        .all(f.campaign.id),
    before = units();
  assert(
    initial.cities.flatMap((c) => c.units).some((u) => u.id === house.id),
    'house outside the old 20m sheet is streamed',
  );
  assert.equal(f.reader.hit(f.source, q, { x: 1500, y: 1500 }).id, house.id);
  const geometry = initial.cities.flatMap((c) => c.units);
  const assertGeometry = async () => {
    const region = await f.read(q);
    assert.deepEqual(
      region.cities.flatMap((c) => c.units),
      geometry,
    );
    assert.deepEqual(units(), before);
    assert(!region.labels.some((l) => l.id.startsWith('city:')));
  };
  const area = {
    id: 'painted-area',
    revision: 0,
    name: 'Beliebiger Name',
    layerId: 'politics',
    parentId: null,
    typeId: 'city',
    rank: 3,
    polygons: [
      {
        outer: [
          { x: 1450, y: 1450 },
          { x: 1550, y: 1450 },
          { x: 1550, y: 1550 },
          { x: 1450, y: 1550 },
        ],
        holes: [],
      },
    ],
    color: '#b58445',
    opacity: 0.15,
    border: 'solid',
  };
  write({ kind: 'territory-put', territory: area, expectedRevision: null });
  await assertGeometry();
  let saved = f.store.atlasTerritories(f.shell.token).territories.find((a) => a.id === area.id);
  write({
    kind: 'territory-put',
    territory: {
      ...saved,
      name: 'Umbenannt',
      polygons: saved.polygons.map((p) => ({
        ...p,
        outer: p.outer.map((v) => ({ x: v.x + 10000, y: v.y })),
      })),
    },
    expectedRevision: saved.revision,
  });
  await assertGeometry();
  saved = f.store.atlasTerritories(f.shell.token).territories.find((a) => a.id === area.id);
  write({ kind: 'territory-remove', id: area.id, expectedRevision: saved.revision });
  await assertGeometry();
  write({ kind: 'undo' });
  await assertGeometry();
  write({ kind: 'redo' });
  await assertGeometry();
  const overview = await f.read(query({ x: 1000, y: 1000, width: 10000, height: 10000 }));
  assert(!overview.labels.some((l) => l.id.startsWith('city:')));
  assert(
    overview.cities.flatMap((c) => c.units).some((u) => u.id === 'independent-road'),
    'zoom never replaces independent geometry with a city marker',
  );
});

test('projected terrain omits duplicate ground but retains dense transparent objects and cache separation', async (t) => {
  const f = fixture(t, 1),
    base = {
      id: 'land',
      revision: 0,
      kind: 'patch',
      name: '',
      points: [],
      polygons: [
        {
          outer: [
            { x: -20, y: -20 },
            { x: 40, y: -20 },
            { x: 40, y: 40 },
            { x: -20, y: 40 },
          ],
          holes: [],
        },
      ],
      resolution: 1,
      width: 0,
      values: { terrain: 'plains' },
    };
  landscape(f, base);
  landscape(f, road('road'));
  const q = { ...query({ x: -10, y: -10, width: 40, height: 40 }), width: 128, height: 128 };
  const full = await f.read(q);
  assert(full.landscape.tiles.length > 0);
  const thin = await f.read({ ...q, terrainRaster: false });
  assert.equal(thin.landscape.state, 'ready');
  assert.deepEqual(thin.landscape.tiles, []);
  assert.deepEqual(thin.landscape.records, full.landscape.records);
  assert.deepEqual(thin.landscape.labels, full.landscape.labels);
  assert.throws(
    () => f.reader.read(f.source, { ...q, terrainRaster: 'false' }),
    /Kartenausschnitt/,
  );
  f.store.db.transaction(() => {
    for (let i = 0; i < 600; i++) landscape(f, road('dense' + i));
  })();
  const dense = await f.read({ ...q, terrainRaster: false });
  assert.equal(dense.landscape.coverage.mode, 'raster');
  assert(dense.landscape.tiles.length > 0);
  assert(dense.landscape.tiles.every((t) => t.content === 'objects'));
  const pixel = (view, x, y) => {
    const tile = view.landscape.tiles.find(
        (t) =>
          x >= t.box.x && y >= t.box.y && x < t.box.x + t.box.width && y < t.box.y + t.box.height,
      ),
      image = require('pngjs').PNG.sync.read(Buffer.from(tile.data.split(',')[1], 'base64'));
    const at =
      (Math.floor(((y - tile.box.y) / tile.box.height) * tile.height) * tile.width +
        Math.floor(((x - tile.box.x) / tile.box.width) * tile.width)) *
      4;
    return [...image.data.subarray(at, at + 4)];
  };
  assert.equal(pixel(dense, 5, 0)[3], 255, 'dense roads remain painted');
  assert.equal(pixel(dense, 5, 5)[3], 0, 'objects do not cover projected terrain');
  assert.equal(f.reader.candidatesAt(f.source, q, { x: 5, y: 0 }, 0, 'landscape').total, 601);
  const fallback = await f.read(q);
  assert(fallback.landscape.tiles.every((t) => t.content === undefined));
  assert.equal(
    pixel(fallback, 5, 5)[3],
    255,
    'fallback still has ground after an object-only cache entry',
  );
  const masked = await f.read({ ...q, terrainRaster: false, perception: true });
  assert(masked.landscape.tiles.every((t) => t.content === undefined));
  assert.equal(pixel(masked, 5, 5)[3], 255, 'public/masked rendering always retains its terrain');
  const again = await f.read({ ...q, terrainRaster: false });
  assert.equal(
    pixel(again, 5, 5)[3],
    0,
    'full ground cache cannot leak into a transparent overlay',
  );
});

test('room labels carry their canonical floor elevation and scope anchor through bounded reads', async (t) => {
  const f = fixture(t, 1);
  f.store.executeDrawing({
    token: f.shell.token,
    campaignId: f.campaign.id,
    commandId: randomUUID(),
    action: {
      kind: 'floor',
      scopeId: 'local',
      id: 'ground',
      name: 'Hochgeschoss',
      elevation: 12,
      cloneId: null,
      hidden: false,
    },
  });
  const region = await f.read(),
    label = region.labels.find((l) => l.id === 'room:r0');
  assert(label);
  assert.deepEqual(label.workplane, { scopeId: 'local', elevationM: 12, anchor: { x: 0, y: 0 } });
  assert(!JSON.stringify(label).includes('PRIVATE-TEXT'));
});

test('world opening indexes bounds without retaining all room shapes, then hydrates only requested geometry in a bounded cache', async (t) => {
  const f = fixture(t, 4000),
    source = f.store.atlasRegionSource(f.shell.token),
    batches = [],
    prepare = f.db.prepare.bind(f.db);
  f.db.prepare = (sql, ...args) => {
    if (sql.includes('rowid>?')) batches.push(sql);
    return prepare(sql, ...args);
  };
  await f.reader.sync(source);
  assert.equal(f.db.prepare('SELECT count(*) n FROM temp.region_shape').get().n, 4000);
  assert(
    !f.db
      .prepare('PRAGMA temp.table_info(region_shape)')
      .all()
      .some((c) => c.name === 'payload'),
    'the full-world index must not duplicate every geometry payload',
  );
  assert.equal(f.reader.shapePayloads.bytes, 0);
  let materialized = 0;
  const exact = f.reader.materialize.bind(f.reader);
  f.reader.materialize = (...args) => {
    materialized++;
    return exact(...args);
  };
  const coarse = f.reader.read(source, {
    ...query({ x: -20000000, y: -12500000, width: 40000000, height: 25000000 }),
    scopeId: null,
  });
  assert.equal(coarse.coverage.objects, 0);
  assert.equal(materialized, 0, 'subpixel groups need no world markers or hydrated room details');
  const near = f.reader.read(source, query());
  assert(near.rooms.length > 0 && near.rooms.length < 10);
  assert.equal(materialized, near.rooms.length);
  assert(f.reader.shapePayloads.bytes > 0);
  assert(f.reader.shapePayloads.bytes <= 4 * 1024 * 1024);
  const first = JSON.stringify(near.rooms);
  near.rooms[0].polygons[0].outer[0].x += 1234;
  const warm = f.reader.read(source, query());
  assert.equal(
    JSON.stringify(warm.rooms),
    first,
    'a cold result cannot mutate the serialized cache',
  );
  warm.rooms[0].polygons[0].outer[0].y -= 1234;
  f.reader.read(source, { ...query(), slice: 0 });
  assert.equal(
    JSON.stringify(f.reader.read(source, query()).rooms),
    first,
    'warm results and per-view slicing cannot mutate cached room geometry',
  );
  const focus = f.reader.focus(source, 'room', 'r3999');
  assert(focus.point.x > 19990);
  assert.equal(materialized, near.rooms.length + 1);
  // Query batching must follow the rowid cursor, not sort the campaign again for every page.
  assert(batches.length >= 4);
  for (const sql of batches) {
    const plan = prepare('EXPLAIN QUERY PLAN ' + sql).all(f.campaign.id, 0);
    assert(!plan.some((p) => p.detail.includes('TEMP B-TREE')));
    assert(plan.some((p) => p.detail.includes('rowid>?')));
  }
});

test('terrain-only sync defers all room projection and later consumes changes across shared cursors', async (t) => {
  const f = fixture(t, 100),
    project = f.reader.project.bind(f.reader);
  let projected = 0,
    cursor;
  f.reader.project = (...args) => {
    projected++;
    return project(...args);
  };
  const sync = async (geometry) => {
    const source = f.store.atlasRegionSource(f.shell.token, cursor);
    await f.reader.sync(source, geometry);
    cursor = { epoch: source.epoch, sequence: source.sequence };
    return source;
  };
  await sync(false);
  assert.equal(projected, 0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM temp.region_shape').get().n, 0);
  let source = await sync(true);
  assert.equal(projected, 100);
  assert(f.reader.read(source, query()).rooms.some((r) => r.id === 'r0'));
  const before = f.store.atlasRoom(f.shell.token, 'r0');
  f.store.atlasRoomCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    roomId: before.id,
    expectedRevision: before.revision,
    name: before.name,
    polygons: before.polygons.map((p) => ({
      ...p,
      outer: p.outer.map((p) => ({ x: p.x + 1000, y: p.y })),
    })),
    sections: before.sections,
  });
  await sync(false);
  assert.equal(projected, 100, 'terrain must not build objects even after an edit');
  f.store.db
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('Deferred name', f.campaign.id, 'r1');
  await sync(false);
  await sync(false);
  source = await sync(true);
  assert.equal(
    projected,
    102,
    'the next geometry read applies both consumed changes without rebuilding',
  );
  f.db.exec('BEGIN');
  await f.reader.sync({ ...source, reset: false, changes: [] }, false);
  f.db.exec('ROLLBACK');
  f.reader.rollback(false);
  await sync(true);
  assert.equal(projected, 102, 'a rejected terrain query must retain the object index');
  const view = f.reader.read(source, query());
  assert(!view.rooms.some((r) => r.id === 'r0'));
  assert.equal(view.rooms.find((r) => r.id === 'r1').name, 'Deferred name');
  f.store.db
    .prepare("INSERT INTO drawing_hidden VALUES(?,?,'local','room',1,1)")
    .run(f.campaign.id, 'r1');
  await sync(false);
  source = await sync(true);
  assert(!f.reader.read(source, query()).rooms.some((r) => r.id === 'r1'));
});

test('rolled-back TEMP sync invalidates JavaScript readiness and rebuilds on the same source', async (t) => {
  const f = fixture(t, 5);
  await f.read();
  const old = f.store.atlasRoom(f.shell.token, 'r0');
  f.store.atlasRoomCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    roomId: old.id,
    expectedRevision: old.revision,
    name: old.name,
    polygons: old.polygons.map((p) => ({
      ...p,
      outer: p.outer.map((p) => ({ x: p.x + 1000, y: p.y })),
    })),
    sections: old.sections,
  });
  const source = f.store.atlasRegionSource(f.shell.token, {
    epoch: f.source.epoch,
    sequence: f.source.sequence,
  });
  f.db.exec('BEGIN');
  await f.reader.sync(source);
  assert(!f.reader.read(source, query()).rooms.some((r) => r.id === 'r0'));
  f.db.exec('ROLLBACK');
  f.reader.rollback();
  await f.reader.sync({ ...source, reset: false, changes: [] });
  assert(!f.reader.read(source, query()).rooms.some((r) => r.id === 'r0'));
});

test('real worker keeps object edits consumed by terrain jobs until the next region', async (t) => {
  const f = fixture(t, 10),
    service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  const box = { x: 0, y: -2, width: 100, height: 100 },
    q = {
      view: {
        box,
        frame: box,
        columns: 9,
        rows: 9,
        focusM: 0,
        tilt: 0,
        rotation: 0,
        exaggeration: 1,
      },
      width: 16,
      height: 16,
      contours: 0,
      displayMpp: 1,
    };
  const source = () => f.store.atlasRegionSource(f.shell.token, service.cursor);
  const terrain = () => {
    const s = source();
    return service.terrain(s, { ...q, revision: s.revision });
  };
  await terrain();
  await assert.rejects(service.read(source(), { ...query(), width: 0 }), /prüfen/);
  assert(
    (await service.read(source(), query())).rooms.some((r) => r.id === 'r0'),
    'a rejected first region must not leave a rolled-back index marked ready',
  );
  const room = f.store.atlasRoom(f.shell.token, 'r0');
  f.store.atlasRoomCommit({
    commandId: randomUUID(),
    token: f.shell.token,
    campaignId: f.campaign.id,
    roomId: room.id,
    expectedRevision: room.revision,
    name: room.name,
    polygons: room.polygons.map((p) => ({
      ...p,
      outer: p.outer.map((p) => ({ x: p.x + 1000, y: p.y })),
    })),
    sections: room.sections,
  });
  await terrain();
  await terrain();
  const result = await service.read(source(), query());
  assert(!result.rooms.some((r) => r.id === 'r0'));
  assert(result.rooms.some((r) => r.id === 'r1'));
  assert.equal(service.diagnostics.workerStarts, 1);
});

test('a dense single building keeps spatial bounds ahead of its complete owner collection', async (t) => {
  const f = fixture(t, 3);
  await f.read();
  f.db.transaction(() => {
    for (let i = 0; i < 5000; i++)
      f.reader.store(
        'room',
        '',
        'dense',
        'ground',
        'dense-' + i,
        { value: {}, polygons: room(i).polygons },
        i,
      );
  })();
  const sql = f.reader.sql.bind(f.reader);
  let plan = [];
  f.reader.sql = (text) => {
    const statement = sql(text);
    if (!text.startsWith('SELECT s.*')) return statement;
    return {
      iterate(...args) {
        plan = f.db.prepare('EXPLAIN QUERY PLAN ' + text).all(...args);
        return statement.iterate(...args);
      },
    };
  };
  const result = [
    ...f.reader.candidates('room', '', 'dense', 'ground', { x: -1, y: -1, width: 21, height: 5 }),
  ];
  assert.deepEqual(
    result.map((r) => r.key),
    Array.from({ length: 5 }, (_, i) => 'room:dense-' + i),
  );
  assert.match(
    plan[0].detail,
    /SCAN i VIRTUAL TABLE INDEX 2:/,
    'A large owner must not probe every shape in its Rtree',
  );
  f.reader.indexed = false;
  assert.deepEqual(
    [...f.reader.candidates('room', '', 'dense', 'ground', { x: -1, y: -1, width: 21, height: 5 })],
    result,
  );
});

test('many small buildings use their group index while preserving spatial candidates and paint order', async (t) => {
  const f = fixture(t, 3);
  await f.read();
  f.db.transaction(() => {
    for (let group = 0; group < 2000; group++)
      for (let i = 0; i < 3; i++)
        f.reader.store(
          'room',
          '',
          'house-' + group,
          'ground',
          'house-' + group + '-' + i,
          { value: {}, polygons: room(i).polygons },
          3 - i,
        );
  })();
  const sql = f.reader.sql.bind(f.reader);
  let plan = [];
  f.reader.sql = (text) => {
    const statement = sql(text);
    if (!text.startsWith('SELECT s.*')) return statement;
    return {
      iterate(...args) {
        plan = f.db.prepare('EXPLAIN QUERY PLAN ' + text).all(...args);
        return statement.iterate(...args);
      },
    };
  };
  const box = { x: -1, y: -1, width: 21, height: 5 },
    scope = 'house-17';
  const spatial = () =>
    f.db
      .prepare(
        'SELECT s.* FROM temp.region_index i CROSS JOIN temp.region_shape s ON s.rowid=i.id WHERE s.kind=? AND s.owner=? AND s.scope=? AND s.floor=? AND i.max_x>=? AND i.min_x<=? AND i.max_y>=? AND i.min_y<=? ORDER BY s.paint_order,s.source_order,s.key',
      )
      .all('room', '', scope, 'ground', box.x, box.x + box.width, box.y, box.y + box.height);
  const read = () => [...f.reader.candidates('room', '', scope, 'ground', box)];
  assert.deepEqual(read(), spatial());
  assert.match(
    plan[0].detail,
    /SEARCH s USING INDEX region_shape_owner/,
    'coincident local bounds must not scan every other building',
  );
  assert.deepEqual(
    read().map((r) => r.key),
    ['room:house-17-2', 'room:house-17-1', 'room:house-17-0'],
  );
  f.db.transaction(() => {
    for (let i = 3; i < 2000; i++)
      f.reader.store(
        'room',
        '',
        scope,
        'ground',
        'house-17-' + i,
        { value: {}, polygons: room(i).polygons },
        i,
      );
  })();
  assert.deepEqual(read(), spatial());
  assert.match(
    plan[0].detail,
    /SCAN i VIRTUAL TABLE INDEX 2:/,
    'growth must restore spatial filtering without a stale size cache',
  );
  assert.deepEqual([...f.reader.candidates('room', '', 'missing', 'ground', box)], []);
});

test('binding metadata follows selected floors, renamed scopes and hidden extents without per-binding SQL lookups', async (t) => {
  const f = fixture(t, 1),
    ids = [];
  for (let i = 0; i < 20; i++)
    ids.push(
      f.store.executeAtlasCommit({
        commandId: randomUUID(),
        token: f.shell.token,
        campaignId: f.campaign.id,
        action: {
          kind: 'group-generate',
          name: 'Haus ' + i,
          x: 100 + i * 100,
          y: 50,
          recipe: {
            version: 1,
            profile: 'Wohnhaus',
            width: 6,
            depth: 6,
            floors: 2,
            basement: false,
            seed: 'binding-' + i,
          },
        },
      }).result.id,
    );
  const selected = ids[7],
    q = {
      ...query({ x: 0, y: -200, width: 2500, height: 500 }),
      scopeId: selected,
      floorId: 'floor-1',
      terrainRaster: false,
    };
  const sql = f.reader.sql.bind(f.reader);
  let joined = 0;
  f.reader.sql = (text) => {
    assert(
      !/^SELECT (x,y,width,height FROM temp\.region_extent|(?:id,)?name FROM scope)/.test(text),
      'metadata must travel with the binding row',
    );
    if (text.includes('e.x extent_x')) joined++;
    return sql(text);
  };
  let result = await f.read(q);
  assert(joined > 0);
  assert.equal(result.scopes.find((s) => s.id === selected).name, 'Haus 7');
  assert(result.bindings.some((b) => b.ownerId === selected));
  assert.deepEqual(
    result.scopeBounds[selected],
    f.db
      .prepare('SELECT x,y,width,height FROM temp.region_extent WHERE scope=? AND floor=?')
      .get(selected, 'floor-1'),
  );
  f.store.db
    .prepare('UPDATE scope SET name=? WHERE campaign_id=? AND id=?')
    .run('Oberhaus', f.campaign.id, selected);
  f.store.db
    .prepare(
      "INSERT INTO drawing_hidden(campaign_id,id,scope_id,kind,hidden,revision) VALUES(?,?,?,'floor',1,1)",
    )
    .run(f.campaign.id, 'floor-1', selected);
  result = await f.read(q);
  assert.equal(result.scopes.find((s) => s.id === selected).name, 'Oberhaus');
  assert.equal(
    result.scopeBounds[selected],
    undefined,
    'hidden upper floor must not fall back to the ground extent',
  );
  assert(!result.rooms.some((r) => r.scopeId === selected));
  assert(
    result.bindings.some((b) => b.ownerId === selected),
    'selected empty author frame stays available',
  );
  const db = new Database(f.store.filename, { readonly: true });
  t.after(() => db.close());
  const fresh = new AtlasRegionReader(db);
  await fresh.sync({ ...f.source, reset: true });
  assert.deepEqual(fresh.read(f.source, q), result);
});

test('obsolete geometry reads close their cursor before and after the raster transition', async (t) => {
  const f = fixture(t, 1600),
    q = query({ x: 0, y: -2, width: 8000, height: 10 }),
    expected = await f.read(q),
    shape = f.reader.shape.bind(f.reader);
  assert.equal(expected.coverage.mode, 'raster');
  for (const stop of [4, 1505]) {
    const signal = new Int32Array(new SharedArrayBuffer(4));
    let visited = 0;
    f.reader.shape = (row) => {
      const value = shape(row);
      if (++visited === stop) Atomics.store(signal, 0, 1);
      return value;
    };
    f.db.exec('BEGIN');
    assert.throws(() => f.reader.read(f.source, q, signal), /neuere Anfrage/);
    assert.equal(visited, stop, 'cancellation stops before processing the next shape');
    f.db.exec('COMMIT');
    f.reader.shape = shape;
    // An outstanding SQLite iterator would prevent this TEMP rebuild.
    await f.reader.sync({ ...f.source, reset: true });
    assert.deepEqual(f.reader.read(f.source, q), expected);
  }
});

test('obsolete landscape reads are not published as partial error layers and release nested SQL cursors', async (t) => {
  const f = fixture(t, 1),
    q = { ...query({ x: 0, y: 0, width: 1000, height: 1000 }), terrainRaster: false };
  const put = f.store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  f.store.db.transaction(() => {
    for (let i = 0; i < 600; i++) {
      const x = 10 + (i % 30) * 20,
        y = 10 + Math.floor(i / 30) * 20,
        record = {
          id: 'place-' + i,
          revision: 1,
          kind: 'place',
          name: 'Ort ' + i,
          points: [{ x, y }],
          polygons: [],
          resolution: 1,
          width: 0,
          values: {},
        };
      put.run(f.campaign.id, record.id, 1, x, x, y, y, JSON.stringify(record));
    }
  })();
  const expected = await f.read(q),
    landscape = f.reader.landscape,
    rows = landscape.rows.bind(landscape);
  assert.equal(expected.landscape.coverage.mode, 'raster');
  for (const stop of [25, 605]) {
    const signal = new Int32Array(new SharedArrayBuffer(4));
    let visited = 0,
      closed = 0;
    landscape.cache.clear();
    landscape.bytes = 0;
    landscape.rows = function* (...args) {
      try {
        for (const row of rows(...args)) {
          if (++visited === stop) Atomics.store(signal, 0, 1);
          yield row;
        }
      } finally {
        closed++;
      }
    };
    f.db.exec('BEGIN');
    assert.throws(() => f.reader.read(f.source, q, signal), /neuere Anfrage/);
    assert.equal(visited, stop);
    assert(closed > 0);
    f.db.exec('COMMIT');
    landscape.rows = rows;
    await f.reader.sync({ ...f.source, reset: true });
    assert.deepEqual(f.reader.read(f.source, q), expected);
  }
});

test('a cached current view cancels active and queued stale camera work while preserving selection', async (t) => {
  const f = fixture(t, 50),
    service = new AtlasRegionService(
      new URL('../../.build/atlas-region-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  let source = f.store.atlasRegionSource(f.shell.token),
    expected = await service.read(source, query());
  source = f.store.atlasRegionSource(f.shell.token, service.cursor);
  const first = service.read(source, query({ x: 10, y: -2, width: 30, height: 10 })),
    queued = service.read(source, query({ x: 20, y: -2, width: 30, height: 10 })),
    selection = service.focus(source, 'room', 'r0'),
    cached = service.read(source, query());
  const [old, next, pick, current] = await Promise.allSettled([first, queued, selection, cached]);
  for (const result of [old, next]) {
    assert.equal(result.status, 'rejected');
    assert.match(result.reason.message, /neuere Anfrage/);
  }
  assert.equal(pick.status, 'fulfilled');
  assert.equal(pick.value.id, 'r0');
  assert.deepEqual(current.value, expected);
  assert.equal(service.diagnostics.workerStarts, 1);
  assert.equal(service.diagnostics.queued, false);
  const renamed = f.store.db.prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?');
  renamed.run('Nach dem Abbruch', f.campaign.id, 'r0');
  assert.equal(
    (await service.read(f.store.atlasRegionSource(f.shell.token, service.cursor), query())).rooms[0]
      .name,
    'Nach dem Abbruch',
  );
});

test('dense world symbols omit empty object tiles while preserving names, hits and visible fallbacks', async (t) => {
  const f = fixture(t, 0);
  f.store.db.transaction(() => {
    for (let i = 0; i < 600; i++) landscape(f, road('minor-' + i));
  })();
  landscape(f, {
    ...road('capital'),
    kind: 'place',
    name: 'Explicit world label',
    label: { rank: 5 },
    points: [{ x: 20, y: 20 }],
    width: 0,
  });
  const q = {
    ...query({ x: -4e6, y: -4e6, width: 8e6, height: 8e6 }),
    width: 256,
    height: 256,
    scopeId: null,
    terrainRaster: false,
  };
  const world = await f.read(q);
  assert.equal(world.landscape.coverage.mode, 'raster');
  assert.equal(world.landscape.coverage.objects, 601);
  assert.equal(world.landscape.coverage.complete, true);
  assert.deepEqual(world.landscape.tiles, []);
  assert(world.landscape.labels.some((l) => l.id === 'place:capital' && l.rank === 5));
  assert.equal(f.reader.candidatesAt(f.source, q, { x: 5, y: 0 }, 0, 'landscape').total, 601);
  landscape(f, { ...road('minor-0'), revision: 1, prominence: 5 });
  assert(
    (await f.read(q)).landscape.tiles.length > 0,
    'a promoted road appears without moving the camera',
  );
  landscape(f, { ...road('minor-0'), revision: 2 });
  assert.deepEqual(
    (await f.read(q)).landscape.tiles,
    [],
    'hiding it again does not retain old raster ink',
  );
  const near = await f.read({ ...q, box: { x: -1000, y: -1000, width: 2000, height: 2000 } });
  assert(near.landscape.tiles.length > 0, 'place symbols return at the appropriate scale');
  const ref = (id) => ({
    ...road(id),
    kind: 'reference',
    points: [{ x: 0, y: 0 }],
    width: 10,
    imageWidth: 10,
    imageHeight: 10,
    angle: 0,
    visible: true,
    assetId: id,
  });
  landscape(f, ref('template'));
  const exact = await f.read(q);
  assert.deepEqual(exact.landscape.tiles, []);
  assert(exact.landscape.records.some((r) => r.id === 'template' && r.assetId === 'template'));
  f.store.db.transaction(() => {
    for (let i = 0; i < 16; i++) landscape(f, ref('template-' + i));
  })();
  assert(
    (await f.read(q)).landscape.tiles.length > 0,
    'excess image templates retain their outlines',
  );
  const hidden = await f.read({ ...q, references: false });
  assert.deepEqual(hidden.landscape.tiles, []);
  assert.equal(hidden.landscape.coverage.references, 0);
  const ground = await f.read({ ...q, terrainRaster: true });
  assert(ground.landscape.tiles.length > 0, 'Canvas terrain is still produced when requested');
});

test('bounded visual records preserve explicit route prominence and whole authored extent', async (t) => {
  const f = fixture(t, 0);
  landscape(f, {
    ...road('route'),
    name: 'Fernweg',
    prominence: 5,
    points: [
      { x: -200000, y: 0 },
      { x: 200000, y: 0 },
    ],
  });
  const q = {
    ...query({ x: -1000, y: -1000, width: 2000, height: 2000 }),
    width: 256,
    height: 256,
    scopeId: null,
    terrainRaster: false,
  };
  const view = await f.read(q),
    record = view.landscape.records.find((r) => r.id === 'route');
  assert.equal(record.prominence, 5);
  assert.deepEqual(record.points, [
    { x: -200000, y: 0 },
    { x: 200000, y: 0 },
  ]);
  assert(
    view.landscape.labels
      .filter((l) => l.id.startsWith('landscape:route'))
      .every((l) => l.rank === 5),
  );
});
