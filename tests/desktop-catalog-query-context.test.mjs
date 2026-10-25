import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/catalog-ui.ts'],
  outfile: '.build/catalog-query-context.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(fn) {
  for (let i = 0; i < 100 && !fn(); i++) await tick();
  assert.ok(fn());
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const page = (name, offset = 0, total = 100) => ({
  rows: [
    {
      id: name,
      name,
      challengeRating: '1',
      type: 'Humanoid',
      size: 'Medium',
      ac: 12,
      hp: 10,
      xp: 200,
    },
  ],
  offset,
  total,
  limit: 25,
});
async function fixture(t, metadataFailure = false, overrides = {}) {
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    previous = {
      window: globalThis.window,
      document: globalThis.document,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      matchMedia: globalThis.matchMedia,
    };
  Object.assign(globalThis, { window, document });
  window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const timers = new Map();
  let timer = 0;
  globalThis.setTimeout = (fn, delay) => {
    timers.set(++timer, { fn, delay });
    return timer;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  t.after(() => Object.assign(globalThis, previous));
  const el = (id) => document.getElementById(id),
    ok = (value) => ({ ok: true, value }),
    reads = [],
    messages = [],
    liveAdds = [];
  window.campaign = {
    progress: async () => ok({ characters: [] }),
    creatureInfo: async () =>
      metadataFailure
        ? { ok: false, error: 'Catalog index unavailable' }
        : ok({
            notice: 'Offlinequelle',
            hash: 'pinned',
            types: [],
            sizes: [],
            habitats: [],
            alignments: [],
            subtypes: [],
          }),
    creatures: (query) => {
      const d = deferred();
      reads.push({ ...d, query });
      return d.promise;
    },
    encounterPlans: async () => ok([]),
    encounterTables: async () => ok([]),
    lootTables: async () => ok([]),
    generatorRegistry: async () => ok({ revision: 1, presets: [] }),
    generationRuns: async () => ok([]),
    generationSources: async () => ok({ sources: [], factions: [], locations: [] }),
    npcs: async () => ok({ rows: [], next: null, total: 0 }),
  };
  Object.assign(window.campaign, overrides);
  el('catalog-form').reset = () => {
    for (const input of el('catalog-form').querySelectorAll('input')) input.value = '';
    for (const select of el('catalog-form').querySelectorAll('select'))
      select.value = select.options[0]?.value ?? '';
  };
  delete require.cache[require.resolve('../.build/catalog-query-context.cjs')];
  const ui = require('../.build/catalog-query-context.cjs');
  ui.initCatalog(
    (...args) => messages.push(args),
    async () => {},
    async (...args) => {
      liveAdds.push(args);
    },
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.options[0]?.getAttribute('value') ?? '',
    });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.close = () => {
      dialog.open = false;
    };
    dialog.showModal = () => {
      dialog.open = true;
    };
  }
  const w = { token: 'one', campaign: { id: 'camp' } };
  ui.activateCatalog(w);
  const opened = ui.openCatalog();
  await until(() => (metadataFailure ? messages.length > 0 : reads.length === 1));
  const resolve = async (index, name, offset = 0, total = 100) => {
    reads[index].resolve(ok(page(name, offset, total)));
    await tick();
    await tick();
  };
  const type = (text) => {
    el('catalog-search').value = text;
    el('catalog-search').oninput();
  };
  const debounce = async () => {
    for (const [id, entry] of [...timers])
      if (entry.delay === 200) {
        timers.delete(id);
        entry.fn();
      }
    await tick();
  };
  return { ui, w, el, reads, messages, liveAdds, timers, opened, resolve, type, debounce };
}
for (const empty of [false, true])
  test(`returning to an accepted ${empty ? 'empty' : 'populated'} monster page keeps its exact rows, selection and paging without another source read`, async (t) => {
    const x = await fixture(t);
    await x.resolve(0, 'Guard');
    await x.opened;
    x.type('Dragon');
    await x.debounce();
    if (empty) {
      x.reads[1].resolve({ ok: true, value: { ...page('Dragon', 0, 0), rows: [] } });
      await tick();
      await tick();
    } else await x.resolve(1, 'Dragon');
    if (!empty) {
      x.el('catalog-next').click();
      await until(() => x.reads.length === 3);
      await x.resolve(2, 'Dragon page two', 25);
      window.campaign.creature = async () => ({ ok: true, value: detail('Dragon page two') });
      x.el('catalog-rows').querySelector('button').click();
      await tick();
      await tick();
    }
    const rows = [...x.el('catalog-rows').children],
      footer = x.el('catalog-page').textContent,
      inspector = x.el('catalog-detail').textContent,
      reads = x.reads.length;
    await x.ui.openCatalog();
    await x.ui.openCatalog();
    assert.equal(x.reads.length, reads);
    assert.deepEqual([...x.el('catalog-rows').children], rows);
    assert.equal(x.el('catalog-page').textContent, footer);
    assert.equal(x.el('catalog-search').value, 'Dragon');
    assert.equal(x.el('catalog-detail').textContent, inspector);
    assert.equal(x.el('catalog-table').getAttribute('aria-busy'), 'false');
    // An explicit new search still goes through the provider, including after an empty result.
    x.el('catalog-form').onsubmit({ preventDefault() {} });
    await until(() => x.reads.length === reads + 1);
    assert.equal(x.reads.at(-1).query.offset, 0);
    await x.resolve(reads, 'Explicit retry');
  });
