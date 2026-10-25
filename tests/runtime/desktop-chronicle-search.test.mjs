import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';
import { buildSync } from 'esbuild';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: [process.env.CHRONICLE_UI_SOURCE ?? 'src/app/runtime/chronicle-ui.ts'],
  outfile: '.build/chronicle-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const tick = () => new Promise((r) => setImmediate(r));
const entry = (title) => ({
  id: title,
  recordedAt: new Date(1).toISOString(),
  category: 'party',
  title,
  summary: '',
  people: [],
  scene: null,
  location: null,
});
function fixture() {
  const saved = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  const el = (id) => document.getElementById(id);
  Object.defineProperty(el('chronicle-category'), 'value', { value: 'all', writable: true });
  el('chronicle-search').value = '';
  const pending = [],
    calls = [],
    exports = [],
    opened = [];
  window.campaign = {
    closeChroniclePage: async () => ({ ok: true }),
    cancelChronicleExport: async () => ({ ok: true }),
    onChronicleExport: () => {},
    chroniclePage: async (token, category, search) => {
      calls.push({ token, category, search });
      return new Promise((resolve) => pending.push(resolve));
    },
    exportChronicle: async (...args) => {
      exports.push(args.slice(0, 3));
      return { ok: true, value: { cancelled: false, written: 1 } };
    },
  };
  delete require.cache[require.resolve('../../.build/chronicle-dom.cjs')];
  const ui = require('../../.build/chronicle-dom.cjs');
  ui.initChronicle(
    () => {},
    async (id, token) => {
      opened.push({ id, token });
    },
  );
  ui.activateChronicle({ token: 'one' });
  const answer = (title, which = 0, extra = {}, page = {}) => {
    const done = pending.splice(which, 1)[0];
    done({
      ok: true,
      value: {
        campaignName: 'Test',
        snapshotId: 'snapshot',
        next: null,
        entries: [{ ...entry(title), ...extra }],
        truncated: false,
        ...page,
      },
    });
  };
  return {
    ui,
    el,
    pending,
    calls,
    exports,
    opened,
    answer,
    query(text) {
      el('chronicle-search').value = text;
      el('chronicle-search').oninput();
    },
    cleanup() {
      ui.activateChronicle(null);
      Object.assign(globalThis, saved);
    },
  };
}
test('search and category reach Core; typing supersedes the old result before its reply arrives', async () => {
  const x = fixture();
  try {
    const first = x.ui.openChronicle();
    assert.equal(x.el('chronicle-export').disabled, true);
    x.query('Bronze');
    x.answer('Alt');
    await first;
    assert.equal(x.el('chronicle-list').childElementCount, 0);
    assert.equal(x.el('chronicle-export').disabled, true);
    const next = x.ui.openChronicle();
    assert.deepEqual(x.calls.at(-1), { token: 'one', category: 'all', search: 'Bronze' });
    x.answer('Bronzeschlüssel');
    await next;
    assert.match(x.el('chronicle-list').textContent, /Bronzeschlüssel/);
    assert.equal(x.el('chronicle-export').disabled, false);
    x.el('chronicle-category').value = 'party';
    x.el('chronicle-category').onchange();
    assert.equal(x.calls.at(-1).category, 'party');
    x.answer('Bronzeschlüssel');
    await tick();
    x.el('chronicle-export').onclick();
    await tick();
    assert.deepEqual(x.exports, [['one', 'party', 'Bronze']]);
  } finally {
    x.cleanup();
  }
});
test('a failed refresh replaces old events with an alert and blocks stale exports', async () => {
  const x = fixture();
  try {
    let task = x.ui.openChronicle();
    x.answer('Alt');
    await task;
    task = x.ui.openChronicle();
    assert.equal(x.el('chronicle-list').childElementCount, 0);
    x.pending.shift()({ ok: false, error: 'Lesen unterbrochen' });
    await task;
    assert.match(
      x.el('chronicle-list').querySelector('[role=alert]').textContent,
      /Lesen unterbrochen/,
    );
    assert.equal(x.el('chronicle').getAttribute('aria-busy'), 'false');
    assert.equal(x.el('chronicle-export').disabled, true);
    x.el('chronicle-export').onclick();
    await tick();
    assert.equal(x.exports.length, 0);
  } finally {
    x.cleanup();
  }
});
test('late results or failures from another campaign cannot overwrite its successor', async () => {
  const x = fixture();
  try {
    const old = x.ui.openChronicle();
    x.ui.activateChronicle({ token: 'two' });
    const next = x.ui.openChronicle();
    x.answer('Neue Kampagne', 1);
    await next;
    x.pending.shift()({ ok: false, error: 'Alter Fehler' });
    await old;
    assert.match(x.el('chronicle-list').textContent, /Neue Kampagne/);
    assert.equal(x.el('chronicle-list').querySelector('[role=alert]'), null);
    assert.equal(x.el('chronicle').getAttribute('aria-busy'), 'false');
  } finally {
    x.cleanup();
  }
});
test('rapid typing coalesces reads but immediately invalidates accepted results', async () => {
  const x = fixture();
  try {
    const task = x.ui.openChronicle();
    x.answer('Alt');
    await task;
    for (const q of ['B', 'Br', 'Bronze']) x.query(q);
    assert.equal(x.calls.length, 1);
    assert.equal(x.el('chronicle-list').childElementCount, 0);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(x.calls.length, 2);
    assert.equal(x.calls.at(-1).search, 'Bronze');
    x.answer('Bronzeschlüssel');
    await tick();
    assert.match(x.el('chronicle-list').textContent, /Bronzeschlüssel/);
  } finally {
    x.cleanup();
  }
});

