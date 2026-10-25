import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
const base = '.build/planner-xp-rest-corrections';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {changeCharacterXp} from './src/app/party-xp-model';export {xpLevel,restFrame} from './src/app/progression';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/party-topbar-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore, changeCharacterXp, xpLevel, restFrame } = require('../' + base + '/store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'xp-rest-')),
    x = { root, file: path.join(root, 'store.sqlite') };
  x.store = new CampaignStore(x.file);
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('XP und Rasten');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.hero = x.store.executeLive(
    x.command({ kind: 'create-character', profile: { name: 'Ada' } }),
  ).character;
  let live = x.store.live(x.w.token);
  x.scene = x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }),
  ).scene;
  live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: x.hero.id,
      expectedRevision: x.hero.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  x.p = () => x.store.progress(x.w.token).characters.find((c) => c.characterId === x.hero.id);
  x.xp = (mode, amount, extra = {}) =>
    x.store.executeProgress(
      x.command({
        kind: 'xp',
        characterId: x.hero.id,
        expectedRevision: x.p().revision,
        mode,
        amount,
        reason: 'Korrektur mit Herkunft',
        ...extra,
      }),
    );
  x.award = (poolXp, loadXp) => {
    const live = x.store.live(x.w.token),
      p = x.p(),
      member = live.roster.find((c) => c.id === x.hero.id);
    return x.store.executeProgress(
      x.command({
        kind: 'party-award',
        expectedRosterRevision: live.rosterRevision,
        poolXp,
        loadXp,
        reason: 'Getrennte Leistung und Belastung',
        participants: [
          {
            characterId: x.hero.id,
            revision: p.revision,
            membershipRevision: member.membershipRevision,
            receiveXp: poolXp > 0,
            receiveLoad: loadXp > 0,
          },
        ],
      }),
    );
  };
  x.rest = (rest) =>
    x.store.executeProgress(
      x.command({
        kind: 'rest',
        rest,
        recipients: [{ characterId: x.hero.id, revision: x.p().revision }],
      }),
    );
  return x;
}
test('correction crosses level floors to zero while early-short-rest facts survive preview, write, replay and Fresh', (t) => {
  const x = fixture(t);
  x.xp('set', 1000);
  x.award(0, 240);
  x.rest('short');
  x.award(0, 100);
  const before = x.p(),
    expected = changeCharacterXp(before, 'subtract', 950);
  assert.equal(expected.after.xp, 50);
  assert.equal(xpLevel(expected.after.xp).level, 1);
  assert.deepEqual(expected.after.rest, before.rest);
  const source = x.store
      .progressHistory(x.w.token, x.hero.id, null)
      .items.find((e) => e.kind === 'party-award-member'),
    command = x.command({
      kind: 'xp',
      characterId: x.hero.id,
      expectedRevision: before.revision,
      mode: 'subtract',
      amount: 950,
      reason: 'XP irrtümlich eingetragen',
      correctionOf: source.id,
    });
  x.store.executeProgress(command);
  assert.equal(x.p().xp, 50);
  assert.deepEqual(x.p().rest, before.rest);
  assert.equal(restFrame(x.p()).overdue, true);
  const original = x.store
    .progressHistory(x.w.token, x.hero.id, null)
    .items.find((e) => e.id === source.id);
  assert.deepEqual(original, source);
  const bytes = x.store.db.serialize();
  x.store.executeProgress(command);
  assert.ok(x.store.db.serialize().equals(bytes));
  const history = x.store.progressHistory(x.w.token, x.hero.id, null).items[0];
  assert.equal(history.facts.appliedDelta, -950);
  assert.equal(history.facts.correctionOf, source.id);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.equal(x.p().xp, 50);
  assert.deepEqual(x.p().rest, before.rest);
  x.xp('subtract', Number.MAX_SAFE_INTEGER);
  assert.equal(x.p().xp, 0);
  assert.deepEqual(x.p().rest, before.rest);
});
test('all correction modes preserve two completed rest sections and short consumption', (t) => {
  const x = fixture(t);
  x.xp('set', 1000);
  x.award(0, 240);
  x.rest('short');
  x.award(0, 180);
  x.rest('short');
  x.award(0, 50);
  const rest = structuredClone(x.p().rest);
  for (const [mode, amount] of [
    ['add', 3000],
    ['set', 120],
    ['subtract', 200],
  ]) {
    const before = x.p(),
      expected = changeCharacterXp(before, mode, amount);
    x.xp(mode, amount);
    assert.equal(x.p().xp, expected.after.xp);
    assert.deepEqual(x.p().rest, rest);
  }
  x.rest('short');
  assert.equal(x.p().rest.shortXp, 0);
  assert.equal(x.p().rest.baseline, rest.baseline);
  assert.equal(x.p().rest.sections, 2);
  x.rest('long');
  assert.deepEqual(x.p().rest, { known: true, longXp: 0, shortXp: 0, baseline: 0, sections: 0 });
});
test('load-only settlement retains unknown XP and a rejected unknown subtraction has no effects', (t) => {
  const x = fixture(t);
  x.award(0, 45);
  assert.equal(x.p().xp, null);
  assert.equal(restFrame(x.p()), null);
  const before = x.store.db.serialize();
  assert.throws(() => x.xp('subtract', 1), /bisherigen XP/);
  assert.ok(x.store.db.serialize().equals(before));
  x.xp('set', 0);
  assert.equal(x.p().rest.longXp, 45);
});
test('actual party popup previews a downward level correction and never claims rest counters are subtracted', async (t) => {
  const x = fixture(t);
  x.xp('set', 1000);
  x.award(0, 240);
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, saved));
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  window.innerWidth = 1000;
  window.innerHeight = 800;
  document.getElementById('party-shortcut').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false;
  const pop = document.getElementById('party-popover');
  pop.matches = () => open;
  pop.showPopover = () => {
    open = true;
  };
  pop.hidePopover = () => {
    open = false;
  };
  window.campaign = {
    live: async (token) => ({ ok: true, value: x.store.live(token) }),
    progress: async (token) => ({ ok: true, value: x.store.progress(token) }),
  };
  delete require.cache[require.resolve('../' + base + '/ui.cjs')];
  const ui = require('../' + base + '/ui.cjs');
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar(x.w);
  document.getElementById('party-shortcut').onclick();
  for (let i = 0; i < 30 && !document.querySelector('.party-level-meter'); i++)
    await new Promise((r) => setTimeout(r, 5));
  document.querySelector('.party-level-meter').onclick();
  const mode = document.getElementById('party-xp-mode'),
    amount = document.getElementById('party-xp-amount');
  mode.value = 'subtract';
  amount.value = '950';
  amount.oninput();
  const text = document.getElementById('party-xp-preview').textContent;
  assert.match(text, /50 XP · Level 1/);
  assert.match(text, /Rastbelastung bleibt erhalten/);
  assert.doesNotMatch(text, /floor|Zähler sinken/i);
  assert.doesNotMatch(mode.textContent, /floor/i);
});
