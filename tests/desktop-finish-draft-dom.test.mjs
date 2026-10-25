import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/finish-draft-ui.ts'],
  outfile: '.build/finish-draft-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/finish-draft-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url);
const { CampaignStore } = require('../.build/finish-draft-store.cjs');
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const ok = (value) => ({ ok: true, value });
const owner = (id) => ({ kind: 'combat', targetId: id, revision: 1 });
const workspace = (id) => ({ token: id, campaign: { id } });
const draft = (id, text) => ({
  ...owner(id),
  writeId: 'saved-' + id,
  outcome: text,
  poolXp: '-',
  loadXp: '',
  noXp: true,
  hasLoot: false,
  recipientIds: [],
  items: [],
});
function fixture(t, api = {}) {
  const { window } = parseHTML(
    '<html><body><dialog id="combat-finish-dialog"><textarea id="combat-outcome"></textarea><input id="finish-xp"><input id="finish-load"><input id="finish-no-xp" type="checkbox"><input id="finish-has-loot" type="checkbox"><div id="finish-recipients"></div><p id="finish-draft-status"></p><button id="finish-draft-adopt"></button><button id="finish-draft-discard"></button></dialog></body></html>',
  );
  for (const id of ['finish-no-xp', 'finish-has-loot'])
    window.document.getElementById(id).checked = false;
  const writes = [],
    timers = new Map(),
    previous = {};
  let clockId = 0,
    items = [];
  for (const key of ['window', 'document', 'setTimeout', 'clearTimeout'])
    previous[key] = globalThis[key];
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.setTimeout = (fn) => {
    timers.set(++clockId, fn);
    return clockId;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  window.campaign = {
    finishDraft: async () => ok(null),
    keepFinishDraft: async (token, d, expected) => {
      writes.push({ token, d: structuredClone(d), expected });
      return ok();
    },
    discardFinishDraft: async () => ok(),
    ...api,
  };
  const file = require.resolve('../.build/finish-draft-dom.cjs');
  delete require.cache[file];
  const editor = require(file);
  const text = () => window.document.getElementById('combat-outcome');
  const set = (value) => {
    text().value = value;
  };
  const begin = (id, w = workspace(id), o = owner(id)) =>
    editor.beginFinishDraft(
      w,
      o,
      () => items,
      (v) => {
        items = v;
      },
      () => {},
    );
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) globalThis[key] = value;
  });
  return {
    editor,
    writes,
    timers,
    text,
    set,
    begin,
    status: () => window.document.getElementById('finish-draft-status').textContent,
    discard: () => window.document.getElementById('finish-draft-discard').onclick(),
  };
}

test('late finish-draft read cannot replace the latest dialog values or save owner', async (t) => {
  const first = deferred(),
    x = fixture(t, {
      finishDraft: async (token) =>
        token === 'first' ? first.promise : ok(draft('second', 'Second recovered input')),
    });
  x.set('First defaults');
  const a = x.begin('first');
  x.set('Second defaults');
  await x.begin('second');
  first.resolve(ok(draft('first', 'First stale input')));
  await a;
  assert.equal(x.text().value, 'Second recovered input');
  x.set('Second new input');
  x.editor.markFinishDraft();
  assert.equal(await x.editor.flushFinishDraft(), true);
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].token, 'second');
  assert.equal(x.writes[0].d.outcome, 'Second new input');
});

test('an old timer cannot snapshot the latest dialog into a former campaign', async (t) => {
  const x = fixture(t);
  x.set('First');
  await x.begin('first');
  x.editor.markFinishDraft();
  const expired = [...x.timers.values()][0];
  x.set('Second');
  await x.begin('second');
  expired();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(x.writes.length, 0);
});

