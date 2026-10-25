import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/campaign/generation-ui'; export {initCatalog,activateCatalog,openCatalogReference} from './src/app/catalog/catalog-ui';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/generation-context-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  settle = async () => {
    for (let i = 0; i < 15; i++) await new Promise((r) => setImmediate(r));
  };
async function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, previous));
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.options[0]?.getAttribute('value') ?? '',
    });
  Object.defineProperty(window.HTMLInputElement.prototype, 'checked', {
    configurable: true,
    get() {
      return this.hasAttribute('checked');
    },
    set(value) {
      this.toggleAttribute('checked', !!value);
    },
  });
  const el = (id) => document.getElementById(id),
    ok = (value) => ({ ok: true, value }),
    tables = [{ id: 'watch', name: 'Waldsaum', entries: [], trashed: false, scope: 'campaign' }],
    calls = [],
    messages = [],
    accepted = [];
  let filters = {},
    party = true;
  const plan = {
    id: 'plan',
    revision: 1,
    name: 'Fixed patrol',
    notes: 'Original',
    entries: [{ id: 'existing', creatureId: 'goblin', count: 2, grouped: false }],
    party: [{ id: 'hero', name: 'Ada', level: 1, count: 1 }],
  };
  const run = (request) => ({
    id: 'run',
    seed: request.seed,
    request,
    revision: 1,
    preset: { name: 'Standard', revision: 1 },
    warnings: [],
    candidates: [{ creatureId: 'goblin' }],
    plans: [
      {
        name: 'Waldsaum',
        sources: [{ id: 'goblin', name: 'Goblin' }],
        entries: [{ id: 'g', creatureId: 'goblin', count: 1 }],
        assessment: { baseXp: 50, adjustedXp: 50, difficulty: 'easy' },
      },
    ],
    acceptedPlanIds: [],
  });
  let generate = async (request) => ok(run(request));
  window.campaign = {
    encounterTables: async () => ok(tables),
    lootTables: async () => ok([]),
    generatorRegistry: async () => ok({ revision: 1, presets: [] }),
    generationRuns: async () => ok([]),
    generationSources: async () => ok({ sources: [], factions: [], locations: [] }),
    npcs: async () => ok({ rows: [], next: null, total: 0 }),
    generateEncounters: async (_token, r) => {
      calls.push(r);
      return generate(r);
    },
    acceptGeneration: async (c) => {
      accepted.push(c);
      return ok({ id: 'accepted', name: 'Accepted' });
    },
    encounterPlans: async () => ok([]),
    creatures: async () => ok({ rows: [], total: 0, offset: 0, limit: 25 }),
  };
  delete require.cache[require.resolve('../../.build/generation-context-ui.cjs')];
  const ui = require('../../.build/generation-context-ui.cjs'),
    w = { token: 'one', campaign: { id: 'camp' } };
  ui.initGeneration((...args) => messages.push(args), {
    plan: async () => (party ? plan : null),
    creature: () => null,
    filters: () => filters,
    info: () => null,
    accept: async () => {},
  });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
  }
  ui.activateGeneration(w);
  await settle();
  el('catalog-reset').onclick = () => {
    filters = {};
    ui.generationCatalogFiltersChanged();
  };
  return {
    el,
    ui,
    w,
    plan,
    tables,
    calls,
    messages,
    accepted,
    setFilters: (q) => {
      filters = q;
      ui.generationCatalogFiltersChanged();
    },
    setParty: (value) => {
      party = value;
    },
    setGenerate: (fn) => {
      generate = fn;
    },
    run,
    make: async () => {
      el('generation-form').onsubmit({ preventDefault() {} });
      await settle();
    },
    choice: () => el('generation-preview').querySelector('article button'),
  };
}
test('generation reveals every effective catalog filter without pagination or sorting noise', async (t) => {
  const x = await fixture(t);
  assert.deepEqual(
    x.ui.catalogFilterSummary({
      text: ' Dragon ',
      crMin: 0,
      crMax: 2,
      types: ['Dragon'],
      offset: 25,
      sort: 'hp',
      direction: 'desc',
      limit: 25,
    }),
    ['Name: Dragon', 'HG ab: 0', 'HG bis: 2', 'Typ: Dragon'],
  );
  const table = x.el('generation-tables').querySelector('input');
  table.checked = true;
  x.el('generation-time').value = 'night';
  x.setFilters({ text: 'Dragon', hpMax: 10 });
  assert.match(x.el('generation-catalog-summary').textContent, /Name: Dragon.*HP bis: 10/);
  x.el('generation-clear-catalog').click();
  assert.equal(table.checked, true);
  assert.equal(x.el('generation-time').value, 'night');
  assert.match(x.el('generation-catalog-summary').textContent, /Keine zusätzlichen/);
  assert.equal(x.el('generation-clear-catalog').hidden, true);
});
test('catalog filter changes invalidate old proposal controls and preserve their actual basis', async (t) => {
  const x = await fixture(t);
  x.setFilters({ text: 'Goblin' });
  await x.make();
  assert.equal(x.choice().disabled, false);
  assert.match(
    x.el('generation-preview').textContent,
    /Katalogfilter dieser Vorschau: Name: Goblin/,
  );
  x.setFilters({ text: 'Dragon' });
  assert.equal(x.choice().disabled, true);
  assert.match(x.el('generation-preview').textContent, /Einstellungen geändert/);
  assert.match(
    x.el('generation-preview').textContent,
    /Katalogfilter dieser Vorschau: Name: Goblin/,
  );
  await x.make();
  assert.equal(x.calls[1].filters.text, 'Dragon');
  assert.equal(x.choice().disabled, false);
  x.ui.generationPlanningChanged([{ id: 'hero', name: 'Ada', level: 2, count: 4 }]);
  assert.equal(x.choice().disabled, true);
});
test('missing party and generator failures are explained beside the action, stale errors cannot replace a new workspace', async (t) => {
  const x = await fixture(t);
  x.setParty(false);
  await x.make();
  assert.match(x.el('generation-feedback').textContent, /Zur Planungsparty/);
  assert.equal(x.calls.length, 0);
  x.setParty(true);
  x.setGenerate(async () => ({ ok: false, error: 'Keine Kreaturen nach Tabellen und Filtern.' }));
  await x.make();
  assert.match(x.el('generation-feedback').textContent, /Keine Kreaturen/);
  x.setFilters({ text: 'Dragon' });
  assert.equal(x.el('generation-feedback').textContent, '');
  let finish;
  x.setGenerate(() => new Promise((r) => (finish = r)));
  x.el('generation-form').onsubmit({ preventDefault() {} });
  await settle();
  x.ui.activateGeneration({ ...x.w, token: 'two' });
  finish({ ok: false, error: 'ALTER Fehler' });
  await settle();
  assert.doesNotMatch(x.el('generation-feedback').textContent, /ALTER/);
});
test('actual catalog input and reset notify the generator about their shared filters', async (t) => {
  const x = await fixture(t);
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await settle();
  x.el('catalog-form').reset = () => {
    for (const c of x.el('catalog-form').querySelectorAll('input')) c.value = '';
    x.el('catalog-direction').value = 'asc';
  };
  x.el('catalog-search').value = 'Dragon';
  x.el('catalog-search').oninput();
  assert.match(x.el('generation-catalog-summary').textContent, /Name: Dragon/);
  x.el('generation-clear-catalog').click();
  assert.match(x.el('generation-catalog-summary').textContent, /Keine zusätzlichen/);
  await new Promise((r) => setTimeout(r, 250));
});

