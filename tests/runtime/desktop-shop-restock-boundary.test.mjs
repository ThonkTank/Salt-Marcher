import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/planner-restock-boundary/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../../.build/planner-restock-boundary/store.cjs',
);
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'restock-boundary-')),
    file = path.join(root, 'store.sqlite'),
    x = { root, file, store: new CampaignStore(file) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Geteilte Handelszeit');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  const location = {
    kind: 'location',
    version: 1,
    id: randomUUID(),
    name: 'Markt',
    type: 'poi',
    sections: [],
    detailMaps: [],
    keyLinks: [],
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', document: location, expectedRevision: null },
  });
  x.definition = x.store.executeItemShop(
    x.command({
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
        source: { kind: 'authored', label: 'GM', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
  const characters = ['Vorhut', 'Nachhut'].map(
    (name) =>
      x.store.executeLive(x.command({ kind: 'create-character', profile: { name } })).character,
  );
  for (const c of characters) {
    const live = x.store.live(x.w.token);
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  const live = x.store.live(x.w.token);
  x.a = x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }),
  ).scene.id;
  const a = x.store.liveScene(x.w.token, x.a),
    state = x.store.live(x.w.token);
  x.b = x.store.executeLive(
    x.command({
      kind: 'move',
      sceneId: x.a,
      memberIds: [characters[1].id],
      expectedRosterRevision: state.rosterRevision,
      expectedFocusRevision: state.focusRevision,
      expectedClockRevision: a.clock.revision,
      expectedSceneMembershipRevision: a.membershipRevision,
      target: { kind: 'new', title: 'Nachhut', expectedContentRevision: a.revision },
    }),
  ).session.createdScene.id;
  x.entry = (id, quantity, restock) => ({
    id,
    reference: { kind: 'authored', definitionId: x.definition.id, revision: x.definition.revision },
    quantity,
    unique: false,
    instanceId: null,
    buyCopper: '100',
    sellCopper: '50',
    notes: '  Original\r\n',
    restock,
  });
  x.shop = (stock) =>
    x.store.executeItemShop(
      x.command({
        kind: 'shop',
        expectedRevision: null,
        shop: {
          id: randomUUID(),
          revision: 0,
          name: 'Marktstand',
          owner: { kind: 'location', id: location.id },
          notes: '  Unverändert\r\n',
          trashed: false,
          stock,
        },
      }),
    ).shop.shop;
  x.advance = (sceneId, seconds) => {
    const scene = x.store.liveScene(x.w.token, sceneId),
      command = x.command({
        kind: 'advance-clock',
        sceneId,
        expectedRevision: scene.clock.revision,
        amount: seconds,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Warten',
      });
    x.store.executeLive(command);
    return command;
  };
  x.autoHistory = (id) =>
    x.store.db
      .prepare('SELECT payload FROM shop_event WHERE campaign_id=? AND shop_id=? ORDER BY rowid')
      .all(x.cam.id, id)
      .map((r) => JSON.parse(r.payload))
      .filter((e) => e.facts?.intervals !== undefined);
  x.reopen = () => {
    x.store.close();
    x.store = new CampaignStore(file);
    x.w = x.store.activate(x.cam.id);
  };
  return x;
}
test('separate restock cursors preserve manual stock and corrections across scene catch-up, replay and Fresh', (t) => {
  const x = fixture(t),
    shop = x.shop([
      x.entry('add', 0, { mode: 'add', quantity: 1, intervalMs: '1000', nextDueMs: '1000' }),
      x.entry('fill', 0, { mode: 'fill', quantity: 5, intervalMs: '3000', nextDueMs: '3000' }),
      x.entry('manual', 13, null),
    ]);
  const step = x.advance(x.b, 10);
  let current = x.store.shop(x.w.token, shop.id);
  assert.deepEqual(
    current.shop.stock.map((e) => e.quantity),
    [10, 5, 13],
  );
  assert.deepEqual(
    x.autoHistory(shop.id).map((e) => [e.facts.entryId, e.facts.intervals, e.facts.lastDueMs]),
    [
      ['add', '10', '10000'],
      ['fill', '3', '9000'],
    ],
  );
  x.store.executeItemShop(
    x.command({
      kind: 'restock',
      shopId: shop.id,
      expectedRevision: current.shop.revision,
      entryId: 'add',
      mode: 'add',
      quantity: 7,
      reason: 'Explizite Korrektur',
    }),
  );
  const before = x.store.shop(x.w.token, shop.id);
  x.store.executeLive(step);
  assert.deepEqual(x.store.shop(x.w.token, shop.id), before);
  x.advance(x.a, 1);
  assert.match(x.store.shop(x.w.token, shop.id).timeNotice, /Auffüllungen/);
  assert.equal(x.store.liveScene(x.w.token, x.a).clock.instantMs, '1000');
  x.reopen();
  x.store.executeLive({ ...step, token: x.w.token });
  x.advance(x.a, 9);
  assert.deepEqual(
    x.store.shop(x.w.token, shop.id).shop.stock.map((e) => e.quantity),
    [17, 5, 13],
  );
  assert.equal(x.autoHistory(shop.id).length, 2);
  x.advance(x.a, 1);
  current = x.store.shop(x.w.token, shop.id);
  assert.deepEqual(
    current.shop.stock.map((e) => e.quantity),
    [18, 5, 13],
  );
  assert.deepEqual(
    current.shop.stock.map((e) => e.restock?.nextDueMs ?? null),
    ['12000', '12000', null],
  );
  assert.equal(x.autoHistory(shop.id).length, 3);
  assert.equal(x.store.liveScene(x.w.token, x.b).clock.instantMs, '10000');
  const automatic = x.autoHistory(shop.id);
  assert.deepEqual(automatic[0].facts.rule, { mode: 'add', quantity: 1, intervalMs: '1000' });
  assert.equal(automatic[0].facts.firstDueMs, '1000');
  assert.deepEqual(automatic[1].facts.rule, { mode: 'fill', quantity: 5, intervalMs: '3000' });
  assert.equal(automatic[1].facts.firstDueMs, '3000');
  assert.match(automatic[0].description, /0 → 10.*10 Fälligkeiten/);
  const updated = structuredClone(current.shop);
  updated.stock[0].restock.quantity = 99;
  x.store.executeItemShop(
    x.command({ kind: 'shop', shop: updated, expectedRevision: current.shop.revision }),
  );
  assert.deepEqual(x.autoHistory(shop.id), automatic);
  x.reopen();
  assert.deepEqual(x.autoHistory(shop.id), automatic);
});
test('an overflowing later restock rolls back earlier entry effects, time and receipt together', (t) => {
  const x = fixture(t),
    shop = x.shop([
      x.entry('first', 1, { mode: 'add', quantity: 1, intervalMs: '1000', nextDueMs: '1000' }),
      x.entry('overflow', 999999, {
        mode: 'add',
        quantity: 2,
        intervalMs: '1000',
        nextDueMs: '1000',
      }),
    ]),
    scene = x.store.liveScene(x.w.token, x.b),
    command = x.command({
      kind: 'advance-clock',
      sceneId: x.b,
      expectedRevision: scene.clock.revision,
      amount: 1,
      unit: 'seconds',
      calendarVersion: 'relative-v1',
      reason: 'Warten',
    }),
    before = x.store.db.serialize();
  assert.throws(() => x.store.executeLive(command), /Bestandsgrenze/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.autoHistory(shop.id).length, 0);
  assert.equal(x.store.liveScene(x.w.token, x.b).clock.instantMs, '0');
  assert.equal(
    x.store.db.prepare('SELECT 1 FROM live_receipt WHERE command_id=?').get(command.commandId),
    undefined,
  );
});
test('a supported clock target cannot commit a restock cursor outside its readable representation', (t) => {
  const x = fixture(t),
    shop = x.shop([
      x.entry('fill', 1, { mode: 'fill', quantity: 1, intervalMs: '2', nextDueMs: '2' }),
    ]),
    scene = x.store.liveScene(x.w.token, x.a),
    live = x.store.live(x.w.token),
    calendar = x.store.world(x.w.token).calendar,
    target = '9'.repeat(30),
    command = x.command({
      kind: 'advance-clock',
      sceneId: x.a,
      expectedRevision: scene.clock.revision,
      calendarVersion: 'campaign-calendar-v1',
      calendar: { revision: calendar.revision, daySeconds: calendar.daySeconds },
      toInstantMs: target,
      expectedFocusRevision: live.focusRevision,
      reason: 'Grenze des unterstützten Zeitbereichs',
    }),
    before = x.store.db.serialize();
  assert.equal(
    x.store.previewTime(x.w.token, {
      sceneId: x.a,
      kind: 'instant',
      instantMs: target,
      reason: 'Grenze prüfen',
    }).to,
    target,
  );
  assert.throws(() => x.store.executeLive(command), /Auffüllregel|Fälligkeit|Zeitbereich/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.store.shop(x.w.token, shop.id).shop.stock[0].restock.nextDueMs, '2');
});
