import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
buildSync({
  stdin: {
    contents: `export {createCombatReinforcementEditor} from './src/app/runtime/combat-reinforcement-editor';
export {createCombatRollEditor} from './src/app/runtime/combat-roll-editor';
export {EditorSession} from './src/app/shared/editor-session';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-owner-lifecycle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { createCombatReinforcementEditor, createCombatRollEditor, EditorSession } = createRequire(
  import.meta.url,
)('../../.build/combat-owner-lifecycle.cjs');
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const tick = async () => {
  for (let n = 0; n < 8; n++) await new Promise((r) => setImmediate(r));
};
function surface(t) {
  const { document, window } = parseHTML(readWorkspaceMarkup());
  const saved = globalThis.window;
  globalThis.window = { localStorage: { getItem: () => null } };
  t.after(() => {
    globalThis.window = saved;
  });
  const values = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return values.get(this) ?? this.options[0]?.value ?? '';
    },
    set(value) {
      values.set(this, String(value));
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  window.HTMLElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const get = (id) => document.getElementById(id),
    session = new EditorSession();
  const combat = (id) => ({
    id,
    sceneId: 'scene',
    phase: 'running',
    round: 1,
    turnId: 'actor',
    sources: [],
    participants: [
      {
        id: 'actor',
        name: 'Drache',
        groupId: 'actor',
        sourceId: 'dragon',
        initiative: 12,
        armorClass: 16,
        hp: 30,
        maxHp: 30,
      },
      {
        id: 'target',
        name: 'Ziel',
        groupId: 'target',
        characterId: 'character',
        initiative: 10,
        armorClass: 14,
        hp: 20,
        maxHp: 20,
      },
    ],
  });
  let current = combat('A'),
    load = 0;
  return {
    document,
    window,
    get,
    session,
    get combat() {
      return current;
    },
    setCombat(id) {
      current = combat(id);
      session.generation++;
      load++;
    },
    get load() {
      return load;
    },
  };
}
function reinforcement(t, search = async () => ({ ok: true, value: { rows: [], total: 0 } })) {
  const x = surface(t),
    messages = [];
  const editor = createCombatReinforcementEditor({
    document: x.document,
    get: x.get,
    session: x.session,
    api: { creatures: search },
    get context() {
      return { token: 'same-token', campaignId: 'campaign' };
    },
    get combat() {
      return x.combat;
    },
    get sceneId() {
      return 'scene';
    },
    get loadVersion() {
      return x.load;
    },
    blocked: () => false,
    writing: () => false,
    send: async () => true,
    create: async () => {},
    initiative() {},
    lock() {},
    feedback: (...args) => messages.push(args),
  });
  editor.init();
  editor.open();
  const searchNow = () =>
    x
      .get('combat-creature-search-form')
      .dispatchEvent(new x.window.Event('submit', { cancelable: true }));
  return {
    ...x,
    editor,
    messages,
    searchNow,
    change(id) {
      x.setCombat(id);
      editor.contextChanged();
      editor.open();
    },
  };
}
test('reinforcement A→B→A discards an old answer without releasing the newer search', async (t) => {
  const old = deferred(),
    next = deferred();
  let reads = 0;
  const x = reinforcement(t, () => (++reads === 1 ? old.promise : next.promise));
  x.searchNow();
  await tick();
  assert.equal(x.editor.reading, true);
  x.change('B');
  x.change('A');
  x.searchNow();
  await tick();
  old.resolve({
    ok: true,
    value: { rows: [{ id: 'old', name: 'Alter Treffer', challengeRating: '1' }], total: 1 },
  });
  await tick();
  assert.equal(x.editor.reading, true);
  assert.doesNotMatch(x.get('combat-creature-select').textContent, /Alter Treffer/);
  next.resolve({
    ok: true,
    value: { rows: [{ id: 'new', name: 'Neuer Treffer', challengeRating: '2' }], total: 1 },
  });
  await tick();
  assert.equal(x.editor.reading, false);
  assert.match(x.get('combat-creature-select').textContent, /Neuer Treffer/);
});
test('reinforcement accepted booking stays owned through context change and close drain', async (t) => {
  const x = reinforcement(t),
    held = deferred();
  let confirmed = 0;
  const booking = x.editor.submit(
    () =>
      x.session.run(async () => {
        await held.promise;
        return true;
      }),
    () => confirmed++,
  );
  await tick();
  assert.equal(x.editor.booking, true);
  x.change('B');
  assert.equal(x.editor.booking, true, 'view reset cannot release an accepted booking');
  let drained = false;
  const closing = x.session.settle().then(() => (drained = true));
  await tick();
  assert.equal(drained, false);
  held.resolve();
  assert.equal(await booking, false);
  await closing;
  assert.equal(confirmed, 0);
  assert.equal(x.editor.booking, false);
});
test('two reinforcement owners keep the same control IDs and selections isolated', async (t) => {
  const a = reinforcement(t, async () => ({
    ok: true,
    value: { rows: [{ id: 'a', name: 'Nur A', challengeRating: '1' }], total: 1 },
  }));
  const b = reinforcement(t, async () => ({
    ok: true,
    value: { rows: [{ id: 'b', name: 'Nur B', challengeRating: '2' }], total: 1 },
  }));
  a.searchNow();
  b.searchNow();
  await tick();
  assert.equal(a.get('combat-creature-select').value, 'creature:a');
  assert.equal(b.get('combat-creature-select').value, 'creature:b');
  a.editor.close();
  assert.equal(b.get('combat-add-dialog').hasAttribute('open'), true);
});
const action = {
  id: 'bite',
  name: 'Biss',
  description: 'Melee Weapon Attack: +5 to hit. Hit: 7 (1d6 + 4) piercing damage.',
};
const attack = { kind: 'attack', label: 'Biss', formula: '1d20+5', dc: null };
function rolls(t, overrides = {}) {
  const x = surface(t),
    writes = [],
    formulaCalls = [],
    hits = [];
  let uncertain = false;
  let editor;
  const ports = {
    document: x.document,
    get: x.get,
    session: x.session,
    get combat() {
      return x.combat;
    },
    blocked: () => false,
    uncertain: () => uncertain,
    execute: async (command) => {
      writes.push(command);
      editor.accepted(command, x.combat.id);
      return true;
    },
    openHit: (input) => hits.push(input),
    formula: async (input, accept) => {
      formulaCalls.push(input);
      accept({
        id: 'check-' + formulaCalls.length,
        sceneId: 'scene',
        rolls: [20],
        outcome: 'success',
        total: 25,
        dc: 14,
      });
    },
    check: async () => {},
    feedback() {},
    ...overrides,
  };
  editor = createCombatRollEditor(ports);
  editor.init();
  return {
    ...x,
    editor,
    writes,
    formulaCalls,
    hits,
    uncertain(value) {
      uncertain = value;
    },
  };
}
for (const kind of ['attack', 'save'])
  test(`retired ${kind} roll cannot publish into an A→B→A opening or unlock its replacement`, async (t) => {
    const held = deferred();
    let acceptOld;
    const delay = async (_, accept) => {
      acceptOld = accept;
      await held.promise;
    };
    const x = rolls(t, { formula: delay, check: delay });
    const stage = () =>
      kind === 'attack'
        ? x.editor.stageAttack(action, attack, 'actor', 'Drache', 'dragon', 'A')
        : x.editor.stageSave(
            action,
            { kind: 'save', label: 'Rettung', dc: 12, formula: '' },
            'actor',
            'Drache',
            'dragon',
            'A',
          );
    stage();
    x.get(`combat-${kind}-roll`).click();
    await tick();
    x.setCombat('B');
    x.editor.accept({ id: 'B', phase: 'running', participants: [] });
    x.setCombat('A');
    x.editor.reset();
    stage();
    acceptOld({ id: 'old-check', total: 99, rolls: [20], outcome: 'success' });
    held.resolve();
    await tick();
    assert.equal(x.get(`combat-${kind}-roll`).hidden, false);
    assert.doesNotMatch(x.get(`combat-${kind}-result`).textContent, /99/);
  });
test('confirmed legendary receipt removes its deferred cost exactly once before a later attack roll', async (t) => {
  const writes = [],
    cost = { kind: 'legendary-action', participantId: 'actor', actionId: 'bite', cost: 2 };
  // The first transport response is lost; canonical receipt resolution arrives later.
  let fail = true;
  const y = rolls(t, {
    execute: async (command) => {
      writes.push(command);
      return !fail;
    },
  });
  y.editor.stageAttack(action, attack, 'actor', 'Drache', 'dragon', 'A', {
    participantId: 'actor',
    actionId: 'bite',
    cost: 2,
  });
  y.get('combat-attack-roll').click();
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(y.formulaCalls.length, 0);
  y.editor.accepted(cost, 'A');
  y.editor.accepted(cost, 'A');
  fail = false;
  y.get('combat-attack-roll').click();
  await tick();
  assert.equal(writes.length, 1, 'receipt-confirmed cost must not be sent again');
  assert.equal(y.formulaCalls.length, 1);
});
test('lost damage response retains its handoff until the matching receipt, then consumes it once', async (t) => {
  const writes = [],
    x = rolls(t, {
      execute: async (command) => {
        writes.push(command);
        return false;
      },
    });
  x.uncertain(true);
  x.editor.stageDamage(
    {
      id: 'damage',
      sceneId: 'scene',
      rollKind: 'formula',
      formulaKind: 'damage',
      total: 7,
      label: 'Schaden',
    },
    'actor',
    'A',
    'target',
  );
  x.get('combat-roll-damage').click();
  await tick();
  assert.equal(x.get('combat-roll-effect').hidden, false);
  x.editor.accepted({ ...writes[0], sourceCheckId: 'another-check' }, 'A');
  assert.equal(x.get('combat-roll-effect').hidden, false);
  x.editor.accepted(writes[0], 'A');
  assert.equal(x.get('combat-roll-effect').hidden, true);
  x.editor.accepted(writes[0], 'A');
  assert.equal(writes.length, 1);
});

test('a not-applied damage receipt permits only a new explicit attempt', async (t) => {
  const writes = [],
    x = rolls(t, {
      execute: async (command) => {
        writes.push(command);
        return false;
      },
    });
  x.uncertain(true);
  x.editor.stageDamage(
    {
      id: 'damage',
      sceneId: 'scene',
      rollKind: 'formula',
      formulaKind: 'damage',
      total: 7,
      label: 'Schaden',
    },
    'actor',
    'A',
    'target',
  );
  x.get('combat-roll-damage').click();
  await tick();
  x.get('combat-roll-damage').click();
  await tick();
  assert.equal(writes.length, 1);
  x.uncertain(false);
  await tick();
  assert.equal(writes.length, 1, 'receipt clarification cannot retry a write');
  x.get('combat-roll-damage').click();
  await tick();
  assert.equal(writes.length, 2);
});
