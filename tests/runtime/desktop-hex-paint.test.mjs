import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/runtime/hex-paint.ts'],
  outfile: '.build/hex-paint.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { beginHexPaint, applyHexPaintEdit } = createRequire(import.meta.url)(
  '../../.build/hex-paint.cjs',
);
test('one continuous terrain stroke closes skipped hexes and reverses only its exact sparse changes', () => {
  const original = {
      q: 2,
      r: 0,
      level: 0,
      terrain: 'plains',
      road: true,
      river: true,
      elevationM: 77,
      climate: 'cold',
      label: 'Alte Brücke',
      faction: 'Zunft',
      interrupt: 'Fähre',
    },
    map = {
      id: 'map',
      revision: 1,
      name: 'Region',
      hexMeters: 1000,
      climate: 'temperate',
      seed: 'seed',
      cells: [original],
    },
    before = structuredClone(map.cells),
    stroke = beginHexPaint(map, 0, 'forest', 0);
  stroke.touch({ q: 0, r: 0 });
  stroke.touch({ q: 4, r: 0 });
  const edit = stroke.finish();
  assert.equal(edit.changes.length, 5);
  assert.equal(map.cells.find((c) => c.q === 2 && c.r === 0).terrain, 'forest');
  assert.deepEqual(
    { ...map.cells.find((c) => c.q === 2 && c.r === 0), terrain: 'plains' },
    original,
  );
  applyHexPaintEdit(map, edit, 'undo');
  assert.deepEqual(map.cells, before);
  applyHexPaintEdit(map, edit, 'redo');
  assert.equal(map.cells.length, 5);
  map.cells.find((c) => c.q === 2).label = 'Spätere Notiz';
  const modified = structuredClone(map.cells);
  assert.throws(() => applyHexPaintEdit(map, edit, 'undo'), /inzwischen geändert/);
  assert.deepEqual(map.cells, modified);
});

for (const direction of ['undo', 'redo'])
  test(`paint ${direction} compares cell content independently of JSON field order`, () => {
    const before = {
        q: 0,
        r: 0,
        level: 0,
        terrain: 'plains',
        road: true,
        river: true,
        elevationM: 77,
        climate: 'cold',
        label: '  Alte Brücke\r\n',
        faction: 'Zunft',
        interrupt: 'Fähre',
      },
      map = {
        id: 'map',
        revision: 1,
        name: 'Region',
        hexMeters: 1000,
        climate: 'temperate',
        seed: 'seed',
        cells: [structuredClone(before)],
      },
      stroke = beginHexPaint(map, 0, 'forest', 0);
    stroke.touch({ q: 0, r: 0 });
    const edit = stroke.finish();
    if (direction === 'redo') applyHexPaintEdit(map, edit, 'undo');
    map.cells = map.cells.map((c) => Object.fromEntries(Object.entries(c).reverse()));
    applyHexPaintEdit(map, edit, direction);
    assert.deepEqual(map.cells, [
      { ...before, terrain: direction === 'undo' ? 'plains' : 'forest' },
    ]);
    const other = direction === 'undo' ? 'redo' : 'undo';
    map.cells[0].label = 'Spätere Notiz';
    const changed = structuredClone(map.cells);
    assert.throws(() => applyHexPaintEdit(map, edit, other), /inzwischen geändert/);
    assert.deepEqual(map.cells, changed);
  });

test('painting default or inherited terrain authors an explicit tile and undo restores the sparse map', () => {
  for (const cells of [
    [],
    [
      {
        q: 0,
        r: 0,
        level: 1,
        terrain: 'forest',
        road: false,
        river: false,
        elevationM: 0,
        climate: null,
        label: '',
        faction: '',
        interrupt: '',
      },
    ],
  ]) {
    const map = {
        id: 'map',
        revision: 1,
        name: 'Region',
        hexMeters: 1000,
        climate: 'temperate',
        seed: 'seed',
        cells: structuredClone(cells),
      },
      before = structuredClone(map.cells),
      terrain = cells.length ? 'forest' : 'plains';
    const stroke = beginHexPaint(map, 0, terrain, 0);
    stroke.touch({ q: 0, r: 0 });
    const edit = stroke.finish();
    assert.equal(edit.changes.length, 1);
    assert.equal(edit.changes[0].before, null);
    assert.equal(map.cells.find((c) => c.level === 0).terrain, terrain);
    applyHexPaintEdit(map, edit, 'undo');
    assert.deepEqual(map.cells, before);
    applyHexPaintEdit(map, edit, 'redo');
    assert.equal(map.cells.find((c) => c.level === 0).terrain, terrain);
    const repeat = beginHexPaint(map, 0, terrain, 0);
    repeat.touch({ q: 0, r: 0 });
    assert.equal(repeat.finish().changes.length, 0);
  }
});