test('old save completion cannot drain later edits from a new dialog', async (t) => {
  const pending = deferred(),
    writes = [],
    x = fixture(t, {
      keepFinishDraft: async (token, d) => {
        writes.push({ token, d: structuredClone(d) });
        return token === 'first' ? pending.promise : ok();
      },
    });
  x.set('First');
  await x.begin('first');
  x.editor.markFinishDraft();
  const flush = x.editor.flushFinishDraft();
  x.set('Second');
  await x.begin('second');
  x.set('Second edited');
  x.editor.markFinishDraft();
  pending.resolve(ok());
  await flush;
  assert.equal(writes.length, 1);
  assert.equal(writes[0].d.outcome, 'First');
  assert.equal(x.text().value, 'Second edited');
  assert.equal(await x.editor.flushFinishDraft(), true);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].token, 'second');
});

test('late reset cannot clear the newly opened finish draft', async (t) => {
  const pending = deferred(),
    writes = [],
    x = fixture(t, {
      keepFinishDraft: async (token, d) => {
        writes.push({ token, d: structuredClone(d) });
        return token === 'first' ? pending.promise : ok();
      },
    });
  x.set('First');
  await x.begin('first');
  x.editor.markFinishDraft();
  const reset = x.editor.resetFinishDraft();
  x.set('Second');
  await x.begin('second');
  pending.resolve(ok());
  await reset;
  x.set('Second edited');
  x.editor.markFinishDraft();
  assert.equal(await x.editor.flushFinishDraft(), true);
  assert.equal(writes.at(-1).token, 'second');
  assert.equal(writes.at(-1).d.outcome, 'Second edited');
});

test('late discard reply cannot restore former defaults into a new dialog', async (t) => {
  const pending = deferred(),
    started = deferred(),
    x = fixture(t, {
      finishDraft: async (token) => ok(draft(token, token + ' recovered')),
      discardFinishDraft: async () => {
        started.resolve();
        return pending.promise;
      },
    });
  x.set('First defaults');
  await x.begin('first');
  x.discard();
  await started.promise;
  x.set('Second defaults');
  await x.begin('second');
  pending.resolve(ok());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(x.text().value, 'second recovered');
  assert.ok(!x.status().includes('verworfen'));
});

test('raw finish input is captured before awaits and later edits are saved under the same owner', async (t) => {
  const pending = deferred(),
    writes = [],
    x = fixture(t, {
      keepFinishDraft: async (token, d, expected) => {
        writes.push({ token, d: structuredClone(d), expected });
        return writes.length === 1 ? pending.promise : ok();
      },
    });
  x.set('  First raw text\r\n');
  await x.begin('first');
  x.editor.markFinishDraft();
  const flush = x.editor.flushFinishDraft();
  x.set('  Later raw text\r\n');
  x.editor.markFinishDraft();
  pending.resolve(ok());
  assert.equal(await flush, true);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].d.outcome, '  First raw text\r\n');
  assert.equal(writes[1].d.outcome, '  Later raw text\r\n');
  assert.equal(writes[1].expected, writes[0].d.writeId);
});

test('switching owners during save blocks the former confirmation', async (t) => {
  const pending = deferred(),
    x = fixture(t, { keepFinishDraft: async () => pending.promise });
  x.set('First');
  await x.begin('first');
  x.editor.markFinishDraft();
  const commit = x.editor.finishDraftCommit();
  x.set('Second');
  await x.begin('second');
  pending.resolve(ok());
  await assert.rejects(commit);
  assert.equal(x.text().value, 'Second');
});

test('edits entered during discard wait for it and retain their text with a fresh CAS basis', async (t) => {
  const pending = deferred(),
    started = deferred(),
    x = fixture(t, {
      finishDraft: async () => ok(draft('first', 'Recovered')),
      discardFinishDraft: async () => {
        started.resolve();
        return pending.promise;
      },
    });
  x.set('Defaults');
  await x.begin('first');
  x.discard();
  await started.promise;
  x.set('  Later text\r\n');
  x.editor.markFinishDraft();
  const flush = x.editor.flushFinishDraft();
  assert.equal(x.writes.length, 0);
  pending.resolve(ok());
  assert.equal(await flush, true);
  assert.equal(x.text().value, '  Later text\r\n');
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].expected, null);
  assert.equal(x.writes[0].d.outcome, '  Later text\r\n');
});

