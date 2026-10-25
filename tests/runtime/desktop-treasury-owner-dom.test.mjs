import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/runtime/treasury-ui';export {initCommitControls} from './src/app/shared/commit-confirmation';",
    resolveDir: process.cwd(),
    sourcefile: 'treasury-owner.ts',
  },
  outfile: '.build/treasury-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(5);
  }
  assert.ok(check(), 'expected treasury state');
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { resolve, promise };
}
async function fixture(t, changed = async () => {}) {
  const saved = {
      window: globalThis.window,
      document: globalThis.document,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  const decorate = (d) => {
      d.close = () => {
        d.open = false;
      };
      d.showModal = () => {
        d.open = true;
      };
      return d;
    },
    create = document.createElement.bind(document);
  for (const d of document.querySelectorAll('dialog')) decorate(d);
  document.createElement = (tag, ...args) => {
    const n = create(tag, ...args);
    return tag === 'dialog' ? decorate(n) : n;
  };
  for (const s of document.querySelectorAll('select'))
    Object.defineProperty(s, 'value', { value: '', writable: true });
  const proto = window.HTMLSelectElement.prototype,
    previousValue = Object.getOwnPropertyDescriptor(proto, 'value');
  Object.defineProperty(proto, 'value', {
    configurable: true,
    get() {
      return this.__treasuryValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__treasuryValue = v;
    },
  });
  const timers = [],
    writes = [],
    commands = [],
    messages = [],
    book = (id, title) => ({
      id,
      revision: 1,
      title,
      locationId: null,
      sceneId: null,
      combatId: null,
      items: [],
    }),
    books = new Map([
      ['a', book('a', 'Alpha')],
      ['b', book('b', 'Beta')],
    ]),
    drafts = new Map(),
    ok = (value) => ({ ok: true, value });
  let waitKeep = null,
    waitDiscard = null;
  globalThis.setTimeout = (fn) => {
    const id = timers.length + 1;
    timers.push({ fn, id });
    return id;
  };
  globalThis.clearTimeout = () => {};
  const local = new Map();
  window.localStorage = {
    getItem: (k) => local.get(k) ?? null,
    setItem: (k, v) => local.set(k, v),
    removeItem: (k) => local.delete(k),
  };
  window.campaign = {
    executeProgress: async (command) => {
      commands.push(structuredClone(command));
      const fresh = book('new-' + commands.length, 'Neuer Schatz');
      books.set(fresh.id, fresh);
      return ok({ characters: [], notices: [], treasureId: fresh.id, ledgerIds: [] });
    },
    live: async () => ok({ scenes: [] }),
    treasures: async () =>
      ok({ items: [...books.values()].map((t) => ({ ...t, available: 0 })), next: null }),
    progress: async () => ok({ characters: [], notices: [] }),
    ledgerParties: async () => ok([]),
    treasure: async (_token, id) => ok(structuredClone(books.get(id))),
    treasuryDraft: async (_token, id) => ok(drafts.get(id) ?? null),
    treasureHistory: async () => ok({ items: [], next: null }),
    keepTreasuryDraft: async (token, d, expected) => {
      writes.push({ token, d: structuredClone(d), expected });
      const waiting = waitKeep;
      waitKeep = null;
      if (waiting) await waiting.promise;
      drafts.set(d.treasureId, structuredClone(d));
      return ok();
    },
    discardTreasuryDraft: async (_token, id) => {
      const waiting = waitDiscard;
      waitDiscard = null;
      if (waiting) await waiting.promise;
      drafts.delete(id);
      return ok();
    },
  };
  const filename = require.resolve('../../.build/treasury-owner.cjs');
  delete require.cache[filename];
  const ui = require(filename);
  let active = { token: 'A', campaign: { id: 'campaign-A' } };
  ui.initCommitControls(
    () => active,
    (text, error) => messages.push({ text, error }),
  );
  ui.initTreasury(
    (text, error) => messages.push({ text, error }),
    changed,
    async () => {},
  );
  ui.activateTreasury(active);
  await ui.openTreasury('a');
  const el = (id) => document.getElementById(id),
    edit = (v) => {
      el('treasury-title').value = v;
      el('treasury-title').oninput();
    },
    switchTo = () => {
      active = { token: 'B', campaign: { id: 'campaign-B' } };
      ui.activateTreasury(active);
      return ui.openTreasury('b');
    };
  t.after(() => {
    ui.activateTreasury(null);
    Object.defineProperty(proto, 'value', previousValue);
    Object.assign(globalThis, saved);
  });
  return {
    ui,
    el,
    edit,
    switchTo,
    timers,
    writes,
    commands,
    drafts,
    messages,
    holdKeep() {
      waitKeep = deferred();
      return waitKeep;
    },
    holdDiscard() {
      waitDiscard = deferred();
      return waitDiscard;
    },
  };
}
test('a pending Alpha draft does not block Beta or become its next write basis', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const gate = x.holdKeep(),
    a = x.ui.flushTreasury();
  await until(() => x.writes.length === 1);
  const b = x.switchTo();
  await tick();
  assert.equal(x.el('treasury-title').value, 'Beta');
  x.edit('Beta raw');
  gate.resolve();
  await a;
  await b;
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).token, 'B');
  assert.equal(x.writes.at(-1).d.treasureId, 'b');
  assert.equal(x.writes.at(-1).expected, null);
});
test('an expired Alpha timer cannot save Beta input', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const old = x.timers.at(-1).fn;
  await x.ui.flushTreasury();
  await x.switchTo();
  x.edit('Beta raw');
  const n = x.writes.length;
  old();
  await tick();
  assert.equal(x.writes.length, n);
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).d.title, 'Beta raw');
});
test('a late discard cannot clear or reopen a different campaign editor', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  await x.ui.flushTreasury();
  const gate = x.holdDiscard();
  x.el('treasury-reload').click();
  await tick();
  await x.switchTo();
  x.edit('Beta later');
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.el('treasury-title').value, 'Beta later');
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).d.treasureId, 'b');
});
test('input typed while discarding remains in the current editor and gets a fresh draft basis', async (t) => {
  const x = await fixture(t);
  x.edit('Before discard');
  await x.ui.flushTreasury();
  const gate = x.holdDiscard();
  x.el('treasury-reload').click();
  await tick();
  x.edit('  Later prose\r\n');
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.el('treasury-title').value, '  Later prose\r\n');
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).expected, null);
  assert.equal(x.writes.at(-1).d.title, '  Later prose\r\n');
});

