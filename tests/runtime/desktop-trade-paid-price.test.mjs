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
  outfile: '.build/planner-trade-price/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../../.build/planner-trade-price/store.cjs',
);
function setup(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'trade-price-')),
    file = path.join(root, 'store.sqlite');
  const x = { file, store: new CampaignStore(file) };
  x.campaign = x.store.create('Handel');
  x.w = x.store.activate(x.campaign.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.w.token,
    action,
  });
  x.character = x.store.executeLive(
    x.command({ kind: 'create-character', profile: { name: 'Iri' } }),
  ).character;
  const roster = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: x.character.id,
      expectedRevision: x.character.membershipRevision,
      expectedRosterRevision: roster.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: roster.focusRevision,
    }),
  );
  const live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }),
  );
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
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
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
        source: { kind: 'authored', label: 'Eigener Gegenstand', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
  const shop = {
    id: randomUUID(),
    revision: 0,
    name: 'Seilhandel',
    owner: { kind: 'location', id: location.id },
    notes: '  Notiz\r\n',
    trashed: false,
    stock: [
      {
        id: randomUUID(),
        reference: {
          kind: 'authored',
          definitionId: x.definition.id,
          revision: x.definition.revision,
        },
        quantity: 20,
        unique: false,
        instanceId: null,
        buyCopper: '100',
        sellCopper: '50',
        notes: '',
        restock: null,
      },
    ],
  };
  x.shop = x.store.executeItemShop(
    x.command({ kind: 'shop', shop, expectedRevision: null }),
  ).shop.shop;
  x.buy = (quantity, actualGold) => {
    const s = x.store.shop(x.w.token, x.shop.id).shop,
      c = x.store.live(x.w.token).roster.find((c) => c.id === x.character.id);
    const command = x.command({
      kind: 'purchase',
      shopId: s.id,
      expectedRevision: s.revision,
      entryId: s.stock[0].id,
      expectedDefinitionRevision: x.definition.revision,
      quantity,
      characterId: c.id,
      expectedMembershipRevision: c.membershipRevision,
      actualGold,
    });
    const ack = x.store.executeItemShop(command);
    return { command, ack, id: ack.ledgerIds[0] };
  };
  x.sell = (id, quantity, actualGold) => {
    const s = x.store.shop(x.w.token, x.shop.id).shop,
      l = x.store.ledgerItem(x.w.token, id),
      command = x.command({
        kind: 'sell',
        shopId: s.id,
        expectedRevision: s.revision,
        ledgerId: id,
        expectedLedgerRevision: l.revision,
        expectedDefinitionRevision: x.definition.revision,
        quantity,
        actualGold,
        notes: '  Teilverkauf\r\n',
      });
    return { command, ack: x.store.executeItemShop(command) };
  };
  x.entries = () =>
    x.store.db
      .prepare('SELECT id FROM character_ledger WHERE campaign_id=? ORDER BY rowid')
      .all(x.campaign.id)
      .map((r) => x.store.ledgerItem(x.w.token, r.id));
  x.reopen = () => {
    x.store.close();
    x.store = new CampaignStore(file);
    x.w = x.store.activate(x.campaign.id);
  };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
const paid = (rows) => rows.reduce((sum, l) => sum + BigInt(l.paidCopper ?? '0'), 0n);
for (const manual of [false, true])
  test(
    (manual ? 'manual ledger' : 'shop') +
      ' partial sales preserve the paid total through rounding, exact replay and Fresh',
    (t) => {
      const x = setup(t),
        purchase = x.buy(3, '1.01'),
        prices = ['0.07', '0.11', '0.13'],
        receipts = [];
      for (const actualGold of prices) {
        let command, ack;
        if (manual) {
          const l = x.store.ledgerItem(x.w.token, purchase.id);
          command = x.command({
            kind: 'ledger',
            entryId: l.id,
            expectedRevision: l.revision,
            operation: 'sold',
            quantity: 1,
            actualGold,
            counterparty: 'Torhandel',
            reason: 'Teilverkauf',
          });
          ack = x.store.executeProgress(command);
        } else ({ command, ack } = x.sell(purchase.id, 1, actualGold));
        assert.equal(paid(x.entries()), 101n);
        const before = readFileSync(x.file);
        const again = manual ? x.store.executeProgress(command) : x.store.executeItemShop(command);
        assert.deepEqual(again, JSON.parse(JSON.stringify(ack)));
        assert.equal(readFileSync(x.file).equals(before), true);
        receipts.push({ command, ack });
      }
      const rows = x.entries();
      assert.equal(rows.find((l) => l.id === purchase.id).quantity, 0);
      assert.equal(rows.find((l) => l.id === purchase.id).paidCopper, '0');
      assert.deepEqual(
        rows.filter((l) => l.status === 'sold').map((l) => l.paidCopper),
        ['33', '34', '34'],
      );
      assert.equal(
        rows
          .filter((l) => l.status === 'sold')
          .reduce((sum, l) => sum + BigInt(l.actualSaleCopper), 0n),
        31n,
      );
      const history = x.store.db
        .prepare("SELECT payload FROM progress_event WHERE campaign_id=? AND kind='shop-purchase'")
        .all(x.campaign.id)
        .map((r) => JSON.parse(r.payload));
      assert.equal(history[0].entry.paidCopper, '101');
      x.reopen();
      assert.equal(paid(x.entries()), 101n);
      for (const { command, ack } of receipts)
        assert.deepEqual(
          manual
            ? x.store.executeProgress({ ...command, token: x.w.token })
            : x.store.executeItemShop({ ...command, token: x.w.token }),
          JSON.parse(JSON.stringify(ack)),
        );
      assert.equal(
        x.store.lootBalance(x.w.token).characters.find((c) => c.characterId === x.character.id)
          .copper,
        '0',
      );
    },
  );
test('split then merge moves a paid price without leaving it on the emptied source', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01'),
    l = x.store.ledgerItem(x.w.token, purchase.id),
    split = x.store.executeProgress(
      x.command({
        kind: 'ledger-split',
        entryId: l.id,
        expectedRevision: l.revision,
        quantity: 1,
        reason: 'Aufteilen',
      }),
    ),
    portion = x.store.ledgerItem(x.w.token, split.ledgerIds[1]),
    remaining = x.store.ledgerItem(x.w.token, l.id);
  assert.equal(portion.paidCopper, '33');
  assert.equal(remaining.paidCopper, '68');
  x.store.executeProgress(
    x.command({
      kind: 'ledger-merge',
      entryId: remaining.id,
      expectedRevision: remaining.revision,
      sourceId: portion.id,
      expectedSourceRevision: portion.revision,
      reason: 'Zusammenführen',
    }),
  );
  assert.equal(paid(x.entries()), 101n);
  assert.equal(x.store.ledgerItem(x.w.token, portion.id).paidCopper, '0');
  assert.equal(x.store.ledgerItem(x.w.token, remaining.id).paidCopper, '101');
});
test('manual gift keeps a paid portion at its source without duplicating its cost', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01'),
    l = x.store.ledgerItem(x.w.token, purchase.id);
  x.store.executeProgress(
    x.command({
      kind: 'ledger',
      entryId: l.id,
      expectedRevision: l.revision,
      operation: 'given',
      quantity: 1,
      actualGold: '0',
      counterparty: 'Hafenwache',
      reason: 'Geschenk',
    }),
  );
  assert.equal(paid(x.entries()), 101n);
  assert.equal(x.entries().find((l) => l.status === 'given').paidCopper, '33');
});
test('transfer records the allocated price on the handoff, without counting it again at the recipient', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01'),
    recipient = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Dorn' } }),
    ).character,
    l = x.store.ledgerItem(x.w.token, purchase.id);
  x.store.executeProgress(
    x.command({
      kind: 'ledger-transfer',
      entryId: l.id,
      expectedRevision: l.revision,
      quantity: 1,
      characterId: recipient.id,
      expectedMembershipRevision: recipient.membershipRevision,
      reason: 'Weitergabe',
    }),
  );
  const rows = x.entries();
  assert.equal(paid(rows), 101n);
  assert.equal(rows.find((l) => l.status === 'given').paidCopper, '33');
  assert.equal(rows.find((l) => l.origin === 'transfer').paidCopper, undefined);
  assert.ok(x.store.lootBalance(x.w.token).characters.every((c) => c.copper === '0'));
});
test('merging with an absent recorded purchase price keeps the total unknown', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01'),
    l = x.store.ledgerItem(x.w.token, purchase.id),
    split = x.store.executeProgress(
      x.command({
        kind: 'ledger-split',
        entryId: l.id,
        expectedRevision: l.revision,
        quantity: 1,
        reason: 'Aufteilen',
      }),
    ),
    id = split.ledgerIds[1],
    row = x.store.db.prepare('SELECT payload FROM character_ledger WHERE id=?').get(id),
    old = JSON.parse(row.payload);
  // Absence is valid legacy/manual data, distinct from an explicitly paid zero.
  delete old.paidCopper;
  const payload = JSON.stringify(old);
  x.store.db
    .prepare('UPDATE character_ledger SET payload=?,checksum=? WHERE id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), id);
  const remaining = x.store.ledgerItem(x.w.token, l.id),
    source = x.store.ledgerItem(x.w.token, id);
  x.store.executeProgress(
    x.command({
      kind: 'ledger-merge',
      entryId: remaining.id,
      expectedRevision: remaining.revision,
      sourceId: source.id,
      expectedSourceRevision: source.revision,
      reason: 'Zusammenführen',
    }),
  );
  assert.equal(x.store.ledgerItem(x.w.token, remaining.id).paidCopper, undefined);
  x.reopen();
  assert.equal(x.store.ledgerItem(x.w.token, remaining.id).paidCopper, undefined);
});
test('zero and large purchase totals remain exact through a full shop sale', (t) => {
  const x = setup(t);
  for (const actualGold of ['0', '999999999999999.99']) {
    const purchase = x.buy(3, actualGold),
      before = x.store.ledgerItem(x.w.token, purchase.id).paidCopper,
      sale = x.sell(purchase.id, 3, '0.01');
    assert.equal(x.store.ledgerItem(x.w.token, purchase.id).paidCopper, '0');
    assert.equal(x.store.ledgerItem(x.w.token, sale.ack.ledgerIds[1]).paidCopper, before);
    assert.equal(
      x.entries().some((l) => l.category === 'coins'),
      false,
    );
  }
});
test('trade rollback and status recovery preserve one price allocation and receipt', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01'),
    s = x.store.shop(x.w.token, x.shop.id).shop,
    l = x.store.ledgerItem(x.w.token, purchase.id),
    command = x.command({
      kind: 'sell',
      shopId: s.id,
      expectedRevision: s.revision,
      ledgerId: l.id,
      expectedLedgerRevision: l.revision,
      expectedDefinitionRevision: x.definition.revision,
      quantity: 1,
      actualGold: '0.07',
      notes: 'Bestätigter Teilverkauf',
    }),
    ref = {
      family: 'items',
      commandId: command.commandId,
      campaignId: x.campaign.id,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ campaignId: command.campaignId, action: command.action }))
        .digest('hex'),
    };
  const rows = () =>
    ['shop', 'shop_event', 'character_ledger', 'progress_event', 'shop_receipt'].map((table) =>
      x.store.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    );
  x.store.db.exec(
    "CREATE TRIGGER controlled_trade_price_fault BEFORE UPDATE ON shop BEGIN SELECT RAISE(ABORT, 'controlled trade price fault'); END",
  );
  const before = rows();
  assert.throws(() => x.store.executeItemShop(command), /controlled trade price fault/);
  assert.deepEqual(rows(), before);
  assert.equal(x.store.commitStatus(ref, x.w.token).outcome, 'not-applied');
  x.store.db.exec('DROP TRIGGER controlled_trade_price_fault');
  const ack = x.store.executeItemShop(command);
  x.reopen();
  const snapshot = rows();
  assert.deepEqual(x.store.commitStatus(ref, x.w.token), { outcome: 'applied', value: ack });
  assert.deepEqual(rows(), snapshot);
  assert.equal(paid(x.entries()), 101n);
  assert.deepEqual(x.store.executeItemShop({ ...command, token: x.w.token }), ack);
  assert.deepEqual(rows(), snapshot);
});

