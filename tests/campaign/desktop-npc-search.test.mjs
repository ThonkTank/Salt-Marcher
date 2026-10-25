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
  ['src/app/storage/store.ts', 'npc-search-store'],
  ['src/app/campaign/npc-ui.ts', 'npc-search-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const tick = () => new Promise((r) => setImmediate(r)),
  delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await delay(5);
  }
  assert(check(), 'Expected NPC search state');
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'npc-search-')),
    { CampaignStore } = require('../../.build/npc-search-store.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite'),
    campaign = store.create('NPC-Suche'),
    w = store.activate(campaign.id),
    npcs = [];
  for (const prefix of ['Hafen', 'Wald'])
    for (let i = 0; i < 65; i++) {
      const id = randomUUID(),
        name = prefix + ' ' + String(i).padStart(2, '0');
      npcs.push(
        store.executeNpc({
          commandId: randomUUID(),
          campaignId: campaign.id,
          token: w.token,
          expectedNoteRevision: null,
          expectedRecordRevision: 0,
          expectedActorRevision: null,
          expectedPositionRevision: null,
          npc: {
            id,
            name,
            creatureId: null,
            readAloud: i === 59 ? 'GrüneStiefel' : 'Beschreibung',
            gmNotes: i === 63 ? 'Zinnschlüssel' : 'Notiz',
            record: {
              id,
              revision: 0,
              factionId: null,
              modifier: 0,
              lifecycle: i === 64 ? 'defeated' : 'active',
              appearance: i === 62 ? 'Kupfermantel' : '',
              behavior: i === 61 ? 'FlüstertimSchlaf' : '',
              history: i === 60 ? 'AlterBrunnen' : '',
            },
            locationId: null,
            health: null,
          },
        }),
      );
    }
  const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLSelectElement: globalThis.HTMLSelectElement,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, HTMLSelectElement: window.HTMLSelectElement });
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
    reads = [],
    writes = [],
    messages = [];
  window.campaign = {};
  for (const key of [
    'generationSources',
    'npcPlanCalendar',
    'npcDrafts',
    'npc',
    'npcDraft',
    'keepNpcDraft',
    'discardNpcDraft',
  ])
    window.campaign[key] = async (...args) => response(() => store[key](...args));
  window.campaign.npcs = async (...args) => {
    reads.push(structuredClone(args[1]));
    return response(() => store.npcs(...args));
  };
  window.campaign.executeNpc = async (c) => {
    writes.push(c);
    return response(() => store.executeNpc(c));
  };
  delete require.cache[require.resolve('../../.build/npc-search-ui.cjs')];
  const ui = require('../../.build/npc-search-ui.cjs');
  ui.initNpcs(
    (text) => messages.push(text),
    async () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      value: select.id === 'npc-filter-life' ? 'all' : '',
      writable: true,
    });
  ui.activateNpcs(w);
  await ui.openNpcs();
  const el = (id) => document.getElementById(id),
    titles = () => [...el('npc-list').querySelectorAll('button')].map((b) => b.textContent),
    input = (text) => {
      el('npc-search').value = text;
      el('npc-search').dispatchEvent(new window.Event('input'));
    },
    submit = () => el('npc-search-form').onsubmit({ preventDefault() {} });
  return {
    store,
    w,
    ui,
    npcs,
    el,
    titles,
    input,
    submit,
    reads,
    writes,
    messages,
    async query(text) {
      input(text);
      submit();
      await until(
        () => el('npc-list').getAttribute('aria-busy') === 'false' && el('npc-list-status').hidden,
      );
    },
    async cleanup() {
      await ui.flushNpcs();
      ui.activateNpcs(w);
      Object.assign(globalThis, previous);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('query changes immediately invalidate old paging; both directions visit every matching NPC', async () => {
  const x = await fixture();
  try {
    await x.query('Hafen');
    x.input('Wald');
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('npc-more').disabled, true);
    x.el('npc-more').onclick();
    x.submit();
    await until(() => x.titles().length === 50);
    assert(x.titles().every((t) => t.startsWith('Wald ')));
    const titles = x.titles();
    x.el('npc-more').onclick();
    await until(() => x.titles().length === 15);
    titles.push(...x.titles());
    assert.equal(new Set(titles).size, 65);
    assert(titles.some((t) => t.startsWith('Wald 00')));
    assert(titles.some((t) => t.startsWith('Wald 64')));
    x.el('npc-previous').onclick();
    await until(() => x.titles().length === 50);
    assert(x.titles()[0].startsWith('Wald 00'));
    assert.equal(x.el('npc-previous').disabled, true);
  } finally {
    await x.cleanup();
  }
});
test('a failed next page retries the same offset and duplicate clicks cannot skip a page', async () => {
  const x = await fixture();
  try {
    await x.query('Wald');
    const original = window.campaign.npcs,
      held = deferred();
    let count = 0;
    window.campaign.npcs = async (...args) => {
      count++;
      return held.promise;
    };
    x.el('npc-more').onclick();
    await tick();
    x.el('npc-more').onclick();
    await tick();
    assert.equal(count, 1);
    held.resolve({ ok: false, error: 'Seite nicht lesbar' });
    await until(() => x.el('npc-list-status').getAttribute('role') === 'alert');
    assert.equal(x.el('npc-more').disabled, true);
    assert.deepEqual(x.messages, []);
    window.campaign.npcs = original;
    x.el('npc-list-retry').onclick();
    await until(() => x.titles().length === 15);
    assert.equal(x.reads.at(-1).offset, 50);
    assert(x.el('npc-page').textContent.startsWith('51–'));
    assert.equal(x.el('npc-list-status').hidden, true);
    assert.deepEqual(x.messages, []);
  } finally {
    await x.cleanup();
  }
});
test('a late response or error for the old query cannot replace or announce over the new query', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.npcs,
      held = deferred();
    window.campaign.npcs = async (...args) =>
      args[1].text === 'Hafen' ? held.promise : original(...args);
    x.input('Hafen');
    x.submit();
    await tick();
    x.input('Wald');
    x.submit();
    await until(() => x.titles().length === 50);
    held.resolve({ ok: false, error: 'Veralteter Suchfehler' });
    await tick();
    assert(x.titles().every((t) => t.startsWith('Wald ')));
    assert.deepEqual(x.messages, []);
    assert.equal(x.el('npc-list-status').hidden, true);
  } finally {
    await x.cleanup();
  }
});
test('search reads all authored profile prose and applies the same lifecycle filter', async () => {
  const x = await fixture();
  try {
    for (const [text, index] of [
      ['Zinnschlüssel', 63],
      ['KUPFERMANTEL', 62],
      ['FlüstertimSchlaf', 61],
      ['AlterBrunnen', 60],
      ['GrüneStiefel', 59],
    ]) {
      const result = x.store.npcs(x.w.token, {
        text,
        lifecycle: 'all',
        factionId: null,
        locationId: null,
        offset: 0,
      });
      assert.equal(result.total, 2);
      assert.deepEqual(
        new Set(result.rows.map((r) => r.id)),
        new Set([x.npcs[index].id, x.npcs[65 + index].id]),
      );
    }
    await x.query('Zinnschlüssel');
    assert.equal(x.titles().length, 2);
    x.el('npc-filter-life').value = 'defeated';
    x.el('npc-filter-life').dispatchEvent(new window.Event('change'));
    await until(() => x.el('npc-page').textContent === 'Keine passenden NSCs.');
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('npc-previous').disabled, true);
  } finally {
    await x.cleanup();
  }
});
test('searching and filtering do not publish or lose an incomplete NPC draft', async () => {
  const x = await fixture();
  try {
    x.el('npc-list').querySelector('button').onclick();
    await until(() => !x.el('npc-editor').hidden && !x.el('npc-name').disabled);
    x.el('npc-name').value = '';
    x.el('npc-gmNotes').value = 'Unfertig\r\n- Ring';
    x.el('npc-editor').oninput();
    await x.query('Wald');
    assert.equal(x.el('npc-name').value, '');
    assert.equal(x.el('npc-gmNotes').value, 'Unfertig\r\n- Ring');
    assert.equal(x.writes.length, 0);
    assert.equal(x.store.npcDraft(x.w.token, x.npcs[0].id).fields.gmNotes, 'Unfertig\r\n- Ring');
    assert.equal(x.store.npc(x.w.token, x.npcs[0].id).name, 'Hafen 00');
  } finally {
    await x.cleanup();
  }
});
test('refresh clamps a now-empty last page to the nearest remaining page', async () => {
  const x = await fixture();
  try {
    await x.query('Hafen');
    x.el('npc-more').onclick();
    await until(() => x.titles().length === 15);
    for (const n of x.npcs.slice(50, 65))
      x.store.changePreparation({
        commandId: randomUUID(),
        token: x.w.token,
        campaignId: x.w.campaign.id,
        change: { kind: 'note-trash', id: n.id, expectedRevision: n.noteRevision, trashed: true },
      });
    x.reads.length = 0;
    await x.ui.openNpcs(false);
    assert.deepEqual(
      x.reads.map((q) => q.offset),
      [50, 0],
    );
    assert.equal(x.titles().length, 50);
    assert(x.el('npc-page').textContent.startsWith('1–'));
    assert.equal(x.el('npc-more').disabled, true);
  } finally {
    await x.cleanup();
  }
});
test('composition waits for committed text; ordinary input then searches without a submit action', async () => {
  const x = await fixture();
  try {
    const start = x.reads.length;
    x.el('npc-search').dispatchEvent(new window.Event('compositionstart'));
    x.input('Wal');
    await delay(230);
    assert.equal(x.reads.length, start);
    x.el('npc-search').value = 'Wald';
    x.el('npc-search').dispatchEvent(new window.Event('compositionend'));
    await until(() => x.titles().length === 50);
    assert.equal(x.reads.at(-1).text, 'Wald');
  } finally {
    await x.cleanup();
  }
});
test('campaign activation invalidates delayed list replies and resets foreign filter identities', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.npcs,
      held = deferred();
    window.campaign.npcs = async () => held.promise;
    x.input('Wald');
    x.submit();
    await tick();
    x.el('npc-filter-faction').value = 'foreign';
    x.ui.activateNpcs({ ...x.w, token: 'new' });
    held.resolve(
      await original(x.w.token, {
        text: 'Wald',
        lifecycle: 'all',
        factionId: null,
        locationId: null,
        offset: 0,
      }),
    );
    await tick();
    assert.equal(x.titles().length, 0);
    assert.equal(x.el('npc-search').value, '');
    assert.equal(x.el('npc-filter-faction').value, '');
    assert.equal(x.el('npc-list-status').hidden, true);
  } finally {
    await x.cleanup();
  }
});

