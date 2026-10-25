import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/live-archive-ui.ts'],
  outfile: '.build/live-archive-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await tick();
  }
  assert(check(), 'Expected archive state');
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const ok = (value) => ({ ok: true, value }),
  fail = () => ({ ok: false, error: 'Archiv nicht lesbar' });
const combat = (id, title) => ({
  id,
  title,
  sceneId: 'old',
  phase: 'retired',
  round: 1,
  outcome: '',
  notes: 'Beleg: ' + title,
  participants: [],
});
const a = combat('a', 'Torwache'),
  b = combat('b', 'Kellerwolf');
async function fixture() {
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  const el = (id) => document.getElementById(id),
    dialog = el('archive-dialog');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new window.Event('close'));
  };
  let owner = 'one';
  const api = {
    liveArchives: async () => ok({ items: [{ id: 'old', title: 'Am alten Tor' }], next: null }),
    liveScene: async () =>
      ok({
        id: 'old',
        retired: true,
        title: 'Am alten Tor',
        notes: 'Silberzeichen',
        clock: { instantMs: '0' },
      }),
    combat: async (_token, _scene, id) => ok({ combat: id === 'a' ? a : b, recent: [a, b] }),
    chase: async () => ok({ chase: null, recent: [] }),
  };
  window.campaign = api;
  delete require.cache[require.resolve('../../.build/live-archive-ui.cjs')];
  const { initLiveArchives } = require('../../.build/live-archive-ui.cjs'),
    reset = initLiveArchives(
      () => owner,
      async () => true,
    );
  el('live-archives').onclick();
  await until(() => el('archive-list').children.length === 1);
  const open = () => el('archive-list').querySelector('button').onclick(),
    buttons = () => [...el('archive-detail').querySelectorAll('button')],
    mask = (id) =>
      buttons()
        .find((button) =>
          button.textContent.startsWith('Kampf: ' + (id === 'a' ? a.title : b.title)),
        )
        .onclick();
  return {
    el,
    api,
    dialog,
    open,
    mask,
    buttons,
    reset,
    owner: (value) => {
      owner = value;
      reset();
    },
    async ready() {
      open();
      await until(() => el('archive-detail').querySelector('h3'));
    },
    cleanup() {
      reset();
      Object.assign(globalThis, previous);
    },
  };
}
test('scene read failure remains in the modal and retries the same archive', async () => {
  const x = await fixture();
  try {
    let failOnce = true,
      ids = [];
    const original = x.api.liveScene;
    x.api.liveScene = async (...args) => {
      ids.push(args[1]);
      if (failOnce) {
        failOnce = false;
        return fail();
      }
      return original(...args);
    };
    x.open();
    await until(() => x.el('archive-detail').querySelector('[role=alert]'));
    assert.equal(x.el('archive-list').children.length, 1);
    assert(x.el('archive-detail').textContent.includes('Am alten Tor'));
    x.el('archive-detail').querySelector('button').onclick();
    await until(() => x.el('archive-detail').querySelector('h3'));
    assert.deepEqual(ids, ['old', 'old']);
    assert(x.el('archive-detail').textContent.includes('Silberzeichen'));
  } finally {
    x.cleanup();
  }
});
test('mask selection clears old notes during loading and offers local retry after failure', async () => {
  const x = await fixture();
  try {
    await x.ready();
    assert(x.el('archive-mask-detail').textContent.includes('Beleg: Kellerwolf'));
    const held = deferred();
    x.api.combat = async () => held.promise;
    x.mask('a');
    assert(!x.el('archive-mask-detail').textContent.includes('Beleg: Kellerwolf'));
    assert(x.el('archive-mask-detail').textContent.includes('Torwache'));
    held.resolve(fail());
    await until(() => x.el('archive-mask-detail').querySelector('[role=alert]'));
    x.api.combat = async () => ok({ combat: a, recent: [a, b] });
    x.el('archive-mask-detail').querySelector('button').onclick();
    await until(() => x.el('archive-mask-detail').textContent.includes('Beleg: Torwache'));
    assert.equal(x.el('archive-mask-detail').getAttribute('aria-busy'), 'false');
  } finally {
    x.cleanup();
  }
});
test('a slower previous mask reply cannot replace the newer choice', async () => {
  const x = await fixture();
  try {
    await x.ready();
    const held = deferred();
    x.api.combat = async (_t, _s, id) =>
      id === 'a' ? held.promise : ok({ combat: b, recent: [a, b] });
    x.mask('a');
    x.mask('b');
    await until(() => x.el('archive-mask-detail').textContent.includes('Beleg: Kellerwolf'));
    held.resolve(ok({ combat: a, recent: [a, b] }));
    await tick();
    assert(!x.el('archive-mask-detail').textContent.includes('Beleg: Torwache'));
  } finally {
    x.cleanup();
  }
});
test('closing and reopening invalidates a pending scene reply', async () => {
  const x = await fixture();
  try {
    const held = deferred(),
      original = x.api.liveScene;
    x.api.liveScene = async () => held.promise;
    x.open();
    x.dialog.close();
    x.api.liveScene = original;
    x.el('live-archives').onclick();
    await until(() => x.el('archive-detail').textContent === '');
    held.resolve(await original());
    await tick();
    assert.equal(x.el('archive-detail').textContent, '');
    await x.ready();
    assert(x.el('archive-detail').textContent.includes('Silberzeichen'));
  } finally {
    x.cleanup();
  }
});
test('wrong-owner mask replies are rejected without showing their notes', async () => {
  const x = await fixture();
  try {
    await x.ready();
    x.api.combat = async () => ok({ combat: { ...a, sceneId: 'other' }, recent: [a, b] });
    x.mask('a');
    await until(() => x.el('archive-mask-detail').querySelector('[role=alert]'));
    assert(!x.el('archive-mask-detail').textContent.includes('Beleg: Torwache'));
  } finally {
    x.cleanup();
  }
});
test('campaign activation invalidates old list replies even if its token is reused later', async () => {
  const x = await fixture();
  try {
    x.dialog.close();
    const held = deferred();
    x.api.liveArchives = async () => held.promise;
    x.el('live-archives').onclick();
    await tick();
    x.owner('two');
    x.owner('one');
    held.resolve(ok({ items: [{ id: 'foreign', title: 'Fremde Gruppe' }], next: null }));
    await tick();
    assert.equal(x.el('archive-list').children.length, 0);
  } finally {
    x.cleanup();
  }
});
test('list error is visible immediately and duplicate pagination clicks do not append duplicates', async () => {
  const x = await fixture();
  try {
    x.dialog.close();
    x.api.liveArchives = async () => fail();
    x.el('live-archives').onclick();
    await until(() => x.el('archive-list-status').querySelector('[role=alert]'));
    assert.equal(x.dialog.open, true);
    x.api.liveArchives = async () =>
      ok({ items: [{ id: 'old', title: 'Am alten Tor' }], next: 'old' });
    x.el('archive-list-status').querySelector('button').onclick();
    await until(() => x.el('archive-list').children.length === 1);
    const held = deferred();
    let reads = 0;
    x.api.liveArchives = async () => {
      reads++;
      return held.promise;
    };
    x.el('archive-more').onclick();
    x.el('archive-more').onclick();
    assert.equal(reads, 1);
    held.resolve(ok({ items: [{ id: 'older', title: 'Ältere Gruppe' }], next: null }));
    await until(() => x.el('archive-list').children.length === 2);
    assert.equal(x.el('archive-more').hidden, true);
  } finally {
    x.cleanup();
  }
});
test('a chase-only archive shows its saved goal and retries a failed chase selection locally', async () => {
  const x = await fixture();
  try {
    const chase = {
      id: 'chase',
      sceneId: 'old',
      title: 'Flucht zum Hafen',
      status: 'retired',
      round: 2,
      goal: 'Boot erreichen',
      outcome: '',
      complication: '',
      participants: [],
    };
    x.api.combat = async () => ok({ combat: null, recent: [] });
    x.api.chase = async () => ok({ chase, recent: [chase] });
    await x.ready();
    assert(x.el('archive-mask-detail').textContent.includes('Boot erreichen'));
    let ids = [];
    x.api.chase = async (_token, _scene, id) => {
      ids.push(id);
      return fail();
    };
    x.buttons()
      .find((b) => b.textContent.startsWith('Verfolgung:'))
      .onclick();
    await until(() => x.el('archive-mask-detail').querySelector('[role=alert]'));
    x.api.chase = async (_token, _scene, id) => {
      ids.push(id);
      return ok({ chase, recent: [chase] });
    };
    x.el('archive-mask-detail').querySelector('button').onclick();
    await until(() => x.el('archive-mask-detail').textContent.includes('Boot erreichen'));
    assert.deepEqual(ids, ['chase', 'chase']);
  } finally {
    x.cleanup();
  }
});
