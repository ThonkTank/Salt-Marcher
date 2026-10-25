import { mockCustomValidity } from '../helpers/input-validity.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [entry, name] of [
  ['src/app/storage/store.ts', 'item-selection-store'],
  ['src/app/catalog/items-ui.ts', 'item-selection-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const tick = () => new Promise((r) => setImmediate(r)),
  held = () => {
    let resolve, reject;
    const promise = new Promise((r, j) => {
      resolve = r;
      reject = j;
    });
    return { promise, resolve, reject };
  };
async function until(fn) {
  // Fast DOM lookups can exhaust immediate ticks before the async commit fingerprint resolves.
  const deadline = performance.now() + 5000;
  while (!fn() && performance.now() < deadline) await pause(5);
  assert(fn(), 'Expected item state');
}
async function fixture({ withShops = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'item-selection-')),
    { CampaignStore } = require('../../.build/item-selection-store.cjs'),
    store = new CampaignStore(root + '/store.sqlite'),
    cam = store.create('Markttag'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
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
  const definition = store.executeItemShop(
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
        unitCopper: '200',
        weightText: '',
        properties: [],
        description: '  Original\r\n- Seil',
        source: { kind: 'authored', label: 'GM', license: null, url: null },
        trashed: false,
      },
    }),
  ).definition;
  const second = store.executeItemShop(
    command({
      kind: 'definition',
      expectedRevision: null,
      definition: {
        ...definition,
        id: randomUUID(),
        revision: 0,
        name: 'Heiltrank',
        description: '  Heilwirkung\r\n- Original',
        unitCopper: '500',
      },
    }),
  ).definition;
  const defs = [definition, second];
  // Only the unselected-shop and stock-transfer cases need populated shops.
  const shops = [];
  for (const [name, quantity] of withShops
    ? [
        ['Hafenladen', 5],
        ['Bergladen', 7],
      ]
    : []) {
    const id = randomUUID();
    store.executeNpc({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      expectedNoteRevision: null,
      expectedRecordRevision: 0,
      expectedActorRevision: null,
      expectedPositionRevision: null,
      npc: {
        id,
        name: 'Besitzer ' + name,
        creatureId: null,
        readAloud: '',
        gmNotes: '',
        record: {
          id,
          revision: 0,
          factionId: null,
          modifier: 0,
          lifecycle: 'active',
          appearance: '',
          behavior: '',
          history: '',
        },
        locationId: null,
        health: null,
      },
    });
    shops.push(
      store.executeItemShop(
        command({
          kind: 'shop',
          expectedRevision: null,
          shop: {
            id: randomUUID(),
            revision: 0,
            name,
            owner: { kind: 'npc', id },
            notes: '  Markttag\r\n- Feste Preise',
            trashed: false,
            stock: [
              {
                id: randomUUID(),
                reference: {
                  kind: 'authored',
                  definitionId: definition.id,
                  revision: definition.revision,
                },
                quantity,
                unique: false,
                instanceId: null,
                buyCopper: '200',
                sellCopper: '100',
                notes: '',
                restock: null,
              },
            ],
          },
        }),
      ).shop.shop,
    );
  }
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  const restoreValidity = mockCustomValidity(window);
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.__qaValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__qaValue = v;
    },
  });
  const local = new Map();
  window.localStorage = {
    getItem: (k) => local.get(k) ?? null,
    setItem: (k, v) => local.set(k, v),
    removeItem: (k) => local.delete(k),
  };
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    writes = [],
    messages = [];
  window.campaign = {};
  for (const key of [
    'preparation',
    'progress',
    'live',
    'itemDefinitions',
    'itemDefinition',
    'shops',
    'shop',
    'ledgerInventory',
    'commitStatus',
  ])
    window.campaign[key] = async (...args) => response(() => store[key](...args));
  window.campaign.executeItemShop = async (c) => {
    writes.push(c);
    return response(() => store.executeItemShop(c));
  };
  window.campaign.executeProgress = async (c) => {
    writes.push(c);
    return response(() => store.executeProgress(c));
  };
  delete require.cache[require.resolve('../../.build/item-selection-ui.cjs')];
  const ui = require('../../.build/item-selection-ui.cjs');
  ui.initItems(
    (text) => messages.push(text),
    async () => {},
  );
  const el = (id) => document.getElementById(id);
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      value: select.id === 'item-sort' ? 'name' : select.id === 'item-direction' ? 'asc' : '',
      writable: true,
    });
  ui.activateItems(w);
  await ui.openItems();
  const choose = async (id) => {
    const name = defs.find((d) => d.id === id)?.name ?? store.itemDefinition(id).name;
    el('item-search').value = name;
    el('items-search-form').onsubmit({ preventDefault() {} });
    await until(() =>
      [...el('items-results').querySelectorAll('button')].some((b) =>
        b.textContent.startsWith(name + ' ·'),
      ),
    );
    [...el('items-results').querySelectorAll('button')]
      .find((b) => b.textContent.startsWith(name + ' ·'))
      .onclick();
  };
  await choose(definition.id);
  await until(() => el('item-name').value === definition.name && !el('item-name').disabled);
  el('item-recipient').value = heroes[0].id;
  el('item-award-quantity').value = '1';
  const settle = async () => {
      await tick();
      await ui.flushItems();
      await tick();
    },
    award = () => el('item-award').onclick();
  return {
    store,
    w,
    cam,
    heroes,
    defs,
    shops,
    ui,
    el,
    choose,
    award,
    settle,
    writes,
    messages,
    async cleanup() {
      await settle();
      ui.activateItems(w);
      restoreValidity();
      Object.assign(globalThis, previous);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('catalog award and unallocated treasure creation work without selecting a shop', async () => {
  const x = await fixture({ withShops: true });
  try {
    x.award();
    await x.settle();
    x.el('item-treasure').onclick();
    await x.settle();
    assert.deepEqual(
      x.writes.map((c) => c.action.kind),
      ['manual-item', 'treasure'],
    );
    assert.equal(
      x.store.ledger(x.w.token, {
        characterId: x.heroes[0].id,
        after: null,
        search: '',
        status: '',
      }).items[0].reference.definitionId,
      x.defs[0].id,
    );
    assert.equal(x.store.treasures(x.w.token, null).items.length, 1);
    assert.equal(x.store.shops(x.w.token, false).length, 2);
  } finally {
    await x.cleanup();
  }
});
test('held definition selection blocks old award, copy, trash and save then awards only the loaded definition', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.itemDefinition,
      pause = held();
    window.campaign.itemDefinition = async (id) =>
      id === x.defs[1].id ? pause.promise : original(id);
    await x.choose(x.defs[1].id);
    await until(() => !x.el('item-load-status').hidden);
    assert.equal(x.el('item-award').disabled, true);
    assert.equal(x.el('item-name').disabled, true);
    x.award();
    x.el('item-copy').onclick();
    x.el('item-trash').onclick();
    x.el('item-form').onsubmit({ preventDefault() {} });
    await tick();
    assert.equal(x.writes.length, 0);
    pause.resolve(await original(x.defs[1].id));
    await until(() => !x.el('item-award').disabled);
    x.award();
    await x.settle();
    assert.equal(x.writes.length, 1);
    assert.equal(x.writes[0].action.item.reference.definitionId, x.defs[1].id);
  } finally {
    await x.cleanup();
  }
});
test('failed definition selection stays locally locked and retries the requested definition', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.itemDefinition;
    let fail = true;
    window.campaign.itemDefinition = async (id) =>
      id === x.defs[1].id && fail
        ? ((fail = false), { ok: false, error: 'Definition nicht lesbar' })
        : original(id);
    await x.choose(x.defs[1].id);
    await until(() => x.el('item-load-status').getAttribute('role') === 'alert');
    x.award();
    await tick();
    assert.equal(x.writes.length, 0);
    assert.equal(x.el('item-copy').disabled, true);
    x.el('item-load-retry').onclick();
    await until(() => !x.el('item-name').disabled);
    assert.equal(x.el('item-name').value, 'Heiltrank');
    assert.equal(x.el('item-load-status').hidden, true);
    assert.deepEqual(x.messages, []);
  } finally {
    await x.cleanup();
  }
});
test('a superseded definition failure cannot disable the new selection or leave global error noise', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.itemDefinition,
      pause = held();
    window.campaign.itemDefinition = async (id) =>
      id === x.defs[1].id ? pause.promise : original(id);
    await x.choose(x.defs[1].id);
    await until(() => !x.el('item-load-status').hidden);
    await x.choose(x.defs[0].id);
    await until(() => !x.el('item-name').disabled);
    pause.resolve({ ok: false, error: 'Veralteter Fehler' });
    await tick();
    assert.equal(x.el('item-name').value, 'Seil');
    assert.equal(x.el('item-load-status').hidden, true);
    assert.deepEqual(x.messages, []);
  } finally {
    await x.cleanup();
  }
});
test('wrong definition replies never become editable or usable', async () => {
  const x = await fixture();
  try {
    window.campaign.itemDefinition = async () => ({ ok: true, value: x.defs[0] });
    await x.choose(x.defs[1].id);
    await until(() => x.el('item-load-status').getAttribute('role') === 'alert');
    x.award();
    x.el('item-treasure').onclick();
    await tick();
    assert.equal(x.writes.length, 0);
    assert.equal(x.el('item-save').disabled, true);
  } finally {
    await x.cleanup();
  }
});
test('campaign reactivation invalidates outstanding definition replies', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.itemDefinition,
      pause = held();
    window.campaign.itemDefinition = () => pause.promise;
    await x.choose(x.defs[1].id);
    await until(() => !x.el('item-load-status').hidden);
    x.ui.activateItems(x.w);
    pause.resolve(await original(x.defs[1].id));
    await tick();
    assert.equal(x.el('item-editor').hidden, true);
    assert.equal(x.el('item-load-status').hidden, true);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
for (const invalid of ['name', 'description'])
  test(`an incomplete definition ${invalid} stays repairable without starting a booking`, async (t) => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let hashes = 0,
      markers = 0,
      statusReads = 0;
    t.mock.method(crypto.subtle, 'digest', async (...args) => {
      hashes++;
      await pause(40);
      return digest(...args);
    });
    const x = await fixture(),
      status = window.campaign.commitStatus,
      set = window.localStorage.setItem;
    window.campaign.commitStatus = async (...args) => {
      statusReads++;
      return status(...args);
    };
    window.localStorage.setItem = (key, value) => {
      if (key.startsWith('pending-booking:')) markers++;
      set(key, value);
    };
    try {
      const raw = invalid === 'description' ? 'X'.repeat(100001) : 'Unfertiger Entwurf';
      x.el('item-name').value = invalid === 'name' ? '   ' : 'Seil';
      x.el('item-description').value = raw;
      x.el('item-form').oninput();
      const before = x.store.db.serialize();
      await x.choose(x.defs[1].id);
      await until(() => x.messages.length > 0 && !x.el('item-name').disabled);
      assert.equal(x.el('item-name').value, invalid === 'name' ? '   ' : 'Seil');
      assert.equal(x.el('item-description').value, raw);
      assert.equal(x.el('item-load-status').hidden, true);
      assert.equal(hashes, 0);
      assert.equal(markers, 0);
      assert.equal(statusReads, 0);
      assert.equal(x.writes.length, 0);
      assert.ok(x.store.db.serialize().equals(before));
      x.el('item-name').value = 'Seil korrigiert';
      x.el('item-description').value = 'Unfertiger Entwurf';
      x.el('item-form').oninput();
      assert(await x.ui.flushItems());
      assert.equal(hashes, 1);
      assert.equal(markers, 1);
      assert.equal(x.writes.length, 1);
      const saved = x.store.itemDefinition(x.defs[0].id);
      assert.equal(saved.name, 'Seil korrigiert');
      assert.equal(saved.description, 'Unfertiger Entwurf');
      await x.choose(x.defs[1].id);
      await until(() => x.el('item-name').value === 'Heiltrank' && !x.el('item-name').disabled);
    } finally {
      window.campaign.commitStatus = status;
      await x.cleanup();
    }
  });

