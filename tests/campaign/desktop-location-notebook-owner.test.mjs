import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/campaign/text-references'; export * from './src/app/campaign/text-reference-picker';export {LocationNotebook} from './src/app/campaign/location-notebook-ui';",
    resolveDir: process.cwd(),
    sourcefile: 'reference-review.ts',
    loader: 'ts',
  },
  outfile: '.build/text-reference-review.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const api = createRequire(import.meta.url)('../../.build/text-reference-review.cjs');
const link = '[Wache](dungeon-ref:note/old)',
  ref = { kind: 'note', id: 'old' };
const tick = () => new Promise((r) => setImmediate(r));
async function settle() {
  for (let i = 0; i < 8; i++) await tick();
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const ok = (value) => ({ ok: true, value });
function fixture(t, start = true) {
  const { window, document } = parseHTML('<html><body></body></html>'),
    saved = Object.fromEntries(['window', 'document', 'Option'].map((k) => [k, globalThis[k]]));
  Object.assign(globalThis, {
    window,
    document,
    Option: function (text, value) {
      const n = document.createElement('option');
      n.textContent = text;
      n.value = value;
      return n;
    },
  });
  window.HTMLSelectElement.prototype.add = function (n) {
    this.append(n);
  };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.getAttribute('data-value') ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      this.setAttribute('data-value', v);
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.focus = () => {};
  let current = true,
    calls = 0;
  const content = (id = 'old', revision = 1) => ({
    ref: { kind: 'note', id },
    revision,
    title: id === 'old' ? 'Wache' : 'Tor',
    label: 'NSC',
    note: { readAloud: '', gmNotes: '' },
  });
  window.campaign = {
    searchDesk: async () => ok({ entries: [content(), content('other')], next: null }),
    deskContent: async (_, r) => {
      calls++;
      return ok(content(r.id));
    },
  };
  const result = start
    ? api.chooseTextReference('token', '', () => current)
    : Promise.resolve(null);
  t.after(() => {
    for (const d of document.querySelectorAll('dialog')) d.close();
    Object.assign(globalThis, saved);
  });
  return {
    window,
    document,
    result,
    content,
    el: (id) => document.getElementById(id),
    cancel: () => document.querySelector('dialog > div button').onclick(),
    invalidate: () => {
      current = false;
    },
    get calls() {
      return calls;
    },
  };
}
async function notebookFixture(t) {
  const x = fixture(t, false),
    w = { token: 'token', campaign: { id: 'campaign' } },
    raw = link + '\r\n[[Vault note]]',
    actions = [],
    messages = [],
    query = x.document.querySelector.bind(x.document);
  x.document.querySelector = (selector) => (selector === 'dialog:modal' ? null : query(selector));
  x.window.campaign = {
    live: async () =>
      ok({
        focusId: 'scene',
        focusRevision: 1,
        scene: { id: 'scene', title: 'Gruppe', locationId: 'location' },
      }),
    deskContent: async (_, r) =>
      ok({
        ref: r,
        revision: 1,
        title: r.id,
        label: 'Ort',
        location: { sections: [{ id: 'section', title: 'Text', markdown: raw }], detailMaps: [] },
      }),
    locationMaterials: async (_, q) =>
      ok({
        items: q.locationId
          ? []
          : [
              { id: 'location', title: 'Tor', detail: 'Ort' },
              { id: 'other-location', title: 'Hafen', detail: 'Ort' },
            ],
        next: null,
        locationRevision: q.locationId ? 1 : null,
      }),
  };
  const n = new api.LocationNotebook(
    () => w,
    async () => true,
    (text) => messages.push(text),
    async (action) => {
      actions.push(action);
    },
  );
  await n.open('location');
  return {
    ...x,
    n,
    w,
    raw,
    actions,
    messages,
    button: () =>
      [...x.document.querySelectorAll('#location-notebook button')].find((b) =>
        b.textContent.startsWith('Nur diesen Abschnitt'),
      ),
  };
}
test('the location read-aloud handoff retains declared and external author bytes', async (t) => {
  const x = await notebookFixture(t);
  x.button().onclick();
  await settle();
  assert.equal(x.actions[0]?.text, x.raw);
});
test('an old location section button cannot approve a different currently selected location', async (t) => {
  const x = await notebookFixture(t),
    b = x.button();
  await x.n.select('other-location');
  b.onclick();
  await settle();
  assert.deepEqual(x.actions, []);
});

test('directory choices and persistent notebook controls can be used again after navigation and close', async (t) => {
  const x = await notebookFixture(t),
    buttons = [...x.document.querySelectorAll('.location-directory-row')];
  for (const [index, id] of ['other-location', 'location', 'other-location'].entries()) {
    const b = buttons.find((b) => b.dataset.locationId === id);
    assert.equal(b.disabled, false);
    b.onclick();
    await settle();
    assert.equal(x.el('location-notebook-document').querySelector('h3').textContent, id);
    if (index === 0) assert.match(x.el('location-notebook-document').textContent, /other-location/);
  }
  const close = [...x.document.querySelectorAll('#location-notebook button')].find(
    (b) => b.textContent === 'Schließen',
  );
  close.onclick();
  await settle();
  await x.n.open('location');
  assert.equal(close.disabled, false);
  close.onclick();
  await settle();
  assert.equal(x.el('location-notebook').open, false);
});

test('a pending scene lookup does not hide location prose, links or related material', async (t) => {
  const x = await notebookFixture(t),
    held = deferred(),
    reads = [];
  x.window.campaign.live = () => held.promise;
  const materials = x.window.campaign.locationMaterials;
  x.window.campaign.locationMaterials = async (token, q) => {
    reads.push(q);
    return materials(token, q);
  };
  const opened = x.n.select('location');
  await settle();
  const prose = x.document.querySelector('.location-notebook-prose');
  assert.ok(prose, 'healthy source must be readable before optional scene response');
  assert.equal(prose.textContent, 'Wache\r\n[[Vault note]]');
  assert.equal(prose.querySelector('.text-reference-inline').disabled, false);
  assert.ok(
    reads.some((q) => q.locationId === 'location'),
    'material lookup must not wait for scene',
  );
  assert.equal(x.button(), undefined);
  held.resolve(
    ok({ focusId: 'scene', focusRevision: 7, scene: { id: 'scene', title: 'Späte Gruppe' } }),
  );
  await opened;
  await settle();
  assert.ok(x.button());
  assert.match(x.button().textContent, /Späte Gruppe/);
  x.n.close();
});
test('an unavailable scene leaves authored references readable and only disables scene handoff until explicit refresh', async (t) => {
  const x = await notebookFixture(t);
  x.window.campaign.live = async () => ({ ok: false, error: 'Gruppenuhr nicht verfügbar' });
  await x.n.select('location');
  await settle();
  assert.equal(
    x.document.querySelector('.location-notebook-prose')?.textContent,
    'Wache\r\n[[Vault note]]',
  );
  assert.equal(x.document.querySelectorAll('.text-reference-inline').length, 1);
  assert.equal(x.button(), undefined);
  assert.match(x.el('location-notebook-document').textContent, /Gruppenuhr nicht verfügbar/);
  x.window.campaign.live = async () =>
    ok({ focusId: 'scene', focusRevision: 2, scene: { id: 'scene', title: 'Erholte Gruppe' } });
  await x.n.select('location');
  await settle();
  assert.ok(x.button());
  assert.doesNotMatch(x.el('location-notebook-document').textContent, /Gruppenuhr nicht verfügbar/);
  x.button().onclick();
  await settle();
  assert.equal(x.actions[0]?.text, x.raw);
});
for (const failed of [false, true])
  test(`a late ${failed ? 'failed' : 'successful'} scene lookup cannot alter a newer location`, async (t) => {
    const x = await notebookFixture(t),
      held = deferred(),
      live = x.window.campaign.live;
    let first = true;
    x.window.campaign.live = (...args) => {
      if (first) {
        first = false;
        return held.promise;
      }
      return live(...args);
    };
    const old = x.n.select('location');
    await settle();
    await x.n.select('other-location');
    await settle();
    const content = x.el('location-notebook-document').textContent;
    held.resolve(
      failed
        ? { ok: false, error: 'Veraltete Gruppe' }
        : ok({
            focusId: 'old-scene',
            focusRevision: 1,
            scene: { id: 'old-scene', title: 'Veraltete Gruppe' },
          }),
    );
    await old;
    await settle();
    assert.equal(x.el('location-notebook-document').textContent, content);
    assert.deepEqual(x.messages, []);
    x.n.close();
  });
