import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/party-award-ui.ts'],
  outfile: '.build/party-award-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t) {
  const previous = { window: globalThis.window, document: globalThis.document },
    dom = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window: dom.window, document: dom.document });
  delete require.cache[require.resolve('../../.build/party-award-dom.cjs')];
  const ui = require('../../.build/party-award-dom.cjs'),
    get = (id) => dom.document.getElementById('party-award-' + id),
    saved = [];
  let current = { token: 'first' };
  dom.window.campaign = {
    live: async () => ({
      ok: true,
      value: {
        rosterRevision: 1,
        focusId: 'scene',
        scene: { title: 'Gruppe' },
        roster: [
          {
            id: 'ada',
            active: true,
            sceneId: 'scene',
            profile: { name: 'Ada' },
          },
        ],
      },
    }),
    progress: async () => ({
      ok: true,
      value: {
        characters: [
          {
            characterId: 'ada',
            name: 'Ada',
            xp: 300,
            revision: 1,
            membershipRevision: 1,
          },
        ],
      },
    }),
  };
  ui.initPartyAwards(
    () => current,
    (token, action, done) => saved.push({ token, action, done }),
  );
  ui.resetPartyAwards();
  t.after(() => {
    ui.resetPartyAwards();
    Object.assign(globalThis, previous);
  });
  const open = async () => {
      get('open').onclick();
      await tick();
    },
    submit = () => {
      get('xp').value = '100';
      get('form').onsubmit({ preventDefault() {} });
    };
  return {
    get,
    saved,
    open,
    submit,
    switchOwner() {
      current = { token: 'second' };
      ui.resetPartyAwards();
    },
  };
}
for (const change of ['reopen', 'reactivate'])
  test('an earlier award confirmation cannot clear a new ' + change + ' proposal', async (t) => {
    const x = fixture(t);
    await x.open();
    x.submit();
    assert.equal(x.saved.length, 1);
    if (change === 'reactivate') x.switchOwner();
    else x.get('close').onclick();
    await x.open();
    x.get('xp').value = '250';
    x.get('load').value = '600';
    x.saved[0].done();
    assert.equal(x.get('panel').hidden, false);
    assert.equal(x.get('xp').value, '250');
    assert.equal(x.get('load').value, '600');
  });
test('the current award confirmation closes only its own proposal and resets the submitted amounts', async (t) => {
  const x = fixture(t);
  await x.open();
  x.submit();
  x.saved[0].done();
  assert.equal(x.get('panel').hidden, true);
  assert.equal(x.get('xp').value, '0');
  assert.equal(x.get('load').value, '0');
});
