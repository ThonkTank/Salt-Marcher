import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseHTML } from '../helpers/dom.mjs';
for (const [entry, out] of [
  ['src/app/runtime/party-loot-ui.ts', 'party-personal-loot-ui'],
  ['src/app/storage/store.ts', 'party-personal-loot-store'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/party-personal-loot-store.cjs'),
  { PartyLootPanel } = require('../../.build/party-personal-loot-ui.cjs'),
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 250; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'UI did not settle');
}
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/party-personal-loot-'),
    file = root + '/work.sqlite',
    store = new CampaignStore(file),
    cam = store.create('Beute'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const heroes = ['Ada', 'Ada'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  for (const [i, c] of heroes.entries())
    store.executeProgress(
      command({
        kind: 'manual-item',
        characterId: c.id,
        expectedMembershipRevision: c.membershipRevision,
        origin: 'manual',
        item: {
          name: i ? 'Fremder Schlüssel' : 'Silberner Schlüssel',
          quantity: 7,
          category: 'equipment',
          valueGold: '2',
        },
        note: 'Erbstück',
      }),
    );
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><section id="root"></section></body></html>');
  Object.assign(globalThis, { window, document });
  window.campaign = {
    ledger: async (token, q) => ({ ok: true, value: store.ledger(token, q) }),
    ledgerItem: async (token, id) => ({ ok: true, value: store.ledgerItem(token, id) }),
    progressHistory: async (token, id, after) => ({
      ok: true,
      value: store.progressHistory(token, id, after),
    }),
  };
  const sent = [],
    panel = new PartyLootPanel(
      document.getElementById('root'),
      async (token, action, current) => {
        assert.equal(current(), true);
        sent.push(action);
        store.executeProgress(command(action));
      },
      () => {},
    ),
    get = (id) => document.getElementById('party-loot-' + id),
    item = () => get('list').querySelector('button');
  Object.defineProperty(get('filter'), 'value', { value: '', writable: true });
  t.after(() => {
    panel.close();
    store.close();
    Object.assign(globalThis, previous);
    rmSync(root, { recursive: true, force: true });
  });
  const open = async (id = heroes[0].id) => {
    panel.open(w.token, id, 'Ada', () => true);
    await until(() => get('status').textContent === '');
  };
  return { store, file, w, heroes, command, window, document, panel, get, item, open, sent };
}
test('same-name member ledger corrects only its selected canonical item, retains a factual history and survives Fresh', async (t) => {
  const x = fixture(t);
  await x.open();
  assert.match(x.get('list').textContent, /Silberner Schlüssel/);
  assert.doesNotMatch(x.get('list').textContent, /Fremder/);
  const live = x.store.live(x.w.token),
    progress = x.store.progress(x.w.token);
  x.item().click();
  await until(() => !x.get('form').querySelector('button').disabled);
  x.get('quantity').value = '3';
  x.get('reason').value = '  Tatsächliche Menge am Tisch geprüft  ';
  x.get('form').onsubmit({ preventDefault() {} });
  await until(() => x.sent.length === 1 && x.get('form').hidden);
  await until(() => x.get('status').textContent === '');
  assert.match(x.get('list').textContent, /3 × Silberner/);
  assert.deepEqual(x.store.live(x.w.token), live);
  assert.deepEqual(x.store.progress(x.w.token), progress);
  const history = x.get('history');
  history.open = true;
  history.ontoggle();
  await until(() => history.textContent.includes('Menge 7 → 3'));
  assert.match(history.textContent, /Tatsächliche Menge/);
  const other = x.store.ledger(x.w.token, {
    characterId: x.heroes[1].id,
    search: '',
    status: '',
    after: null,
  });
  assert.equal(other.items[0].quantity, 7);
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(live.campaignId ?? x.store.workspace().campaign.id);
    assert.equal(
      fresh.ledger(w.token, { characterId: x.heroes[0].id, search: '', status: '', after: null })
        .items[0].quantity,
      3,
    );
  } finally {
    fresh.close();
  }
});
test('late member/detail replies cannot republish another member or authorize correction after reopening', async (t) => {
  const x = fixture(t);
  await x.open();
  const first = x.item().dataset.ledgerId,
    old = await x.window.campaign.ledgerItem(x.w.token, first);
  let release;
  x.window.campaign.ledgerItem = () => new Promise((r) => (release = r));
  x.item().click();
  assert.equal(x.get('form').querySelector('button').disabled, true);
  await x.open(x.heroes[1].id);
  release(old);
  await tick();
  assert.equal(x.get('form').hidden, true);
  assert.match(x.get('list').textContent, /Fremder/);
  assert.equal(x.sent.length, 0);
});
test('a foreign detail and a failed read leave no writable item; retry is read-only', async (t) => {
  const x = fixture(t);
  await x.open();
  const other = x.store.ledger(x.w.token, {
    characterId: x.heroes[1].id,
    search: '',
    status: '',
    after: null,
  }).items[0];
  x.window.campaign.ledgerItem = async () => ({ ok: true, value: other });
  x.item().click();
  await until(() => x.get('detail-status').textContent.includes('gewählten Figur'));
  assert.equal(x.get('form').querySelector('button').disabled, true);
  const before = x.store.db.serialize(),
    read = x.window.campaign.ledger;
  x.window.campaign.ledger = async () => ({ ok: false, error: 'Datenträger nicht lesbar' });
  x.get('search').oninput();
  await until(() => x.get('status').textContent.includes('nicht verfügbar'));
  x.window.campaign.ledger = read;
  x.panel.close();
  await x.open();
  assert.equal(x.sent.length, 0);
  assert.ok(x.store.db.serialize().equals(before));
});
test('failed correction keeps entered quantity and reason; blank quantity is not treated as zero', async (t) => {
  const x = fixture(t);
  await x.open();
  x.item().click();
  await until(() => !x.get('form').querySelector('button').disabled);
  x.get('quantity').value = '';
  x.get('reason').value = 'Prüfung';
  x.get('form').onsubmit({ preventDefault() {} });
  await tick();
  assert.equal(x.sent.length, 0);
  x.get('quantity').value = '2';
  x.panel.commit = async () => {
    throw Error('Buchung nicht bestätigt');
  };
  x.get('form').onsubmit({ preventDefault() {} });
  await until(() => x.get('detail-status').textContent.includes('nicht bestätigt'));
  assert.equal(x.get('form').hidden, false);
  assert.equal(x.get('quantity').value, '2');
  assert.equal(x.get('reason').value, 'Prüfung');
});

test('correcting a sold entry preserves its actual recorded price', async (t) => {
  const x = fixture(t),
    q = { characterId: x.heroes[0].id, search: '', status: '', after: null },
    entry = x.store.ledger(x.w.token, q).items[0];
  x.store.executeProgress(
    x.command({
      kind: 'ledger',
      entryId: entry.id,
      expectedRevision: entry.revision,
      operation: 'sold',
      quantity: 2,
      actualGold: '9,45',
      counterparty: 'Torhändler',
      reason: 'Verkauf',
    }),
  );
  await x.open();
  const sold = x.store.ledger(x.w.token, q).items.find((i) => i.status === 'sold');
  x.get('list')
    .querySelector('[data-ledger-id="' + sold.id + '"]')
    .click();
  await until(() => !x.get('form').querySelector('button').disabled);
  assert.equal(x.get('price').value, '9,45');
  x.get('quantity').value = '1';
  x.get('reason').value = 'Menge geprüft';
  x.get('form').onsubmit({ preventDefault() {} });
  await until(() => x.sent.length === 1 && x.get('form').hidden);
  assert.equal(x.store.ledgerItem(x.w.token, sold.id).actualSaleCopper, '945');
});
test('paged personal loot can be searched without mixing the old page into a new filter', async (t) => {
  const x = fixture(t),
    hero = x.heroes[0];
  for (let i = 0; i < 55; i++)
    x.store.executeProgress(
      x.command({
        kind: 'manual-item',
        characterId: hero.id,
        expectedMembershipRevision: hero.membershipRevision,
        origin: 'manual',
        item: { name: 'Fund ' + i, quantity: 1, category: 'equipment', valueGold: '1' },
        note: 'Unterwegs',
      }),
    );
  await x.open();
  const n = x.get('list').querySelectorAll('button').length;
  assert.equal(x.get('more').hidden, false);
  x.get('more').click();
  await until(() => x.get('list').querySelectorAll('button').length > n);
  x.get('search').value = 'Silberner';
  x.get('search').oninput();
  await until(() => x.get('list').querySelectorAll('button').length === 1);
  assert.match(x.get('list').textContent, /Silberner/);
  assert.doesNotMatch(x.get('list').textContent, /Fund 2/);
});

test('Party receipt recovery reads the confirmed item without navigating away or resending the write', async (t) => {
  const x = fixture(t);
  await x.open();
  x.item().click();
  await until(() => !x.get('form').querySelector('button').disabled);
  const id = x.item().dataset.ledgerId;
  x.get('quantity').value = '3';
  x.get('reason').value = 'Prüfung';
  x.panel.commit = async () => {
    throw Error('Antwort fehlt');
  };
  x.get('form').onsubmit({ preventDefault() {} });
  await until(() => !x.get('recover').hidden);
  x.panel.recover = async () => {};
  x.get('recover').click();
  await until(() => x.get('detail-status').textContent.includes('Status geprüft'));
  assert.equal(x.get('quantity').value, '3');
  assert.equal(x.get('reason').value, 'Prüfung');
  assert.equal(x.get('form').hidden, false);
  x.panel.recover = async () => {
    const item = x.store.ledgerItem(x.w.token, id);
    x.store.executeProgress(
      x.command({
        kind: 'ledger',
        entryId: id,
        expectedRevision: item.revision,
        operation: 'correct',
        quantity: 0,
        correctedQuantity: 3,
        actualGold: '0',
        counterparty: '',
        reason: 'Prüfung',
      }),
    );
  };
  x.get('recover').click();
  await until(() => x.get('form').hidden && x.get('list').textContent.includes('3 ×'));
  assert.equal(x.sent.length, 0);
  assert.equal(x.document.getElementById('party-loot-panel').hidden, false);
});
