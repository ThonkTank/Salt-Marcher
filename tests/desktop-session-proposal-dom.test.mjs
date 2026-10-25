import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/session-proposal-editor';export {SessionReview} from './src/app/session-review-ui';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/session-proposal-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function fixture(t) {
  const previous = { document: globalThis.document, window: globalThis.window },
    { document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  globalThis.window = { campaign: {} };
  globalThis.document = document;
  const create = document.createElement.bind(document);
  document.createElement = (tag, ...args) => {
    const node = create(tag, ...args);
    if (tag === 'select') Object.defineProperty(node, 'value', { value: '', writable: true });
    return node;
  };
  const file = require.resolve('../.build/session-proposal-dom.cjs');
  delete require.cache[file];
  const ui = require(file);
  ui.initProposalEditor();
  const el = (id) => document.getElementById(id),
    dialog = el('session-proposal-editor');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  Object.defineProperty(el('proposal-edit-location'), 'value', { value: '', writable: true });
  const proposal = {
    id: 'a',
    index: 0,
    title: 'Alpha',
    notes: 'Author notes\r\n',
    readAloud: '',
    locationId: null,
    noteIds: [],
    encounter: {},
    acceptedVisitId: null,
    reward: {
      poolXp: 0,
      items: [{ name: 'Coins', quantity: 1, valueGold: '2', category: 'coins' }],
    },
  };
  const sources = { notes: [], locations: [] },
    calls = [];
  const open = (
    p = proposal,
    save = async (value) => {
      calls.push(value);
      return false;
    },
  ) => ui.openProposalEditor(p, sources, save);
  const submit = () => el('proposal-edit-form').onsubmit({ preventDefault() {} }),
    quantity = () => el('proposal-edit-items').querySelector('input[aria-label="Menge"]');
  t.after(() => {
    ui.closeProposalEditor();
    Object.assign(globalThis, previous);
  });
  return { ui, el, dialog, proposal, sources, calls, open, submit, quantity };
}
test('unfinished quantities retain exact text when adding or removing reward rows', async (t) => {
  const x = fixture(t);
  x.open();
  x.quantity().value = '-';
  x.quantity().oninput();
  x.el('proposal-edit-item-add').click();
  assert.equal(x.quantity().value, '-');
  const remove = x
    .el('proposal-edit-items')
    .querySelectorAll('fieldset')[1]
    .querySelector('button');
  remove.click();
  assert.equal(x.quantity().value, '-');
  x.submit();
  await tick();
  assert.equal(x.calls.length, 0);
  assert.match(x.el('proposal-edit-status').textContent, /Menge/);
  assert.equal(x.quantity().value, '-');
  x.quantity().value = '01';
  x.quantity().oninput();
  x.submit();
  await tick();
  assert.equal(x.calls[0].reward.items[0].quantity, 1);
  assert.equal(x.quantity().value, '01');
});
test('empty Story-XP is explained and does not silently become zero', async (t) => {
  const x = fixture(t);
  x.open();
  x.el('proposal-edit-xp').value = '';
  x.submit();
  await tick();
  assert.equal(x.calls.length, 0);
  assert.match(x.el('proposal-edit-status').textContent, /Story-XP/);
  assert.equal(x.el('proposal-edit-form').inert, false);
});
test('unavailable knowledge references stay visible and selected until explicitly removed', async (t) => {
  const x = fixture(t);
  x.proposal.noteIds = ['archived', 'missing'];
  x.sources.notes = [{ trashed: true, note: { id: 'archived', title: 'Old faction' } }];
  x.open();
  const inputs = x.el('proposal-edit-refs').querySelectorAll('input');
  assert.equal(inputs.length, 2);
  assert.ok([...inputs].every((c) => c.checked));
  assert.match(x.el('proposal-edit-refs').textContent, /Old faction/);
  // linkedom uses attribute selectors for :checked; set them to match real DOM checked state.
  for (const c of inputs) c.setAttribute('checked', '');
  x.submit();
  await tick();
  assert.deepEqual(x.calls[0].noteIds, ['archived', 'missing']);
  inputs[0].checked = false;
  inputs[0].removeAttribute('checked');
  x.submit();
  await tick();
  assert.deepEqual(x.calls[1].noteIds, ['missing']);
});
for (const outcome of ['success', 'failure'])
  test(`old ${outcome} cannot close, unlock or annotate a reopened proposal`, async (t) => {
    const x = fixture(t),
      old = deferred(),
      current = deferred();
    let calls = 0;
    x.open(x.proposal, async () => {
      calls++;
      return old.promise;
    });
    x.submit();
    x.submit();
    assert.equal(calls, 1);
    assert.equal(x.el('proposal-edit-form').inert, true);
    x.ui.closeProposalEditor();
    x.open(x.proposal, async () => current.promise);
    assert.equal(x.el('proposal-edit-form').inert, false);
    x.submit();
    if (outcome === 'success') old.resolve(true);
    else old.reject(new Error('Old failure'));
    await tick();
    assert.equal(x.dialog.open, true);
    assert.equal(x.el('proposal-edit-form').inert, true);
    assert.equal(x.el('proposal-edit-status').textContent, '');
    current.resolve(false);
    await tick();
    assert.equal(x.el('proposal-edit-form').inert, false);
  });