test('a post-commit Alpha read cannot replace Beta or erase its newer text', async (t) => {
  const x = await fixture(t),
    gate = deferred(),
    original = window.campaign.treasures;
  let requested = false;
  window.campaign.executeProgress = async () => ({
    ok: true,
    value: { characters: [], notices: [], treasureId: 'a', ledgerIds: [] },
  });
  window.campaign.treasures = async (token, ...args) => {
    if (token === 'A') {
      requested = true;
      return gate.promise;
    }
    return original(token, ...args);
  };
  x.edit('Confirmed Alpha');
  x.el('treasury-apply').click();
  await until(() => requested);
  await x.switchTo();
  x.edit('Beta after commit');
  gate.resolve({
    ok: true,
    value: { items: [{ id: 'a', title: 'Old response', revision: 2, available: 0 }], next: null },
  });
  await tick();
  await tick();
  assert.equal(x.el('treasury-title').value, 'Beta after commit');
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).d.treasureId, 'b');
  assert.ok(!x.messages.some((m) => m.text.startsWith('Schatzänderung gespeichert')));
});

test('creating another treasure first retains incomplete raw input for reopening', async (t) => {
  const x = await fixture(t);
  x.edit('  Alpha unfinished');
  x.el('treasury-reason').value = '  Loose notes - preserve';
  x.el('treasury-reason').oninput();
  x.el('treasury-new').click();
  await until(() => x.el('treasury-title').value === 'Neuer Schatz');
  assert.equal(x.commands.length, 1);
  assert.equal(x.drafts.get('a')?.title, '  Alpha unfinished');
  assert.equal(x.drafts.get('a')?.reason, '  Loose notes - preserve');
  await x.ui.openTreasury('a');
  assert.equal(x.el('treasury-title').value, '  Alpha unfinished');
  assert.equal(x.el('treasury-reason').value, '  Loose notes - preserve');
});
test('a failed draft save blocks treasure creation and keeps the previous raw editor', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha must remain');
  window.campaign.keepTreasuryDraft = async () => ({
    ok: false,
    error: 'Draft storage unavailable',
  });
  x.el('treasury-new').click();
  await tick();
  await tick();
  await tick();
  assert.equal(x.commands.length, 0);
  assert.equal(x.el('treasury-title').value, 'Alpha must remain');
  assert.ok(x.messages.some((m) => m.text.includes('Draft storage unavailable')));
});
test('create waits for the latest raw input and rapid repeated clicks create only one treasure', async (t) => {
  const x = await fixture(t);
  x.edit('First raw');
  const gate = x.holdKeep();
  x.el('treasury-new').click();
  x.el('treasury-new').click();
  await until(() => x.writes.length === 1);
  assert.equal(x.commands.length, 0);
  x.edit('Later raw');
  gate.resolve();
  await until(() => x.el('treasury-title').value === 'Neuer Schatz');
  assert.equal(x.commands.length, 1);
  assert.equal(x.drafts.get('a')?.title, 'Later raw');
});
test('a delayed create intent cannot create a treasure in the next campaign', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const gate = x.holdKeep();
  x.el('treasury-new').click();
  await until(() => x.writes.length === 1);
  await x.switchTo();
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.commands.length, 0);
  assert.equal(x.el('treasury-title').value, 'Beta');
});
test('an anchor intent waiting for draft storage cannot rebind the next campaign treasure', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  x.el('treasury-anchor-target').value = 'unplaced';
  x.el('treasury-anchor-reason').value = 'Move Alpha';
  const gate = x.holdKeep();
  x.el('treasury-anchor-apply').click();
  await until(() => x.writes.length === 1);
  await x.switchTo();
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.commands.length, 0);
  assert.equal(x.el('treasury-title').value, 'Beta');
});

