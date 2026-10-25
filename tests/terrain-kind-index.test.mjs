import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export * from './src/app/terrain-route';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  outfile: '.build/terrain-kind-index-test.cjs',
});
const {
  CampaignStore,
  AtlasLandscapeReader,
  bounds,
  emptyRecord,
  heightRecord,
  routeSpec,
} = require('../.build/terrain-kind-index-test.cjs');
const kinds = ['height', 'route', 'lake'];
const polygon = {
  outer: [
    { x: 0, y: 0 },
    { x: 64, y: 0 },
    { x: 64, y: 64 },
    { x: 0, y: 64 },
  ],
  holes: [],
};
function record(kind, id, i = 0) {
  const resolution = 2 ** (i % 4),
    order = i % 3 ? i % 7 : undefined;
  if (kind === 'height')
    return { ...heightRecord(0, 0, resolution, new Float32Array(4096).fill(i)), id, order };
  if (kind === 'route') {
    const points = [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
    ];
    return {
      ...emptyRecord('road'),
      id,
      points,
      route: routeSpec('road', points),
      resolution,
      order,
    };
  }
  return {
    ...emptyRecord('patch'),
    id,
    polygons: [polygon],
    resolution,
    order,
    ...(kind === 'lake'
      ? { surface: 'freshwater', waterLevelM: 30 }
      : { values: { terrain: 'forest' } }),
  };
}
test('sparse terrain kinds use covering ordered indexes and preserve exact streams through metadata changes', (t) => {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/terrain-kind-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Sparse terrain kinds'),
    token = store.activate(campaign.id).token,
    writer = store.db,
    db = new (require('better-sqlite3'))(store.filename, { readonly: true });
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const insert = writer.prepare(
    'INSERT INTO atlas_landscape(rowid,campaign_id,id,revision,min_x,max_x,min_y,max_y,payload) VALUES(?,?,?,?,?,?,?,?,?)',
  );
  let row = 9007199254740993n;
  const put = (r) => {
    const b = bounds(r);
    insert.run(
      (row++).toString(),
      campaign.id,
      r.id,
      1,
      b.x,
      b.x + b.width,
      b.y,
      b.y + b.height,
      JSON.stringify(r),
    );
  };
  writer.transaction(() => {
    for (let i = 0; i < 10000; i++) put(record('base', `base:${i}`));
    for (let i = 0; i < 133; i++) for (const kind of kinds) put(record(kind, `${kind}:${i}`, i));
  })();
  const reader = new AtlasLandscapeReader(db);
  let source = store.atlasRegionSource(token);
  reader.sync(source);
  const plans = [],
    programs = [],
    sql = reader.sql.bind(reader);
  reader.sql = (text) => {
    const statement = sql(text);
    return /^SELECT CAST\((m\.)?source_row AS TEXT\)/.test(text)
      ? {
          iterate(...args) {
            plans.push(
              db
                .prepare('EXPLAIN QUERY PLAN ' + text)
                .all(...args)
                .map((r) => r.detail)
                .join('\n'),
            );
            programs.push(db.prepare('EXPLAIN ' + text).all(...args));
            return statement.iterate(...args);
          },
        }
      : statement;
  };
  const metadataRoot = db
    .prepare("SELECT rootpage FROM temp.sqlite_master WHERE name='landscape_shape_bounds'")
    .get().rootpage;
  const box = { x: -300, y: -300, width: 1000, height: 1000 };
  function check() {
    for (const kind of kinds) {
      for (const samples of [undefined, { columns: 31, rows: 27 }]) {
        const actual = [...reader.terrainStream(source)(kind, box, samples)],
          plan = plans.at(-1);
        assert.match(plan, new RegExp('USING COVERING INDEX landscape_' + kind + '_order'));
        assert.doesNotMatch(
          plan,
          /USE TEMP B-TREE/,
          'canonical order should stream directly from the sparse index',
        );
        assert(
          !programs
            .at(-1)
            .some((op) => op.opcode === 'OpenRead' && op.p2 === metadataRoot && op.p3 === 1),
          'rejecting candidates must not open the metadata table, even for expression indexes',
        );
        const definition = db
          .prepare('SELECT sql FROM temp.sqlite_master WHERE name=?')
          .get('landscape_' + kind + '_order').sql;
        db.exec('DROP INDEX temp.landscape_' + kind + '_order');
        const expected = [...reader.terrainStream(source)(kind, box, samples)];
        db.exec(definition);
        assert.deepEqual(actual, expected, `${kind} order, payloads and sample support`);
      }
    }
    // The decoded-height path selects bounds too. Check its actual SQL program,
    // not just the canonical-record stream used by the equality oracle above.
    for (const area of [
      box,
      { x: 61.123, y: 63.75, width: 2.5, height: 0.25 },
      { x: 10000, y: 10000, width: 100, height: 100 },
    ]) {
      const read = () =>
        [...reader.terrainStream(source).heightSources(area, { columns: 13, rows: 17 })].map(
          (s) => ({ version: s.version, x: s.x, y: s.y, pixel: s.pixel, values: s.read() }),
        );
      const actual = read();
      assert.match(plans.at(-1), /USING COVERING INDEX landscape_height_order/);
      assert(
        !programs
          .at(-1)
          .some((op) => op.opcode === 'OpenRead' && op.p2 === metadataRoot && op.p3 === 1),
      );
      const definition = db
        .prepare("SELECT sql FROM temp.sqlite_master WHERE name='landscape_height_order'")
        .get().sql;
      db.exec('DROP INDEX temp.landscape_height_order');
      const expected = read();
      db.exec(definition);
      assert.deepEqual(actual, expected);
    }
  }
  check();
  const changed = record('lake', 'height:0', 5),
    b = bounds(changed);
  writer
    .prepare('UPDATE atlas_landscape SET payload=?,min_x=?,max_x=?,min_y=?,max_y=? WHERE id=?')
    .run(JSON.stringify(changed), b.x, b.x + b.width, b.y, b.y + b.height, changed.id);
  writer.prepare('DELETE FROM atlas_landscape WHERE id=?').run('route:0');
  put(record('height', 'new-height', 7));
  source = {
    ...source,
    reset: false,
    revision: source.revision + 1,
    changes: [changed.id, 'route:0', 'new-height'].map((id) => ({ table: 'atlas_landscape', id })),
  };
  reader.sync(source);
  check();
  assert([...reader.terrainStream(source)('lake', box)].some((r) => r.id === 'height:0'));
  assert(![...reader.terrainStream(source)('height', box)].some((r) => r.id === 'height:0'));
  assert(![...reader.terrainStream(source)('route', box)].some((r) => r.id === 'route:0'));
  assert([...reader.terrainStream(source)('height', box)].some((r) => r.id === 'new-height'));
  reader.sync({ ...source, reset: true });
  check();
});
test('terrain line reads skip place and vegetation payloads while preserving painter order through kind changes and deletion', (t) => {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/terrain-lines-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Terrain lines'),
    token = store.activate(campaign.id).token,
    writer = store.db,
    db = new (require('better-sqlite3'))(store.filename, { readonly: true });
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const insert = writer.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  const put = (r) => {
    const b = bounds(r);
    insert.run(campaign.id, r.id, 1, b.x, b.x + b.width, b.y, b.y + b.height, JSON.stringify(r));
  };
  writer.transaction(() => {
    for (let i = 0; i < 2000; i++)
      put({
        ...emptyRecord(i % 2 ? 'place' : 'vegetation'),
        id: 'other:' + i,
        points: [{ x: 0, y: 0 }],
        width: 2,
        polygons: [polygon],
      });
    for (let i = 0; i < 25; i++)
      put({
        ...record('route', 'line:' + i, i),
        kind: i % 3 ? 'road' : 'river',
        line: { overSymbols: i % 2 === 0 },
      });
  })();
  const reader = new AtlasLandscapeReader(db);
  let source = store.atlasRegionSource(token);
  reader.sync(source);
  const box = { x: -100, y: -100, width: 500, height: 500 };
  const selected = [],
    plans = [],
    sql = reader.sql.bind(reader);
  reader.sql = (text) => {
    const st = sql(text);
    if (text.includes('FROM json_each(?) ids CROSS JOIN atlas_landscape'))
      return {
        iterate(ids, ...args) {
          selected.push(...JSON.parse(ids));
          return st.iterate(ids, ...args);
        },
      };
    if (text.includes("m.kind IN ('road','river')"))
      return {
        iterate(...args) {
          plans.push(
            db
              .prepare('EXPLAIN QUERY PLAN ' + text)
              .all(...args)
              .map((r) => r.detail)
              .join('\n'),
          );
          return st.iterate(...args);
        },
      };
    return st;
  };
  const check = () => {
    const expected = [...reader.rows(source, box, false)].filter(
      (r) => r.kind === 'road' || r.kind === 'river',
    );
    selected.length = 0;
    const actual = [...reader.terrainStream(source)('line', box)];
    assert.deepEqual(actual, expected);
    assert.equal(selected.length, actual.length);
    assert.match(plans.at(-1), /USING INDEX landscape_line_span/);
    for (const id of selected)
      assert.match(
        db
          .prepare("SELECT json_extract(payload,'$.kind') kind FROM atlas_landscape WHERE rowid=?")
          .get(id).kind,
        /^(road|river)$/,
      );
    return actual;
  };
  assert.equal(check().length, 25);
  const changed = { ...record('route', 'other:0'), kind: 'river' };
  writer
    .prepare('UPDATE atlas_landscape SET payload=? WHERE id=?')
    .run(JSON.stringify(changed), changed.id);
  writer.prepare('DELETE FROM atlas_landscape WHERE id=?').run('line:0');
  source = {
    ...source,
    reset: false,
    changes: [
      { table: 'atlas_landscape', id: 'other:0' },
      { table: 'atlas_landscape', id: 'line:0' },
    ],
  };
  reader.sync(source);
  const next = check();
  assert.equal(next.length, 25);
  assert(next.some((r) => r.id === 'other:0'));
  assert(!next.some((r) => r.id === 'line:0'));
});
