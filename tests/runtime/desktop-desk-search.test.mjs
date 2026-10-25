import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [entry, out] of [
  ['src/app/storage/store.ts', 'desk-search-store'],
  ['src/app/runtime/scene-desk-ui.ts', 'desk-search-ui'],
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
  for (let i = 0; i < 60; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'Expected search state did not arrive');
}
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'desk-search-')),
    { CampaignStore } = require('../../.build/desk-search-store.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite');
  const campaign = store.create('Suche'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  for (const prefix of ['Hafen', 'Wald'])
    for (let i = 0; i < 65; i++)
      store.changePreparation({
        ...command(null),
        change: {
          kind: 'note',
          expectedRevision: null,
          note: {
            version: 1,
            id: randomUUID(),
            revision: 1,
            kind: 'npc',
            title: prefix + ' ' + String(i).padStart(2, '0'),
            readAloud: '',
            gmNotes: 'Original\r\n',
            relations: [],
            creatureId: null,
            deleted: false,
          },
        },
      });
  const saved = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: 'world', writable: true });
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const calls = [],
    waiting = [];
  let hold = false;
  window.campaign = {
    sceneDesk: async (t, id) => response(() => store.sceneDesk(t, id)),
    searchDesk: async (t, kind, query, offset) => {
      calls.push({ kind, query, offset });
      const result = response(() => store.searchDesk(t, kind, query, offset));
      if (hold) {
        hold = false;
        return new Promise((resolve) => waiting.push(() => resolve(result)));
      }
      return result;
    },
    deskContent: async (t, ref) => response(() => store.deskContent(t, ref)),
    preparationDraft: async (t, kind, id) => response(() => store.preparationDraft(t, kind, id)),
  };
  delete require.cache[require.resolve('../../.build/desk-search-ui.cjs')];
  const ui = require('../../.build/desk-search-ui.cjs');
  ui.initSceneDesk(
    () => {},
    async () => {},
    async () => {},
  );
  ui.sceneDeskContext(w, scene);
  await tick();
  await tick();
  const el = (id) => document.getElementById(id),
    query = (text) => {
      el('desk-search').value = text;
      el('desk-search').dispatchEvent(new window.Event('input'));
    },
    area = (kind) => {
      el('desk-search-kind').value = kind;
      el('desk-search-kind').dispatchEvent(new window.Event('change'));
    },
    submit = () => el('desk-search-form').onsubmit({ preventDefault() {} }),
    titles = () =>
      Array.from(
        document.querySelectorAll('#desk-results > div button:first-child'),
        (b) => b.textContent,
      );
  return {
    store,
    ui,
    w,
    scene,
    el,
    query,
    area,
    submit,
    titles,
    calls,
    hold: () => {
      hold = true;
    },
    release: () => waiting.shift()(),
    waiting,
    cleanup() {
      ui.sceneDeskContext(null, null);
      Object.assign(globalThis, saved);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('query changes restart pagination from zero and retain the open editor', async () => {
  const x = await fixture();
  try {
    x.query('Hafen');
    x.submit();
    await until(() => x.titles().length === 40);
    x.el('desk-results').querySelector('button').onclick();
    await until(() => !x.el('desk-editor').hidden);
    const title = x.el('desk-fields').querySelector('input'),
      editor = x.el('desk-fields').firstChild;
    x.query('Wald');
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('desk-more').hidden, true);
    assert.equal(x.el('desk-fields').firstChild, editor);
    assert.equal(title.value, 'Hafen 00');
    x.el('desk-more').onclick();
    assert.equal(x.calls.length, 1);
    x.submit();
    await until(() => x.titles().length === 40);
    assert.equal(x.calls[1].offset, 0);
    x.el('desk-more').onclick();
    await until(() => x.titles().length === 65);
    assert.equal(new Set(x.titles()).size, 65);
    assert(x.titles().every((t) => t.startsWith('NPC · Wald')));
    assert.match(x.el('desk-search-status').textContent, /65 Treffer/);
  } finally {
    x.cleanup();
  }
});
test('a delayed search cannot restore results after text or search area changes', async () => {
  const x = await fixture();
  try {
    x.query('Hafen');
    x.hold();
    x.submit();
    await until(() => x.waiting.length === 1);
    x.query('Wald');
    x.release();
    await tick();
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('desk-more').hidden, true);
    x.hold();
    x.submit();
    await until(() => x.waiting.length === 1);
    x.area('creature');
    x.release();
    await tick();
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('desk-more').hidden, true);
    assert.match(x.el('desk-search-status').textContent, /Suche geändert/);
  } finally {
    x.cleanup();
  }
});
test('rapid More clicks load a page once and an old group reply cannot populate a new desk', async () => {
  const x = await fixture();
  try {
    x.query('Hafen');
    x.submit();
    await until(() => x.titles().length === 40);
    x.hold();
    x.el('desk-more').onclick();
    x.el('desk-more').onclick();
    await until(() => x.waiting.length === 1);
    assert.equal(x.calls.length, 2);
    assert.equal(x.el('desk-more').disabled, true);
    x.release();
    await until(() => x.titles().length === 65);
    assert.equal(new Set(x.titles()).size, 65);
    x.hold();
    x.submit();
    await until(() => x.waiting.length === 1);
    x.ui.sceneDeskContext(x.w, { ...x.scene, id: 'another-scene' });
    x.release();
    await tick();
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('desk-more').hidden, true);
  } finally {
    x.cleanup();
  }
});
test('failed replacement searches do not leave actionable results from the previous query', async () => {
  const x = await fixture();
  try {
    x.query('Hafen');
    x.submit();
    await until(() => x.titles().length === 40);
    x.query('Wald');
    x.el('desk-search-kind').value = 'invalid';
    x.submit();
    await until(() => x.el('desk-search-status').textContent.includes('fehlgeschlagen'));
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('desk-more').hidden, true);
    x.area('world');
    x.submit();
    await until(() => x.titles().length === 40);
    assert(x.titles().every((t) => t.startsWith('NPC · Wald')));
  } finally {
    x.cleanup();
  }
});
test('a failed continuation retains its page cursor for an explicit retry', async () => {
  const x = await fixture();
  try {
    x.query('Wald');
    x.submit();
    await until(() => x.titles().length === 40);
    const original = window.campaign.searchDesk;
    window.campaign.searchDesk = async () => ({ ok: false, error: 'Lesen unterbrochen' });
    x.el('desk-more').onclick();
    await until(() => x.el('desk-search-status').textContent.includes('fehlgeschlagen'));
    assert.equal(x.titles().length, 40);
    assert.equal(x.el('desk-more').hidden, false);
    assert.equal(x.el('desk-more').disabled, false);
    window.campaign.searchDesk = original;
    x.el('desk-more').onclick();
    await until(() => x.titles().length === 65);
    assert.equal(x.calls.at(-1).offset, 40);
    assert.equal(new Set(x.titles()).size, 65);
  } finally {
    x.cleanup();
  }
});