test('returning after a failed source read retries instead of retaining the failure as an accepted page', async (t) => {
  const x = await fixture(t);
  x.reads[0].resolve({ ok: false, error: 'Read unavailable' });
  await x.opened;
  assert.equal(x.el('catalog-page').getAttribute('role'), 'alert');
  const retry = x.ui.openCatalog();
  await until(() => x.reads.length === 2);
  await x.resolve(1, 'Recovered');
  await retry;
  assert.match(x.el('catalog-rows').textContent, /Recovered/);
  assert.equal(x.el('catalog-table').getAttribute('aria-busy'), 'false');
});
test('typing invalidates an older query before debounce and clears old actionable rows', async (t) => {
  const x = await fixture(t);
  x.type('Dragon');
  await x.resolve(0, 'Old goblin');
  assert.equal(x.el('catalog-rows').querySelectorAll('button').length, 0);
  assert.match(x.el('catalog-page').textContent, /gesucht|geladen|Suche/i);
  await x.debounce();
  assert.equal(x.reads[1].query.text, 'Dragon');
  await x.resolve(1, 'Dragon');
  assert.match(x.el('catalog-rows').textContent, /Dragon/);
  assert.doesNotMatch(x.el('catalog-rows').textContent, /Old goblin/);
});
test('a failed current query has a local error and no stale result or page actions, and submit recovers', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Goblin');
  x.type('Broken');
  await x.debounce();
  x.reads[1].resolve({ ok: false, error: 'Catalog unavailable' });
  await tick();
  await tick();
  assert.equal(x.el('catalog-rows').querySelectorAll('button').length, 0);
  assert.match(x.el('catalog-page').textContent, /Catalog unavailable/);
  assert.equal(x.el('catalog-prev').disabled, true);
  assert.equal(x.el('catalog-next').disabled, true);
  x.el('catalog-form').onsubmit({ preventDefault() {} });
  await until(() => x.reads.length === 3);
  assert.equal(x.reads[2].query.text, 'Broken');
  await x.resolve(2, 'Recovered');
  assert.match(x.el('catalog-rows').textContent, /Recovered/);
});
test('reset cancels a pending debounce and requests only the unfiltered first page', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Goblin');
  x.el('catalog-next').click();
  await until(() => x.reads.length === 2);
  await x.resolve(1, 'Second', 25);
  x.type('Dragon');
  x.el('catalog-reset').click();
  await until(() => x.reads.length === 3);
  assert.equal(x.reads[2].query.text, '');
  assert.equal(x.reads[2].query.offset, 0);
  await x.resolve(2, 'Reset');
  await x.debounce();
  assert.equal(x.reads.length, 3);
});
test('sort cancels debounce and a late error cannot replace the newer sorted page', async (t) => {
  const x = await fixture(t);
  x.type('Dragon');
  const sort = x.el('catalog-table').querySelector('thead button');
  sort.click();
  await until(() => x.reads.length === 2);
  assert.equal(x.reads[1].query.offset, 0);
  assert.equal(x.reads[1].query.text, 'Dragon');
  await x.resolve(1, 'Sorted Dragon');
  x.reads[0].reject(new Error('Old failure'));
  await tick();
  await tick();
  await x.debounce();
  assert.equal(x.reads.length, 2);
  assert.match(x.el('catalog-rows').textContent, /Sorted Dragon/);
  assert.equal(x.messages.filter((m) => m[1]).length, 0);
});
test('activation invalidates old rows and late campaign responses', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Old campaign');
  x.ui.activateCatalog({ ...x.w, token: 'two', campaign: { id: 'other' } });
  assert.equal(x.el('catalog-rows').querySelectorAll('button').length, 0);
  const next = x.ui.openCatalog();
  await until(() => x.reads.length === 2);
  await x.resolve(1, 'Current');
  await next;
  assert.match(x.el('catalog-rows').textContent, /Current/);
});

test('metadata failure stays local while healthy creature results and explicit details remain usable', async (t) => {
  const x = await fixture(t, true);
  await x.resolve(0, 'Guard');
  await x.opened;
  assert.match(x.el('catalog-credit').textContent, /Catalog index unavailable/);
  assert.equal(x.el('catalog-credit').getAttribute('role'), 'alert');
  assert.match(x.el('catalog-rows').textContent, /Guard/);
  window.campaign.creature = async () => ({ ok: true, value: detail('Guard') });
  x.el('catalog-rows').querySelector('button').click();
  await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Guard');
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      notice: 'Recovered source credit',
      hash: 'pinned',
      types: ['Humanoid'],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
    },
  });
  const row = x.el('catalog-rows').querySelector('button');
  await x.ui.openCatalog();
  assert.equal(x.reads.length, 1);
  assert.equal(x.el('catalog-rows').querySelector('button'), row);
  assert.equal(x.el('catalog-credit').textContent, 'Recovered source credit');
  assert.notEqual(x.el('catalog-credit').getAttribute('role'), 'alert');
  assert.equal(x.el('catalog-type').querySelectorAll('option').length, 2);
});
test('an old campaign query cannot overwrite a completed new campaign query', async (t) => {
  const x = await fixture(t);
  x.ui.activateCatalog({ ...x.w, token: 'two', campaign: { id: 'other' } });
  const next = x.ui.openCatalog();
  await until(() => x.reads.length === 2);
  await x.resolve(1, 'Current');
  await next;
  await x.resolve(0, 'Old');
  await x.opened;
  assert.match(x.el('catalog-rows').textContent, /Current/);
  assert.doesNotMatch(x.el('catalog-rows').textContent, /Old/);
});
test('a delayed detail read cannot replace a later query error with a false empty result', async (t) => {
  const x = await fixture(t),
    detail = deferred();
  window.campaign.creature = () => detail.promise;
  await x.resolve(0, 'Goblin');
  x.el('catalog-rows').querySelector('button').click();
  x.type('Broken');
  await x.debounce();
  x.reads[1].reject(new Error('Current search failed'));
  await tick();
  await tick();
  detail.resolve({
    ok: true,
    value: {
      id: 'Goblin',
      name: 'Goblin',
      abilities: {},
      traits: [],
      actions: [],
      legendaryActions: [],
    },
  });
  await tick();
  await tick();
  assert.match(x.el('catalog-page').textContent, /Current search failed/);
  assert.equal(x.el('catalog-page').getAttribute('role'), 'alert');
  assert.equal(x.el('catalog-rows').querySelectorAll('button').length, 0);
});

test('table lookups preserve the surrounding filters, paging and generation source even before debounce completes', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Guard');
  await x.opened;
  x.type('Guard');
  x.el('catalog-cr-max').value = '2';
  x.el('catalog-type').value = 'Humanoid';
  await x.debounce();
  await x.resolve(1, 'Guard');
  x.el('catalog-next').click();
  await until(() => x.reads.length === 3);
  await x.resolve(2, 'Guard page two', 25);
  const context = x.el('generation-catalog-summary').textContent;
  x.el('encounter-table-new').click();
  await tick();
  assert.equal(x.el('table-manager').open, true);
  x.type('Wolf');
  await x.debounce();
  assert.equal(x.reads[3].query.text, 'Wolf');
  assert.equal(x.el('generation-catalog-summary').textContent, context);
  // Closing also invalidates a lookup still in flight, before the restored query returns.
  x.el('table-close').click();
  await until(() => x.reads.length === 5);
  assert.equal(x.el('table-manager').open, false);
  assert.equal(x.el('catalog-search').value, 'Guard');
  assert.equal(x.el('catalog-cr-max').value, '2');
  assert.equal(x.el('catalog-type').value, 'Humanoid');
  assert.equal(x.reads[4].query.text, 'Guard');
  assert.equal(x.reads[4].query.offset, 25);
  assert.deepEqual(x.reads[4].query.types, ['Humanoid']);
  await x.resolve(4, 'Restored Guard', 25);
  await x.resolve(3, 'Late Wolf');
  assert.match(x.el('catalog-rows').textContent, /Restored Guard/);
  assert.doesNotMatch(x.el('catalog-rows').textContent, /Late Wolf/);
  assert.equal(x.el('generation-catalog-summary').textContent, context);
  // Reset inside another clean manager is local too and its queued lookup is cancelled on close.
  x.el('encounter-table-new').click();
  await tick();
  x.type('Goblin');
  x.el('catalog-reset').click();
  await until(() => x.reads.length === 6);
  assert.equal(x.reads[5].query.text, '');
  assert.equal(x.el('generation-catalog-summary').textContent, context);
  x.el('table-close').click();
  await until(() => x.reads.length === 7);
  await x.resolve(6, 'Guard again', 25);
  await x.debounce();
  assert.equal(x.reads.length, 7);
});

