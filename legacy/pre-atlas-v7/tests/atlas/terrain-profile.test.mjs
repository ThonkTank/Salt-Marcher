import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-profile';export * from './src/app/atlas/terrain-height';export * from './src/app/storage/store';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-profile-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { terrainProfile, heightRecord, CampaignStore } = createRequire(import.meta.url)(
  '../../.build/terrain-profile-test.cjs',
);
const hill = (rise) =>
  heightRecord(
    0,
    0,
    1,
    Float32Array.from(
      { length: 4096 },
      (_, i) => 100 + rise + (i % 64) * 0.5 + Math.floor(i / 64) * 0.25,
    ),
  );
const points = [
  { x: 10, y: 10 },
  { x: 30, y: 10 },
  { x: 10, y: 10 },
];
test('profile measures a known slope and return path without changing authored geometry', () => {
  const records = [hill(0)],
    before = JSON.stringify(records),
    p = terrainProfile(records, points);
  assert.equal(p.distanceM, 40);
  assert(Math.abs(p.ascentM - 10) < 1e-7);
  assert(Math.abs(p.descentM - 10) < 1e-7);
  assert(
    Math.abs(p.samples[10].slopeDegrees - (Math.atan(Math.hypot(0.5, 0.25)) * 180) / Math.PI) <
      1e-7,
  );
  assert(p.samples.length <= 384);
  assert.equal(JSON.stringify(records), before);
  assert.throws(() => terrainProfile(records, [points[0], points[0]]), /verschiedene/);
  assert.throws(() => terrainProfile(records, [points[0], { x: NaN, y: 0 }]), /gültige/);
});
test('main profile read follows confirmed terrain revisions and rejects a stale workspace token', (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-profile-'),
    store = new CampaignStore(dir + '/world.sqlite');
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const cam = store.create('Profil'),
    token = store.activate(cam.id).token;
  const write = (action) =>
    store.executeAtlasCommit({ campaignId: cam.id, token, commandId: randomUUID(), action });
  write({ kind: 'landscape-put', record: hill(0), expectedRevision: null });
  const before = store.db.serialize(),
    profile = store.atlasTerrainProfile(token, points);
  assert(store.db.serialize().equals(before));
  assert.equal(profile.samples[0].heightM, store.atlasHeight(token, points[0]).heightM);
  write({ kind: 'landscape-put', record: hill(20), expectedRevision: 1 });
  const changed = store.atlasTerrainProfile(token, points);
  assert(changed.revision > profile.revision);
  assert.equal(changed.samples[0].heightM - profile.samples[0].heightM, 20);
  write({ kind: 'undo' });
  assert.equal(
    store.atlasTerrainProfile(token, points).samples[0].heightM,
    profile.samples[0].heightM,
  );
  store.activate(store.create('Andere Kampagne').id);
  assert.throws(() => store.atlasTerrainProfile(token, points), /früheren/);
});