test('a valid definition draft remains locked while its booking fingerprint is delayed', async (t) => {
  const x = await fixture(),
    gate = held(),
    digest = crypto.subtle.digest.bind(crypto.subtle);
  let started = false;
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    started = true;
    await gate.promise;
    return digest(...args);
  });
  try {
    x.el('item-name').value = 'Seil korrigiert';
    x.el('item-description').value = x.defs[0].description.replace(/\r\n/g, '\n');
    x.el('item-form').oninput();
    await x.choose(x.defs[1].id);
    await until(() => started);
    assert.equal(x.el('item-name').disabled, true);
    assert.equal(x.el('item-name').value, 'Seil korrigiert');
    assert.equal(x.writes.length, 0);
    gate.resolve();
    await until(() => x.el('item-name').value === 'Heiltrank' && !x.el('item-name').disabled);
    assert.equal(x.writes.length, 1);
    const saved = x.store.itemDefinition(x.defs[0].id);
    assert.equal(saved.name, 'Seil korrigiert');
    assert.equal(saved.description, x.defs[0].description);
  } finally {
    gate.resolve();
    await x.cleanup();
  }
});
test('valid edits save before switching and preserve untouched normalized CRLF prose', async () => {
  const x = await fixture();
  try {
    x.el('item-description').value = x.defs[0].description.replace(/\r\n/g, '\n');
    x.el('item-name').value = 'Seil verbessert';
    x.el('item-form').oninput();
    await x.choose(x.defs[1].id);
    await until(() => x.el('item-name').value === 'Heiltrank' && !x.el('item-name').disabled);
    const saved = x.store.itemDefinition(x.defs[0].id);
    assert.equal(saved.name, 'Seil verbessert');
    assert.equal(saved.description, x.defs[0].description);
    x.el('item-description').value = 'Neue\nHeilwirkung';
    x.el('item-form').oninput();
    assert(await x.ui.flushItems());
    assert.equal(x.store.itemDefinition(x.defs[1].id).description, 'Neue\nHeilwirkung');
  } finally {
    await x.cleanup();
  }
});
test('SRD definitions stay read-only and a separate editable copy can be saved', async () => {
  const x = await fixture();
  try {
    const source = x.store
      .itemDefinitions({
        search: 'Abacus',
        category: '',
        magic: '',
        rarity: '',
        attunement: '',
        sort: 'name',
        direction: 'asc',
        after: 0,
        includeTrashed: false,
      })
      .items.find((i) => i.source.kind === 'srd51');
    assert(source);
    await x.choose(source.id);
    await until(() => x.el('item-name').value === source.name);
    assert.equal(x.el('item-name').disabled, true);
    assert.equal(x.el('item-save').disabled, true);
    assert.equal(x.el('item-copy').disabled, false);
    x.el('item-copy').onclick();
    await x.settle();
    assert.equal(x.el('item-name').disabled, false);
    assert.notEqual(x.el('item-name').value, source.name);
    assert(await x.ui.flushItems());
    assert.deepEqual(x.store.itemDefinition(source.id), source);
  } finally {
    await x.cleanup();
  }
});
test('adding the current definition to a selected shop still works', async () => {
  const x = await fixture({ withShops: true });
  try {
    [...x.el('shops-list').querySelectorAll('button')]
      .find((b) => b.textContent.startsWith(x.shops[0].name + ' ·'))
      .onclick();
    await until(() => !x.el('shop-fields').disabled);
    x.el('shop-add-item').onclick();
    await x.settle();
    const stock = x.store.shop(x.w.token, x.shops[0].id).shop.stock;
    assert.equal(stock.filter((s) => s.reference.definitionId === x.defs[0].id).length, 2);
    assert.equal(x.el('shop-add-item').disabled, false);
  } finally {
    await x.cleanup();
  }
});

