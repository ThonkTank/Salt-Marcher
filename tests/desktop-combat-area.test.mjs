import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
mkdirSync('.build/combat-area/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/combat-area/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {creatureActionForRolls,isLegendaryAction} from './src/app/dice-formula';export {CombatAreaPanel} from './src/app/combat-area-ui';export {renderCombatActions} from './src/app/combat-actions-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-area/test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  creatureActionForRolls,
  isLegendaryAction,
  CombatAreaPanel,
  renderCombatActions,
} = createRequire(import.meta.url)('../.build/combat-area/test.cjs');
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/combat-area-'),
    x = { root, file: root + '/store.sqlite' };
  x.store = new CampaignStore(x.file);
  x.campaign = x.store.create('Schwarzer Drache');
  x.w = x.store.activate(x.campaign.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.w.token,
    combatId: x.combat?.id ?? null,
    expectedRevision: x.combat?.revision ?? null,
    action,
  });
  x.scene = x.store.executeLive({
    ...x.command({ kind: 'initialize', expectedRosterRevision: 0 }),
  }).scene;
  x.act = (action) => {
    x.combat = x.store.executeCombat(x.command(action)).combat;
    return x.combat;
  };
  x.act({
    kind: 'create',
    sceneId: x.scene.id,
    title: 'Boss',
    includeParty: false,
    expectedMembershipRevision: x.scene.membershipRevision,
  });
  for (const [name, maxHp, initiative] of [
    ['Alba', 88, 18],
    ['Bram', 99, 14],
    ['Cora', 77, 10],
    ['Dain', 66, 6],
  ]) {
    x.act({
      kind: 'add',
      name,
      count: 1,
      grouped: false,
      maxHp,
      armorClass: 18,
      initiativeBonus: 0,
    });
    x.act({
      kind: 'edit',
      participantId: x.combat.participants.at(-1).id,
      changes: { initiative },
    });
  }
  x.act({
    kind: 'add-creature',
    creatureId: 'adult-black-dragon',
    count: 1,
    grouped: false,
    initiative: 16,
  });
  x.dragon = x.combat.participants.at(-1);
  x.source = x.combat.sources[0];
  x.tail = x.source.legendaryActions.find((a) => a.name === 'Tail Attack');
  x.breath = x.source.actions.find((a) => a.name.startsWith('Acid Breath'));
  x.act({
    kind: 'edit',
    participantId: x.combat.participants[2].id,
    changes: { concentrating: true },
  });
  x.act({ kind: 'start' });
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
const hit = (x) => ({
  kind: 'area-damage',
  amount: 15,
  targets: [{ participantId: x.combat.participants[1].id, scale: 'full' }],
  source: { participantId: x.dragon.id, actionId: x.tail.id },
  legendary: { participantId: x.dragon.id, actionId: x.tail.id, cost: 1 },
});
const breath = (x) => ({
  kind: 'area-damage',
  amount: 54,
  targets: x.combat.participants
    .slice(0, 4)
    .map((p, i) => ({ participantId: p.id, scale: i % 2 ? 'half' : 'full' })),
  source: { participantId: x.dragon.id, actionId: x.breath.id },
});
test('one source-backed breath atomically applies shared damage, concentration and durable undo after retry/reopen', (t) => {
  const x = fixture(t);
  x.act(hit(x));
  assert.equal(x.combat.participants.at(-1).legendaryActions.remaining, 2);
  x.act({ kind: 'next' });
  assert.equal(x.combat.participants.at(-1).legendaryActions.remaining, 3);
  const before = structuredClone(x.combat),
    command = x.command(breath(x)),
    result = x.store.executeCombat(command);
  x.combat = result.combat;
  assert.deepEqual(
    x.combat.participants.slice(0, 4).map((p) => p.hp),
    [34, 57, 23, 39],
  );
  assert.deepEqual(x.combat.participants[2].concentrationChecks, [{ damage: 54, dc: 27 }]);
  assert.deepEqual(x.store.executeCombat(command), result);
  const id = x.combat.id;
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.campaign.id);
  x.combat = x.store.combat(x.w.token, x.scene.id, id).combat;
  assert.deepEqual(
    x.combat.participants.slice(0, 4).map((p) => p.hp),
    [34, 57, 23, 39],
  );
  x.act({ kind: 'undo' });
  assert.deepEqual(x.combat.participants, before.participants);
  assert.equal(x.combat.turnId, before.turnId);
});
test('invalid or stale area choices and late invalid targets roll back points, HP, history and receipts together', (t) => {
  const x = fixture(t);
  for (const amend of [
    (a) => ({ ...a, targets: [...a.targets, a.targets[0]] }),
    (a) => ({ ...a, targets: [...a.targets, { participantId: 'missing', scale: 'full' }] }),
    (a) => ({ ...a, targets: [{ ...a.targets[0], scale: 'wrong' }] }),
    (a) => ({ ...a, legendary: { ...a.legendary, cost: 2 } }),
    (a) => ({ ...a, source: { ...a.source, actionId: 'forged' } }),
    (a) => ({ ...a, legendary: undefined }),
  ]) {
    const before = x.store.db.serialize();
    assert.throws(() => x.act(amend(hit(x))));
    assert.ok(x.store.db.serialize().equals(before));
  }
  const stale = x.command(breath(x));
  x.act(hit(x));
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeCombat(stale), /geändert/);
  assert.ok(x.store.db.serialize().equals(before));
});
test('zero rounded half damage adds no concentration check; temporary HP absorb before ordinary HP', (t) => {
  const x = fixture(t),
    p = x.combat.participants[2];
  x.act({ kind: 'edit', participantId: p.id, changes: { tempHp: 10 } });
  x.act({ kind: 'area-damage', amount: 1, targets: [{ participantId: p.id, scale: 'half' }] });
  assert.equal(x.combat.participants[2].concentrationChecks, undefined);
  x.act({ kind: 'area-damage', amount: 12, targets: [{ participantId: p.id, scale: 'full' }] });
  assert.equal(x.combat.participants[2].hp, 75);
  assert.equal(x.combat.participants[2].tempHp, 0);
  assert.deepEqual(x.combat.participants[2].concentrationChecks, [{ damage: 12, dc: 10 }]);
});
test('legendary tail reference resolves the exact attack while preserving cost identity; ambiguity stays unresolved', (t) => {
  const x = fixture(t),
    resolved = creatureActionForRolls(x.source, x.tail);
  assert.equal(resolved.id, x.tail.id);
  assert.equal(isLegendaryAction(x.source, resolved), true);
  assert.match(resolved.description, /2d8 \+ 6/);
  assert.equal(
    creatureActionForRolls(
      { ...x.source, actions: [...x.source.actions, ...x.source.actions] },
      x.tail,
    ),
    x.tail,
  );
  assert.equal(
    creatureActionForRolls(x.source, {
      ...x.tail,
      description: 'The dragon makes a tail attack, then moves.',
    }).description,
    'The dragon makes a tail attack, then moves.',
  );
});
async function dom(t) {
  const old = globalThis.document,
    { document } = parseHTML(
      '<html><body><section id="area"></section><section id="actions"></section></body></html>',
    );
  globalThis.document = document;
  const create = document.createElement.bind(document);
  document.createElement = (tag, ...args) => {
    const el = create(tag, ...args);
    if (tag === 'select')
      Object.defineProperty(el, 'value', {
        configurable: true,
        get() {
          const options = [...this.querySelectorAll('option')];
          return (options.find((o) => o.hasAttribute('selected')) ?? options[0])?.value ?? '';
        },
        set(value) {
          const options = [...this.querySelectorAll('option')];
          for (const o of options) o.removeAttribute('selected');
          options.find((o) => o.value === value)?.setAttribute('selected', '');
        },
      });
    return el;
  };
  for (const el of document.querySelectorAll('*')) el.scrollIntoView = () => {};
  t.after(() => {
    globalThis.document = old;
  });
  return document;
}
test('manual full/half choices submit one command and block stale decisions without erasing a newer owner', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('area');
  let resolve;
  const calls = [];
  const panel = new CombatAreaPanel(root, (...args) => {
    calls.push(args);
    return new Promise((r) => {
      resolve = r;
    });
  });
  panel.context(x.combat, x.w.token, false);
  panel.open({ participantId: x.dragon.id, action: x.breath });
  root.querySelector('#combat-area-selection').value = 'party';
  root.querySelector('#combat-area-selection').onchange();
  root.querySelector('input[type=checkbox]').checked = true;
  const inputs = [...root.querySelectorAll('.combat-area-row input')];
  inputs.slice(0, 4).forEach((i) => (i.checked = true));
  const selects = [...root.querySelectorAll('.combat-area-row select[data-role=save]')];
  selects[1].value = 'half';
  selects[3].value = 'half';
  inputs[0].onchange();
  assert.match(root.textContent, /Alba/);
  assert.equal(root.querySelector('#combat-area-amount').value, '54');
  root.querySelector('#combat-area-apply').onclick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].targets.length, 4);
  assert.deepEqual(
    calls[0][0].targets.map((t) => t.scale),
    ['full', 'half', 'full', 'half'],
  );
  assert.equal(calls[0][1], x.combat.revision);
  panel.context({ ...x.combat, id: 'other' }, 'new-token', false);
  panel.open();
  resolve(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(root.hidden, false);
  panel.context({ ...x.combat, id: 'other', revision: x.combat.revision + 1 }, 'new-token', false);
  assert.equal(root.querySelector('#combat-area-apply').disabled, true);
  assert.match(root.textContent, /Kampfstand geändert/);
});

