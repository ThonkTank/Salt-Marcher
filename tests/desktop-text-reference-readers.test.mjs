import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url),
  src = readFileSync('src/app/quick-reference-ui.ts', 'utf8');
buildSync({
  stdin: {
    contents: src + '\nexport const __quickProbe={search,openContent};',
    resolveDir: path.resolve('src/app'),
    loader: 'ts',
    sourcefile: 'quick-source-review.ts',
  },
  outfile: '.build/quick-source-review.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const tick = () => new Promise((r) => setImmediate(r));
async function settle() {
  for (let i = 0; i < 8; i++) await tick();
}
function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    prior = Object.fromEntries(['window', 'document'].map((k) => [k, globalThis[k]]));
  Object.assign(globalThis, { window, document });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  const anchor = document.createElement('button');
  anchor.id = 'narrative-journal-open';
  document.body.append(anchor);
  const actions = [],
    messages = [];
  delete require.cache[require.resolve('../.build/quick-source-review.cjs')];
  const ui = require('../.build/quick-source-review.cjs');
  ui.initQuickReference(
    (text) => messages.push(text),
    async () => true,
    async (a) => actions.push(a),
  );
  ui.activateQuickReference({ token: 'token', campaign: { id: 'campaign' } });
  const el = (id) => document.getElementById(id);
  Object.defineProperty(el('quick-kind'), 'value', { value: 'reference', writable: true });
  el('quick-reference').open = true;
  t.after(() => Object.assign(globalThis, prior));
  return { window, document, ui, el, actions, messages };
}
test('an incomplete empty alias source is not presented as a verified absence', async (t) => {
  const x = fixture(t);
  x.window.campaign = {
    searchDesk: async () => ({
      ok: true,
      value: {
        entries: [],
        next: null,
        notice: 'Textverweise unvollständig: eine Quelle nicht gelesen.',
      },
    }),
  };
  await x.ui.__quickProbe.search();
  assert.match(x.el('quick-results').textContent, /unvollständig/);
  assert.doesNotMatch(x.el('quick-results').textContent, /Keine Treffer\./);
  assert.match(x.el('quick-search-status').textContent, /unvollständig/);
});

test('the bounded reader states its limit across read-aloud and GM fields', async (t) => {
  const x = fixture(t),
    ref = { kind: 'note', id: 'source' },
    links = Array.from({ length: 250 }, (_, i) => `[Alias${i}](dungeon-ref:note/target)`);
  x.window.campaign = {
    deskContent: async () => ({
      ok: true,
      value: {
        ref,
        revision: 1,
        title: 'Quelle',
        label: 'Notiz',
        referenceNotice: 'Nur ein Teil der Textverweise wird angezeigt. Weitere Ziele suchen.',
        note: { readAloud: links.slice(0, 150).join('\n'), gmNotes: links.slice(150).join('\n') },
      },
    }),
    live: async () => ({ ok: true, value: { scene: null } }),
  };
  await x.ui.__quickProbe.openContent(ref);
  assert.equal(x.el('quick-document').querySelectorAll('.text-reference-inline').length, 200);
  assert.match(x.el('quick-document').textContent, /Weitere Ziele suchen/);
  assert.match(x.el('quick-document').textContent, /Alias249/);
});

test('a detached reader control cannot report an old failure after a campaign switch', async (t) => {
  const x = fixture(t),
    ref = { kind: 'note', id: 'source' };
  x.window.campaign = {
    deskContent: async () => ({
      ok: true,
      value: {
        ref,
        revision: 1,
        title: 'Quelle',
        label: 'Notiz',
        note: { readAloud: 'Text', gmNotes: '' },
      },
    }),
    live: async () => ({
      ok: true,
      value: { focusId: 'scene', focusRevision: 1, scene: { id: 'scene', title: 'Gruppe' } },
    }),
    sceneDesk: async () => ({ ok: true, value: { revision: 1, pins: [] } }),
  };
  await x.ui.__quickProbe.openContent(ref);
  const b = x.el('quick-use-read-aloud');
  x.ui.activateQuickReference({ token: 'other', campaign: { id: 'other' } });
  b.onclick();
  await settle();
  assert.deepEqual(x.actions, []);
  assert.deepEqual(x.messages, []);
});