test('a pending item search clears obsolete rows and announces loading then an empty result', async () => {
  const x = await fixture();
  try {
    const pause = held();
    window.campaign.itemDefinitions = () => pause.promise;
    x.el('item-search').value = 'No match';
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await tick();
    assert.equal(x.el('items-results').children.length, 0);
    assert.match(x.el('items-page').textContent, /geladen/);
    assert.equal(x.el('items-next').disabled, true);
    assert.equal(x.el('items-prev').disabled, true);
    pause.resolve({
      ok: true,
      value: {
        items: [],
        total: 0,
        next: null,
        problems: [],
        sourceStatus: { complete: false, message: 'Local source' },
      },
    });
    await tick();
    assert.match(x.el('items-page').textContent, /Keine Gegenstände/);
    assert.equal(x.el('item-name').value, 'Seil');
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
for (const reject of [false, true])
  test(`item search ${reject ? 'transport' : 'storage'} failure is local and a new search recovers`, async () => {
    const x = await fixture();
    try {
      const original = window.campaign.itemDefinitions;
      window.campaign.itemDefinitions = async () => {
        if (reject) throw new Error('Controlled catalog failure');
        return { ok: false, error: 'Controlled catalog failure' };
      };
      x.el('item-search').value = 'Failed query';
      x.el('items-search-form').onsubmit({ preventDefault() {} });
      await tick();
      await tick();
      assert.equal(x.el('items-results').children.length, 0);
      assert.match(x.el('items-page').textContent, /Controlled catalog failure/);
      assert.equal(x.el('items-page').getAttribute('role'), 'alert');
      assert.equal(x.el('item-search').value, 'Failed query');
      assert.deepEqual(x.messages, []);
      window.campaign.itemDefinitions = original;
      x.el('item-search').value = 'Heiltrank';
      x.el('items-search-form').onsubmit({ preventDefault() {} });
      await until(() => x.el('items-results').textContent.includes('Heiltrank'));
      assert.equal(x.el('items-page').getAttribute('role'), 'status');
      assert.equal(x.writes.length, 0);
    } finally {
      await x.cleanup();
    }
  });
for (const reject of [false, true])
  test(`a superseded item search ${reject ? 'transport' : 'storage'} failure cannot replace newer results or create global error noise`, async () => {
    const x = await fixture();
    try {
      const original = window.campaign.itemDefinitions,
        pause = held();
      window.campaign.itemDefinitions = () => pause.promise;
      x.el('item-search').value = 'Old query';
      x.el('items-search-form').onsubmit({ preventDefault() {} });
      await tick();
      window.campaign.itemDefinitions = original;
      x.el('item-search').value = 'Heiltrank';
      x.el('items-search-form').onsubmit({ preventDefault() {} });
      await until(() => x.el('items-results').textContent.includes('Heiltrank'));
      const text = x.el('items-page').textContent;
      if (reject) pause.reject(new Error('Superseded search error'));
      else pause.resolve({ ok: false, error: 'Superseded search error' });
      await tick();
      assert.equal(x.el('items-page').textContent, text);
      assert.deepEqual(x.messages, []);
    } finally {
      await x.cleanup();
    }
  });
test('rapid next-page actions cannot duplicate requests or make back remain on the same page', async () => {
  const x = await fixture();
  try {
    x.el('item-search').value = '';
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await until(() => !x.el('items-next').disabled);
    const original = window.campaign.itemDefinitions,
      pause = held(),
      calls = [];
    window.campaign.itemDefinitions = async (query) => {
      calls.push(query);
      await pause.promise;
      return original(query);
    };
    x.el('items-next').onclick();
    x.el('items-next').onclick();
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].after, 40);
    pause.resolve();
    await until(() => x.el('items-page').textContent.includes('Seite 2'));
    window.campaign.itemDefinitions = original;
    x.el('items-prev').onclick();
    await until(() => x.el('items-page').textContent.includes('Seite 1'));
    assert.equal(x.el('items-prev').disabled, true);
  } finally {
    await x.cleanup();
  }
});

test('reference lookup exposes full plain text and facts without writes; editing and usage are explicit', async () => {
  const x = await fixture();
  try {
    const before = x.store.live(x.w.token),
      progress = x.store.progress(x.w.token);
    for (const name of ['Cloak of Protection', 'Cloak of Elvenkind']) {
      const source = x.store
        .itemDefinitions({
          search: name,
          category: '',
          magic: '',
          rarity: '',
          attunement: '',
          sort: 'name',
          direction: 'asc',
          after: 0,
          includeTrashed: false,
        })
        .items.find((i) => i.name === name);
      assert(source);
      await x.choose(source.id);
      await until(() => x.el('item-reference-title').textContent === name);
      assert.equal(x.el('item-reference-description').textContent, source.description);
      assert.match(x.el('item-reference-facts').textContent, /Einstimmung: erforderlich/);
      assert.equal(x.el('item-editing').hidden, true);
      assert.equal(!!x.el('item-usage').open, false);
      assert.equal(
        x.el('items-results').querySelector('[aria-pressed="true"]').dataset.definitionId,
        source.id,
      );
      assert.equal(x.el('item-source-link').href, source.source.url);
    }
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.store.live(x.w.token), before);
    assert.deepEqual(x.store.progress(x.w.token), progress);
    await x.choose(x.defs[0].id);
    await until(() => x.el('item-reference-title').textContent === 'Seil');
    assert.equal(x.el('item-editing').hidden, false);
    assert.equal(!!x.el('item-editing').open, false);
    x.el('item-editing').open = true;
    x.el('item-description').value = '<script>literal prose</script>\nLast line';
    x.el('item-form').oninput();
    assert(await x.ui.flushItems());
    assert.equal(
      x.el('item-reference-description').textContent,
      '<script>literal prose</script>\nLast line',
    );
    assert.equal(x.el('item-reference-description').querySelector('script'), null);
    x.el('item-copy').onclick();
    await tick();
    await until(() => x.el('item-name').value.includes('Kopie'));
    assert.equal(x.el('item-editing').open, true);
    assert.equal(x.el('item-editing').hidden, false);
  } finally {
    await x.cleanup();
  }
});

