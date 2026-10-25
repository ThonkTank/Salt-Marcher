import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/runtime/reward-items-ui.ts'],
  outfile: '.build/reward-items-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { rewardItemsEditor } = createRequire(import.meta.url)('../../.build/reward-items-ui.cjs');
test('catalog reward quantities retain identity and cannot silently become free definitions', (t) => {
  const old = globalThis.document,
    { window, document } = parseHTML('<html><body><div id="rows"></div></body></html>');
  globalThis.document = document;
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  t.after(() => (globalThis.document = old));
  const root = document.getElementById('rows'),
    reference = { kind: 'authored', definitionId: 'potion', revision: 1 },
    items = [{ name: 'Potion', category: 'magic', quantity: '3', valueGold: '50', reference }];
  let edits = 0;
  rewardItemsEditor(root, items, () => edits++, true);
  assert.equal(root.querySelectorAll('input').length, 1);
  assert.equal(root.querySelectorAll('select').length, 0);
  assert.match(root.textContent, /Potion.*50 Gold pro Stück.*Menge/s);
  const quantity = root.querySelector('input');
  quantity.value = '-';
  quantity.oninput();
  assert.equal(items[0].quantity, '-');
  assert.deepEqual(items[0].reference, reference);
  assert.equal(edits, 1);
  root.querySelector('button').click();
  assert.equal(items.length, 0);
  assert.equal(edits, 2);
});
test('legacy free reward fields have visible labels and keep unfinished raw input', (t) => {
  const old = globalThis.document,
    { window, document } = parseHTML('<html><body><div id="rows"></div></body></html>');
  globalThis.document = document;
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  t.after(() => (globalThis.document = old));
  const root = document.getElementById('rows'),
    items = [{ name: 'Old custom gem', category: 'other', quantity: '', valueGold: '1,5' }];
  rewardItemsEditor(root, items, () => {}, true);
  assert.deepEqual(
    [...root.querySelectorAll('label')].map((l) => l.firstChild.textContent),
    ['Gegenstand', 'Kategorie', 'Menge', 'Gold pro Stück'],
  );
  assert.equal(root.querySelector('[aria-label="Menge"]').value, '');
  assert.equal(root.querySelector('[aria-label="Wert pro Stück in Gold"]').value, '1,5');
});