test('actual catalog HG clamping reaches generation without changing its tuning or the loaded plan', async (t) => {
  const x = await fixture(t),
    plan = {
      ...structuredClone(x.plan),
      sources: [],
      catalogHash: 'pinned',
      notes: '  Original planning prose\r\n',
    };
  window.campaign.encounterPlan = async () => ({ ok: true, value: structuredClone(plan) });
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
      notice: 'Offline',
      hash: 'pinned',
    },
  });
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await x.ui.openCatalogReference({ kind: 'encounter', id: plan.id });
  x.el('generation-difficulty').value = 'hard';
  x.el('generation-seed').value = 'retained seed';
  x.el('catalog-search').value = 'Dragon';
  x.el('catalog-type').value = 'Dragon';
  x.el('catalog-cr-min').value = '8';
  x.el('catalog-cr-max').value = '2';
  x.el('catalog-cr-min').oninput();
  x.el('catalog-cr-min').onchange();
  await x.make();
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0].filters.crMin, 8);
  assert.equal(x.calls[0].filters.crMax, 8);
  assert.equal(x.calls[0].filters.text, 'Dragon');
  assert.deepEqual(x.calls[0].filters.types, ['Dragon']);
  assert.equal(x.calls[0].difficulty, 'hard');
  assert.equal(x.calls[0].seed, 'retained seed');
  assert.deepEqual(x.calls[0].party, plan.party);
  assert.equal(x.el('encounter-notes').value, plan.notes);
  assert.equal(x.el('encounter-name').value, plan.name);
  x.el('catalog-cr-max').value = '0';
  x.el('catalog-cr-max').oninput();
  x.el('catalog-cr-max').onchange();
  await x.make();
  assert.equal(x.calls.length, 2);
  assert.equal(x.calls[1].filters.crMin, undefined);
  assert.equal(x.calls[1].filters.crMax, 0);
  assert.equal(x.calls[1].difficulty, 'hard');
  assert.equal(x.calls[1].seed, 'retained seed');
  await new Promise((r) => setTimeout(r, 250));
});
test('an unreadable native numeric catalog filter blocks generation instead of widening its pool', async (t) => {
  const x = await fixture(t),
    plan = { ...structuredClone(x.plan), sources: [], catalogHash: 'pinned' };
  window.campaign.encounterPlan = async () => ({ ok: true, value: structuredClone(plan) });
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
      notice: 'Offline',
      hash: 'pinned',
    },
  });
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await x.ui.openCatalogReference({ kind: 'encounter', id: plan.id });
  const input = x.el('catalog-cr-min');
  let bad = true;
  Object.defineProperty(input, 'validity', { get: () => ({ badInput: bad }) });
  input.value = '';
  assert.doesNotThrow(() => input.oninput());
  await x.make();
  assert.equal(x.calls.length, 0);
  assert.match(x.el('generation-feedback').textContent, /HG von.*Zahl/);
  bad = false;
  input.value = '0.25';
  input.oninput();
  await x.make();
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0].filters.crMin, 0.25);
  assert.equal(x.el('encounter-name').value, plan.name);
  await new Promise((r) => setTimeout(r, 250));
});
test('a valid pending proposal cannot become actionable after its native filter becomes unreadable', async (t) => {
  const x = await fixture(t);
  let fail = false;
  x.setFilters({ crMin: 1 });
  x.ui.initGeneration(() => {}, {
    plan: async () => x.plan,
    creature: () => null,
    filters: () => {
      if (fail) throw Error('HG von: Eine gültige nichtnegative Zahl eingeben.');
      return { crMin: 1 };
    },
    info: () => null,
    accept: async () => {},
  });
  let release;
  x.setGenerate(
    (request) =>
      new Promise((resolve) => (release = () => resolve({ ok: true, value: x.run(request) }))),
  );
  await x.make();
  assert.equal(x.calls.length, 1);
  fail = true;
  assert.doesNotThrow(() => x.ui.generationCatalogFiltersChanged());
  release();
  await settle();
  assert.equal(x.choice().disabled, true);
  assert.match(x.el('generation-preview').textContent, /Einstellungen geändert/);
  assert.match(x.el('generation-catalog-summary').textContent, /HG von.*Zahl/);
  assert.equal(x.calls[0].filters.crMin, 1);
});

