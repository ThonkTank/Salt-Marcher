import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/treasure-distribution-ui.ts'],
  outfile: '.build/planner-treasure-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  settle = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  },
  deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
async function fixture(t) {
  const { window, document } = parseHTML('<html><body></body></html>'),
    prior = { window: globalThis.window, document: globalThis.document };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  Object.assign(globalThis, { window, document });
  window.localStorage = { getItem: () => null };
  const w = { token: 'token', campaign: { id: 'campaign' } },
    book = {
      id: 'treasure',
      revision: 1,
      title: 'Fund',
      items: [
        {
          id: 'item',
          name: 'Seil',
          quantity: 10,
          allocated: 0,
          currentDefinition: {
            id: 'definition',
            revision: 1,
            name: 'Seil',
            unitCopper: '100',
            trashed: false,
          },
        },
      ],
    },
    people = [
      { characterId: 'hero', name: 'Ada', active: true, membershipRevision: 1, sceneId: 'scene' },
    ],
    x = { w, book, people, sent: [], messages: [], navigated: [] };
  x.flush = async () => true;
  x.send = async (a) => {
    x.sent.push(a);
    return true;
  };
  x.read = async (id) => ({ ok: true, value: { ...book, id } });
  window.campaign = {
    treasures: async () => ({
      ok: true,
      value: { items: [{ id: 'treasure', title: 'Fund', available: 10 }], next: null },
    }),
    progress: async () => ({ ok: true, value: { characters: people } }),
    treasure: (_token, id) => x.read(id),
  };
  delete require.cache[require.resolve('../../.build/planner-treasure-ui.cjs')];
  const { TreasureDistribution } = require('../../.build/planner-treasure-ui.cjs');
  x.ui = new TreasureDistribution(
    (...a) => x.messages.push(a),
    () => w,
    () => x.flush(),
    (a, failed) => x.send(a, failed),
    async (token, id) => x.navigated.push({ token, id }),
  );
  x.el = (id) => document.getElementById(id);
  const dialog = x.el('treasure-distribution-dialog');
  dialog.open = false;
  dialog.close = () => {
    dialog.open = false;
  };
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.scrollIntoView = () => {};
  x.el('distribution-review').scrollIntoView = () => {};
  x.el('distribution-status').scrollIntoView = () => {};
  x.open = async () => {
    await x.ui.open();
    await settle();
  };
  x.input = () => document.querySelector('[data-item-id]');
  x.amount = (n) => {
    x.input().value = String(n);
    x.input().oninput();
  };
  x.review = () => x.el('distribution-check').click();
  x.submit = () => x.el('distribution-confirm').onclick();
  t.after(() => {
    x.ui.reset();
    Object.assign(globalThis, prior);
  });
  await x.open();
  return x;
}
test('an old reviewed confirmation cannot book later unreviewed amounts', async (t) => {
  const x = await fixture(t);
  x.amount(2);
  x.review();
  const old = x.el('distribution-confirm').onclick;
  x.amount(7);
  old();
  await settle();
  assert.equal(x.sent.length, 0);
  x.review();
  x.submit();
  await settle();
  assert.equal(x.sent[0].allocations[0].quantity, 7);
});
test('a previous successful allocation cannot close a reopened distribution', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.amount(2);
  x.review();
  x.send = () => wait.promise;
  x.submit();
  await settle();
  x.ui.reset();
  await x.open();
  x.amount(4);
  wait.resolve(true);
  await settle();
  assert.equal(x.el('treasure-distribution-dialog').open, true);
  assert.equal(x.input().value, '4');
});
test('an old failed treasure read cannot replace a newer dialog status', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    read = x.read;
  x.read = () => wait.promise;
  const opening = x.ui.open();
  await settle();
  x.ui.reset();
  x.read = read;
  await x.open();
  wait.resolve({ ok: false, error: 'Alter Lesefehler' });
  await opening;
  await settle();
  assert.doesNotMatch(x.el('distribution-status').textContent, /Alter Lesefehler/);
  assert.ok(!x.messages.some((m) => m[0].includes('Alter Lesefehler')));
});
test('reset while pre-open flush is pending prevents that old open', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.flush = () => wait.promise;
  const opening = x.ui.open();
  await settle();
  x.ui.reset();
  wait.resolve(true);
  await opening;
  assert.equal(x.el('treasure-distribution-dialog').open, false);
});
test('a detached amount input cannot alter values after a grid redraw', async (t) => {
  const x = await fixture(t),
    old = x.input();
  x.el('distribution-even').click();
  old.value = '1';
  old.oninput();
  x.review();
  x.submit();
  await settle();
  assert.equal(x.sent[0].allocations[0].quantity, 10);
});

test('detached paging controls cannot change a reopened allocation grid', async (t) => {
  const x = await fixture(t);
  x.book.items = Array.from({ length: 30 }, (_, i) => ({ ...x.book.items[0], id: 'item-' + i }));
  await x.open();
  const buttons = [...x.el('distribution-grid').previousElementSibling.querySelectorAll('button')];
  const forward = buttons[1];
  assert.equal(forward.disabled, false);
  x.ui.reset();
  await x.open();
  forward.onclick();
  assert.equal(x.input().dataset.itemId, 'item-0');
});