test('an earlier treasure selection cannot replace a freshly created treasure', async (t) => {
  const x = await fixture(t),
    gate = deferred(),
    original = window.campaign.treasure;
  let requested = false;
  window.campaign.treasure = async (token, id) => {
    if (id === 'b') {
      requested = true;
      await gate.promise;
    }
    return original(token, id);
  };
  const old = x.ui.openTreasury('b');
  await until(() => requested);
  x.el('treasury-new').click();
  await until(() => x.el('treasury-title').value === 'Neuer Schatz');
  gate.resolve();
  await old;
  assert.equal(x.el('treasury-title').value, 'Neuer Schatz');
  assert.equal(x.commands.length, 1);
});

test('an expired previous-treasure timer cannot save input in the newly created editor', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const old = x.timers.at(-1).fn;
  x.el('treasury-new').click();
  await until(() => x.el('treasury-title').value === 'Neuer Schatz');
  x.edit('New raw');
  const n = x.writes.length;
  old();
  await tick();
  assert.equal(x.writes.length, n);
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).d.treasureId, 'new-1');
  assert.equal(x.writes.at(-1).d.title, 'New raw');
});

test('a create waiting behind a draft save does not revoke an already started apply', async (t) => {
  const x = await fixture(t),
    ack = deferred();
  x.edit('Applied Alpha');
  const keep = x.holdKeep();
  window.campaign.executeProgress = async (command) => {
    x.commands.push(command);
    await ack.promise;
    return { ok: true, value: { characters: [], notices: [], treasureId: 'a', ledgerIds: [] } };
  };
  x.el('treasury-apply').click();
  await until(() => x.writes.length === 1);
  x.el('treasury-new').click();
  keep.resolve();
  await until(() => x.commands.length === 1);
  await tick();
  assert.equal(x.commands[0].action.kind, 'treasure-edit');
  ack.resolve();
  await until(() => x.messages.some((m) => m.text.startsWith('Schatzänderung gespeichert')));
  assert.equal(x.commands.length, 1);
});

