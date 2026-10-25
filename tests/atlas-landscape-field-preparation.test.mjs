import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  PNG = require('pngjs').PNG;
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/atlas-projection-index';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export * from './src/app/terrain-route';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-landscape-field-preparation-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasRegionReader,
  AtlasProjectionIndex,
  bounds,
  heightRecord,
  routeSpec,
  emptyRecord,
} = require('../.build/atlas-landscape-field-preparation-test.cjs');

const box = { x: -10, y: -10, width: 40, height: 40 },
  query = {
    box,
    width: 800,
    height: 800,
    scopeId: 'local',
    floorId: 'ground',
    slice: null,
    roofs: true,
  };
async function fixture(t) {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/atlas-landscape-field-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Landscape field preparation'),
    token = store.activateShell(campaign.id).token;
  const db = new Database(store.filename, { readonly: true });
  let projection, reader, cursor;
  // Reopening uses a fresh readonly canonical connection and disposable reader state.
  let connection = db;
  const reopen = async () => {
    await projection?.flush();
    await projection?.close();
    connection.close();
    connection = new Database(store.filename, { readonly: true });
    cursor = undefined;
    projection = await AtlasProjectionIndex.open(
      connection,
      store.atlasRegionSource(token),
      dir + '/projection',
    );
    reader = new AtlasRegionReader(connection, undefined, projection);
  };
  const source = () => store.atlasRegionSource(token, cursor);
  const sync = async (mode = 'field') => {
    cursor = store.atlasRegionSource(token, cursor);
    connection.exec('BEGIN');
    try {
      await reader.sync(cursor, true, mode);
      connection.exec('COMMIT');
      return cursor;
    } catch (error) {
      connection.exec('ROLLBACK');
      reader.rollback(true);
      throw error;
    }
  };
  const putDirect = (records) => {
    const insert = store.db.prepare(
      'INSERT INTO atlas_landscape(campaign_id,id,revision,min_x,max_x,min_y,max_y,payload) VALUES(?,?,?,?,?,?,?,?)',
    );
    store.db.transaction(() => {
      for (const record of records) {
        const b = bounds(record);
        if (![b.x, b.y, b.width, b.height].every(Number.isFinite))
          throw Error(`Invalid fixture bounds for ${record.id}: ${JSON.stringify(b)}`);
        insert.run(
          campaign.id,
          record.id,
          1,
          b.x,
          b.x + b.width,
          b.y,
          b.y + b.height,
          JSON.stringify(record),
        );
      }
    })();
  };
  const command = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: campaign.id, token, action });
  projection = await AtlasProjectionIndex.open(
    connection,
    store.atlasRegionSource(token),
    dir + '/projection',
  );
  reader = new AtlasRegionReader(connection, undefined, projection);
  t.after(async () => {
    await projection?.close();
    connection.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    store,
    campaign,
    token,
    putDirect,
    command,
    reopen,
    sync,
    get source() {
      return cursor;
    },
    get reader() {
      return reader;
    },
    get projection() {
      return projection;
    },
  };
}

function fieldRecords() {
  const heights = heightRecord(999_936, 999_936, 4, new Float32Array(4096).fill(73));
  return [
    heights,
    {
      ...emptyRecord('road'),
      id: 'route-field',
      revision: 1,
      points: [
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      label: 'Field road',
      width: 4,
      route: {
        ...routeSpec('road', [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ]),
        nodes: [
          { x: 10, y: 0, z: 0, structure: 'ground' },
          { x: 20, y: 0, z: 0, structure: 'ground' },
        ],
      },
      resolution: 4,
    },
    {
      ...emptyRecord('patch'),
      id: 'lake-field',
      revision: 1,
      surface: 'freshwater',
      waterLevelM: 12,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 },
          ],
          holes: [],
        },
      ],
      resolution: 4,
    },
    {
      ...emptyRecord('patch'),
      id: 'color-field',
      revision: 1,
      name: 'Original pigment',
      paint: {
        version: 2,
        operation: 'paint',
        color: '#ff0000',
        opacity: 1,
        target: 'water',
        flow: 1,
        tip: 'round',
        radius: 4,
        seed: 7,
        fill: true,
      },
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 },
          ],
          holes: [],
        },
      ],
      resolution: 4,
    },
    {
      ...emptyRecord('patch'),
      id: 'base-field',
      revision: 1,
      values: { terrain: 'forest' },
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 },
          ],
          holes: [],
        },
      ],
      resolution: 4,
    },
    {
      ...emptyRecord('place'),
      id: 'place-field',
      revision: 1,
      name: 'Deferred settlement',
      points: [{ x: 4, y: 4 }],
      width: 8,
      resolution: 4,
    },
  ];
}

function heightAt(reader, source, x, y) {
  return reader.geometryHeight(source, { x, y });
}

