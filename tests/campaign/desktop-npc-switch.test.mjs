import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [entry, out] of [
  ['src/app/storage/store.ts', 'npc-switch-store'],
  ['src/app/campaign/npc-ui.ts', 'npc-switch-ui'],
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
  for (let i = 0; i < 150; i++) {
    if (check()) return;
    await tick();
  }
  assert(check(), 'Expected NPC state');
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'npc-switch-')),
    { CampaignStore } = require('../../.build/npc-switch-store.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite'),
    campaign = store.create('NPCs sicher wechseln'),
    w = store.activate(campaign.id),
    npcs = [];
  for (const name of ['Hafenmeisterin Mira', 'Späher Borin']) {
    const id = randomUUID();
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
          readAloud: '  Blick.\r\n- Mantel',
          gmNotes: 'Original: ' + name,
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
      }),
    );
  }
  const [a, b] = npcs,
    previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLSelectElement: globalThis.HTMLSelectElement,
      Event: globalThis.Event,
      Option: globalThis.Option,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    selectValues = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return selectValues.get(this) ?? this.querySelector('option')?.getAttribute('value') ?? '';
    },
    set(value) {
      selectValues.set(this, value);
    },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.assign(globalThis, {
    window,
    document,
    HTMLSelectElement: window.HTMLSelectElement,
    Event: window.Event,
    Option: function (text = '', value = text) {
      const option = document.createElement('option');
      option.textContent = text;
      option.value = value;
      return option;
    },
  });
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
    writes = [],
    messages = [],
    reads = [];
  window.campaign = {};
  for (const key of [
    'generationSources',
    'npcPlanCalendar',
    'npcs',
    'npcDrafts',
    'npc',
    'npcDraft',
    'keepNpcDraft',
    'discardNpcDraft',
    'reconcileNpc',
  ])
    window.campaign[key] = async (...args) =>
      response(() => {
        reads.push({ kind: key, args });
        return store[key](...args);
      });
  window.campaign.executeNpc = async (command) => {
    writes.push(command);
    return response(() => store.executeNpc(command));
  };
  delete require.cache[require.resolve('../../.build/npc-switch-ui.cjs')];
  const ui = require('../../.build/npc-switch-ui.cjs');
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
  const el = (id) => document.getElementById(id);
  el('npc-contact').setSelectionRange = (start, end) => {
    el('npc-contact').selectionStart = start;
    el('npc-contact').selectionEnd = end;
  };
  el('npc-editor').scrollIntoView = (options) => {
    el('npc-editor').dataset.requestedScroll = options.block;
  };
  const choose = (id) =>
    [...el('npc-list').querySelectorAll('button')]
      .find((button) => button.textContent.startsWith(npcs.find((n) => n.id === id).name + ' ·'))
      .onclick();
  choose(a.id);
  await until(() => el('npc-name').value === a.name && !el('npc-name').disabled);
  const input = (id, value) => {
    el(id).value = value;
    el('npc-editor').oninput();
  };
  return {
    store,
    w,
    a,
    b,
    ui,
    el,
    choose,
    input,
    writes,
    messages,
    reads,
    async cleanup() {
      await ui.flushNpcs();
      ui.activateNpcs(w);
      Object.assign(globalThis, previous);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('a delayed NPC selection locks the old form and preserves incomplete drafts', async () => {
  const x = await fixture();
  try {
    x.input('npc-name', '');
    x.input('npc-gmNotes', 'Unfertig\r\n- Segel');
    assert(await x.ui.flushNpcs());
    const held = deferred(),
      original = window.campaign.npcDraft;
    window.campaign.npcDraft = async (...args) =>
      args[1] === x.b.id ? held.promise : original(...args);
    x.choose(x.b.id);
    await until(() => x.el('npc-load-status').textContent.includes('Späher Borin'));
    assert.equal(x.el('npc-gmNotes').disabled, true);
    assert.equal(x.el('npc-editor').querySelector('button[type=submit]').disabled, true);
    x.input('npc-gmNotes', 'Fremder programmatischer Versuch');
    held.resolve(await original(x.w.token, x.b.id));
    await until(() => x.el('npc-name').value === x.b.name && !x.el('npc-name').disabled);
    x.choose(x.a.id);
    await until(() => x.el('npc-name').value === '' && !x.el('npc-name').disabled);
    assert.equal(x.el('npc-gmNotes').value, 'Unfertig\r\n- Segel');
    assert.equal(x.store.npcDraft(x.w.token, x.a.id).fields.gmNotes, 'Unfertig\r\n- Segel');
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('a failed selection cannot submit or discard the previous NPC and retries the requested one', async () => {
  const x = await fixture();
  try {
    const original = window.campaign.npcDraft;
    let fail = true;
    window.campaign.npcDraft = async (...args) => {
      if (args[1] === x.b.id && fail) {
        fail = false;
        return { ok: false, error: 'NPC nicht lesbar' };
      }
      return original(...args);
    };
    x.choose(x.b.id);
    await until(() => x.el('npc-load-status').getAttribute('role') === 'alert');
    assert.equal(x.el('npc-enter').disabled, true);
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    x.el('npc-reload').onclick();
    await tick();
    assert.equal(x.writes.length, 0);
    x.el('npc-load-retry').onclick();
    await until(() => x.el('npc-name').value === x.b.name && !x.el('npc-name').disabled);
    assert.equal(x.el('npc-load-status').hidden, true);
  } finally {
    await x.cleanup();
  }
});
test('a superseded read error cannot replace a newer NPC or report its old failure', async () => {
  const x = await fixture();
  try {
    const held = deferred(),
      original = window.campaign.npcDraft;
    window.campaign.npcDraft = async (...args) =>
      args[1] === x.b.id ? held.promise : original(...args);
    x.choose(x.b.id);
    await tick();
    x.choose(x.a.id);
    await until(() => !x.el('npc-name').disabled);
    held.resolve({ ok: false, error: 'Veralteter Lesefehler' });
    await tick();
    assert.equal(x.el('npc-name').value, x.a.name);
    assert.equal(x.el('npc-load-status').hidden, true);
    assert.deepEqual(x.messages, []);
  } finally {
    await x.cleanup();
  }
});
test('refreshing the NPC list does not cancel a pending profile selection', async () => {
  const x = await fixture();
  try {
    const held = deferred(),
      original = window.campaign.npcDraft;
    window.campaign.npcDraft = async (...args) =>
      args[1] === x.b.id ? held.promise : original(...args);
    x.choose(x.b.id);
    await tick();
    await x.ui.openNpcs();
    held.resolve(await original(x.w.token, x.b.id));
    await until(() => x.el('npc-name').value === x.b.name && !x.el('npc-name').disabled);
  } finally {
    await x.cleanup();
  }
});
test('an NPC reply for a different figure is never made editable', async () => {
  const x = await fixture();
  try {
    window.campaign.npc = async () => ({ ok: true, value: x.a });
    x.choose(x.b.id);
    await until(() => x.el('npc-load-status').getAttribute('role') === 'alert');
    assert.equal(x.el('npc-name').disabled, true);
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});
test('switching campaigns invalidates pending profile replies', async () => {
  const x = await fixture();
  try {
    const held = deferred(),
      original = window.campaign.npcDraft;
    window.campaign.npcDraft = async (...args) =>
      args[1] === x.b.id ? held.promise : original(...args);
    x.choose(x.b.id);
    await tick();
    x.ui.activateNpcs({ ...x.w, token: 'different' });
    held.resolve(await original(x.w.token, x.b.id));
    await tick();
    assert.equal(x.el('npc-editor').hidden, true);
    assert.equal(x.el('npc-load-status').hidden, true);
    assert.deepEqual(x.messages, []);
  } finally {
    await x.cleanup();
  }
});

test('editing one NPC field preserves untouched CRLF prose in the draft and published NPC', async () => {
  const x = await fixture();
  try {
    for (const id of ['npc-readAloud', 'npc-gmNotes'])
      x.el(id).value = x.el(id).value.replace(/\r\n/g, '\n');
    x.input('npc-history', 'Neue Geschichte');
    assert(await x.ui.flushNpcs());
    const draft = x.store.npcDraft(x.w.token, x.a.id);
    assert.equal(draft.fields.readAloud, x.a.readAloud);
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.writes.length === 1 && !x.el('npc-name').disabled);
    const saved = x.store.npc(x.w.token, x.a.id);
    assert.equal(saved.readAloud, x.a.readAloud);
    assert.equal(saved.gmNotes, x.a.gmNotes);
    assert.equal(saved.record.history, 'Neue Geschichte');
  } finally {
    await x.cleanup();
  }
});

test('explicit NPC demographics publish together and reject an out-of-range age before writing', async () => {
  const x = await fixture();
  try {
    x.input('npc-ancestry', '  Elf  ');
    x.input('npc-gender', 'nichtbinär');
    x.input('npc-ageYears', '44');
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.writes.length === 1 && !x.el('npc-name').disabled);
    assert.deepEqual(x.store.npc(x.w.token, x.a.id).record.demographics, {
      ancestry: 'Elf',
      gender: 'nichtbinär',
      ageYears: 44,
    });
    x.input('npc-ageYears', '2001');
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.some((message) => message.includes('zwischen 0 und 2000')));
    assert.equal(x.writes.length, 1);
    assert.equal(x.store.npc(x.w.token, x.a.id).record.demographics.ageYears, 44);
  } finally {
    await x.cleanup();
  }
});

test('daily plan editor preserves weekly input and a rest-day exception through draft and publish', async () => {
  const x = await fixture();
  try {
    x.el('npc-daily-add').click();
    const row = x.el('npc-daily-plan').querySelector('fieldset'),
      set = (field, value) => {
        const control = row.querySelector(`[data-daily-field="${field}"]`);
        control.value = value;
        control.dispatchEvent(new window.Event('input', { bubbles: true }));
      };
    set('start', '23:00');
    set('end', '02:00');
    set('activity', 'Nachtwache');
    set('place', 'home');
    set('notes', 'Am Nordtor lauschen');
    const every = row.querySelector('[data-daily-every]');
    every.checked = false;
    every.dispatchEvent(new window.Event('input', { bubbles: true }));
    const weekday = row.querySelector('[data-daily-weekday="0"]');
    weekday.checked = true;
    weekday.dispatchEvent(new window.Event('input', { bubbles: true }));
    x.el('npc-daily-override-add').click();
    const exception = x.el('npc-daily-overrides').querySelector('section'),
      override = (field, value) => {
        const control = exception.querySelector(`[data-override-field="${field}"]`);
        control.value = value;
        control.dispatchEvent(new window.Event('input', { bubbles: true }));
      };
    override('day', '2');
    override('label', 'Markttag');
    assert(await x.ui.flushNpcs());
    const draft = x.store.npcDraft(x.w.token, x.a.id).fields,
      raw = JSON.parse(draft.dailyPlan);
    assert.deepEqual(
      raw.map(({ start, end, activity, place, notes, weekdays }) => ({
        start,
        end,
        activity,
        place,
        notes,
        weekdays,
      })),
      [
        {
          start: '23:00',
          end: '02:00',
          activity: 'Nachtwache',
          place: 'home',
          notes: 'Am Nordtor lauschen',
          weekdays: [0],
        },
      ],
    );
    assert.deepEqual(JSON.parse(draft.dailyOverrides), [
      { day: '2', label: 'Markttag', slots: [] },
    ]);
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.writes.length === 1 && !x.el('npc-name').disabled);
    const saved = x.store.npc(x.w.token, x.a.id).record,
      [slot] = saved.dailyPlan;
    assert.deepEqual(
      {
        start: slot.startMinute,
        end: slot.endMinute,
        activity: slot.activity,
        place: slot.place,
        notes: slot.notes,
        weekdays: slot.weekdays,
      },
      {
        start: 1380,
        end: 120,
        activity: 'Nachtwache',
        place: 'home',
        notes: 'Am Nordtor lauschen',
        weekdays: [0],
      },
    );
    assert.deepEqual(saved.dailyOverrides, [{ day: '2', label: 'Markttag', slots: [] }]);
  } finally {
    await x.cleanup();
  }
});

test('a malformed raw daily-plan draft stays recoverable instead of breaking the NPC editor', async () => {
  const x = await fixture();
  try {
    x.input('npc-gmNotes', 'Entwurf behalten');
    assert(await x.ui.flushNpcs());
    const old = x.store.npcDraft(x.w.token, x.a.id),
      damaged = { ...old, writeId: randomUUID(), fields: { ...old.fields, dailyPlan: '[null]' } };
    x.store.keepNpcDraft(x.w.token, damaged, old.writeId);
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcs();
    x.choose(x.a.id);
    await until(() => x.el('npc-name').value === x.a.name && !x.el('npc-name').disabled);
    assert.match(x.el('npc-daily-plan').textContent, /kann nicht angezeigt werden/);
    assert.equal(x.store.npcDraft(x.w.token, x.a.id).fields.dailyPlan, '[null]');
    x.el('npc-reload').click();
    await until(() => x.store.npcDraft(x.w.token, x.a.id) === null && !x.el('npc-name').disabled);
    assert.doesNotMatch(x.el('npc-daily-plan').textContent, /kann nicht angezeigt werden/);
    assert.equal(x.el('npc-gmNotes').value, x.a.gmNotes);
  } finally {
    await x.cleanup();
  }
});

test('a canceled dossier contact cannot stage a header after the NPC read returns', async () => {
  const x = await fixture();
  try {
    const held = deferred(),
      original = window.campaign.npc;
    let requested = false,
      current = true;
    window.campaign.npc = async (...args) => {
      if (args[1] === x.b.id) {
        requested = true;
        return held.promise;
      }
      return original(...args);
    };
    const opening = x.ui.openNpcProfile(
      x.b.id,
      { date: 'Tag 7', sceneTitle: 'Ferne Gruppe' },
      () => current,
    );
    await until(() => requested);
    current = false;
    held.resolve(await original(x.w.token, x.b.id));
    await opening;
    assert(await x.ui.flushNpcs());
    assert.equal(x.store.npcDraft(x.w.token, x.b.id)?.fields.contact ?? '', '');
    assert.equal(x.el('npc-contact').value, '');
    assert.equal(x.writes.length, 0);
    assert.equal(x.store.npc(x.w.token, x.b.id).record.history, '');
  } finally {
    await x.cleanup();
  }
});
test('an accepted dossier contact survives a fresh SQLite reader and editor reactivation before explicit publish', async () => {
  const x = await fixture();
  try {
    await x.ui.openNpcProfile(x.a.id, { date: 'Tag 7', sceneTitle: 'Vorhut' }, () => true);
    x.input('npc-contact', x.el('npc-contact').value + '  Eigene Beobachtung\r\n');
    assert(await x.ui.flushNpcs());
    const raw = x.store.npcDraft(x.w.token, x.a.id).fields.contact;
    const { CampaignStore } = require('../../.build/npc-switch-store.cjs'),
      fresh = new CampaignStore(x.store.db.name);
    try {
      const w = fresh.activate(x.w.campaign.id);
      assert.equal(fresh.npcDraft(w.token, x.a.id).fields.contact, raw);
    } finally {
      fresh.close();
    }
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, '');
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcProfile(x.a.id);
    assert.equal(x.el('npc-contact').value, raw);
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.writes.length === 1);
    await until(() => x.store.npcDraft(x.w.token, x.a.id) === null);
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, raw);
    assert.equal(x.store.npc(x.w.token, x.a.id).readAloud, x.a.readAloud);
  } finally {
    await x.cleanup();
  }
});