test('successful submit closes its own dialog and failure retains editable input', async (t) => {
  const x = fixture(t);
  x.open(x.proposal, async () => {
    throw new Error('Conflict');
  });
  x.el('proposal-edit-notes').value = '  New author text\r\n';
  x.submit();
  await tick();
  assert.equal(x.dialog.open, true);
  assert.equal(x.el('proposal-edit-notes').value, '  New author text\r\n');
  assert.equal(x.el('proposal-edit-status').textContent, 'Conflict');
  x.open(x.proposal, async () => true);
  x.submit();
  await tick();
  assert.equal(x.dialog.open, false);
  assert.equal(x.ui.proposalEditorOpen(), false);
});

const catalogPage = {
  ok: true,
  value: {
    items: [
      {
        id: 'ring',
        revision: 3,
        name: 'Ring',
        category: 'magic',
        magic: true,
        rarity: 'common',
        unitCopper: '250',
      },
    ],
    next: null,
    total: 1,
    problems: [],
  },
};
test('catalog insertion and explicit detachment retain unfinished quantities', async (t) => {
  const x = fixture(t);
  window.campaign.itemDefinitions = async () => catalogPage;
  x.open();
  x.quantity().value = '01';
  x.quantity().oninput();
  x.el('proposal-catalog-find').click();
  await tick();
  x.el('proposal-catalog-results').querySelector('button').click();
  assert.equal(x.quantity().value, '01');
  const row = x.el('proposal-edit-items').querySelectorAll('fieldset')[1];
  assert.equal(row.querySelector('input[aria-label="Name"]').disabled, true);
  const detach = [...row.querySelectorAll('button')].find(
    (b) => b.textContent === 'Als eigenen Eintrag bearbeiten',
  );
  detach.click();
  assert.equal(x.quantity().value, '01');
  assert.equal(
    x
      .el('proposal-edit-items')
      .querySelectorAll('fieldset')[1]
      .querySelector('input[aria-label="Name"]').disabled,
    false,
  );
});
test('a late catalog response cannot populate or unlock a reopened proposal', async (t) => {
  const x = fixture(t),
    old = deferred(),
    current = deferred();
  window.campaign.itemDefinitions = async () => old.promise;
  x.open();
  x.el('proposal-catalog-find').click();
  assert.equal(x.el('proposal-catalog-find').disabled, true);
  x.ui.closeProposalEditor();
  x.open();
  assert.equal(x.el('proposal-catalog-find').disabled, false);
  window.campaign.itemDefinitions = async () => current.promise;
  x.el('proposal-catalog-find').click();
  old.resolve(catalogPage);
  await tick();
  assert.equal(x.el('proposal-catalog-results').childNodes.length, 0);
  assert.equal(x.el('proposal-catalog-find').disabled, true);
  current.resolve(catalogPage);
  await tick();
  assert.equal(x.el('proposal-catalog-find').disabled, false);
  assert.ok(x.el('proposal-catalog-results').querySelector('button'));
});

function reviewFixture(t, accept) {
  const x = fixture(t),
    review = new x.ui.SessionReview(accept, () => ({
      token: 'token',
      planId: 'plan',
      planRevision: 1,
      request: 0,
    })),
    root = document.createElement('div');
  document.body.append(root);
  const run = {
    planId: 'plan',
    id: 'run',
    proposals: ['Alpha', 'Beta'].map((title, index) => ({
      ...x.proposal,
      id: 'proposal-' + index,
      index,
      title,
      notes: '',
      encounter: { sources: [], assessment: { difficulty: 'easy', adjustedXp: 20 } },
    })),
  };
  const dialog = x.el('session-selection-dialog');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  const mount = (source) => {
    root.replaceChildren();
    review.mount(root, source);
    for (const p of source.proposals) {
      const card = document.createElement('article');
      review.decorate(card, p, { notes: [], locations: [] });
      root.append(card);
    }
  };
  mount(run);
  t.after(() => review.reset());
  return { ...x, review, root, run, mount };
}
test('filtered proposal selection persists across searches and reviews source order', async (t) => {
  const calls = [],
    x = reviewFixture(t, async (source, picks) => {
      calls.push(picks.map((p) => p.index));
      return false;
    });
  const search = x.el('session-proposal-search');
  search.value = 'Beta';
  search.oninput();
  x.el('session-select-visible').click();
  search.value = 'Alpha';
  search.oninput();
  x.el('session-select-visible').click();
  assert.match(x.el('session-selection-summary').textContent, /2 ausgewählt/);
  x.el('session-review-selection').click();
  assert.deepEqual(
    [...x.el('session-selection-dialog').querySelectorAll('li strong')].map((n) => n.textContent),
    ['Alpha', 'Beta'],
  );
  x.el('session-selection-confirm').click();
  await tick();
  await tick();
  assert.deepEqual(calls, [[0, 1]]);
  assert.equal(x.el('session-selection-dialog').open, true);
});
