import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/party-topbar-ui.ts'],
  outfile: '.build/party-search-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(process.cwd() + '/package.json'),
  tick = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t) {
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  const el = (id) => document.getElementById('party-' + id);
  window.innerWidth = 1000;
  window.innerHeight = 800;
  window.localStorage = { getItem: () => null, setItem() {} };
  el('shortcut').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false;
  el('popover').matches = () => open;
  el('popover').showPopover = () => {
    open = true;
  };
  el('popover').hidePopover = () => {
    open = false;
  };
  Object.defineProperty(el('level'), 'value', { value: '', writable: true });
  const roster = Array.from({ length: 45 }, (_, i) => ({
      id: 'pc-' + String(i).padStart(3, '0'),
      ordinal: i,
      profile: {
        name: i < 2 ? 'Iri' : 'Figur ' + i,
        playerName: i === 1 ? 'Lea' : 'Spieler ' + i,
        characterClass: i === 3 ? 'Druid' : 'Fighter',
        species: 'Human',
        speedFeet: 30,
        languages: i === 4 ? ['Common', 'Guaraní'] : ['Common'],
      },
      active: i < 2,
      sceneId: i < 2 ? 'scene' : null,
      profileRevision: 0,
      membershipRevision: 0,
    })),
    before = JSON.stringify(roster);
  let writes = 0;
  window.campaign = {
    live: async () => ({
      ok: true,
      value: {
        roster,
        focusId: 'scene',
        scene: { id: 'scene', title: 'Rosterrunde', members: ['pc-000', 'pc-001'] },
        scenes: [],
      },
    }),
    progress: async () => ({ ok: true, value: { characters: [] } }),
    executeLive: async () => {
      writes++;
      throw new Error('Search must not write');
    },
  };
  delete require.cache[require.resolve(process.cwd() + '/.build/party-search-ui.cjs')];
  const ui = require(process.cwd() + '/.build/party-search-ui.cjs');
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar({ token: 'party-search' });
  t.after(() => {
    ui.activatePartyTopbar(null);
    Object.assign(globalThis, previous);
  });
  el('shortcut').onclick();
  await tick();
  const rows = () => [...el('roster').querySelectorAll('.party-card')],
    search = (text) => {
      el('search').value = text;
      el('search').oninput();
      return rows().map((row) => row.dataset.characterId);
    };
  return { el, rows, search, roster, before, writes: () => writes };
}
test('roster search matches actual names, players, IDs and profile values without matching serialized field names or syntax', async (t) => {
  const x = await fixture(t);
  for (const query of ['playerName', 'speedFeet', 'characterClass', 'languages', '[', '"'])
    assert.deepEqual(x.search(query), [], query);
  for (const [query, ids] of [
    [' iRi ', ['pc-000', 'pc-001']],
    ['LEA', ['pc-001']],
    ['pc-044', ['pc-044']],
    ['druid', ['pc-003']],
    ['GUARANÍ', ['pc-004']],
  ])
    assert.deepEqual(x.search(query), ids, query);
  assert.equal(x.search('30').length, 40);
  assert.equal(x.writes(), 0);
  assert.equal(JSON.stringify(x.roster), x.before);
});
test('filtering a45-character roster resets paging and preserves expansion and the selected rest recipients', async (t) => {
  const x = await fixture(t);
  assert.equal(x.rows().length, 40);
  x.el('roster')
    .querySelectorAll('button')
    .item(x.el('roster').querySelectorAll('button').length - 1)
    .click();
  assert.equal(x.rows().length, 45);
  const picks = [...x.el('rest-members').querySelectorAll('input')];
  assert.equal(picks.length, 2);
  picks[1].checked = false;
  const expanded = x.rows()[0];
  expanded.querySelector('.party-member-toggle').click();
  assert.equal(expanded.querySelector('.party-card-details').hidden, false);
  assert.deepEqual(x.search('Iri'), ['pc-000', 'pc-001']);
  assert.equal(x.rows()[0].querySelector('.party-card-details').hidden, false);
  assert.deepEqual(x.search('Figur 44'), ['pc-044']);
  assert.equal(x.search('').length, 40);
  assert.equal(x.rows()[0].querySelector('.party-card-details').hidden, false);
  assert.equal(picks[1].isConnected, true);
  assert.deepEqual(
    picks.map((p) => [p.value, p.checked]),
    [
      ['pc-000', true],
      ['pc-001', false],
    ],
  );
  assert.equal(x.writes(), 0);
  assert.equal(JSON.stringify(x.roster), x.before);
});
