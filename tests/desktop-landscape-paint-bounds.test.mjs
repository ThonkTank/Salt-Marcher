import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/landscape-paint-bounds.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { CampaignStore, AtlasRegionReader } = require('../.build/landscape-paint-bounds.cjs');
function fixture(t, scan = false) {
  const dir = mkdtempSync(tmpdir() + '/landscape-paint-'),
    store = new CampaignStore(dir + '/workbench.sqlite'),
    campaign = store.create('Benannte Region'),
    w = store.activateShell(campaign.id),
    sql = [],
    db = new Database(store.filename, { readonly: true, verbose: (s) => sql.push(s) });
  if (scan) {
    const exec = db.exec.bind(db);
    db.exec = (s) => {
      if (s.includes('CREATE VIRTUAL TABLE temp.landscape_region_index'))
        throw Error('rtree unavailable');
      return exec(s);
    };
  }
  const reader = new AtlasRegionReader(db);
  let cursor;
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const put = (r) => {
    const xs = r.points.map((p) => p.x),
      ys = r.points.map((p) => p.y),
      pad = r.kind === 'place' ? 0 : r.width / 2;
    store.db
      .prepare('INSERT OR REPLACE INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)')
      .run(
        campaign.id,
        r.id,
        r.revision,
        Math.min(...xs) - pad,
        Math.max(...xs) + pad,
        Math.min(...ys) - pad,
        Math.max(...ys) + pad,
        JSON.stringify(r),
      );
  };
  const read = async (box) => {
    const source = store.atlasRegionSource(w.token, cursor);
    await reader.sync(source);
    cursor = { epoch: source.epoch, sequence: source.sequence };
    const q = {
      box,
      width: 512,
      height: 512,
      scopeId: 'local',
      floorId: 'ground',
      slice: null,
      roofs: true,
    };
    return { source, q, result: reader.read(source, q) };
  };
  return { store, campaign, w, db, sql, reader, put, read };
}
const place = (id, x, y, name = id) => ({
  id,
  revision: 1,
  kind: 'place',
  name,
  points: [{ x, y }],
  polygons: [],
  resolution: 1,
  width: 0,
  values: { description: 'PRIVATE AUTHOR TEXT' },
});
for (const scan of [false, true])
  test(
    'paint bounds keep place labels on both sides of tile edges without inventing exact hits' +
      (scan ? ' (scan)' : ''),
    async (t) => {
      const f = fixture(t, scan);
      f.put(place('left', 502, 250, 'Falkenbrück'));
      f.put(place('below', 800, 520, 'Nebelkloster'));
      f.put(place('far', 50000, 0));
      const first = await f.read({ x: 0, y: 0, width: 512, height: 512 }),
        right = await f.read({ x: 512, y: 0, width: 512, height: 512 });
      assert(first.result.landscape.records.some((r) => r.id === 'left'));
      assert(right.result.landscape.records.some((r) => r.id === 'left'));
      assert(right.result.landscape.records.some((r) => r.id === 'below'));
      assert(!right.result.landscape.records.some((r) => r.id === 'far'));
      assert(!JSON.stringify(right.result.landscape).includes('PRIVATE AUTHOR TEXT'));
      assert.equal(
        f.reader.candidatesAt(right.source, right.q, { x: 512, y: 235 }, 0, 'landscape').total,
        0,
        'paint reach is not a new hit priority or geometry',
      );
      assert.equal(f.store.atlasLandscapeObject(f.w.token, 'left').points[0].x, 502);
      const scans = f.sql.filter((s) => s.includes('max(length(CAST')).length;
      await f.read({ x: 512, y: 512, width: 512, height: 512 });
      assert.equal(
        f.sql.filter((s) => s.includes('max(length(CAST')).length,
        scans,
        'camera reads reuse the name envelope',
      );
    },
  );
test('canonical location renames grow the paint reach, removal and source reset retire it', async (t) => {
  const f = fixture(t),
    p = { ...place('named', 700, 250, 'A'), locationId: 'loc' },
    putName = (name) => {
      const payload = JSON.stringify({ id: 'loc', name, sections: [] });
      f.store.db
        .prepare(
          'INSERT INTO location VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=revision+1,payload=excluded.payload,checksum=excluded.checksum',
        )
        .run(
          f.campaign.id,
          'loc',
          1,
          0,
          payload,
          createHash('sha256').update(payload).digest('hex'),
        );
    };
  putName('A');
  f.put(p);
  const box = { x: 0, y: 0, width: 512, height: 512 };
  assert.equal((await f.read(box)).result.landscape.records.length, 0);
  putName('Nebelkloster jenseits der Furt');
  let r = await f.read(box);
  assert.equal(r.result.landscape.records[0].name, 'Nebelkloster jenseits der Furt');
  assert.equal(r.result.landscape.records[0].points[0].x, 700);
  f.store.db.prepare('DELETE FROM atlas_landscape WHERE id=?').run(p.id);
  const removed = await f.read(box);
  assert.equal(removed.result.landscape.records.length, 0);
  await f.reader.sync({ ...removed.source, reset: true });
  assert.equal(f.reader.read(removed.source, removed.q).landscape.records.length, 0);
});
test('minimum display strokes are read beyond canonical thin bounds and dense cached dots invalidate their paint reach', async (t) => {
  const f = fixture(t),
    line = {
      ...place('thin', 0, -0.75),
      kind: 'road',
      points: [
        { x: 0, y: -0.75 },
        { x: 512, y: -0.75 },
      ],
      width: 0.1,
    };
  f.put(line);
  assert(
    (await f.read({ x: 0, y: 0, width: 512, height: 512 })).result.landscape.records.some(
      (r) => r.id === 'thin',
    ),
  );
  f.store.db.prepare('DELETE FROM atlas_landscape').run();
  for (let i = 0; i < 501; i++) f.put(place('dense' + i, 100, 100));
  f.put(place('edge', -2, 200));
  let r = (await f.read({ x: 0, y: 0, width: 512, height: 512 })).result.landscape;
  assert.equal(r.coverage.mode, 'raster');
  const image = () => {
    const tile = r.tiles.find((t) => t.box.x === 0 && t.box.y === 0);
    const p = require('pngjs').PNG.sync.read(Buffer.from(tile.data.split(',')[1], 'base64'));
    return [
      ...p.data.slice(
        Math.floor((200 / tile.box.height) * p.height) * p.width * 4,
        (Math.floor((200 / tile.box.height) * p.height) * p.width + 3) * 4,
      ),
    ];
  };
  const before = image();
  assert(before.some((v) => v !== 0));
  f.store.db.prepare('DELETE FROM atlas_landscape WHERE id=?').run('edge');
  r = (await f.read({ x: 0, y: 0, width: 512, height: 512 })).result.landscape;
  assert(
    image().every((v) => v === 0),
    'cached adjacent tile must lose the removed off-tile dot',
  );
});