test('NPC search uses Unicode case and canonical equivalence in every authored field without rewriting prose', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'npc-search-unicode-')),
    { CampaignStore } = require('../../.build/npc-search-store.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite');
  try {
    const campaign = store.create('Umlaute'),
      w = store.activate(campaign.id),
      id = randomUUID(),
      slot = {
        id: randomUUID(),
        startMinute: 60,
        endMinute: 120,
        activity: 'Ölhandel',
        place: 'other',
        notes: 'Säcke zählen',
      },
      override = {
        day: '2',
        label: 'Ärztetag',
        slots: [{ ...slot, id: randomUUID(), activity: 'Flöße prüfen', notes: 'Müde Händler' }],
      };
    const npc = store.executeNpc({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        expectedNoteRevision: null,
        expectedRecordRevision: 0,
        expectedActorRevision: null,
        expectedPositionRevision: null,
        npc: {
          id,
          name: 'Jäger Änne',
          creatureId: null,
          readAloud: '  Grüße.\r\n- Gruß vom Tor',
          gmNotes: '  Überwacht den Fluss.\r\n- Geheimnis',
          record: {
            id,
            revision: 0,
            factionId: null,
            modifier: 0,
            lifecycle: 'active',
            appearance: 'Gru\u0308ner Mantel',
            behavior: 'Lächelt',
            history: 'Hört Stimmen',
            dailyPlan: [slot],
            dailyOverrides: [override],
          },
          locationId: null,
          health: null,
        },
      }),
      bytes = store.db.serialize();
    const queries = [
      'JÄGER',
      'A\u0308NNE',
      'GRÜẞE',
      'überwacht',
      'GRÜNER',
      'LÄCHELT',
      'HÖRT',
      'ÖLHANDEL',
      'SÄCKE',
      'ÄRZTETAG',
      'FLÖẞE',
      'MÜDE',
    ];
    for (const text of queries) {
      const found = store.npcs(w.token, {
        text,
        lifecycle: 'all',
        factionId: null,
        locationId: null,
        offset: 0,
      });
      assert.deepEqual(
        found.rows.map((n) => n.id),
        [id],
        text,
      );
      assert.equal(found.total, 1, text);
    }
    assert.equal(
      store.npcs(w.token, {
        text: 'JÄGER',
        lifecycle: 'defeated',
        factionId: null,
        locationId: null,
        offset: 0,
      }).total,
      0,
    );
    assert.ok(
      store.db.serialize().equals(bytes),
      'search must leave authored bytes and revisions unchanged',
    );
    assert.deepEqual(store.npc(w.token, id), npc);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