test('a resumed whitespace-only conversation remains author input rather than a new generated header', async () => {
  const x = await fixture();
  try {
    const raw = '  \r\n\t  ';
    x.input('npc-contact', raw);
    assert(await x.ui.flushNpcs());
    const original = x.store.npcDraft(x.w.token, x.a.id);
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcProfile(x.a.id, { date: 'Tag 9', sceneTitle: 'Nachhut' }, () => true);
    assert.equal(x.el('npc-contact').value, raw);
    assert.deepEqual(x.store.npcDraft(x.w.token, x.a.id), original);
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, '');
    assert.equal(x.writes.length, 0);
  } finally {
    await x.cleanup();
  }
});

test('a lost NPC reply retains the exact command and raw contact through Fresh, then confirms only once', async () => {
  const x = await fixture();
  try {
    const raw = 'Tag 7 · Vorhut\n  Beobachtung\r\n';
    x.input('npc-contact', raw);
    assert(await x.ui.flushNpcs());
    const original = window.campaign.executeNpc;
    window.campaign.executeNpc = async (c) => {
      await original(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.writes.length === 1);
    await until(() => x.messages.includes('Antwort verloren'));
    const pending = x.store.npcDraft(x.w.token, x.a.id);
    assert(pending, 'The acknowledged draft must remain until its exact receipt is reconciled');
    assert.equal(pending.fields.contact, raw);
    assert.deepEqual(pending.pendingCommand, x.writes[0]);
    assert.equal(x.el('npc-name').readOnly, true);
    const { CampaignStore } = require('../../.build/npc-switch-store.cjs'),
      fresh = new CampaignStore(x.store.db.name);
    try {
      const w = fresh.activate(x.w.campaign.id);
      assert.deepEqual(fresh.npcDraft(w.token, x.a.id).pendingCommand, x.writes[0]);
    } finally {
      fresh.close();
    }
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcProfile(x.a.id);
    assert.equal(x.el('npc-contact').value, raw);
    assert.equal(x.el('npc-name').readOnly, true);
    x.el('npc-write-check').onclick();
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.store.npcDraft(x.w.token, x.a.id), null);
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, raw);
    assert.equal(x.el('npc-contact').value, '');
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('a rejected NPC write keeps raw input and a late original command is fenced after resolution', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', ' Noch offen\r\n');
    assert(await x.ui.flushNpcs());
    window.campaign.executeNpc = async (c) => {
      x.writes.push(c);
      return { ok: false, error: 'Nicht angekommen' };
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Nicht angekommen'));
    assert.equal(x.el('npc-name').readOnly, true);
    const c = x.writes[0];
    x.el('npc-write-check').onclick();
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.el('npc-contact').value, ' Noch offen\r\n');
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, '');
    assert.throws(() => x.store.executeNpc(c), /Entwurf/);
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('a lost raw-draft staging response never sends the NPC command and safely reopens the staged original', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Rohtext');
    assert(await x.ui.flushNpcs());
    const original = window.campaign.keepNpcDraft;
    window.campaign.keepNpcDraft = async (...a) => {
      const r = await original(...a);
      if (a[1].pendingCommand) throw new Error('Entwurfsantwort verloren');
      return r;
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Entwurfsantwort verloren'));
    await until(() => x.el('npc-write-check').hidden === false);
    assert.equal(x.writes.length, 0);
    x.el('npc-write-check').onclick();
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.el('npc-contact').value, 'Rohtext');
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, '');
  } finally {
    await x.cleanup();
  }
});

