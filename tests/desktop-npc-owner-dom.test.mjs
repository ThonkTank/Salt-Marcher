import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/npc-ui.ts'],
  outfile: '.build/npc-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'expected NPC editor state');
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { resolve, promise };
}
async function fixture(t, { unavailable = false } = {}) {
  const old = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLSelectElement: globalThis.HTMLSelectElement,
      Option: globalThis.Option,
      Event: globalThis.Event,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
    { window, document } = parseHTML('<html><body><section id="groups"></section></body></html>');
  Object.assign(globalThis, {
    window,
    document,
    HTMLSelectElement: window.HTMLSelectElement,
    Event: window.Event,
    Option: function (text, value) {
      const o = document.createElement('option');
      o.textContent = text;
      o.value = value;
      return o;
    },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const timers = [],
    writes = [],
    commands = [],
    enters = [],
    messages = [],
    drafts = new Map(),
    ok = (value) => ({ ok: true, value });
  let keepGate = null,
    discardGate = null,
    executeGate = null;
  globalThis.setTimeout = (fn) => {
    timers.push(fn);
    return timers.length;
  };
  globalThis.clearTimeout = () => {};
  const view = (id) => ({
    id,
    name: id.toUpperCase(),
    noteRevision: 1,
    creatureId: null,
    readAloud: '',
    gmNotes: '',
    record: {
      id,
      revision: 1,
      factionId: unavailable && id === 'a' ? 'archived-faction' : null,
      modifier: 0,
      lifecycle: 'active',
      appearance: '',
      behavior: '',
      history: '',
      dailyPlan:
        unavailable && id === 'a'
          ? [
              {
                id: 'retained-plan',
                startMinute: 60,
                endMinute: 120,
                activity: 'Existing plan',
                place: 'location',
                locationId: 'archived-location',
                notes: '',
              },
            ]
          : [],
    },
    locationId: unavailable && id === 'a' ? 'archived-location' : null,
    positionRevision: null,
    actorRevision: null,
    health: null,
    disposition: 0,
    role: 'neutral',
  });
  window.campaign = {
    generationSources: async () => ok({ factions: [], locations: [] }),
    npcPlanCalendar: async () =>
      ok({
        revision: 0,
        name: 'Kampagnenkalender',
        startYear: 1,
        daySeconds: 86400,
        months: [{ name: 'Monat', days: 30 }],
        weekdays: ['Tag'],
      }),
    npcs: async (token) =>
      ok({
        total: 1,
        offset: 0,
        rows: [
          {
            ...view(token === 'A' ? 'a' : 'b'),
            lifecycle: 'active',
            factionId: null,
            role: 'neutral',
          },
        ],
      }),
    npcDrafts: async () => ok([]),
    npcDraft: async (_token, id) => ok(drafts.get(id) ?? null),
    npc: async (_token, id) => ok(view(id)),
    keepNpcDraft: async (token, d, expected) => {
      writes.push({ token, d: structuredClone(d), expected });
      const gate = keepGate;
      keepGate = null;
      if (gate) await gate.promise;
      drafts.set(d.id, structuredClone(d));
      return ok();
    },
    discardNpcDraft: async (_token, id) => {
      const gate = discardGate;
      discardGate = null;
      if (gate) await gate.promise;
      drafts.delete(id);
      return ok();
    },
    executeNpc: async (c) => {
      commands.push(c);
      const gate = executeGate;
      executeGate = null;
      if (gate) await gate.promise;
      drafts.delete(c.npc.id);
      return ok(view(c.npc.id));
    },
  };
  const file = require.resolve('../.build/npc-owner.cjs');
  delete require.cache[file];
  const ui = require(file);
  ui.initNpcs(
    (text, error) => messages.push({ text, error }),
    async () => {},
    async (id) => enters.push(id),
  );
  // Match native selects: assigning a value without an option clears selection.
  const selected = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      const value = selected.get(this) ?? this.options[0]?.value ?? '';
      return [...this.options].some((o) => o.value === value) ? value : '';
    },
    set(value) {
      selected.set(
        this,
        [...this.options].some((o) => o.value === String(value)) ? String(value) : '',
      );
    },
  });
  const el = (id) => document.getElementById(id),
    edit = (text) => {
      el('npc-history').value = text;
      el('npc-editor').oninput();
    },
    open = async (token) => {
      ui.activateNpcs({ token, campaign: { id: 'campaign-' + token } });
      await ui.openNpcs();
      el('npc-list').querySelector('button').click();
      await until(() => !el('npc-editor').hidden);
    };
  await open('A');
  t.after(() => {
    ui.activateNpcs({ token: 'closed', campaign: { id: 'closed' } });
    Object.assign(globalThis, old);
  });
  return {
    ui,
    el,
    edit,
    open,
    writes,
    commands,
    timers,
    enters,
    messages,
    holdKeep() {
      keepGate = deferred();
      return keepGate;
    },
    holdDiscard() {
      discardGate = deferred();
      return discardGate;
    },
    holdExecute() {
      executeGate = deferred();
      return executeGate;
    },
  };
}
test('pending NPC input does not block another campaign or supply its write basis', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha');
  const gate = x.holdKeep(),
    old = x.ui.flushNpcs();
  await until(() => x.writes.length === 1);
  await x.open('B');
  x.edit('Beta');
  assert.equal(await x.ui.flushNpcs(), true);
  assert.equal(x.writes.at(-1).token, 'B');
  assert.equal(x.writes.at(-1).expected, null);
  gate.resolve();
  await old;
  assert.equal(x.el('npc-history').value, 'Beta');
});
test('an expired NPC timer cannot save another campaign input', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha');
  const timer = x.timers.at(-1);
  await x.ui.flushNpcs();
  await x.open('B');
  x.edit('Beta');
  const n = x.writes.length;
  timer();
  await tick();
  assert.equal(x.writes.length, n);
  await x.ui.flushNpcs();
  assert.equal(x.writes.at(-1).d.fields.history, 'Beta');
});
test('late NPC discard cannot clear another campaign editor', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha');
  await x.ui.flushNpcs();
  const gate = x.holdDiscard();
  x.el('npc-reload').click();
  await tick();
  await x.open('B');
  x.edit('Beta');
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.el('npc-history').value, 'Beta');
  await x.ui.flushNpcs();
  assert.equal(x.writes.at(-1).d.id, 'b');
});
test('input typed during NPC discard survives and uses an empty draft basis', async (t) => {
  const x = await fixture(t);
  x.edit('Before');
  await x.ui.flushNpcs();
  const gate = x.holdDiscard();
  x.el('npc-reload').click();
  await tick();
  x.edit('  Later\r\n');
  gate.resolve();
  await until(() => x.writes.length === 2);
  assert.equal(x.el('npc-history').value, '  Later\r\n');
  assert.equal(x.writes.at(-1).expected, null);
  assert.equal(x.writes.at(-1).d.fields.history, '  Later\r\n');
});
test('a late NPC save cannot enter an encounter in another campaign', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha');
  const gate = x.holdExecute();
  x.el('npc-enter').click();
  await until(() => x.el('npc-editor').inert);
  await x.open('B');
  x.edit('Beta');
  gate.resolve();
  await tick();
  await tick();
  assert.deepEqual(x.enters, []);
  assert.equal(x.el('npc-history').value, 'Beta');
});
test('reselecting the current NPC retains input typed after the click', async (t) => {
  const x = await fixture(t);
  x.el('npc-list').querySelector('button').click();
  x.edit('Later');
  await x.ui.flushNpcs();
  await tick();
  assert.equal(x.el('npc-history').value, 'Later');
  assert.equal(x.writes.at(-1).d.fields.history, 'Later');
});

