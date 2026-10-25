import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
for (const [name, entry] of [
  ['path', 'path-model'],
  ['trigger', 'trigger-model'],
]) {
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/volume-spatial-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
}
const require = createRequire(import.meta.url);
const { resolvePathAnchor, proposePathAnchor } = require('../.build/volume-spatial-path.cjs');
const { triggerIntervals } = require('../.build/volume-spatial-trigger.cjs');
const U = 1.524;
const span = (z) => ({ z, height: 2, floor: true, ceiling: true, medium: 'air' });
function geometry(columns) {
  const volume = {
    id: 'volume',
    revision: 0,
    scopeId: 'local',
    roomId: 'room',
    floorId: 'ground',
    columns,
    faces: {},
  };
  return {
    rooms: [{ id: 'room' }],
    floors: [{ id: 'ground', scopeId: 'local', elevation: 12 }],
    drawing: { volumes: [volume], elements: [] },
  };
}
const largeGeometry = () =>
  geometry(
    Array.from({ length: 100000 }, (_, i) => ({
      x: (i % 1000) - 5,
      y: Math.floor(i / 1000) - 7,
      spans: [span(i === 0 ? -3 : 0), span(10)],
    })),
  );

test('a pinned path anchor resolves against 100000 columns and 200000 spans', () => {
  const result = resolvePathAnchor(largeGeometry(), {
    roomId: 'room',
    volumeId: 'volume',
    pinned: true,
    local: { x: 0, y: 0, z: 0, face: 'down' },
  });
  assert.deepEqual(result.cell, { x: -5, y: -7, z: -3 });
  assert.deepEqual(result.outside, { x: -5, y: -7, z: -4 });
  assert.ok(Math.abs(result.world.x - -4.5 * U) < 1e-10);
  assert.ok(Math.abs(result.world.y - -6.5 * U) < 1e-10);
  assert.ok(Math.abs(result.world.z - (12 - 3 * U)) < 1e-10);
});

test('entering a marked trap cell in a large volume retains the entry fraction and room', () => {
  const g = largeGeometry(),
    field = {
      id: 'trap-field',
      revision: 0,
      scopeId: 'local',
      trapId: 'trap',
      name: 'Floor trap',
      mode: 'interrupt',
      archived: false,
      fragments: [{ id: 'fragment', volumeId: 'volume', cells: [{ x: 0, y: 0, z: 0 }] }],
    };
  const pose = (x) => ({
    scopeId: 'local',
    floorId: 'ground',
    roomId: 'room',
    x: x * U,
    y: -6.5 * U,
    z: 12 - 3 * U,
    movement: 'walk',
  });
  const intervals = triggerIntervals(g, field, pose(-5.5), pose(-4.5));
  assert.equal(intervals.length, 1);
  assert.ok(Math.abs(intervals[0].from - 0.5) < 1e-10);
  assert.equal(intervals[0].to, 1);
  assert.equal(intervals[0].roomId, 'room');
});

test('automatic path anchoring selects the closest face in a large sparse volume', () => {
  const g = geometry(
    Array.from({ length: 100000 }, (_, i) => ({ x: i * 2, y: 0, spans: [span(0), span(10)] })),
  );
  const anchor = proposePathAnchor(g, 'room', { x: 200002 * U, y: 0.5 * U, z: 12 }, 'corridor');
  assert.deepEqual(anchor, {
    roomId: 'room',
    volumeId: 'volume',
    pinned: false,
    local: { x: 199998, y: 0, z: 0, face: 'east' },
  });
});

test('automatic anchoring retains stable ties and enables vertical faces only for shaft or ladder', () => {
  const g = geometry([{ x: 0, y: 0, spans: [span(0)] }]);
  const centered = { x: 0.5 * U, y: 0.5 * U, z: 12 },
    top = { ...centered, z: 12 + 2 * U };
  assert.equal(proposePathAnchor(g, 'room', centered, 'corridor').local.face, 'north');
  assert.equal(proposePathAnchor(g, 'room', top, 'corridor').local.face, 'north');
  for (const form of ['shaft', 'ladder'])
    assert.equal(proposePathAnchor(g, 'room', top, form).local.face, 'up');
});