test('small distributions omit unused search and paging while keeping direct assignment', async (t) => {
  const x = await fixture(t);
  assert.equal(x.el('distribution-person-search').hidden, true);
  assert.equal(x.el('distribution-grid').previousElementSibling.children.length, 0);
  const direct = x.el('distribution-grid').querySelector('details');
  assert.ok(direct);
  assert.ok(!direct.open);
  direct.querySelector('button').click();
  x.review();
  x.submit();
  await settle();
  assert.equal(x.sent[0].allocations[0].quantity, 10);
});
test('recipient search remains available when the active party spans columns', async (t) => {
  const x = await fixture(t);
  for (let i = 0; i < 9; i++)
    x.people.push({ ...x.people[0], characterId: 'hero-' + i, name: 'Figur ' + i });
  await x.open();
  assert.equal(x.el('distribution-person-search').hidden, false);
  assert.match(x.el('distribution-grid').previousElementSibling.textContent, /Empfänger 1 \/ 2/);
});

test('a failed treasure switch keeps the displayed source and its amounts; retry adopts only the requested treasure', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    select = x.el('distribution-treasure');
  x.amount(3);
  x.review();
  x.read = () => wait.promise;
  select.value = 'second';
  select.onchange();
  assert.equal(select.value, 'treasure', 'a pending request is not the loaded source');
  assert.equal(x.el('distribution-review').hidden, true);
  wait.resolve({ ok: false, error: 'Zweiter Schatz nicht lesbar' });
  await settle();
  assert.equal(select.value, 'treasure');
  assert.equal(x.input().value, '3');
  assert.match(x.el('distribution-status').textContent, /Zweiter Schatz nicht lesbar/);
  assert.equal(x.sent.length, 0);
  assert.equal(x.el('distribution-check').disabled, false);
  x.read = async (id) => ({
    ok: true,
    value: {
      ...x.book,
      id,
      items: [
        {
          ...x.book.items[0],
          id: 'second-item',
          name: 'Mantel',
          currentDefinition: { ...x.book.items[0].currentDefinition, name: 'Mantel' },
        },
      ],
    },
  });
  select.value = 'second';
  select.onchange();
  await settle();
  assert.equal(select.value, 'second');
  assert.equal(x.input().dataset.itemId, 'second-item');
  assert.equal(x.input().value, '');
  assert.equal(x.el('distribution-status').textContent, '');
  x.amount(2);
  x.review();
  x.submit();
  await settle();
  assert.equal(x.sent.length, 1);
  assert.equal(x.sent[0].treasureId, 'second');
  assert.equal(x.sent[0].allocations[0].itemId, 'second-item');
});
test('a failed initial treasure read removes earlier rows and keeps its failure visible for an explicit retry', async (t) => {
  const x = await fixture(t);
  x.amount(4);
  x.read = async () => ({ ok: false, error: 'Schatzquelle beschädigt' });
  await x.open();
  assert.equal(!!x.input(), false);
  assert.match(x.el('distribution-status').textContent, /Schatzquelle beschädigt/);
  assert.equal(x.el('distribution-check').disabled, true);
  assert.equal(x.el('distribution-review').hidden, true);
  assert.equal(x.el('distribution-treasure').value, '');
  assert.equal(x.sent.length, 0);
  x.read = async (id) => ({ ok: true, value: { ...x.book, id } });
  x.el('distribution-treasure').value = 'treasure';
  x.el('distribution-treasure').onchange();
  await settle();
  assert.equal(x.input().value, '');
  assert.equal(x.el('distribution-status').textContent, '');
});
test('an obsolete failed switch cannot restore its former source over a newer confirmed treasure', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    select = x.el('distribution-treasure');
  x.read = () => wait.promise;
  select.value = 'second';
  select.onchange();
  x.read = async (id) => ({ ok: true, value: { ...x.book, id } });
  select.value = 'third';
  select.onchange();
  await settle();
  x.amount(2);
  wait.resolve({ ok: false, error: 'Alter zweiter Schatzfehler' });
  await settle();
  assert.equal(select.value, 'third');
  assert.equal(x.input().value, '2');
  assert.doesNotMatch(x.el('distribution-status').textContent, /Alter zweiter/);
  x.review();
  x.submit();
  await settle();
  assert.equal(x.sent[0].treasureId, 'third');
});

test('confirmed receipt retains exact shares and remainder, cannot resubmit, and revokes old recipient navigation', async (t) => {
  const x = await fixture(t);
  x.amount(3);
  const oldInput = x.input();
  x.review();
  const oldConfirm = x.el('distribution-confirm').onclick;
  x.submit();
  await settle();
  const receipt = x.el('distribution-receipt');
  assert.equal(receipt.hidden, false);
  assert.match(receipt.textContent, /Ada3 × Seil/);
  assert.match(receipt.textContent, /Im Schatz verbleiben: 7 × Seil/);
  oldInput.value = '9';
  oldInput.oninput();
  oldConfirm();
  await settle();
  assert.equal(x.sent.length, 1);
  assert.match(receipt.textContent, /3 × Seil/);
  const oldJump = receipt.querySelector('button').onclick;
  oldJump();
  await settle();
  assert.deepEqual(x.navigated, [{ token: 'token', id: 'hero' }]);
  assert.equal(x.el('treasure-distribution-dialog').open, false);
  await x.open();
  oldJump();
  assert.equal(x.navigated.length, 1);
  assert.equal(receipt.hidden, true);
  assert.equal(x.input().value, '');
});