test('older shop history stays reachable read-only across a new arrival between pages', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01');
  x.sell(purchase.id, 1, '0.07');
  const add = () => {
    const s = x.store.shop(x.w.token, x.shop.id).shop;
    return x.store.executeItemShop(
      x.command({
        kind: 'restock',
        shopId: s.id,
        expectedRevision: s.revision,
        entryId: s.stock[0].id,
        mode: 'add',
        quantity: 1,
        reason: 'Späterer Markttag',
      }),
    );
  };
  for (let i = 0; i < 55; i++) add();
  const original = x.store.db
    .prepare('SELECT id,payload,checksum FROM shop_event ORDER BY rowid DESC')
    .all();
  const first = x.store.shop(x.w.token, x.shop.id);
  assert.equal(first.history.length, 50);
  assert.equal(first.historyNext, first.history.at(-1).id);
  add();
  const before = x.store.db.serialize(),
    older = x.store.shopHistory(x.w.token, x.shop.id, first.historyNext);
  assert.equal(older.shopId, x.shop.id);
  assert.equal(older.next, null);
  assert.deepEqual(
    [...first.history, ...older.entries].map((h) => h.id),
    original.map((h) => h.id),
  );
  assert.equal(
    older.entries.find((h) => h.description.startsWith('Kauf:')).facts.entry.paidCopper,
    '101',
  );
  assert.equal(
    older.entries.find((h) => h.description.startsWith('Verkauf')).facts.entry.actualSaleCopper,
    '7',
  );
  assert.deepEqual(x.store.db.serialize(), before);
  x.reopen();
  assert.deepEqual(x.store.shopHistory(x.w.token, x.shop.id, first.historyNext), older);
});
test('history cursors are confined to the selected shop and current campaign', (t) => {
  const x = setup(t),
    other = { ...x.shop, id: randomUUID(), revision: 0, name: 'Anderer Laden' };
  x.store.executeItemShop(x.command({ kind: 'shop', shop: other, expectedRevision: null }));
  assert.equal(x.store.shopHistory(x.w.token, x.shop.id, null).shopId, x.shop.id);
  const cursor = x.store.shop(x.w.token, other.id).history[0].id,
    before = x.store.db.serialize();
  for (const after of ['', 1, {}, 'missing', cursor])
    assert.throws(() => x.store.shopHistory(x.w.token, x.shop.id, after));
  assert.deepEqual(x.store.db.serialize(), before);
  const campaign = x.store.create('Andere Kampagne'),
    active = x.store.activate(campaign.id);
  assert.throws(() => x.store.shopHistory(x.w.token, x.shop.id, null));
  assert.throws(() => x.store.shopHistory(active.token, x.shop.id, null));
});
test('a damaged older page fails without changing current history, prices or ledger', (t) => {
  const x = setup(t);
  for (let i = 0; i < 55; i++) {
    const s = x.store.shop(x.w.token, x.shop.id).shop;
    x.store.executeItemShop(
      x.command({
        kind: 'restock',
        shopId: s.id,
        expectedRevision: s.revision,
        entryId: s.stock[0].id,
        mode: 'add',
        quantity: 1,
        reason: 'Markttag',
      }),
    );
  }
  const view = x.store.shop(x.w.token, x.shop.id),
    oldest = x.store.db.prepare('SELECT id FROM shop_event ORDER BY rowid LIMIT 1').get().id;
  x.store.db.prepare('UPDATE shop_event SET payload=? WHERE id=?').run('{}', oldest);
  const before = x.store.db.serialize();
  assert.equal(view.history.length, 50);
  assert.throws(() => x.store.shopHistory(x.w.token, x.shop.id, view.historyNext), /beschädigt/);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('legacy shop receipts replay without adding history fields or rewriting their bytes', (t) => {
  const x = setup(t),
    purchase = x.buy(3, '1.01'),
    old = structuredClone(purchase.ack);
  delete old.shop.historyNext;
  const payload = JSON.stringify(old);
  x.store.db
    .prepare('UPDATE shop_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), purchase.command.commandId);
  const before = x.store.db.serialize();
  assert.deepEqual(x.store.executeItemShop(purchase.command), old);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(x.store.shop(x.w.token, x.shop.id).historyNext, null);
});
test('independent campaign copies remap continuation identities inside immutable shop receipts', async (t) => {
  const x = setup(t);
  x.buy(3, '1.01');
  for (let i = 0; i < 55; i++) {
    const s = x.store.shop(x.w.token, x.shop.id).shop;
    x.store.executeItemShop(
      x.command({
        kind: 'restock',
        shopId: s.id,
        expectedRevision: s.revision,
        entryId: s.stock[0].id,
        mode: 'add',
        quantity: 1,
        reason: 'Markttag ' + i,
      }),
    );
  }
  const snapshot = path.join(path.dirname(x.file), 'history-snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const source = x.store.db.serialize(),
    copy = new CampaignStore(path.join(path.dirname(x.file), 'copy.sqlite'));
  try {
    const campaign = copy.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = copy.activate(campaign.id),
      shop = copy.shops(w.token, false)[0],
      current = copy.shop(w.token, shop.id);
    const receipt = JSON.parse(
      copy.db
        .prepare(
          "SELECT payload FROM shop_receipt WHERE campaign_id=? AND json_extract(payload,'$.shop.shop.revision')=?",
        )
        .get(campaign.id, current.shop.revision).payload,
    ).shop;
    assert.notEqual(receipt.historyNext, x.store.shop(x.w.token, x.shop.id).historyNext);
    assert.equal(receipt.historyNext, receipt.history.at(-1).id);
    const older = copy.shopHistory(w.token, shop.id, receipt.historyNext);
    assert(older.entries.length > 0);
    assert.equal(older.next, null);
    assert.equal(
      new Set(
        [
          ...current.history,
          ...copy.shopHistory(w.token, shop.id, current.historyNext).entries,
        ].map((h) => h.id),
      ).size,
      57,
    );
    assert.deepEqual(x.store.db.serialize(), source);
  } finally {
    copy.close();
  }
});
