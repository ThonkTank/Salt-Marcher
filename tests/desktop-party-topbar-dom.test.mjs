import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';

buildSync({
  entryPoints: ['src/app/party-topbar-ui.ts'],
  outfile: '.build/party-topbar-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
test('setting XP requires an explicit number; blank input never becomes a zero-XP preview or write', async (t) => {
  const previous = { window: globalThis.window, document: globalThis.document },
    dom = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window: dom.window, document: dom.document });
  delete require.cache[require.resolve('../.build/party-topbar-dom.cjs')];
  const ui = require('../.build/party-topbar-dom.cjs'),
    get = (id) => dom.document.getElementById('party-' + id);
  dom.window.innerWidth = 1000;
  dom.window.innerHeight = 800;
  get('shortcut').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false;
  get('popover').matches = () => open;
  get('popover').showPopover = () => {
    open = true;
  };
  get('popover').hidePopover = () => {
    open = false;
  };
  Object.defineProperty(get('xp-mode'), 'value', {
    value: 'set',
    writable: true,
  });
  Object.defineProperty(get('level'), 'value', { value: '', writable: true });
  const character = {
    id: 'ada',
    profile: { name: 'Ada' },
    active: true,
    sceneId: null,
    profileRevision: 0,
    membershipRevision: 0,
  };
  dom.window.campaign = {
    live: async () => ({
      ok: true,
      value: { roster: [character], focusId: null, scene: null },
    }),
    progress: async () => ({
      ok: true,
      value: {
        characters: [
          {
            characterId: 'ada',
            xp: 290,
            revision: 1,
            rest: { known: false },
            health: null,
          },
        ],
      },
    }),
  };
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar({ token: 'owner' });
  t.after(() => {
    ui.activatePartyTopbar(null);
    Object.assign(globalThis, previous);
  });
  get('shortcut').onclick();
  await tick();
  get('active').querySelector('.party-level-meter').onclick();
  assert.equal(get('xp-amount').value, '', 'opening must not offer an implicit zero overwrite');
  get('xp-mode').value = 'set';
  get('xp-amount').value = '';
  get('xp-amount').oninput();
  assert.match(get('xp-preview').textContent, /ganze XP eintragen/);
  get('xp-form').onsubmit({ preventDefault() {} });
  assert.match(get('xp-status').textContent, /ganze XP eintragen/);
  assert.equal(get('xp-editor').hidden, false);
  get('xp-amount').value = '0';
  get('xp-amount').oninput();
  assert.match(get('xp-preview').textContent, /Danach 0 XP/);
});

async function refreshedXpFixture(t, withScene = false) {
  const previous = { window: globalThis.window, document: globalThis.document },
    dom = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window: dom.window, document: dom.document });
  delete require.cache[require.resolve('../.build/party-topbar-dom.cjs')];
  const ui = require('../.build/party-topbar-dom.cjs'),
    get = (id) => dom.document.getElementById('party-' + id);
  dom.window.innerWidth = 1000;
  dom.window.innerHeight = 800;
  get('shortcut').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false;
  get('popover').matches = () => open;
  get('popover').showPopover = () => (open = true);
  get('popover').hidePopover = () => (open = false);
  Object.defineProperty(get('xp-mode'), 'value', { value: 'add', writable: true });
  Object.defineProperty(get('level'), 'value', { value: '', writable: true });
  const character = {
      id: 'ada',
      profile: { name: 'Ada' },
      active: true,
      sceneId: null,
      profileRevision: 0,
      membershipRevision: 0,
    },
    progress = { characterId: 'ada', xp: 290, revision: 1, rest: { known: false }, health: null };
  let fail = false,
    missing = false,
    release = null;
  dom.window.campaign = {
    live: async () => ({
      ok: true,
      value: {
        roster: missing
          ? []
          : [{ ...structuredClone(character), sceneId: withScene ? 'scene-a' : null }],
        rosterRevision: 1,
        focusRevision: 1,
        focusId: withScene ? 'scene-a' : null,
        scene: withScene ? { id: 'scene-a', members: ['ada'], membershipRevision: 1 } : null,
      },
    }),
    progress: async () => {
      if (fail) return { ok: false, error: 'Speicher nicht lesbar' };
      const reply = { ok: true, value: { characters: missing ? [] : [structuredClone(progress)] } };
      if (release === true) return new Promise((r) => (release = () => r(reply)));
      return reply;
    },
  };
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar({ token: 'owner' });
  t.after(() => {
    ui.activatePartyTopbar(null);
    Object.assign(globalThis, previous);
  });
  get('shortcut').onclick();
  await tick();
  get('active').querySelector('.party-level-meter').onclick();
  get('xp-amount').value = '10';
  get('xp-amount').oninput();
  get('xp-reason').value = '  Korrektur behalten  ';
  return {
    get,
    character,
    progress,
    fail: (value) => (fail = value),
    missing: (value) => (missing = value),
    hold: () => (release = true),
    release: () => release(),
    refresh: async () => {
      get('refresh').onclick();
      await tick();
    },
  };
}
for (const [mode, expected] of [
  ['add', 320],
  ['subtract', 300],
  ['set', 10],
])
  test(`open XP ${mode} preview follows a refreshed snapshot while retaining the raw intent`, async (t) => {
    const x = await refreshedXpFixture(t);
    x.get('xp-mode').value = mode;
    x.get('xp-amount').oninput();
    x.progress.xp = 310;
    x.progress.revision = 2;
    x.character.profile.name = 'Ada neu';
    await x.refresh();
    assert.match(x.get('xp-preview').textContent, new RegExp('Danach ' + expected + ' XP'));
    assert.match(x.get('xp-title').textContent, /Ada neu/);
    assert.equal(x.get('xp-amount').value, '10');
    assert.equal(x.get('xp-reason').value, '  Korrektur behalten  ');
    assert.equal(x.get('xp-editor').hidden, false);
  });
