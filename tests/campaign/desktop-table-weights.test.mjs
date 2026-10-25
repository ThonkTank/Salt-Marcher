import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/table-weights-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/campaign/generation-ui.ts'],
  outfile: '.build/table-weights-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/table-weights-store.cjs');
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
async function fixture(
  t,
  kind,
  configure = () => {},
  description = 'Rohtext',
  legacyWeights = null,
) {
  const root = mkdtempSync(path.join(tmpdir(), 'table-weights-')),
    store = new CampaignStore(path.join(root, 'campaign.sqlite')),
    campaign = store.create('Tabellengewichte'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  const table =
    kind === 'encounter'
      ? {
          id: randomUUID(),
          revision: 0,
          scope: 'campaign',
          name: 'Wachen',
          description,
          entries: [
            { creatureId: 'guard', weight: '1' },
            { creatureId: 'goblin', weight: '1' },
          ],
          habitats: [],
          time: 'any',
          lootTableId: null,
          trashed: false,
        }
      : {
          id: randomUUID(),
          revision: 0,
          name: 'Beute',
          description: 'Rohtext',
          rolls: 1,
          entries: ['A', 'B'].map((name) => ({
            id: randomUUID(),
            weight: '1',
            minimum: 1,
            maximum: 1,
            item: { name, valueGold: '0', category: 'other' },
          })),
          trashed: false,
        };
  store.executeGeneration(
    command({
      kind: kind === 'encounter' ? 'table-save' : 'loot-save',
      table,
      expectedRevision: null,
    }),
  );
  if (legacyWeights) {
    const stored = store.encounterTables(w.token, true)[0];
    stored.entries.forEach((e, i) => (e.weight = legacyWeights[i]));
    const payload = JSON.stringify(stored);
    store.db
      .prepare('UPDATE encounter_table SET payload=?,checksum=? WHERE id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), table.id);
  }
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  const selectPrototype = window.HTMLSelectElement.prototype,
    selectValue = Object.getOwnPropertyDescriptor(selectPrototype, 'value');
  Object.defineProperty(selectPrototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  Object.assign(globalThis, { window, document });
  t.after(() => {
    Object.defineProperty(selectPrototype, 'value', selectValue);
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const result = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  window.campaign = {
    creature: async (id) => ({ ok: true, value: { id, name: id, xp: 25, challengeRating: '1/8' } }),
    executeGeneration: async (c) => result(() => store.executeGeneration(c)),
  };
  for (const method of [
    'encounterTables',
    'lootTables',
    'generatorRegistry',
    'generationRuns',
    'generationSources',
    'npcs',
  ])
    window.campaign[method] = async (...args) => result(() => store[method](...args));
  configure(window.campaign);
  delete require.cache[require.resolve('../../.build/table-weights-ui.cjs')];
  const ui = require('../../.build/table-weights-ui.cjs'),
    messages = [];
  let selectedCreature = null;
  ui.initGeneration((...args) => messages.push(args), {
    plan: async () => null,
    creature: () => selectedCreature,
    filters: () => ({}),
    info: () => null,
    accept: async () => {},
  });
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
  }
  ui.activateGeneration(w);
  await ui.refreshGeneration();
  const el = (id) => document.getElementById(id),
    prefix = kind === 'encounter' ? 'table' : 'loot',
    read = () =>
      store[kind === 'encounter' ? 'encounterTables' : 'lootTables'](w.token, true).find(
        (t) => t.id === table.id,
      );
  el(kind === 'encounter' ? 'encounter-table-list' : 'loot-table-list').value = table.id;
  el(kind === 'encounter' ? 'encounter-table-open' : 'loot-table-open').click();
  await settle();
  const entries = el(prefix + '-entries'),
    inputs =
      kind === 'encounter'
        ? [...entries.querySelectorAll('input')]
        : [...entries.querySelectorAll('label')]
            .filter((l) => l.firstChild.textContent === 'Gewicht')
            .map((l) => l.querySelector('input'));
  return {
    store,
    w,
    table,
    ui,
    el,
    inputs,
    messages,
    read,
    select: (id) => {
      selectedCreature = { id, name: id, xp: 25, challengeRating: '1/8' };
      ui.generationCreature(selectedCreature);
    },
    shares: () =>
      kind === 'encounter'
        ? [...entries.querySelectorAll('.table-share')].map((n) => n.textContent)
        : [...entries.querySelectorAll('legend')].map((n) => n.textContent.split(' · ')[1]),
    edit: (i, text) => {
      inputs[i].value = text;
      inputs[i].oninput();
    },
    save: async () => {
      el(prefix + '-form').onsubmit({ preventDefault() {} });
      await settle();
    },
  };
}
for (const kind of ['encounter', 'loot'])
  test(
    kind +
      ' shares follow every raw edit, invalidate together and recover without replacing inputs',
    async (t) => {
      const x = await fixture(t, kind);
      assert.deepEqual(x.shares(), ['50,00 %', '50,00 %']);
      x.edit(0, '3');
      assert.deepEqual(x.shares(), ['75,00 %', '25,00 %']);
      x.edit(0, '-');
      assert.deepEqual(x.shares(), ['Ungültig', 'Ungültig']);
      assert.equal(x.inputs[0].value, '-');
      assert.deepEqual(
        x.read().entries.map((e) => e.weight),
        ['1', '1'],
      );
      x.edit(0, '0,5');
      assert.deepEqual(x.shares(), ['33,33 %', '66,67 %']);
      assert.equal(x.inputs[0].isConnected, true);
      assert.equal(x.inputs[0].value, '0,5');
      if (kind === 'encounter') {
        assert.equal(x.el('table-save').disabled, true);
        await x.save();
        assert.deepEqual(
          x.read().entries.map((e) => e.weight),
          ['1', '1'],
        );
        x.edit(0, '2');
        assert.equal(x.el('table-save').disabled, false);
      }
      await x.save();
      assert.deepEqual(
        x.read().entries.map((e) => e.weight),
        [kind === 'encounter' ? '2' : '0.5', '1'],
      );
      assert.deepEqual(
        x.messages.filter((m) => m[1]),
        [],
      );
    },
  );

test('table draft keeps core edits first, blocks unusable saves and returns to the saved selection', async (t) => {
  const x = await fixture(t, 'encounter');
  assert.equal(x.el('table-options').open, false);
  assert.equal(x.el('table-save').disabled, false);
  const order = [...x.el('table-form').children].map((n) => n.id);
  assert.ok(order.indexOf('table-entries') < order.indexOf('table-options'));
  x.edit(0, '-');
  assert.equal(x.el('table-save').disabled, true);
  await x.save();
  assert.deepEqual(
    x.read().entries.map((e) => e.weight),
    ['1', '1'],
  );
  x.edit(0, '0');
  x.edit(1, '0');
  assert.equal(x.el('table-save').disabled, true);
  assert.match(x.el('table-save-status').textContent, /1 bis 10/);
  x.edit(1, '1');
  x.edit(0, '3');
  assert.equal(x.el('table-save').disabled, false);
  await x.save();
  assert.equal(x.el('encounter-table-list').value, x.read().id);
  assert.equal(x.el('encounter-table-open').disabled, false);
  x.el('encounter-table-new').click();
  await settle();
  assert.equal(x.el('table-save').disabled, true);
  assert.equal(x.el('table-scope').value, 'campaign');
  assert.equal(x.el('table-add-creature').disabled, true);
  x.el('table-name').value = 'Waldsaum';
  x.el('table-name').oninput();
  assert.equal(x.el('table-save').disabled, true);
  assert.match(x.el('table-save-status').textContent, /Kreatur/);
  x.select('goblin');
  assert.equal(x.el('table-add-creature').disabled, false);
  x.el('table-add-creature').click();
  assert.equal(x.el('table-save').disabled, false);
  assert.equal(x.el('table-add-creature').disabled, true);
  assert.match(x.el('table-add-creature').textContent, /Bereits/);
  x.el('table-entries').querySelector('button').click();
  assert.equal(x.el('table-save').disabled, true);
  assert.equal(x.el('table-add-creature').disabled, false);
  await x.save();
  assert.equal(x.el('table-manager').open, true);
  x.el('table-add-creature').click();
  x.el('table-name').value = '  ';
  x.el('table-name').oninput();
  assert.equal(x.el('table-save').disabled, true);
  await x.save();
  assert.equal(x.el('table-manager').open, true);
});

test('encounter table opens before optional creature names arrive and remains editable after a name lookup fails', async (t) => {
  let release;
  const x = await fixture(t, 'encounter', (api) => {
    const read = api.creature;
    api.creature = (id) =>
      id === 'guard' ? new Promise((resolve) => (release = resolve)) : read(id);
  });
  assert.equal(
    x.el('table-manager').open,
    true,
    'a display-name read must not block the table draft',
  );
  assert.ok(release);
  assert.equal(x.inputs.length, 2);
  x.edit(0, '3');
  const input = x.inputs[0];
  release({ ok: false, error: 'Kreaturkatalog vorübergehend nicht lesbar' });
  await settle();
  assert.equal(input.isConnected, true);
  assert.equal(input.value, '3');
  assert.equal(x.el('table-name').value, 'Wachen');
  assert.equal(x.el('table-description').value, 'Rohtext');
  assert.match(x.el('table-entries').textContent, /guard.*Name nicht verfügbar/);
  assert.match(x.el('table-entries').textContent, /goblin/);
  x.el('table-entries').querySelector('button').click();
  await x.save();
  assert.equal(x.el('table-manager').open, false);
  assert.deepEqual(x.read().entries, [{ creatureId: 'goblin', weight: '1' }]);
  assert.equal(x.read().description, 'Rohtext');
  assert.equal(x.read().revision, 2);
  assert.deepEqual(
    x.messages.filter((m) => m[1]),
    [],
  );
});

test('closing an encounter table while names load leaves a newer table draft untouched', async (t) => {
  let release;
  const x = await fixture(t, 'encounter', (api) => {
    api.creature = () => new Promise((resolve) => (release = resolve));
  });
  assert.equal(x.el('table-manager').open, true);
  x.el('table-close').click();
  assert.equal(x.el('table-manager').open, false);
  x.el('encounter-table-new').click();
  await settle();
  x.el('table-name').value = 'Neuer Entwurf';
  x.el('table-name').oninput();
  release({ ok: true, value: { id: 'guard', name: 'Alte Wache' } });
  await settle();
  assert.equal(x.el('table-manager').open, true);
  assert.equal(x.el('table-name').value, 'Neuer Entwurf');
  assert.equal(x.el('table-entries').querySelectorAll('input').length, 0);
  assert.doesNotMatch(x.el('table-entries').textContent, /Alte Wache/);
  assert.equal(x.read().revision, 1);
});

test('an existing encounter table keeps its scope while every new draft can explicitly choose its scope', async (t) => {
  const x = await fixture(t, 'encounter');
  assert.equal(x.el('table-scope').value, 'campaign');
  assert.equal(x.el('table-scope').disabled, true);
  assert.match(x.el('table-scope-help').textContent, /Neuanlage|neue Tabelle/);
  x.el('table-close').click();
  x.el('encounter-table-new').click();
  await settle();
  assert.equal(x.el('table-scope').value, 'campaign');
  assert.equal(x.el('table-scope').disabled, false);
  x.el('table-scope').value = 'installation';
  x.el('table-scope').oninput();
  x.el('table-name').value = 'Öffentlich gewählte Wachen';
  x.el('table-name').oninput();
  x.select('goblin');
  x.el('table-add-creature').click();
  await x.save();
  const created = x.store
    .encounterTables(x.w.token, true)
    .find((t) => t.name === 'Öffentlich gewählte Wachen');
  assert.equal(created.scope, 'installation');
  x.el('encounter-table-list').value = created.id;
  x.el('encounter-table-open').click();
  await settle();
  assert.equal(x.el('table-scope').disabled, true);
  assert.equal(x.el('table-scope').value, 'installation');
});

test('editing only table metadata preserves description bytes normalized by the browser control', async (t) => {
  const description = ' Originalprosa\r\nZweite Zeile\r\n',
    x = await fixture(t, 'encounter', () => {}, description);
  x.el('table-description').value = description.replaceAll('\r\n', '\n');
  x.el('table-name').value = 'Neuer Name';
  x.el('table-name').oninput();
  x.el('table-habitats').value = 'Forest';
  x.el('table-habitats').oninput();
  x.el('table-time').value = 'night';
  x.el('table-time').oninput();
  await x.save();
  assert.equal(x.read().name, 'Neuer Name');
  assert.equal(x.read().description, description);
  assert.deepEqual(x.read().habitats, ['Forest']);
  assert.equal(x.read().time, 'night');
});

for (const transport of [false, true])
  test(`a confirmed encounter table save survives a later world-source ${transport ? 'transport' : 'storage'} read failure`, async (t) => {
    const x = await fixture(t, 'encounter'),
      readSources = window.campaign.generationSources,
      execute = window.campaign.executeGeneration,
      calls = [];
    window.campaign.executeGeneration = async (c) => {
      calls.push(structuredClone(c));
      return execute(c);
    };
    window.campaign.generationSources = async () => {
      if (transport) throw new Error('World sources unavailable');
      return { ok: false, error: 'World sources unavailable' };
    };
    x.el('table-name').value = 'Bestätigte Wachen';
    x.el('table-name').oninput();
    await x.save();
    assert.equal(x.read().revision, 2);
    assert.equal(x.read().name, 'Bestätigte Wachen');
    assert.equal(x.el('table-manager').open, false);
    assert.equal(calls.length, 1);
    assert.equal(x.el('encounter-table-list').value, x.read().id);
    assert.ok(
      x.messages.some(
        (m) => m[0].includes('bestätigt') && m[0].includes('World sources unavailable'),
      ),
    );
    assert.equal(x.el('generation-source-status').hidden, false);
    assert.match(
      x.el('generation-source-status').textContent,
      /bestätigt.*World sources unavailable/,
    );
    window.campaign.generationSources = readSources;
    await x.ui.refreshGeneration();
    assert.equal(x.el('generation-source-status').hidden, true);
    x.el('encounter-table-open').click();
    await settle();
    assert.equal(x.el('table-name').value, 'Bestätigte Wachen');
    x.el('table-name').value = 'Weiter bearbeitet';
    x.el('table-name').oninput();
    await x.save();
    assert.equal(x.read().revision, 3);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].action.expectedRevision, 2);
    assert.equal(x.read().description, 'Rohtext');
  });

test('an unconfirmed table save keeps the draft open and reports the write failure', async (t) => {
  const x = await fixture(t, 'encounter');
  window.campaign.executeGeneration = async () => ({ ok: false, error: 'Write rejected' });
  x.el('table-name').value = 'Noch offen';
  x.el('table-name').oninput();
  await x.save();
  assert.equal(x.read().revision, 1);
  assert.equal(x.el('table-manager').open, true);
  assert.equal(x.el('table-name').value, 'Noch offen');
  assert.ok(x.messages.some((m) => m[0] === 'Write rejected'));
  assert.ok(!x.messages.some((m) => m[0].includes('bestätigt')));
});
test('a faction creates through the shared table manager and adopts only the confirmed table', async (t) => {
  const x = await fixture(t, 'encounter');
  x.el('table-close').click();
  const id = randomUUID(),
    command = (action) => ({
      commandId: randomUUID(),
      token: x.w.token,
      campaignId: x.w.campaign.id,
      action,
    }),
    note = {
      version: 1,
      id,
      revision: 1,
      kind: 'faction',
      title: 'Wachenfraktion',
      readAloud: ' Vorlesen\r\n',
      gmNotes: ' Geheim\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  x.store.changePreparation({
    ...command(null),
    change: { kind: 'note', note, expectedRevision: null },
  });
  x.store.executeGeneration(
    command({
      kind: 'source-save',
      source: {
        kind: 'faction',
        id,
        revision: 0,
        tableIds: [x.table.id],
        factionIds: [],
        stock: [{ creatureId: 'guard', limit: 2 }],
        disposition: -2,
      },
      expectedRevision: null,
    }),
  );
  await x.ui.refreshGeneration();
  x.el('source-faction').value = id;
  x.el('source-faction-edit').click();
  const raw = x.el('source-disposition'),
    stock = () => x.el('source-stock').querySelector('input[data-creature-id="guard"]');
  raw.value = '-01';
  raw.oninput();
  stock().value = '05';
  stock().oninput();
  x.el('source-table-new').click();
  await settle();
  assert.equal(x.el('table-manager').open, true);
  assert.equal(x.el('world-source-manager').open, true);
  assert.equal(x.el('table-scope').value, 'campaign');
  x.el('table-name').value = 'Verwerfen';
  x.el('table-name').oninput();
  x.el('table-close').click();
  assert.equal(x.el('generation-discard').open, true);
  x.el('generation-discard-keep').click();
  assert.equal(x.el('table-name').value, 'Verwerfen');
  x.el('table-close').click();
  x.el('generation-discard-confirm').click();
  assert.equal(x.el('table-manager').open, false);
  assert.equal(x.el('world-source-manager').open, true);
  assert.equal(x.el('source-primary').value, x.table.id);
  assert.equal(raw.value, '-01');
  assert.equal(stock().value, '05');
  x.el('source-table-new').click();
  await settle();
  x.el('table-name').value = 'Neue Haupttabelle';
  x.el('table-name').oninput();
  x.el('table-scope').value = 'installation';
  x.el('table-scope').oninput();
  x.select('guard');
  x.el('table-add-creature').click();
  const readSources = window.campaign.generationSources;
  window.campaign.generationSources = async () => ({
    ok: false,
    error: 'Post-save source read unavailable',
  });
  await x.save();
  window.campaign.generationSources = readSources;
  const created = x.store
    .encounterTables(x.w.token, true)
    .find((t) => t.name === 'Neue Haupttabelle');
  assert.equal(created.scope, 'installation');
  assert.equal(created.revision, 1);
  assert.equal(x.el('source-primary').value, created.id);
  assert.equal(x.el('world-source-manager').open, true);
  assert.equal(raw.value, '-01');
  assert.equal(stock().value, '05');
  const current = () => x.store.generationSources(x.w.token).sources.find((s) => s.id === id);
  assert.equal(current().revision, 1);
  assert.deepEqual(current().tableIds, [x.table.id]);
  x.el('world-source-form').onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(x.el('world-source-manager').open, false);
  assert.equal(current().revision, 2);
  assert.deepEqual(current().tableIds, [created.id]);
  assert.deepEqual(current().stock, [{ creatureId: 'guard', limit: 5 }]);
  assert.equal(current().disposition, -1);
  assert.equal(
    x.store.preparation(x.w.token, '').notes.find((r) => r.note.id === id).note.gmNotes,
    ' Geheim\r\n',
  );
});

for (const committed of [false, true])
  test(`unknown encounter table save ${committed ? 'after' : 'before'} commit keeps its draft locked until the original request is resolved`, async (t) => {
    const x = await fixture(t, 'encounter'),
      execute = window.campaign.executeGeneration,
      calls = [];
    window.campaign.executeGeneration = async (c) => {
      calls.push(structuredClone(c));
      if (calls.length === 1) {
        if (committed) await execute(c);
        throw new Error('Save reply lost');
      }
      return execute(c);
    };
    x.el('table-name').value = 'Wachen bestätigt';
    x.el('table-name').oninput();
    await x.save();
    assert.equal(x.read().revision, committed ? 2 : 1);
    assert.equal(x.el('table-manager').open, true);
    assert.equal(x.el('table-name').disabled, true);
    assert.equal(x.el('table-save').disabled, true);
    x.el('table-close').click();
    assert.equal(x.el('table-manager').open, true);
    assert.equal(Boolean(x.el('generation-discard').open), false);
    await x.save();
    assert.equal(calls.length, 1);
    assert.equal(await x.ui.flushGeneration(), false);
    assert.equal(x.el('generation-write-recovery').hidden, false);
    assert.match(x.el('generation-write-recovery').textContent, /unbekannt/);
    x.el('generation-write-retry').click();
    x.el('generation-write-retry').click();
    await settle();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], calls[0]);
    assert.equal(x.read().revision, 2);
    assert.equal(x.read().name, 'Wachen bestätigt');
    assert.equal(x.el('table-manager').open, false);
    assert.equal(x.el('generation-write-recovery').hidden, true);
    assert.equal(x.read().description, 'Rohtext');
    x.el('encounter-table-open').click();
    await settle();
    x.el('table-name').value = 'Neue Änderung';
    x.el('table-name').oninput();
    await x.save();
    assert.equal(x.read().revision, 3);
    assert.notEqual(calls[2].commandId, calls[0].commandId);
  });

