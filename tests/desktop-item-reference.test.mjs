import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
for (const [entry, name] of [
  ['src/app/storage/item-reference.ts', 'item-ref-store'],
  ['src/app/item-reference-ui.ts', 'item-ref-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
const {
    readItemReferenceCatalog: read,
    createItemReferenceReader,
  } = require('../.build/item-ref-store.cjs'),
  { ItemReferenceCatalog } = require('../.build/item-ref-ui.cjs');
const query = {
    name: '',
    category: '',
    subcategory: '',
    rarity: '',
    magic: '',
    attunement: '',
    minimumCopper: '',
    maximumCopper: '',
    sort: 'name',
    direction: 'asc',
    offset: 0,
  },
  tick = () => new Promise((r) => setImmediate(r));
async function until(fn) {
  for (let i = 0; i < 100 && !fn(); i++) await tick();
  assert(fn());
}
test('read-only source queries reach every pinned record with exact prices, filters, details and stable sort', () => {
  const transcript = JSON.parse(
      readFileSync('src/features/catalog/data/items-srd51-transcript.json'),
    ),
    read = createItemReferenceReader(transcript),
    before = JSON.stringify(transcript),
    ids = [];
  for (let offset = 0; offset < transcript.records.length; offset += 50) {
    const page = read({ ...query, offset });
    assert.equal(page.status, 'ready');
    assert.equal(page.total, transcript.records.length);
    ids.push(...page.rows.map((r) => r.id));
  }
  assert.equal(new Set(ids).size, transcript.records.length);
  assert.equal(JSON.stringify(transcript), before);
  const armor = read({
    ...query,
    name: 'padded',
    subcategory: 'armor-light',
    category: 'equipment',
    magic: 'no',
    attunement: 'unspecified',
    minimumCopper: '500',
    maximumCopper: '500',
  });
  assert.equal(armor.total, 1);
  assert.equal(armor.rows[0].armor.armorClassText, '11 + Dex modifier');
  assert.deepEqual(armor.rows[0].source.pdfPages, [63]);
  const sword = read({ ...query, name: 'longsword' }).rows[0];
  assert.equal(sword.damage.versatileDiceText, '1d10');
  assert(
    read({ ...query, magic: 'yes', rarity: 'uncommon', attunement: 'required' }).rows.every(
      (r) => r.magic && r.rarity.value === 'uncommon' && r.attunement === 'required',
    ),
  );
  const ordered = read({ ...query, sort: 'cost', direction: 'desc' })
    .rows.filter((r) => r.cost?.copperPieces != null)
    .map((r) => r.cost.copperPieces);
  assert.deepEqual(
    ordered,
    [...ordered].sort((a, b) => b - a),
  );
  const mutable = read({ ...query, name: 'padded' });
  mutable.rows[0].name = 'Injected';
  assert.equal(read({ ...query, name: 'padded' }).rows[0].name, 'Padded Armor');
});
test('missing import, incompatible schema and invalid filters are distinct isolated results', () => {
  assert.equal(createItemReferenceReader(null)(query).status, 'missing');
  assert.equal(
    createItemReferenceReader({ schemaVersion: 2, records: [] })(query).status,
    'incompatible',
  );
  assert.equal(read({ ...query, minimumCopper: '500', maximumCopper: '499' }).status, 'invalid');
  assert.equal(read({ ...query, minimumCopper: 'bad' }).status, 'invalid');
  assert.equal(read({ ...query, category: 'invented' }).status, 'invalid');
  assert.equal(read({ ...query, name: 'no such item abc' }).status, 'ready');
  assert.equal(read({ ...query, name: 'no such item abc' }).total, 0);
});
function fixture(t) {
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><div id="host"></div></body></html>');
  Object.assign(globalThis, { window, document });
  const selectValue = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
  });
  window.campaign = { itemReferenceCatalog: async (q) => ({ ok: true, value: read(q) }) };
  const catalog = new ItemReferenceCatalog(document.getElementById('host')),
    el = (id) => document.getElementById(id);
  t.after(() => {
    catalog.show(false);
    if (selectValue)
      Object.defineProperty(window.HTMLSelectElement.prototype, 'value', selectValue);
    else delete window.HTMLSelectElement.prototype.value;
    Object.assign(globalThis, previous);
  });
  return { catalog, window, el };
}
test('inspector has reference facts only and stale query rows cannot act during new input or activation', async (t) => {
  const x = fixture(t);
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  const old = x.el('item-reference-rows').querySelector('button');
  old.click();
  assert(x.el('item-reference-detail').textContent.includes('Quelle'));
  assert.equal(x.el('item-reference-detail').querySelectorAll('button,input,textarea').length, 0);
  x.el('item-reference-name').value = 'padded';
  x.el('item-reference-form').oninput();
  old.onclick();
  assert.equal(x.el('item-reference-rows').children.length, 0);
  assert(x.el('item-reference-detail').textContent.includes('Wähle'));
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(
    () => x.el('item-reference-rows').textContent === 'Padded ArmorAusrüstungNicht angegeben5 gp',
  );
  x.el('item-reference-rows').querySelector('button').click();
  assert(x.el('item-reference-detail').textContent.includes('Rüstungsklasse'));
  assert(x.el('item-reference-detail').textContent.includes('11 + Dex modifier'));
  x.catalog.activate();
  assert.equal(x.el('item-reference-rows').children.length, 0);
});
test('late read, failure and explicit retry cannot replace newer filter state', async (t) => {
  const x = fixture(t);
  let release;
  x.window.campaign.itemReferenceCatalog = () => new Promise((r) => (release = r));
  x.catalog.show(true);
  x.el('item-reference-name').value = 'longsword';
  x.el('item-reference-form').oninput();
  release({ ok: true, value: read(query) });
  await tick();
  assert.equal(x.el('item-reference-rows').children.length, 0);
  x.window.campaign.itemReferenceCatalog = async () => ({ ok: false, error: 'Storage offline' });
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(() => x.el('item-reference-status').textContent.includes('Storage offline'));
  x.window.campaign.itemReferenceCatalog = async (q) => ({ ok: true, value: read(q) });
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(() => x.el('item-reference-rows').textContent.includes('Longsword'));
  assert.equal(x.el('item-reference-name').value, 'longsword');
});
test('section return preserves accepted page, sort, selection and row authority without another read', async (t) => {
  const x = fixture(t),
    queries = [];
  x.window.campaign.itemReferenceCatalog = async (q) => {
    queries.push({ ...q });
    return { ok: true, value: read(q) };
  };
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  x.el('item-reference-table').querySelector('[data-sort="category"]').click();
  await until(
    () =>
      queries.length === 2 && x.el('item-reference-table').getAttribute('aria-busy') === 'false',
  );
  x.el('item-reference-rows')
    .parentElement.parentElement.nextElementSibling.querySelectorAll('button')[1]
    .click();
  await until(
    () => queries.length === 3 && x.el('item-reference-status').textContent.startsWith('51–'),
  );
  const row = x.el('item-reference-rows').querySelector('button');
  row.click();
  const rows = x.el('item-reference-rows').innerHTML,
    detail = x.el('item-reference-detail').innerHTML;
  x.catalog.show(false);
  row.closest('tr').nextElementSibling.querySelector('button').onclick();
  assert.equal(x.el('item-reference-detail').innerHTML, detail);
  x.catalog.show(true);
  x.catalog.show(true);
  await tick();
  assert.equal(queries.length, 3);
  assert.equal(queries[2].offset, 50);
  assert.equal(queries[2].sort, 'category');
  assert.equal(x.el('item-reference-rows').innerHTML, rows);
  assert.equal(x.el('item-reference-detail').innerHTML, detail);
  assert.equal(row.isConnected, true);
  assert.equal(row.getAttribute('aria-pressed'), 'true');
  const next = row.closest('tr').nextElementSibling.querySelector('button');
  next.click();
  assert.equal(next.getAttribute('aria-pressed'), 'true');
  assert.equal(row.getAttribute('aria-pressed'), 'false');
  assert(x.el('item-reference-detail').textContent.includes(next.textContent));
});
test('hidden debounce and pending responses stop; returning resumes only the unfinished current filter', async (t) => {
  const x = fixture(t),
    pending = [];
  x.window.campaign.itemReferenceCatalog = (q) =>
    new Promise((resolve) => pending.push({ q, resolve }));
  x.catalog.show(true);
  x.catalog.show(true);
  assert.equal(pending.length, 1);
  x.el('item-reference-name').value = 'padded';
  x.el('item-reference-form').oninput();
  x.catalog.show(false);
  await new Promise((r) => setTimeout(r, 230));
  assert.equal(pending.length, 1);
  pending[0].resolve({ ok: true, value: read(pending[0].q) });
  await tick();
  assert.equal(x.el('item-reference-rows').children.length, 0);
  x.catalog.show(true);
  assert.equal(pending.length, 2);
  assert.equal(pending[1].q.name, 'padded');
  x.catalog.show(false);
  pending[1].resolve({ ok: true, value: read(pending[1].q) });
  await tick();
  assert.equal(x.el('item-reference-rows').children.length, 0);
  x.catalog.show(true);
  assert.equal(pending.length, 3);
  pending[2].resolve({ ok: true, value: read(pending[2].q) });
  await until(() => x.el('item-reference-rows').textContent.includes('Padded Armor'));
  assert.equal(x.el('item-reference-name').value, 'padded');
  x.catalog.activate();
  x.catalog.show(true);
  assert.equal(pending.length, 4);
  assert.equal(x.el('item-reference-rows').children.length, 0);
});
test('section return retains failed read and requires an explicit retry', async (t) => {
  const x = fixture(t);
  let calls = 0;
  x.window.campaign.itemReferenceCatalog = async () => {
    calls++;
    return { ok: false, error: 'Storage offline' };
  };
  x.catalog.show(true);
  await until(() => x.el('item-reference-status').textContent.includes('Storage offline'));
  x.catalog.show(false);
  x.catalog.show(true);
  await tick();
  assert.equal(calls, 1);
  assert.equal(x.el('item-reference-status').getAttribute('role'), 'alert');
  x.window.campaign.itemReferenceCatalog = async (q) => {
    calls++;
    return { ok: true, value: read(q) };
  };
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(() => x.el('item-reference-rows').children.length === 50);
  assert.equal(calls, 2);
});

test('protection ring lookup retains exact SRD rule, source and unspecified commercial facts', () => {
  const page = read({
    ...query,
    name: 'ring of protection',
    magic: 'yes',
    subcategory: 'ring',
    rarity: 'rare',
    attunement: 'required',
  });
  assert.equal(page.total, 1);
  const ring = page.rows[0];
  assert.equal(ring.id, 'srd51:magic-item:magic-items-a-z:160');
  assert.deepEqual(ring.source.pdfPages, [237]);
  assert.equal(
    ring.description[0].text,
    'You gain a +1 bonus to AC and saving throws while wearing this ring.',
  );
  assert.equal(ring.cost, undefined);
  assert.equal(ring.weight, undefined);
});
test('catalog coverage is visible ahead of results and empty search identifies local scope', async (t) => {
  const x = fixture(t);
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  const credit = x.el('item-reference-credit');
  assert(credit.textContent.includes('Unvollständiger Katalog'));
  assert(credit.textContent.includes('CC-BY-4.0'));
  assert.equal(credit.querySelector('summary').textContent, 'Lokale SRD-Quelle · unvollständig');
  assert.equal(credit.nextElementSibling.querySelector('table').id, 'item-reference-table');
  x.el('item-reference-name').value = 'not an imported item';
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(() => x.el('item-reference-status').textContent.includes('Keine Treffer'));
  assert(x.el('item-reference-status').textContent.includes('lokalen Katalog'));
  assert(credit.textContent.includes('Weitere magische Gegenstände fehlen'));
});

test('magic-item rule precedes supplementary facts; equipment keeps its structured combat facts first', async (t) => {
  const x = fixture(t);
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  for (const name of ['Ring of Protection', 'Padded Armor']) {
    x.el('item-reference-name').value = name;
    x.el('item-reference-form').onsubmit({ preventDefault() {} });
    await until(() => x.el('item-reference-rows').querySelector('button')?.textContent === name);
    x.el('item-reference-rows').querySelector('button').click();
    const detail = x.el('item-reference-detail'),
      rules = detail.querySelector('.item-reference-rules');
    assert.equal(detail.children[name === 'Ring of Protection' ? 1 : 2], rules);
    if (name === 'Ring of Protection') {
      assert(rules.textContent.includes('requires attunement'));
      assert(rules.textContent.includes('saving throws'));
      assert(detail.querySelector('dl').textContent.includes('Nicht angegeben'));
    } else assert(detail.querySelector('dl').textContent.includes('11 + Dex modifier'));
  }
});

test('rarity filters match every explicit variant while preserving the complete source group', () => {
  const transcript = JSON.parse(
      readFileSync('src/features/catalog/data/items-srd51-transcript.json'),
    ),
    read = createItemReferenceReader(transcript),
    before = JSON.stringify(transcript),
    variants = transcript.records.filter((r) => r.rarity?.choices?.length);
  assert.ok(variants.some((r) => r.name === 'Belt of Giant Strength'));
  for (const item of variants) {
    for (const rarity of new Set(item.rarity.choices.map((c) => c.value))) {
      const page = read({ ...query, name: item.name, rarity });
      assert.equal(page.status, 'ready');
      assert.ok(page.rarities.includes(rarity));
      assert.deepEqual(
        page.rows.find((r) => r.id === item.id),
        item,
        'keep the original grouped definition and every variant',
      );
    }
  }
  const belt = read({
    ...query,
    name: 'Belt of Giant Strength',
    rarity: 'rare',
    magic: 'yes',
    attunement: 'required',
  });
  assert.equal(belt.total, 1);
  assert.equal(read({ ...query, name: 'Belt of Giant Strength', rarity: 'common' }).total, 0);
  assert.equal(
    read({ ...query, name: 'Belt of Giant Strength', rarity: 'rare', minimumCopper: '1' }).total,
    0,
    'a variant match cannot invent an unknown price',
  );
  assert.deepEqual(
    new Set(read(query).rarities),
    new Set(
      transcript.records
        .flatMap((r) =>
          r.rarity?.choices?.length
            ? r.rarity.choices.map((c) => c.value)
            : [r.rarity?.value ?? r.rarity?.sourceText ?? ''],
        )
        .filter(Boolean),
    ),
  );
  assert.equal(JSON.stringify(transcript), before);
});

test('the real rarity choice finds a variant group and keeps its complete reference read-only', async (t) => {
  const x = fixture(t);
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  x.el('item-reference-name').value = 'Belt of Giant Strength';
  x.el('item-reference-rarity').value = 'rare';
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(() => x.el('item-reference-table').getAttribute('aria-busy') === 'false');
  assert.equal(
    x.el('item-reference-rows').querySelector('button')?.textContent,
    'Belt of Giant Strength',
  );
  x.el('item-reference-rows').querySelector('button').click();
  const detail = x.el('item-reference-detail');
  assert.match(detail.textContent, /Selten · Hill giant/);
  assert.match(detail.textContent, /Legendär · Storm giant/);
  assert.match(detail.textContent, /SRD 5.1/);
  assert.equal(detail.querySelectorAll('button,input,textarea').length, 0);
});

test('sortable headers retain both directions and visible state without a second direction control', async (t) => {
  const x = fixture(t),
    queries = [];
  x.window.campaign.itemReferenceCatalog = async (q) => {
    queries.push({ ...q });
    return { ok: true, value: read(q) };
  };
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  assert.equal(!!x.el('item-reference-direction'), false);
  const header = (key) => x.el('item-reference-table').querySelector('[data-sort="' + key + '"]'),
    settled = () => x.el('item-reference-table').getAttribute('aria-busy') === 'false';
  assert.equal(header('name').textContent, 'Name ↑');
  assert.equal(header('name').closest('th').getAttribute('aria-sort'), 'ascending');
  x.el('item-reference-minimum').value = '5';
  x.el('item-reference-maximum').value = '15';
  for (const key of ['cost', 'category', 'rarity', 'name'])
    for (const direction of ['asc', 'desc']) {
      const count = queries.length;
      header(key).click();
      await until(() => queries.length === count + 1 && settled());
      assert.equal(queries.at(-1).sort, key);
      assert.equal(queries.at(-1).direction, direction);
      assert.equal(queries.at(-1).minimumCopper, '500');
      assert.equal(queries.at(-1).maximumCopper, '1500');
      assert.equal(
        header(key).textContent,
        { name: 'Name', category: 'Kategorie', rarity: 'Seltenheit', cost: 'Preis' }[key] +
          (direction === 'asc' ? ' ↑' : ' ↓'),
      );
      assert.equal(
        header(key).closest('th').getAttribute('aria-sort'),
        direction === 'asc' ? 'ascending' : 'descending',
      );
      assert.equal(x.el('item-reference-table').querySelectorAll('th[aria-sort="none"]').length, 3);
    }
  const count = queries.length;
  x.catalog.show(false);
  x.catalog.show(true);
  await tick();
  assert.equal(queries.length, count);
  assert.equal(header('name').textContent, 'Name ↓');
  x.el('item-reference-form').querySelector('button[type="button"]').click();
  await until(() => queries.length === count + 1 && settled());
  assert.equal(queries.at(-1).direction, 'desc');
  assert.equal(queries.at(-1).sort, 'name');
  assert.equal(queries.at(-1).minimumCopper, '');
  assert.equal(queries.at(-1).maximumCopper, '');
  assert.equal(header('name').textContent, 'Name ↓');
});

test('heavy armor strength prerequisites are labeled separately from armor class with exact source values', async (t) => {
  const x = fixture(t),
    transcript = JSON.parse(readFileSync('src/features/catalog/data/items-srd51-transcript.json'));
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  const armors = transcript.records.filter((r) => r.armor?.strengthRequirementText);
  assert.ok(armors.some((r) => r.name === 'Plate Armor'));
  for (const item of armors) {
    x.el('item-reference-name').value = item.name;
    x.el('item-reference-form').onsubmit({ preventDefault() {} });
    const row = () =>
      [...x.el('item-reference-rows').querySelectorAll('button')].find(
        (b) => b.textContent === item.name,
      );
    await until(() => !!row());
    row().click();
    const facts = [...x.el('item-reference-detail').querySelectorAll('dl dt')].map((n) => [
      n.textContent,
      n.nextElementSibling.textContent,
    ]);
    assert.ok(
      facts.some(([k, v]) => k === 'Stärke' && v === item.armor.strengthRequirementText),
      item.name + ' must identify its strength prerequisite',
    );
    assert.ok(facts.some(([k, v]) => k === 'Rüstungsklasse' && v === item.armor.armorClassText));
  }
});

test('narrow item reading returns to the selected result without searching or losing filters', async (t) => {
  const x = fixture(t);
  let calls = 0;
  x.window.campaign.itemReferenceCatalog = async (q) => {
    calls++;
    return { ok: true, value: read(q) };
  };
  x.window.matchMedia = () => ({ matches: true });
  x.el('item-reference-name').value = 'armor';
  x.el('item-reference-maximum').value = '10';
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 3);
  const inspector = x.el('item-reference-inspector'),
    detail = x.el('item-reference-detail'),
    row = [...x.el('item-reference-rows').querySelectorAll('button')].find(
      (b) => b.textContent === 'Padded Armor',
    ),
    moves = [];
  inspector.scrollIntoView = (options) => moves.push(['inspector', options]);
  detail.focus = (options) => moves.push(['detail-focus', options]);
  row.scrollIntoView = (options) => moves.push(['result', options]);
  row.focus = (options) => moves.push(['result-focus', options]);
  row.click();
  assert.deepEqual(moves, [
    ['inspector', { block: 'start' }],
    ['detail-focus', { preventScroll: true }],
  ]);
  assert.equal(row.getAttribute('aria-pressed'), 'true');
  assert.match(detail.textContent, /Disadvantage/);
  x.el('item-reference-results-return').click();
  assert.deepEqual(moves.slice(-2), [
    ['result', { block: 'center' }],
    ['result-focus', { preventScroll: true }],
  ]);
  assert.equal(calls, 1);
  assert.equal(x.el('item-reference-name').value, 'armor');
  assert.equal(x.el('item-reference-maximum').value, '10');
  assert.equal(row.isConnected, true);
  assert.match(detail.textContent, /Disadvantage/);
  assert.equal(detail.querySelectorAll('button,input,textarea').length, 0);
  x.catalog.show(false);
  const before = moves.length;
  x.el('item-reference-results-return').click();
  assert.equal(moves.length, before, 'hidden item tab cannot move another surface');
});