test('collapsed active filters remain visible and reset preserves the lookup text', async () => {
  const x = await fixture();
  try {
    x.el('item-search').value = 'Cloak';
    x.el('item-filter-magic').value = 'yes';
    x.el('item-filter-magic').onchange();
    x.el('item-filter-rarity').value = 'uncommon';
    x.el('item-filter-rarity').onchange();
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await until(() => x.el('items-results').textContent.includes('Cloak of Protection'));
    assert.match(x.el('item-filter-summary').textContent, /Magisch:/);
    assert.match(x.el('item-filter-summary').textContent, /uncommon/);
    assert.equal(x.el('item-filter-reset').hidden, false);
    x.el('item-filter-reset').onclick();
    await until(() => x.el('item-filter-summary').textContent === 'Filter und Sortierung');
    assert.equal(x.el('item-search').value, 'Cloak');
    assert.equal(x.el('item-filter-magic').value, '');
    assert.equal(x.el('item-filter-rarity').value, '');
    assert.equal(x.el('item-filter-reset').hidden, true);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});

test('live roster keeps inactive recipients and traders but excludes archived characters', async () => {
  const x = await fixture(),
    execute = (action) =>
      x.store.executeLive({
        commandId: randomUUID(),
        campaignId: x.cam.id,
        token: x.w.token,
        action,
      });
  try {
    let live = x.store.live(x.w.token),
      borin = live.roster.find((c) => c.id === x.heroes[1].id);
    execute({
      kind: 'membership',
      characterId: borin.id,
      expectedRevision: borin.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      active: false,
      targetSceneId: null,
    });
    const archived = execute({ kind: 'create-character', profile: { name: 'Cato' } }).character;
    live = x.store.live(x.w.token);
    execute({
      kind: 'archive-character',
      characterId: archived.id,
      expectedRevision: archived.profileRevision,
      expectedMembershipRevision: archived.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      expectedFocusRevision: live.focusRevision,
      archived: true,
      confirmName: 'Cato',
      reason: 'Retired',
    });
    await x.ui.openItems();
    const options = (id) => [...x.el(id).options].map((o) => [o.value, o.textContent]),
      expected = [
        [x.heroes[0].id, 'Ada'],
        [borin.id, 'Borin · inaktiv'],
      ];
    assert.deepEqual(options('item-recipient'), expected);
    assert.deepEqual(options('shop-seller'), expected);
    x.el('item-recipient').value = borin.id;
    x.award();
    await x.settle();
    assert.equal(x.writes.length, 1);
    assert.equal(x.writes[0].action.kind, 'manual-item');
    assert.equal(x.writes[0].action.characterId, borin.id);
    assert.equal(
      x.writes[0].action.expectedMembershipRevision,
      x.store.live(x.w.token).roster.find((c) => c.id === borin.id).membershipRevision,
    );
  } finally {
    await x.cleanup();
  }
});
for (const source of ['preparation', 'live'])
  test(`item reference stays readable while ${source} is pending and dependent actions stay locked`, async () => {
    const x = await fixture(),
      pause = held(),
      original = window.campaign[source];
    let opening;
    try {
      window.campaign[source] = () => pause.promise;
      x.ui.activateItems(x.w);
      opening = x.ui.openItems();
      await until(() => x.el('items-results').children.length > 0);
      const item = x.store
        .itemDefinitions({
          search: 'Abacus',
          category: '',
          magic: '',
          rarity: '',
          attunement: '',
          sort: 'name',
          direction: 'asc',
          after: 0,
          includeTrashed: false,
        })
        .items.find((i) => i.source.kind === 'srd51');
      assert(item);
      const reference = x.ui.openItemReference(item.id);
      await until(
        () => x.el('item-reference-title').textContent === item.name && !x.el('item-copy').disabled,
      );
      assert.equal(x.el('item-award').disabled, true);
      assert.equal(x.el('item-treasure').disabled, true);
      assert.equal(x.el('shop-new').disabled, true);
      x.el('item-award').onclick();
      x.el('item-treasure').onclick();
      await tick();
      assert.equal(x.writes.length, 0);
      pause.resolve(await original(x.w.token, source === 'preparation' ? '' : undefined));
      await Promise.all([opening, reference]);
      assert.equal(x.el('item-award').disabled, false);
      assert.equal(x.el('item-reference-title').textContent, item.name);
    } finally {
      pause.resolve(await original(x.w.token, source === 'preparation' ? '' : undefined));
      if (opening) await opening;
      x.ui.activateItems(x.w);
      await x.cleanup();
    }
  });
for (const transport of [false, true])
  test(`failed item usage context is local, invalidates old actions and retries without blocking references (${transport ? 'transport' : 'storage'})`, async () => {
    const x = await fixture(),
      original = window.campaign.preparation;
    try {
      const before = x.store.progress(x.w.token),
        live = x.store.live(x.w.token);
      window.campaign.preparation = async () => {
        if (transport) throw new Error('Preparation unavailable');
        return { ok: false, error: 'Preparation unavailable' };
      };
      await x.ui.openItems();
      assert.match(x.el('item-context-status').textContent, /Preparation unavailable/);
      assert.equal(x.el('item-context-status').getAttribute('role'), 'alert');
      assert.equal(x.el('item-context-retry').hidden, false);
      assert(x.el('items-results').children.length > 0);
      assert.equal(x.el('item-award').disabled, true);
      assert.equal(x.el('shop-new').disabled, true);
      x.el('item-award').onclick();
      x.el('item-treasure').onclick();
      x.el('shop-new').onclick();
      await tick();
      assert.equal(x.writes.length, 0);
      await x.choose(x.defs[1].id);
      await until(() => x.el('item-reference-title').textContent === 'Heiltrank');
      assert.equal(x.el('item-copy').disabled, false);
      window.campaign.preparation = original;
      x.el('item-context-retry').onclick();
      await until(() => x.el('item-context-status').hidden && !x.el('item-award').disabled);
      assert.equal(x.el('item-reference-title').textContent, 'Heiltrank');
      assert.deepEqual(x.messages, []);
      assert.deepEqual(x.store.progress(x.w.token), before);
      assert.deepEqual(x.store.live(x.w.token), live);
      assert.equal(x.writes.length, 0);
    } finally {
      window.campaign.preparation = original;
      await x.cleanup();
    }
  });
test('an obsolete usage-context failure cannot revoke a newer activation', async () => {
  const x = await fixture(),
    original = window.campaign.preparation,
    pause = held();
  let old;
  try {
    window.campaign.preparation = () => pause.promise;
    old = x.ui.openItems();
    await tick();
    await tick();
    x.ui.activateItems(x.w);
    window.campaign.preparation = original;
    await x.ui.openItems();
    await x.choose(x.defs[1].id);
    await until(() => x.el('item-reference-title').textContent === 'Heiltrank');
    pause.reject(new Error('Old context failure'));
    await old;
    assert.equal(x.el('item-context-status').hidden, true);
    assert.equal(x.el('item-award').disabled, false);
    assert.deepEqual(x.messages, []);
  } finally {
    pause.resolve(await original(x.w.token, ''));
    if (old) await old;
    await x.cleanup();
  }
});

test('a cancelled external item handoff cannot replace the detail after its read finishes', async () => {
  const x = await fixture(),
    original = window.campaign.itemDefinition,
    pause = held();
  let opening,
    current = true;
  try {
    window.campaign.itemDefinition = (id) => (id === x.defs[1].id ? pause.promise : original(id));
    opening = x.ui.openItemReference(x.defs[1].id, () => current);
    await until(() => !x.el('item-load-status').hidden);
    current = false;
    pause.resolve(await original(x.defs[1].id));
    await opening;
    assert.equal(x.el('item-reference-title').textContent, 'Seil');
    assert.equal(x.el('item-load-status').hidden, true);
    assert.equal(x.el('item-copy').disabled, false);
    assert.equal(x.writes.length, 0);
  } finally {
    pause.resolve(await original(x.defs[1].id));
    if (opening) await opening;
    await x.cleanup();
  }
});

test('a known usage-context failure is shown even if another source never finishes', async () => {
  const x = await fixture(),
    preparation = window.campaign.preparation,
    live = window.campaign.live,
    pause = held();
  let opening;
  try {
    window.campaign.preparation = async () => ({ ok: false, error: 'Preparation unavailable' });
    window.campaign.live = () => pause.promise;
    opening = x.ui.openItems();
    await until(() => x.el('item-context-status').getAttribute('role') === 'alert');
    assert.match(x.el('item-context-status').textContent, /Preparation unavailable/);
    assert.equal(x.el('item-context-retry').hidden, false);
    assert.equal(x.el('item-award').disabled, true);
    assert.equal(x.writes.length, 0);
  } finally {
    pause.resolve(await live(x.w.token));
    if (opening) await opening;
    window.campaign.preparation = preparation;
    window.campaign.live = live;
    await x.cleanup();
  }
});

function searchClock() {
  const previous = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout },
    timers = new Map();
  let id = 0;
  globalThis.setTimeout = (fn, delay) => {
    timers.set(++id, { fn, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  return {
    async advance() {
      for (const [id, t] of [...timers])
        if (t.delay === 200) {
          timers.delete(id);
          t.fn();
        }
      await tick();
      await tick();
    },
    restore() {
      Object.assign(globalThis, previous);
    },
  };
}
test('item typing invalidates old results immediately and debounces only the final query without writes', async () => {
  const x = await fixture(),
    clock = searchClock();
  try {
    const original = window.campaign.itemDefinitions,
      calls = [];
    window.campaign.itemDefinitions = async (q) => {
      calls.push(q);
      return original(q);
    };
    x.el('item-search').value = 'C';
    x.el('item-search').oninput?.();
    assert.equal(x.el('items-results').children.length, 0);
    assert.match(x.el('items-page').textContent, /gesucht|geladen/);
    x.el('item-search').value = 'Cloak';
    x.el('item-search').oninput?.();
    assert.equal(calls.length, 0);
    await clock.advance();
    await until(() => x.el('items-results').textContent.includes('Cloak of Protection'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].search, 'Cloak');
    assert.equal(calls[0].after, 0);
    assert.equal(x.el('item-reference-title').textContent, 'Seil');
    assert.equal(x.writes.length, 0);
  } finally {
    x.ui.activateItems(x.w);
    clock.restore();
    await x.cleanup();
  }
});
test('pending old item query cannot replace newer typed input before its debounce', async () => {
  const x = await fixture(),
    clock = searchClock();
  try {
    const original = window.campaign.itemDefinitions,
      pause = held();
    window.campaign.itemDefinitions = () => pause.promise;
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await tick();
    x.el('item-search').value = 'Heiltrank';
    x.el('item-search').oninput?.();
    pause.resolve(
      await original({
        search: 'Seil',
        category: '',
        magic: '',
        rarity: '',
        attunement: '',
        sort: 'name',
        direction: 'asc',
        after: 0,
        includeTrashed: false,
      }),
    );
    await tick();
    await tick();
    assert.equal(x.el('items-results').children.length, 0);
    window.campaign.itemDefinitions = original;
    await clock.advance();
    await until(() => x.el('items-results').textContent.includes('Heiltrank'));
    assert.doesNotMatch(x.el('items-results').textContent, /Seil/);
    assert.equal(x.writes.length, 0);
  } finally {
    x.ui.activateItems(x.w);
    clock.restore();
    await x.cleanup();
  }
});
test('item filter debounce is cancelled by submit and activation and reset starts only one query', async () => {
  const x = await fixture(),
    clock = searchClock();
  try {
    const original = window.campaign.itemDefinitions,
      calls = [];
    window.campaign.itemDefinitions = async (q) => {
      calls.push(q);
      return original(q);
    };
    x.el('item-filter-magic').value = 'yes';
    x.el('item-filter-magic').onchange();
    await clock.advance();
    await until(() => calls.length === 1);
    assert.equal(calls[0].magic, 'yes');
    assert.equal(x.el('item-filter-reset').hidden, false);
    x.el('item-filter-rarity').value = 'uncommon';
    x.el('item-filter-rarity').oninput?.();
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await tick();
    await clock.advance();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].rarity, 'uncommon');
    x.el('item-filter-rarity').value = 'rare';
    x.el('item-filter-rarity').oninput?.();
    x.el('item-filter-reset').onclick();
    await tick();
    await clock.advance();
    assert.equal(calls.length, 3);
    assert.equal(calls[2].rarity, '');
    x.el('item-search').value = 'Cancelled';
    x.el('item-search').oninput?.();
    x.ui.activateItems(x.w);
    await clock.advance();
    assert.equal(calls.length, 3);
    assert.equal(x.writes.length, 0);
  } finally {
    x.ui.activateItems(x.w);
    clock.restore();
    await x.cleanup();
  }
});
test('failed item page has no accepted rows or paging actions and submit recovers from page one', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.itemDefinitions;
    x.el('item-search').value = '';
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await until(() => !x.el('items-next').disabled);
    window.campaign.itemDefinitions = async () => ({ ok: false, error: 'Second page failed' });
    x.el('items-next').onclick();
    await until(() => x.el('items-page').getAttribute('role') === 'alert');
    assert.equal(x.el('items-prev').disabled, true);
    assert.equal(x.el('items-next').disabled, true);
    assert.equal(x.el('items-results').children.length, 0);
    assert.equal(x.writes.length, 0);
    window.campaign.itemDefinitions = original;
    x.el('items-search-form').onsubmit({ preventDefault() {} });
    await until(() => x.el('items-page').textContent.includes('Seite 1'));
    assert.equal(x.el('items-prev').disabled, true);
    assert.equal(x.el('items-next').disabled, false);
  } finally {
    await x.cleanup();
  }
});
