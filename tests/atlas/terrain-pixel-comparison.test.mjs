import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainPixelDifference } from '../../tools/terrain-pixel-comparison.mjs';
function capture(view, changed = false) {
  const width = 240,
    height = 180,
    data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot((x - view.x) / view.radius, (y - view.y) / view.radius);
      const rgb = distance < 0.8 ? (changed ? [60, 100, 150] : [220, 210, 185]) : [70, 120, 180];
      data.set([...rgb, 255], (y * width + x) * 4);
    }
  return { width, height, data };
}
const source = { x: 70, y: 90, radius: 35 },
  target = { x: 150, y: 100, radius: 50 };
test('Fresh comparison follows measured world position and scale instead of old screen pixels', () => {
  const before = capture(source),
    after = capture(target);
  assert(terrainPixelDifference(before, after, source, source).mean > 4);
  assert.equal(terrainPixelDifference(before, after, source, target).mean, 0);
});
test('camera correction cannot hide a terrain colour change', () => {
  const result = terrainPixelDifference(capture(source), capture(target, true), source, target);
  assert(result.mean > 4);
  assert.equal(result.fraction, 1);
});
test('missing camera coverage and invalid camera scales fail rather than dropping samples', () => {
  assert.throws(() =>
    terrainPixelDifference(capture(source), capture(target), source, { ...target, radius: 0 }),
  );
  assert.throws(() =>
    terrainPixelDifference(capture(source), capture(target), source, { ...target, x: -50 }),
  );
});
test('scale correction preserves spatially varying terrain rather than only a uniform patch', () => {
  const gradient = (view) => {
    const image = capture(view);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const value = (coordinate, centre) =>
          Math.max(0, Math.min(255, Math.round(120 + (100 * (coordinate - centre)) / view.radius)));
        image.data.set([value(x, view.x), value(y, view.y), 100, 255], (y * image.width + x) * 4);
      }
    return image;
  };
  const scaled = { ...source, radius: 70 },
    before = gradient(source),
    after = gradient(scaled);
  assert(terrainPixelDifference(before, after, source, source).mean > 4);
  assert(terrainPixelDifference(before, after, source, scaled).mean < 2);
});