test('an out-of-band proposal states requested target and actual deviation before its deliberate acceptance', async (t) => {
  const x = await fixture(t);
  x.el('generation-difficulty').value = 'medium';
  x.setGenerate(async (request) => {
    const run = x.run(request),
      p = run.plans[0];
    p.assessment = { baseXp: 300, adjustedXp: 600, difficulty: 'deadly' };
    p.composition = {
      blocks: [{ role: 'standard', challengeRating: '1', quantity: 2, statblockSlots: 1 }],
      metrics: {
        adjustedXp: 600,
        xpDelta: 350,
        monsterCount: 2,
        statblockCount: 1,
        initiativeSlots: 2,
        effectiveMonsterCount: 2,
        xpMultiplier: 1.5,
      },
      diagnostics: [],
      candidateCount: 1,
      fitCandidateCount: 0,
    };
    return { ok: true, value: run };
  });
  await x.make();
  const card = x.el('generation-preview').querySelector('article');
  assert.match(card.textContent, /Angefragt: Mittel.*Ziel 250 angepasste XP/);
  assert.match(card.textContent, /140 % über dem XP-Ziel/);
  assert.match(x.choice().textContent, /Abweichenden Vorschlag/);
});

const held = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function historyRun(x, id) {
  const run = x.run({ seed: id, filters: {} });
  run.id = id;
  run.plans[0].name = 'Vorschlag ' + id;
  return run;
}
async function chooseHistory(x, id) {
  x.el('generation-history').value = id;
  x.el('generation-history').onchange();
  await settle();
}
test('history selection removes prior preview authority and detached controls cannot accept a different loaded run', async (t) => {
  const x = await fixture(t);
  await x.make();
  const prior = x.choice(),
    pause = held();
  window.campaign.generationRun = () => pause.promise;
  await chooseHistory(x, 'second');
  assert.equal(!!x.choice(), false);
  assert.match(x.el('generation-feedback').textContent, /geladen/);
  prior.onclick();
  await settle();
  assert.deepEqual(x.accepted, []);
  pause.resolve({ ok: true, value: historyRun(x, 'second') });
  await settle();
  assert.match(x.el('generation-preview').textContent, /Vorschlag second/);
  prior.onclick();
  await settle();
  assert.deepEqual(x.accepted, []);
  x.choice().onclick();
  await settle();
  assert.equal(x.accepted[0].runId, 'second');
});
for (const transport of [false, true])
  test(`failed history read stays local, cannot accept prior preview and explicit retry recovers (${transport ? 'transport' : 'storage'})`, async (t) => {
    const x = await fixture(t);
    await x.make();
    window.campaign.generationRun = async () => {
      if (transport) throw new Error('Historienquelle ausgefallen');
      return { ok: false, error: 'Historienquelle ausgefallen' };
    };
    await chooseHistory(x, 'retry');
    assert.equal(!!x.choice(), false);
    assert.match(x.el('generation-feedback').textContent, /Historienquelle ausgefallen/);
    assert.deepEqual(x.accepted, []);
    window.campaign.generationRun = async () => ({ ok: true, value: historyRun(x, 'retry') });
    await chooseHistory(x, 'retry');
    assert.equal(x.choice().disabled, false);
    assert.match(x.el('generation-preview').textContent, /Vorschlag retry/);
  });
