import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-geometry';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-base-span-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasLandscapeReader,
  emptyRecord,
  bounds,
} = require('../../.build/terrain-base-span-test.cjs');
function fixture(t) {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/terrain-base-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Base terrain index'),
    token = store.activateShell(campaign.id).token;
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const insert = store.db.prepare(
    'INSERT INTO atlas_landscape(rowid,campaign_id,id,revision,min_x,max_x,min_y,max_y,payload) VALUES(?,?,?,?,?,?,?,?,?)',
  );
  function patch(i, x = (i % 80) * 17.3, y = Math.floor(i / 80) * 19.7) {
    return {
      ...emptyRecord('patch'),
      id: 'base:' + i,
      resolution: 2 ** (i % 4),
      order: i % 3 ? i % 7 : undefined,
      values: { terrain: i % 2 ? 'forest' : 'desert' },
      polygons: [
        {
          outer: [
            { x, y },
            { x: x + 32, y },
            { x: x + 32, y: y + 28 },
            { x, y: y + 28 },
          ],
          holes: [],
        },
      ],
    };
  }
  function put(r, row) {
    const b = bounds(r);
    insert.run(
      String(row),
      campaign.id,
      r.id,
      1,
      b.x,
      b.x + b.width,
      b.y,
      b.y + b.height,
      JSON.stringify(r),
    );
  }
  store.db.transaction(() => {
    for (let i = 0; i < 4000; i++) put(patch(i), 9007199254740993n + BigInt(i));
  })();
  const db = new Database(store.filename, { readonly: true }),
    reader = new AtlasLandscapeReader(db);
  let source = store.atlasRegionSource(token);
  reader.sync(source);
  return {
    store,
    db,
    reader,
    patch,
    put,
    get source() {
      return source;
    },
    sync(ids) {
      source = ids
        ? { ...source, reset: false, changes: ids.map((id) => ({ table: 'atlas_landscape', id })) }
        : store.atlasRegionSource(token, source);
      reader.sync(source);
    },
    scan(box, samples) {
      return [...reader.terrainStream(source)('base', box, samples)];
    },
  };
}
const boxes = [
  { x: 30, y: 10, width: 145, height: 128 },
  { x: 123.456789, y: 234.56789, width: 0.00003, height: 0.00004 },
  { x: -100, y: -100, width: 2000, height: 1500 },
];
function refine(f) {
  const s = f.reader.colorSteps(f.source, {
    box: boxes[0],
    routeContext: boxes[0],
    width: 32,
    height: 32,
    displayMpp: 5,
    contours: 0,
    revision: f.source.revision,
    fence: f.source.fence,
  });
  while (!s.next().done) {}
}
function parity(f) {
  const definition = f.db
    .prepare("SELECT sql FROM temp.sqlite_master WHERE name='landscape_base_span'")
    .get().sql;
  for (const box of boxes)
    for (const samples of [undefined, { columns: 37, rows: 29 }]) {
      const actual = f.scan(box, samples);
      f.db.exec('DROP INDEX temp.landscape_base_span');
      const expected = f.scan(box, samples);
      f.db.exec(definition);
      assert.deepEqual(actual, expected);
    }
}
test('base refinement uses a covering spatial range without metadata probes and preserves exact 64-bit order and samples', (t) => {
  const f = fixture(t);
  f.scan(boxes[0]);
  assert.equal(
    f.db.prepare("SELECT name FROM temp.sqlite_master WHERE name='landscape_base_span'").get(),
    undefined,
    'overview does not construct the extra index',
  );
  refine(f);
  parity(f);
  const plans = [],
    programs = [],
    original = f.reader.sql.bind(f.reader);
  f.reader.sql = (sql) => {
    const st = original(sql);
    if (sql.startsWith('SELECT CAST(m.source_row'))
      return {
        iterate(...args) {
          plans.push(
            f.db
              .prepare('EXPLAIN QUERY PLAN ' + sql)
              .all(...args)
              .map((r) => r.detail)
              .join('\n'),
          );
          programs.push(f.db.prepare('EXPLAIN ' + sql).all(...args));
          return st.iterate(...args);
        },
      };
    return st;
  };
  f.scan(boxes[0], { columns: 37, rows: 29 });
  assert.match(
    plans[0],
    /USING COVERING INDEX landscape_base_span \(terrain_kind=\? AND max_x>\?\)/,
  );
  const root = f.db
    .prepare("SELECT rootpage FROM temp.sqlite_master WHERE name='landscape_shape_bounds'")
    .get().rootpage;
  assert(
    !programs[0].some((op) => op.opcode === 'OpenRead' && op.p2 === root && op.p3 === 1),
    'the VM must not open the metadata table; EXPLAIN QUERY PLAN alone can mislabel expression indexes as covering',
  );
});
test('base bounds, classification, deletion, insertion and full reset maintain the covering index automatically', (t) => {
  const f = fixture(t);
  refine(f);
  const moved = f.patch(1, -20, -20),
    b = bounds(moved);
  f.store.db
    .prepare('UPDATE atlas_landscape SET payload=?,min_x=?,max_x=?,min_y=?,max_y=? WHERE id=?')
    .run(JSON.stringify(moved), b.x, b.x + b.width, b.y, b.y + b.height, moved.id);
  f.store.db.prepare('DELETE FROM atlas_landscape WHERE id=?').run('base:0');
  const lake = { ...f.patch(2), values: {}, surface: 'freshwater', waterLevelM: 30 };
  f.store.db
    .prepare('UPDATE atlas_landscape SET payload=? WHERE id=?')
    .run(JSON.stringify(lake), lake.id);
  f.put(f.patch(5000, 20, 30), -42);
  f.sync(['base:0', 'base:1', 'base:2', 'base:5000']);
  parity(f);
  f.reader.sync({ ...f.source, reset: true });
  parity(f);
});
test('rolled-back index creation and metadata replacement remain readable without a separate JS readiness flag', (t) => {
  const f = fixture(t);
  f.db.exec('BEGIN');
  refine(f);
  f.db.exec('ROLLBACK');
  assert.equal(
    f.db.prepare("SELECT name FROM temp.sqlite_master WHERE name='landscape_base_span'").get(),
    undefined,
  );
  refine(f);
  const before = f.scan(boxes[0]);
  f.db.exec('BEGIN');
  f.db.exec("DELETE FROM temp.landscape_shape_bounds WHERE terrain_kind='base'");
  assert.equal(f.scan(boxes[0]).length, 0);
  f.db.exec('ROLLBACK');
  assert.deepEqual(f.scan(boxes[0]), before);
  parity(f);
});