test('a rejected allocation displays its sender reason at the preserved inputs and reveals it in the dialog', async (t) => {
  const x = await fixture(t),
    scrolls = [];
  x.el('distribution-status').scrollIntoView = (o) => scrolls.push(o.block);
  x.send = async (a, failed) => {
    x.sent.push(a);
    failed('Schatzrevision geändert. Eingaben bleiben erhalten.');
    return false;
  };
  x.amount(3);
  x.review();
  x.submit();
  await settle();
  assert.match(x.el('distribution-status').textContent, /Schatzrevision geändert/);
  assert.equal(x.input().value, '3');
  assert.equal(x.el('distribution-receipt').hidden, true);
  assert.equal(x.el('treasure-distribution-dialog').open, true);
  assert.deepEqual(scrolls, ['nearest']);
  assert.equal(x.sent.length, 1);
});
test('a late sender failure cannot overwrite the next dialog or its new amounts', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  let report;
  x.send = (_a, failed) => {
    report = failed;
    return wait.promise;
  };
  x.amount(2);
  x.review();
  x.submit();
  await settle();
  x.ui.reset();
  await x.open();
  x.amount(7);
  report('Alter Buchungsfehler');
  wait.resolve(false);
  await settle();
  assert.equal(x.input().value, '7');
  assert.doesNotMatch(x.el('distribution-status').textContent, /Alter Buchungsfehler/);
  assert.equal(x.el('distribution-receipt').hidden, true);
});

test('recipient deselection preserves raw amounts, invalidates review and never allocates excluded shares', async (t) => {
  const x = await fixture(t);
  x.people.push({ ...x.people[0], characterId: 'borin', name: 'Borin' });
  await x.open();
  const amount = (id, value) => {
    const n = x.el('distribution-grid').querySelector('[data-character-id="' + id + '"]');
    n.value = value;
    n.oninput();
  };
  const select = (id, checked) => {
    const n = [...x.el('distribution-people').querySelectorAll('input')].find(
      (n) => n.value === id,
    );
    n.checked = checked;
    n.onchange();
  };
  amount('hero', '3');
  amount('borin', '2');
  x.review();
  const oldConfirm = x.el('distribution-confirm').onclick;
  select('hero', false);
  assert.match(x.el('distribution-summary').textContent, /Eingaben für 1 abgewählte Figur/);
  assert.equal(x.el('distribution-review').hidden, true);
  oldConfirm();
  await settle();
  assert.equal(x.sent.length, 0);
  select('hero', true);
  assert.equal(x.el('distribution-grid').querySelector('[data-character-id="hero"]').value, '3');
  amount('hero', '-1');
  assert.equal(x.el('distribution-check').disabled, true);
  select('hero', false);
  assert.equal(x.el('distribution-check').disabled, false);
  select('hero', true);
  assert.equal(x.el('distribution-grid').querySelector('[data-character-id="hero"]').value, '-1');
  assert.equal(x.el('distribution-check').disabled, true);
  select('hero', false);
  x.review();
  x.submit();
  await settle();
  assert.deepEqual(
    x.sent[0].allocations.map((a) => [a.characterId, a.quantity]),
    [['borin', 2]],
  );
  assert.match(x.el('distribution-receipt').textContent, /8 × Seil/);
});
test('equal redistribution only replaces selected shares; restoration revalidates totals and explicit clearing removes all drafts', async (t) => {
  const x = await fixture(t);
  x.people.push({ ...x.people[0], characterId: 'borin', name: 'Borin' });
  await x.open();
  x.amount(3);
  const select = (checked) => {
    const n = [...x.el('distribution-people').querySelectorAll('input')].find(
      (n) => n.value === 'hero',
    );
    n.checked = checked;
    n.onchange();
  };
  select(false);
  x.el('distribution-even').click();
  assert.equal(x.input().value, '10');
  select(true);
  assert.equal(x.input().value, '3');
  assert.equal(x.el('distribution-check').disabled, true);
  assert.match(x.el('distribution-summary').textContent, /Mengen prüfen/);
  assert.doesNotMatch(
    x.el('distribution-summary').textContent,
    /Einheiten vorbereitet|bleiben im Schatz/,
  );
  select(false);
  [...x.el('treasure-distribution-dialog').querySelectorAll('button')]
    .find((n) => n.textContent === 'Mengen leeren')
    .click();
  select(true);
  assert.equal(x.input().value, '');
  assert.equal(x.el('distribution-grid').querySelector('[data-character-id="borin"]').value, '');
  assert.equal(x.el('distribution-check').disabled, true);
  assert.equal(x.sent.length, 0);
});