test('closing the table manager cannot transfer its late creature selection into the surrounding catalog', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Guard');
  await x.opened;
  const detail = (id) => ({
    id,
    name: id,
    abilities: {},
    traits: [],
    actions: [],
    legendaryActions: [],
  });
  window.campaign.creature = async (id) => ({ ok: true, value: detail(id) });
  x.el('catalog-rows').querySelector('button').click();
  await tick();
  await tick();
  assert.match(x.el('catalog-detail').textContent, /Guard/);
  x.el('encounter-table-new').click();
  await tick();
  x.type('Wolf');
  await x.debounce();
  await x.resolve(1, 'Wolf');
  const pending = deferred();
  window.campaign.creature = () => pending.promise;
  x.el('catalog-rows').querySelector('button').click();
  x.el('table-close').click();
  await until(() => x.reads.length === 3);
  pending.resolve({ ok: true, value: detail('Wolf') });
  await tick();
  await tick();
  assert.match(x.el('catalog-detail').textContent, /Guard/);
  assert.doesNotMatch(x.el('catalog-detail').textContent, /Wolf/);
  await x.resolve(2, 'Guard');
});

test('saving a table keeps its searched entry without making that search a generator filter', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Guard');
  await x.opened;
  window.campaign.creature = async (id) => ({
    ok: true,
    value: { id, name: id, abilities: {}, traits: [], actions: [], legendaryActions: [] },
  });
  const writes = [];
  window.campaign.executeGeneration = async (command) => {
    writes.push(command);
    return {
      ok: true,
      value: {
        tables: [{ ...command.action.table, revision: 1 }],
        lootTables: [],
        registry: { revision: 1, presets: [] },
      },
    };
  };
  x.el('encounter-table-new').click();
  await tick();
  x.el('table-name').value = 'Waldsaum';
  x.el('table-name').oninput();
  x.type('Wolf');
  await x.debounce();
  await x.resolve(1, 'Wolf');
  x.el('catalog-rows').querySelector('button').click();
  await tick();
  await tick();
  x.el('table-add-creature').click();
  x.el('table-form').onsubmit({ preventDefault() {} });
  await until(() => !x.el('table-manager').open);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].action.table.entries, [{ creatureId: 'Wolf', weight: '1' }]);
  assert.equal(x.el('catalog-search').value, '');
  assert.match(x.el('generation-catalog-summary').textContent, /Keine zusätzlichen/);
  await x.resolve(2, 'Restored catalog');
  assert.match(x.el('catalog-rows').textContent, /Restored catalog/);
});

test('removing a numeric filter chip preserves the name and type criteria', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Goblin');
  await x.opened;
  x.type('Goblin');
  x.el('catalog-type').value = 'Humanoid';
  x.el('catalog-type').oninput();
  x.el('catalog-cr-max').value = '1';
  x.el('catalog-cr-max').oninput();
  assert.equal(x.el('catalog-filter-chips').querySelectorAll('button').length, 3);
  x.el('catalog-cr-max').focus = () => {};
  [...x.el('catalog-filter-chips').querySelectorAll('button')]
    .find((b) => b.getAttribute('aria-label') === 'HG bis entfernen')
    .click();
  await x.debounce();
  assert.equal(x.reads[1].query.text, 'Goblin');
  assert.deepEqual(x.reads[1].query.types, ['Humanoid']);
  assert.equal(x.reads[1].query.crMax, undefined);
  assert.equal(x.el('catalog-filter-chips').querySelectorAll('button').length, 2);
});

for (const [changed, low, high, expectedLow, expectedHigh] of [
  ['min', '8', '5', '8', '8'],
  ['max', '8', '2', '2', '2'],
  ['min', '0.5', '0.125', '0.5', '0.5'],
  ['max', '0.5', '0.125', '0.125', '0.125'],
  ['min', '-2', '5', '0', '5'],
  ['max', '2', '-1', '0', '0'],
])
  test(`HG range follows the changed ${changed} bound (${low}..${high}) without changing other filters`, async (t) => {
    const x = await fixture(t);
    await x.resolve(0, 'Initial');
    await x.opened;
    x.type('Dragon');
    x.el('catalog-type').value = 'Dragon';
    x.el('catalog-cr-min').value = low;
    x.el('catalog-cr-max').value = high;
    x.el('catalog-cr-' + changed).oninput();
    x.el('catalog-cr-' + changed).onchange?.();
    assert.equal(x.el('catalog-cr-min').value, expectedLow);
    assert.equal(x.el('catalog-cr-max').value, expectedHigh);
    await x.debounce();
    const q = x.reads[1].query;
    assert.equal(q.crMin, Number(expectedLow) === 0 ? undefined : Number(expectedLow));
    assert.equal(q.crMax, Number(expectedHigh));
    assert.equal(q.text, 'Dragon');
    assert.deepEqual(q.types, ['Dragon']);
    assert.equal(q.offset, 0);
    assert.match(
      x.el('generation-catalog-summary').textContent,
      new RegExp('HG bis: ' + Number(expectedHigh)),
    );
    assert.equal(
      [...x.el('catalog-filter-chips').querySelectorAll('button')].some(
        (b) => b.getAttribute('aria-label') === 'HG von entfernen',
      ),
      Number(expectedLow) !== 0,
    );
  });
