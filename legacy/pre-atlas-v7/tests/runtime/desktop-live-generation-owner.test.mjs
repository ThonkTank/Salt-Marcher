import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/live-generation-ui.ts'],
  outfile: '.build/planner-live-generation-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  settle = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  },
  deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
async function fixture(t) {
  const { window, document } = parseHTML(
      '<html><body><div id="live-focus-bar"><button id="combat-resume"></button></div><details id="live-session-navigator" hidden><button id="live-session-packet"></button></details></body></html>',
    ),
    previous = { window: globalThis.window, document: globalThis.document };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  Object.assign(globalThis, { window, document });
  const scene = { id: 'scene', title: 'Gruppe', membershipRevision: 1, locationId: null },
    x = {
      context: {
        workspace: { token: 'token', campaign: { id: 'campaign' } },
        live: {
          scene,
          focusRevision: 1,
          roster: [{ id: 'hero', active: true, sceneId: 'scene', profile: { name: 'Ada' } }],
        },
      },
      prepared: [],
      messages: [],
      requests: [],
    };
  x.flush = async () => true;
  x.prepare = async (a) => {
    x.prepared.push(a);
    return true;
  };
  let sequence = 0;
  x.makeRun = (request) => ({
    id: 'run-' + ++sequence,
    revision: 1,
    seed: request.seed,
    request,
    preset: { name: 'Standard', revision: 1 },
    plans: [
      {
        name: 'Vorschlag ' + sequence,
        entries: [],
        sources: [],
        notes: 'GM',
        assessment: { difficulty: 'easy', baseXp: 0, adjustedXp: 0 },
      },
    ],
    warnings: [],
    candidates: [],
  });
  x.generate = async (request) => ({ ok: true, value: x.makeRun(request) });
  window.campaign = {
    progress: async () => ({ ok: true, value: { characters: [{ characterId: 'hero', xp: 0 }] } }),
    encounterTables: async () => ({ ok: true, value: [] }),
    generatorRegistry: async () => ({
      ok: true,
      value: {
        revision: 1,
        effectiveId: 'preset',
        presets: [
          {
            id: 'preset',
            config: {
              generationDefaults: {
                difficulty: 'easy',
                amount: 'neutral',
                balance: 'neutral',
                diversity: 'neutral',
              },
            },
          },
        ],
      },
    }),
    generationSources: async () => ({ ok: true, value: { factions: [] } }),
    generationRuns: async () => ({ ok: true, value: [] }),
    npcs: async () => ({ ok: true, value: { rows: [], next: null, total: 0 } }),
    generateEncounters: async (_token, request) => {
      x.requests.push(request);
      return x.generate(request);
    },
  };
  delete require.cache[require.resolve('../../.build/planner-live-generation-ui.cjs')];
  const { LiveEncounterGenerator } = require('../../.build/planner-live-generation-ui.cjs');
  x.ui = new LiveEncounterGenerator(
    (...a) => x.messages.push(a),
    () => x.context,
    () => x.flush(),
    (a) => x.prepare(a),
  );
  x.el = (id) => document.getElementById(id);
  const dialog = x.el('live-generation-dialog');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.open = async () => {
    x.el('live-generation-open').click();
    await settle();
  };
  x.make = async () => {
    x.el('live-generation-make').click();
    await settle();
  };
  x.choice = () => document.querySelector('[data-prepare]');
  t.after(() => {
    x.ui.reset();
    Object.assign(globalThis, previous);
  });
  await x.open();
  return x;
}
test('detached proposal controls cannot prepare a different newer generation', async (t) => {
  const x = await fixture(t);
  await x.make();
  const old = x.choice();
  await x.make();
  old.onclick();
  await settle();
  assert.equal(x.prepared.length, 0);
  x.choice().click();
  await settle();
  assert.equal(x.prepared[0].generation.runId, 'run-2');
});
test('an old successful preparation cannot close a newly opened preview', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  await x.make();
  x.prepare = () => wait.promise;
  x.choice().click();
  await settle();
  x.ui.reset();
  await x.open();
  await x.make();
  wait.resolve(true);
  await settle();
  assert.equal(x.el('live-generation-dialog').open, true);
  assert.match(x.el('live-generation-preview').textContent, /Vorschlag 2/);
  assert.ok(!x.messages.some((m) => m[0].includes('Begegnung für diese Gruppe vorbereitet')));
});
test('late generation failure cannot overwrite the next dialogs status', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.generate = () => wait.promise;
  x.el('live-generation-make').click();
  await settle();
  x.ui.reset();
  await x.open();
  wait.resolve({ ok: false, error: 'Alter Quellenfehler' });
  await settle();
  assert.doesNotMatch(x.el('live-generation-status').textContent, /Alter Quellenfehler/);
  assert.ok(!x.messages.some((m) => m[0].includes('Alter Quellenfehler')));
});
test('closing while the pre-open flush is pending invalidates that open request', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.flush = () => wait.promise;
  x.el('live-generation-open').click();
  await settle();
  x.ui.reset();
  wait.resolve(true);
  await settle();
  assert.equal(x.el('live-generation-dialog').open, false);
});
test('an old preparation finally cannot release a newer running generation', async (t) => {
  const x = await fixture(t),
    old = deferred(),
    next = deferred();
  await x.make();
  x.prepare = () => old.promise;
  x.choice().click();
  await settle();
  x.ui.reset();
  await x.open();
  x.generate = () => next.promise;
  x.el('live-generation-make').click();
  await settle();
  old.resolve(false);
  await settle();
  x.el('live-generation-make').onclick();
  await settle();
  assert.equal(x.requests.length, 2);
  next.resolve({ ok: true, value: x.makeRun(x.requests[1]) });
  await settle();
});
test('live composition choices reach the common selector and changing them invalidates preparation', async (t) => {
  const x = await fixture(t);
  assert.equal(x.el('live-generation-open').closest('[hidden]'), null);
  for (const [key, v] of [
    ['amount', 'many'],
    ['balance', 'varied'],
    ['diversity', 'high'],
  ]) {
    x.el('live-generation-' + key).value = v;
    x.el('live-generation-' + key).dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  await x.make();
  assert.deepEqual(
    Object.fromEntries(['amount', 'balance', 'diversity'].map((k) => [k, x.requests[0][k]])),
    { amount: 'many', balance: 'varied', diversity: 'high' },
  );
  const saved = x.choice();
  x.el('live-generation-amount').value = 'few';
  x.el('live-generation-amount').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(saved.disabled, true);
  saved.onclick();
  await settle();
  assert.equal(x.prepared.length, 0);
});
test('loading a saved live proposal restores its recorded preferences instead of current defaults', async (t) => {
  const x = await fixture(t);
  x.el('live-generation-amount').value = 'many';
  x.el('live-generation-balance').value = 'varied';
  x.el('live-generation-diversity').value = 'high';
  await x.make();
  const saved = x.makeRun(x.requests[0]);
  window.campaign.generatorRegistry = async () => ({
    ok: true,
    value: {
      revision: 2,
      effectiveId: 'preset',
      presets: [
        {
          id: 'preset',
          config: {
            generationDefaults: {
              difficulty: 'easy',
              amount: 'few',
              balance: 'even',
              diversity: 'low',
            },
          },
        },
      ],
    },
  });
  window.campaign.generationRun = async () => ({ ok: true, value: saved });
  x.ui.reset();
  await x.open();
  assert.equal(x.el('live-generation-amount').value, 'few');
  const history = x.el('live-generation-history');
  history.value = saved.id;
  history.onchange();
  await settle();
  assert.equal(x.el('live-generation-amount').value, 'many');
  assert.equal(x.el('live-generation-balance').value, 'varied');
  assert.equal(x.el('live-generation-diversity').value, 'high');
  assert.equal(x.choice().disabled, false);
});