test('foreign history identity cannot be displayed or accepted as the requested proposal', async (t) => {
  const x = await fixture(t);
  await x.make();
  window.campaign.generationRun = async () => ({ ok: true, value: historyRun(x, 'other') });
  await chooseHistory(x, 'requested');
  assert.equal(!!x.choice(), false);
  assert.match(x.el('generation-feedback').textContent, /Auswahl/);
  assert.deepEqual(x.accepted, []);
});
test('clearing a history selection invalidates its pending read and removes prior actions', async (t) => {
  const x = await fixture(t);
  await x.make();
  const pause = held();
  window.campaign.generationRun = () => pause.promise;
  await chooseHistory(x, 'pending');
  await chooseHistory(x, '');
  pause.resolve({ ok: true, value: historyRun(x, 'pending') });
  await settle();
  assert.equal(!!x.choice(), false);
  assert.deepEqual(x.accepted, []);
});
test('late history errors cannot clear a newer loaded preview', async (t) => {
  const x = await fixture(t),
    pause = held();
  window.campaign.generationRun = () => pause.promise;
  await chooseHistory(x, 'old');
  window.campaign.generationRun = async () => ({ ok: true, value: historyRun(x, 'current') });
  await chooseHistory(x, 'current');
  x.messages.length = 0;
  pause.resolve({ ok: false, error: 'Old failure' });
  await settle();
  assert.match(x.el('generation-preview').textContent, /Vorschlag current/);
  assert.doesNotMatch(x.el('generation-feedback').textContent, /Old failure/);
  assert.deepEqual(x.messages, []);
});

test('linked-loot controls stay bound to their displayed preview and use only that run seed', async (t) => {
  const x = await fixture(t),
    loot = { id: 'linked', revision: 1, name: 'Coins', entries: [], trashed: false },
    rolled = [];
  window.campaign.lootTables = async () => ({ ok: true, value: [loot] });
  window.campaign.rollLoot = async (c) => {
    rolled.push(c);
    return { ok: true, value: { items: [] } };
  };
  x.setGenerate(async (request) => {
    const run = x.run(request);
    run.lootTables = [{ id: loot.id, revision: 1 }];
    return { ok: true, value: run };
  });
  await x.make();
  const old = x.el('generation-preview').querySelectorAll('article button')[1];
  assert(!!old);
  window.campaign.generationRun = async () => {
    const run = historyRun(x, 'second');
    run.lootTables = [{ id: loot.id, revision: 1 }];
    return { ok: true, value: run };
  };
  await chooseHistory(x, 'second');
  old.onclick();
  await settle();
  assert.deepEqual(rolled, []);
  x.el('generation-preview').querySelectorAll('article button')[1].onclick();
  await settle();
  assert.equal(rolled.length, 1);
  assert.equal(rolled[0].seed, 'second|loot|0');
});
test('a history event cannot replace a preview while its explicit acceptance is pending', async (t) => {
  const x = await fixture(t),
    pause = held(),
    reads = [];
  await x.make();
  window.campaign.acceptGeneration = () => pause.promise;
  window.campaign.generationRun = async (...args) => {
    reads.push(args);
    return { ok: true, value: historyRun(x, 'other') };
  };
  x.choice().onclick();
  await chooseHistory(x, 'other');
  assert.deepEqual(reads, []);
  pause.resolve({ ok: true, value: { id: 'saved', name: 'Saved' } });
  await settle();
  assert.match(x.el('generation-preview').textContent, /Gespeicherte Vorlage öffnen/);
});
test('adopting the same planning party does not falsely stale an accepted or historical preview', async (t) => {
  const x = await fixture(t);
  await x.make();
  x.ui.generationPlanningChanged(x.calls[0].party.map((p) => ({ ...p, id: 'copy-' + p.id })));
  assert.equal(x.choice().disabled, false);
  assert.doesNotMatch(x.el('generation-preview').textContent, /Einstellungen geändert/);
  x.setFilters({ text: 'Different' });
  x.ui.generationPlanningChanged(x.calls[0].party);
  assert.equal(x.choice().disabled, true);
});