test('zero lower HG is the unfiltered default, while a zero upper HG remains an active exact bound', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Initial');
  await x.opened;
  x.el('catalog-cr-min').value = '0';
  x.el('catalog-cr-min').oninput();
  await x.debounce();
  assert.equal(x.reads[1].query.crMin, undefined);
  assert.equal(x.el('catalog-filter-chips').childElementCount, 0);
  assert.match(x.el('generation-catalog-summary').textContent, /Keine zusätzlichen/);
  await x.resolve(1, 'All');
  x.el('catalog-cr-max').value = '0';
  x.el('catalog-cr-max').oninput();
  await x.debounce();
  assert.equal(x.reads[2].query.crMax, 0);
  assert.equal(x.reads[2].query.crMin, undefined);
  assert.equal(x.el('catalog-filter-chips').childElementCount, 1);
  assert.match(x.el('generation-catalog-summary').textContent, /HG bis: 0/);
});
test('an incomplete native numeric filter is not read as an empty unrestricted filter and recovers without losing other inputs', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Initial');
  await x.opened;
  const input = x.el('catalog-cr-min');
  let bad = true;
  Object.defineProperty(input, 'validity', { get: () => ({ badInput: bad }) });
  x.el('catalog-search').value = 'Guard';
  input.value = '';
  assert.doesNotThrow(() => input.oninput());
  await x.debounce();
  assert.equal(x.reads.length, 1, 'no unrestricted IPC while the browser reports badInput');
  assert.equal(x.el('catalog-page').getAttribute('role'), 'alert');
  assert.match(x.el('catalog-page').textContent, /HG von.*Zahl/);
  assert.match(x.el('generation-catalog-summary').textContent, /HG von.*Zahl/);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  bad = false;
  input.value = '0.125';
  input.oninput();
  await x.debounce();
  assert.equal(x.reads.length, 2);
  assert.equal(x.reads[1].query.crMin, 0.125);
  assert.equal(x.reads[1].query.text, 'Guard');
  assert.notEqual(input.getAttribute('aria-invalid'), 'true');
  await x.resolve(1, 'Guard');
  assert.notEqual(x.el('catalog-page').getAttribute('role'), 'alert');
});
test('typing a multi-digit HG bound preserves the other bound until a complete value is committed', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Initial');
  await x.opened;
  const low = x.el('catalog-cr-min'),
    high = x.el('catalog-cr-max');
  low.value = '8';
  high.value = '8';
  high.value = '1';
  high.oninput();
  assert.equal(low.value, '8', 'the first character of 12 must not replace the lower bound');
  await x.debounce();
  assert.equal(x.reads.length, 1, 'an inconsistent draft is not sent');
  assert.equal(x.el('catalog-page').getAttribute('role'), 'alert');
  high.value = '12';
  high.oninput();
  await x.debounce();
  assert.equal(low.value, '8');
  assert.equal(x.reads[1].query.crMin, 8);
  assert.equal(x.reads[1].query.crMax, 12);
  await x.resolve(1, 'Range8to12');
  high.onchange();
  await x.debounce();
  assert.equal(x.reads.length, 2, 'blur of a valid bound must not duplicate the query');
  high.value = '2';
  high.oninput();
  await x.debounce();
  assert.equal(low.value, '8');
  assert.equal(x.reads.length, 2);
  high.onchange();
  assert.equal(low.value, '2');
  await x.debounce();
  assert.equal(x.reads[2].query.crMin, 2);
  assert.equal(x.reads[2].query.crMax, 2);
});
test('column sorting toggles visibly and clearing filters keeps that sort and selected detail', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Goblin');
  await x.opened;
  window.campaign.creature = async () => ({
    ok: true,
    value: {
      id: 'Goblin',
      name: 'Goblin',
      abilities: {},
      traits: [],
      actions: [],
      legendaryActions: [],
    },
  });
  x.el('catalog-rows').querySelector('button').click();
  await tick();
  await tick();
  const hp = x.el('catalog-table').querySelector('[data-sort="hp"]');
  hp.click();
  await until(() => x.reads.length === 2);
  assert.equal(x.reads[1].query.direction, 'asc');
  assert.equal(hp.parentElement.getAttribute('aria-sort'), 'ascending');
  await x.resolve(1, 'Goblin');
  hp.click();
  await until(() => x.reads.length === 3);
  assert.equal(x.reads[2].query.direction, 'desc');
  assert.match(hp.textContent, /↓/);
  await x.resolve(2, 'Goblin');
  x.type('Dragon');
  x.el('catalog-reset').click();
  await until(() => x.reads.length === 4);
  assert.equal(x.reads[3].query.text, '');
  assert.equal(x.reads[3].query.sort, 'hp');
  assert.equal(x.reads[3].query.direction, 'desc');
  await x.resolve(3, 'Goblin');
  assert.match(x.el('catalog-detail').textContent, /Goblin/);
  assert.equal(x.el('catalog-rows').querySelector('button').getAttribute('aria-pressed'), 'true');
});
const detail = (id) => ({
  id,
  name: id,
  abilities: { str: 10 },
  traits: [],
  actions: [],
  legendaryActions: [],
});
async function detailFixture(t, { withPlan = false } = {}) {
  const x = await fixture(t);
  window.campaign.creature = async (id) => ({ ok: true, value: detail(id) });
  window.campaign.saveEncounterPlan = async (c) => ({
    ok: true,
    value: { ...c.plan, revision: c.plan.revision + 1 },
  });
  await x.resolve(0, 'Guard');
  await x.opened;
  x.el('catalog-rows').querySelector('button').click();
  await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Guard');
  if (withPlan) {
    x.el('encounter-new').click();
    await until(() => x.messages.some((m) => m[0] === 'Encounter-Vorlage gespeichert.'));
  }
  x.choose = async (name) => {
    const n = x.reads.length;
    x.el('catalog-form').onsubmit({ preventDefault() {} });
    await until(() => x.reads.length > n);
    await x.resolve(n, name);
    x.el('catalog-rows').querySelector('button').click();
    await tick();
  };
  return x;
}
test('pending creature detail removes the previous statblock and its encounter, live and table actions', async (t) => {
  const x = await detailFixture(t, { withPlan: true }),
    held = deferred();
  x.el('encounter-table-new').click();
  await until(() => x.el('table-manager').open);
  assert.equal(x.el('table-add-creature').disabled, false);
  window.campaign.creature = () => held.promise;
  await x.choose('Wolf');
  assert.doesNotMatch(x.el('catalog-detail').textContent, /Guard/);
  assert.match(x.el('catalog-detail').textContent, /geladen/);
  assert.equal(x.el('catalog-detail').getAttribute('aria-busy'), 'true');
  for (const id of ['catalog-add', 'catalog-live-add', 'table-add-creature'])
    assert.equal(x.el(id).disabled, true);
  x.el('catalog-add').onclick();
  x.el('catalog-live-add').onclick();
  x.el('table-add-creature').onclick();
  await tick();
  assert.equal(x.el('encounter-entries').children.length, 0);
  assert.equal(x.el('table-entries').querySelectorAll('input').length, 0);
  assert.deepEqual(x.liveAdds, []);
  x.el('table-close').click();
  await until(() => !x.el('table-manager').open);
  held.resolve({ ok: true, value: detail('Wolf') });
  await tick();
  await tick();
  assert.equal(x.el('catalog-detail').querySelector('h3').textContent, 'Guard');
  assert.equal(x.el('catalog-detail').getAttribute('aria-busy'), 'false');
});
test('a failed detail read reports its provider error locally, blocks old actions and retries the same row', async (t) => {
  const message = 'Statblock-Speicher ausgefallen';
  const x = await detailFixture(t);
  window.campaign.creature = async () => ({ ok: false, error: message });
  await x.choose('Wolf');
  assert.equal(x.el('catalog-detail').getAttribute('role'), 'alert');
  assert.match(x.el('catalog-detail').textContent, new RegExp(message));
  assert.doesNotMatch(x.el('catalog-detail').textContent, /Guard/);
  assert.equal(x.el('catalog-live-add').disabled, true);
  x.el('catalog-live-add').onclick();
  await tick();
  assert.deepEqual(x.liveAdds, []);
  window.campaign.creature = async (id) => ({ ok: true, value: detail(id) });
  x.el('catalog-rows').querySelector('button').click();
  await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Wolf');
  assert.equal(x.el('catalog-detail').getAttribute('aria-busy'), 'false');
  assert.notEqual(x.el('catalog-detail').getAttribute('role'), 'alert');
  assert.equal(x.el('catalog-detail').querySelectorAll('input,textarea,button').length, 0);
  x.el('catalog-live-add').onclick();
  await tick();
  assert.equal(x.liveAdds[0]?.[0], 'Wolf');
});
test('a mismatching creature reply cannot enable handoff for another requested statblock', async (t) => {
  const x = await detailFixture(t);
  window.campaign.creature = async () => ({ ok: true, value: detail('Guard') });
  await x.choose('Wolf');
  assert.equal(x.el('catalog-detail').getAttribute('role'), 'alert');
  assert.match(x.el('catalog-detail').textContent, /anderen Kreatur/);
  assert.equal(x.el('catalog-live-add').disabled, true);
});
test('an old detail error cannot clear a newer loaded selection', async (t) => {
  const x = await detailFixture(t),
    held = deferred();
  window.campaign.creature = () => held.promise;
  await x.choose('Wolf');
  window.campaign.creature = async (id) => ({ ok: true, value: detail(id) });
  await x.choose('Dragon');
  x.messages.length = 0;
  held.resolve({ ok: false, error: 'Überholter Statblockfehler' });
  await tick();
  await tick();
  assert.equal(x.el('catalog-detail').querySelector('h3').textContent, 'Dragon');
  assert.equal(x.el('catalog-live-add').disabled, false);
  assert.deepEqual(x.messages, []);
});
test('campaign activation clears the previous statblock, table selection and pending detail authority', async (t) => {
  const x = await detailFixture(t, { withPlan: true }),
    held = deferred();
  window.campaign.creature = () => held.promise;
  await x.choose('Wolf');
  x.ui.activateCatalog({ ...x.w, token: 'two', campaign: { id: 'other' } });
  held.resolve({ ok: true, value: detail('Wolf') });
  await tick();
  await tick();
  assert.equal(x.el('catalog-detail').querySelector('h3'), null);
  assert.match(x.el('catalog-detail').textContent, /Wähle eine Kreatur/);
  assert.equal(x.el('catalog-detail').getAttribute('aria-busy'), 'false');
  assert.match(x.el('table-selected-creature').textContent, /Keine Kreatur/);
  for (const id of ['catalog-add', 'catalog-live-add', 'table-add-creature'])
    assert.equal(x.el(id).disabled, true);
});