test('a changed combat locks the reviewed area preview until the dialog is reopened', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('area'),
    calls = [];
  const panel = new CombatAreaPanel(root, async (...args) => {
    calls.push(args);
    return false;
  });
  const select = () => {
    root.querySelector('#combat-area-amount').value = '28';
    root.querySelector('#combat-area-type').value = 'fire';
    const check = root.querySelector('input[value="' + x.combat.participants[0].id + '"]');
    check.checked = true;
    check.onchange();
    return check.closest('.combat-area-row').querySelector('small').textContent;
  };
  panel.context(x.combat, x.w.token, false);
  panel.open();
  const reviewed = select();
  assert.match(reviewed, /28 Schaden → 60\/88 HP/);
  x.act({ kind: 'damage', participantId: x.combat.participants[0].id, amount: 5 });
  panel.context(x.combat, x.w.token, false);
  assert.equal(root.querySelector('.combat-area-preview').textContent, reviewed);
  assert.equal(root.querySelector('#combat-area-apply').disabled, true);
  assert.match(root.textContent, /Kampfstand geändert/);
  root.querySelector('#combat-area-apply').onclick();
  assert.equal(calls.length, 0);
  root.querySelector('#combat-area-cancel').onclick();
  panel.open();
  assert.match(select(), /28 Schaden → 55\/88 HP/);
  root.querySelector('#combat-area-apply').onclick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], x.combat.revision);
});
test('area decisions keep their reviewed first source until an explicit reopen', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('area');
  const first = { ...x.source, damageResistances: 'fire' },
    other = { ...x.source, damageImmunities: 'fire' },
    basis = { ...x.combat, sources: [first, other] };
  const panel = new CombatAreaPanel(root, async () => false);
  panel.context(basis, x.w.token, false);
  panel.open();
  root.querySelector('#combat-area-amount').value = '15';
  root.querySelector('#combat-area-type').value = 'fire';
  const check = root.querySelector('input[value="' + x.dragon.id + '"]');
  check.checked = true;
  check.onchange();
  const preview = check.closest('.combat-area-row').querySelector('small'),
    reviewed = preview.textContent;
  assert.match(reviewed, /7 Schaden/);
  panel.context({ ...basis, revision: basis.revision + 1, sources: [other] }, x.w.token, false);
  assert.equal(preview.textContent, reviewed);
  assert.equal(root.querySelector('#combat-area-apply').disabled, true);
  root.querySelector('#combat-area-cancel').onclick();
  panel.open();
  root.querySelector('#combat-area-amount').value = '15';
  root.querySelector('#combat-area-type').value = 'fire';
  const next = root.querySelector('input[value="' + x.dragon.id + '"]');
  next.checked = true;
  next.onchange();
  assert.match(next.closest('.combat-area-row').querySelector('small').textContent, /0 Schaden/);
});

