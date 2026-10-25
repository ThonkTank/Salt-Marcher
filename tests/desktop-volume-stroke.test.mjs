import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
for (const [name, entry] of [
  ['stroke', 'volume-stroke'],
  ['store', 'storage/store'],
])
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/volume-stroke-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  {
    brushStroke,
    volumeArea,
    extendStroke,
    voxelKey,
  } = require('../.build/volume-stroke-stroke.cjs'),
  { CampaignStore } = require('../.build/volume-stroke-store.cjs');

test('sparse pointer samples paint a continuous brush and crossing slices retains one bounded stroke', () => {
  const brush = { tool: 'brush', shape: 'square', radius: 1 },
    cells = brushStroke({ x: -5, y: -2, z: -1 }, { x: 5, y: -2, z: -1 }, brush),
    keys = new Set(cells.map(voxelKey));
  for (let x = -6; x <= 6; x++) for (let y = -3; y <= -1; y++) assert(keys.has(`${x},${y},-1`));
  assert.equal(cells.length, 39);
  const grown = extendStroke(
    new Map(cells.map((c) => [voxelKey(c), c])),
    brushStroke({ x: 5, y: -2, z: -1 }, { x: 5, y: -2, z: 1 }, brush),
  );
  assert(grown.has('5,-2,0'));
  assert(grown.has('5,-2,1'));
  const circle = brushStroke(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { ...brush, shape: 'circle' },
  );
  assert.equal(circle.length, 5);
  assert(!circle.some((c) => c.x === 1 && c.y === 1));
  const original = new Map(cells.map((c) => [voxelKey(c), c]));
  assert.throws(
    () =>
      extendStroke(original, volumeArea({ x: 0, y: 0, z: 0 }, { x: 19, y: 19, z: 4 }, 'rectangle')),
    /2000/,
  );
  assert.equal(original.size, 39);
  assert.throws(
    () => volumeArea({ x: -1000000, y: 0, z: 0 }, { x: 1000000, y: 1, z: 0 }, 'ellipse'),
    /2000/,
  );
});

test('rectangle, ellipse and matched eraser make complete history actions and survive fresh reopening', () => {
  const dir = mkdtempSync(tmpdir() + '/gm-volume-stroke-'),
    file = dir + '/campaign.sqlite',
    id = randomUUID(),
    room = {
      id,
      scopeId: 'local',
      floorId: 'ground',
      number: '7',
      name: 'Basaltkammer',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 9.144, y: 0 },
            { x: 9.144, y: 9.144 },
            { x: 0, y: 9.144 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Originaltext\r\n' }],
    };
  let store = new CampaignStore(file);
  try {
    const campaign = store.create('Rasterwerkzeuge', [room]);
    let w = store.activate(campaign.id);
    const cmd = (action) =>
        store.executeDrawing({
          commandId: randomUUID(),
          token: w.token,
          campaignId: campaign.id,
          action,
        }),
      volume = () => store.drawing(w.token).volumes.find((v) => v.roomId === id),
      current = () => store.workspace().rooms.find((r) => r.id === id),
      edit = (operation, cells) =>
        cmd({
          kind: 'volume-edit',
          roomId: id,
          expectedRoomRevision: current().revision,
          expectedVolumeRevision: volume()?.revision ?? null,
          operation,
          cells,
          enabled: true,
          medium: 'air',
          side: 'north',
        });
    cmd({
      kind: 'volume-initialize',
      roomId: id,
      expectedRoomRevision: 0,
      expectedVolumeRevision: null,
      heightSteps: 2,
    });
    const initial = JSON.stringify(volume().columns),
      volumeId = volume().id;
    const added = volumeArea({ x: 5, y: 1, z: 0 }, { x: 8, y: 3, z: 0 }, 'rectangle');
    edit('fill', added);
    assert.equal(volume().columns.length, 45);
    assert.equal(volume().id, volumeId);
    const extended = JSON.stringify(volume().columns);
    store.history(w.token, 'undo');
    assert.equal(JSON.stringify(volume().columns), initial);
    store.history(w.token, 'redo');
    assert.equal(JSON.stringify(volume().columns), extended);
    const ellipse = volumeArea({ x: 1, y: 1, z: 0 }, { x: 3, y: 3, z: 1 }, 'ellipse');
    assert.equal(ellipse.length, 18);
    edit('erase', ellipse);
    assert.equal(volume().columns.length, 36);
    assert.equal(current().id, id);
    assert.equal(current().number, '7');
    assert.deepEqual(current().sections, room.sections);
    const erased = JSON.stringify(volume().columns);
    store.close();
    store = new CampaignStore(file);
    w = store.activate(campaign.id);
    assert.equal(JSON.stringify(volume().columns), erased);
    assert.deepEqual(current().sections, room.sections);
    const all = volume().columns.flatMap((c) =>
      c.spans.flatMap((s) =>
        Array.from({ length: s.height }, (_, i) => ({ x: c.x, y: c.y, z: s.z + i })),
      ),
    );
    edit('erase', all);
    assert.equal(volume().columns.length, 0);
    assert(!store.workspace().rooms.some((r) => r.id === id));
    const preserved = store.drawing(w.token).hiddenRooms.find((r) => r.id === id);
    assert.deepEqual(preserved.sections, room.sections);
    cmd({
      kind: 'volume-edit',
      roomId: id,
      expectedRoomRevision: preserved.revision,
      expectedVolumeRevision: volume().revision,
      operation: 'fill',
      cells: [{ x: -2, y: -1, z: 0 }],
      enabled: true,
      medium: 'air',
      side: 'north',
    });
    assert(current());
    assert.equal(volume().id, volumeId);
    assert.deepEqual(current().sections, room.sections);
    store.history(w.token, 'undo');
    assert(!store.workspace().rooms.some((r) => r.id === id));
    assert.equal(volume().columns.length, 0);
    store.history(w.token, 'redo');
    assert(current());
    assert.equal(volume().columns[0].x, -2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
