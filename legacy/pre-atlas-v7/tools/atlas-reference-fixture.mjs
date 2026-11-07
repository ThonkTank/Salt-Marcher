import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const referenceCommit = '16eb0aa8807ac21704abfea5412ac3a22033a23a';
export const referencePath = 'tests/fixtures/atlas/mixed-world.sqlite.gz';
const format = JSON.parse(readFileSync(new URL('../src/app/data-format.json', import.meta.url)));
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

// Stored values include IDs, history, payload bytes and bindings. SQLite page
// layout and indexes are deliberately excluded from the content identity.
export function referenceContents(db) {
  return Object.fromEntries(
    format.tables.map((table) => {
      const columns = db
        .prepare(`PRAGMA table_info(${quote(table)})`)
        .all()
        .map((c) => quote(c.name));
      const hash = createHash('sha256');
      let count = 0;
      for (const row of db
        .prepare(`SELECT * FROM ${quote(table)} ORDER BY ${columns.join(',')}`)
        .iterate()) {
        hash.update(JSON.stringify(row) + '\n');
        count++;
      }
      return [table, { count, sha256: hash.digest('hex') }];
    }),
  );
}

export function assertReferenceInventory(db) {
  const count = (where) =>
    db.prepare(`SELECT count(*) n FROM atlas_landscape WHERE ${where}`).get().n;
  for (const [name, where, expected] of [
    ['height', "json_extract(payload,'$.height') IS NOT NULL", 1028],
    ['place', "json_extract(payload,'$.kind')='place'", 5000],
    ['road', "json_extract(payload,'$.kind')='road'", 1024],
    ['vegetation', "json_extract(payload,'$.kind')='vegetation'", 1024],
    [
      'continuous property areas',
      "json_extract(payload,'$.kind')='patch' AND json_extract(payload,'$.propertyOnly')=1",
      100000,
    ],
    ['obsolete terrain source cells', "json_extract(payload,'$.sourceCell') IS NOT NULL", 0],
  ])
    assert.equal(count(where), expected, `Reference world: ${name}`);
  assert.equal(
    db
      .prepare(
        "SELECT sum(json_array_length(payload,'$.cells')) n FROM world_record WHERE kind='map'",
      )
      .get().n,
    0,
    'Travel grids must not author terrain cells',
  );
  assert.equal(db.prepare('SELECT count(*) n FROM room_group').get().n, 5000);
  assert.equal(db.prepare('SELECT count(*) n FROM room').get().n, 15701);
  assert.equal(
    db.prepare("SELECT count(*) n FROM room WHERE scope_id='mixed-dungeon'").get().n,
    4001,
  );
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
}

export function assertReferenceContents(db, manifest) {
  assert.equal(manifest.model, 'continuous-terrain-v1');
  assert.equal(manifest.sourceCommit, referenceCommit);
  assert.equal(manifest.sourcePath, referencePath);
  assertReferenceInventory(db);
  assert.deepEqual(
    referenceContents(db),
    manifest.tables,
    'The complete reference world must retain its current continuous stored contents',
  );
}