test('fill mode sends the saved plan basis and a later roster edit invalidates its visible proposal', async (t) => {
  const x = await fixture(t);
  x.ui.generationPlanningChanged(x.plan.party, x.plan);
  x.el('generation-fill').checked = true;
  await x.make();
  assert.deepEqual(x.calls[0].fillPlan, { id: 'plan', revision: 1 });
  assert.equal(x.choice().disabled, false);
  x.ui.generationPlanningChanged(x.plan.party, {
    ...x.plan,
    entries: [{ ...x.plan.entries[0], count: 3 }],
  });
  assert.equal(x.choice().disabled, true);
  assert.match(x.el('generation-preview').textContent, /Einstellungen geändert/);
});

test('effective preset defaults reach requests while explicit choices survive refresh until reset', async (t) => {
  const x = await fixture(t);
  let defaults = { difficulty: 'easy', amount: 'few', balance: 'even', diversity: 'high' };
  window.campaign.generatorRegistry = async () => ({
    ok: true,
    value: {
      revision: 2,
      effectiveId: 'patrol',
      presets: [{ id: 'patrol', name: 'Patrouillen', config: { generationDefaults: defaults } }],
    },
  });
  await x.ui.refreshGeneration();
  await x.make();
  for (const [key, value] of Object.entries(defaults)) assert.equal(x.calls[0][key], value);
  x.el('generation-difficulty').value = 'hard';
  x.el('generation-difficulty').oninput();
  defaults = { difficulty: 'medium', amount: 'many', balance: 'varied', diversity: 'low' };
  await x.ui.refreshGeneration();
  assert.equal(x.el('generation-difficulty').value, 'hard');
  assert.equal(x.el('generation-amount').value, 'many');
  assert.match(x.el('generation-defaults-source').textContent, /Eigene Auswahl/);
  await x.make();
  assert.equal(x.calls[1].difficulty, 'hard');
  assert.equal(x.calls[1].amount, 'many');
  assert.equal(x.choice().disabled, false);
  x.el('generation-use-defaults').onclick();
  assert.equal(x.el('generation-difficulty').value, 'medium');
  assert.equal(x.choice().disabled, true);
  await x.make();
  assert.equal(x.calls[2].difficulty, 'medium');
  x.ui.activateGeneration({ ...x.w, token: 'new', campaign: { id: 'other' } });
  await settle();
  assert.equal(x.el('generation-difficulty').value, 'medium');
  assert.doesNotMatch(x.el('generation-defaults-source').textContent, /Eigene Auswahl/);
});
test('planning prerequisites and the actual party are visible before generation', async (t) => {
  const x = await fixture(t);
  x.ui.generationPlanningChanged(null);
  assert.match(
    x.el('generation-party-context').textContent,
    /aktive Kampagnenparty.*Erzeugen.*optional/,
  );
  x.ui.generationPlanningChanged([]);
  assert.match(x.el('generation-party-context').textContent, /leer/);
  x.ui.generationPlanningChanged([{ name: 'Reisende', level: 3, count: 4 }]);
  assert.match(x.el('generation-party-context').textContent, /4 × Level 3/);
  x.ui.generationPlanningChanged([{ name: 'Reisende', level: null, count: 4 }]);
  assert.match(x.el('generation-party-context').textContent, /Level fehlen/);
});

