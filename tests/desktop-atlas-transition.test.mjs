import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
for (const [name, file] of [
  ['store', 'storage/store'],
  ['position', 'atlas-position'],
  ['raster', 'landscape-raster'],
  ['export', 'atlas-landscape-export'],
  ['public', 'campaign-atlas-export'],
])
  buildSync({
    entryPoints: ['src/app/' + file + '.ts'],
    outfile: '.build/transition-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
buildSync({
  entryPoints: ['desktop/atlas-region-worker.ts'],
  outfile: '.build/transition-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['desktop/atlas-region.ts'],
  outfile: '.build/transition-service.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../.build/transition-store.cjs'),
  positions = require('../.build/transition-position.cjs'),
  { LandscapeRasterizer } = require('../.build/transition-raster.cjs');
const rectangle = (x, y, w, h) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
const patch = (x = 0, y = 0, w = 100, h = 100, terrain = 'forest', resolution = 100) => ({
  id: randomUUID(),
  revision: 0,
  kind: 'patch',
  name: 'Wald',
  points: [],
  polygons: [rectangle(x, y, w, h)],
  resolution,
  width: 0,
  values: { terrain },
});
function fixture(t, rooms = []) {
  const dir = mkdtempSync(tmpdir() + '/atlas-transition-'),
    filename = dir + '/campaign.sqlite';
  let store = new CampaignStore(filename),
    campaign = store.create('Welt', rooms),
    w = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    get w() {
      return w;
    },
    campaign,
    filename,
    command: (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    }),
    fresh() {
      store.close();
      store = new CampaignStore(filename);
      w = store.activate(campaign.id);
    },
  };
}
test('overview and paged search do not load complete room/city/runtime views', (t) => {
  const rooms = Array.from({ length: 4000 }, (_, i) => ({
      id: 'room-' + String(i).padStart(5, '0'),
      scopeId: 'local',
      floorId: 'ground',
      number: String(i + 1),
      name: 'Kammer ' + i,
      revision: 0,
      polygons: [rectangle(i * 5, 0, 3, 3)],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: 'PRIVATE\r\n' + i }],
    })),
    f = fixture(t, rooms);
  for (const method of ['campaignAtlas', 'workspace', 'dungeon', 'cities', 'city'])
    f.store[method] = () => {
      throw new Error('whole view must not be called');
    };
  const overview = f.store.atlasOverview(f.w.token);
  assert.equal(overview.counts.rooms, 4000);
  assert.equal(overview.landscapeBounds, null);
  assert(!JSON.stringify(overview).includes('PRIVATE'));
  let cursor,
    ids = [];
  do {
    const page = f.store.atlasObjects(f.w.token, {
      kind: 'room',
      text: 'Kammer',
      limit: 199,
      cursor,
    });
    assert(page.items.length <= 199);
    assert(!JSON.stringify(page).includes('PRIVATE'));
    ids.push(...page.items.map((x) => x.id));
    cursor = page.next;
  } while (cursor);
  assert.equal(new Set(ids).size, 4000);
  assert.deepEqual(
    ids,
    rooms.map((r) => r.id),
  );
  assert.equal(
    f.store.atlasRoom(f.w.token, rooms[17].id).sections[0].markdown,
    rooms[17].sections[0].markdown,
  );
  assert.throws(
    () => f.store.atlasObjects(f.w.token, { kind: 'room', text: '', limit: 201 }),
    /Atlassuche/,
  );
  f.store.db
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('Äpfel', f.campaign.id, rooms[0].id);
  assert.equal(
    f.store.atlasObjects(f.w.token, { kind: 'room', text: 'ÄPFEL', limit: 10 }).items[0].id,
    rooms[0].id,
  );
  f.store.db
    .prepare(
      "INSERT INTO drawing_hidden(campaign_id,scope_id,kind,id,revision,hidden) VALUES(?,?,'floor',?,1,1)",
    )
    .run(f.campaign.id, 'local', 'ground');
  assert.equal(f.store.atlasOverview(f.w.token).counts.rooms, 0);
  assert.equal(
    f.store.atlasObjects(f.w.token, { kind: 'room', text: '', limit: 10 }).items.length,
    0,
  );
});
test('compact landscape commit is durable and idempotent without full atlas reads; stale pages rejected', (t) => {
  const f = fixture(t, [
    {
      id: 'a',
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'A',
      revision: 0,
      polygons: [rectangle(0, 0, 3, 3)],
      sections: [],
    },
    {
      id: 'b',
      scopeId: 'local',
      floorId: 'ground',
      number: '2',
      name: 'B',
      revision: 0,
      polygons: [rectangle(5, 0, 3, 3)],
      sections: [],
    },
  ]);
  const first = f.store.atlasObjects(f.w.token, { kind: 'room', text: '', limit: 1 }),
    record = patch(),
    command = f.command({ kind: 'landscape-put', record, expectedRevision: null });
  f.store.campaignAtlas = () => {
    throw new Error('whole atlas unavailable');
  };
  const ack = f.store.executeAtlasCommit(command);
  assert.equal(ack.commandId, command.commandId);
  assert.equal(ack.revision, 1);
  assert.equal(ack.canUndo, true);
  assert.equal('atlas' in ack, false);
  assert.deepEqual(f.store.executeAtlasCommit(command), ack);
  assert.equal(
    f.store
      .landscapeRegion(f.w.token, rectangleBox)
      .records.filter((r) => !r.mask && !r.height && !r.terrainSettings).length,
    1,
  );
  assert.throws(
    () =>
      f.store.executeAtlasCommit({
        ...command,
        action: { ...command.action, record: { ...record, name: 'Different' } },
      }),
    /anders verwendet/,
  );
  assert.throws(
    () => f.store.atlasObjects(f.w.token, { kind: 'room', text: '', limit: 1, cursor: first.next }),
    /inzwischen geändert/,
  );
  f.fresh();
  assert.equal(
    f.store.landscapeRegion(f.w.token, rectangleBox).records[0].values.terrain,
    'forest',
  );
});
const rectangleBox = { x: -1000, y: -1000, width: 5000, height: 5000 };
test('connection-local landscape index tracks movement, undo/redo, deletion and restart', (t) => {
  const f = fixture(t),
    record = patch();
  f.store.landscapeRegion(f.w.token, rectangleBox);
  assert.equal(
    f.store.db
      .prepare("SELECT count(*) n FROM sqlite_temp_master WHERE name='atlas_landscape_area'")
      .get().n,
    1,
  );
  const write = (action) => f.store.executeAtlasCommit(f.command(action));
  write({ kind: 'landscape-put', record, expectedRevision: null });
  assert.equal(
    f.store
      .landscapeRegion(f.w.token, rectangleBox)
      .records.filter((r) => !r.mask && !r.height && !r.terrainSettings).length,
    1,
  );
  write({
    kind: 'landscape-put',
    record: { ...record, polygons: [rectangle(1e8, 1e8, 100, 100)] },
    expectedRevision: 1,
  });
  assert.equal(
    f.store
      .landscapeRegion(f.w.token, rectangleBox)
      .records.filter((r) => !r.mask && !r.height && !r.terrainSettings).length,
    0,
  );
  write({ kind: 'undo' });
  assert.equal(
    f.store
      .landscapeRegion(f.w.token, rectangleBox)
      .records.filter((r) => !r.mask && !r.height && !r.terrainSettings).length,
    1,
  );
  write({ kind: 'redo' });
  assert.equal(
    f.store
      .landscapeRegion(f.w.token, rectangleBox)
      .records.filter((r) => !r.mask && !r.height && !r.terrainSettings).length,
    0,
  );
  write({
    kind: 'landscape-remove',
    id: record.id,
    expectedRevision: f.store.landscapeRegion(f.w.token, {
      x: 1e8,
      y: 1e8,
      width: 200,
      height: 200,
    }).records[0].revision,
  });
  write({ kind: 'undo' });
  f.fresh();
  assert.equal(
    f.store
      .landscapeRegion(f.w.token, { x: 1e8, y: 1e8, width: 200, height: 200 })
      .records.filter((r) => !r.mask && !r.height && !r.terrainSettings).length,
    1,
  );
  assert.equal(
    f.store.db
      .prepare("SELECT count(*) n FROM sqlite_master WHERE name='atlas_landscape_area'")
      .get().n,
    0,
  );
  const before = f.store.atlasOverview(f.w.token).revision;
  f.store.landscapeRegion(f.w.token, rectangleBox, 1, true);
  f.store.landscapeRegion(f.w.token, rectangleBox, 1, false);
  assert.equal(f.store.atlasOverview(f.w.token).revision, before);
});
test('atlas reads reject stale activation and cross-campaign IDs', (t) => {
  const f = fixture(t),
    a = f.w,
    other = f.store.create('Other');
  f.store.activate(other.id);
  assert.throws(() => f.store.atlasOverview(a.token), /früheren/);
  const b = f.store.activate(other.id);
  assert.throws(() => f.store.atlasRoom(b.token, 'missing'), /nicht gefunden/);
});
test('large signed addresses preserve local millimeters, normalized boundaries and explicit range failures', () => {
  const { atlasPosition, checkedAtlasPosition, offsetAtlasPosition, relativeAtlasPosition } =
    positions;
  assert.deepEqual(atlasPosition({ x: -0.5, y: 1000 }), {
    version: 1,
    x: { area: '-1', offset: 999.5 },
    y: { area: '1', offset: 0 },
  });
  const p = checkedAtlasPosition({
      version: 1,
      x: { area: '123456789012345678901234567890', offset: 999.999 },
      y: { area: '-123456789012345678901234567890', offset: 0.001 },
    }),
    q = offsetAtlasPosition(p, { x: 0.002, y: -0.002 }),
    d = relativeAtlasPosition(q, p, 1);
  assert(Math.abs(d.x - 0.002) < 1e-9);
  assert(Math.abs(d.y + 0.002) < 1e-9);
  assert.equal(q.x.area, '123456789012345678901234567891');
  assert.equal(q.y.area, '-123456789012345678901234567891');
  assert.deepEqual(
    relativeAtlasPosition(
      atlasPosition({ x: 4e12, y: -4e12 }),
      atlasPosition({ x: 4e12 - 1, y: -4e12 + 1 }),
      10,
    ),
    { x: 1, y: -1 },
  );
  assert.throws(() => relativeAtlasPosition(q, atlasPosition({ x: 0, y: 0 }), 1000), /außerhalb/);
  assert.throws(() => atlasPosition({ x: 1e15, y: 0 }), /millimetergenau/);
  assert.throws(() => checkedAtlasPosition({ ...p, x: { area: '01', offset: 0 } }), /Atlasadresse/);
});
test('overview raster preserves fine forest, holes and terrain overrides; elevation-only edits inherit terrain', () => {
  const image = new LandscapeRasterizer({ x: 0, y: 0, width: 100, height: 100 }, 100, 100),
    base = patch(0, 0, 100, 100, 'forest', 1000),
    water = patch(20, 20, 60, 60, 'water', 100);
  water.polygons[0].holes = [rectangle(40, 40, 20, 20).outer];
  image.paint(base);
  image.paint(water);
  image.paint({ ...patch(0, 0, 100, 100), values: { elevationM: 300 } });
  const data = image.finish(),
    pixel = (x, y) => [...data.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 4)];
  assert.deepEqual(pixel(5, 5), [102, 139, 105, 255]);
  assert.deepEqual(pixel(30, 30), [127, 168, 189, 255]);
  assert.deepEqual(pixel(50, 50), [102, 139, 105, 255]);
  const fine = new LandscapeRasterizer({ x: 0, y: 0, width: 100, height: 100 }, 8, 8);
  for (let y = 0; y < 100; y += 2) for (let x = 0; x < 100; x += 2) fine.paint(patch(x, y, 2, 2));
  assert(fine.finish().some((v, i) => i % 4 === 3 && v === 255));
  assert.throws(() => new LandscapeRasterizer(rectangleBox, 1e9, 1), /prüfen/);
});