test('equipment lookup uses readable types and prioritizes the weapon facts without changing source values', async (t) => {
  const x = fixture(t),
    queries = [];
  x.window.matchMedia = () => ({ matches: false });
  x.window.campaign.itemReferenceCatalog = async (q) => {
    queries.push({ ...q });
    return { ok: true, value: read(q) };
  };
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  const option = [...x.el('item-reference-subcategory').querySelectorAll('option')].find(
    (o) => o.textContent === 'Fernkampf · Kriegswaffen',
  );
  assert.equal(option.value, 'weapon-martial-ranged');
  assert.equal(x.el('item-reference-extra').hasAttribute('open'), false);
  x.el('item-reference-subcategory').value = option.value;
  x.el('item-reference-maximum').value = '59';
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(
    () =>
      queries.length === 2 && x.el('item-reference-table').getAttribute('aria-busy') === 'false',
  );
  assert.equal(queries.at(-1).subcategory, 'weapon-martial-ranged');
  assert.equal(queries.at(-1).maximumCopper, '5900');
  [...x.el('item-reference-rows').querySelectorAll('button')]
    .find((b) => b.textContent === 'Crossbow, heavy')
    .click();
  const detail = x.el('item-reference-detail'),
    facts = [...detail.querySelectorAll('dt')].map((n) => [
      n.textContent,
      n.nextElementSibling.textContent,
    ]);
  assert.deepEqual(facts, [
    ['Kategorie', 'Ausrüstung · Fernkampf · Kriegswaffen'],
    ['Preis', '50 gp'],
    ['Gewicht', '18 lb.'],
    ['Schadenswürfel', '1d10'],
    ['Schadenstyp', 'piercing'],
  ]);
  assert.match(detail.textContent, /Ammunition · range 100\/400/);
  assert.match(detail.textContent, /Heavy/);
  assert.match(detail.textContent, /Loading/);
  assert.match(detail.textContent, /Two-handed/);
  assert.match(detail.textContent, /SRD 5.1 · PDF-Seiten 66/);
  assert.equal(detail.querySelectorAll('button,input,textarea').length, 0);
});

