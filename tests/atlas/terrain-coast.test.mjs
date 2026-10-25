import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: { resolveDir: process.cwd(), contents: "export * from './src/app/atlas/terrain-coast';" },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: '.build/terrain-coast-test.cjs',
});
const { paintTerrainCoast } = createRequire(import.meta.url)('../../.build/terrain-coast-test.cjs');
const drain = (g) => {
  for (const _ of g) {
  }
};
// The selected visual prototype retained the old two-pass distance transform,
// but used a narrow 1.5-sample ramp, .85 opacity and no broad shore halo.
function prototype(samples, water, w, h, pad) {
  const result = samples.slice(),
    distance = new Uint8Array(w * h).fill(24);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        v = water[i];
      if (v !== water[i - 1] || v !== water[i + 1] || v !== water[i - w] || v !== water[i + w])
        distance[i] = 1;
    }
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      distance[i] = Math.min(
        distance[i],
        distance[i - 1] + 2,
        distance[i - w] + 2,
        distance[i - w - 1] + 3,
        distance[i - w + 1] + 3,
      );
    }
  for (let y = h - 2; y > 0; y--)
    for (let x = w - 2; x > 0; x--) {
      const i = y * w + x;
      distance[i] = Math.min(
        distance[i],
        distance[i + 1] + 2,
        distance[i + w] + 2,
        distance[i + w - 1] + 3,
        distance[i + w + 1] + 3,
      );
    }
  for (let y = pad; y < h - pad; y++)
    for (let x = pad; x < w - pad; x++) {
      const i = y * w + x,
        alpha = Math.max(0, Math.min(1, 1.5 - distance[i] / 2)) * 0.85;
      if (!alpha) continue;
      const at = i * 4,
        old = result[at + 3] / 255,
        total = alpha + old * (1 - alpha);
      for (let c = 0; c < 3; c++)
        result[at + c] = Math.round(
          ([104, 86, 57][c] * alpha + result[at + c] * old * (1 - alpha)) / total,
        );
      result[at + 3] = Math.round(total * 255);
    }
  return result;
}
test('coast is confined to one supersample on either side, preserves water decisions and skips the halo', () => {
  const w = 20,
    h = 20,
    water = Uint8Array.from({ length: w * h }, (_, i) => (i % w < 10 ? 1 : 0)),
    before = water.slice(),
    pixels = new Uint8Array(w * h * 4).fill(255);
  drain(paintTerrainCoast(pixels, water, w, h, 2, function* () {}));
  assert.deepEqual(water, before);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4,
        edge = y >= 2 && y < h - 2 && (x === 9 || x === 10);
      assert.deepEqual(
        [...pixels.subarray(i, i + 4)],
        edge ? [127, 111, 87, 255] : [255, 255, 255, 255],
      );
    }
});
test('direct neighbours reproduce selected prototype pixels for oblique shores, islands, holes and transparent maps', () => {
  const w = 67,
    h = 83,
    pad = 7;
  for (const shape of [
    (x, y) => x > y,
    (x, y) => (x - 32) ** 2 + (y - 40) ** 2 < 25 ** 2,
    (x, y) => (x - 32) ** 2 + (y - 40) ** 2 < 25 ** 2 && (x - 32) ** 2 + (y - 40) ** 2 > 10 ** 2,
    (x, y) => Math.sin(x * 0.2) + Math.cos(y * 0.3) > 0,
  ]) {
    const water = Uint8Array.from({ length: w * h }, (_, i) =>
        shape(i % w, Math.floor(i / w)) ? 1 : 0,
      ),
      pixels = Uint8Array.from({ length: w * h * 4 }, (_, i) => (i * 131) % 256),
      expected = prototype(pixels, water, w, h, pad);
    drain(paintTerrainCoast(pixels, water, w, h, pad, function* () {}));
    assert.deepEqual(pixels, expected);
  }
});
test('homogeneous tiles do no work; mixed coast work yields with only owned arrays', () => {
  for (const value of [0, 1]) {
    const pixels = new Uint8Array(128 * 128 * 4).fill(171);
    let steps = 0;
    drain(
      paintTerrainCoast(pixels, new Uint8Array(128 * 128).fill(value), 128, 128, 16, function* () {
        steps++;
        yield;
      }),
    );
    assert.equal(steps, 0);
    assert(pixels.every((v) => v === 171));
  }
  const water = Uint8Array.from({ length: 128 * 128 }, (_, i) => (i % 128 < 64 ? 1 : 0)),
    a = new Uint8Array(128 * 128 * 4).fill(255),
    b = a.slice();
  let steps = 0;
  drain(
    paintTerrainCoast(a, water, 128, 128, 16, function* () {
      steps++;
      yield;
    }),
  );
  drain(paintTerrainCoast(b, water, 128, 128, 16, function* () {}));
  assert.equal(steps, 6);
  assert.deepEqual(a, b);
});
