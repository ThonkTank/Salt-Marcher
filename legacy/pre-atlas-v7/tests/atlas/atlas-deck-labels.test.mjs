import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas/atlas-deck-labels.ts'],
  outfile: '.build/atlas-deck-labels-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
buildSync({
  entryPoints: ['src/app/atlas/atlas-metric-camera.ts'],
  outfile: '.build/atlas-metric-camera-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { AtlasDeckLabels } = await import('../../.build/atlas-deck-labels-test.mjs');
const { atlasMetricFrame } = await import('../../.build/atlas-metric-camera-test.mjs');

const camera = {
  focus: { x: 0, y: 0 },
  focusHeightM: 0,
  metersPerPixel: 0.5,
  rotation: 0,
  tilt: 0,
  exaggeration: 1,
};
const frame = atlasMetricFrame(camera, 1200, 800);
const candidate = (id, x, y, overrides = {}) => ({
  id,
  text: id,
  kind: 'building',
  rank: 5,
  point: { x, y },
  ...overrides,
});
const measure = (text, size) => text.length * size * 0.45;
function createLayout() {
  return new AtlasDeckLabels(measure);
}

test('screen-space collisions choose the selected building label and keep it selectable by id', () => {
  const labels = [
    { candidate: candidate('unselected', 0, 0), heightM: 0 },
    { candidate: candidate('selected', 0, 0), heightM: 0 },
  ];
  const placed = createLayout().place(frame, labels, 'selected');
  assert.deepEqual(
    placed.map((item) => item.label.candidate.id),
    ['selected'],
  );
  assert.ok(placed[0].placed.box.x >= 2 && placed[0].placed.box.y >= 2);
  assert.equal(placed[0].anchor.x, 600);
  assert.equal(placed[0].anchor.y, 400);
});

test('full-image placement is deterministic and remains one complete export layout', () => {
  const labels = Array.from({ length: 12 }, (_, index) => ({
    candidate: candidate(
      `building-${index}`,
      ((index % 4) - 1.5) * 80,
      (Math.floor(index / 4) - 1) * 70,
    ),
    heightM: 0,
  }));
  const first = createLayout()
    .place(frame, labels)
    .map((item) => ({
      id: item.label.candidate.id,
      point: item.placed.point,
      box: item.placed.box,
    }));
  const second = createLayout()
    .place(frame, labels)
    .map((item) => ({
      id: item.label.candidate.id,
      point: item.placed.point,
      box: item.placed.box,
    }));
  assert.deepEqual(second, first);
  assert(first.length > 1 && first.length <= labels.length);
  assert(
    first.every(
      (item) =>
        item.box.x >= 2 &&
        item.box.y >= 2 &&
        item.box.x + item.box.w <= 1198 &&
        item.box.y + item.box.h <= 798,
    ),
  );
  const fullLayer = createLayout().layer(frame, labels);
  assert.equal(
    fullLayer.props.data.length,
    first.length,
    'one label layer carries the complete full-frame placement set',
  );
});

test('projected visibility rejects behind-camera labels before reserving collision area', () => {
  const blocked = { candidate: candidate('behind', 0, 0), heightM: 10_000 };
  const visible = { candidate: candidate('visible', 5, 0), heightM: 0 };
  const placed = createLayout().place(frame, [blocked, visible]);
  assert(placed.every((item) => item.label.candidate.id !== 'behind'));
  assert(placed.some((item) => item.label.candidate.id === 'visible'));
});

test('billboard glyph size and offsets agree with screen collision boxes at elevated depths', () => {
  const view = atlasMetricFrame(
    { ...camera, tilt: 55, focusHeightM: 145, metersPerPixel: 0.05 },
    900,
    650,
  );
  const labels = [{ candidate: candidate('elevated', 0, 0, { kind: 'city' }), heightM: 152 }];
  const layer = createLayout().layer(view, labels),
    item = layer.props.data[0];
  assert(item);
  const perspective = view.viewport.focalDistance / item.anchor.depthM;
  assert(Math.abs(layer.props.getSize(item) * perspective - item.placed.font) < 1e-9);
  const offset = layer.props.getPixelOffset(item);
  assert(Math.abs(offset[1] * perspective - (item.placed.point.y - item.anchor.y)) < 1e-9);
  assert(
    view.viewport.focalDistance > 1,
    'perspective glyph offsets need the real camera focal distance',
  );
});
