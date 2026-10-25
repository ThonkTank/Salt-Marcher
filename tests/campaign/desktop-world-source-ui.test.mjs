import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/campaign/world-source-ui.ts'],
  outfile: '.build/world-source-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
function fixture(t, onSave) {
  const { window, document } = parseHTML(
      '<html><body><fieldset id="generation-fields"></fieldset><section><select id="encounter-table-list"></select></section></body></html>',
    ),
    previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, previous));
  window.campaign = { creature: async () => ({ ok: true, value: { name: 'Guard' } }) };
  delete require.cache[require.resolve('../../.build/world-source-ui.cjs')];
  const ui = require('../../.build/world-source-ui.cjs'),
    saved = [],
    discards = [],
    created = [];
  ui.initWorldSourceUI(
    async (a) => {
      saved.push(structuredClone(a));
      return onSave ? onSave(a) : false;
    },
    () => {},
    (close) => discards.push(close),
    (accept) => created.push(accept),
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { configurable: true, writable: true, value: '' });
  const dialog = document.getElementById('world-source-manager');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  const data = {
      sources: [
        {
          kind: 'faction',
          id: 'faction',
          revision: 1,
          tableIds: ['table'],
          factionIds: [],
          stock: [{ creatureId: 'guard', limit: 2 }],
        },
        {
          kind: 'location',
          id: 'location',
          revision: 1,
          tableIds: [],
          factionIds: ['archived'],
          stock: [],
        },
      ],
      factions: [{ id: 'faction', name: 'Guards' }],
      locations: [{ id: 'location', name: 'Keep' }],
    },
    tables = [
      {
        id: 'table',
        name: 'Guards',
        entries: [{ creatureId: 'guard', weight: '1' }],
        trashed: false,
      },
    ];
  ui.setWorldSources(data, tables);
  const get = (id) => document.getElementById(id),
    open = (kind) => {
      get('source-' + kind).value = kind === 'faction' ? 'faction' : 'location';
      get('source-' + kind + '-edit').click();
    },
    submit = () => get('world-source-form').onsubmit({ preventDefault() {} });
  return { ui, data, tables, saved, discards, created, get, open, submit, dialog, window };
}
test('an unavailable faction link remains visible and saved until explicitly removed', async (t) => {
  const x = fixture(t);
  x.open('location');
  const c = x.get('source-faction-checks').querySelector('input[value=archived]');
  assert.ok(c);
  assert.equal(c.checked, true);
  assert.match(c.parentElement.textContent, /Nicht verfügbare/);
  x.submit();
  await tick();
  assert.deepEqual(x.saved[0].source.factionIds, ['archived']);
  c.checked = false;
  c.removeAttribute('checked');
  c.onchange();
  x.submit();
  await tick();
  assert.deepEqual(x.saved[1].source.factionIds, []);
});
test('a background source read preserves entered stock text and its original revision', async (t) => {
  const x = fixture(t);
  x.open('faction');
  const input = x.get('source-stock').querySelector('input');
  input.value = '01';
  input.oninput();
  const newer = structuredClone(x.data);
  newer.sources[0].revision = 2;
  newer.sources[0].stock[0].limit = 5;
  x.ui.setWorldSources(newer, x.tables);
  assert.equal(x.get('source-stock').querySelector('input'), input);
  assert.equal(input.value, '01');
  x.submit();
  await tick();
  assert.equal(x.saved[0].expectedRevision, 1);
  assert.equal(x.saved[0].source.stock[0].limit, 1);
});
test('a faction source displays its saved disposition and retains later raw input through refresh', async (t) => {
  const x = fixture(t);
  x.data.sources[0].disposition = -2;
  x.ui.setWorldSources(x.data, x.tables);
  x.open('faction');
  const input = x.get('source-disposition');
  assert.equal(input.value, '-2');
  input.value = '-01';
  input.oninput();
  const newer = structuredClone(x.data);
  newer.sources[0].disposition = 3;
  x.ui.setWorldSources(newer, x.tables);
  assert.equal(input.value, '-01');
  x.submit();
  await tick();
  assert.equal(x.saved[0].source.disposition, -1);
  assert.equal(x.saved[0].expectedRevision, 1);
});

