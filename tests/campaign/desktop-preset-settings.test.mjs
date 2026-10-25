import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';

buildSync({
  stdin: {
    contents:
      "export {openPresetSettings} from './src/app/campaign/preset-settings-ui'; export {initCampaignScreen} from './src/app/campaign/campaign-screen-ui';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/preset-settings-ui-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/preset-settings-store-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/preset-settings-store-test.cjs');
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'preset-settings-')),
    store = new CampaignStore(path.join(root, 'work.sqlite'));
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    previous = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      Event: globalThis.Event,
    };
  const memory = new Map(),
    storage = {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    };
  Object.assign(globalThis, { window, document, localStorage: storage, Event: window.Event });
  window.localStorage = storage;
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
    Object.assign(globalThis, previous);
  });
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.options[0]?.value ?? '',
    });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
  }
  const append = document.head.append.bind(document.head);
  document.head.append = (...nodes) => {
    append(...nodes);
    for (const n of nodes) if (n.tagName === 'LINK') queueMicrotask(() => n.onload());
  };
  const ok = (value) => ({ ok: true, value }),
    calls = [],
    registryReads = [];
  window.campaign = {
    campaignOverview: async () => ok(store.campaignOverview()),
    presetRegistry: async (id) => {
      registryReads.push(id);
      return ok(store.presetRegistry(id));
    },
    presetCommand: async (c) => {
      calls.push(c);
      try {
        return ok(store.presetCommand(c));
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    presetOutcome: async (c) => ok(store.presetOutcome(c)),
  };
  delete require.cache[require.resolve('../../.build/preset-settings-ui-test.cjs')];
  const ui = require('../../.build/preset-settings-ui-test.cjs'),
    el = (id) => document.getElementById(id),
    campaign = store.create('Waldrand');
  const open = async (id) => {
    await ui.openPresetSettings(id);
    await settle();
  };
  const edit = (id, value) => {
    el(id).value = String(value);
    el('preset-form').oninput();
  };
  const save = async () => {
    el('preset-form').onsubmit({ preventDefault() {} });
    await settle();
  };
  return { window, document, store, ui, el, calls, registryReads, campaign, open, edit, save };
}

test('copied rules stay identifiable through editing, save and explicit assignment, then reopen as effective rules', async (t) => {
  const x = await fixture(t);
  await x.open(x.campaign.id);
  const system = x.store.presetRegistry(x.campaign.id).effectiveId;
  x.el('preset-copy').onclick();
  const copyId = x.el('preset-selection').value;
  assert.notEqual(copyId, system);
  assert.match(
    x.el('preset-selection').selectedOptions?.[0]?.textContent ??
      x.el('preset-selection').querySelector('option:last-child').textContent,
    /Kopie.*Entwurf/,
  );
  x.edit('preset-name', 'Waldrand – einzelne Initiative');
  x.edit('preset-mob', 0);
  assert.match(
    x.el('preset-selection').querySelector('option:last-child').textContent,
    /Waldrand.*Entwurf/,
  );
  assert.equal(x.el('preset-assign').disabled, true);
  assert.equal(x.calls.length, 0);
  await x.save();
  assert.equal(x.calls.length, 1);
  assert.equal(x.store.presetRegistry(x.campaign.id).effectiveId, system, 'saving must not assign');
  assert.equal(
    x.store.presetRegistry(null).presets.find((p) => p.id === copyId).config.combat.mobThreshold,
    0,
  );
  assert.doesNotMatch(
    x.el('preset-selection').querySelector('option:last-child').textContent,
    /Entwurf/,
  );
  assert.match(x.el('preset-status').textContent, /Preset gespeichert/);
  assert.equal(
    x.el('preset-status').closest('.preset-scroll'),
    null,
    'feedback stays outside the scrolling form',
  );
  x.el('preset-assign').onclick();
  await settle();
  assert.equal(x.calls.length, 2);
  assert.equal(x.store.presetRegistry(x.campaign.id).effectiveId, copyId);
  x.el('preset-close').onclick();
  await x.open(x.campaign.id);
  assert.equal(x.el('preset-selection').value, copyId);
  assert.equal(x.el('preset-mob').value, '0');
  assert.match(x.el('preset-effective').textContent, /Waldrand – einzelne Initiative/);
});

test('invalid lower-form rules retain the draft and visible feedback without a storage command', async (t) => {
  const x = await fixture(t);
  await x.open(x.campaign.id);
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Unfertig');
  x.edit('preset-weight-easy', 99);
  await x.save();
  assert.equal(x.calls.length, 0);
  assert.equal(x.el('preset-weight-track').style.visibility, 'hidden');
  assert.match(x.el('preset-status').textContent, /zusammen 100/);
  assert.equal(x.el('preset-status').closest('.preset-scroll'), null);
  assert.equal(x.el('preset-weight-easy').value, '99');
  x.el('preset-close').onclick();
  assert.equal(x.el('preset-discard').open, true);
  x.el('preset-discard-keep').onclick();
  assert.equal(x.el('preset-manager').open, true);
  assert.equal(x.el('preset-name').value, 'Unfertig');
  x.edit('preset-weight-easy', 25);
  assert.equal(x.el('preset-weight-track').style.visibility, '');
  await x.save();
  assert.equal(x.calls.length, 1);
});

test('application settings follow the current workspace at click time, without assigning or requiring a campaign', async (t) => {
  const x = await fixture(t);
  let current = x.campaign.id;
  x.ui.initCampaignScreen({
    before: async () => true,
    enter: async () => true,
    changed: async () => {},
    currentCampaign: () => current,
  });
  x.el('application-settings').onclick();
  await settle();
  assert.equal(x.registryReads.at(-1), current);
  assert.equal(x.el('preset-context').value, current);
  assert.equal(x.calls.length, 0);
  x.el('preset-close').onclick();
  current = null;
  x.el('application-settings').onclick();
  await settle();
  assert.equal(x.registryReads.at(-1), null);
  assert.equal(x.el('preset-context').value, '');
  assert.equal(x.el('preset-assign').disabled, true);
  assert.equal(x.calls.length, 0);
});

test('an unresolved copied-preset save reopens with its named draft and only checks the receipt until deliberately retried', async (t) => {
  const x = await fixture(t);
  await x.open(x.campaign.id);
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Noch offen');
  const id = x.el('preset-selection').value,
    send = x.window.campaign.presetCommand;
  x.window.campaign.presetCommand = async (c) => {
    x.calls.push(c);
    throw new Error('Verbindung verloren');
  };
  await x.save();
  assert.equal(x.calls.length, 1);
  assert.equal(x.el('preset-check').hidden, false);
  assert.equal(x.el('preset-check').closest('.preset-scroll'), null);
  assert.equal(x.el('preset-save').disabled, true);
  // A new renderer retains only the journaled command, not module state.
  x.el('preset-manager').open = false;
  delete require.cache[require.resolve('../../.build/preset-settings-ui-test.cjs')];
  const fresh = require('../../.build/preset-settings-ui-test.cjs');
  await fresh.openPresetSettings(null);
  assert.equal(x.calls.length, 1);
  assert.equal(x.el('preset-context').value, x.campaign.id);
  assert.equal(x.el('preset-selection').value, id);
  assert.match(
    x.el('preset-selection').querySelector('option:last-child').textContent,
    /Noch offen.*Entwurf/,
  );
  assert.equal(x.el('preset-name').value, 'Noch offen');
  x.el('preset-check').onclick();
  await settle();
  assert.equal(x.calls.length, 1);
  assert.equal(x.el('preset-save').disabled, false);
  assert.equal(x.el('preset-name').value, 'Noch offen');
  x.window.campaign.presetCommand = send;
  await x.save();
  assert.equal(x.calls.length, 2);
  assert.equal(x.store.presetRegistry(null).presets.find((p) => p.id === id).name, 'Noch offen');
});

test('fixed-size composition saves ordinary rules, keeps assignment explicit and generates a real two-person encounter', async (t) => {
  const x = await fixture(t);
  await x.open(x.campaign.id);
  assert.equal(x.el('preset-fixed-apply').disabled, true);
  x.el('preset-copy').onclick();
  const source = structuredClone(x.store.presetRegistry(null).presets.find((p) => p.system).config),
    copyId = x.el('preset-selection').value;
  x.edit('preset-name', 'Solo duo');
  x.edit('preset-default-difficulty', 'medium');
  x.edit('preset-mob', 0);
  assert.equal(x.el('preset-fixed-count').type, 'text');
  assert.equal(x.el('preset-fixed-count').getAttribute('inputmode'), 'numeric');
  for (const invalid of [0, -1, 1.5, 1000, 'unusable']) {
    x.edit('preset-fixed-count', invalid);
    x.el('preset-fixed-apply').onclick();
    assert.match(x.el('preset-status').textContent, /1 bis 999/);
    assert.equal(x.calls.length, 0);
  }
  x.edit('preset-fixed-count', 2);
  let prevented = false;
  x.el('preset-fixed-count').onkeydown({
    key: 'Enter',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(x.el('preset-crBlocks-min').value, '1');
  assert.equal(x.el('preset-crBlocks-max').value, '1');
  assert.equal(x.el('preset-minion-min').value, '2');
  assert.equal(x.el('preset-boss-max').value, '2');
  assert.equal(x.el('preset-mob').value, '0');
  assert.equal(x.calls.length, 0);
  assert.equal(x.el('preset-assign').disabled, true);
  x.edit('preset-fixed-count', 'unapplied idea');
  await x.save();
  const saved = x.store.presetRegistry(null).presets.find((p) => p.id === copyId);
  assert.deepEqual(saved.config.composition.roleMatrix, source.composition.roleMatrix);
  assert.deepEqual(saved.config.scene, source.scene);
  assert.equal(saved.config.generationDefaults.difficulty, 'medium');
  assert.equal(
    x.store.presetRegistry(x.campaign.id).effectiveId,
    x.store.presetRegistry(null).presets.find((p) => p.system).id,
  );
  x.el('preset-assign').onclick();
  await settle();
  const w = x.store.activate(x.campaign.id);
  const request = {
    seed: 'rostmuehle-qa17',
    title: 'Späher am Wehr',
    count: 1,
    party: [{ id: 'ada', name: 'Ada', level: 2, count: 1 }],
    difficulty: 'medium',
    amount: 'few',
    balance: 'neutral',
    diversity: 'neutral',
    tableIds: [],
    filters: { types: ['Humanoid'] },
    habitat: '',
    time: 'any',
  };
  const run = x.store.generateEncounters(w.token, request),
    plan = run.plans[0];
  assert.equal(run.preset.id, copyId);
  assert.equal(
    plan.entries.reduce((sum, e) => sum + e.count, 0),
    2,
  );
  assert.equal(plan.assessment.difficulty, 'Mittel');
  assert.equal(plan.assessment.adjustedXp, 100);
  assert.equal(plan.composition.blocks.length, 1);
  assert.equal(plan.composition.blocks[0].quantity, 2);
  x.el('preset-close').onclick();
  await x.open(x.campaign.id);
  assert.equal(x.el('preset-selection').value, copyId);
  assert.equal(x.el('preset-boss-max').value, '2');
});

for (const rejected of [false, true])
  test(`a failed campaign-context read retains the confirmed assignment context and draft: ${rejected ? 'transport' : 'provider'}`, async (t) => {
    const x = await fixture(t),
      other = x.store.create('Hafen');
    await x.open(x.campaign.id);
    x.el('preset-copy').onclick();
    x.edit('preset-name', 'Waldregeln');
    await x.save();
    x.el('preset-assign').onclick();
    await settle();
    const savedId = x.el('preset-selection').value;
    x.edit('preset-name', 'Weiterer offener Name');
    const read = x.window.campaign.presetRegistry;
    x.window.campaign.presetRegistry = async (id) => {
      if (id === other.id) {
        if (rejected) throw Error('Kontext nicht erreichbar');
        return { ok: false, error: 'Kontext nicht lesbar' };
      }
      return read(id);
    };
    x.el('preset-context').value = other.id;
    x.el('preset-context').onchange();
    await settle();
    assert.equal(x.el('preset-context').value, x.campaign.id);
    assert.equal(x.el('preset-name').value, 'Weiterer offener Name');
    assert.match(x.el('preset-effective').textContent, /Waldregeln/);
    assert.match(x.el('preset-status').textContent, /Kontext nicht (erreichbar|lesbar)/);
    assert.equal(x.calls.length, 2);
    assert.notEqual(x.store.presetRegistry(other.id).effectiveId, savedId);
    x.window.campaign.presetRegistry = read;
    x.el('preset-context').value = other.id;
    x.el('preset-context').onchange();
    await settle();
    assert.equal(x.el('preset-context').value, other.id);
    assert.match(x.el('preset-effective').textContent, /Systempreset/);
    assert.equal(x.el('preset-name').value, 'Weiterer offener Name');
    assert.equal(x.el('preset-assign').disabled, true);
    await x.save();
    assert.equal(
      x.store.presetRegistry(other.id).effectiveId,
      x.store.presetRegistry(null).presets.find((p) => p.system).id,
    );
    x.el('preset-assign').onclick();
    await settle();
    assert.equal(x.store.presetRegistry(other.id).effectiveId, savedId);
    assert.equal(x.store.presetRegistry(x.campaign.id).effectiveId, savedId);
  });

test('failed opening cannot present the former campaign registry as the new campaign assignment', async (t) => {
  const x = await fixture(t),
    other = x.store.create('Hafen');
  await x.open(x.campaign.id);
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Nur Wald');
  await x.save();
  x.el('preset-assign').onclick();
  await settle();
  x.el('preset-close').onclick();
  const read = x.window.campaign.presetRegistry;
  x.window.campaign.presetRegistry = async () => ({ ok: false, error: 'Registry nicht lesbar' });
  await x.open(other.id);
  assert.equal(x.el('preset-context').value, other.id);
  assert.equal(x.el('preset-form').hidden, true);
  assert.equal(x.el('preset-selection').children.length, 0);
  assert.match(x.el('preset-effective').textContent, /nicht verfügbar/);
  assert.doesNotMatch(x.el('preset-effective').textContent, /Nur Wald/);
  for (const id of ['preset-copy', 'preset-save', 'preset-assign', 'preset-reset', 'preset-delete'])
    assert.equal(x.el(id).disabled, true, id);
  assert.equal(x.el('preset-close').disabled, false);
  assert.equal(x.calls.length, 2);
  x.el('preset-close').onclick();
  x.window.campaign.presetRegistry = read;
  await x.open(other.id);
  assert.equal(x.el('preset-form').hidden, false);
  assert.match(x.el('preset-effective').textContent, /Systempreset/);
  assert.equal(x.el('preset-copy').disabled, false);
});

test('assignment receipt restores its confirmed registry when reopening could not read the registry', async (t) => {
  const x = await fixture(t);
  await x.open(x.campaign.id);
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Belegregeln');
  await x.save();
  const id = x.el('preset-selection').value;
  x.window.campaign.presetCommand = async (c) => {
    x.calls.push(c);
    x.store.presetCommand(c);
    throw Error('Antwort nach Commit verloren');
  };
  x.el('preset-assign').onclick();
  await settle();
  assert.equal(x.calls.length, 2);
  assert.equal(x.store.presetRegistry(x.campaign.id).effectiveId, id);
  x.el('preset-manager').open = false;
  x.window.campaign.presetRegistry = async () => ({ ok: false, error: 'Registry nicht verfügbar' });
  delete require.cache[require.resolve('../../.build/preset-settings-ui-test.cjs')];
  const fresh = require('../../.build/preset-settings-ui-test.cjs');
  await fresh.openPresetSettings(null);
  await settle();
  assert.equal(x.el('preset-form').hidden, true);
  assert.equal(x.el('preset-check').hidden, false);
  x.el('preset-check').onclick();
  await settle();
  assert.equal(x.calls.length, 2);
  assert.equal(x.el('preset-check').hidden, true);
  assert.equal(x.el('preset-form').hidden, false);
  assert.equal(x.el('preset-name').value, 'Belegregeln');
  assert.equal(x.el('preset-selection').value, id);
  assert.match(x.el('preset-effective').textContent, /Belegregeln/);
  assert.match(x.el('preset-status').textContent, /Zuweisung gespeichert/);
});

test('pending campaign-context reads keep the visible campaign and effective assignment together', async (t) => {
  const x = await fixture(t),
    other = x.store.create('Hafen');
  await x.open(x.campaign.id);
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Wald');
  await x.save();
  x.el('preset-assign').onclick();
  await settle();
  x.edit('preset-name', 'Offener Entwurf');
  const read = x.window.campaign.presetRegistry;
  let release;
  x.window.campaign.presetRegistry = (id) =>
    id === other.id
      ? new Promise(
          (resolve) => (release = () => resolve({ ok: true, value: x.store.presetRegistry(id) })),
        )
      : read(id);
  x.el('preset-context').value = other.id;
  x.el('preset-context').onchange();
  await settle();
  assert.equal(x.el('preset-context').value, x.campaign.id);
  assert.equal(x.el('preset-context').disabled, true);
  assert.match(x.el('preset-effective').textContent, /Wald/);
  assert.match(x.el('preset-status').textContent, /geladen/);
  assert.equal(x.el('preset-name').value, 'Offener Entwurf');
  assert.equal(x.calls.length, 2);
  release();
  await settle();
  assert.equal(x.el('preset-context').value, other.id);
  assert.equal(x.el('preset-context').disabled, false);
  assert.match(x.el('preset-effective').textContent, /Systempreset/);
  assert.equal(x.el('preset-name').value, 'Offener Entwurf');
  assert.equal(x.calls.length, 2);
});

test('opening a pending registry hides all previously confirmed preset values immediately', async (t) => {
  const x = await fixture(t),
    other = x.store.create('Hafen');
  await x.open(x.campaign.id);
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Nur Wald');
  await x.save();
  x.el('preset-assign').onclick();
  await settle();
  x.el('preset-close').onclick();
  let release;
  x.window.campaign.presetRegistry = (id) =>
    new Promise(
      (resolve) => (release = () => resolve({ ok: true, value: x.store.presetRegistry(id) })),
    );
  const opening = x.ui.openPresetSettings(other.id);
  await settle();
  assert.equal(x.el('preset-form').hidden, true);
  assert.equal(x.el('preset-selection').children.length, 0);
  assert.match(x.el('preset-effective').textContent, /geladen/);
  assert.doesNotMatch(x.el('preset-effective').textContent, /Nur Wald/);
  assert.equal(x.el('preset-assign').disabled, true);
  release();
  await opening;
  await settle();
  assert.equal(x.el('preset-context').value, other.id);
  assert.equal(x.el('preset-form').hidden, false);
  assert.match(x.el('preset-effective').textContent, /Systempreset/);
  assert.equal(x.calls.length, 2);
});

test('updates cannot bypass an unfinished settings preset', async (t) => {
  const x = await fixture(t);
  await x.open(x.campaign.id);
  let opened = 0,
    closed = 0,
    focused = false;
  x.el('application-trigger').focus = () => {
    focused = true;
  };
  x.window.addEventListener('generator-registry-changed', () => closed++);
  x.document.addEventListener('saltmarcher-open-updates', () => {
    assert.equal(x.el('preset-manager').open, false);
    assert.equal(focused, true);
    assert.equal(closed, opened + 1);
    opened++;
  });
  x.el('settings-updates').onclick();
  assert.equal(opened, 1);
  assert.equal(closed, 1);
  await x.open(x.campaign.id);
  focused = false;
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Ungespeichert');
  x.el('settings-updates').onclick();
  assert.equal(opened, 1);
  assert.match(x.el('preset-status').textContent, /zuerst speichern/);
  assert.equal(x.el('preset-name').value, 'Ungespeichert');
  assert.equal(x.el('preset-manager').open, true);
  assert.equal(closed, 1);
  await x.save();
  x.el('settings-updates').onclick();
  assert.equal(opened, 2);
});

test('updates wait for registry reads and unresolved preset commands', async (t) => {
  const x = await fixture(t);
  let opened = 0,
    resolveRead,
    rejectSave;
  x.document.addEventListener('saltmarcher-open-updates', () => opened++);
  x.window.campaign.presetRegistry = (id) =>
    new Promise((resolve) => {
      resolveRead = () => resolve({ ok: true, value: x.store.presetRegistry(id) });
    });
  const opening = x.ui.openPresetSettings(x.campaign.id);
  await settle();
  x.el('settings-updates').onclick();
  assert.equal(opened, 0);
  assert.equal(x.el('preset-manager').open, true);
  resolveRead();
  await opening;
  x.el('preset-copy').onclick();
  x.edit('preset-name', 'Ungeklärter Auftrag');
  x.window.campaign.presetCommand = async (command) => {
    x.store.presetCommand(command);
    return new Promise((_resolve, reject) => {
      rejectSave = reject;
    });
  };
  const saving = x.save();
  await settle();
  x.el('settings-updates').onclick();
  assert.equal(opened, 0);
  assert.equal(x.el('preset-manager').open, true);
  rejectSave(new Error('Antwort nach Commit verloren'));
  await saving;
  x.el('settings-updates').onclick();
  assert.equal(opened, 0);
  assert.equal(x.el('preset-manager').open, true);
  assert.equal(x.el('preset-name').value, 'Ungeklärter Auftrag');
  assert.equal(x.el('preset-check').hidden, false);
});
