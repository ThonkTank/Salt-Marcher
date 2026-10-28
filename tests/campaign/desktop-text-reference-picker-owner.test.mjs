import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/campaign/text-reference-picker.ts'],
  outfile: '.build/text-reference-picker-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { chooseTextReference } = createRequire(import.meta.url)(
  '../../.build/text-reference-picker-owner.cjs',
);
const tick = async () => {
  for (let n = 0; n < 8; n++) await new Promise((r) => setImmediate(r));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const content = (revision = 1) => ({
  ref: { kind: 'note', id: 'source' },
  revision,
  title: 'Quelle',
  label: 'Notiz',
  note: { readAloud: '', gmNotes: '  Autorenwortlaut\r\n' },
});
const ok = (value) => ({ ok: true, value });
async function fixture(t, select = true) {
  const { window, document } = parseHTML('<html><body></body></html>');
  const prior = Object.fromEntries(['window', 'document', 'Option'].map((k) => [k, globalThis[k]]));
  window.HTMLSelectElement.prototype.add = function (option) {
    this.append(option);
  };
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  Object.assign(globalThis, {
    window,
    document,
    Option: function (text, value) {
      const o = document.createElement('option');
      o.textContent = text;
      o.value = value;
      return o;
    },
  });
  let generation = 1;
  window.campaign = {
    searchDesk: async () => ok({ entries: [content()], next: null }),
    deskContent: async () => ok(content()),
  };
  const result = chooseTextReference('token', '', () => generation === 1);
  const el = (id) => document.getElementById(id);
  t.after(() => {
    document.querySelector('#text-reference-picker > div button')?.click();
    Object.assign(globalThis, prior);
  });
  await tick();
  if (select) {
    el('text-reference-results').querySelector('button').click();
    await tick();
    assert.equal(el('text-reference-insert').disabled, false);
  }
  return {
    window,
    document,
    el,
    result,
    invalidate: () => generation++,
    cancel: () => document.querySelector('#text-reference-picker > div button').click(),
  };
}

test('typing an alias during the source detail read preserves it through explicit confirmation', async (t) => {
  const x = await fixture(t, false),
    held = deferred();
  x.window.campaign.deskContent = () => held.promise;
  x.el('text-reference-results').querySelector('button').click();
  x.el('text-reference-alias').value = 'Eigene Worte';
  x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));
  held.resolve(ok(content()));
  await tick();
  assert.equal(x.el('text-reference-alias').value, 'Eigene Worte');
  x.el('text-reference-insert').click();
  assert.equal(await x.result, '[Eigene Worte](dungeon-ref:note/source)');
});
for (const [fault, response] of [
  ['missing', { ok: false, error: 'Quelle fehlt' }],
  ['deleted', ok({ ...content(), unavailable: true })],
  ['changed', ok(content(2))],
  ['different identity', ok({ ...content(), ref: { kind: 'note', id: 'other' } })],
])
  test(`reference confirmation refuses a ${fault} source and leaves authored alias available for explicit correction`, async (t) => {
    const x = await fixture(t);
    x.el('text-reference-alias').value = '  Mein Anzeigename  ';
    x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));
    x.window.campaign.deskContent = async () => response;
    let settled = false;
    x.result.then(() => (settled = true));
    x.el('text-reference-insert').click();
    await tick();
    assert.equal(settled, false, 'unverified source cannot supply an insertion result');
    assert.equal(x.el('text-reference-picker').open, true);
    assert.equal(x.el('text-reference-alias').value, '  Mein Anzeigename  ');
    assert.match(x.el('text-reference-picker').textContent, /Quelle/);
    x.cancel();
    assert.equal(await x.result, null);
  });

test('verification cannot confirm a changed alias and repeat clicks dispatch only one source read', async (t) => {
  const x = await fixture(t),
    held = deferred();
  let calls = 0;
  x.window.campaign.deskContent = () => {
    calls++;
    return held.promise;
  };
  x.el('text-reference-insert').click();
  x.el('text-reference-insert').click();
  x.el('text-reference-alias').value = 'Späterer Name';
  x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));
  held.resolve(ok(content()));
  await tick();
  assert.equal(calls, 1);
  assert.equal(x.el('text-reference-picker').open, true);
  assert.equal(x.el('text-reference-alias').value, 'Späterer Name');
  x.el('text-reference-insert').click();
  await tick();
  assert.equal(await x.result, '[Späterer Name](dungeon-ref:note/source)');
  assert.equal(calls, 2);
});

test('reactivating the same source owner retires pending verification instead of confirming its old target', async (t) => {
  const x = await fixture(t),
    held = deferred();
  x.window.campaign.deskContent = () => held.promise;
  x.el('text-reference-insert').click();
  x.invalidate();
  held.resolve(ok(content()));
  assert.equal(await x.result, null);
  assert.equal(x.el('text-reference-picker'), null);
});