test('desk edits preserve exact GM prose and confirm under their original real-store revision', async () => {
  const x = await fixture();
  try {
    const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    };
    window.campaign.keepDeskDraft = async (token, d, expected) =>
      response(() => x.store.keepDeskDraft(token, d, expected));
    window.campaign.changePreparationContent = async (command) =>
      response(() => x.store.changePreparationContent(command));
    x.query('Hafen');
    x.submit();
    await until(() => x.titles().length === 40);
    x.el('desk-results').querySelector('button').onclick();
    await until(() => !x.el('desk-editor').hidden);
    const field = x.el('desk-fields').querySelector('[aria-label="GM-Notizen"]');
    field.value = '  Authored notes\r\nDo not normalize.\r\n';
    field.oninput();
    window.campaign.changePreparation = async () => {
      throw Error('Full preparation must not be needed for a desk edit');
    };
    window.campaign.deskContent = async () => {
      throw Error('A second content read must not be needed after a targeted acknowledgement');
    };
    assert.equal(await x.ui.flushSceneDesk(), true);
    const row = x.store.db
        .prepare(
          "SELECT * FROM world_note WHERE campaign_id=? AND json_extract(payload,'$.title')='Hafen 00'",
        )
        .get(x.w.campaign.id),
      note = JSON.parse(row.payload);
    assert.equal(row.revision, 2);
    assert.equal(note.gmNotes, '  Authored notes\r\nDo not normalize.\r\n');
    assert.deepEqual(note.relations, []);
    assert.equal(note.readAloud, '');
    assert.equal(x.store.preparationDraft(x.w.token, 'note', row.id), null);
  } finally {
    x.cleanup();
  }
});