test('the common region worker streams 100000 patches into bounded overview tiles without changing author data', async (t) => {
  const f = fixture(t),
    { AtlasRegionService } = require('../.build/transition-service.cjs'),
    service = new AtlasRegionService(
      new URL('../.build/transition-worker.cjs', import.meta.url).pathname,
    );
  t.after(() => service.close());
  const put = f.store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  f.store.db.transaction(() => {
    for (let i = 0; i < 100000; i++) {
      const x = (i % 316) * 5000,
        y = Math.floor(i / 316) * 5000,
        r = patch(x, y, 5000, 5000);
      put.run(f.campaign.id, r.id, 1, x, x + 5000, y, y + 5000, JSON.stringify(r));
    }
  })();
  const before = f.store.atlasOverview(f.w.token),
    box = { x: -1e6, y: -1e6, width: 4e7, height: 2e7 },
    query = {
      box,
      width: 512,
      height: 256,
      scopeId: 'local',
      floorId: 'ground',
      slice: null,
      roofs: true,
    };
  const region = await service.read(f.store.atlasRegionSource(f.w.token, service.cursor), query),
    layer = region.landscape;
  assert.equal(layer.state, 'ready');
  assert(layer.coverage.complete);
  assert(layer.tiles.length > 0 && layer.tiles.length <= 4);
  assert(Buffer.byteLength(JSON.stringify(region)) <= 2 * 1024 * 1024);
  const { PNG } = require('pngjs');
  let forest = 0;
  for (const tile of layer.tiles) {
    const png = PNG.sync.read(Buffer.from(tile.data.split(',')[1], 'base64'));
    for (let i = 0; i < png.data.length; i += 4)
      if (
        png.data[i] === 102 &&
        png.data[i + 1] === 139 &&
        png.data[i + 2] === 105 &&
        png.data[i + 3] > 0
      )
        forest++;
  }
  assert(forest > 0, 'fine forest survives world-aligned overview aggregation');
  const tile = layer.tiles.find(
      (t) =>
        t.box.x <= 500000 &&
        t.box.x + t.box.width > 500000 &&
        t.box.y <= 500000 &&
        t.box.y + t.box.height > 500000,
    ),
    png = PNG.sync.read(Buffer.from(tile.data.split(',')[1], 'base64')),
    pixel =
      (Math.floor(((500000 - tile.box.y) / tile.box.height) * png.height) * png.width +
        Math.floor(((500000 - tile.box.x) / tile.box.width) * png.width)) *
      4;
  assert.deepEqual([...png.data.slice(pixel, pixel + 4)], [102, 139, 105, 255]);
  assert.equal(f.store.atlasOverview(f.w.token).revision, before.revision);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_command').get().n, 0);
  assert.deepEqual(
    await service.read(f.store.atlasRegionSource(f.w.token, service.cursor), query),
    region,
  );
  assert.equal(service.diagnostics.workerStarts, 1);
  const interrupted = service.read(f.store.atlasRegionSource(f.w.token, service.cursor), {
    ...query,
    box: { ...box, x: 1 },
  });
  service.cancel();
  await assert.rejects(interrupted, /abgebrochen/);
});
test('a landscape edit pauses an active local trip without changing confirmed position or time', (t) => {
  const f = fixture(t),
    command = (action) => f.command(action),
    scene = f.store.executeLive(
      command({
        kind: 'initialize',
        expectedRosterRevision: f.store.live(f.w.token).rosterRevision,
      }),
    ).scene;
  const character = f.store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Ada', speedFeet: 30 } }),
    ).character,
    live = f.store.live(f.w.token);
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
      record: patch(-100, -100, 200, 200, 'plains'),
      expectedRevision: null,
    }),
  );
  const preview = f.store.previewAtlasTravel(f.w.token, { x: 20, y: 0 });
  f.store.executeAtlasTravel({ ...command({ kind: 'start', preview }), sceneId: scene.id });
  const before = f.store.sceneWorld(f.w.token, scene.id);
  f.store.campaignAtlas = () => {
    throw new Error('No complete atlas for terrain');
  };
  f.store.executeAtlasCommit(
    command({ kind: 'landscape-put', record: patch(), expectedRevision: null }),
  );
  const row = f.store.db
    .prepare('SELECT payload FROM atlas_local_journey WHERE campaign_id=? AND scene_id=?')
    .get(f.campaign.id, scene.id);
  assert.equal(JSON.parse(row.payload).status, 'paused');
  const after = f.store.sceneWorld(f.w.token, scene.id);
  assert.deepEqual(after.position, before.position);
  assert.deepEqual(after.scene.clock, before.scene.clock);
  f.store.executeAtlasCommit(command({ kind: 'undo' }));
  const restored = JSON.parse(
    f.store.db
      .prepare('SELECT payload FROM atlas_local_journey WHERE campaign_id=? AND scene_id=?')
      .get(f.campaign.id, scene.id).payload,
  );
  assert.equal(restored.status, 'paused');
  assert.match(restored.reason, /vor Fortsetzung/);
  assert(restored.revision > JSON.parse(row.payload).revision);
  f.store.executeAtlasCommit(command({ kind: 'redo' }));
  assert.equal(
    JSON.parse(
      f.store.db
        .prepare('SELECT payload FROM atlas_local_journey WHERE campaign_id=? AND scene_id=?')
        .get(f.campaign.id, scene.id).payload,
    ).status,
    'paused',
  );
});

