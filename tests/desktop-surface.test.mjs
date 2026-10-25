import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

for (const [name, entry] of [
  ['model', 'surface-model'],
  ['storage', 'storage/surfaces'],
  ['volume', 'volume-model'],
]) {
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/surface-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
}
const require = createRequire(import.meta.url);
const { surfaceWorldFaces } = require('../.build/surface-model.cjs');
const { volumeOrigin } = require('../.build/surface-volume.cjs');
const { rebindSurfaces } = require('../.build/surface-storage.cjs');
const span = (z = 0) => ({ z, height: 2, floor: true, ceiling: true, medium: 'air' });
const face = (x) => ({ x, y: 0, z: 0, side: 'floor' });
const volume = (id, columns) => ({
  id,
  revision: 0,
  scopeId: 'local',
  roomId: 'room-' + id,
  floorId: 'ground',
  columns,
  faces: {},
});
const largeVolume = () =>
  volume(
    'large',
    Array.from({ length: 100000 }, (_, i) => ({
      x: (i % 1000) - 5,
      y: Math.floor(i / 1000) - 7,
      spans: [span(i === 0 ? -3 : 0), span(10)],
    })),
  );
const content = {
  id: 'surface',
  scopeId: 'local',
  revision: 3,
  name: '  Marked stone\r\n',
  kind: 'surface',
  blocks: [{ id: 'prose', text: '  Keep exact authored text\r\n', visibility: 'gm' }],
  surface: { roomId: 'old-room', fragments: [] },
};
const captured = (faces) => [
  {
    content: structuredClone(content),
    parts: [
      { fragment: { id: 'original-fragment', volumeId: 'old', faces }, floorId: 'ground', faces },
    ],
  },
];

test('surface origins handle 100000 columns and 200000 spans without call stack overflow', () => {
  assert.deepEqual(volumeOrigin(largeVolume()), { x: -5, y: -7, z: -3 });
});

test('large-volume surface lookup retains local coordinates and floor elevation', () => {
  const v = largeVolume(),
    key = {
      ...content,
      surface: { roomId: v.roomId, fragments: [{ id: 'mark', volumeId: v.id, faces: [face(0)] }] },
    };
  const result = surfaceWorldFaces(key, {
    rooms: [],
    floors: [{ id: 'ground', scopeId: 'local', elevation: 12 }],
    drawing: { volumes: [v] },
  });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].face, { x: -5, y: -7, z: -3, side: 'floor' });
  assert.equal(result[0].pose.roomId, v.roomId);
  assert.ok(Math.abs(result[0].pose.z - (12 - 3 * 1.524 + 0.001)) < 1e-10);
  assert.deepEqual(key.surface.fragments[0].faces, [face(0)]);
});

test('rebinding many marks reads volume coordinates in proportion to volume size', () => {
  let coordinateReads = 0;
  const v = volume(
    'new',
    Array.from({ length: 100 }, (_, i) => ({
      get x() {
        coordinateReads++;
        return i;
      },
      y: 0,
      spans: [span()],
    })),
  );
  const input = captured(Array.from({ length: 100 }, (_, i) => face(i))),
    saved = [];
  rebindSurfaces('campaign', input, [v], (key, row) =>
    saved.push({ key, value: JSON.parse(row.payload) }),
  );
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].value.surface.fragments[0].faces, input[0].parts[0].faces);
  assert.deepEqual(saved[0].value.blocks, content.blocks);
  assert.equal(saved[0].value.surface.roomId, v.roomId);
  assert.ok(
    coordinateReads < 1000,
    `Read volume x coordinates ${coordinateReads} times for 100 marks.`,
  );
});

test('split surface rebinding preserves prose, stable fragment identity and lost world faces', () => {
  const input = captured([face(0), face(1), face(2)]),
    before = structuredClone(input),
    saved = [];
  const a = volume('a', [{ x: 0, y: 0, spans: [span()] }]),
    b = volume('b', [{ x: 1, y: 0, spans: [span()] }]);
  const wrongFloor = {
    ...volume('other-floor', [{ x: 2, y: 0, spans: [span()] }]),
    floorId: 'upper',
  };
  const wrongScope = {
    ...volume('other-scope', [{ x: 2, y: 0, spans: [span()] }]),
    scopeId: 'foreign',
  };
  rebindSurfaces('campaign', input, [a, b, wrongFloor, wrongScope], (_key, row) =>
    saved.push(JSON.parse(row.payload)),
  );
  assert.deepEqual(input, before);
  assert.deepEqual(saved[0].blocks, content.blocks);
  assert.equal(saved[0].name, content.name);
  const parts = saved[0].surface.fragments;
  assert.equal(parts.length, 3);
  assert.equal(parts.find((p) => p.volumeId === 'a').id, 'original-fragment');
  assert.deepEqual(parts.find((p) => p.volumeId === 'b').faces, [face(0)]);
  assert.deepEqual(parts.find((p) => p.unbound).orphanedWorld, {
    floorId: 'ground',
    faces: [face(2)],
  });
  assert.equal(new Set(parts.map((p) => p.id)).size, 3);
});

test('rebinding 20000 marked faces to a 100000-column volume preserves every mark', () => {
  const v = largeVolume(),
    faces = v.columns.slice(1, 20001).map((c) => ({ x: c.x, y: c.y, z: 0, side: 'floor' })),
    saved = [];
  rebindSurfaces('campaign', captured(faces), [v], (_key, row) =>
    saved.push(JSON.parse(row.payload)),
  );
  const parts = saved[0].surface.fragments;
  assert.equal(parts.length, 1);
  assert.equal(parts[0].faces.length, 20000);
  assert.equal(parts[0].id, 'original-fragment');
  assert.deepEqual(
    parts[0].faces,
    faces.map((f) => ({ ...f, x: f.x + 5, y: f.y + 7, z: 3 })),
  );
  assert.deepEqual(saved[0].blocks, content.blocks);
});