test('compact legendary action keeps source identity and exposes both targeted rolls and a confirmed hit', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('actions'),
    calls = [];
  renderCombatActions(
    root,
    x.source,
    (...args) => calls.push(['roll', ...args]),
    (a) => calls.push(['hit', a]),
    (a) =>
      isLegendaryAction(x.source, a) ? { disabled: false, note: '3 / 3 Punkte · kostet 1' } : null,
    () => {},
  );
  const select = root.querySelector('select');
  for (const option of select.querySelectorAll('option')) option.removeAttribute('selected');
  select.querySelector('option[value="' + x.tail.id + '"]').selected = true;
  select.onchange();
  assert.match(root.textContent, /3 \/ 3 Punkte/);
  const buttons = [...root.querySelectorAll('button')];
  assert.ok(buttons.some((b) => /Angriff 1d20\+11/.test(b.textContent)));
  buttons.find((b) => b.textContent === 'Treffer eintragen…').onclick();
  assert.equal(calls[0][1].id, x.tail.id);
  assert.equal(isLegendaryAction(x.source, calls[0][1]), true);
  assert.match(calls[0][1].description, /2d8 \+ 6/);
});

function mixedTargets(x) {
  for (const creatureId of ['fire-elemental', 'wraith', 'mummy'])
    x.act({ kind: 'add-creature', creatureId, count: 1, grouped: false, initiative: 5 });
  return x.combat.participants.slice(-3);
}
const fireWave = (targets) => ({
  kind: 'area-damage',
  damageType: 'fire',
  amount: 28,
  targets: targets.map((p, i) => ({
    participantId: p.id,
    scale: i === 1 ? 'half' : 'full',
    defense: 'auto',
  })),
});
test('one fire wave separates saves from defenses and preserves all targets through replay, reopen and one undo', (t) => {
  const x = fixture(t),
    targets = mixedTargets(x),
    before = structuredClone(x.combat),
    command = x.command(fireWave(targets)),
    result = x.store.executeCombat(command);
  x.combat = result.combat;
  assert.deepEqual(
    x.combat.participants.slice(-3).map((p) => p.hp),
    [102, 60, 2],
  );
  assert.deepEqual(x.combat.participants.slice(0, -3), before.participants.slice(0, -3));
  assert.equal(x.combat.turnId, before.turnId);
  assert.deepEqual(x.store.executeCombat(command), result);
  const id = x.combat.id;
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.campaign.id);
  x.combat = x.store.combat(x.w.token, x.scene.id, id).combat;
  assert.deepEqual(
    x.combat.participants.slice(-3).map((p) => p.hp),
    [102, 60, 2],
  );
  x.act({ kind: 'undo' });
  const changed = new Set(targets.slice(1).map((p) => p.id)); // Fire immunity made no health write; the other targets took damage and undo.
  assert.deepEqual(
    x.combat.participants,
    before.participants.map((p) =>
      changed.has(p.id) ? { ...p, worldActorRevision: p.worldActorRevision + 2 } : p,
    ),
  );
  const canonical = new Map(
    x.store
      .scenePreparation(x.w.token, x.scene.id)
      .groups.flatMap((g) => g.actors)
      .map((p) => [p.id, p]),
  );
  for (const p of x.combat.participants.filter((p) => p.worldActorId)) {
    const actor = canonical.get(p.worldActorId);
    assert.ok(actor);
    assert.equal(p.worldActorRevision, actor.revision);
    for (const field of ['hp', 'maxHp', 'tempHp', 'conditions', 'concentrating'])
      assert.equal(p[field], actor[field]);
  }
});
test('late conditional defenses and invalid typed choices roll back the entire wave, history and receipt', (t) => {
  const x = fixture(t),
    targets = mixedTargets(x),
    before = x.store.db.serialize();
  for (const action of [
    { ...fireWave(targets), damageType: 'invented' },
    {
      ...fireWave(targets),
      targets: [...fireWave(targets).targets, { participantId: 'missing', scale: 'full' }],
    },
    {
      ...fireWave(targets),
      targets: [
        ...fireWave(targets).targets.slice(0, 2),
        { participantId: targets[2].id, scale: 'full', defense: 'invalid' },
      ],
    },
    {
      kind: 'area-damage',
      amount: 28,
      targets: [{ participantId: targets[0].id, scale: 'full', defense: 'auto' }],
    },
    {
      kind: 'area-damage',
      amount: 28,
      damageType: 'bludgeoning',
      targets: [
        { participantId: x.combat.participants[0].id, scale: 'full' },
        { participantId: targets[1].id, scale: 'half' },
      ],
    },
    { ...breath(x), damageType: 'fire' },
  ]) {
    assert.throws(() => x.act(action));
    assert.ok(x.store.db.serialize().equals(before));
  }
  x.act({
    kind: 'area-damage',
    amount: 28,
    damageType: 'bludgeoning',
    targets: [
      { participantId: x.combat.participants[0].id, scale: 'full' },
      { participantId: targets[1].id, scale: 'half', defense: 'half' },
    ],
  });
  assert.equal(x.combat.participants.at(-2).hp, 60);
});
test('save reduction precedes defense and effective damage drives temporary HP and concentration', (t) => {
  const x = fixture(t),
    targets = mixedTargets(x),
    wraith = targets[1];
  x.act({ kind: 'edit', participantId: wraith.id, changes: { tempHp: 3, concentrating: true } });
  x.act(fireWave(targets));
  const p = x.combat.participants.find((p) => p.id === wraith.id);
  assert.equal(p.hp, 63);
  assert.equal(p.tempHp, 0);
  assert.deepEqual(p.concentrationChecks, [{ damage: 7, dc: 10 }]);
  assert.equal(x.combat.participants.at(-3).hp, 102);
  x.act({ kind: 'undo' });
  x.act({ ...fireWave(targets), amount: 1 });
  const zero = x.combat.participants.find((p) => p.id === wraith.id);
  assert.equal(zero.hp, 67);
  assert.equal(zero.tempHp, 3);
  assert.equal(zero.concentrationChecks, undefined);
  assert.equal(x.combat.participants.at(-1).hp, 56);
});
test('typed area preview shows exact per-target results and submits a single confirmed wave', async (t) => {
  const x = fixture(t),
    targets = mixedTargets(x),
    document = await dom(t),
    root = document.getElementById('area'),
    calls = [],
    panel = new CombatAreaPanel(root, async (...args) => {
      calls.push(args);
      return true;
    });
  panel.context(x.combat, x.w.token, false);
  panel.open();
  root.querySelector('#combat-area-amount').value = '28';
  const rows = [...root.querySelectorAll('.combat-area-row')].filter((r) =>
    r.querySelector('input'),
  );
  for (const row of rows)
    if (targets.some((p) => p.id === row.querySelector('input').value))
      row.querySelector('input').checked = true;
  root.querySelector('#combat-area-amount').oninput();
  assert.equal(root.querySelector('#combat-area-apply').disabled, true);
  assert.match(root.textContent, /Schadensart wählen/);
  const type = root.querySelector('#combat-area-type');
  type.value = 'fire';
  type.onchange();
  const wraith = rows.find((r) => r.querySelector('input').value === targets[1].id);
  wraith.querySelector('[data-role=save]').value = 'half';
  wraith.querySelector('[data-role=save]').onchange();
  const previews = rows
    .filter((r) => r.querySelector('input').checked)
    .map((r) => r.querySelector('.combat-area-preview').textContent);
  assert.match(previews[0], /Immunität.*0 Schaden → 102\/102/);
  assert.match(previews[1], /Rettungswurf: 14.*Resistenz.*7 Schaden → 60\/67/);
  assert.match(previews[2], /Verwundbarkeit.*56 Schaden → 2\/58/);
  root.querySelector('#combat-area-apply').onclick();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], fireWave(targets));
  assert.equal(root.hidden, true);
});
for (const close of ['button', 'escape'])
  test(
    'unconfirmed area damage keeps inputs and allows ' +
      close +
      ' to reach status recovery after the write settles',
    async (t) => {
      const x = fixture(t),
        document = await dom(t),
        root = document.getElementById('area'),
        calls = [];
      let settle;
      const panel = new CombatAreaPanel(root, (...args) => {
        calls.push(args);
        return new Promise((resolve, reject) => {
          settle = () => (close === 'button' ? resolve(false) : reject(Error('Reply unavailable')));
        });
      });
      panel.context(x.combat, x.w.token, false);
      panel.open();
      root.querySelector('#combat-area-amount').value = '9';
      const type = root.querySelector('#combat-area-type');
      type.value = 'fire';
      type.onchange();
      const target = root.querySelector('.combat-area-row input');
      target.checked = true;
      target.onchange();
      root.querySelector('#combat-area-apply').onclick();
      assert.equal(root.querySelector('#combat-area-cancel').disabled, true);
      root.dispatchEvent(new document.defaultView.Event('cancel'));
      assert.equal(root.hidden, false, 'the in-flight write must finish before closing');
      panel.context(x.combat, x.w.token, true);
      settle();
      await new Promise((r) => setImmediate(r));
      assert.match(
        root.querySelector('[role=status]').textContent,
        /Keine Bestätigung.*Eingaben bleiben erhalten.*Buchungsstatus/,
      );
      assert.equal(root.querySelector('#combat-area-amount').value, '9');
      assert.equal(target.checked, true);
      assert.equal(root.querySelector('#combat-area-apply').disabled, true);
      assert.equal(root.querySelector('#combat-area-cancel').disabled, false);
      assert.equal(calls.length, 1);
      if (close === 'button') root.querySelector('#combat-area-cancel').onclick();
      else root.dispatchEvent(new document.defaultView.Event('cancel'));
      assert.equal(root.hidden, true);
      panel.open();
      assert.equal(root.hidden, true, 'closing does not bypass the pending-write barrier');
      panel.context(x.combat, x.w.token, false);
      panel.open();
      assert.doesNotMatch(root.querySelector('[role=status]').textContent, /Keine Bestätigung/);
      assert.equal(calls.length, 1, 'opening again never repeats the write');
    },
  );