test('using the overview table explicitly replaces only generator table sources without generating or changing filters', async (t) => {
  const x = await fixture(t);
  window.HTMLElement.prototype.scrollIntoView = () => {};
  x.tables.push({ id: 'night', name: 'Nebelpfad', entries: [], trashed: false, scope: 'campaign' });
  await x.ui.refreshGeneration();
  const boxes = [...x.el('generation-tables').querySelectorAll('input')];
  boxes[0].checked = true;
  x.el('generation-time').value = 'night';
  x.setFilters({ text: 'Wolf' });
  await x.make();
  assert.equal(x.choice().disabled, false);
  x.el('encounter-table-list').value = 'night';
  x.el('encounter-table-list').oninput();
  assert.equal(x.el('encounter-table-use').disabled, false);
  x.el('encounter-table-use').click();
  assert.deepEqual(
    [...x.el('generation-tables').querySelectorAll('input')]
      .filter((b) => b.checked)
      .map((b) => b.value),
    ['night'],
  );
  assert.equal(x.calls.length, 1, 'source choice itself must not generate');
  assert.equal(x.accepted.length, 0);
  assert.equal(x.choice().disabled, true, 'previous proposal needs regeneration');
  assert.equal(x.el('generation-time').value, 'night');
  await x.make();
  assert.deepEqual(x.calls[1].tableIds, ['night']);
  assert.equal(x.calls[1].filters.text, 'Wolf');
  assert.equal(x.calls[1].time, 'night');
  x.tables[1].trashed = true;
  await x.ui.refreshGeneration();
  x.el('encounter-table-list').value = 'night';
  x.el('encounter-table-list').oninput();
  assert.equal(x.el('encounter-table-use').disabled, true);
  x.el('encounter-table-use').onclick();
  assert.equal(x.calls.length, 2);
  assert.equal(x.el('generation-tables').querySelector('input').checked, false);
});

test('native catalog generation uses active character levels without saving an empty planning template', async (t) => {
  const x = await fixture(t);
  let writes = 0;
  window.campaign.progress = async () => ({
    ok: true,
    value: {
      characters: [
        { id: 'ada', name: 'Ada', active: true, xp: 300 },
        { id: 'away', name: 'Borin', active: false, xp: 900 },
      ],
    },
  });
  window.campaign.encounterCommand = async () => {
    writes++;
    throw Error('No empty-template write expected');
  };
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await settle();
  assert.match(x.el('generation-party-context').textContent, /Aktive Kampagnenparty: 1 × Level 2/);
  await x.make();
  assert.equal(x.calls.length, 1);
  assert.deepEqual(
    x.calls[0].party.map(({ name, level, count }) => ({ name, level, count })),
    [{ name: 'Ada', level: 2, count: 1 }],
  );
  assert.equal(writes, 0);
  assert.equal(x.el('encounter-editor').hidden, true);
  assert.equal(x.choice().disabled, false);
  window.campaign.progress = async () => ({
    ok: true,
    value: { characters: [{ id: 'ada', name: 'Ada', active: true, xp: 900 }] },
  });
  await x.make();
  assert.equal(x.calls[1].party[0].level, 3);
  assert.match(x.el('generation-party-context').textContent, /Aktive Kampagnenparty: 1 × Level 3/);
});

test('an explicit planning party stays authoritative even when empty; current-party reads cannot outlive the workspace', async (t) => {
  const x = await fixture(t);
  let plan = structuredClone(x.plan),
    release;
  x.ui.initGeneration(() => {}, {
    plan: async () => plan,
    currentParty: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    creature: () => null,
    filters: () => ({}),
    info: () => null,
    accept: async () => {},
  });
  await x.make();
  assert.equal(x.calls.length, 1);
  assert.deepEqual(x.calls[0].party, plan.party);
  plan = { ...plan, party: [] };
  await x.make();
  assert.equal(x.calls.length, 1);
  assert.match(x.el('generation-feedback').textContent, /Planungsparty ist leer/);
  plan = null;
  await x.make();
  const oldRelease = release;
  x.ui.activateGeneration({ token: 'other', campaign: { id: 'other' } });
  oldRelease([{ id: 'late', name: 'Late', level: 20, count: 1 }]);
  await settle();
  assert.equal(x.calls.length, 1);
});

test('a failed current-party read never generates using previously cached participants', async (t) => {
  const x = await fixture(t);
  let failed = false;
  x.ui.initGeneration(() => {}, {
    plan: async () => null,
    currentParty: async () => {
      if (failed) throw Error('Party nicht lesbar');
      return [{ id: 'ada', name: 'Ada', level: 2, count: 1 }];
    },
    creature: () => null,
    filters: () => ({}),
    info: () => null,
    accept: async () => {},
  });
  await x.make();
  assert.equal(x.calls.length, 1);
  failed = true;
  await x.make();
  assert.equal(x.calls.length, 1);
  assert.match(x.el('generation-feedback').textContent, /Party nicht lesbar/);
});

