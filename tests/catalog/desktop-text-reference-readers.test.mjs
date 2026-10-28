import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
import { freshFixtureModule } from '../helpers/fixture-lifecycle.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
buildSync({
  entryPoints: ['src/app/catalog/quick-reference-ui.ts'],
  outfile: '.build/text-reference-readers.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
const settle = async () => {
  for (let n = 0; n < 8; n++) await new Promise((r) => setImmediate(r));
};
function fixture(t) {
  const { window, document } = parseHTML(readWorkspaceMarkup());
  const prior = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, prior));
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.select = () => {};
  const anchor = document.createElement('button');
  anchor.id = 'narrative-journal-open';
  document.body.append(anchor);
  const actions = [],
    messages = [];
  const ui = freshFixtureModule(require, '../../.build/text-reference-readers.cjs');
  ui.initQuickReference(
    (text) => messages.push(text),
    async () => true,
    async (action) => actions.push(action),
  );
  const el = (id) => document.getElementById(id);
  Object.defineProperty(el('quick-kind'), 'value', { value: 'reference', writable: true });
  ui.activateQuickReference({ token: 'token', campaign: { id: 'campaign' } });
  el('quick-kind').value = 'reference';
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
  await x.ui.openQuickReference();
  await settle();
  assert.match(x.el('quick-results').textContent, /unvollständig/);
  assert.doesNotMatch(x.el('quick-results').textContent, /Keine Treffer\./);
  assert.match(x.el('quick-search-status').textContent, /unvollständig/);
});

test('the bounded reader states its limit across read-aloud and GM fields', async (t) => {
  const x = fixture(t),
    ref = { kind: 'note', id: 'source' };
  const links = Array.from({ length: 250 }, (_, i) => `[Alias${i}](dungeon-ref:note/target)`);
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
  await x.ui.openQuickReference(ref);
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
  await x.ui.openQuickReference(ref);
  const b = x.el('quick-use-read-aloud');
  assert(b, 'the original source has a genuine scene handoff control');
  x.ui.activateQuickReference({ token: 'other', campaign: { id: 'other' } });
  b.onclick();
  await settle();
  assert.deepEqual(x.actions, []);
  assert.deepEqual(x.messages, []);
});