test('an unconfirmed old area reply cannot annotate or close a new encounter decision', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('area');
  let reject;
  const panel = new CombatAreaPanel(
    root,
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  panel.context(x.combat, x.w.token, false);
  panel.open();
  root.querySelector('#combat-area-amount').value = '9';
  const type = root.querySelector('#combat-area-type');
  type.value = 'fire';
  type.onchange();
  const target = root.querySelector('.combat-area-row input');
  target.checked = true;
  target.onchange();
  root.querySelector('#combat-area-apply').onclick();
  panel.context({ ...x.combat, id: 'other' }, 'other-token', false);
  panel.open();
  reject(Error('Old reply'));
  await new Promise((r) => setImmediate(r));
  assert.equal(root.hidden, false);
  assert.doesNotMatch(root.querySelector('[role=status]').textContent, /Keine Bestätigung/);
  assert.equal(root.querySelector('#combat-area-amount').value, '');
});
test('conditional area defense keeps the source rule visible and requires a deliberate override', async (t) => {
  const x = fixture(t),
    targets = mixedTargets(x),
    document = await dom(t),
    root = document.getElementById('area'),
    panel = new CombatAreaPanel(root, async () => true);
  panel.context(x.combat, x.w.token, false);
  panel.open();
  root.querySelector('#combat-area-amount').value = '28';
  const type = root.querySelector('#combat-area-type');
  type.value = 'bludgeoning';
  type.onchange();
  const row = [...root.querySelectorAll('.combat-area-row')].find(
    (r) => r.querySelector('input')?.value === targets[1].id,
  );
  row.querySelector('input').checked = true;
  row.querySelector('input').onchange();
  assert.equal(root.querySelector('#combat-area-apply').disabled, true);
  assert.match(row.textContent, /nonmagical weapons.*silvered/);
  const defense = row.querySelector('[data-role=defense]'),
    overrides = root.querySelector('#combat-area-overrides');
  assert.equal(defense.hidden, true);
  overrides.checked = true;
  overrides.onchange();
  assert.equal(defense.hidden, false);
  defense.value = 'half';
  defense.onchange();
  assert.equal(root.querySelector('#combat-area-apply').disabled, false);
  assert.match(row.textContent, /14 Schaden/);
  overrides.checked = false;
  overrides.onchange();
  assert.equal(defense.value, 'auto');
  assert.equal(
    root.querySelector('#combat-area-apply').disabled,
    true,
    'closing manual defenses must restore the unresolved statblock rule, never retain a hidden override',
  );
  overrides.checked = true;
  overrides.onchange();
  defense.value = 'half';
  defense.onchange();
  type.value = 'fire';
  type.onchange();
  assert.equal(overrides.checked, false);
  assert.equal(defense.hidden, true);
  assert.equal(defense.value, 'auto');
  assert.equal(root.querySelector('#combat-area-apply').disabled, false);
  assert.match(row.textContent, /Resistenz: fire/);
});
test('a mixed-type source does not prefill one combined amount under a guessed damage type', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('area'),
    panel = new CombatAreaPanel(root, async () => true),
    bite = x.source.actions.find((a) => a.name === 'Bite');
  panel.context(x.combat, x.w.token, false);
  panel.open({ participantId: x.dragon.id, action: bite });
  assert.equal(root.querySelector('#combat-area-amount').value, '');
  assert.equal(root.querySelector('#combat-area-type').value, '');
  assert.match(root.textContent, /Mehrere Schadensarten/);
  assert.equal(root.querySelector('#combat-area-apply').disabled, true);
});
test('party selection skips unknown-health PCs instead of trapping a checked disabled target', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('area'),
    combat = structuredClone(x.combat);
  combat.participants[0].characterId = 'known-pc';
  combat.participants[1].characterId = 'unknown-pc';
  combat.participants[1].healthKnown = false;
  combat.participants[1].hp = 0;
  combat.participants[1].maxHp = 1;
  const panel = new CombatAreaPanel(root, async () => true);
  panel.context(combat, x.w.token, false);
  panel.open();
  root.querySelector('#combat-area-amount').value = '28';
  const type = root.querySelector('#combat-area-type');
  type.value = 'fire';
  type.onchange();
  root.querySelector('#combat-area-selection').value = 'party';
  root.querySelector('#combat-area-selection').onchange();
  const checks = [...root.querySelectorAll('.combat-area-row input')];
  assert.equal(checks[0].checked, true);
  assert.equal(
    checks.some((c) => c.value === combat.participants[1].id),
    false,
  );
  assert.match(root.querySelector('#combat-area-unavailable').textContent, /Bram/);
  assert.equal(root.querySelector('#combat-area-apply').disabled, false);
});