test('failed planning save cannot silently fall back to campaign participants', async (t) => {
  const x = await fixture(t),
    plan = { ...structuredClone(x.plan), sources: [], catalogHash: 'pinned' };
  window.campaign.encounterPlan = async () => ({ ok: true, value: structuredClone(plan) });
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
      notice: 'Offline',
      hash: 'pinned',
    },
  });
  window.campaign.progress = async () => ({
    ok: true,
    value: { characters: [{ name: 'Other', active: true, xp: 300 }] },
  });
  window.campaign.saveEncounterPlan = async () => ({ ok: false, error: 'Revision conflict' });
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await x.ui.openCatalogReference({ kind: 'encounter', id: plan.id });
  x.el('encounter-name').value = 'Unsaved patrol';
  x.el('encounter-name').oninput();
  await x.make();
  assert.equal(x.calls.length, 0);
  assert.match(x.el('generation-feedback').textContent, /Offene Encounter-Eingabe/);
  assert.equal(x.el('encounter-name').value, 'Unsaved patrol');
});

test('saved preparations open through their current read even after generator inputs change', async (t) => {
  const x = await fixture(t),
    opened = [],
    reads = [];
  x.ui.initGeneration(() => {}, {
    plan: async () => x.plan,
    creature: () => null,
    filters: () => ({}),
    info: () => null,
    accept: async (plan) => opened.push(plan),
  });
  await x.make();
  x.choice().onclick();
  await settle();
  assert.equal(x.accepted.length, 1);
  x.setFilters({ text: 'Dragon' });
  assert.equal(
    x.choice().disabled,
    false,
    'a saved preparation is independent of a changed preview',
  );
  const saved = {
    id: 'accepted',
    name: 'Later authored title',
    revision: 2,
    notes: '  Later prose\r\n',
  };
  window.campaign.encounterPlan = async (token, id) => {
    reads.push({ token, id });
    return { ok: true, value: saved };
  };
  x.choice().onclick();
  await settle();
  assert.deepEqual(reads, [{ token: x.w.token, id: 'accepted' }]);
  assert.equal(x.accepted.length, 1, 'opening must not invoke the acceptance writer again');
  assert.deepEqual(opened.at(-1), saved);
});

test('failed saved-plan reads stay local and retry without another acceptance', async (t) => {
  const x = await fixture(t);
  await x.make();
  x.choice().onclick();
  await settle();
  let fail = true,
    reads = 0;
  window.campaign.encounterPlan = async () => {
    reads++;
    return fail
      ? { ok: false, error: 'Vorlage nicht lesbar' }
      : { ok: true, value: { id: 'accepted', name: 'Recovered' } };
  };
  x.choice().onclick();
  await settle();
  assert.match(x.el('generation-feedback').textContent, /Vorlage nicht lesbar/);
  assert.equal(x.accepted.length, 1);
  assert.equal(x.choice().disabled, false);
  fail = false;
  x.choice().onclick();
  await settle();
  assert.equal(reads, 2);
  assert.equal(x.accepted.length, 1);
});

test('a saved-plan response cannot cross workspaces or substitute another identity', async (t) => {
  const x = await fixture(t),
    opened = [];
  x.ui.initGeneration(() => {}, {
    plan: async () => x.plan,
    creature: () => null,
    filters: () => ({}),
    info: () => null,
    accept: async (plan) => opened.push(plan),
  });
  await x.make();
  x.choice().onclick();
  await settle();
  opened.length = 0;
  window.campaign.encounterPlan = async () => ({
    ok: true,
    value: { id: 'other', name: 'Wrong plan' },
  });
  x.choice().onclick();
  await settle();
  assert.deepEqual(opened, []);
  assert.match(x.el('generation-feedback').textContent, /Auswahl/);
  const pause = held();
  window.campaign.encounterPlan = () => pause.promise;
  x.choice().onclick();
  await settle();
  x.ui.activateGeneration({ ...x.w, token: 'other', campaign: { id: 'other' } });
  pause.resolve({ ok: true, value: { id: 'accepted', name: 'Late plan' } });
  await settle();
  assert.deepEqual(opened, []);
  assert.equal(x.accepted.length, 1);
});

