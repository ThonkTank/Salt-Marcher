import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/room-renumber-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/room-renumber-store.cjs');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'room-renumber-')),
    file = join(dir, 'campaign.sqlite'),
    store = new CampaignStore(file);
  const original = {
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Wachraum',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 4 },
          { x: 0, y: 4 },
        ],
        holes: [],
      },
    ],
    sections: [],
  };
  const campaign = store.create('Schlüssel zur Karte', [original]),
    w = store.activate(campaign.id);
  const room = () => store.workspace().rooms.find((r) => r.id === original.id);
  const renumber = () =>
    store.executeDrawing({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action: {
        kind: 'key-batch',
        rooms: [{ id: original.id, expectedRevision: room().revision, keyRevision: null }],
        patch: { number: '6a' },
      },
    });
  const edit = () => {
    const r = room(),
      polygons = structuredClone(r.polygons);
    polygons[0].outer[0].y = -1;
    store.edit({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      roomId: r.id,
      expectedRevision: r.revision,
      name: r.name,
      sections: r.sections,
      polygons,
    });
  };
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir, file, store, original, campaign, w, room, renumber, edit };
}
for (const order of ['geometry-first', 'number-first'])
  test(`room renumbering retains backup, export, Fresh and shared Undo/Redo: ${order}`, async (t) => {
    const x = fixture(t);
    if (order === 'geometry-first') {
      x.edit();
      x.renumber();
    } else {
      x.renumber();
      x.edit();
    }
    const safe = join(x.dir, 'recovery.sqlite');
    await x.store.backup(safe);
    const snapshot = join(x.dir, 'export.sqlite');
    await x.store.campaignSnapshot(x.w.token, snapshot);
    assert.equal(x.room().number, '6a');
    assert.equal(x.room().polygons[0].outer[0].y, -1);
    x.store.history(x.w.token, 'undo');
    await x.store.backup(safe);
    x.store.history(x.w.token, 'undo');
    assert.equal(x.room().number, '1');
    assert.deepEqual(x.room().polygons, x.original.polygons);
    await x.store.backup(safe);
    x.store.history(x.w.token, 'redo');
    x.store.history(x.w.token, 'redo');
    assert.equal(x.room().number, '6a');
    assert.equal(x.room().polygons[0].outer[0].y, -1);
    await x.store.backup(safe);
    const fresh = new CampaignStore(safe);
    try {
      const w = fresh.activate(x.campaign.id),
        r = w.rooms.find((r) => r.id === x.original.id);
      assert.equal(r.number, '6a');
      assert.equal(r.polygons[0].outer[0].y, -1);
    } finally {
      fresh.close();
    }
  });
test('mutable display numbers do not weaken room-identity or snapshot validation', async (t) => {
  const x = fixture(t);
  x.edit();
  x.renumber();
  const safe = join(x.dir, 'safe.sqlite');
  await x.store.backup(safe);
  const bytes = readFileSync(safe);
  const row = x.store.db.prepare('SELECT * FROM history WHERE ordinal=1').get(),
    before = JSON.parse(row.before_json);
  before.id = 'another-room';
  x.store.db
    .prepare('UPDATE history SET before_json=? WHERE ordinal=1')
    .run(JSON.stringify(before));
  await assert.rejects(x.store.backup(safe), /Raumhistory/);
  assert.deepEqual(readFileSync(safe), bytes);
});
