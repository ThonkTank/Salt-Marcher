import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/atlas/terrain-height.ts'],
  outfile: '.build/terrain-height-codec.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const core = require('../../.build/terrain-height-codec.cjs');
const browser = buildSync({
  entryPoints: ['src/app/atlas/terrain-height.ts'],
  write: false,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'heights',
}).outputFiles[0].text;
const browserCore = runInNewContext(browser + ';heights', { atob, btoa });
const tile = (data) => ({ version: 1, x: -64, y: 128, pixel: 1, data });
// The previous wire decoder is the oracle, independent of the optimized path.
function reference(data) {
  const raw = atob(data);
  if (raw.length !== 16384) throw Error('size');
  const view = new DataView(Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer);
  const result = new Float32Array(4096);
  for (let i = 0; i < result.length; i++) {
    const v = view.getFloat32(i * 4, true);
    if (!Number.isNaN(v) && (!Number.isFinite(v) || Math.abs(v) > 1e6)) throw Error('height');
    result[i] = v;
  }
  return result;
}
function equal(data) {
  let expected, error;
  try {
    expected = reference(data);
  } catch (e) {
    error = e;
  }
  for (const implementation of [core, browserCore]) {
    if (error) {
      assert.throws(() => implementation.decodeHeights(tile(data)));
      continue;
    }
    const actual = implementation.decodeHeights(tile(data));
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i++) assert(Object.is(actual[i], expected[i]), 'node ' + i);
  }
}
test('fixed height codec preserves little-endian values, NaNs, signed zero and subnormals in Node and renderer bundles', () => {
  let seed = 29;
  for (let n = 0; n < 12; n++) {
    const values = Float32Array.from({ length: 4096 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 2 ** 32 - 0.5) * 2e6;
    });
    values.set([NaN, -0, 0, 1e6, -1e6, 2 ** -149, -(2 ** -149)]);
    const data = core.encodeHeights(values);
    assert.equal(data, Buffer.from(values.buffer).toString('base64'));
    equal(data);
  }
});
test('existing atob-compatible padding and whitespace retain their exact decoding behavior', () => {
  const data = core.encodeHeights(new Float32Array(4096).fill(123));
  equal(data);
  for (const ws of ['  ', '\n\t', '\r\n', '\f ']) equal(ws + data.slice(0, -2));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    last = alphabet.indexOf(data.at(-3));
  for (let low = 0; low < 16; low++) equal(data.slice(0, -3) + alphabet[(last & 48) | low] + '==');
});
test('malformed alphabet, lengths, padding and invalid height values still fail closed', () => {
  const data = core.encodeHeights(new Float32Array(4096));
  for (const at of [0, 3, 101, 21843, 21844, 21845])
    for (const char of ['!', 'é', 'Ā', '\uFFFF', '='])
      equal(data.slice(0, at) + char + data.slice(at + 1));
  for (const suffix of ['AA', 'A=', '=A', 'é=']) equal(data.slice(0, -2) + suffix);
  for (const value of [Infinity, -Infinity, 1e6 + 1, -1e6 - 1]) {
    const bytes = Buffer.alloc(16384);
    bytes.writeFloatLE(value, 16380);
    equal(bytes.toString('base64'));
  }
  for (const impl of [core, browserCore]) {
    for (const short of [data.slice(1), data + 'A'])
      assert.throws(() => impl.decodeHeights(tile(short)));
  }
});
