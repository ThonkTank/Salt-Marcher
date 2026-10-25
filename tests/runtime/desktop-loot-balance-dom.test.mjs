import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/progression-ui.ts'],
  outfile: '.build/loot-balance-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let n = 0; n < 300 && !check(); n++) await tick();
  assert.ok(check());
}
function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, saved));
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const ok = (value) => ({ ok: true, value });
  window.campaign = {
    progress: async () => ok({ characters: [], notices: [] }),
    ledgerParties: async () => ok([]),
    treasures: async () => ok({ items: [], next: null }),
    lootBalance: async () => ok({ characters: [], leaderCopper: '0', suggestedCharacterIds: [] }),
  };
  delete require.cache[path.resolve('.build/loot-balance-dom.cjs')];
  const ui = require('../../.build/loot-balance-dom.cjs');
  ui.initProgress(() => {});
  const context = (id) =>
      ui.progressionContext(
        { token: id, campaign: { id } },
        { roster: [], rosterRevision: 0, focusId: null },
        null,
      ),
    row = (name, unknownEntries = 0) => ({
      characterId: name,
      name,
      active: true,
      copper: '200',
      unknownEntries,
      gapCopper: '0',
    });
  return {
    window,
    document,
    context,
    row,
    text: () => document.getElementById('loot-balance-list').textContent,
  };
}
test('late campaign A balance cannot replace the current campaign B comparison', async (t) => {
  const x = fixture(t);
  let finishA;
  x.window.campaign.lootBalance = (token) =>
    token === 'A'
      ? new Promise((resolve) => {
          finishA = () =>
            resolve({
              ok: true,
              value: {
                characters: [x.row('Iri A')],
                leaderCopper: '200',
                suggestedCharacterIds: ['Iri A'],
              },
            });
        })
      : Promise.resolve({
          ok: true,
          value: {
            characters: [x.row('Dorn B')],
            leaderCopper: '200',
            suggestedCharacterIds: ['Dorn B'],
          },
        });
  x.context('A');
  await until(() => !!finishA);
  x.context('B');
  await until(() => x.text().includes('Dorn B'));
  finishA();
  await tick();
  await tick();
  assert.match(x.text(), /Dorn B/);
  assert.doesNotMatch(x.text(), /Iri A/);
});
test('incomplete comparison labels a partial value and does not claim a leading character', async (t) => {
  const x = fixture(t);
  x.window.campaign.lootBalance = async () => ({
    ok: true,
    value: {
      characters: [x.row('Iri', 1), x.row('Dorn')],
      leaderCopper: '200',
      suggestedCharacterIds: [],
    },
  });
  x.context('A');
  await until(() => x.text().includes('Iri'));
  assert.match(x.text(), /Teilwert/);
  assert.match(x.text(), /Vergleich offen/);
  assert.doesNotMatch(x.text(), /Spitze|Nächste wertbare Belohnung/);
});