test('field preparation reads only height, route and lake metadata while preserving offscreen height anchors across reopen', async (t) => {
  const f = await fixture(t),
    records = fieldRecords();
  f.putDirect(records);
  await f.sync('field');
  const fieldCount = f.projection
    .prepare('SELECT count(*) n FROM temp.landscape_shape_bounds')
    .get().n;
  const fieldKinds = f.projection
    .prepare(
      'SELECT terrain_kind kind,count(*) n FROM temp.landscape_shape_bounds GROUP BY terrain_kind ORDER BY terrain_kind',
    )
    .all();
  assert.equal(
    fieldCount,
    3,
    'color, base terrain, and place records must stay outside field metadata',
  );
  assert.deepEqual(
    fieldKinds.map((row) => row.kind),
    ['height', 'lake', 'route'],
  );
  const point = { x: 999_944, y: 999_944 };
  const fieldHeight = heightAt(f.reader, f.source, point.x, point.y);
  assert.equal(
    fieldHeight,
    73,
    'field preparation retains heights anchored far outside the visible camera box',
  );
  assert.equal(
    f.reader.read(f.source, query).landscape.state,
    'error',
    'landscape reads must remain guarded until full preparation',
  );

  await f.reopen();
  assert(f.projection.valid('landscape-field', f.store.atlasRegionSource(f.token)));
  assert(!f.projection.valid('landscape', f.store.atlasRegionSource(f.token)));
  await f.sync('field');
  assert.equal(
    f.projection.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,
    3,
  );
  assert.equal(
    heightAt(f.reader, f.source, point.x, point.y),
    fieldHeight,
    'reopened field indexes retain the canonical offscreen height',
  );
  await f.sync('full');
  assert.equal(
    heightAt(f.reader, f.source, point.x, point.y),
    fieldHeight,
    'field and full preparation agree on physical height',
  );
  assert.equal(
    f.projection.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,
    6,
  );
  await f.sync('field');
  assert(
    f.projection.valid('landscape', f.source),
    'a field request after full readiness must keep the complete projection',
  );
  assert.doesNotThrow(() => f.reader.read(f.source, query));
});

test('height edits, Undo and Redo refresh field geometry heights on the next canonical source', async (t) => {
  const f = await fixture(t),
    record = heightRecord(999_936, 999_936, 4, new Float32Array(4096).fill(73));
  f.putDirect([record]);
  await f.sync('field');
  const at = { x: 999_944, y: 999_944 },
    read = () => heightAt(f.reader, f.source, at.x, at.y);
  assert.equal(read(), 73);
  const current = f.store.db
    .prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?')
    .get(f.campaign.id, record.id).revision;
  const raised = {
    ...record,
    height: heightRecord(
      record.height.x,
      record.height.y,
      record.height.pixel,
      new Float32Array(4096).fill(119),
    ).height,
  };
  f.command({ kind: 'landscape-put', expectedRevision: current, record: raised });
  await f.sync('field');
  assert.equal(read(), 119);
  f.command({ kind: 'undo' });
  await f.sync('field');
  assert.equal(read(), 73);
  f.command({ kind: 'redo' });
  await f.sync('field');
  assert.equal(read(), 119);
});

test('field membership follows physical category changes and Undo after reopening', async (t) => {
  const f = await fixture(t),
    lake = fieldRecords().find((record) => record.id === 'lake-field');
  f.putDirect([lake]);
  await f.sync('field');
  await f.reopen();
  await f.sync('field');
  const indexed = () =>
    f.projection
      .prepare('SELECT terrain_kind FROM temp.landscape_shape_bounds WHERE id=?')
      .get(lake.id)?.terrain_kind;
  const revision = () =>
    f.store.db
      .prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, lake.id).revision;
  assert.equal(indexed(), 'lake');
  const { surface, waterLevelM, ...dry } = lake;
  f.command({
    kind: 'landscape-put',
    expectedRevision: revision(),
    record: { ...dry, values: { terrain: 'forest' } },
  });
  await f.sync('field');
  assert.equal(
    indexed(),
    undefined,
    'nonphysical metadata must leave an already persisted field index',
  );
  f.command({ kind: 'undo' });
  await f.sync('field');
  assert.equal(indexed(), 'lake');
  f.command({ kind: 'redo' });
  await f.sync('field');
  assert.equal(indexed(), undefined);
  f.command({ kind: 'landscape-put', expectedRevision: revision(), record: lake });
  await f.sync('field');
  assert.equal(indexed(), 'lake');
  await f.sync('full');
  assert.equal(f.reader.read(f.source, query).landscape.state, 'ready');
});

