import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/creature-detail-ui.ts'],
  outfile: '.build/creature-detail-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { loadCreatureDetail } = createRequire(import.meta.url)('../.build/creature-detail-ui.cjs');
const creature = (id) => ({
  id,
  name: id,
  abilities: { str: 10 },
  traits: [],
  actions: [],
  legendaryActions: [],
});
const tick = () => new Promise((r) => setImmediate(r));
test('the shared detail pane reports failures locally and retries the same id read-only', async (t) => {
  const previous = { window: global.window, document: global.document },
    { window, document } = parseHTML('<html><body><section></section></body></html>');
  Object.assign(global, { window, document });
  t.after(() => Object.assign(global, previous));
  const root = document.querySelector('section'),
    reads = [];
  window.campaign = {
    creature: async (id) => {
      reads.push(id);
      return { ok: false, error: 'Kreatur nicht gefunden.' };
    },
  };
  await loadCreatureDetail(root, 'Goblin');
  assert.equal(root.getAttribute('aria-busy'), 'false');
  assert.equal(root.getAttribute('role'), 'alert');
  assert.match(root.textContent, /Kreatur nicht gefunden/);
  const snapshot = creature('Goblin'),
    before = JSON.stringify(snapshot);
  window.campaign.creature = async (id) => {
    reads.push(id);
    return { ok: true, value: snapshot };
  };
  root.querySelector('button').click();
  await tick();
  assert.deepEqual(reads, ['Goblin', 'Goblin']);
  assert.equal(root.querySelector('h3').textContent, 'Goblin');
  assert.equal(root.querySelectorAll('input,textarea,button').length, 0);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(root.getAttribute('role'), null);
});
test('late or mismatching detail replies cannot replace the current owner', async (t) => {
  const previous = { window: global.window, document: global.document },
    { window, document } = parseHTML('<html><body><section></section></body></html>');
  Object.assign(global, { window, document });
  t.after(() => Object.assign(global, previous));
  const root = document.querySelector('section');
  let release;
  window.campaign = { creature: () => new Promise((r) => (release = r)) };
  const old = loadCreatureDetail(root, 'Goblin');
  assert.match(root.textContent, /geladen/);
  window.campaign.creature = async () => ({ ok: true, value: creature('Guard') });
  await loadCreatureDetail(root, 'Guard');
  release({ ok: true, value: creature('Goblin') });
  await old;
  assert.equal(root.querySelector('h3').textContent, 'Guard');
  await loadCreatureDetail(root, 'Dragon');
  assert.match(root.textContent, /anderen Kreatur/);
  let current = true;
  window.campaign.creature = () => new Promise((r) => (release = r));
  const pending = loadCreatureDetail(root, 'Wolf', () => current);
  current = false;
  root.textContent = 'Neuer NSC';
  release({ ok: true, value: creature('Wolf') });
  await pending;
  assert.equal(root.textContent, 'Neuer NSC');
});