test('a lost not-applied resolution reply is idempotent and keeps the fenced original and raw input', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Rohtext');
    assert(await x.ui.flushNpcs());
    window.campaign.executeNpc = async (c) => {
      x.writes.push(c);
      throw new Error('Nicht gesendet');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Nicht gesendet'));
    const original = window.campaign.reconcileNpc;
    let lose = true;
    window.campaign.reconcileNpc = async (...a) => {
      const r = await original(...a);
      if (lose) {
        lose = false;
        throw new Error('Prüfantwort verloren');
      }
      return r;
    };
    x.el('npc-write-check').onclick();
    await until(() => x.messages.includes('Prüfantwort verloren'));
    assert.equal(x.el('npc-name').readOnly, true);
    x.el('npc-write-check').onclick();
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.el('npc-contact').value, 'Rohtext');
    assert.throws(() => x.store.executeNpc(x.writes[0]), /Entwurf/);
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('a corrupt NPC receipt stays unresolved with raw bytes intact and cannot be discarded through another editor', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', '  Erhalten\r\n');
    assert(await x.ui.flushNpcs());
    const original = window.campaign.executeNpc;
    window.campaign.executeNpc = async (c) => {
      await original(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const d = x.store.npcDraft(x.w.token, x.a.id),
      before = JSON.stringify(d);
    assert.throws(() => x.store.discardNpcDraft(x.w.token, d.id, d.writeId), /ungeklärt/);
    assert.throws(
      () =>
        x.store.keepNpcDraft(
          x.w.token,
          { ...d, pendingCommand: undefined, writeId: randomUUID() },
          d.writeId,
        ),
      /ungeklärt/,
    );
    x.store.db
      .prepare('UPDATE npc_receipt SET checksum=? WHERE command_id=?')
      .run('corrupt', d.pendingCommand.commandId);
    x.el('npc-write-check').onclick();
    await until(() => x.messages.some((m) => m.includes('Beleg beschädigt')));
    assert.equal(x.el('npc-name').readOnly, true);
    assert.equal(JSON.stringify(x.store.npcDraft(x.w.token, x.a.id)), before);
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

for (const applied of [false, true])
  test(`independent campaign copy preserves ${applied ? 'applied' : 'unapplied'} NPC recovery without replay or source authority`, async () => {
    const x = await fixture();
    let target;
    try {
      x.input('npc-contact', '  Eigene Wörter\r\n');
      assert(await x.ui.flushNpcs());
      const original = window.campaign.executeNpc;
      window.campaign.executeNpc = async (c) => {
        if (applied) await original(c);
        else x.writes.push(c);
        throw new Error('Antwort verloren');
      };
      x.el('npc-editor').onsubmit({ preventDefault() {} });
      await until(() => x.messages.includes('Antwort verloren'));
      const sourceDraft = JSON.stringify(x.store.npcDraft(x.w.token, x.a.id)),
        snapshot = path.join(path.dirname(x.store.db.name), 'snapshot.sqlite');
      await x.store.campaignSnapshot(x.w.token, snapshot);
      const { CampaignStore } = require('../../.build/npc-switch-store.cjs');
      target = new CampaignStore(path.join(path.dirname(snapshot), 'copy.sqlite'));
      const copy = target.acceptCampaignSnapshot(snapshot, 'Unabhängig', {}),
        w = target.activate(copy.id),
        d = target
          .npcDrafts(w.token)
          .map((r) => target.npcDraft(w.token, r.id))
          .find((d) => d.fields.name === x.a.name);
      assert(d);
      assert.notEqual(d.id, x.a.id);
      assert.notEqual(d.pendingCommand.commandId, x.writes[0].commandId);
      assert.equal(d.pendingCommand.campaignId, copy.id);
      assert.equal(d.fields.contact, '  Eigene Wörter\r\n');
      assert.throws(() => target.reconcileNpc(x.writes[0], w.token), /Kampagne|Kontext/);
      const result = target.reconcileNpc(d.pendingCommand, w.token);
      assert.equal(result.outcome, applied ? 'applied' : 'not-applied');
      assert.equal(target.npc(w.token, d.id).record.history, applied ? '  Eigene Wörter\r\n' : '');
      assert.equal(JSON.stringify(x.store.npcDraft(x.w.token, x.a.id)), sourceDraft);
      assert.equal(x.writes.length, 1);
    } finally {
      target?.close();
      await x.cleanup();
    }
  });

test('an original NPC receipt never replaces a newer confirmed profile while resolving the contact', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Eigene Beobachtung');
    assert(await x.ui.flushNpcs());
    const original = window.campaign.executeNpc;
    window.campaign.executeNpc = async (c) => {
      await original(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const v = x.store.npc(x.w.token, x.a.id);
    x.store.changePreparation({
      commandId: randomUUID(),
      token: x.w.token,
      campaignId: x.w.campaign.id,
      change: {
        kind: 'note',
        note: {
          version: 1,
          id: v.id,
          revision: v.noteRevision,
          kind: 'npc',
          title: 'Neuer Name',
          readAloud: v.readAloud,
          gmNotes: 'Spätere Notiz',
          relations: [],
          creatureId: null,
          deleted: false,
        },
        expectedRevision: v.noteRevision,
      },
    });
    x.el('npc-write-check').onclick();
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.el('npc-name').value, 'Neuer Name');
    assert.equal(x.el('npc-gmNotes').value, 'Spätere Notiz');
    assert.equal(x.el('npc-history').value, 'Eigene Beobachtung');
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('a lost applied resolution reply can be checked again without another product write', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Original');
    assert(await x.ui.flushNpcs());
    const send = window.campaign.executeNpc;
    window.campaign.executeNpc = async (c) => {
      await send(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const check = window.campaign.reconcileNpc;
    let lose = true;
    window.campaign.reconcileNpc = async (...a) => {
      const r = await check(...a);
      if (lose) {
        lose = false;
        throw new Error('Bestätigung verloren');
      }
      return r;
    };
    x.el('npc-write-check').onclick();
    await until(() => x.messages.includes('Bestätigung verloren'));
    assert.equal(x.store.npcDraft(x.w.token, x.a.id), null);
    assert.equal(x.el('npc-contact').value, 'Original');
    assert.equal(x.el('npc-name').readOnly, true);
    x.el('npc-write-check').onclick();
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.el('npc-contact').value, '');
    assert.equal(x.store.npc(x.w.token, x.a.id).record.history, 'Original');
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('late NPC recovery errors cannot report or unlock a reactivated campaign editor', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Original');
    assert(await x.ui.flushNpcs());
    window.campaign.executeNpc = async (c) => {
      x.writes.push(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const held = deferred();
    window.campaign.reconcileNpc = () => held.promise;
    x.el('npc-write-check').onclick();
    await tick();
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcProfile(x.b.id);
    const count = x.messages.length;
    held.resolve({ ok: false, error: 'Alter Prüffehler' });
    await tick();
    assert.equal(x.messages.length, count);
    assert.equal(x.el('npc-name').value, x.b.name);
    assert.equal(x.el('npc-name').disabled, false);
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('arming recovery does not halve the existing raw-text draft limit', async () => {
  const x = await fixture();
  try {
    x.input('npc-readAloud', 'a'.repeat(1400000));
    x.input('npc-gmNotes', 'b'.repeat(1400000));
    assert(await x.ui.flushNpcs());
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.writes.length === 1);
    await until(() => !x.el('npc-name').disabled && !x.el('npc-name').readOnly);
    assert.equal(x.store.npc(x.w.token, x.a.id).readAloud.length, 1400000);
    assert.equal(x.store.npcDraft(x.w.token, x.a.id), null);
  } finally {
    await x.cleanup();
  }
});

test('reactivation before the recovery microtask cannot acknowledge the old draft', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Original');
    assert(await x.ui.flushNpcs());
    window.campaign.executeNpc = async (c) => {
      x.writes.push(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const original = JSON.stringify(x.store.npcDraft(x.w.token, x.a.id));
    x.el('npc-write-check').onclick();
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcProfile(x.b.id);
    await tick();
    assert.equal(JSON.stringify(x.store.npcDraft(x.w.token, x.a.id)), original);
    assert.equal(x.reads.filter((r) => r.kind === 'reconcileNpc').length, 0);
    assert.equal(x.el('npc-name').value, x.b.name);
  } finally {
    await x.cleanup();
  }
});

test('a checksum-valid NPC receipt with different confirmed prose cannot consume the raw contact', async () => {
  const x = await fixture();
  try {
    x.input('npc-contact', 'Original');
    assert(await x.ui.flushNpcs());
    const send = window.campaign.executeNpc;
    window.campaign.executeNpc = async (c) => {
      await send(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const d = x.store.npcDraft(x.w.token, x.a.id),
      row = x.store.db
        .prepare('SELECT * FROM npc_receipt WHERE command_id=?')
        .get(d.pendingCommand.commandId),
      v = JSON.parse(row.payload);
    v.record.history = 'Andere Geschichte';
    const payload = JSON.stringify(v);
    x.store.db
      .prepare('UPDATE npc_receipt SET payload=?,checksum=? WHERE command_id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), row.command_id);
    x.el('npc-write-check').onclick();
    await until(() => x.messages.some((m) => m.includes('Beleg weicht')));
    assert.equal(x.el('npc-name').readOnly, true);
    assert.deepEqual(x.store.npcDraft(x.w.token, x.a.id), d);
    assert.equal(x.writes.length, 1);
  } finally {
    await x.cleanup();
  }
});

test('NPC receipt health comparisons preserve values independent of JSON property order', async () => {
  const x = await fixture();
  try {
    const { noteRevision, actorRevision, positionRevision, disposition, role, ...npc } = x.a;
    const c = {
      commandId: randomUUID(),
      campaignId: x.w.campaign.id,
      token: x.w.token,
      expectedNoteRevision: noteRevision,
      expectedActorRevision: actorRevision,
      expectedPositionRevision: positionRevision,
      expectedRecordRevision: npc.record.revision,
      npc: {
        ...npc,
        creatureId: 'goblin',
        health: { concentrating: false, conditions: '', tempHp: 0, maxHp: 7, hp: 7 },
      },
    };
    const result = x.store.executeNpc(c);
    assert.deepEqual(x.store.executeNpc(c), result);
    assert.equal(result.health.hp, 7);
  } finally {
    await x.cleanup();
  }
});

test('copied pending NPC conversation references bind to copied identities without flattening author prose', async () => {
  const x = await fixture();
  let target;
  try {
    const raw = '  [Alias](dungeon-ref:note/' + x.a.id + ')\r\n[[Vault note]]';
    x.input('npc-contact', raw);
    assert(await x.ui.flushNpcs());
    const send = window.campaign.executeNpc;
    window.campaign.executeNpc = async (c) => {
      await send(c);
      throw new Error('Antwort verloren');
    };
    x.el('npc-editor').onsubmit({ preventDefault() {} });
    await until(() => x.messages.includes('Antwort verloren'));
    const snapshot = path.join(path.dirname(x.store.db.name), 'references.sqlite');
    await x.store.campaignSnapshot(x.w.token, snapshot);
    const { CampaignStore } = require('../../.build/npc-switch-store.cjs');
    target = new CampaignStore(path.join(path.dirname(snapshot), 'reference-copy.sqlite'));
    const copy = target.acceptCampaignSnapshot(snapshot, 'Referenzkopie', {}),
      w = target.activate(copy.id),
      d = target
        .npcDrafts(w.token)
        .map((r) => target.npcDraft(w.token, r.id))
        .find((d) => d.fields.name === x.a.name),
      expected = raw.replace(x.a.id, d.id);
    assert.equal(d.fields.contact, expected);
    assert.equal(d.pendingCommand.npc.record.history, expected);
    assert.equal(target.npc(w.token, d.id).record.history, expected);
    assert.equal(target.reconcileNpc(d.pendingCommand, w.token).outcome, 'applied');
    assert.equal(x.store.npcDraft(x.w.token, x.a.id).fields.contact, raw);
  } finally {
    target?.close();
    await x.cleanup();
  }
});

test('shared session drains a detached NPC save without letting its late answer release a newer draft save', async () => {
  const x = await fixture(),
    old = deferred(),
    next = deferred(),
    original = window.campaign.keepNpcDraft;
  let calls = 0;
  try {
    window.campaign.keepNpcDraft = async (...args) => {
      const result = await original(...args);
      calls++;
      if (calls === 1) {
        await old.promise;
        return result;
      }
      if (calls === 2) {
        await next.promise;
        return result;
      }
      return result;
    };
    x.input('npc-name', '');
    x.input('npc-gmNotes', 'alter Rohtext\r\nbleibt erhalten');
    const first = x.ui.flushNpcs();
    await until(() => calls === 1);
    assert.equal(x.ui.editorSession.status.saving, true);
    x.ui.editorSession.deactivate();
    x.ui.activateNpcs(x.w);
    await x.ui.openNpcProfile(x.b.id);
    x.input('npc-gmNotes', 'neuer Rohtext');
    const second = x.ui.flushNpcs();
    await until(() => calls === 2);
    old.resolve();
    await first;
    assert.equal(x.ui.editorSession.status.saving, true);
    assert.equal(x.el('npc-name').value, x.b.name);
    const joined = x.ui.flushNpcs();
    await tick();
    assert.equal(calls, 2, 'late settlement must not start a second writer for the newer draft');
    x.input('npc-gmNotes', 'weitere Eingabe während Sicherung');
    next.resolve();
    assert.equal(await second, true);
    assert.equal(await joined, true);
    await x.ui.editorSession.settle();
    assert.equal(x.ui.editorSession.status.saving, false);
    assert.equal(x.ui.editorSession.status.retainedDraft, true);
    assert.equal(x.ui.editorSession.status.openInput, false);
    assert.equal(x.ui.editorSession.status.unresolvedCommand, false);
    assert.equal(
      x.store.npcDraft(x.w.token, x.a.id).fields.gmNotes,
      'alter Rohtext\r\nbleibt erhalten',
    );
    assert.equal(
      x.store.npcDraft(x.w.token, x.b.id).fields.gmNotes,
      'weitere Eingabe während Sicherung',
    );
    assert.equal(x.writes.length, 0);
  } finally {
    old.resolve();
    next.resolve();
    await x.cleanup();
  }
});