test('a narrow catalog reveals pending detail and returns to the unchanged query without a second lookup', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Goblin');
  await x.opened;
  const jumps = [];
  window.matchMedia = () => ({ matches: true });
  x.el('catalog-inspector').scrollIntoView = () => jumps.push('detail');
  x.el('catalog-detail').focus = () => {};
  x.el('catalog-browser').scrollIntoView = () => jumps.push('results');
  x.el('catalog-search').focus = () => {};
  const held = deferred();
  window.campaign.creature = () => held.promise;
  x.el('catalog-search').value = 'Goblin';
  x.el('catalog-rows').querySelector('button').click();
  await tick();
  assert.deepEqual(jumps, ['detail']);
  assert.match(x.el('catalog-detail').textContent, /geladen/);
  held.resolve({ ok: true, value: detail('Goblin') });
  await tick();
  await tick();
  x.el('catalog-results-return').click();
  assert.deepEqual(jumps, ['detail', 'results']);
  assert.equal(x.el('catalog-search').value, 'Goblin');
  assert.equal(x.reads.length, 1);
});

test('pending metadata does not block queries or restart newer typed results when it completes', async (t) => {
  const held = deferred(),
    x = await fixture(t, false, { creatureInfo: () => held.promise });
  await x.resolve(0, 'Initial');
  x.type('Wolf');
  await x.debounce();
  await x.resolve(1, 'Wolf');
  held.resolve({
    ok: true,
    value: {
      notice: 'Offline source',
      hash: 'pinned',
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
    },
  });
  await x.opened;
  assert.equal(x.reads.length, 2);
  assert.match(x.el('catalog-rows').textContent, /Wolf/);
  assert.equal(x.el('catalog-search').value, 'Wolf');
});
test('an explicit source opens without waiting for metadata, query, plan list or generation readers', async (t) => {
  const held = deferred(),
    x = await fixture(t, true);
  await x.resolve(0, 'Guard');
  await x.opened;
  const requests = [];
  window.campaign.creature = async (id) => {
    requests.push(id);
    return { ok: true, value: detail(id) };
  };
  for (const name of ['creatureInfo', 'encounterPlans', 'generatorRegistry'])
    window.campaign[name] = () => held.promise;
  const opened = x.ui.openCatalogReference({ kind: 'creature', id: 'Wolf' });
  await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Wolf');
  await opened;
  assert.deepEqual(requests, ['Wolf']);
  assert.deepEqual(x.liveAdds, []);
  assert.equal(x.el('encounter-entries').children.length, 0);
});

test('old metadata failure cannot replace the new campaign source credit or results', async (t) => {
  const held = deferred(),
    x = await fixture(t, false, { creatureInfo: () => held.promise });
  await x.resolve(0, 'Old');
  x.ui.activateCatalog({ ...x.w, token: 'two', campaign: { id: 'other' } });
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      notice: 'Current credit',
      hash: 'pinned',
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
    },
  });
  const opened = x.ui.openCatalog();
  await until(() => x.reads.length === 2);
  await x.resolve(1, 'Current');
  await opened;
  held.resolve({ ok: false, error: 'Old metadata error' });
  await x.opened;
  assert.equal(x.el('catalog-credit').textContent, 'Current credit');
  assert.match(x.el('catalog-rows').textContent, /Current/);
  assert.deepEqual(x.messages, []);
});
test('explicit saved encounter source opens while the browsing query and registry remain pending', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Guard');
  await x.opened;
  window.campaign.generatorRegistry = () => deferred().promise;
  window.campaign.encounterPlan = async (token, id) => ({
    ok: true,
    value: {
      id,
      revision: 1,
      name: 'Viewed source',
      notes: '  Unchanged author prose\r\n',
      party: [],
      entries: [],
      sources: [],
      catalogHash: 'pinned',
    },
  });
  const opened = x.ui.openCatalogReference({ kind: 'encounter', id: 'source' });
  await until(() => x.el('encounter-name').value === 'Viewed source');
  await opened;
  assert.equal(x.el('encounter-notes').value, '  Unchanged author prose\r\n');
  assert.deepEqual(x.liveAdds, []);
});

for (const failure of [false, true])
  test(`detail ${failure ? 'failure' : 'success'} retains the result buttons and updates selection without rebuilding rows`, async (t) => {
    const x = await fixture(t),
      held = deferred();
    window.campaign.creature = () => held.promise;
    x.reads[0].resolve({
      ok: true,
      value: { ...page('Guard'), rows: [...page('Guard').rows, ...page('Wolf').rows] },
    });
    await x.opened;
    const buttons = [...x.el('catalog-rows').querySelectorAll('button')],
      text = x.el('catalog-page').textContent;
    buttons[0].click();
    assert.equal(
      buttons.every((b) => b.isConnected),
      true,
    );
    assert.deepEqual(
      buttons.map((b) => b.getAttribute('aria-pressed')),
      ['false', 'false'],
    );
    held.resolve(
      failure
        ? { ok: false, error: 'Controlled detail error' }
        : { ok: true, value: detail('Guard') },
    );
    await until(() => x.el('catalog-detail').getAttribute('aria-busy') === 'false');
    const current = [...x.el('catalog-rows').querySelectorAll('button')];
    assert.equal(
      current.every((b, i) => b === buttons[i]),
      true,
    );
    assert.deepEqual(
      current.map((b) => b.getAttribute('aria-pressed')),
      [String(!failure), 'false'],
    );
    assert.equal(x.el('catalog-page').textContent, text);
    assert.equal(x.reads.length, 1);
    if (failure) {
      assert.equal(x.el('catalog-live-add').disabled, true);
      window.campaign.creature = async () => ({ ok: true, value: detail('Wolf') });
      buttons[1].click();
      await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Wolf');
      assert.deepEqual(
        buttons.map((b) => b.getAttribute('aria-pressed')),
        ['false', 'true'],
      );
      assert.equal(
        buttons.every((b) => b.isConnected),
        true,
      );
    }
  });