test('activation revokes an unresolved old table command without retrying it in the new context', async (t) => {
  const x = await fixture(t, 'encounter'),
    execute = window.campaign.executeGeneration;
  let calls = 0;
  window.campaign.executeGeneration = async () => {
    calls++;
    throw new Error('No response');
  };
  x.el('table-name').value = 'Alter Entwurf';
  x.el('table-name').oninput();
  await x.save();
  assert.equal(x.el('generation-write-recovery').hidden, false);
  x.ui.activateGeneration(x.w);
  await settle();
  assert.equal(x.el('generation-write-recovery').hidden, true);
  assert.equal(x.el('table-manager').open, false);
  assert.equal(calls, 1);
  assert.equal(x.read().revision, 1);
  window.campaign.executeGeneration = execute;
  x.el('encounter-table-list').value = x.table.id;
  x.el('encounter-table-open').click();
  await settle();
  assert.equal(x.el('table-name').value, 'Wachen');
  assert.equal(x.el('table-name').disabled, false);
});

test('legacy encounter weights remain editable without rounding, while replacements obey the authoring range', async (t) => {
  const x = await fixture(t, 'encounter', () => {}, 'Altbestand', ['0000,500000000001', '20']);
  assert.equal(x.el('table-save').disabled, false);
  x.el('table-name').value = 'Umbenannter Altbestand';
  x.el('table-name').oninput();
  await x.save();
  assert.deepEqual(
    x.read().entries.map((e) => e.weight),
    ['0000,500000000001', '20'],
  );
  x.el('encounter-table-open').click();
  await settle();
  const inputs = x.el('table-entries').querySelectorAll('input');
  for (const invalid of ['0', '0.5', '11', '-1']) {
    inputs[0].value = invalid;
    inputs[0].oninput();
    assert.equal(x.el('table-save').disabled, true);
    await x.save();
    assert.equal(x.read().revision, 2);
  }
  inputs[0].value = '10';
  inputs[0].oninput();
  assert.equal(x.el('table-save').disabled, false);
  await x.save();
  assert.deepEqual(
    x.read().entries.map((e) => e.weight),
    ['10', '20'],
  );
});
