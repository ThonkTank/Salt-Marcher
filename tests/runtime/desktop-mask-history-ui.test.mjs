import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/mask-history-ui.ts'],
  outfile: '.build/mask-history-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await tick();
  }
  assert(check(), 'Expected history state');
}
const held = () => {
  let resolve;
  return {
    promise: new Promise((r) => {
      resolve = r;
    }),
    resolve: (value) => resolve(value),
  };
};
async function fixture() {
  const old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.__qaValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__qaValue = v;
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const calls = [],
    selected = [];
  let live = true;
  const item = (id, title) => ({
      kind: 'chase',
      id,
      title,
      state: 'running',
      round: 0,
      summary: 'Tor erreichen',
    }),
    page = (q, items = [item('old', 'Kupfersiegel')], next = null) => ({
      campaignId: 'cam',
      sceneId: 'scene',
      query: { ...q },
      items,
      total: 40,
      next,
    });
  window.campaign = {
    maskHistory: async (token, sceneId, q) => {
      calls.push(q);
      return { ok: true, value: page(q, undefined, 'next-page') };
    },
  };
  delete require.cache[require.resolve('../../.build/mask-history-ui.cjs')];
  const ui = require('../../.build/mask-history-ui.cjs'),
    el = (id) => document.getElementById(id),
    owner = () => ({
      token: 'token',
      campaignId: 'cam',
      sceneId: 'scene',
      kind: 'chase',
      current: () => live,
      select: (item) => {
        selected.push(item);
      },
    });
  ui.openMaskHistory(owner());
  await until(() => el('mask-history-results').children.length === 1);
  return {
    ui,
    el,
    calls,
    selected,
    page,
    item,
    owner,
    setLive: (v) => {
      live = v;
    },
    cleanup() {
      ui.closeMaskHistory();
      Object.assign(globalThis, old);
    },
  };
}
test('paging uses the returned cursor and previous page restores its original query', async () => {
  const x = await fixture();
  try {
    x.el('mask-history-next').onclick();
    await until(
      () =>
        x.calls.length === 2 && x.el('mask-history-dialog').getAttribute('aria-busy') === 'false',
    );
    assert.equal(x.calls[1].after, 'next-page');
    x.el('mask-history-prev').onclick();
    await until(() => x.calls.length === 3);
    assert.equal(x.calls[2].after, null);
  } finally {
    x.cleanup();
  }
});
test('old result callbacks are invalid immediately when typing a new search', async () => {
  const x = await fixture();
  try {
    const old = x.el('mask-history-results').querySelector('button');
    x.el('mask-history-search').value = 'Mühle';
    x.el('mask-history-search').oninput();
    old.onclick();
    assert.equal(x.selected.length, 0);
    assert.equal(x.el('mask-history-results').children.length, 0);
  } finally {
    x.cleanup();
  }
});
test('an older held reply cannot replace a newer state filter', async () => {
  const x = await fixture();
  try {
    const pending = held();
    let first = true;
    window.campaign.maskHistory = async (_t, _s, q) => {
      if (first) {
        first = false;
        return pending.promise;
      }
      return { ok: true, value: x.page(q, [x.item('new', 'Neuer Treffer')]) };
    };
    x.el('mask-history-next').onclick();
    x.el('mask-history-state').value = 'finished';
    x.el('mask-history-state').onchange();
    await until(() => x.el('mask-history-results').textContent.includes('Neuer Treffer'));
    pending.resolve({ ok: true, value: x.page(x.calls[0], [x.item('stale', 'Veraltet')]) });
    await tick();
    assert(!x.el('mask-history-results').textContent.includes('Veraltet'));
  } finally {
    x.cleanup();
  }
});
test('read failure clears previous results and retries the same requested page', async () => {
  const x = await fixture();
  try {
    const reads = [];
    let fail = true;
    window.campaign.maskHistory = async (_t, _s, q) => {
      reads.push(q);
      return fail ? { ok: false, error: 'Suchseite nicht lesbar' } : { ok: true, value: x.page(q) };
    };
    x.el('mask-history-next').onclick();
    await until(() => x.el('mask-history-summary').getAttribute('role') === 'alert');
    assert.equal(x.el('mask-history-results').children.length, 0);
    fail = false;
    x.el('mask-history-retry').onclick();
    await until(() => x.el('mask-history-results').children.length === 1);
    assert.equal(reads[1].after, 'next-page');
  } finally {
    x.cleanup();
  }
});
for (const wrong of ['campaignId', 'sceneId'])
  test('reply ownership rejects wrong ' + wrong, async () => {
    const x = await fixture();
    try {
      window.campaign.maskHistory = async (_t, _s, q) => ({
        ok: true,
        value: { ...x.page(q), [wrong]: 'other' },
      });
      x.el('mask-history-next').onclick();
      await until(() => x.el('mask-history-summary').getAttribute('role') === 'alert');
      assert.equal(x.el('mask-history-results').children.length, 0);
    } finally {
      x.cleanup();
    }
  });
test('context invalidation closes discovery and detached selections cannot change another scene', async () => {
  const x = await fixture();
  try {
    const button = x.el('mask-history-results').querySelector('button');
    x.setLive(false);
    button.onclick();
    assert.equal(x.el('mask-history-dialog').open, false);
    assert.equal(x.selected.length, 0);
  } finally {
    x.cleanup();
  }
});
test('a valid selection closes discovery and hands only that verified record to its controller', async () => {
  const x = await fixture();
  try {
    x.el('mask-history-results').querySelector('button').onclick();
    assert.equal(x.el('mask-history-dialog').open, false);
    assert.deepEqual(
      x.selected.map((i) => i.id),
      ['old'],
    );
  } finally {
    x.cleanup();
  }
});
test('closing and reopening invalidates replies even when scene identity is reused', async () => {
  const x = await fixture();
  try {
    const pending = held(),
      oldQuery = x.calls[0];
    window.campaign.maskHistory = async () => pending.promise;
    x.el('mask-history-next').onclick();
    x.ui.closeMaskHistory();
    window.campaign.maskHistory = async (_t, _s, q) => ({
      ok: true,
      value: x.page(q, [x.item('new', 'Neue Sitzung')]),
    });
    x.ui.openMaskHistory(x.owner());
    await until(() => x.el('mask-history-results').textContent.includes('Neue Sitzung'));
    pending.resolve({ ok: true, value: x.page(oldQuery, [x.item('bad', 'Alte Sitzung')]) });
    await tick();
    assert(!x.el('mask-history-results').textContent.includes('Alte Sitzung'));
  } finally {
    x.cleanup();
  }
});

test('IME composition never searches intermediate text and emits only the final query', async () => {
  const x = await fixture();
  try {
    const input = x.el('mask-history-search');
    input.dispatchEvent(new window.Event('compositionstart'));
    input.value = 'M';
    input.oninput();
    await new Promise((r) => setTimeout(r, 230));
    assert.equal(x.calls.length, 1);
    input.value = 'Mühle';
    input.dispatchEvent(new window.Event('compositionend'));
    await new Promise((r) => setTimeout(r, 230));
    assert.equal(x.calls.length, 2);
    assert.equal(x.calls[1].search, 'Mühle');
  } finally {
    x.cleanup();
  }
});