test('a creature clicked from the encounter roster reveals its detail on a wide screen and returns without changing the draft', async (t) => {
  const x = await detailFixture(t, { withPlan: true }),
    jumps = [];
  window.matchMedia = () => ({ matches: false });
  x.el('catalog-inspector').scrollIntoView = () => jumps.push('detail');
  x.el('catalog-detail').focus = () => {};
  x.el('encounter-builder').scrollIntoView = () => jumps.push('plan');
  x.el('encounter-name').focus = () => {};
  x.el('catalog-quantity').value = '3';
  x.el('catalog-add').click();
  x.el('encounter-notes').value = 'Kornsäcke retten; Flucht vor Feuer.';
  x.el('encounter-notes').oninput();
  const before = x.el('encounter-entries').textContent;
  let reads = 0;
  window.campaign.creature = async () => {
    reads++;
    throw new Error('Current catalog must not be read for this snapshot');
  };
  x.el('encounter-entries').querySelector('button').click();
  await tick();
  assert.deepEqual(jumps, ['detail']);
  assert.equal(x.el('catalog-detail').querySelector('h3').textContent, 'Guard');
  assert.equal(reads, 0);
  assert.match(x.el('creature-reading-source').textContent, /Quellenstand im Vorlagenentwurf/);
  x.el('catalog-plan-open').click();
  assert.deepEqual(jumps, ['detail', 'plan']);
  assert.equal(x.el('encounter-notes').value, 'Kornsäcke retten; Flucht vor Feuer.');
  assert.equal(x.el('encounter-entries').textContent, before);
  assert.equal(x.el('encounter-entries').querySelector('input[type="number"]').value, '3');
});

test('changing section cancels monster debounce and late query success or failure until return', async (t) => {
  const x = await fixture(t, false, {
    itemReferenceCatalog: async () => ({ ok: false, error: 'No items in fixture' }),
  });
  x.type('Dragon');
  x.el('catalog-items-tab').click();
  await x.debounce();
  assert.equal(x.reads.length, 1);
  assert.equal(x.el('catalog-table').getAttribute('aria-busy'), 'false');
  await x.resolve(0, 'Late Goblin');
  assert.equal(x.el('catalog-rows').children.length, 0);
  x.el('catalog-monsters-tab').click();
  assert.equal(x.reads.length, 2);
  assert.equal(x.reads[1].query.text, 'Dragon');
  x.el('catalog-monsters-tab').click();
  assert.equal(x.reads.length, 2);
  x.el('catalog-items-tab').click();
  x.reads[1].reject(new Error('Invisible failure'));
  await tick();
  await tick();
  assert.equal(x.messages.filter((m) => m[1]).length, 0);
  x.el('catalog-monsters-tab').click();
  assert.equal(x.reads.length, 3);
  await x.resolve(2, 'Dragon');
  assert.match(x.el('catalog-rows').textContent, /Dragon/);
});
test('section return preserves accepted monster page, sort and selected detail without reloading', async (t) => {
  let detailReads = 0;
  const x = await fixture(t, false, {
    itemReferenceCatalog: async () => ({ ok: false, error: 'No items in fixture' }),
    creature: async (id) => {
      detailReads++;
      return { ok: true, value: detail(id) };
    },
  });
  await x.resolve(0, 'Guard');
  x.el('catalog-table').querySelector('[data-sort="xp"]').click();
  await x.resolve(1, 'Sorted Guard');
  x.el('catalog-next').click();
  await x.resolve(2, 'Second Guard', 25);
  const row = x.el('catalog-rows').querySelector('button');
  row.click();
  await tick();
  await tick();
  const html = x.el('catalog-detail').innerHTML;
  x.el('catalog-items-tab').click();
  row.onclick();
  await tick();
  assert.equal(detailReads, 1);
  x.el('catalog-monsters-tab').click();
  await tick();
  assert.equal(x.reads.length, 3);
  assert.equal(x.reads[2].query.offset, 25);
  assert.equal(x.reads[2].query.sort, 'xp');
  assert.equal(x.el('catalog-detail').innerHTML, html);
  assert.equal(row.isConnected, true);
  assert.equal(row.getAttribute('aria-pressed'), 'true');
});
test('hidden pending statblock loses authority and busy state; explicit selection recovers', async (t) => {
  const pending = [];
  const x = await fixture(t, false, {
    itemReferenceCatalog: async () => ({ ok: false, error: 'No items in fixture' }),
    creature: (id) => {
      const d = deferred();
      pending.push({ ...d, id });
      return d.promise;
    },
  });
  await x.resolve(0, 'Guard');
  const row = x.el('catalog-rows').querySelector('button');
  row.click();
  x.el('catalog-items-tab').click();
  assert.equal(x.el('catalog-detail').getAttribute('aria-busy'), 'false');
  pending[0].resolve({ ok: true, value: detail('Guard') });
  await tick();
  await tick();
  assert.equal(Boolean(x.el('catalog-detail').querySelector('h3')), false);
  assert.equal(x.el('catalog-live-add').disabled, true);
  x.el('catalog-monsters-tab').click();
  row.click();
  assert.equal(pending.length, 2);
  pending[1].reject(new Error('Invisible statblock failure'));
  x.el('catalog-items-tab').click();
  await tick();
  await tick();
  assert.equal(x.messages.filter((m) => m[1]).length, 0);
  x.el('catalog-monsters-tab').click();
  row.click();
  pending[2].resolve({ ok: true, value: detail('Guard') });
  await tick();
  await tick();
  assert.equal(x.el('catalog-detail').querySelector('h3')?.textContent, 'Guard');
  assert.equal(x.el('catalog-live-add').disabled, false);
});

test('switching sections keeps a visible monster error until explicit retry', async (t) => {
  const x = await fixture(t, false, {
    itemReferenceCatalog: async () => ({ ok: false, error: 'No items in fixture' }),
  });
  x.reads[0].resolve({ ok: false, error: 'Broken catalog' });
  await tick();
  await tick();
  x.el('catalog-items-tab').click();
  x.el('catalog-monsters-tab').click();
  await tick();
  assert.equal(x.reads.length, 1);
  assert.match(x.el('catalog-page').textContent, /Broken catalog/);
  x.el('catalog-form').onsubmit({ preventDefault() {} });
  assert.equal(x.reads.length, 2);
  await x.resolve(1, 'Recovered');
  assert.match(x.el('catalog-rows').textContent, /Recovered/);
});