test('collapsed additional filters stay visible as active constraints across sorting and section return', async (t) => {
  const x = fixture(t),
    queries = [];
  x.window.matchMedia = () => ({ matches: false });
  x.window.campaign.itemReferenceCatalog = async (q) => {
    queries.push({ ...q });
    return { ok: true, value: read(q) };
  };
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  x.el('item-reference-rarity').value = 'rare';
  x.el('item-reference-magic').value = 'yes';
  x.el('item-reference-attunement').value = 'required';
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(
    () =>
      queries.length === 2 && x.el('item-reference-table').getAttribute('aria-busy') === 'false',
  );
  assert.equal(
    x.el('item-reference-extra').querySelector('summary').textContent,
    'Weitere Filter · 3 aktiv',
  );
  assert(
    queries.at(-1).magic === 'yes' &&
      queries.at(-1).rarity === 'rare' &&
      queries.at(-1).attunement === 'required',
  );
  x.el('item-reference-table').querySelector('[data-sort=cost]').click();
  await until(
    () =>
      queries.length === 3 && x.el('item-reference-table').getAttribute('aria-busy') === 'false',
  );
  const page = x.el('item-reference-rows').innerHTML;
  x.catalog.show(false);
  x.catalog.show(true);
  assert.equal(queries.length, 3);
  assert.equal(x.el('item-reference-rows').innerHTML, page);
  assert.equal(
    x.el('item-reference-extra').querySelector('summary').textContent,
    'Weitere Filter · 3 aktiv',
  );
  [...x.el('item-reference-rows').querySelectorAll('button')]
    .find((b) => b.textContent === 'Ring of Protection')
    .click();
  const facts = [...x.el('item-reference-detail').querySelectorAll('dt')].map((n) => [
    n.textContent,
    n.nextElementSibling.textContent,
  ]);
  assert(facts.some(([k, v]) => k === 'Magisch' && v === 'Ja'));
  assert(facts.some(([k, v]) => k === 'Einstimmung' && v === 'Erforderlich'));
  assert(facts.some(([k, v]) => k === 'Seltenheit' && v === 'Selten'));
  assert(
    facts.some(([k, v]) => k === 'Preis' && v === 'Nicht angegeben'),
    'unknown prices remain explicit',
  );
  x.el('item-reference-form').querySelector('button[type=button]').click();
  await until(
    () =>
      queries.length === 4 && x.el('item-reference-table').getAttribute('aria-busy') === 'false',
  );
  assert.equal(x.el('item-reference-extra').querySelector('summary').textContent, 'Weitere Filter');
  for (const key of ['rarity', 'magic', 'attunement'])
    assert.equal(x.el('item-reference-' + key).value, '');
});

test('source coverage summary follows explicit provider facts and never assumes missing coverage is complete', async (t) => {
  const x = fixture(t);
  let complete = true;
  x.window.campaign.itemReferenceCatalog = async (q) => {
    const page = read(q);
    if (complete === undefined) delete page.complete;
    else page.complete = complete;
    return { ok: true, value: page };
  };
  x.catalog.show(true);
  await until(() => x.el('item-reference-rows').children.length === 50);
  assert.equal(
    x.el('item-reference-credit').querySelector('summary').textContent,
    'Lokale SRD-Quelle · vollständig',
  );
  complete = undefined;
  x.el('item-reference-form').onsubmit({ preventDefault() {} });
  await until(() => x.el('item-reference-table').getAttribute('aria-busy') === 'false');
  assert.equal(
    x.el('item-reference-credit').querySelector('summary').textContent,
    'Lokale SRD-Quelle · Vollständigkeit unbekannt',
  );
});