test('group selection preserves per-target decisions, excludes unknown health and respects a stale owner', async (t) => {
  const x = fixture(t);
  x.act({ kind: 'add-creature', creatureId: 'ogre', count: 4, grouped: true, initiative: 5 });
  const combat = structuredClone(x.combat),
    ogres = combat.participants.filter((p) => p.sourceId === 'ogre');
  ogres[3].healthKnown = false;
  const document = await dom(t),
    root = document.getElementById('area'),
    calls = [],
    panel = new CombatAreaPanel(root, async (a) => {
      calls.push(a);
      return true;
    });
  panel.context(combat, x.w.token, false);
  panel.open();
  const selection = root.querySelector('#combat-area-selection'),
    choose = (value) => {
      selection.value = value;
      selection.onchange();
    },
    checks = () => [...root.querySelectorAll('.combat-area-row input')];
  assert.ok(
    [...selection.options].some(
      (o) => o.value === 'group:' + ogres[0].groupId && o.textContent.includes('3 Ziele'),
    ),
  );
  choose('group:' + ogres[0].groupId);
  assert.deepEqual(
    checks()
      .filter((c) => c.checked)
      .map((c) => c.value),
    ogres.slice(0, 3).map((p) => p.id),
  );
  assert.equal(selection.value, 'group:' + ogres[0].groupId);
  const row = root.querySelector('input[value="' + ogres[1].id + '"]').closest('.combat-area-row'),
    save = row.querySelector('[data-role=save]');
  save.value = 'half';
  save.onchange();
  choose('none');
  assert.equal(checks().filter((c) => c.checked).length, 0);
  choose('all');
  assert.equal(checks().filter((c) => c.checked).length, combat.participants.length - 1);
  choose('group:' + ogres[0].groupId);
  assert.equal(save.value, 'half');
  assert.equal(
    checks().some((c) => c.value === ogres[3].id),
    false,
  );
  panel.context({ ...combat, revision: combat.revision + 1 }, x.w.token, false);
  assert.equal(selection.disabled, true);
  choose('none');
  assert.equal(checks().filter((c) => c.checked).length, 3);
  assert.equal(calls.length, 0);
});