test('saved-plan opening cannot claim success when the current authored draft cannot be saved', async (t) => {
  const x = await fixture(t),
    plan = {
      ...structuredClone(x.plan),
      sources: [],
      catalogHash: 'pinned',
      notes: '  Existing prose\r\n',
    },
    saved = { ...plan, id: 'saved', name: 'Saved preparation' };
  window.campaign.encounterPlan = async (_token, id) => ({
    ok: true,
    value: structuredClone(id === plan.id ? plan : saved),
  });
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
      notice: 'Offline',
      hash: 'pinned',
    },
  });
  window.campaign.saveEncounterPlan = async () => ({ ok: false, error: 'Revision conflict' });
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await x.ui.openCatalogReference({ kind: 'encounter', id: plan.id });
  x.el('encounter-name').value = 'Unsaved authored title';
  x.el('encounter-name').oninput();
  const historical = historyRun(x, 'historical');
  historical.acceptedPlanIds = ['saved'];
  window.campaign.generationRun = async () => ({ ok: true, value: historical });
  await chooseHistory(x, 'historical');
  x.choice().onclick();
  await settle();
  assert.equal(x.el('encounter-name').value, 'Unsaved authored title');
  assert.match(x.el('generation-feedback').textContent, /Offene Encounter-Eingabe/);
  assert.doesNotMatch(x.el('generation-feedback').textContent, /geöffnet/);
  assert.equal(x.accepted.length, 0);
  assert.equal(x.choice().disabled, false);
});

test('reopening the current saved preparation reads after flushing its authored draft', async (t) => {
  const x = await fixture(t);
  let saved = { ...structuredClone(x.plan), sources: [], catalogHash: 'pinned' },
    writes = 0;
  const reads = [];
  window.campaign.encounterPlan = async () => {
    reads.push(saved.name);
    return { ok: true, value: structuredClone(saved) };
  };
  window.campaign.creatureInfo = async () => ({
    ok: true,
    value: {
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
      notice: 'Offline',
      hash: 'pinned',
    },
  });
  window.campaign.saveEncounterPlan = async (command) => {
    writes++;
    saved = { ...structuredClone(command.plan), revision: saved.revision + 1 };
    return { ok: true, value: structuredClone(saved) };
  };
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await x.ui.openCatalogReference({ kind: 'encounter', id: saved.id });
  const historical = historyRun(x, 'historical');
  historical.acceptedPlanIds = [saved.id];
  window.campaign.generationRun = async () => ({ ok: true, value: historical });
  await chooseHistory(x, 'historical');
  x.el('encounter-name').value = 'Latest authored title';
  x.el('encounter-name').oninput();
  reads.length = 0;
  x.choice().onclick();
  await settle();
  assert.equal(writes, 1);
  assert.deepEqual(reads, ['Latest authored title']);
  assert.equal(x.el('encounter-name').value, 'Latest authored title');
  assert.equal(x.accepted.length, 0);
  assert.match(x.el('generation-feedback').textContent, /geöffnet/);
});

test('saved-plan reopening preserves edits made while its read is pending', async (t) => {
  const x = await fixture(t);
  let saved = { ...structuredClone(x.plan), sources: [], catalogHash: 'pinned' },
    pause = null;
  const ok = (value) => ({ ok: true, value });
  window.campaign.encounterPlan = async () => {
    const response = ok(structuredClone(saved));
    return pause ? (await pause.promise, response) : response;
  };
  window.campaign.creatureInfo = async () =>
    ok({
      types: [],
      sizes: [],
      habitats: [],
      alignments: [],
      subtypes: [],
      notice: 'Offline',
      hash: 'pinned',
    });
  window.campaign.saveEncounterPlan = async (command) => {
    saved = { ...structuredClone(command.plan), revision: saved.revision + 1 };
    return ok(structuredClone(saved));
  };
  x.ui.initCatalog(
    () => {},
    async () => {},
    async () => {},
  );
  x.ui.activateCatalog(x.w);
  await x.ui.openCatalogReference({ kind: 'encounter', id: saved.id });
  const historical = historyRun(x, 'historical');
  historical.acceptedPlanIds = [saved.id];
  window.campaign.generationRun = async () => ok(historical);
  await chooseHistory(x, 'historical');
  pause = held();
  x.choice().onclick();
  await settle();
  x.el('encounter-name').value = 'Edited during read';
  x.el('encounter-name').oninput();
  pause.resolve();
  await settle();
  assert.equal(saved.name, 'Edited during read');
  assert.equal(x.el('encounter-name').value, 'Edited during read');
  assert.match(x.el('generation-feedback').textContent, /geöffnet/);
});