// Compare a fixed map-only window in the original 1280×852 native captures.
// The sampler also accepts a 2× native-pixel footprint for coverage unit tests.
// Per-channel error tolerates raster/AA differences; palette populations ensure
// that a small road or marker cannot disappear inside a large background average.
export function assertReferenceMapImage(actual, expected, { markerVisible = true } = {}) {
  assert.equal(
    actual.width / expected.width,
    actual.height / expected.height,
    'Reference viewport aspect ratio',
  );
  const scale = actual.width / expected.width;
  assert([1, 2].includes(scale), 'Reference capture must use a 1× or 2× pixel footprint');
  if (scale === 2) {
    // A reference pixel covers one CSS pixel. Integrate its complete 2×2 native
    // footprint before measuring color or adjacent-pixel contrast. Selecting one
    // subpixel aliases AA coverage (especially text/room edges at close scales)
    // into missing green texture, even when the visible surface is unchanged.
    const data = new Uint8Array(expected.width * expected.height * 4);
    for (let y = 0; y < expected.height; y++)
      for (let x = 0; x < expected.width; x++) {
        const source = (y * 2 * actual.width + x * 2) * 4,
          target = (y * expected.width + x) * 4;
        for (let c = 0; c < 4; c++)
          data[target + c] = Math.round(
            (actual.data[source + c] +
              actual.data[source + 4 + c] +
              actual.data[source + actual.width * 4 + c] +
              actual.data[source + actual.width * 4 + 4 + c]) /
              4,
          );
      }
    actual = { width: expected.width, height: expected.height, data };
  }
  const colors = {
    land: [238, 229, 207],
    forest: [154, 174, 129],
    road: [168, 130, 75],
    marker: [91, 67, 56],
  };
  const populations = Object.fromEntries(
    Object.keys(colors).map((k) => [k, { expected: 0, actual: 0 }]),
  );
  populations.forestTexture = { expected: 0, actual: 0 };
  // This green-contrast guard also sees text/room outlines in close views; it
  // supplements forest coverage, rather than classifying semantic canopy pixels.
  const textureEdge = (image, i, j) => {
    const p = image.data;
    return (
      p[i + 1] > p[i] &&
      p[i + 1] > p[i + 2] &&
      p[j + 1] > p[j] &&
      p[j + 1] > p[j + 2] &&
      Math.max(...[0, 1, 2].map((c) => Math.abs(p[i + c] - p[j + c]))) >= 4
    );
  };
  let error = 0,
    pixels = 0;
  for (let y = 250; y < 610; y++)
    for (let x = 575; x < 1280; x++) {
      const a = (y * actual.width + x) * 4,
        b = (y * expected.width + x) * 4;
      for (let c = 0; c < 3; c++) error += Math.abs(actual.data[a + c] - expected.data[b + c]);
      for (const [key, color] of Object.entries(colors)) {
        const near = (image, i, rendered = false) => {
          // The overview road now blends at its visibility threshold. Preserve
          // the frozen reference population and allow only a small brown palette
          // shift in the rendered image (neither green forest nor bare land).
          if (key === 'road' && rendered)
            return color.every((v, c) => Math.abs(image.data[i + c] - v) <= 13);
          if (key !== 'forest') return color.every((v, c) => Math.abs(image.data[i + c] - v) <= 4);
          // Cartographic canopy modulates luminance, not forest coverage or hue.
          // Keep the frozen image and population threshold; accept only its green
          // palette along the bounded shading axis, never water or bare ground.
          const shade = image.data[i + 1] / color[1];
          return (
            shade >= 0.7 &&
            shade <= 1.15 &&
            Math.abs(image.data[i] - color[0] * shade) <= 5 &&
            Math.abs(image.data[i + 2] - color[2] * shade) <= 5
          );
        };
        if (near(expected, b)) populations[key].expected++;
        if (near(actual, a, true)) populations[key].actual++;
      }
      if (x < 1279) {
        const nextA = (y * actual.width + x + 1) * 4;
        const nextB = (y * expected.width + x + 1) * 4;
        if (textureEdge(expected, b, nextB)) populations.forestTexture.expected++;
        if (textureEdge(actual, a, nextA)) populations.forestTexture.actual++;
      }
      pixels++;
    }
  const meanChannelError = error / (pixels * 3);
  assert(meanChannelError <= 12, `Reference map changed: mean RGB error ${meanChannelError}`);
  for (const [key, p] of Object.entries(populations))
    if ((key !== 'marker' || markerVisible) && p.expected >= (key === 'marker' ? 4 : 100)) {
      assert(
        p.actual >= p.expected * 0.65,
        `Visible ${key === 'forestTexture' ? 'forest texture' : key} missing: ${JSON.stringify(p)}`,
      );
    }
  return { meanChannelError, populations };
}
