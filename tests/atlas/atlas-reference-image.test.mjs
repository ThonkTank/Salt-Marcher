import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { assertReferenceMapImage } from '../../tools/atlas-reference-fixture.mjs';

function twice(image) {
  const data = new Uint8Array(image.width * image.height * 16);
  for (let y = 0; y < image.height * 2; y++)
    for (let x = 0; x < image.width * 2; x++) {
      const source = (Math.floor(y / 2) * image.width + Math.floor(x / 2)) * 4;
      data.set(image.data.subarray(source, source + 4), (y * image.width * 2 + x) * 4);
    }
  return { width: image.width * 2, height: image.height * 2, data };
}

const frozen = (target) =>
  PNG.sync.read(
    readFileSync(
      new URL(`../fixtures/atlas/reference-images/width-${target}.png`, import.meta.url),
    ),
  );

test('each frozen map retains its populations and RGB error with single and doubled pixel footprints', () => {
  for (const target of [32768, 4096, 512, 64, 16]) {
    const expected = frozen(target);
    assert.deepEqual(
      assertReferenceMapImage(twice(expected), expected),
      assertReferenceMapImage(expected, expected),
    );
  }
});

test('native subpixel coverage is integrated before testing CSS-scale texture contrast', () => {
  const expected = { width: 1280, height: 852, data: new Uint8Array(1280 * 852 * 4) };
  for (let i = 0; i < expected.data.length; i += 4) expected.data.set([238, 229, 207, 255], i);
  for (let y = 300; y < 560; y++)
    for (let x = 600; x < 1000; x++)
      expected.data.set(x % 2 ? [150, 169, 125, 255] : [154, 174, 129, 255], (y * 1280 + x) * 4);
  const baseline = assertReferenceMapImage(expected, expected);
  assert(baseline.populations.forestTexture.expected > 10000);
  for (let phase = 0; phase < 4; phase++) {
    const actual = twice(expected),
      sampled = { ...expected, data: Uint8Array.from(expected.data) };
    for (let y = 300; y < 560; y++)
      for (let x = 601; x < 1000; x += 2) {
        // Two covered/darker subpixels and two uncovered/lighter subpixels
        // have exactly the reference pixel's mean. Each possible point phase
        // can miss that coverage entirely; none represents the CSS footprint.
        for (let p = 0; p < 4; p++) {
          const dark = p === (phase ^ 1) || p === (phase ^ 3),
            index = ((y * 2 + (p >> 1)) * actual.width + x * 2 + (p & 1)) * 4;
          actual.data.set(dark ? [146, 164, 121, 255] : [154, 174, 129, 255], index);
        }
        sampled.data.set([154, 174, 129, 255], (y * 1280 + x) * 4);
      }
    assert.throws(
      () => assertReferenceMapImage(sampled, expected),
      /Visible forest texture missing/,
    );
    assert.deepEqual(assertReferenceMapImage(actual, expected), baseline);
  }
});

test('Coverage integration still rejects flat forest, lost content classes and a blank map', () => {
  const expected = frozen(32768);
  for (const shade of [1, 0.88]) {
    const flat = twice(expected);
    for (let i = 0; i < flat.data.length; i += 4) {
      const luminance = flat.data[i + 1] / 174;
      // Remove only canopy shading in the frozen forest palette. Text/room
      // outlines and unrelated green geometry retain their original contrast.
      if (
        luminance >= 0.7 &&
        luminance <= 1.15 &&
        Math.abs(flat.data[i] - 154 * luminance) <= 5 &&
        Math.abs(flat.data[i + 2] - 129 * luminance) <= 5
      )
        flat.data.set(
          [154, 174, 129].map((v) => Math.round(v * shade)),
          i,
        );
    }
    assert.throws(() => assertReferenceMapImage(flat, expected), /Visible forest texture missing/);
  }
  for (const color of [[238, 229, 207], [154, 174, 129], [168, 130, 75], [91, 67, 56], null]) {
    const missing = twice(expected);
    for (let i = 0; i < missing.data.length; i += 4)
      if (
        color === null ||
        (color[0] === 154
          ? missing.data[i + 1] > missing.data[i] && missing.data[i + 1] > missing.data[i + 2]
          : color.every((value, c) => Math.abs(missing.data[i + c] - value) <= 4))
      )
        missing.data.set([129, 168, 185], i);
    assert.throws(
      () => assertReferenceMapImage(missing, expected),
      /Reference map changed|Visible .* missing/,
    );
  }
});

test('image comparison rejects captures outside its native scale contract', () => {
  const expected = frozen(64);
  assert.throws(
    () => assertReferenceMapImage({ ...expected, width: 1920, height: 1278 }, expected),
    /1× or 2× pixel footprint/,
  );
  assert.throws(
    () => assertReferenceMapImage({ ...expected, width: 2560 }, expected),
    /viewport aspect ratio/,
  );
});