for (const route of ['button', 'escape'])
  test(`changed world-source raw fields survive ${route} until explicit discard`, async (t) => {
    const x = fixture(t);
    x.open('faction');
    const input = x.get('source-stock').querySelector('input');
    input.value = '02';
    input.oninput();
    const close = () => {
      if (route === 'button') x.get('source-close').click();
      else {
        const e = new x.window.Event('cancel', { cancelable: true });
        x.dialog.dispatchEvent(e);
        assert.equal(e.defaultPrevented, true);
      }
    };
    close();
    assert.equal(x.dialog.open, true);
    assert.equal(x.ui.worldSourceOpen(), true);
    assert.equal(x.discards.length, 1);
    assert.equal(input.value, '02');
    assert.equal(x.saved.length, 0);
    // Keeping the editor means not invoking the captured discard callback.
    input.value = '3';
    input.oninput();
    close();
    assert.equal(x.discards.length, 2);
    x.discards[1]();
    assert.equal(x.dialog.open, false);
    assert.equal(x.ui.worldSourceOpen(), false);
  });
test('unchanged source closes immediately but Escape during pending rejected save preserves its editor', async (t) => {
  let release;
  const x = fixture(t, () => new Promise((r) => (release = r)));
  x.open('faction');
  x.get('source-close').click();
  assert.equal(x.dialog.open, false);
  assert.equal(x.discards.length, 0);
  x.open('faction');
  const input = x.get('source-stock').querySelector('input');
  input.value = '5';
  input.oninput();
  x.submit();
  x.submit();
  assert.equal(x.saved.length, 1);
  const e = new x.window.Event('cancel', { cancelable: true });
  x.dialog.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true);
  x.get('source-close').click();
  assert.equal(x.dialog.open, true);
  assert.equal(x.discards.length, 0);
  assert.equal(x.ui.worldSourceOpen(), true);
  release(false);
  await tick();
  assert.equal(x.dialog.open, true);
  assert.equal(input.value, '5');
  x.get('source-close').click();
  assert.equal(x.discards.length, 1);
  x.submit();
  assert.equal(x.saved.length, 2);
  release(true);
  await tick();
  assert.equal(x.dialog.open, false);
  assert.equal(x.ui.worldSourceOpen(), false);
});
test('old discard and save callbacks cannot close an editor after a context reset', async (t) => {
  let release;
  const x = fixture(t, () => new Promise((r) => (release = r)));
  x.open('faction');
  x.get('source-disposition').value = '7';
  x.get('source-disposition').oninput();
  x.get('source-close').click();
  assert.equal(x.discards.length, 1);
  x.submit();
  x.ui.setWorldSources(x.data, x.tables, true);
  x.open('location');
  x.discards[0]();
  assert.equal(x.dialog.open, true);
  assert.equal(x.ui.worldSourceOpen(), true);
  release(true);
  await tick();
  assert.equal(x.dialog.open, true);
  assert.equal(x.get('source-title').textContent, 'Ortsquellen: Keep');
});

test('inline table creation only changes the owned faction primary and preserves shared raw stock', async (t) => {
  const x = fixture(t);
  x.open('faction');
  assert.equal(x.get('source-table-checks').querySelectorAll('input').length, 0);
  assert.equal(x.get('source-stock').querySelectorAll('input').length, 1);
  const disposition = x.get('source-disposition'),
    stock = x.get('source-stock').querySelector('input');
  disposition.value = '-01';
  disposition.oninput();
  stock.value = '05';
  stock.oninput();
  x.get('source-table-new').click();
  assert.equal(x.created.length, 1);
  assert.equal(x.saved.length, 0);
  assert.equal(x.get('source-primary').value, 'table');
  const created = { ...x.tables[0], id: 'new-table', name: 'New Guards', revision: 1 };
  x.created[0](created);
  assert.equal(x.get('source-primary').value, 'new-table');
  assert.equal(disposition.value, '-01');
  assert.equal(x.get('source-stock').querySelector('input').value, '05');
  x.submit();
  await tick();
  assert.deepEqual(x.saved[0].source.tableIds, ['new-table']);
  assert.equal(x.saved[0].source.disposition, -1);
  assert.equal(x.saved[0].source.stock[0].limit, 5);
  assert.equal(x.saved[0].expectedRevision, 1);
});
test('inline table response cannot select a primary in another source context', (t) => {
  const x = fixture(t);
  x.open('faction');
  x.get('source-table-new').click();
  assert.equal(x.created.length, 1);
  x.ui.setWorldSources(x.data, x.tables, true);
  x.open('location');
  x.created[0]({ ...x.tables[0], id: 'new-table' });
  assert.equal(x.get('source-title').textContent, 'Ortsquellen: Keep');
  assert.equal(x.get('source-table-checks').querySelectorAll('input:checked').length, 0);
  assert.equal(x.saved.length, 0);
});
