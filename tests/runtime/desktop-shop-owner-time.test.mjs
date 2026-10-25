import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/planner-shop-owner/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../../.build/planner-shop-owner/store.cjs',
);
function fixture(t, automatic = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'shop-owner-')),
    file = path.join(root, 'store.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Besitzer'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const location = {
    kind: 'location',
    version: 1,
    id: randomUUID(),
    name: 'Tor',
    type: 'poi',
    sections: [],
    detailMaps: [],
    keyLinks: [],
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  let stock = [];
  if (automatic) {
    const d = store.executeItemShop(
      command({
        kind: 'definition',
        expectedRevision: null,
        definition: {
          id: randomUUID(),
          revision: 0,
          name: 'Seil',
          category: 'equipment',
          magic: false,
          rarity: '',
          attunement: 'no',
          unitCopper: '100',
          weightText: '',
          properties: [],
          description: '',
          source: { kind: 'authored', label: 'Eigener Gegenstand', license: null, url: null },
          trashed: false,
        },
      }),
    ).definition;
    stock = [
      {
        id: randomUUID(),
        reference: { kind: 'authored', definitionId: d.id, revision: d.revision },
        quantity: 1,
        unique: false,
        instanceId: null,
        buyCopper: '100',
        sellCopper: '50',
        notes: '',
        restock: { mode: 'add', quantity: 1, intervalMs: '1000', nextDueMs: '1000' },
      },
    ];
  }
  const shop = store.executeItemShop(
    command({
      kind: 'shop',
      expectedRevision: null,
      shop: {
        id: randomUUID(),
        revision: 0,
        name: 'Handel',
        owner: { kind: 'location', id: location.id },
        notes: '  Shop\r\n',
        trashed: false,
        stock,
      },
    }),
  ).shop.shop;
  const x = { file, store, cam, w, command, location, scene, shop };
  x.advance = () => {
    const s = store.liveScene(w.token, scene.id);
    return store.executeLive(
      command({
        kind: 'advance-clock',
        sceneId: s.id,
        expectedRevision: s.clock.revision,
        amount: 1,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Weitergehen',
      }),
    );
  };
  x.breakOwner = () => {
    const s = structuredClone(shop);
    s.owner.id = randomUUID();
    const payload = JSON.stringify(s);
    store.db
      .prepare('UPDATE shop SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), cam.id, s.id);
  };
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('a shop without automatic stock rules does not bind unrelated scene time to its missing owner', (t) => {
  const x = fixture(t);
  x.breakOwner();
  const before = x.store.db.prepare('SELECT * FROM shop WHERE id=?').get(x.shop.id);
  assert.throws(() => x.store.shop(x.w.token, x.shop.id), /Shopbesitzer/);
  x.advance();
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).clock.instantMs, '1000');
  assert.deepEqual(x.store.db.prepare('SELECT * FROM shop WHERE id=?').get(x.shop.id), before);
  assert.ok(x.store.shops(x.w.token, false).some((s) => s.id === x.shop.id && s.problem));
});
test('an automatically managed shop still fails closed on a missing owner before the clock or stock commits', (t) => {
  const x = fixture(t, true);
  x.breakOwner();
  const before = readFileSync(x.file);
  assert.throws(x.advance, /Shopbesitzer/);
  assert.equal(readFileSync(x.file).equals(before), true);
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).clock.instantMs, '0');
});
test('owner trash pauses availability and stock without losing shop identity; restore and reassignment retain history', (t) => {
  const x = fixture(t, true),
    revision = x.store
      .preparation(x.w.token)
      .locations.find((l) => l.document.id === x.location.id).revision;
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location-trash',
      id: x.location.id,
      expectedRevision: revision,
      trashed: true,
    },
  });
  assert.equal(x.store.shop(x.w.token, x.shop.id).unavailable, true);
  x.advance();
  assert.equal(x.store.shop(x.w.token, x.shop.id).shop.stock[0].quantity, 1);
  const r = x.store
    .preparation(x.w.token)
    .locations.find((l) => l.document.id === x.location.id).revision;
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location-trash', id: x.location.id, expectedRevision: r, trashed: false },
  });
  assert.equal(x.store.shop(x.w.token, x.shop.id).unavailable, false);
  const other = { ...x.location, id: randomUUID(), name: 'Kai' };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: other },
  });
  const before = x.store.shop(x.w.token, x.shop.id),
    next = { ...before.shop, owner: { kind: 'location', id: other.id } };
  x.store.executeItemShop(
    x.command({ kind: 'shop', shop: next, expectedRevision: before.shop.revision }),
  );
  const after = x.store.shop(x.w.token, x.shop.id);
  assert.equal(after.shop.id, before.shop.id);
  assert.equal(after.shop.notes, '  Shop\r\n');
  assert.equal(after.shop.stock[0].quantity, 1);
  assert.equal(after.ownerName, 'Kai');
  assert.equal(after.history.length, before.history.length + 1);
});
test('a future automatic rule validates its owner when due, without blocking earlier independent time', (t) => {
  const x = fixture(t, true);
  x.shop.stock[0].restock.nextDueMs = '2000';
  x.breakOwner();
  x.advance();
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).clock.instantMs, '1000');
  const before = readFileSync(x.file);
  assert.throws(x.advance, /Shopbesitzer/);
  assert.equal(readFileSync(x.file).equals(before), true);
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).clock.instantMs, '1000');
});
