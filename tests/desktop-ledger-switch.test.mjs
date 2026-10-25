import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [entry, out] of [
  ['src/app/storage/store.ts', 'ledger-switch-store'],
  ['src/app/progression-ui.ts', 'ledger-switch-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 250; i++) {
    if (check()) return;
    await tick();
  }
  assert(check(), 'Expected ledger state');
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ledger-switch-')),
    { CampaignStore } = require('../.build/ledger-switch-store.cjs'),
    store = new CampaignStore(root + '/store.sqlite'),
    campaign = store.create('Funde verkaufen'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const heroes = ['Ada', 'Borin'].map(
      (name) =>
        store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
    ),
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
  for (const c of heroes) {
    const live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  const items = [];
  for (const [name, quantity, valueGold] of [
    ['Seil', 4, '2'],
    ['Heiltrank', 2, '5'],
  ]) {
    const ack = store.executeProgress(
      command({
        kind: 'manual-item',
        characterId: heroes[0].id,
        expectedMembershipRevision: store.live(w.token).roster.find((c) => c.id === heroes[0].id)
          .membershipRevision,
        origin: 'manual',
        item: { name, quantity, valueGold, category: 'equipment' },
        note: '  Fund\r\n- Reise',
      }),
    );
    items.push(store.ledgerItem(w.token, ack.ledgerIds[0]));
  }
  const [a, b] = items,
    previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  const local = new Map();
  window.localStorage = {
    getItem: (k) => local.get(k) ?? null,
    setItem: (k, v) => local.set(k, v),
    removeItem: (k) => local.delete(k),
  };
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
    writes = [],
    messages = [];
  window.campaign = {};
  for (const key of [
    'progress',
    'ledgerParties',
    'treasures',
    'treasure',
    'ledger',
    'ledgerItem',
    'lootBalance',
    'progressHistory',
    'commitStatus',
  ])
    window.campaign[key] = async (...args) => response(() => store[key](...args));
  window.campaign.executeProgress = async (c) => {
    writes.push(c);
    return response(() => store.executeProgress(c));
  };
  delete require.cache[require.resolve('../.build/ledger-switch-ui.cjs')];
  const ui = require('../.build/ledger-switch-ui.cjs');
  ui.initProgress((text) => messages.push(text));
  const live = store.live(w.token);
  ui.progressionContext(w, live, heroes[0].id);
  const el = (id) => document.getElementById(id),
    choose = (id) =>
      [...el('ledger-list').querySelectorAll('button')]
        .find((button) => button.textContent.includes(items.find((i) => i.id === id).name + ' ·'))
        .onclick();
  await until(() => el('ledger-list').querySelectorAll('button').length === 2);
  choose(a.id);
  await until(() => !el('ledger-form').querySelector('button[type=submit]').disabled);
  const submit = () => el('ledger-form').onsubmit({ preventDefault() {} }),
    fill = () => {
      for (const [id, v] of [
        ['ledger-operation', 'sold'],
        ['ledger-quantity', '1'],
        ['ledger-price', '3'],
        ['ledger-reason', 'Marktverkauf'],
      ])
        el(id).value = v;
    };
  return {
    store,
    w,
    a,
    b,
    heroes,
    live,
    ui,
    el,
    choose,
    submit,
    fill,
    writes,
    messages,
    async cleanup() {
      await ui.flushProgress();
      ui.progressionContext(null, null, null);
      await tick();
      Object.assign(globalThis, previous);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('held item selection blocks the previous sale and detached stack action, then sells only the requested item', async () => {
  const x = await fixture();
  try {
    x.el('ledger-stack-tools').querySelector('input[aria-label="Stapelgrund"]').value =
      'Teil für Borin';
    const initial = x.store.db
        .prepare('SELECT payload,checksum FROM character_ledger WHERE id=?')
        .get(x.a.id),
      oldSplit = [...x.el('ledger-stack-tools').querySelectorAll('button')].find(
        (b) => b.textContent === 'Mengenstapel teilen',
      ).onclick,
      held = deferred(),
      original = window.campaign.ledgerItem;
    window.campaign.ledgerItem = async (t, id) => (id === x.b.id ? held.promise : original(t, id));
    x.fill();
    x.choose(x.b.id);
    assert.equal(x.el('ledger-editor').hidden, true);
    assert.equal(x.el('ledger-stack-tools').disabled, true);
    assert.equal(x.el('ledger-quantity').disabled, true);
    x.submit();
    oldSplit();
    await tick();
    assert.equal(x.writes.length, 0);
    held.resolve(await original(x.w.token, x.b.id));
    await until(() => !x.el('ledger-quantity').disabled);
    x.fill();
    x.submit();
    await x.ui.flushProgress();
    assert.equal(x.writes.length, 1);
    assert.equal(x.writes[0].action.entryId, x.b.id);
    assert.deepEqual(
      x.store.db.prepare('SELECT payload,checksum FROM character_ledger WHERE id=?').get(x.a.id),
      initial,
    );
    assert.equal(x.store.ledgerItem(x.w.token, x.b.id).quantity, 1);
    assert.equal(
      x.store.ledger(x.w.token, {
        characterId: x.heroes[0].id,
        after: null,
        search: '',
        status: '',
      }).totalCopper,
      '1600',
    );
    assert.equal(
      x.store
        .progressHistory(x.w.token, x.heroes[0].id, null)
        .items.filter((e) => e.kind === 'loot-sold').length,
      1,
    );
  } finally {
    await x.cleanup();
  }
});
test('failed item read locks edits and retry recovers the requested item without global error residue', async () => {
  const x = await fixture();
  try {
    x.el('ledger-counterparty').value = 'Alter Händler';
    const original = window.campaign.ledgerItem;
    let fail = true;
    window.campaign.ledgerItem = async (t, id) => {
      if (id === x.b.id && fail) {
        fail = false;
        return { ok: false, error: 'Eintrag nicht lesbar' };
      }
      return original(t, id);
    };
    x.choose(x.b.id);
    await until(() => x.el('ledger-load-status').getAttribute('role') === 'alert');
    x.fill();
    x.submit();
    await tick();
    assert.equal(x.writes.length, 0);
    assert.equal(x.el('ledger-quantity').disabled, true);
    x.el('ledger-retry').onclick();
    await until(() => !x.el('ledger-quantity').disabled);
    assert.match(x.el('ledger-detail').textContent, /^Heiltrank ·/);
    assert.equal(x.el('ledger-counterparty').value, '');
    assert.equal(x.el('ledger-load-status').hidden, true);
    assert(!x.messages.includes('Eintrag nicht lesbar'));
  } finally {
    await x.cleanup();
  }
});
test('superseded errors cannot clear a newer selection', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.ledgerItem,
      held = deferred();
    window.campaign.ledgerItem = async (t, id) => (id === x.b.id ? held.promise : original(t, id));
    x.choose(x.b.id);
    x.choose(x.a.id);
    await until(() => !x.el('ledger-quantity').disabled);
    held.resolve({ ok: false, error: 'Veralteter Fehler' });
    await tick();
    assert.match(x.el('ledger-detail').textContent, /^Seil ·/);
    assert.equal(x.el('ledger-load-status').hidden, true);
    assert(!x.messages.includes('Veralteter Fehler'));
  } finally {
    await x.cleanup();
  }
});
test('a reply for another item of the same owner is rejected', async () => {
  const x = await fixture();
  try {
    window.campaign.ledgerItem = async () => ({ ok: true, value: x.a });
    x.choose(x.b.id);
    await until(() => x.el('ledger-load-status').getAttribute('role') === 'alert');
    assert.equal(x.el('ledger-editor').hidden, true);
    x.submit();
    await tick();
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('switching owner away and back invalidates an earlier detail reply', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.ledgerItem,
      held = deferred();
    window.campaign.ledgerItem = async (t, id) => (id === x.b.id ? held.promise : original(t, id));
    x.choose(x.b.id);
    x.ui.progressionContext(x.w, x.live, x.heroes[1].id);
    x.ui.progressionContext(x.w, x.live, x.heroes[0].id);
    await until(() => x.el('ledger-list').querySelectorAll('button').length === 2);
    held.resolve(await original(x.w.token, x.b.id));
    await tick();
    assert.equal(x.el('ledger-editor').hidden, true);
    assert.equal(x.el('ledger-load-status').hidden, true);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('campaign changes invalidate outstanding item reads', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.ledgerItem,
      held = deferred();
    window.campaign.ledgerItem = () => held.promise;
    x.choose(x.b.id);
    x.ui.progressionContext(null, null, null);
    held.resolve(await original(x.w.token, x.b.id));
    await tick();
    assert.equal(x.el('ledger-editor').hidden, true);
    assert.equal(x.el('ledger-load-status').hidden, true);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('one-unit stacks keep split disabled through unrelated locking without erasing stack inputs', async () => {
  const x = await fixture();
  try {
    const item = x.store.ledgerItem(x.w.token, x.a.id);
    x.store.executeProgress({
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      action: {
        kind: 'ledger',
        entryId: item.id,
        expectedRevision: item.revision,
        operation: 'correct',
        correctedQuantity: 1,
        actualGold: '',
        counterparty: '',
        reason: 'Letztes Seil',
      },
    });
    await x.ui.refreshProgress();
    x.choose(x.a.id);
    await until(() => !x.el('ledger-quantity').disabled);
    const split = [...x.el('ledger-stack-tools').querySelectorAll('button')].find(
        (b) => b.textContent === 'Mengenstapel teilen',
      ),
      reason = x.el('ledger-stack-tools').querySelector('input[aria-label="Stapelgrund"]');
    assert.equal(split.disabled, true);
    reason.value = 'Für Borin';
    x.el('health-reason').value = 'Unfertig';
    x.el('health-reason').dispatchEvent(new window.Event('input'));
    assert.equal(split.disabled, true);
    assert.equal(reason.value, 'Für Borin');
  } finally {
    await x.cleanup();
  }
});

test('valid split, merge and transfer remain usable and preserve the original reward credit', async () => {
  const x = await fixture();
  try {
    const button = (text) =>
      [...x.el('ledger-stack-tools').querySelectorAll('button')].find(
        (b) => b.textContent === text,
      );
    x.el('ledger-stack-tools').querySelector('input[aria-label="Stapelgrund"]').value =
      'Funde aufteilen';
    button('Mengenstapel teilen').onclick();
    await x.ui.flushProgress();
    let page = x.store.ledger(x.w.token, {
        characterId: x.heroes[0].id,
        after: null,
        search: '',
        status: '',
      }),
      portion = page.items.find((i) => i.id !== x.a.id && i.name === 'Seil');
    assert(portion);
    assert.equal(x.store.ledgerItem(x.w.token, x.a.id).quantity, 3);
    const source = x
      .el('ledger-stack-tools')
      .querySelector('select[aria-label="Passenden Stapel zusammenführen"]');
    Object.defineProperty(source, 'value', { value: portion.id, writable: true });
    x.el('ledger-stack-tools').querySelector('input[aria-label="Stapelgrund"]').value =
      'Wieder vereinen';
    button('Stapel zusammenführen').onclick();
    await x.ui.flushProgress();
    assert.equal(x.store.ledgerItem(x.w.token, x.a.id).quantity, 4);
    const recipient = x
      .el('ledger-stack-tools')
      .querySelector('select[aria-label="Empfänger der Weitergabe"]');
    Object.defineProperty(recipient, 'value', { value: x.heroes[1].id, writable: true });
    x.el('ledger-stack-tools').querySelector('input[aria-label="Stapelgrund"]').value = 'Für Borin';
    button('An Figur weitergeben').onclick();
    await x.ui.flushProgress();
    assert.equal(x.store.ledgerItem(x.w.token, x.a.id).quantity, 3);
    page = x.store.ledger(x.w.token, {
      characterId: x.heroes[1].id,
      after: null,
      search: '',
      status: '',
    });
    assert.equal(
      page.items.filter((i) => i.status === 'received').reduce((n, i) => n + i.quantity, 0),
      1,
    );
    assert.equal(page.totalCopper, '0');
    assert.equal(
      x.store.ledger(x.w.token, {
        characterId: x.heroes[0].id,
        after: null,
        search: '',
        status: '',
      }).totalCopper,
      '1800',
    );
    assert.deepEqual(
      x.writes.map((w) => w.action.kind),
      ['ledger-split', 'ledger-merge', 'ledger-transfer'],
    );
  } finally {
    await x.cleanup();
  }
});

test('unfinished XP correction cannot reset character XP; explicit zero still works', async () => {
  const x = await fixture();
  try {
    const id = x.heroes[0].id,
      p = x.store.progress(x.w.token).characters.find((c) => c.characterId === id);
    x.store.executeProgress({
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      action: {
        kind: 'xp',
        characterId: id,
        expectedRevision: p.revision,
        mode: 'set',
        amount: 900,
        reason: 'Bekannter Start',
      },
    });
    await x.ui.refreshProgress();
    const before = x.store.db.serialize();
    x.el('xp-mode').value = 'set';
    x.el('xp-amount').value = '';
    x.el('xp-reason').value = 'Ausdrückliche Korrektur';
    x.el('xp-amount').oninput();
    x.el('xp-form').onsubmit({ preventDefault() {} });
    await x.ui.flushProgress();
    assert.equal(x.writes.length, 0);
    assert.match(x.el('xp-preview').textContent, /ganze XP/);
    assert.match(x.messages.at(-1), /ganze XP/);
    assert.ok(x.store.db.serialize().equals(before));
    x.el('xp-amount').value = '0';
    x.el('xp-form').onsubmit({ preventDefault() {} });
    await x.ui.flushProgress();
    assert.equal(x.writes.length, 1);
    assert.equal(x.store.progress(x.w.token).characters.find((c) => c.characterId === id).xp, 0);
  } finally {
    await x.cleanup();
  }
});

test('personal loot names its owner immediately across character switches', async () => {
  const x = await fixture();
  try {
    assert.equal(x.el('ledger-character-heading').textContent, 'Beute: Ada');
    x.ui.progressionContext(x.w, x.live, x.heroes[1].id);
    assert.equal(x.el('ledger-character-heading').textContent, 'Beute: Borin');
    await until(() => x.el('ledger-list').querySelectorAll('button').length === 0);
    assert.equal(x.el('ledger-character-heading').textContent, 'Beute: Borin');
    x.ui.progressionContext(x.w, x.live, null);
    assert.equal(x.el('ledger-character-heading').textContent, 'Beute · Figur auswählen');
  } finally {
    await x.cleanup();
  }
});

test('quantity correction starts from the selected total and hides irrelevant sale price', async () => {
  const x = await fixture();
  try {
    x.el('ledger-operation').value = 'correct';
    x.el('ledger-operation').onchange();
    assert.equal(x.el('ledger-quantity').value, '4');
    assert.equal(x.el('ledger-quantity-label').textContent, 'Neue Gesamtmenge');
    assert.equal(x.el('ledger-price-field').hidden, true);
    x.el('ledger-quantity').value = '3';
    x.el('ledger-reason').value = 'Eine zu viel';
    x.submit();
    await x.ui.flushProgress();
    assert.equal(x.store.ledgerItem(x.w.token, x.a.id).quantity, 3);
    const history = x.store
      .progressHistory(x.w.token, x.heroes[0].id, null)
      .items.find((e) => e.kind === 'loot-correction');
    assert(history);
    x.choose(x.b.id);
    await until(() => !x.el('ledger-quantity').disabled);
    assert.equal(x.el('ledger-quantity').value, '2');
    assert.equal(x.el('ledger-reason').value, '');
    x.el('ledger-operation').value = 'given';
    x.el('ledger-operation').onchange();
    assert.equal(x.el('ledger-price-field').hidden, true);
    assert.equal(x.el('ledger-quantity').value, '1');
    x.el('ledger-operation').value = 'sold';
    x.el('ledger-operation').onchange();
    assert.equal(x.el('ledger-price-field').hidden, false);
  } finally {
    await x.cleanup();
  }
});
test('correcting a sold portion retains its actual sale price', async () => {
  const x = await fixture();
  try {
    x.fill();
    x.submit();
    await x.ui.flushProgress();
    [...x.el('ledger-list').querySelectorAll('button')]
      .find((b) => b.textContent.includes('Verkauft'))
      .onclick();
    await until(() => !x.el('ledger-quantity').disabled);
    assert.equal(x.el('ledger-price').value, '3.00');
    x.el('ledger-operation').value = 'correct';
    x.el('ledger-operation').onchange();
    assert.equal(x.el('ledger-price-field').hidden, false);
    assert.equal(x.el('ledger-quantity').value, '1');
    x.el('ledger-reason').value = 'Verkauf kontrolliert';
    x.submit();
    await x.ui.flushProgress();
    const page = x.store.ledger(x.w.token, {
      characterId: x.heroes[0].id,
      after: null,
      search: '',
      status: 'sold',
    });
    assert.equal(page.items[0].actualSaleCopper, '300');
  } finally {
    await x.cleanup();
  }
});

test('Party correction uses its own fresh item even when the Live ledger selects another item', async () => {
  const x = await fixture();
  try {
    const action = {
      kind: 'ledger',
      entryId: x.b.id,
      expectedRevision: x.b.revision,
      operation: 'correct',
      quantity: 0,
      correctedQuantity: 1,
      actualGold: '0',
      counterparty: '',
      reason: 'Im Partyfenster geprüft',
    };
    assert.equal(await x.ui.executePartyProgress(action, () => true), true);
    assert.equal(x.store.ledgerItem(x.w.token, x.b.id).quantity, 1);
    assert.equal(x.store.ledgerItem(x.w.token, x.a.id).quantity, 4);
    assert.equal(x.writes.length, 1);
    assert.equal(await x.ui.executePartyProgress(action, () => true), false);
    assert.equal(x.writes.length, 1, 'stale basis must not send another command');
  } finally {
    await x.cleanup();
  }
});
test('closing Party while its fresh item is read revokes the pending correction', async () => {
  const x = await fixture();
  try {
    const held = deferred(),
      read = window.campaign.ledgerItem;
    let current = true;
    window.campaign.ledgerItem = () => held.promise;
    const task = x.ui.executePartyProgress(
      {
        kind: 'ledger',
        entryId: x.b.id,
        expectedRevision: x.b.revision,
        operation: 'correct',
        quantity: 0,
        correctedQuantity: 1,
        actualGold: '0',
        counterparty: '',
        reason: 'Prüfung',
      },
      () => current,
    );
    current = false;
    held.resolve(await read(x.w.token, x.b.id));
    assert.equal(await task, false);
    assert.equal(x.writes.length, 0);
    assert.equal(x.store.ledgerItem(x.w.token, x.b.id).quantity, 2);
  } finally {
    await x.cleanup();
  }
});

test('stack operations expose their own inputs and preview quantities without writing', async () => {
  const x = await fixture();
  try {
    const root = x.el('ledger-stack-tools'),
      mode = root.querySelector('[aria-label="Stapelaktion"]'),
      amount = root.querySelector('[aria-label="Stapelmenge"]'),
      recipient = root.querySelector('[aria-label="Empfänger der Weitergabe"]'),
      source = root.querySelector('[aria-label="Passenden Stapel zusammenführen"]'),
      preview = root.querySelector('[data-ledger-stack-preview]');
    const change = (value) => {
      Object.defineProperty(mode, 'value', { value, writable: true, configurable: true });
      mode.onchange();
    };
    assert.equal(recipient.parentElement.hidden, false);
    assert.equal(source.parentElement.hidden, true);
    change('split');
    assert.equal(recipient.parentElement.hidden, true);
    assert.equal(amount.parentElement.hidden, false);
    amount.value = '2';
    amount.oninput();
    assert.match(preview.textContent, /2.*neuer Stapel.*2 bleiben/);
    assert.equal(x.writes.length, 0);
    amount.value = '4';
    amount.oninput();
    assert.equal(
      [...root.querySelectorAll('button')].find((b) => b.textContent === 'Mengenstapel teilen')
        .disabled,
      true,
    );
    x.el('ledger-adjustments').open = true;
    x.el('ledger-reason').value = 'Offener Verkaufsentwurf';
    change('merge');
    assert.equal(x.el('ledger-adjustments').open, false);
    assert.equal(x.el('ledger-reason').value, 'Offener Verkaufsentwurf');
    assert.equal(amount.parentElement.hidden, true);
    assert.equal(recipient.parentElement.hidden, true);
    assert.equal(source.parentElement.hidden, false);
    assert.match(preview.textContent, /Kein passender Stapel/);
    assert.equal(
      [...root.querySelectorAll('button')].find((b) => b.textContent === 'Stapel zusammenführen')
        .disabled,
      true,
    );
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
