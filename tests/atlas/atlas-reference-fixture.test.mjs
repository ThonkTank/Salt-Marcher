import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import {
  assertReferenceContents,
  assertReferenceInventory,
  assertReferenceMapImage,
} from '../../tools/atlas-reference-fixture.mjs';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { PNG } = require('pngjs');
const manifest = JSON.parse(
  readFileSync(new URL('../fixtures/atlas/mixed-world-manifest.json', import.meta.url)),
);
const fixture = () =>
  gunzipSync(readFileSync(new URL('../fixtures/atlas/mixed-world.sqlite.gz', import.meta.url)));
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store'; export {validateBackupCandidate} from './src/app/storage/snapshot-validation';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/reference-fixture-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  validateBackupCandidate,
} = require('../../.build/reference-fixture-store.cjs');

test('complete reference world retains every current canonical row through current-store reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-reference-test-')),
    file = join(dir, 'world.sqlite');
  let store;
  try {
    writeFileSync(file, fixture());
    validateBackupCandidate(file);
    for (let i = 0; i < 2; i++) {
      store = new CampaignStore(file);
      assert.equal(store.db.pragma('user_version', { simple: true }), 55);
      assertReferenceContents(store.db, manifest);
      store.close();
      store = null;
    }
  } finally {
    store?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('full canonical fixture validation rejects a malformed preset even when its complete inventory remains present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-reference-value-test-')),
    file = join(dir, 'world.sqlite');
  let db;
  try {
    writeFileSync(file, fixture());
    db = new Database(file);
    db.prepare(
      "UPDATE atlas_landscape SET payload=json_remove(payload,'$.vegetation.preset.waterDepth') WHERE id=(SELECT id FROM atlas_landscape WHERE json_extract(payload,'$.kind')='vegetation' ORDER BY id LIMIT 1)",
    ).run();
    assertReferenceInventory(db);
    assert.throws(() => validateBackupCandidate(file));
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reference validation rejects each lost map-content class and a same-count payload change', () => {
  const raw = fixture();
  raw[18] = raw[19] = 1;
  const db = new Database(raw);
  try {
    for (const where of [
      "json_extract(payload,'$.height') IS NOT NULL",
      ...['place', 'road', 'vegetation'].map((k) => `json_extract(payload,'$.kind')='${k}'`),
    ]) {
      db.exec('SAVEPOINT mutation');
      db.prepare('DELETE FROM atlas_landscape WHERE ' + where).run();
      assert.throws(() => assertReferenceInventory(db), /Reference world:/);
      db.exec('ROLLBACK TO mutation; RELEASE mutation');
    }
    db.prepare(
      "UPDATE atlas_landscape SET payload=json_set(payload,'$.name','missing original name') WHERE id='world-place:0'",
    ).run();
    assert.throws(() => assertReferenceContents(db, manifest), /complete reference world/);
  } finally {
    db.close();
  }
});

test('native map oracle accepts its baseline and rejects the formerly passing water-only map', () => {
  const images = JSON.parse(
    readFileSync(new URL('../fixtures/atlas/reference-images/manifest.json', import.meta.url)),
  );
  assert.equal(images.sourceCommit, manifest.sourceCommit);
  assert.equal(images.model, manifest.model);
  assert.equal(images.fixtureSha256, manifest.fixtureSha256);
  for (const view of images.views) {
    const bytes = readFileSync(
      new URL(`../fixtures/atlas/reference-images/width-${view.target}.png`, import.meta.url),
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex'), view.imageSha256);
  }
  const expected = PNG.sync.read(
    readFileSync(new URL('../fixtures/atlas/reference-images/width-32768.png', import.meta.url)),
  );
  const baseline = assertReferenceMapImage(expected, expected);
  for (const [key, minimum] of Object.entries({
    land: 1000,
    forest: 100,
    forestTexture: 100,
    road: 100,
    marker: 4,
  }))
    assert(baseline.populations[key].expected >= minimum, `Frozen oracle lacks visible ${key}`);
  const shaded = { ...expected, data: Buffer.from(expected.data) };
  for (let i = 0; i < shaded.data.length; i += 4)
    if ([154, 174, 129].every((v, c) => Math.abs(expected.data[i + c] - v) <= 4))
      for (let c = 0; c < 3; c++) shaded.data[i + c] = Math.round(shaded.data[i + c] * 0.88);
  const accepted = assertReferenceMapImage(shaded, expected);
  assert(
    accepted.populations.forest.actual >= baseline.populations.forest.expected * 0.95,
    'shading retains the frozen forest footprint',
  );
  for (const shade of [1, 0.88]) {
    const flat = { ...expected, data: Buffer.from(expected.data) };
    for (let i = 0; i < flat.data.length; i += 4)
      if (expected.data[i + 1] > expected.data[i] && expected.data[i + 1] > expected.data[i + 2])
        flat.data.set(
          [154, 174, 129].map((v) => Math.round(v * shade)),
          i,
        );
    assert.throws(
      () => assertReferenceMapImage(flat, expected),
      /Visible forest texture missing/,
      'Flat forest fill must not replace canopy texture',
    );
  }
  const blendedRoad = { ...expected, data: Buffer.from(expected.data) };
  for (let i = 0; i < blendedRoad.data.length; i += 4)
    if ([168, 130, 75].every((v, c) => Math.abs(expected.data[i + c] - v) <= 4)) {
      blendedRoad.data.set([165, 134, 83], i);
    }
  assertReferenceMapImage(blendedRoad, expected);
  // A road replaced by its forest background must fail even when that
  // background is shaded; the widened brown palette cannot mask its loss.
  for (let i = 0; i < blendedRoad.data.length; i += 4)
    if ([168, 130, 75].every((v, c) => Math.abs(expected.data[i + c] - v) <= 4))
      blendedRoad.data.set([140, 147, 114], i);
  assert.throws(() => assertReferenceMapImage(blendedRoad, expected), /Visible road missing/);
  for (const color of [
    [238, 229, 207],
    [154, 174, 129],
    [168, 130, 75],
    [91, 67, 56],
  ]) {
    const missing = { ...expected, data: Buffer.from(expected.data) };
    for (let i = 0; i < missing.data.length; i += 4)
      if (
        color[0] === 154
          ? expected.data[i + 1] > expected.data[i] && expected.data[i + 1] > expected.data[i + 2]
          : color.every((v, c) => Math.abs(expected.data[i + c] - v) <= 4)
      ) {
        missing.data[i] = 129;
        missing.data[i + 1] = 168;
        missing.data[i + 2] = 185;
      }
    assert.throws(
      () => assertReferenceMapImage(missing, expected),
      /Reference map changed|Visible .* missing/,
      'Removing visible palette ' + color.join(','),
    );
  }
  const blank = { ...expected, data: Buffer.from(expected.data) };
  for (let i = 0; i < blank.data.length; i += 4) {
    blank.data[i] = 129;
    blank.data[i + 1] = 168;
    blank.data[i + 2] = 185;
  }
  assert.throws(() => assertReferenceMapImage(blank, expected), /Reference map changed/);
});