test('duplicate NPC submit while saving raw input sends only one command', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha');
  const keep = x.holdKeep(),
    execute = x.holdExecute();
  const submit = () => x.el('npc-editor').onsubmit({ preventDefault() {} });
  submit();
  submit();
  await until(() => x.writes.length === 1);
  keep.resolve();
  await until(() => x.commands.length === 1);
  await tick();
  assert.equal(x.commands.length, 1);
  execute.resolve();
  await tick();
  await tick();
});

test('unavailable NPC bindings survive opening, prose edits and list refresh until explicitly removed', async (t) => {
  const x = await fixture(t, { unavailable: true }),
    selected = () => [x.el('npc-faction').value, x.el('npc-location').value];
  assert.deepEqual(selected(), ['archived-faction', 'archived-location']);
  assert.equal(
    x.el('npc-daily-base').querySelector('[data-daily-field=locationId]').value,
    'archived-location',
  );
  x.el('npc-daily-add').onclick();
  const added = x.el('npc-daily-base').lastElementChild;
  assert.equal(
    [...added.querySelector('[data-daily-field=locationId]').options].some(
      (o) => o.value === 'archived-location',
    ),
    false,
    'unavailable retained place is not a new activity target',
  );
  added.querySelector('button').onclick();
  const unavailable = () => {
    for (const id of ['npc-faction', 'npc-location']) {
      const input = x.el(id),
        option = [...input.options].find((o) => o.value === input.value);
      assert.equal(option.disabled, true);
      assert.match(option.textContent, /Nicht mehr verfügbar/);
    }
  };
  unavailable();
  x.edit('A new observation');
  assert.equal(await x.ui.flushNpcs(), true);
  assert.equal(x.writes.at(-1).d.fields.faction, 'archived-faction');
  assert.equal(x.writes.at(-1).d.fields.location, 'archived-location');
  assert.equal(x.writes.at(-1).d.fields.history, 'A new observation');
  await x.ui.openNpcs(false);
  assert.deepEqual(selected(), ['archived-faction', 'archived-location']);
  unavailable();
  assert.deepEqual(x.commands, []);
  x.el('npc-faction').value = '';
  x.el('npc-location').value = '';
  x.edit('Explicitly without bindings');
  await x.ui.flushNpcs();
  assert.equal(x.writes.at(-1).d.fields.faction, '');
  assert.equal(x.writes.at(-1).d.fields.location, '');
});