test('large authored polygon bounds do not depend on the JavaScript argument limit', () => {
  const p = patch();
  p.polygons[0].outer = Array.from({ length: 100000 }, (_, i) => ({ x: i, y: i % 2 }));
  // Exercise the writer, whose index maintenance uses bounds().
  const dir = mkdtempSync(tmpdir() + '/atlas-bounds-'),
    store = new CampaignStore(dir + '/campaign.sqlite');
  try {
    const campaign = store.create('Dense'),
      w = store.activate(campaign.id);
    store.executeAtlasCommit({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action: { kind: 'landscape-put', record: p, expectedRevision: null },
    });
    assert.equal(store.atlasOverview(w.token).landscapeBounds.width, 99999);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('landscape search pages beyond 100 without copying geometry, then loads one exact object', (t) => {
  const f = fixture(t),
    put = f.store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)'),
    rows = Array.from({ length: 251 }, (_, i) => ({
      ...patch(),
      revision: 1,
      kind: 'road',
      id: 'road-' + String(i).padStart(4, '0'),
      name: 'Äußere Straße ' + i,
      points: [
        { x: i, y: 0 },
        { x: i + 10, y: 0 },
      ],
      polygons: [],
      width: 5,
    }));
  f.store.db.transaction(() => {
    for (const r of rows)
      put.run(f.campaign.id, r.id, 1, r.points[0].x, r.points[1].x, 0, 0, JSON.stringify(r));
  })();
  let cursor,
    ids = [];
  do {
    const page = f.store.atlasObjects(f.w.token, {
      kind: 'landscape',
      text: 'ÄUẞERE',
      limit: 40,
      cursor,
    });
    assert(!JSON.stringify(page).includes('polygons'));
    ids.push(...page.items.map((r) => r.id));
    cursor = page.next;
  } while (cursor);
  const first = f.store.atlasObjects(f.w.token, { kind: 'landscape', text: 'Straße', limit: 40 }),
    before = f.store.atlasIdentity(f.w.token).revision;
  f.store.db
    .prepare('UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id=?')
    .run(JSON.stringify({ ...rows[50], name: 'Anderer Verlauf' }), f.campaign.id, rows[50].id);
  assert.equal(f.store.atlasIdentity(f.w.token).revision, before);
  assert.throws(
    () =>
      f.store.atlasObjects(f.w.token, {
        kind: 'landscape',
        text: 'Straße',
        limit: 40,
        cursor: first.next,
      }),
    /inzwischen geändert/,
  );
  assert.equal(ids.length, 251);
  assert.deepEqual(f.store.atlasLandscapeObject(f.w.token, ids.at(-1)), rows.at(-1));
  assert.throws(() => f.store.atlasLandscapeObject(f.w.token, 'missing'), /nicht gefunden/);
  const other = f.store.create('Other'),
    w = f.store.activate(other.id);
  assert.throws(() => f.store.atlasLandscapeObject(w.token, rows[0].id), /nicht gefunden/);
});

test('an unavailable derived index cannot prevent opening an unrelated healthy campaign', (t) => {
  const f = fixture(t),
    r = patch();
  f.store.executeAtlasCommit(
    f.command({ kind: 'landscape-put', record: r, expectedRevision: null }),
  );
  const other = f.store.create('Foreign'),
    put = f.store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  f.store.landscapeRegion(f.w.token, rectangleBox); // Build the optional writer cache before damaging its trigger path.
  // An external damaged row may make an optional Rtree rebuild impossible.
  f.store.db.exec(
    'DROP TRIGGER temp.atlas_landscape_area_insert; DROP TRIGGER temp.atlas_landscape_objects_insert;',
  );
  put.run(other.id, 'damaged', 1, 10, -10, 0, 1, '{broken original bytes');
  f.fresh();
  assert.equal(f.store.landscapeRegion(f.w.token, rectangleBox).records[0].id, r.id);
  assert.equal(
    f.store.db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?').get(other.id)
      .payload,
    '{broken original bytes',
  );
  assert.equal(
    f.store.db
      .prepare(
        "SELECT count(*) n FROM sqlite_temp_master WHERE name IN ('atlas_landscape_area','atlas_landscape_objects')",
      )
      .get().n,
    0,
  );
});

test('GM scenes stream with exact pixel placement, source identity and cancellation', async () => {
  const { atlasExportTiles } = require('../.build/transition-export.cjs'),
    box = { x: -12345, y: -98765, width: 4e7, height: 2e7 },
    calls = [],
    progress = [];
  const collect = async (stream) => {
    const tiles = [];
    for await (const tile of stream) tiles.push(tile);
    return tiles;
  };
  const read = async (part, width, height) => {
    calls.push({ part, width, height });
    return {
      ok: true,
      value: { campaignId: 'c', revision: 7, box: part, width, height, scene: {} },
    };
  };
  const stream = atlasExportTiles(
    box,
    2050,
    1100,
    'c',
    7,
    read,
    () => true,
    (...p) => progress.push(p),
    1024,
  );
  assert.equal(calls.length, 0, 'Do not read or retain tiles before consumption');
  const tiles = await collect(stream);
  assert.equal(tiles.length, 6);
  assert.deepEqual(
    calls.map((c) => [c.width, c.height]),
    [
      [1024, 1024],
      [1024, 1024],
      [2, 1024],
      [1024, 76],
      [1024, 76],
      [2, 76],
    ],
  );
  assert.deepEqual(
    tiles.map((t) => [t.x, t.y]),
    [
      [0, 0],
      [1024, 0],
      [2048, 0],
      [0, 1024],
      [1024, 1024],
      [2048, 1024],
    ],
  );
  assert.deepEqual(progress.at(-1), [6, 6]);
  const last = tiles.at(-1);
  assert(Math.abs(last.box.x + last.box.width - box.x - box.width) < 1e-6);
  assert(Math.abs(last.box.y + last.box.height - box.y - box.height) < 1e-6);
  let running = true,
    count = 0;
  await assert.rejects(
    collect(
      atlasExportTiles(
        box,
        2050,
        1100,
        'c',
        7,
        async (...args) => {
          count++;
          running = false;
          return read(...args);
        },
        () => running,
      ),
    ),
    /abgebrochen/,
  );
  assert.equal(count, 1);
  running = true;
  count = 0;
  const paused = atlasExportTiles(
    box,
    2050,
    1100,
    'c',
    7,
    async (...args) => {
      count++;
      return read(...args);
    },
    () => running,
  );
  await paused.next();
  assert.equal(count, 1, 'The successor must wait for the consumer');
  running = false;
  await assert.rejects(paused.next(), /abgebrochen/);
  assert.equal(count, 1);
  for (const change of [
    { campaignId: 'other' },
    { revision: 8 },
    { width: 99 },
    { height: 99 },
    { box: { ...box, x: 0 } },
  ])
    await assert.rejects(
      collect(
        atlasExportTiles(
          box,
          100,
          100,
          'c',
          7,
          async (...args) => {
            const r = await read(...args);
            return { ok: true, value: { ...r.value, ...change } };
          },
          () => true,
        ),
      ),
      /während der Ausgabe/,
    );
  await assert.rejects(
    collect(
      atlasExportTiles(
        box,
        100,
        100,
        'c',
        7,
        async () => ({ ok: false, error: 'Source unavailable' }),
        () => true,
      ),
    ),
    /Source unavailable/,
  );
  await assert.rejects(collect(atlasExportTiles(box, 8193, 1, 'c', 7, read, () => true)), /prüfen/);
});

test('public export uses remembered public terrain, never current hidden GM geometry', async (t) => {
  const { parseHTML } = await import('linkedom'),
    { document } = parseHTML('<html><body></body></html>'),
    previous = globalThis.document;
  globalThis.document = document;
  t.after(() => {
    globalThis.document = previous;
  });
  const { publicAtlasPaint } = require('../.build/transition-public.cjs'),
    snapshot = { geometry: { position: null }, perception: null },
    box = { x: -5000, y: -5000, width: 10000, height: 10000 };
  const frame = {
    mode: 'map',
    title: '',
    map: {
      hexMeters: 4828.032,
      position: { q: 0, r: 0 },
      cells: [
        {
          q: 0,
          r: 0,
          terrain: 'forest',
          road: false,
          river: false,
          visible: false,
          label: 'Bekannter Wald',
        },
      ],
      markers: [],
    },
  };
  const secret = { ...patch(-1000, -1000, 2000, 2000, 'water'), id: 'secret-new-lake' };
  const svg = JSON.stringify(publicAtlasPaint(snapshot, box, frame));
  assert(svg.includes('#668b69'));
  assert(!svg.includes('#7fa8bd'), 'A new unseen lake must not overwrite remembered forest');
  assert(!svg.includes('secret-new-lake'));
  assert(!svg.includes('landscapeId'));
});

test('unknown or incomplete author commands cannot receive a successful compact commit receipt', (t) => {
  const f = fixture(t),
    before = f.store.atlasIdentity(f.w.token).revision;
  for (const action of [{ kind: 'landscape-future-action' }, { kind: 'unknown' }, {}])
    assert.throws(
      () => f.store.executeAtlasCommit(f.command(action)),
      /Atlasauftrag nicht gespeichert/,
    );
  assert.throws(
    () => f.store.executeAtlasCommit({ ...f.command({ kind: 'room-default' }), commandId: '' }),
    /Atlasauftrag nicht gespeichert/,
  );
  assert.equal(f.store.atlasIdentity(f.w.token).revision, before);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n, 0);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_command').get().n, 0);
});

test('targeted reads and page cursors preserve existing opaque IDs without a new length restriction', (t) => {
  const id = 'a'.repeat(1500),
    f = fixture(t, [
      {
        id,
        scopeId: 'local',
        floorId: 'ground',
        number: '1',
        name: 'Altbestand',
        revision: 0,
        polygons: [rectangle(0, 0, 3, 3)],
        sections: [],
      },
      {
        id: 'z',
        scopeId: 'local',
        floorId: 'ground',
        number: '2',
        name: 'Zweiter Raum',
        revision: 0,
        polygons: [rectangle(5, 0, 3, 3)],
        sections: [],
      },
    ]);
  assert.equal(f.store.atlasRoom(f.w.token, id).id, id);
  const page = f.store.atlasObjects(f.w.token, { kind: 'room', text: '', limit: 1 });
  assert.equal(page.items[0].id, id);
  assert.equal(
    f.store.atlasObjects(f.w.token, { kind: 'room', text: '', limit: 1, cursor: page.next })
      .items[0].id,
    'z',
  );
  const record = {
    ...patch(),
    id,
    kind: 'road',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    polygons: [],
    width: 5,
  };
  f.store.executeAtlasCommit(f.command({ kind: 'landscape-put', record, expectedRevision: null }));
  assert.equal(f.store.atlasLandscapeObject(f.w.token, id).id, id);
});

test('opening a store does not build an unused writer landscape index; the first bounded legacy read builds it once', (t) => {
  const f = fixture(t),
    count = () =>
      f.store.db
        .prepare(
          "SELECT count(*) n FROM sqlite_temp_master WHERE name IN ('atlas_landscape_area','atlas_landscape_objects')",
        )
        .get().n;
  assert.equal(count(), 0);
  const r = patch();
  f.store.executeAtlasCommit(
    f.command({ kind: 'landscape-put', record: r, expectedRevision: null }),
  );
  assert.equal(count(), 0);
  assert.equal(f.store.landscapeRegion(f.w.token, rectangleBox).records[0].id, r.id);
  assert.equal(count(), 2);
  f.store.db.exec('DROP TABLE temp.atlas_landscape_area; DROP TABLE temp.atlas_landscape_objects;');
  assert.equal(f.store.landscapeRegion(f.w.token, rectangleBox).records[0].id, r.id);
  assert.equal(
    count(),
    0,
    'An explicitly unavailable cache uses canonical bounds instead of rebuilding per read.',
  );
});