test('catalog preparation retains quantities, title and definition identities while adding another item', async (t) => {
  const x = await fixture(t),
    definitions = {
      gold: { id: 'gp', revision: 1, name: 'Goldmünze', category: 'coins', unitCopper: '100' },
      healing: {
        id: 'potion',
        revision: 2,
        name: 'Potion of healing',
        category: 'magic',
        unitCopper: '5000',
      },
    };
  window.campaign.itemDefinitions = async (q) => ({
    ok: true,
    value: { items: [definitions[q.search]], next: null },
  });
  const add = async (search) => {
    x.el('treasury-catalog-search').value = search;
    x.el('treasury-catalog-form').onsubmit({ preventDefault() {} });
    await until(
      () =>
        x.el('treasury-catalog-results').querySelector('button')?.textContent ===
        definitions[search].name,
    );
    x.el('treasury-catalog-results').querySelector('button').click();
  };
  x.edit('Zollkiste');
  await add('gold');
  let amounts = x.el('treasury-rows').querySelectorAll('input');
  assert.equal(amounts.length, 1, 'the catalog path never inserts a free-definition draft');
  amounts[0].value = '20';
  amounts[0].oninput();
  await add('healing');
  amounts = x.el('treasury-rows').querySelectorAll('input');
  assert.equal(amounts[0].value, '20');
  amounts[1].value = '3';
  amounts[1].oninput();
  assert.equal(await x.ui.flushTreasury(), true);
  const saved = x.writes.at(-1).d;
  assert.equal(saved.title, 'Zollkiste');
  assert.deepEqual(
    saved.items.map((i) => [i.quantity, i.reference.definitionId, i.reference.revision]),
    [
      ['20', 'gp', 1],
      ['3', 'potion', 2],
    ],
  );
  assert.equal(x.commands.length, 0, 'catalog preparation does not silently commit or allocate');
});

test('changed catalog queries remove old choices and show pending, empty and failed searches', async (t) => {
  const x = await fixture(t),
    input = x.el('treasury-catalog-search'),
    form = x.el('treasury-catalog-form'),
    results = x.el('treasury-catalog-results');
  window.campaign.itemDefinitions = async () => ({
    ok: true,
    value: {
      items: [{ id: 'gold', revision: 1, name: 'Goldmünze', category: 'coins', unitCopper: '100' }],
    },
  });
  input.value = 'Gold';
  form.onsubmit({ preventDefault() {} });
  await until(() => !!results.querySelector('button'));
  input.value = 'Potion';
  input.oninput();
  assert.equal(results.querySelector('button'), null);
  const gate = deferred();
  window.campaign.itemDefinitions = () => gate.promise;
  form.onsubmit({ preventDefault() {} });
  assert.match(results.textContent, /gesucht/);
  input.value = 'keine';
  input.oninput();
  gate.resolve({ ok: true, value: { items: [{ id: 'old', name: 'Alter Treffer' }] } });
  await tick();
  assert.equal(results.querySelector('button'), null);
  window.campaign.itemDefinitions = async () => ({ ok: true, value: { items: [] } });
  form.onsubmit({ preventDefault() {} });
  await until(() => results.textContent.includes('Keine passenden'));
  window.campaign.itemDefinitions = async () => ({ ok: false, error: 'Katalog nicht lesbar' });
  form.onsubmit({ preventDefault() {} });
  await until(() => results.textContent.includes('Katalog nicht lesbar'));
  assert.equal(results.querySelector('button'), null);
});

