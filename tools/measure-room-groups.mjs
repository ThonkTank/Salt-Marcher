// Real canonical generation, cold reopen and bounded Atlas read of furnished houses.
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  entryPoints: ['src/app/storage/store.ts', 'src/app/storage/atlas-region.ts'],
  outdir: '.build/room-group-scale',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  outExtension: { '.js': '.cjs' },
});
const { CampaignStore } = require('../.build/room-group-scale/store.cjs'),
  { AtlasRegionReader } = require('../.build/room-group-scale/atlas-region.cjs');
const count = Number(process.env.GROUP_COUNT ?? 5000),
  dir = mkdtempSync('/tmp/salt-room-group-scale-'),
  evidence = { count, timings: {}, counts: {}, regions: {} };
let store, db;
const timed = async (name, fn) => {
  const start = performance.now();
  const result = await fn();
  evidence.timings[name] = Math.round(performance.now() - start);
  return result;
};
try {
  store = new CampaignStore(dir + '/workbench.sqlite');
  const cam = store.create('Eingerichtete Stadt');
  let shell = store.activateShell(cam.id);
  const write = (action) => {
    const commandId = randomUUID();
    if (action.command) action.command.commandId = commandId;
    return store.executeAtlasCommit({ commandId, token: shell.token, campaignId: cam.id, action });
  };
  const city = write({
    kind: 'city-create',
    name: '5000 Häuser',
    x: 0,
    y: 0,
    width: 4000,
    height: 4000,
  }).result.id;
  const units = Array.from({ length: count }, (_, i) => {
    const large = i % 20 === 0,
      width = large ? 16 : 6,
      depth = large ? 18 : 6;
    return {
      id: 'house-' + i,
      kind: 'building',
      name: 'Haus ' + i,
      protected: false,
      position: { x: 30 + (i % 100) * 30, y: 30 + Math.floor(i / 100) * 30 },
      angle: 0,
      outline: [
        { x: -width / 2, y: -depth / 2 },
        { x: width / 2, y: -depth / 2 },
        { x: width / 2, y: depth / 2 },
        { x: -width / 2, y: depth / 2 },
      ],
      use: large ? 'Taverne' : 'Wohnhaus',
      notes: '',
      groupRecipe: {
        version: 1,
        profile: large ? 'Taverne' : 'Wohnhaus',
        seed: 'house-' + i,
        width,
        depth,
      },
    };
  });
  await timed('generateMs', () =>
    write({
      kind: 'city',
      command: {
        token: shell.token,
        campaignId: cam.id,
        cityId: city,
        expectedRevision: store.city(shell.token, city).header.revision,
        action: {
          kind: 'change',
          upsert: units,
          remove: [],
          label: 'Eingerichtete Häuser erzeugen',
        },
      },
    }),
  );
  for (const table of ['room_group', 'room', 'drawing_element', 'drawing_floor', 'atlas_entrance'])
    evidence.counts[table] = store.db.prepare('SELECT count(*) n FROM ' + table).get().n;
  assert.equal(evidence.counts.room_group, count);
  assert(evidence.counts.room > count);
  assert(evidence.counts.drawing_element > count * 2);
  store.close();
  store = null;
  await timed('freshOpenMs', () => {
    store = new CampaignStore(dir + '/workbench.sqlite');
    shell = store.activateShell(cam.id);
  });
  assert.equal(store.db.prepare('SELECT count(*) n FROM room_group').get().n, count);
  db = new Database(dir + '/workbench.sqlite', { readonly: true });
  const reader = new AtlasRegionReader(db),
    source = store.atlasRegionSource(shell.token);
  await timed('coldIndexMs', () => reader.sync(source));
  for (const [name, box] of [
    ['overview', { x: 0, y: 0, width: 3100, height: 1600 }],
    ['detail', { x: 18, y: 18, width: 24, height: 24 }],
  ]) {
    const region = await timed(name + 'ReadMs', () =>
      reader.read(source, {
        box,
        width: 1024,
        height: 768,
        scopeId: name === 'detail' ? 'house-0' : null,
        floorId: 'ground',
        slice: null,
        roofs: name === 'overview',
      }),
    );
    const bytes = Buffer.byteLength(JSON.stringify(region));
    assert(region.coverage.complete);
    assert(bytes <= 2 * 1024 * 1024);
    evidence.regions[name] = {
      bytes,
      mode: region.coverage.mode,
      rooms: region.rooms.length,
      elements: region.elements?.length,
    };
  }
  evidence.rssMiB = Math.round(process.memoryUsage().rss / 1048576);
  console.log(JSON.stringify(evidence, null, 2));
  mkdirSync('.build/room-group-scale', { recursive: true });
  writeFileSync('.build/room-group-scale/result.json', JSON.stringify(evidence, null, 2));
} finally {
  db?.close();
  store?.close();
  rmSync(dir, { recursive: true, force: true });
}
