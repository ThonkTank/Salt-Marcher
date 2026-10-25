import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/room-number-label.ts', 'src/app/drawing-model.ts'],
  outdir: '.build/room-number-label',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
});
const require = createRequire(import.meta.url),
  { appendRoomNumber } = require('../.build/room-number-label/room-number-label.cjs'),
  { inside } = require('../.build/room-number-label/drawing-model.cjs');
const ring = (coords) => coords.map(([x, y]) => ({ x, y }));
const polygon = (coords, holes = []) => ({ outer: ring(coords), holes: holes.map(ring) });
const square = polygon([
  [0, 0],
  [8, 0],
  [8, 6],
  [0, 6],
]);
const scene = () => parseHTML('<svg><g></g></svg>').document.querySelector('g');

test('room keys stay legible through zoom/layout without changing geometry or taking pointer hits', () => {
  const room = { id: 'key', number: '7b', polygons: [square] },
    before = JSON.stringify(room);
  for (const scale of [0.01, 0.1, 1, 20]) {
    const root = scene();
    appendRoomNumber(root, room, scale);
    const label = root.querySelector('text');
    assert.equal(label.textContent, '7b');
    assert.ok(Math.abs(Number(label.getAttribute('font-size')) / scale - 13) < 1e-10);
    assert.ok(Math.abs(Number(label.getAttribute('stroke-width')) / scale - 3) < 1e-10);
    assert.equal(label.getAttribute('pointer-events'), 'none');
    assert.equal(label.getAttribute('aria-hidden'), 'true');
    assert.equal(label.getAttribute('data-room-number'), room.id);
    assert.ok(
      inside(
        { x: Number(label.getAttribute('x')), y: Number(label.getAttribute('y')) },
        room.polygons,
      ),
    );
  }
  assert.equal(JSON.stringify(room), before);
});

test('irregular, hollow and disconnected rooms label their actual interior; unusable geometry cannot blank the map', () => {
  for (const polygons of [
    [
      polygon([
        [0, 0],
        [8, 0],
        [8, 2],
        [2, 2],
        [2, 8],
        [0, 8],
      ]),
    ],
    [
      polygon(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        [
          [
            [3, 3],
            [7, 3],
            [7, 7],
            [3, 7],
          ],
        ],
      ),
    ],
    [
      square,
      polygon([
        [20, 0],
        [24, 0],
        [24, 4],
        [20, 4],
      ]),
    ],
  ]) {
    const root = scene();
    appendRoomNumber(root, { id: 'odd', number: '12', polygons }, 0.1);
    const label = root.querySelector('text');
    assert.ok(label);
    assert.ok(
      inside({ x: Number(label.getAttribute('x')), y: Number(label.getAttribute('y')) }, polygons),
    );
  }
  const root = scene();
  root.innerHTML = '<path d="M0,0L1,0L1,1Z"/>';
  for (const scale of [0, NaN, Infinity, -1])
    appendRoomNumber(root, { id: 'bad', number: '1', polygons: [square] }, scale);
  appendRoomNumber(root, { id: 'empty', number: '2', polygons: [] }, 1);
  assert.equal(root.children.length, 1);
  assert.equal(root.firstElementChild.localName, 'path');
});