test('campaign deactivation invalidates pending reads and former timer callbacks', async (t) => {
  const pending = deferred(),
    x = fixture(t, { finishDraft: async () => pending.promise });
  x.set('Defaults');
  const load = x.begin('first');
  x.editor.markFinishDraft();
  const callback = [...x.timers.values()][0];
  x.editor.deactivateFinishDraft();
  x.set('Next campaign');
  pending.resolve(ok(draft('first', 'Former values')));
  await load;
  callback();
  await Promise.resolve();
  assert.equal(x.text().value, 'Next campaign');
  assert.equal(x.writes.length, 0);
  assert.equal(await x.editor.flushFinishDraft(), true);
});

test('real quest finish drafts keep original prose and save only the latest target after late reads', async (t) => {
  const ids = { first: randomUUID(), second: randomUUID() };
  const root = mkdtempSync(path.join(tmpdir(), 'finish-owner-')),
    store = new CampaignStore(path.join(root, 'campaign.sqlite')),
    campaign = store.create('Finishes'),
    w = store.activate(campaign.id),
    first = deferred();
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  for (const id of ['first', 'second']) {
    store.changePreparation({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id: ids[id],
          revision: 1,
          kind: 'quest',
          title: id,
          readAloud: 'Original',
          gmNotes: 'Private',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    store.keepFinishDraft(
      w.token,
      { ...draft(ids[id], id + ' saved'), kind: 'narrative', revision: 0 },
      null,
    );
  }
  const invoke = (fn) => {
    try {
      return ok(fn());
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const x = fixture(t, {
    finishDraft: async (token, o) =>
      o.targetId === ids.first ? first.promise : invoke(() => store.finishDraft(token, o)),
    keepFinishDraft: async (token, d, expected) =>
      invoke(() => store.keepFinishDraft(token, d, expected)),
  });
  const quest = (id) => ({ kind: 'narrative', targetId: ids[id], revision: 0 });
  x.set('First defaults');
  const old = x.begin('first', w, quest('first'));
  x.set('Second defaults');
  await x.begin('second', w, quest('second'));
  x.set('  Second edited\r\n');
  x.editor.markFinishDraft();
  assert.equal(await x.editor.flushFinishDraft(), true);
  first.resolve(ok(store.finishDraft(w.token, quest('first'))));
  await old;
  assert.equal(x.text().value, '  Second edited\r\n');
  assert.equal(store.finishDraft(w.token, quest('first')).outcome, 'first saved');
  assert.equal(store.finishDraft(w.token, quest('second')).outcome, '  Second edited\r\n');
});

test('a newer finish preparation can cancel an initial read without inventing a write', async (t) => {
  const pending = deferred(),
    x = fixture(t, {
      finishDraft: async (token) => (token === 'first' ? pending.promise : ok(null)),
    });
  x.set('First defaults');
  const old = x.begin('first');
  assert.equal(await x.editor.resetFinishDraft(), true);
  x.set('Second defaults');
  await x.begin('second');
  pending.resolve(ok(draft('first', 'Former input')));
  await old;
  assert.equal(x.text().value, 'Second defaults');
  assert.equal(x.writes.length, 0);
});

test('even an unchanged draft cannot return confirmation for a superseded owner', async (t) => {
  const x = fixture(t);
  x.set('First');
  await x.begin('first');
  const commit = x.editor.finishDraftCommit();
  x.set('Second');
  const load = x.begin('second');
  await assert.rejects(commit);
  await load;
  assert.equal(x.text().value, 'Second');
  assert.equal(x.writes.length, 0);
});

test('a confirmed former command cannot consume a newly reopened dialog for the same target', async (t) => {
  const x = fixture(t);
  x.set('First');
  await x.begin('first');
  const confirmed = await x.editor.finishDraftCommit();
  x.set('Reopened defaults');
  await x.begin('first');
  x.set('  Reopened later input\r\n');
  x.editor.markFinishDraft();
  assert.equal(confirmed.consume(), false);
  assert.equal(await x.editor.flushFinishDraft(), true);
  assert.equal(x.writes[0].d.outcome, '  Reopened later input\r\n');
});