test('full promotion rebuilds deferred canonical metadata even when the cursor has no new changes', async (t) => {
  const f = await fixture(t),
    records = fieldRecords();
  f.putDirect(records);
  await f.sync('field');
  const count = () =>
    f.projection.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n;
  assert.equal(count(), 3);
  // A deferred place-name change arrives through the canonical command stream.
  // Two field preparations accept that cursor; full promotion then sees no new
  // changes but must rebuild from the latest snapshot.
  const place = records.find((row) => row.id === 'place-field'),
    placeRevision = f.store.db
      .prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?')
      .get(f.campaign.id, place.id).revision;
  f.command({
    kind: 'landscape-put',
    expectedRevision: placeRevision,
    record: { ...place, name: 'Canonical new name' },
  });
  await f.sync('field');
  await f.sync('field');
  assert.equal(f.source.changes.length, 0);
  await f.sync('full');
  assert.equal(count(), 6);
  const name = f.projection
    .prepare(
      "SELECT json_extract(payload,'$.name') name FROM atlas_landscape WHERE id='place-field'",
    )
    .get();
  assert.equal(name.name, 'Canonical new name');
  const deferred = f.projection
    .prepare("SELECT kind FROM temp.landscape_shape_bounds WHERE id='place-field'")
    .get();
  assert.equal(deferred.kind, 'place');
  const promoted = f.reader.read(f.source, query).landscape;
  assert.equal(promoted.state, 'ready', promoted.error);
  assert(
    promoted.records.some(
      (record) => record.id === 'place-field' && record.name === 'Canonical new name',
    ),
  );
  const raster = promoted.tiles.find(
    (tile) =>
      tile.data.startsWith('data:image/png;base64,') &&
      tile.box.x <= 10 &&
      tile.box.x + tile.box.width >= 10 &&
      tile.box.y <= 10 &&
      tile.box.y + tile.box.height >= 10,
  );
  assert(raster, 'full promotion must render the deferred colour layer at the sampled point');
  const image = PNG.sync.read(
    Buffer.from(raster.data.slice('data:image/png;base64,'.length), 'base64'),
  );
  const px = Math.floor(((10 - raster.box.x) / raster.box.width) * raster.width),
    py = Math.floor(((10 - raster.box.y) / raster.box.height) * raster.height),
    offset = (py * image.width + px) * 4;
  assert(
    image.data[offset] > image.data[offset + 2],
    `expected red pigment at sample, found rgba ${[...image.data.slice(offset, offset + 4)]} in ${JSON.stringify({ box: raster.box, width: raster.width, height: raster.height, px, py })}`,
  );
});

test('rollback after failed promotion restores a usable field index and later full promotion', async (t) => {
  const f = await fixture(t),
    records = fieldRecords();
  f.putDirect(records);
  await f.sync('field');
  const at = { x: 999_944, y: 999_944 };
  assert.equal(heightAt(f.reader, f.source, at.x, at.y), 73);
  const mark = f.projection.mark.bind(f.projection);
  f.projection.mark = (part, source) => {
    if (part === 'landscape') throw Error('full promotion interrupted');
    return mark(part, source);
  };
  await f.sync('full');
  assert.throws(
    () => heightAt(f.reader, f.source, at.x, at.y),
    /Geländequelle konnte nicht gelesen werden/,
    'a failed promotion must invalidate readiness until recovery',
  );
  f.projection.mark = mark;
  await f.sync('full');
  assert.equal(heightAt(f.reader, f.source, at.x, at.y), 73);
});

test('field preparation still rejects malformed offscreen global metadata and invalid bounds', async (t) => {
  const f = await fixture(t),
    records = fieldRecords();
  f.putDirect([records[0], records.find((row) => row.id === 'base-field')]);
  f.store.db
    .prepare('UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id=?')
    .run('{broken', f.campaign.id, 'base-field');
  await f.sync('field');
  assert.throws(
    () => heightAt(f.reader, f.source, 999_944, 999_944),
    /Geländequelle konnte nicht gelesen werden/,
  );
  // A separate malformed bound must fail even when its source is far outside
  // every camera box; bounds are part of global source validation.
  const clean = await fixture(t),
    offscreen = fieldRecords()[0],
    excluded = fieldRecords().find((row) => row.id === 'base-field');
  clean.putDirect([offscreen, excluded]);
  clean.store.db
    .prepare('UPDATE atlas_landscape SET min_x=max_x+1 WHERE campaign_id=? AND id=?')
    .run(clean.campaign.id, excluded.id);
  await clean.sync('field');
  assert.throws(
    () => heightAt(clean.reader, clean.source, 999_944, 999_944),
    /Geländequelle konnte nicht gelesen werden/,
  );
});

test('outer rollback after successful landscape promotion cannot retain full readiness in JavaScript', async (t) => {
  const f = await fixture(t);
  f.putDirect(fieldRecords());
  await f.sync('field');
  const mark = f.projection.mark.bind(f.projection);
  f.projection.mark = (part, source) => {
    if (part === 'geometry') throw Error('geometry publication interrupted');
    return mark(part, source);
  };
  await assert.rejects(f.sync('full'), /geometry publication interrupted/);
  f.projection.mark = mark;
  assert(
    !f.projection.valid('landscape', f.source),
    'the enclosing rollback must remove the full landscape marker',
  );
  await f.sync('field');
  assert.equal(f.reader.geometryHeight(f.source, { x: 999_944, y: 999_944 }), 73);
  assert.equal(
    f.reader.read(f.source, query).landscape.state,
    'error',
    'rolled-back full readiness must not survive in JavaScript',
  );
  await f.sync('full');
  assert.equal(f.reader.read(f.source, query).landscape.state, 'ready');
});
