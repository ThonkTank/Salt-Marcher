import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/restock-journey-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/restock-journey-store.cjs');
function fixture(t, overflow = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'restock-journey-')),
    file = path.join(root, 'source.sqlite'),
    x = { root, file, store: new CampaignStore(file) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Zwei Reiseuhren');
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
  const definition = x.store.executeItemShop(
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
  x.a = x.store.executeLive(
    x.command({
      kind: 'initialize',
      expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
    }),
  ).scene.id;
  const a = x.store.liveScene(x.w.token, x.a),
    live = x.store.live(x.w.token);
  x.b = x.store.executeLive(
    x.command({
      kind: 'move',
      sceneId: x.a,
      memberIds: [characters[1].id],
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      expectedClockRevision: a.clock.revision,
      expectedSceneMembershipRevision: a.membershipRevision,
      target: { kind: 'new', title: 'Nachhut', expectedContentRevision: a.revision },
    }),
  ).session.createdScene.id;
  const mapId = x.store.world(x.w.token).maps[0].id;
  x.store.executeWorld(
    x.command({
      kind: 'map',
      expectedRevision: x.store.world(x.w.token).maps[0].revision,
      map: {
        id: mapId,
        revision: 0,
        name: 'Weg',
        hexMeters: 4828.032,
        climate: 'temperate',
        seed: 'fixed',
        cells: [],
      },
    }),
  );
  const b = x.store.liveScene(x.w.token, x.b);
  x.store.executeWorld(
    x.command({
      kind: 'place-scene',
      sceneId: x.b,
      position: { mapId: mapId, q: 0, r: 0, locationId: null },
      expectedSceneRevision: b.revision,
      expectedPositionRevision: x.store.sceneWorld(x.w.token, x.b).position.revision,
    }),
  );
  const preview = x.store.previewTravel(x.w.token, {
    sceneId: x.b,
    mapId,
    destination: { q: 3, r: 0 },
    destinationLocationId: null,
    waypoints: [],
    paceKmh: 1,
    factor: 1,
    finalSeconds: 9,
  });
  assert.deepEqual(preview.segmentSeconds, [3, 3, 3]);
  x.journey = x.store.executeWorld(x.command({ kind: 'journey', preview })).scene.journey;
  const entry = (id, quantity, restock) => ({
    id,
    reference: { kind: 'authored', definitionId: definition.id, revision: definition.revision },
    quantity,
    unique: false,
    instanceId: null,
    buyCopper: '100',
    sellCopper: '50',
    notes: '  Original\r\n',
    restock,
  });
  x.shop = x.store.executeItemShop(
    x.command({
      kind: 'shop',
      expectedRevision: null,
      shop: {
        id: randomUUID(),
        revision: 0,
        name: 'Marktstand',
        owner: { kind: 'location', id: location.id },
        notes: '  Bleibt\r\n',
        trashed: false,
        stock: [
          entry('add', 0, { mode: 'add', quantity: 1, intervalMs: '1000', nextDueMs: '1000' }),
          entry('fill', overflow ? 999998 : 0, {
            mode: overflow ? 'add' : 'fill',
            quantity: overflow ? 3 : 5,
            intervalMs: '5000',
            nextDueMs: '5000',
          }),
          entry('manual', 13, null),
        ],
      },
    }),
  ).shop.shop;
  x.step = (maxSteps) =>
    x.command({
      kind: 'journey-step',
      id: x.journey.id,
      expectedRevision: x.journey.revision,
      maxSteps,
    });
  x.history = () =>
    x.store.shop(x.w.token, x.shop.id).history.filter((e) => e.facts?.intervals !== undefined);
  x.reopen = () => {
    x.store.close();
    x.store = new CampaignStore(file);
    x.w = x.store.activate(x.cam.id);
  };
  return x;
}
test('journey restock survives another scene catching up, replay, restart and an independent copy', async (t) => {
  const x = fixture(t),
    step = x.step(2),
    focus = x.store.live(x.w.token).focusId;
  const result = x.store.executeWorld(step);
  assert.equal(result.scene.scene.id, x.b);
  assert.equal(x.store.live(x.w.token).focusId, focus);
  assert.equal(x.store.liveScene(x.w.token, x.a).clock.instantMs, '0');
  assert.equal(result.scene.scene.clock.instantMs, '6000');
  assert.deepEqual(
    x.store.shop(x.w.token, x.shop.id).shop.stock.map((e) => e.quantity),
    [6, 5, 13],
  );
  const beforeHistory = x.history();
  assert.equal(beforeHistory.length, 3);
  assert.deepEqual(
    beforeHistory.map((e) => [e.facts.firstDueMs, e.facts.lastDueMs, e.facts.intervals]),
    [
      ['5000', '5000', '1'],
      ['4000', '6000', '3'],
      ['1000', '3000', '3'],
    ],
  );
  let shop = x.store.shop(x.w.token, x.shop.id).shop;
  x.store.executeItemShop(
    x.command({
      kind: 'restock',
      shopId: shop.id,
      expectedRevision: shop.revision,
      entryId: 'add',
      mode: 'add',
      quantity: 7,
      reason: 'Explizite Korrektur',
    }),
  );
  shop = x.store.shop(x.w.token, x.shop.id).shop;
  x.store.executeItemShop(
    x.command({
      kind: 'shop',
      shop: {
        ...shop,
        stock: shop.stock.map((e) =>
          e.id === 'add' ? { ...e, restock: { ...e.restock, quantity: 2 } } : e,
        ),
      },
      expectedRevision: shop.revision,
    }),
  );
  const scene = x.store.liveScene(x.w.token, x.a);
  x.store.executeLive(
    x.command({
      kind: 'advance-clock',
      sceneId: x.a,
      expectedRevision: scene.clock.revision,
      amount: 6,
      unit: 'seconds',
      calendarVersion: 'relative-v1',
      reason: 'Nachholen',
    }),
  );
  assert.deepEqual(x.history(), beforeHistory);
  const state = x.store.shop(x.w.token, x.shop.id);
  x.reopen();
  x.store.executeWorld({ ...step, token: x.w.token });
  assert.deepEqual(x.store.shop(x.w.token, x.shop.id), state);
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    source = x.store.db.serialize(),
    copyFile = path.join(x.root, 'copy.sqlite');
  let copy = new CampaignStore(copyFile),
    campaign = copy.acceptCampaignSnapshot(snapshot, 'Unabhängig', {}),
    w = copy.activate(campaign.id);
  try {
    const shopId = copy.shops(w.token, false)[0].id,
      b = copy.live(w.token).scenes.find((s) => s.title === 'Nachhut').id,
      j = copy.sceneWorld(w.token, b).journey;
    assert.notEqual(shopId, x.shop.id);
    assert.notEqual(b, x.b);
    assert.notEqual(j.id, x.journey.id);
    assert.deepEqual(
      copy.shop(w.token, shopId).shop.stock.map((e) => [e.quantity, e.restock?.nextDueMs ?? null]),
      [
        [13, '7000'],
        [5, '10000'],
        [13, null],
      ],
    );
    const next = {
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action: { kind: 'journey-step', id: j.id, expectedRevision: j.revision, maxSteps: 1 },
    };
    copy.executeWorld(next);
    const final = copy.shop(w.token, shopId);
    assert.deepEqual(
      final.shop.stock.map((e) => e.quantity),
      [19, 5, 13],
    );
    assert.equal(copy.liveScene(w.token, b).clock.instantMs, '9000');
    assert.equal(final.history.filter((e) => e.facts?.intervals !== undefined).length, 4);
    assert.equal(final.history.find((e) => e.facts?.lastDueMs === '9000').facts.rule.quantity, 2);
    copy.close();
    copy = new CampaignStore(copyFile);
    w = copy.activate(campaign.id);
    copy.executeWorld({ ...next, token: w.token });
    assert.deepEqual(copy.shop(w.token, shopId), final);
    assert.ok(x.store.db.serialize().equals(source));
    assert.ok(readFileSync(snapshot).equals(bytes));
  } finally {
    copy.close();
  }
});

function history(x, direction) {
  const s = x.store.sceneWorld(x.w.token, x.b),
    h = s.travelHistory[direction];
  assert(h);
  return x.command({
    kind: 'travel-history',
    sceneId: x.b,
    id: h.id,
    revision: h.revision,
    direction,
    expectedClockRevision: s.scene.clock.revision,
    expectedPositionRevision: s.position.revision,
    expectedJourneyRevision: s.journey.revision,
  });
}
test('checkpoint undo reverses only its restock and redo restores the exact stock and event identities', (t) => {
  const x = fixture(t);
  x.store.executeWorld(x.step(2));
  const arrived = x.store.shop(x.w.token, x.shop.id),
    events = x.history();
  let shop = arrived.shop;
  x.store.executeItemShop(
    x.command({
      kind: 'shop',
      expectedRevision: shop.revision,
      shop: { ...shop, notes: '  Späterer Autorenhinweis\r\n' },
    }),
  );
  x.store.executeWorld(history(x, 'undo'));
  const undone = x.store.shop(x.w.token, x.shop.id);
  assert.deepEqual(
    undone.shop.stock.map((e) => e.quantity),
    [3, 0, 13],
  );
  assert.equal(undone.shop.notes, '  Späterer Autorenhinweis\r\n');
  assert.equal(x.history().length, 1);
  x.store.executeWorld(history(x, 'redo'));
  const redone = x.store.shop(x.w.token, x.shop.id);
  assert.deepEqual(redone.shop.stock, arrived.shop.stock);
  assert.deepEqual(new Set(x.history().map((e) => e.id)), new Set(events.map((e) => e.id)));
  assert.equal(redone.shop.notes, '  Späterer Autorenhinweis\r\n');
});
test('undo keeps shared restock facts established by a later authoritative scene while rewinding its own clock and knowledge', (t) => {
  const x = fixture(t);
  x.store.executeWorld(x.step(2));
  const a = x.store.liveScene(x.w.token, x.a);
  x.store.executeLive(
    x.command({
      kind: 'advance-clock',
      sceneId: x.a,
      expectedRevision: a.clock.revision,
      amount: 8,
      unit: 'seconds',
      calendarVersion: 'relative-v1',
      reason: 'Vorhut ist weiter',
    }),
  );
  const shared = x.store.shop(x.w.token, x.shop.id),
    other = x.store.liveScene(x.w.token, x.a);
  x.store.executeWorld(history(x, 'undo'));
  const s = x.store.sceneWorld(x.w.token, x.b);
  assert.equal(s.scene.clock.instantMs, '3000');
  assert.equal(s.position.q, 1);
  assert(!s.knowledge.some((h) => h.q === 2 && h.r === 0));
  assert.deepEqual(x.store.shop(x.w.token, x.shop.id), shared);
  assert.deepEqual(x.store.liveScene(x.w.token, x.a), other);
  x.store.executeWorld(history(x, 'redo'));
  assert.deepEqual(x.store.shop(x.w.token, x.shop.id), shared);
  assert.equal(x.store.liveScene(x.w.token, x.b).clock.instantMs, '6000');
});
test('a later segment restock failure rolls back earlier journey segments and every clock receipt', (t) => {
  const x = fixture(t, true),
    step = x.step(2),
    before = x.store.db.serialize();
  assert.throws(() => x.store.executeWorld(step), /Bestandsgrenze/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.store.sceneWorld(x.w.token, x.b).journey.nextIndex, 1);
  assert.equal(x.store.liveScene(x.w.token, x.b).clock.instantMs, '0');
  assert.equal(x.store.sceneWorld(x.w.token, x.b).position.q, 0);
  assert.equal(x.history().length, 0);
  assert.equal(
    x.store.db.prepare('SELECT 1 FROM world_receipt WHERE command_id=?').get(step.commandId),
    undefined,
  );
  assert.equal(
    x.store.db
      .prepare('SELECT 1 FROM live_receipt WHERE command_id LIKE ?')
      .get(step.commandId + ':clock:%'),
    undefined,
  );
});

for (const [name, damage] of [
  [
    'nonadjacent route',
    (j) => {
      j.route[1] = { q: 50, r: 0 };
    },
  ],
  [
    'negative segment',
    (j) => {
      j.segmentSeconds[0] = -1;
    },
  ],
  [
    'missing segment',
    (j) => {
      j.segmentSeconds.pop();
    },
  ],
  [
    'contradictory duration',
    (j) => {
      j.plannedSeconds++;
    },
  ],
  [
    'rounded total',
    (j) => {
      j.segmentSeconds = [Number.MAX_SAFE_INTEGER, 2, 2];
      j.plannedSeconds = j.segmentSeconds.reduce((sum, n) => sum + n, 0);
      j.finalSeconds = null;
    },
  ],
  [
    'invalid checkpoint',
    (j) => {
      j.nextIndex = 0;
    },
  ],
  [
    'early arrival',
    (j) => {
      j.status = 'arrived';
    },
  ],
])
  for (const boundary of ['read', 'write', 'backup'])
    test(`stored journey ${name} is rejected at the ${boundary} boundary without replacing original data`, async (t) => {
      const x = fixture(t),
        safe = path.join(x.root, 'safe.sqlite');
      await x.store.backup(safe);
      const safeBytes = readFileSync(safe),
        broken = structuredClone(x.journey);
      damage(broken);
      const payload = JSON.stringify(broken);
      x.store.db
        .prepare(
          'UPDATE world_journey SET status=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
        )
        .run(
          broken.status,
          payload,
          createHash('sha256').update(payload).digest('hex'),
          x.cam.id,
          x.journey.id,
        );
      const original = x.store.db.serialize();
      if (boundary === 'read')
        assert.throws(
          () => x.store.sceneWorld(x.w.token, x.b),
          /Reise|Route|Abschnitt|Zeit|Checkpoint/,
        );
      else if (boundary === 'write')
        assert.throws(
          () =>
            x.store.executeWorld(
              x.command({
                kind: 'journey-state',
                id: x.journey.id,
                expectedRevision: x.journey.revision,
                state: 'ended',
              }),
            ),
          /Reise|Route|Abschnitt|Zeit|Checkpoint/,
        );
      else {
        await assert.rejects(() => x.store.backup(safe), /Reise|Route|Abschnitt|Zeit|Checkpoint/);
        assert.ok(readFileSync(safe).equals(safeBytes));
      }
      assert.ok(x.store.db.serialize().equals(original));
    });

for (const state of ['paused', 'ended', 'arrived', 'interrupted-at-destination'])
  test(`valid journey ${state} stays readable through backup and restart`, async (t) => {
    const x = fixture(t);
    if (state === 'paused' || state === 'ended')
      x.store.executeWorld(
        x.command({
          kind: 'journey-state',
          id: x.journey.id,
          expectedRevision: x.journey.revision,
          state,
        }),
      );
    else {
      if (state === 'interrupted-at-destination') {
        const map = x.store.world(x.w.token).maps[0];
        x.store.executeWorld(
          x.command({
            kind: 'cell',
            mapId: map.id,
            expectedRevision: map.revision,
            cell: {
              q: 3,
              r: 0,
              level: 0,
              terrain: 'plains',
              elevationM: 0,
              climate: null,
              road: false,
              river: false,
              label: '',
              faction: '',
              interrupt: 'GM-Entscheidung am Ziel',
            },
          }),
        );
        const preview = x.store.previewTravel(x.w.token, {
          sceneId: x.b,
          mapId: map.id,
          destination: { q: 3, r: 0 },
          destinationLocationId: null,
          waypoints: [],
          paceKmh: 1,
          factor: 1,
          finalSeconds: 9,
        });
        x.journey = x.store.executeWorld(x.command({ kind: 'journey', preview })).scene.journey;
      }
      x.store.executeWorld(x.step(3));
    }
    const before = x.store.sceneWorld(x.w.token, x.b).journey;
    assert.equal(before.status, state === 'interrupted-at-destination' ? 'interrupted' : state);
    if (state === 'interrupted-at-destination') assert.equal(before.nextIndex, before.route.length);
    const safe = path.join(x.root, 'safe.sqlite');
    await x.store.backup(safe);
    x.reopen();
    assert.deepEqual(x.store.sceneWorld(x.w.token, x.b).journey, before);
    if (state === 'interrupted-at-destination') {
      const resumed = x.store.executeWorld(
        x.command({
          kind: 'journey-state',
          id: before.id,
          expectedRevision: before.revision,
          state: 'active',
        }),
      ).scene.journey;
      assert.equal(resumed.status, 'arrived');
      assert.equal(x.store.liveScene(x.w.token, x.b).clock.instantMs, '9000');
    }
  });

test('an exactly represented large journey total retains its stored format through read and backup', async (t) => {
  const x = fixture(t),
    large = {
      ...x.journey,
      segmentSeconds: [4503599627370496, 4503599627370496, 2],
      plannedSeconds: 9007199254740994,
      finalSeconds: null,
    },
    payload = JSON.stringify(large);
  x.store.db
    .prepare('UPDATE world_journey SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, large.id);
  assert.deepEqual(x.store.sceneWorld(x.w.token, x.b).journey, large);
  await x.store.backup(path.join(x.root, 'large-safe.sqlite'));
  assert.equal(
    x.store.db.prepare('SELECT payload FROM world_journey WHERE id=?').get(large.id).payload,
    payload,
  );
});

test('weighted shop deliveries retain their rule, apply once with time and survive independent copy', async (t) => {
  const x = fixture(t),
    clock = x.store.liveScene(x.w.token, x.a).clock;
  const table = {
    id: randomUUID(),
    revision: 0,
    name: 'Seillieferung',
    seed: 'fixed-market-seed',
    rolls: 3,
    entries: [
      { entryId: 'add', weight: '1', minimum: 2, maximum: 2 },
      { entryId: 'fill', weight: '0', minimum: 9, maximum: 9 },
    ],
    schedule: { intervalMs: '1000', nextDueMs: '0' },
  };
  let shop = x.store.executeItemShop(
    x.command({
      kind: 'shop',
      expectedRevision: x.shop.revision,
      scheduleClock: { sceneId: x.a, expectedRevision: clock.revision },
      shop: {
        ...x.shop,
        stock: x.shop.stock.map((e) => ({ ...e, restock: null })),
        restockTables: [table],
      },
    }),
  ).shop.shop;
  assert.equal(shop.restockTables[0].revision, 1);
  assert.equal(shop.restockTables[0].schedule.nextDueMs, '1000');
  const manual = x.command({
    kind: 'random-restock',
    shopId: shop.id,
    expectedRevision: shop.revision,
    tableId: table.id,
    expectedTableRevision: 1,
  });
  x.store.executeItemShop(manual);
  x.store.executeItemShop(manual);
  assert.deepEqual(
    x.store.shop(x.w.token, shop.id).shop.stock.map((e) => e.quantity),
    [6, 0, 13],
  );
  const advance = x.command({
    kind: 'advance-clock',
    sceneId: x.a,
    expectedRevision: clock.revision,
    amount: 5,
    unit: 'seconds',
    calendarVersion: 'relative-v1',
    reason: 'Warenmarkt',
  });
  x.store.executeLive(advance);
  x.store.executeLive(advance);
  const view = x.store.shop(x.w.token, shop.id);
  assert.deepEqual(
    view.shop.stock.map((e) => e.quantity),
    [36, 0, 13],
  );
  assert.equal(view.shop.restockTables[0].schedule.nextDueMs, '6000');
  const fact = view.history.find((h) => h.facts?.tableId === table.id && h.facts.intervals)?.facts;
  assert.equal(fact.tableRevision, 1);
  assert.equal(fact.intervals, '5');
  assert.equal(fact.outcomes[0].added, 30);
  assert.equal(fact.seed, table.seed);
  x.reopen();
  assert.deepEqual(x.store.shop(x.w.token, shop.id), view);
  const snapshot = path.join(x.root, 'weighted-snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = new CampaignStore(path.join(x.root, 'weighted-copy.sqlite'));
  try {
    const campaign = copy.acceptCampaignSnapshot(snapshot, 'Anderer Markt', {}),
      w = copy.activate(campaign.id),
      id = copy.shops(w.token, false)[0].id,
      cloned = copy.shop(w.token, id).shop;
    assert.notEqual(id, shop.id);
    assert.notEqual(cloned.restockTables[0].id, table.id);
    assert.equal(cloned.restockTables[0].seed, table.seed);
    assert(
      cloned.restockTables[0].entries.every((e) => cloned.stock.some((s) => s.id === e.entryId)),
    );
    assert.deepEqual(
      cloned.stock.map((e) => e.quantity),
      [36, 0, 13],
    );
  } finally {
    copy.close();
  }
});

test('calendar deliveries follow bound event revisions once across clocks, renewal and campaign copy', async (t) => {
  const x = fixture(t),
    recurringId = randomUUID(),
    onceId = randomUUID();
  const saveEvent = (id, changes = {}) => {
    const old = x.store.world(x.w.token).events.find((e) => e.id === id);
    x.store.executeWorld(
      x.command({
        kind: 'calendar-event',
        expectedRevision: old?.revision ?? null,
        event: {
          id,
          revision: 0,
          name: id === onceId ? 'Eröffnung' : 'Hafenschiff',
          startMs: id === onceId ? '3000' : '2000',
          durationMs: '1000',
          repeatMs: id === onceId ? null : '3000',
          locationId: null,
          notes: '',
          trashed: false,
          ...old,
          ...changes,
        },
      }),
    );
    return x.store.world(x.w.token).events.find((e) => e.id === id);
  };
  let event = saveEvent(recurringId),
    once = saveEvent(onceId),
    clock = x.store.liveScene(x.w.token, x.a).clock;
  const table = (e, entryId, rolls) => ({
    id: randomUUID(),
    revision: 0,
    name: e.name,
    seed: 'calendar-delivery',
    rolls,
    entries: [{ entryId, weight: '1', minimum: 2, maximum: 2 }],
    schedule: { eventId: e.id, eventRevision: e.revision, repeatMs: e.repeatMs, nextDueMs: '0' },
  });
  let shop = x.store.executeItemShop(
    x.command({
      kind: 'shop',
      expectedRevision: x.shop.revision,
      scheduleClock: { sceneId: x.a, expectedRevision: clock.revision },
      shop: {
        ...x.shop,
        stock: x.shop.stock.map((e) => ({ ...e, restock: null })),
        restockTables: [table(event, 'add', 2), table(once, 'fill', 1)],
      },
    }),
  ).shop.shop;
  const advance = (sceneId, amount) => {
    const scene = x.store.liveScene(x.w.token, sceneId),
      c = x.command({
        kind: 'advance-clock',
        sceneId,
        expectedRevision: scene.clock.revision,
        amount,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Warenkalender',
      });
    x.store.executeLive(c);
    x.store.executeLive(c);
  };
  advance(x.a, 8);
  let view = x.store.shop(x.w.token, shop.id);
  assert.deepEqual(
    view.shop.stock.map((e) => e.quantity),
    [12, 2, 13],
  );
  assert.equal(view.shop.restockTables[0].schedule.nextDueMs, '11000');
  assert.equal(view.shop.restockTables[1].schedule.nextDueMs, null);
  const fact = view.history.find((h) => h.facts?.eventId === event.id)?.facts;
  assert.equal(fact.eventRevision, 1);
  assert.equal(fact.eventName, 'Hafenschiff');
  assert.equal(fact.firstDueMs, '2000');
  assert.equal(fact.lastDueMs, '8000');
  assert.equal(fact.intervals, '3');
  assert.equal(fact.outcomes[0].added, 12);
  assert.equal(fact.rule.schedule.nextDueMs, '2000');
  x.store.executeWorld(x.step(2));
  assert.deepEqual(x.store.shop(x.w.token, shop.id).shop.stock, view.shop.stock);
  event = saveEvent(recurringId, { startMs: '9000', repeatMs: '2000', name: 'Neues Hafenschiff' });
  advance(x.a, 4);
  view = x.store.shop(x.w.token, shop.id);
  assert.equal(view.shop.stock[0].quantity, 12);
  assert.equal(view.restockEvents.find((e) => e.id === event.id).revision, 2);
  shop = view.shop;
  shop.restockTables[0].schedule = {
    eventId: event.id,
    eventRevision: event.revision,
    repeatMs: event.repeatMs,
    nextDueMs: '0',
  };
  clock = x.store.liveScene(x.w.token, x.a).clock;
  shop = x.store.executeItemShop(
    x.command({
      kind: 'shop',
      expectedRevision: shop.revision,
      shop,
      scheduleClock: { sceneId: x.a, expectedRevision: clock.revision },
    }),
  ).shop.shop;
  assert.equal(shop.restockTables[0].revision, 2);
  assert.equal(shop.restockTables[0].schedule.nextDueMs, '13000');
  advance(x.a, 2);
  view = x.store.shop(x.w.token, shop.id);
  assert.equal(view.shop.stock[0].quantity, 16);
  assert.equal(view.shop.restockTables[0].schedule.nextDueMs, '15000');
  const snapshot = path.join(x.root, 'calendar-delivery.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = new CampaignStore(path.join(x.root, 'calendar-copy.sqlite'));
  try {
    const c = copy.acceptCampaignSnapshot(snapshot, 'Unabhängige Termine', {}),
      w = copy.activate(c.id),
      id = copy.shops(w.token, false)[0].id,
      cloned = copy.shop(w.token, id).shop,
      eventId = cloned.restockTables[0].schedule.eventId;
    assert.notEqual(eventId, event.id);
    assert(copy.world(w.token).events.some((e) => e.id === eventId && e.revision === 2));
    assert.equal(cloned.stock[0].quantity, 16);
    assert.equal(cloned.restockTables[1].schedule.nextDueMs, null);
  } finally {
    copy.close();
  }
  saveEvent(recurringId, { trashed: true });
  advance(x.a, 2);
  assert.equal(x.store.shop(x.w.token, shop.id).shop.stock[0].quantity, 16);
  x.reopen();
  assert.equal(x.store.shop(x.w.token, shop.id).shop.stock[0].quantity, 16);
  assert.equal(x.store.shop(x.w.token, shop.id).shop.restockTables[1].schedule.nextDueMs, null);
});

test('catalog deliveries expand dynamically, preserve existing prices, record empty runs and survive copy', async (t) => {
  const x = fixture(t),
    original = x.store.itemDefinition(x.shop.stock[0].reference.definitionId);
  const item = (name, changes = {}) =>
    x.store.executeItemShop(
      x.command({
        kind: 'definition',
        expectedRevision: null,
        definition: {
          ...original,
          id: randomUUID(),
          revision: 0,
          name,
          category: 'magic',
          magic: true,
          rarity: 'rare',
          attunement: 'yes',
          properties: ['Hafenlieferung'],
          ...changes,
        },
      }),
    ).definition;
  const first = x.store.executeItemShop(
    x.command({
      kind: 'definition',
      expectedRevision: original.revision,
      definition: {
        ...original,
        category: 'magic',
        magic: true,
        rarity: 'rare',
        attunement: 'yes',
        properties: ['Hafenlieferung'],
      },
    }),
  ).definition;
  item('Nicht passend', { magic: false });
  const clock = x.store.liveScene(x.w.token, x.a).clock;
  const table = {
    id: randomUUID(),
    revision: 0,
    name: 'Hafenwaren',
    seed: 'catalog-seed',
    rolls: 1,
    entries: [],
    catalog: {
      filter: {
        search: 'Hafenlieferung',
        category: 'magic',
        magic: 'yes',
        rarity: 'rare',
        attunement: 'yes',
        source: 'authored',
      },
      minimum: 2,
      maximum: 2,
      buyCopper: '777',
      sellCopper: '333',
    },
    schedule: { intervalMs: '1000', nextDueMs: '0' },
  };
  let shop = x.store.executeItemShop(
    x.command({
      kind: 'shop',
      shop: {
        ...x.shop,
        stock: x.shop.stock.map((e) => ({ ...e, restock: null })),
        restockTables: [table],
      },
      expectedRevision: x.shop.revision,
      scheduleClock: { sceneId: x.a, expectedRevision: clock.revision },
    }),
  ).shop.shop;
  const manual = x.command({
    kind: 'random-restock',
    shopId: shop.id,
    expectedRevision: shop.revision,
    tableId: table.id,
    expectedTableRevision: 1,
  });
  x.store.executeItemShop(manual);
  x.store.executeItemShop(manual);
  let view = x.store.shop(x.w.token, shop.id);
  assert.equal(view.shop.stock.length, 3);
  assert.equal(view.shop.stock[0].quantity, 2);
  assert.equal(view.shop.stock[0].buyCopper, '100');
  assert.equal(view.shop.stock[0].notes, '  Original\r\n');
  const receipt = view.history.find((h) => h.facts?.catalogPool)?.facts;
  assert.equal(receipt.catalogPool.eligible, 1);
  assert.equal(receipt.outcomes[0].reference.revision, first.revision);
  assert.equal(receipt.outcomes[0].name, 'Seil');
  assert.equal(receipt.rule.catalog.filter.search, 'Hafenlieferung');
  const second = item('Laterne vom Hafen');
  x.store.executeItemShop(
    x.command({
      kind: 'definition-trash',
      id: first.id,
      expectedRevision: first.revision,
      trashed: true,
    }),
  );
  const advance = () => {
    const scene = x.store.liveScene(x.w.token, x.a);
    x.store.executeLive(
      x.command({
        kind: 'advance-clock',
        sceneId: x.a,
        expectedRevision: scene.clock.revision,
        amount: 1,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Neue Hafenwaren',
      }),
    );
  };
  advance();
  view = x.store.shop(x.w.token, shop.id);
  const added = view.shop.stock.find((s) => s.reference.definitionId === second.id);
  assert.equal(added.quantity, 2);
  assert.equal(added.buyCopper, '777');
  assert.equal(added.sellCopper, '333');
  assert.equal(view.shop.stock[0].quantity, 2);
  assert(view.history.some((h) => h.description.includes('Laterne vom Hafen +2')));
  x.store.executeItemShop(
    x.command({
      kind: 'definition-trash',
      id: second.id,
      expectedRevision: second.revision,
      trashed: true,
    }),
  );
  advance();
  view = x.store.shop(x.w.token, shop.id);
  assert.equal(view.shop.restockTables[0].schedule.nextDueMs, '3000');
  assert.equal(
    view.history.find((h) => h.facts?.lastDueMs === '2000').facts.catalogPool.eligible,
    0,
  );
  assert.deepEqual(view.history.find((h) => h.facts?.lastDueMs === '2000').facts.outcomes, []);
  assert.equal(
    view.history.find((h) => h.facts?.outcomes?.[0]?.reference.definitionId === first.id).facts
      .outcomes[0].reference.revision,
    first.revision,
  );
  const expected = view.shop;
  x.reopen();
  assert.deepEqual(x.store.shop(x.w.token, shop.id).shop, expected);
  const snapshot = path.join(x.root, 'catalog-delivery.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = new CampaignStore(path.join(x.root, 'catalog-copy.sqlite'));
  try {
    const cam = copy.acceptCampaignSnapshot(snapshot, 'Katalogkopie', {}),
      w = copy.activate(cam.id),
      id = copy.shops(w.token, false)[0].id,
      cloned = copy.shop(w.token, id).shop;
    assert.deepEqual(cloned.restockTables[0].catalog, table.catalog);
    assert.equal(cloned.stock.find((s) => s.reference.definitionId === second.id).quantity, 2);
  } finally {
    copy.close();
  }
});

for (const trigger of ['interval', 'event'])
  test(`renaming a ${trigger} delivery preserves its cursor without requiring a new clock`, (t) => {
    const x = fixture(t),
      day = 86400000,
      eventId = randomUUID();
    if (trigger === 'event')
      x.store.executeWorld(
        x.command({
          kind: 'calendar-event',
          expectedRevision: null,
          event: {
            id: eventId,
            revision: 0,
            name: 'Marktschiff',
            startMs: String(day),
            durationMs: '1000',
            repeatMs: String(day),
            locationId: null,
            notes: '',
            trashed: false,
          },
        }),
      );
    const clock = x.store.liveScene(x.w.token, x.a).clock,
      table = {
        id: randomUUID(),
        revision: 0,
        name: 'Lieferung',
        seed: 'stable-market',
        rolls: 1,
        entries: [{ entryId: 'add', weight: '1', minimum: 2, maximum: 2 }],
        schedule:
          trigger === 'event'
            ? { eventId, eventRevision: 1, repeatMs: String(day), nextDueMs: '0' }
            : { intervalMs: String(day), nextDueMs: '0' },
      };
    let shop = x.store.executeItemShop(
      x.command({
        kind: 'shop',
        expectedRevision: x.shop.revision,
        scheduleClock: { sceneId: x.a, expectedRevision: clock.revision },
        shop: {
          ...x.shop,
          stock: x.shop.stock.map((e) => ({ ...e, restock: null })),
          restockTables: [table],
        },
      }),
    ).shop.shop;
    const advance = (id, hours) => {
      const s = x.store.liveScene(x.w.token, id);
      return x.store.executeLive(
        x.command({
          kind: 'advance-clock',
          sceneId: id,
          expectedRevision: s.clock.revision,
          amount: hours,
          unit: 'hours',
          calendarVersion: 'relative-v1',
          reason: 'Warenlieferung',
        }),
      );
    };
    advance(x.a, 12);
    const original = structuredClone(shop.restockTables[0]);
    shop.restockTables[0].name = 'Hafenlieferung';
    const rename = x.command({ kind: 'shop', expectedRevision: shop.revision, shop });
    x.store.executeItemShop(rename);
    x.store.executeItemShop(rename);
    shop = x.store.shop(x.w.token, shop.id).shop;
    assert.deepEqual(shop.restockTables[0], { ...original, name: 'Hafenlieferung', revision: 2 });
    advance(x.a, 36);
    const supplied = x.store.shop(x.w.token, shop.id);
    assert.deepEqual(
      supplied.shop.stock.map((e) => e.quantity),
      [4, 0, 13],
    );
    assert.equal(supplied.shop.restockTables[0].schedule.nextDueMs, String(day * 3));
    const history = supplied.history.filter(
      (h) => h.facts?.tableId === table.id && h.facts.intervals,
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].facts.intervals, '2');
    assert.equal(history[0].facts.firstDueMs, String(day));
    assert.equal(history[0].facts.rule.name, 'Hafenlieferung');
    assert.equal(history[0].facts.tableRevision, 2);
    advance(x.b, 48);
    assert.deepEqual(x.store.shop(x.w.token, shop.id), supplied);
    x.reopen();
    assert.deepEqual(x.store.shop(x.w.token, shop.id), supplied);
    const change = structuredClone(supplied.shop);
    change.restockTables[0].seed = 'new-seed';
    assert.throws(
      () =>
        x.store.executeItemShop(
          x.command({ kind: 'shop', expectedRevision: change.revision, shop: change }),
        ),
      /Scenezeit|Zeitbasis/,
    );
  });