test('visible catalog choices work in a newly created treasure without repeating the search', async (t) => {
  const x = await fixture(t);
  let searches = 0;
  window.campaign.itemDefinitions = async () => {
    searches++;
    return {
      ok: true,
      value: {
        items: [
          {
            id: 'potion',
            revision: 2,
            name: 'Potion of healing',
            category: 'magic',
            unitCopper: '5000',
          },
        ],
      },
    };
  };
  x.el('treasury-catalog-search').value = 'Potion';
  x.el('treasury-catalog-form').onsubmit({ preventDefault() {} });
  await until(() => !!x.el('treasury-catalog-results').querySelector('button'));
  const old = x.el('treasury-catalog-results').querySelector('button');
  x.el('treasury-new').click();
  await until(() => x.el('treasury-title').value === 'Neuer Schatz');
  const visible = x.el('treasury-catalog-results').querySelector('button');
  assert.ok(visible);
  assert.notEqual(visible, old);
  old.click();
  assert.equal(
    x.el('treasury-rows').querySelectorAll('input').length,
    0,
    'a detached previous-editor choice stays revoked',
  );
  visible.click();
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(searches, 1);
  assert.equal(x.writes.at(-1).d.treasureId, 'new-1');
  assert.deepEqual(
    x.writes
      .at(-1)
      .d.items.map((i) => [i.quantity, i.reference.definitionId, i.reference.revision]),
    [['1', 'potion', 2]],
  );
  assert.equal(x.commands.length, 1, 'adding remains a draft until explicitly applied');
});

test('switching existing treasures rebinds visible catalog choices but changing campaigns clears them', async (t) => {
  const x = await fixture(t);
  window.campaign.itemDefinitions = async () => ({
    ok: true,
    value: {
      items: [{ id: 'gold', revision: 1, name: 'Goldmünze', category: 'coins', unitCopper: '100' }],
    },
  });
  x.el('treasury-catalog-search').value = 'Gold';
  x.el('treasury-catalog-form').onsubmit({ preventDefault() {} });
  await until(() => !!x.el('treasury-catalog-results').querySelector('button'));
  await x.ui.openTreasury('b');
  const choice = x.el('treasury-catalog-results').querySelector('button');
  choice.click();
  assert.equal(await x.ui.flushTreasury(), true);
  assert.equal(x.writes.at(-1).d.treasureId, 'b');
  assert.equal(x.writes.at(-1).d.items[0].reference.definitionId, 'gold');
  await x.switchTo();
  assert.equal(x.el('treasury-catalog-results').querySelector('button'), null);
  const count = x.el('treasury-rows').querySelectorAll('input').length;
  choice.click();
  assert.equal(x.el('treasury-rows').querySelectorAll('input').length, count);
});