test('an unavailable native bridge shows its usable cause without internal method names', async () => {
  const x = fixture();
  try {
    const task = x.ui.openChronicle();
    x.pending.shift()({
      ok: false,
      error: "Error invoking remote method 'campaign:chronicle': Error: Quelle nicht lesbar",
    });
    await task;
    const text = x.el('chronicle-list').querySelector('[role=alert]').textContent;
    assert.match(text, /Quelle nicht lesbar/);
    assert.doesNotMatch(text, /campaign:|remote method/);
    assert.equal(x.el('chronicle-export').disabled, true);
  } finally {
    x.cleanup();
  }
});

test('detached follow-up controls cannot navigate after search or campaign changes', async () => {
  const x = fixture();
  try {
    let task = x.ui.openChronicle();
    x.answer('Spur', 0, { followUp: { id: 'quest-one', kind: 'quest' } });
    await task;
    const old = x.el('chronicle-list').querySelector('button');
    old.click();
    await tick();
    assert.deepEqual(x.opened, [{ id: 'quest-one', token: 'one' }]);
    x.query('Neu');
    old.click();
    await tick();
    assert.equal(x.opened.length, 1);
    task = x.ui.openChronicle();
    x.answer('Neue Spur', 0, { followUp: { id: 'quest-two', kind: 'quest' } });
    await task;
    const next = x.el('chronicle-list').querySelector('button');
    x.ui.activateChronicle({ token: 'two' });
    next.click();
    await tick();
    assert.equal(x.opened.length, 1);
  } finally {
    x.cleanup();
  }
});

test('both navigation positions share the read cursor and lock while a page or export is pending', async () => {
  const x = fixture();
  try {
    const task = x.ui.openChronicle();
    x.answer('Neu', 0, {}, { next: { snapshotId: 'snapshot', after: null } });
    await task;
    assert.equal(x.el('chronicle-navigation-bottom').hidden, false);
    x.el('chronicle-next-bottom').onclick();
    for (const id of [
      'chronicle-next',
      'chronicle-next-bottom',
      'chronicle-previous',
      'chronicle-previous-bottom',
    ])
      assert.equal(x.el(id).disabled, true);
    assert.equal(x.calls.length, 2);
    x.el('chronicle-next').onclick();
    assert.equal(x.calls.length, 2);
    x.answer('Älter');
    await tick();
    assert.match(x.el('chronicle-count').textContent, /Seite 2/);
    assert.equal(x.el('chronicle-previous').disabled, false);
    assert.equal(x.el('chronicle-previous-bottom').disabled, false);
    assert.equal(x.el('chronicle-next').disabled, true);
    assert.equal(x.el('chronicle-next-bottom').disabled, true);
    const reads = x.calls.length;
    x.el('chronicle-export').onclick();
    assert.equal(x.el('chronicle-previous').disabled, true);
    assert.equal(x.el('chronicle-previous-bottom').disabled, true);
    x.el('chronicle-previous-bottom').onclick();
    assert.equal(x.calls.length, reads);
    await tick();
    x.el('chronicle-previous-bottom').onclick();
    x.answer('Neu');
    await tick();
    assert.match(x.el('chronicle-count').textContent, /Seite 1/);
    assert.equal(x.el('chronicle-navigation-bottom').hidden, true);
  } finally {
    x.cleanup();
  }
});
test('changing export scope removes the previous success message and labels all matching pages explicitly', async () => {
  const x = fixture();
  try {
    let task = x.ui.openChronicle();
    x.answer('Gesamt');
    await task;
    assert.equal(x.el('chronicle-export').textContent, 'Gesamte Chronik als Markdown…');
    x.el('chronicle-export').onclick();
    await tick();
    assert.match(x.el('chronicle-export-status').textContent, /gespeichert/);
    x.query('Bronze');
    assert.equal(x.el('chronicle-export-status').textContent, '');
    assert.equal(x.el('chronicle-export').textContent, 'Treffer als Markdown…');
    assert.equal(x.el('chronicle-export').disabled, true);
    task = x.ui.openChronicle();
    x.answer('Bronzeschlüssel');
    await task;
    assert.equal(x.el('chronicle-export').disabled, false);
  } finally {
    x.cleanup();
  }
});

test('page completion starts reading at the new page without taking a newer input focus', async () => {
  const x = fixture();
  try {
    let active = document.body,
      focused = 0;
    Object.defineProperty(document, 'activeElement', { get: () => active, configurable: true });
    x.el('chronicle-count').scrollIntoView = () => {};
    x.el('chronicle-count').focus = () => {
      focused++;
      active = x.el('chronicle-count');
    };
    const task = x.ui.openChronicle();
    x.answer('Neu', 0, {}, { next: { snapshotId: 'snapshot', after: null } });
    await task;
    active = x.el('chronicle-next-bottom');
    x.el('chronicle-next-bottom').onclick();
    active = x.el('chronicle-search');
    x.answer('Älter');
    await tick();
    assert.equal(focused, 0);
    active = document.body;
    x.el('chronicle-previous-bottom').onclick();
    x.answer('Neu');
    await tick();
    assert.equal(focused, 1);
    assert.equal(active, x.el('chronicle-count'));
  } finally {
    x.cleanup();
  }
});