test('matching note excerpts distinguish equal titles without opening their editors or interpreting markup', async () => {
  const x = await fixture();
  try {
    const keyword = 'Bernsteinharz',
      texts = [
        'Mara sah den Boten mit Bernsteinharz zum Wachhaus gehen.',
        'Rasmus verkauft Bernsteinharz, hat den Boten aber nicht gesehen.',
      ];
    for (const [i, text] of texts.entries())
      x.store.changePreparation({
        commandId: randomUUID(),
        token: x.w.token,
        campaignId: x.w.campaign.id,
        change: {
          kind: 'note',
          expectedRevision: null,
          note: {
            version: 1,
            id: randomUUID(),
            revision: 1,
            kind: 'npc',
            title: 'Brückenspuren',
            readAloud: '',
            gmNotes:
              'Vorlauf '.repeat(60) +
              '😀 ' +
              text +
              ' <img src=x onerror=alert(1)> ' +
              'Nachlauf '.repeat(60),
            relations: [],
            creatureId: null,
            deleted: false,
          },
        },
      });
    let reads = 0;
    const read = window.campaign.deskContent;
    window.campaign.deskContent = (...args) => {
      reads++;
      return read(...args);
    };
    const before = x.store.db.serialize();
    x.query(keyword);
    x.submit();
    await until(() => x.titles().length === 2);
    const previews = [...x.el('desk-results').querySelectorAll('.desk-search-preview')];
    assert.equal(previews.length, 2);
    assert.ok(previews.every((p) => p.textContent.includes(keyword)));
    assert.ok(previews.some((p) => p.textContent.includes('zum Wachhaus')));
    assert.ok(previews.some((p) => p.textContent.includes('nicht gesehen')));
    assert.equal(x.el('desk-results').querySelector('img'), null);
    assert.equal(reads, 0);
    assert.ok(x.store.db.serialize().equals(before));
    assert.ok(previews.every((p) => Array.from(p.textContent).length < 225));
  } finally {
    x.cleanup();
  }
});

test('place sections and encounter notes produce readable excerpts while damaged and trashed notes do not', async () => {
  const x = await fixture();
  try {
    const command = { commandId: randomUUID(), token: x.w.token, campaignId: x.w.campaign.id },
      id = randomUUID();
    x.store.changePreparation({
      ...command,
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          id,
          name: 'Wachhaus',
          type: 'poi',
          sections: [
            {
              id: randomUUID(),
              title: 'Spuren',
              markdown: 'Unter den Dielen liegt Bernsteinharz.',
            },
          ],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
    const notes = x.store.searchDesk(x.w.token, 'world', 'Bernsteinharz', 0);
    assert.equal(notes.entries.length, 1);
    assert.deepEqual(notes.entries[0].preview, {
      label: 'Spuren',
      text: 'Unter den Dielen liegt Bernsteinharz.',
    });
    const plan = x.store.saveEncounterPlan({
      ...command,
      commandId: randomUUID(),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 1,
        name: 'Patrouille',
        notes: 'Trägt eine Bernsteinharz-Kiste.',
        party: [],
        entries: [],
        sources: [],
        catalogHash: '',
      },
    });
    assert.deepEqual(
      x.store.searchDesk(x.w.token, 'encounter', 'Bernsteinharz', 0).entries[0].preview,
      { label: 'Encounter-Notiz', text: plan.notes },
    );
    const note = x.store.preparation(x.w.token).notes[0].note;
    x.store.changePreparation({
      ...command,
      commandId: randomUUID(),
      change: {
        kind: 'note',
        expectedRevision: note.revision,
        note: { ...note, gmNotes: 'Bernsteinharz in beschädigter Quelle' },
      },
    });
    x.store.db.prepare('UPDATE world_note SET checksum=? WHERE id=?').run('damaged', note.id);
    assert.equal(
      x.store
        .searchDesk(x.w.token, 'world', 'Bernsteinharz', 0)
        .entries.find((row) => row.ref.id === note.id).preview,
      undefined,
    );
    x.store.db.prepare('UPDATE world_note SET trashed=1 WHERE id=?').run(note.id);
    assert.equal(
      x.store
        .searchDesk(x.w.token, 'world', 'Bernsteinharz', 0)
        .entries.some((row) => row.ref.id === note.id),
      false,
    );
  } finally {
    x.cleanup();
  }
});