for (const phase of ['after', 'list', 'detail', 'history', 'write', 'unresolved'])
  test('distribution reports its actual commit outcome when ' + phase + ' fails', async (t) => {
    let committed = false;
    const failure = 'Controlled ' + phase + ' failure',
      x = await fixture(t, async () => {
        if (committed && phase === 'after') throw new Error(failure);
      });
    const person = { characterId: 'hero', name: 'Ada', active: true, membershipRevision: 1 },
      book = {
        id: 'a',
        revision: 1,
        title: 'Alpha',
        items: [
          {
            id: 'rope',
            name: 'Seil',
            quantity: 5,
            allocated: 0,
            currentDefinition: {
              id: 'rope-definition',
              revision: 1,
              name: 'Seil',
              unitCopper: '100',
              trashed: false,
            },
          },
        ],
      };
    window.campaign.progress = async () => ({
      ok: true,
      value: { characters: [person], notices: [] },
    });
    window.campaign.treasure = async () =>
      committed && phase === 'detail'
        ? { ok: false, error: failure }
        : { ok: true, value: structuredClone(book) };
    window.campaign.treasureHistory = async () =>
      committed && phase === 'history'
        ? { ok: false, error: failure }
        : { ok: true, value: { items: [], next: null } };
    const list = window.campaign.treasures;
    window.campaign.treasures = async (...args) =>
      committed && phase === 'list' ? { ok: false, error: failure } : list(...args);
    window.campaign.commitStatus = async () => ({
      ok: true,
      value: { outcome: phase === 'unresolved' ? 'pending' : 'not-applied' },
    });
    window.campaign.executeProgress = async (command) => {
      x.commands.push(command);
      if (phase === 'write' || phase === 'unresolved') return { ok: false, error: failure };
      committed = true;
      return {
        ok: true,
        value: { characters: [person], notices: [], treasureId: 'a', ledgerIds: ['grant'] },
      };
    };
    x.el('distribution-review').scrollIntoView = () => {};
    x.el('distribution-status').scrollIntoView = () => {};
    await x.ui.openTreasureDistribution('a');
    const input = x.el('distribution-grid').querySelector('input');
    input.value = '2';
    input.oninput();
    x.el('distribution-check').click();
    x.el('distribution-confirm').click();
    await until(() =>
      x.messages.some((m) =>
        m.text.includes(phase === 'unresolved' ? 'Buchungsantwort fehlt' : failure),
      ),
    );
    await until(
      () => !x.el('treasure-distribution-dialog').open || !x.el('distribution-confirm').disabled,
    );
    assert.equal(x.commands.length, 1);
    assert.equal(committed, !['write', 'unresolved'].includes(phase));
    assert.equal(x.el('treasure-distribution-dialog').open, true);
    assert.equal(x.el('distribution-receipt').hidden, !committed);
    if (committed) {
      const receipt = x.el('distribution-receipt');
      assert.match(receipt.textContent, /Beute verteilt · Alpha/);
      assert.match(receipt.textContent, /2 × Seil/);
      assert.match(receipt.textContent, /Im Schatz verbleiben: 3 × Seil/);
      x.el('distribution-confirm').onclick();
      await tick();
      assert.equal(
        x.commands.length,
        1,
        'confirmed receipt cannot book again after a refresh failure',
      );
    }
    if (['write', 'unresolved'].includes(phase)) {
      assert.match(
        x.el('distribution-status').textContent,
        phase === 'unresolved'
          ? /Buchungsantwort fehlt.*Schließen.*Buchungsstatus/
          : new RegExp(failure),
      );
      assert.equal(input.value, '2');
      assert.ok(!x.messages.some((m) => m.text.includes('gespeichert')));
    } else {
      assert.ok(x.messages.some((m) => m.text.includes('gespeichert') && m.text.includes(failure)));
      assert.ok(!x.messages.some((m) => m.text.includes('Verteilung bleibt offen')));
    }
    if (phase === 'unresolved') {
      x.el('distribution-confirm').onclick();
      await until(() =>
        x.el('distribution-status').textContent.includes('Eine Buchung ist noch ungeklärt'),
      );
      assert.equal(x.commands.length, 1);
      assert.equal(input.value, '2');
      assert.equal(x.el('distribution-receipt').hidden, true);
    }
  });

// Unnamed scenes are valid runtime groups, including the initial primary scene.
test('treasure filters and anchor targets identify unnamed groups without requiring a rename', async (t) => {
  const x = await fixture(t);
  window.campaign.live = async () => ({
    ok: true,
    value: {
      scenes: [
        { id: 'abcd1234-a', title: '' },
        { id: 'efab5678-b', title: '' },
        { id: 'named', title: 'Hafenwache' },
      ],
    },
  });
  await x.ui.openTreasury();
  for (const id of ['treasury-filter-anchor', 'treasury-anchor-target']) {
    const choices = [...x.el(id).options]
      .filter((o) => o.value.startsWith('scene:'))
      .map((o) => [o.value, o.textContent]);
    assert.deepEqual(choices, [
      ['scene:abcd1234-a', 'Gruppe: Unbenannte Gruppe · abcd1234'],
      ['scene:efab5678-b', 'Gruppe: Unbenannte Gruppe · efab5678'],
      ['scene:named', 'Gruppe: Hafenwache'],
    ]);
  }
});