test('the first selected creature starts a saved plan without leaving the catalog; later additions keep its visible roster current', async (t) => {
  const saves = [],
    x = await fixture(t);
  window.campaign.creature = async (id) => ({ ok: true, value: detail(id) });
  window.campaign.saveEncounterPlan = async (c) => {
    saves.push(structuredClone(c));
    return { ok: true, value: { ...c.plan, revision: c.plan.revision + 1 } };
  };
  await x.resolve(0, 'Skeleton');
  await x.opened;
  x.el('catalog-rows').querySelector('button').click();
  await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Skeleton');
  const jumps = [];
  x.el('encounter-name').focus = () => jumps.push('editor');
  x.el('catalog-quantity').value = '2';
  x.el('catalog-add').click();
  x.el('catalog-add').onclick();
  await until(() => saves.length === 1 && !x.el('catalog-add').disabled);
  assert.deepEqual(jumps, []);
  assert.equal(saves[0].plan.entries.length, 1);
  assert.equal(saves[0].plan.entries[0].count, 2);
  assert.equal(saves[0].plan.sources[0].name, 'Skeleton');
  assert.match(x.el('catalog-plan-open').textContent, /Skeleton/);
  assert.match(x.el('catalog-plan-roster').textContent, /2 × Skeleton/);
  assert.doesNotMatch(x.el('catalog-plan-roster').textContent, /2 × 2/);
  window.campaign.creature = async () => ({ ok: true, value: detail('Zombie') });
  const opened = x.ui.openCatalogReference({ kind: 'creature', id: 'Zombie' });
  await until(() => x.el('catalog-detail').querySelector('h3')?.textContent === 'Zombie');
  await opened;
  x.el('catalog-quantity').value = '1';
  x.el('catalog-add').click();
  assert.match(x.el('catalog-plan-roster').textContent, /2 × Skeleton · 1 × Zombie/);
  assert.deepEqual(x.liveAdds, []);
  x.el('encounter-name').value = 'Crypt';
  x.el('encounter-name').oninput();
  assert.match(x.el('catalog-plan-open').textContent, /Crypt/);
  x.el('encounter-entries').querySelector('button:last-of-type').click();
  assert.doesNotMatch(x.el('catalog-plan-roster').textContent, /Skeleton/);
  assert.match(x.el('catalog-plan-roster').textContent, /Zombie/);
});
test('first-add save failure keeps the populated draft blocked and a campaign change cannot revive its context', async (t) => {
  const held = deferred(),
    x = await fixture(t);
  window.campaign.creature = async (id) => ({ ok: true, value: detail(id) });
  window.campaign.saveEncounterPlan = () => held.promise;
  await x.resolve(0, 'Skeleton');
  await x.opened;
  x.el('catalog-rows').querySelector('button').click();
  await until(() => !x.el('catalog-add').disabled);
  x.el('catalog-quantity').value = '1';
  x.el('catalog-add').click();
  await until(() => x.el('encounter-entries').children.length === 1);
  held.resolve({ ok: false, error: 'Disk unavailable' });
  await until(() => x.messages.some((m) => m[0].includes('Disk unavailable')));
  assert.equal(x.el('catalog-add').disabled, true);
  assert.match(x.el('catalog-plan-roster').textContent, /Skeleton/);
  x.ui.activateCatalog({ ...x.w, token: 'new', campaign: { id: 'next' } });
  assert.equal(x.el('catalog-plan-roster').hidden, true);
  assert.doesNotMatch(x.el('catalog-plan-open').textContent, /Skeleton/);
  assert.equal(x.el('catalog-add').disabled, true);
});

test('read-only statblocks expose signed ability modifiers without repeating imported trait text', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Ghast');
  await x.opened;
  const original = {
    ...detail('Ghast'),
    abilities: { str: 16, dex: 17, con: 10, int: 11, wis: 9, cha: 8 },
    traits: [{ name: 'Stench', description: 'A distinct\npoison effect.' }],
    actions: [{ name: 'Claws', description: 'A separate paralysis effect.' }],
    details: ' A distinct poison effect. ',
  };
  const snapshot = structuredClone(original);
  window.campaign.creature = async () => ({ ok: true, value: original });
  x.el('catalog-rows').querySelector('button').click();
  await until(() => x.el('catalog-detail').querySelector('.creature-abilities'));
  const root = x.el('catalog-detail'),
    cells = [...root.querySelectorAll('.creature-abilities>div')];
  assert.deepEqual(
    cells.map((c) => [c.querySelector('dt').textContent, c.querySelector('dd').textContent]),
    [
      ['STR', '16 (+3)'],
      ['DEX', '17 (+3)'],
      ['CON', '10 (+0)'],
      ['INT', '11 (+0)'],
      ['WIS', '9 (-1)'],
      ['CHA', '8 (-1)'],
    ],
  );
  assert.match(root.textContent, /A distinct\npoison effect/);
  assert.doesNotMatch(root.textContent, /Weitere Angaben/);
  assert.match(root.textContent, /A separate paralysis effect/);
  assert.equal(root.querySelectorAll('input,textarea,button').length, 0);
  assert.deepEqual(original, snapshot);
  original.details = 'Additional habitat information.';
  x.el('catalog-rows').querySelector('button').click();
  await until(() => root.textContent.includes('Additional habitat information.'));
  assert.match(root.textContent, /Weitere Angaben/);
});