for (const kind of ['failed', 'missing'])
  test(`a ${kind} XP basis blocks confirmation until a successful read without losing its fields`, async (t) => {
    const x = await refreshedXpFixture(t);
    if (kind === 'failed') x.fail(true);
    else x.missing(true);
    await x.refresh();
    assert.equal(x.get('xp-form').querySelector('button[type="submit"]').disabled, true);
    assert.doesNotMatch(x.get('xp-preview').textContent, /Danach 300 XP/);
    assert.match(x.get('xp-preview').textContent, /aktualisieren|verfügbar/);
    assert.equal(x.get('xp-amount').value, '10');
    assert.equal(x.get('xp-reason').value, '  Korrektur behalten  ');
    x.fail(false);
    x.missing(false);
    x.progress.xp = 310;
    x.progress.revision = 2;
    await x.refresh();
    assert.equal(x.get('xp-form').querySelector('button[type="submit"]').disabled, false);
    assert.match(x.get('xp-preview').textContent, /Danach 10 XP/);
  });

test('a pending XP refresh removes old confirmation authority and restores only the accepted basis', async (t) => {
  const x = await refreshedXpFixture(t);
  assert.equal(x.get('xp-form').querySelector('button[type="submit"]').disabled, false);
  x.progress.xp = 310;
  x.progress.revision = 2;
  x.hold();
  await x.refresh();
  assert.equal(x.get('xp-form').querySelector('button[type="submit"]').disabled, true);
  assert.match(x.get('xp-preview').textContent, /aktualisiert/);
  x.get('xp-form').onsubmit({ preventDefault() {} });
  assert.match(x.get('xp-status').textContent, /aktualisieren/);
  x.release();
  await tick();
  assert.match(x.get('xp-preview').textContent, /Danach 10 XP/);
  assert.equal(x.get('xp-form').querySelector('button[type="submit"]').disabled, false);
});
test('refreshing the XP basis preserves an unfinished raw amount for correction', async (t) => {
  const x = await refreshedXpFixture(t);
  x.get('xp-amount').value = '';
  x.get('xp-amount').oninput();
  x.progress.xp = 310;
  x.progress.revision = 2;
  await x.refresh();
  assert.equal(x.get('xp-amount').value, '');
  assert.match(x.get('xp-preview').textContent, /ganze XP eintragen/);
  assert.equal(x.get('xp-reason').value, '  Korrektur behalten  ');
});

test('compact XP actions preview each operation and retain the draft when the live writer is unavailable', async (t) => {
  const x = await refreshedXpFixture(t);
  assert.equal(x.get('popover').classList.contains('party-editing-xp'), true);
  assert.match(x.get('xp-current').textContent, /290 XP/);
  x.get('xp-amount').value = '250';
  x.get('xp-subtract').onfocus();
  assert.match(x.get('xp-preview').textContent, /− 250 XP.*Danach 40 XP/);
  x.get('xp-subtract').onclick();
  await tick();
  assert.equal(x.get('xp-editor').hidden, false);
  assert.equal(x.get('xp-amount').value, '250');
  assert.match(x.get('xp-status').textContent, /Buchungsstatus|Speicherfehler/);
  x.get('xp-add').onfocus();
  assert.match(x.get('xp-preview').textContent, /\+ 250 XP.*Danach 540 XP/);
  x.get('xp-form').querySelector('button[type=submit]').onfocus();
  assert.match(x.get('xp-preview').textContent, /Gesamtstand setzen.*Danach 250 XP/);
  x.get('xp-cancel').onclick();
  assert.equal(x.get('popover').classList.contains('party-editing-xp'), false);
});

test('a roster-opening read delivered after Party dismissal cannot reopen the editor', async (t) => {
  const x = await refreshedXpFixture(t, true);
  x.get('xp-cancel').onclick();
  x.hold();
  x.get('roster-open').onclick();
  await tick();
  x.get('popover').hidePopover();
  const close = new window.Event('beforetoggle');
  Object.defineProperty(close, 'newState', { value: 'closed' });
  x.get('popover').dispatchEvent(close);
  x.release();
  await tick();
  await tick();
  assert.equal(x.get('membership-editor').hidden, true);
  assert.equal(x.get('popover').classList.contains('party-editing-roster'), false);
});