test('separate troops of the same creature remain distinguishable and select only their own members', async (t) => {
  const x = fixture(t);
  for (let i = 0; i < 2; i++)
    x.act({ kind: 'add-creature', creatureId: 'ogre', count: 4, grouped: true, initiative: 5 });
  const document = await dom(t),
    root = document.getElementById('area'),
    panel = new CombatAreaPanel(root, async () => true);
  panel.context(x.combat, x.w.token, false);
  panel.open();
  const selection = root.querySelector('#combat-area-selection'),
    choices = [...selection.options].filter((o) => o.value.startsWith('group:'));
  assert.equal(choices.length, 2);
  assert.notEqual(choices[0].textContent, choices[1].textContent);
  for (const choice of choices) {
    selection.value = choice.value;
    selection.onchange();
    const expected = x.combat.participants
      .filter((p) => 'group:' + p.groupId === choice.value)
      .map((p) => p.id);
    assert.deepEqual(
      [...root.querySelectorAll('.combat-area-row input')]
        .filter((c) => c.checked)
        .map((c) => c.value),
      expected,
    );
  }
});

test('vulnerability may double valid area input above one million before health is applied', (t) => {
  const x = fixture(t),
    id = x.combat.participants[0].id;
  x.act({ kind: 'edit', participantId: id, changes: { maxHp: 1000000, hp: 1000000 } });
  x.act({
    kind: 'area-damage',
    amount: 800000,
    damageType: 'fire',
    targets: [{ participantId: id, scale: 'full', defense: 'double' }],
  });
  assert.equal(x.combat.participants.find((p) => p.id === id).hp, 0);
});