test('saved encounter statblocks stay frozen through current catalog lookup and reading history', async (t) => {
  const x = await fixture(t);
  await x.resolve(0, 'Guard');
  await x.opened;
  const source = { ...detail('Guard'), name: 'Guard – gespeicherter Stand', hp: 17 },
    saved = {
      id: 'saved-plan',
      revision: 4,
      name: 'Brückenwache',
      notes: '  Unverändert\r\n',
      party: [],
      entries: [{ id: 'guard-row', creatureId: 'Guard', count: 2, grouped: true }],
      sources: [source],
      catalogHash: 'old-source',
    },
    before = JSON.stringify(saved),
    reads = [];
  window.campaign.encounterPlan = async () => ({ ok: true, value: structuredClone(saved) });
  window.campaign.creature = async (id) => {
    reads.push(id);
    return { ok: true, value: { ...detail(id), name: 'Guard – heutiger Katalog', hp: 99 } };
  };
  await x.ui.openCatalogReference({ kind: 'encounter', id: saved.id });
  x.el('catalog-items-tab').click();
  x.el('encounter-entries').querySelector('button').click();
  await tick();
  assert.equal(x.el('catalog-monsters').hidden, false);
  assert.match(x.el('catalog-detail').textContent, /gespeicherter Stand/);
  assert.match(x.el('creature-reading-source').textContent, /Brückenwache.*revision 4/);
  assert.deepEqual(reads, []);
  for (const id of ['catalog-add', 'catalog-live-add', 'table-add-creature'])
    assert.equal(x.el(id).disabled, true);
  x.el('catalog-live-add').onclick();
  assert.deepEqual(x.liveAdds, []);
  assert.equal(x.el('catalog-detail').querySelectorAll('input,textarea,button').length, 0);
  x.el('creature-reading-current').click();
  await until(() => x.el('catalog-detail').textContent.includes('heutiger Katalog'));
  assert.deepEqual(reads, ['Guard']);
  assert.equal(x.el('catalog-live-add').disabled, false);
  x.el('creature-reading-back').click();
  assert.match(x.el('catalog-detail').textContent, /gespeicherter Stand/);
  assert.equal(x.el('catalog-live-add').disabled, true);
  assert.deepEqual(reads, ['Guard']);
  x.el('creature-reading-forward').click();
  await until(() => reads.length === 2);
  await tick();
  assert.match(x.el('catalog-detail').textContent, /heutiger Katalog/);
  assert.equal(JSON.stringify(saved), before);
  assert.equal(x.el('encounter-notes').value, saved.notes);
  x.ui.activateCatalog({ ...x.w, token: 'other', campaign: { id: 'other' } });
  assert.equal(x.el('creature-reading-back').disabled, true);
  assert.equal(x.el('creature-reading-forward').disabled, true);
  assert.equal(x.el('creature-reading-source').textContent, '');
});
test('opening a saved statblock invalidates a pending catalog reply and never fabricates a missing snapshot', async (t) => {
  const x = await detailFixture(t),
    held = deferred();
  window.campaign.creature = () => held.promise;
  await x.choose('Wolf');
  const plan = {
    id: 'saved',
    revision: 2,
    name: 'Alte Spur',
    notes: '',
    party: [],
    entries: [{ id: 'entry', creatureId: 'Guard', count: 1, grouped: false }],
    sources: [],
    catalogHash: 'missing',
  };
  window.campaign.encounterPlan = async () => ({ ok: true, value: plan });
  await x.ui.openCatalogReference({ kind: 'encounter', id: 'saved' });
  x.el('encounter-entries').querySelector('button').click();
  assert.match(x.el('catalog-detail').textContent, /Gespeicherter Statblock nicht verfügbar/);
  held.resolve({ ok: true, value: detail('Wolf') });
  await tick();
  await tick();
  assert.match(x.el('catalog-detail').textContent, /Gespeicherter Statblock nicht verfügbar/);
  assert.equal(x.el('catalog-live-add').disabled, true);
});

for (const failed of [false, true])
  test(`hidden monster metadata ${failed ? 'failure' : 'success'} has no authority and returning retries without discarding accepted rows`, async (t) => {
    const requests = [],
      catalogInfo = (notice) => ({
        notice,
        hash: 'pinned',
        types: ['Humanoid'],
        sizes: [],
        habitats: [],
        alignments: [],
        subtypes: [],
      });
    const x = await fixture(t, false, {
      creatureInfo: () => {
        const d = deferred();
        requests.push(d);
        return d.promise;
      },
      itemReferenceCatalog: async () => ({
        ok: true,
        value: {
          status: 'ready',
          message: 'Local items',
          license: 'CC BY 4.0',
          rows: [],
          categories: [],
          subcategories: [],
          rarities: [],
          total: 0,
          offset: 0,
          limit: 50,
        },
      }),
    });
    await x.resolve(0, 'Guard');
    const row = x.el('catalog-rows').querySelector('button');
    x.el('catalog-items-tab').click();
    await tick();
    requests[0].resolve(
      failed
        ? { ok: false, error: 'Invisible metadata failure' }
        : { ok: true, value: catalogInfo('Invisible metadata success') },
    );
    await x.opened;
    assert.equal(x.messages.filter((m) => m[1]).length, 0);
    assert.doesNotMatch(x.el('catalog-credit').textContent, /Invisible metadata/);
    assert.equal(x.el('catalog-type').querySelectorAll('option').length, 1);
    assert.equal(x.el('item-reference-status').getAttribute('role'), 'status');
    await x.ui.openCatalog();
    assert.equal(requests.length, 1, 'opening the Item section must not read Monster metadata');
    x.el('catalog-monsters-tab').click();
    await until(() => requests.length === 2);
    x.el('catalog-monsters-tab').click();
    await tick();
    assert.equal(requests.length, 2, 'the visible request is shared');
    assert.equal(x.reads.length, 1);
    assert.equal(x.el('catalog-rows').querySelector('button'), row);
    requests[1].resolve({ ok: true, value: catalogInfo('Current metadata') });
    await until(() => x.el('catalog-credit').textContent === 'Current metadata');
    assert.equal(x.el('catalog-type').querySelectorAll('option').length, 2);
    assert.equal(x.el('catalog-rows').querySelector('button'), row);
  });
test('parallel monster metadata openings share one request and one set of options', async (t) => {
  const held = deferred();
  let calls = 0;
  const x = await fixture(t, false, {
    creatureInfo: () => {
      calls++;
      return held.promise;
    },
  });
  await x.resolve(0, 'Guard');
  const second = x.ui.openCatalog();
  await tick();
  assert.equal(x.reads.length, 1);
  assert.equal(calls, 1);
  held.resolve({
    ok: true,
    value: {
      notice: 'Shared metadata',
      hash: 'pinned',
      types: ['Humanoid'],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
    },
  });
  await Promise.all([x.opened, second]);
  assert.equal(x.el('catalog-type').querySelectorAll('option').length, 2);
});
test('a synchronous monster metadata failure releases the visible retry', async (t) => {
  const x = await fixture(t, true, {
    creatureInfo: () => {
      throw new Error('Synchronous metadata failure');
    },
  });
  await x.resolve(0, 'Guard');
  await x.opened;
  assert.match(x.el('catalog-credit').textContent, /Synchronous metadata failure/);
  window.campaign.creatureInfo = () => ({
    ok: true,
    value: {
      notice: 'Retried metadata',
      hash: 'pinned',
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
    },
  });
  await x.ui.openCatalog();
  assert.equal(x.reads.length, 1);
  assert.equal(x.el('catalog-credit').textContent, 'Retried metadata');
});
test('the shared Monster browser in a table lookup also resumes missing metadata from Items', async (t) => {
  const requests = [],
    x = await fixture(t, false, {
      creatureInfo: () => {
        const d = deferred();
        requests.push(d);
        return d.promise;
      },
      itemReferenceCatalog: async () => ({ ok: false, error: 'No items in fixture' }),
    });
  await x.resolve(0, 'Guard');
  x.el('catalog-items-tab').click();
  requests[0].resolve({ ok: false, error: 'Hidden metadata failure' });
  await x.opened;
  x.el('encounter-table-new').click();
  await until(() => x.el('table-manager').open);
  await until(() => requests.length === 2);
  assert.equal(x.el('catalog-browser').parentElement.id, 'table-catalog-slot');
  assert.equal(x.el('catalog-monsters-tab').getAttribute('aria-selected'), 'true');
  requests[1].resolve({
    ok: true,
    value: {
      notice: 'Table lookup metadata',
      hash: 'pinned',
      types: ['Humanoid'],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
    },
  });
  await until(() => x.el('catalog-type').querySelectorAll('option').length === 2);
  x.el('table-close').click();
  await until(() => !x.el('table-manager').open);
  await x.resolve(1, 'Guard');
  assert.equal(x.el('catalog-credit').textContent, 'Table lookup metadata');
});
