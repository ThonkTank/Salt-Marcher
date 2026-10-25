import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
mkdirSync('.build/combat-hit/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/combat-hit/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {creatureActionForRolls,creatureActionRolls,creatureRollKey} from './src/app/shared/dice-formula';export {CombatHitPanel} from './src/app/runtime/combat-hit-ui';export {adjustedHitDamage} from './src/app/runtime/damage-adjustment';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-hit/test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  creatureActionForRolls,
  creatureActionRolls,
  creatureRollKey,
  CombatHitPanel,
  adjustedHitDamage,
} = createRequire(import.meta.url)('../../.build/combat-hit/test.cjs');
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/combat-hit-'),
    x = { root, file: root + '/store.sqlite' };
  x.store = new CampaignStore(x.file);
  x.cam = x.store.create('Kritischer Biss');
  x.w = x.store.activate(x.cam.id);
  x.cmd = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    combatId: x.combat?.id ?? null,
    expectedRevision: x.combat?.revision ?? null,
    action,
  });
  const c = x.store.executeLive(
    x.cmd({ kind: 'create-character', profile: { name: 'Alba', armorClass: 18 } }),
  ).character;
  x.characterId = c.id;
  const live = x.store.live(x.w.token);
  x.store.executeLive(
    x.cmd({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const progress = x.store.progress(x.w.token).characters.find((p) => p.characterId === c.id);
  x.store.executeProgress(
    x.cmd({
      kind: 'health',
      characterId: c.id,
      expectedRevision: progress.revision,
      operation: 'set',
      reason: 'Fixture',
      health: { hp: 20, maxHp: 40, tempHp: 5, conditions: '', concentrating: true },
    }),
  );
  x.scene = x.store.executeLive(
    x.cmd({ kind: 'initialize', expectedRosterRevision: x.store.live(x.w.token).rosterRevision }),
  ).scene;
  x.act = (action) => {
    x.combat = x.store.executeCombat(x.cmd(action)).combat;
    return x.combat;
  };
  x.act({
    kind: 'create',
    sceneId: x.scene.id,
    title: 'Biss',
    includeParty: true,
    expectedMembershipRevision: x.scene.membershipRevision,
  });
  x.act({
    kind: 'add-creature',
    creatureId: 'adult-black-dragon',
    count: 1,
    grouped: false,
    initiative: 16,
  });
  x.alba = x.combat.participants.find((p) => p.characterId);
  x.dragon = x.combat.participants.find((p) => p.sourceId);
  x.source = x.combat.sources[0];
  x.bite = x.source.actions.find((a) => a.name === 'Bite');
  x.tail = x.source.legendaryActions.find((a) => a.name === 'Tail Attack');
  x.parts = creatureActionRolls(x.bite).filter((p) => p.kind === 'damage');
  x.hit = (amounts = [30, 8], critical = true) => ({
    kind: 'hit',
    participantId: x.alba.id,
    critical,
    source: { participantId: x.dragon.id, actionId: x.bite.id },
    components: amounts.map((amount, i) => ({
      key: creatureRollKey(x.parts[i]),
      amount,
      scale: 'full',
    })),
  });
  x.act({ kind: 'start' });
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
const actor = (x) => x.combat.participants.find((p) => p.characterId === x.characterId);
test('one multi-type critical hit consumes temporary HP, drops concentration and creates no false death failure at the component boundary', (t) => {
  const x = fixture(t),
    before = structuredClone(x.combat),
    command = x.cmd(x.hit()),
    result = x.store.executeCombat(command);
  x.combat = result.combat;
  assert.equal(actor(x).hp, 0);
  assert.equal(actor(x).tempHp, 0);
  assert.equal(actor(x).concentrating, false);
  assert.equal(actor(x).concentrationChecks, undefined);
  assert.equal(actor(x).death, undefined);
  assert.deepEqual(x.store.executeCombat(command), result);
  assert.equal(
    x.store.progress(x.w.token).characters.find((p) => p.characterId === x.characterId).health.hp,
    0,
  );
  x.act({ kind: 'undo' });
  assert.deepEqual(x.combat.participants, before.participants);
});
test('critical damage at zero creates exactly two failures with one undo, survives reopen, and healing/undo keeps shared Party health consistent', (t) => {
  const x = fixture(t);
  x.act(x.hit());
  const before = structuredClone(x.combat);
  x.act(x.hit([14, 8]));
  assert.equal(actor(x).death.failures, 2);
  assert.deepEqual(actor(x).deathLast, { result: 'failure', roll: null });
  x.act({ kind: 'undo' });
  assert.deepEqual(x.combat.participants, before.participants);
  x.act(x.hit([14, 8]));
  x.act({ kind: 'heal', participantId: x.alba.id, amount: 7 });
  assert.equal(actor(x).hp, 7);
  assert.equal(actor(x).death, undefined);
  x.act({ kind: 'undo' });
  assert.equal(actor(x).hp, 0);
  assert.equal(actor(x).death.failures, 2);
  const id = x.combat.id;
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  x.combat = x.store.combat(x.w.token, x.scene.id, id).combat;
  assert.equal(actor(x).death.failures, 2);
  assert.equal(
    x.store.progress(x.w.token).characters.find((p) => p.characterId === x.characterId).health.death
      .failures,
    2,
  );
});
test('one hit creates one concentration check at the combined adjusted damage and preserves fractional half rounding per component', (t) => {
  const x = fixture(t);
  x.act({ kind: 'edit', participantId: x.alba.id, changes: { hp: 40, tempHp: 20 } });
  const hit = x.hit([31, 9], false);
  hit.components[0].scale = 'half';
  hit.components[1].scale = 'half';
  x.act(hit);
  assert.equal(actor(x).hp, 40);
  assert.equal(actor(x).tempHp, 1);
  assert.deepEqual(actor(x).concentrationChecks, [{ damage: 19, dc: 10 }]);
});
test('invalid late components, duplicate or foreign keys, forged proofs and stale revisions reject the entire hit without receipts or partial health', (t) => {
  const x = fixture(t);
  for (const amend of [
    (a) => ({ ...a, components: [...a.components, a.components[0]] }),
    (a) => ({ ...a, components: [...a.components, { key: 'fake', amount: 3, scale: 'full' }] }),
    (a) => ({ ...a, critical: 'yes' }),
    (a) => ({ ...a, components: a.components.map((p) => ({ ...p, sourceCheckId: 'missing' })) }),
    (a) => ({ ...a, components: [{ ...a.components[0], amount: 1.5 }] }),
    (a) => ({ ...a, components: [{ ...a.components[0], amount: 1000000, scale: 'double' }] }),
  ]) {
    const before = x.store.db.serialize();
    assert.throws(() => x.act(amend(x.hit())));
    assert.ok(x.store.db.serialize().equals(before));
  }
  const stale = x.cmd(x.hit());
  x.act({ kind: 'notes', title: 'changed', notes: '' });
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeCombat(stale), /geändert/);
  assert.ok(x.store.db.serialize().equals(before));
});
test('a manual legendary hit spends and resolves once; retry and undo restore both points and health', (t) => {
  const x = fixture(t);
  x.act({ kind: 'next' });
  const source = creatureActionForRolls(x.source, x.tail),
    p = creatureActionRolls(source).find((p) => p.kind === 'damage'),
    action = {
      kind: 'hit',
      participantId: x.alba.id,
      critical: false,
      source: { participantId: x.dragon.id, actionId: x.tail.id },
      components: [{ key: creatureRollKey(p), amount: 15, scale: 'full' }],
      legendary: { participantId: x.dragon.id, actionId: x.tail.id, cost: 1 },
    },
    before = structuredClone(x.combat),
    command = x.cmd(action);
  const result = x.store.executeCombat(command);
  x.combat = result.combat;
  assert.equal(
    x.combat.participants.find((p) => p.id === x.dragon.id).legendaryActions.remaining,
    2,
  );
  assert.equal(actor(x).hp, 10);
  assert.deepEqual(x.store.executeCombat(command), result);
  assert.throws(() => x.act(action), /bereits/);
  x.act({ kind: 'undo' });
  assert.deepEqual(x.combat.participants, before.participants);
});
async function dom(t) {
  const old = globalThis.document,
    { document } = parseHTML('<html><body><section id="hit"></section></body></html>');
  globalThis.document = document;
  document.defaultView.HTMLElement.prototype.scrollIntoView = () => {};
  t.after(() => {
    globalThis.document = old;
  });
  return document;
}
test('manual critical input keeps both damage types in one command and late rolling cannot replace another encounter draft', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('hit'),
    calls = [];
  let resolve;
  const rolls = [];
  const panel = new CombatHitPanel(
    root,
    async (...args) => {
      calls.push(args);
      return true;
    },
    (...args) => {
      rolls.push(args);
      return new Promise((r) => {
        resolve = r;
      });
    },
  );
  panel.context(x.combat, x.w.token, false);
  panel.open({ attackerId: x.dragon.id, action: x.bite });
  root.querySelector('#combat-hit-critical').checked = true;
  root.querySelector('#combat-hit-critical').onchange();
  let amounts = [...root.querySelectorAll('.combat-hit-part input[type=number]')];
  assert.deepEqual(
    amounts.map((i) => i.value),
    ['28', '9'],
  );
  for (const [i, value] of ['30', '8'].entries()) {
    amounts[i].value = value;
    amounts[i].oninput();
  }
  await root.querySelector('#combat-hit-apply').onclick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].critical, true);
  assert.deepEqual(
    calls[0][0].components.map((p) => p.amount),
    [30, 8],
  );
  assert.equal(
    calls[0][0].components.every((p) => p.sourceCheckId === undefined),
    true,
  );
  panel.open({ attackerId: x.dragon.id, action: x.bite });
  amounts = [...root.querySelectorAll('.combat-hit-part input[type=number]')];
  amounts[0].value = '30';
  amounts[0].oninput();
  amounts[1].value = '8';
  amounts[1].oninput();
  root.querySelector('#combat-hit-critical').checked = true;
  root.querySelector('#combat-hit-critical').onchange();
  assert.deepEqual(
    amounts.map((i) => i.value),
    ['30', '8'],
  );
  root.querySelector('.combat-hit-part button').onclick();
  assert.equal(rolls.length, 1);
  panel.context({ ...x.combat, id: 'other' }, 'other-token', false);
  panel.open({ attackerId: x.dragon.id, action: x.bite });
  resolve({ id: 'old-check', total: 99 });
  await new Promise((r) => setImmediate(r));
  amounts = [...root.querySelectorAll('.combat-hit-part input[type=number]')];
  assert.deepEqual(
    amounts.map((i) => i.value),
    ['17', '4'],
  );
  panel.context(
    { ...x.combat, id: 'other', revision: x.combat.revision + 1 },
    'other-token',
    false,
  );
  assert.equal(root.querySelector('#combat-hit-apply').disabled, true);
  assert.match(root.textContent, /Kampfstand geändert/);
});

test('a targeted legendary roll pays once, its hit resolves once, and wrong attack or damage receipts cannot be substituted', (t) => {
  const x = fixture(t);
  x.act({ kind: 'next' });
  const resolved = creatureActionForRolls(x.source, x.tail),
    attack = creatureActionRolls(resolved).find((p) => p.kind === 'attack'),
    damage = creatureActionRolls(resolved).find((p) => p.kind === 'damage');
  x.act({ kind: 'legendary-action', participantId: x.dragon.id, actionId: x.tail.id, cost: 1 });
  const crypto = createRequire(import.meta.url)('node:crypto');
  mock.method(crypto, 'randomInt', (min, max) => max - 1);
  t.after(() => mock.restoreAll());
  const view = x.store.sceneChecks(x.w.token, x.scene.id);
  const result = x.store.executeSceneCheck({
    ...x.cmd({
      kind: 'formula',
      formulaKind: 'attack',
      label: attack.label + ' gegen Alba',
      actor: x.dragon.name,
      formula: attack.formula,
      dc: 18,
      sourceCreatureId: x.source.id,
      sourceActionId: x.tail.id,
    }),
    sceneId: x.scene.id,
    expectedRevision: view.revision,
  });
  const check = result.checks.at(-1);
  assert.equal(check.rolls[0], 20);
  const action = {
    kind: 'hit',
    participantId: x.alba.id,
    critical: true,
    source: { participantId: x.dragon.id, actionId: x.tail.id },
    components: [{ key: creatureRollKey(damage), amount: 15, scale: 'full' }],
    attackCheckId: check.id,
    paidLegendary: true,
  };
  const before = structuredClone(x.combat);
  x.act(action);
  assert.equal(
    x.combat.participants.find((p) => p.id === x.dragon.id).legendaryActions.remaining,
    2,
  );
  assert.equal(
    x.combat.participants.find((p) => p.id === x.dragon.id).legendaryActions.hitResolved,
    true,
  );
  assert.throws(() => x.act(action), /bereits/);
  x.act({ kind: 'undo' });
  assert.deepEqual(x.combat.participants, before.participants);
  assert.throws(() => x.act({ ...action, critical: false }), /Kritisch/);
  assert.throws(
    () => x.act({ ...action, components: [{ ...action.components[0], sourceCheckId: check.id }] }),
    /Schadensbetrag/,
  );
});
test('death saves are one shared health fact across masks, canonical progress, reopen and independent copy', async (t) => {
  const x = fixture(t);
  x.act(x.hit());
  const first = x.combat.id,
    create = x.cmd({
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Zweite Maske',
      includeParty: true,
      expectedMembershipRevision: x.scene.membershipRevision,
    });
  create.combatId = create.expectedRevision = null;
  x.combat = x.store.executeCombat(create).combat;
  const second = x.combat.id,
    hero = () => actor(x),
    state = (id) => x.store.combat(x.w.token, x.scene.id, id).combat,
    canonical = () =>
      JSON.parse(
        x.store.db
          .prepare('SELECT payload FROM character_progress WHERE campaign_id=? AND id=?')
          .get(x.cam.id, x.characterId).payload,
      ).health;
  x.act({ kind: 'death', participantId: hero().id, result: 'success' });
  assert.equal(canonical().death.successes, 1);
  assert.deepEqual(
    state(first).participants.find((p) => p.characterId === x.characterId).death,
    hero().death,
  );
  x.combat = state(first);
  x.act({ kind: 'death', participantId: hero().id, result: 'failure' });
  assert.deepEqual(canonical().death, { successes: 1, failures: 1, stable: false, dead: false });
  assert.deepEqual(
    state(second).participants.find((p) => p.characterId === x.characterId).death,
    hero().death,
  );
  const before = structuredClone(state(second));
  x.act({ kind: 'heal', participantId: hero().id, amount: 7 });
  const other = state(second);
  assert.equal(other.participants[0].hp, 7);
  assert.equal(other.participants[0].death, undefined);
  assert.equal(other.participants[0].deathLast, undefined);
  assert.equal(other.turnId, before.turnId);
  assert.equal(other.round, before.round);
  assert.equal(x.store.combat(x.w.token, x.scene.id, second).canUndo, false);
  assert.equal(canonical().death, undefined);
  x.act({ kind: 'undo' });
  assert.deepEqual(canonical().death, { successes: 1, failures: 1, stable: false, dead: false });
  assert.deepEqual(state(second).participants[0].death, hero().death);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(state(first).participants[0].death, state(second).participants[0].death);
  assert.deepEqual(canonical().death, state(first).participants[0].death);
  const snapshot = x.root + '/snapshot.sqlite';
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
    w = x.store.activate(copy.id),
    copied = x.store.db
      .prepare('SELECT payload FROM combat WHERE campaign_id=?')
      .all(copy.id)
      .map((r) => JSON.parse(r.payload));
  assert.equal(copied.length, 2);
  const copiedHero = copied[0].participants.find((p) => p.characterId).characterId;
  assert.notEqual(copiedHero, x.characterId);
  const copyHealth = x.store
    .progress(w.token)
    .characters.find((p) => p.characterId === copiedHero).health;
  assert.deepEqual(copyHealth.death, { successes: 1, failures: 1, stable: false, dead: false });
  assert(
    copied.every(
      (c) =>
        JSON.stringify(c.participants.find((p) => p.characterId === copiedHero).death) ===
        JSON.stringify(copyHealth.death),
    ),
  );
});
test('healing a PC in another mask removes old death flags without touching finished history', (t) => {
  const x = fixture(t);
  x.act(x.hit());
  x.act({ kind: 'death', participantId: actor(x).id, result: 'failure' });
  x.act({ kind: 'finish', outcome: 'Historischer Abschluss' });
  const history = x.store.db
      .prepare('SELECT payload FROM combat WHERE campaign_id=? AND id=?')
      .get(x.cam.id, x.combat.id).payload,
    finished = x.combat.id;
  const create = (title) => {
      const c = x.cmd({
        kind: 'create',
        sceneId: x.scene.id,
        title,
        includeParty: true,
        expectedMembershipRevision: x.scene.membershipRevision,
      });
      c.combatId = c.expectedRevision = null;
      x.combat = x.store.executeCombat(c).combat;
      return x.combat.id;
    },
    old = create('Offene Maske');
  create('Neue Maske');
  x.act({ kind: 'heal', participantId: actor(x).id, amount: 3 });
  assert.equal(
    x.store
      .combat(x.w.token, x.scene.id, old)
      .combat.participants.find((p) => p.characterId === x.characterId).death,
    undefined,
  );
  assert.equal(
    x.store
      .combat(x.w.token, x.scene.id, old)
      .combat.participants.find((p) => p.characterId === x.characterId).hp,
    3,
  );
  assert.equal(
    x.store.db
      .prepare('SELECT payload FROM combat WHERE campaign_id=? AND id=?')
      .get(x.cam.id, finished).payload,
    history,
  );
});

test('ending shared concentration clears a pending check in another open mask', (t) => {
  const x = fixture(t),
    first = x.combat.id;
  x.act({ kind: 'damage', participantId: actor(x).id, amount: 1 });
  assert.equal(actor(x).concentrationChecks.length, 1);
  const c = x.cmd({
    kind: 'create',
    sceneId: x.scene.id,
    title: 'Andere Maske',
    includeParty: true,
    expectedMembershipRevision: x.scene.membershipRevision,
  });
  c.combatId = c.expectedRevision = null;
  x.combat = x.store.executeCombat(c).combat;
  x.act({ kind: 'edit', participantId: actor(x).id, changes: { concentrating: false } });
  const other = x.store
    .combat(x.w.token, x.scene.id, first)
    .combat.participants.find((p) => p.characterId === x.characterId);
  assert.equal(other.concentrating, false);
  assert.equal(other.concentrationChecks, undefined);
});

test('a late mirrored-mask write failure rolls back canonical death, both masks and the receipt', (t) => {
  const x = fixture(t);
  x.act(x.hit());
  const first = x.combat.id,
    c = x.cmd({
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Andere Maske',
      includeParty: true,
      expectedMembershipRevision: x.scene.membershipRevision,
    });
  c.combatId = c.expectedRevision = null;
  const second = x.store.executeCombat(c).combat;
  x.combat = x.store.combat(x.w.token, x.scene.id, first).combat;
  const command = x.cmd({ kind: 'death', participantId: actor(x).id, result: 'failure' });
  x.store.db.exec(
    `CREATE TRIGGER owned_mask_failure BEFORE UPDATE ON combat WHEN NEW.id='${second.id}' BEGIN SELECT RAISE(ABORT,'Mirrored mask unavailable');END;`,
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeCombat(command), /Mirrored mask unavailable/);
  assert.ok(x.store.db.serialize().equals(before));
  x.store.db.exec('DROP TRIGGER owned_mask_failure');
  const result = x.store.executeCombat(command);
  assert.equal(
    result.combat.participants.find((p) => p.characterId === x.characterId).death.failures,
    1,
  );
  assert.deepEqual(x.store.executeCombat(command), result);
  assert.equal(
    x.store.combat(x.w.token, x.scene.id, second.id).combat.participants[0].death.failures,
    1,
  );
});

test('massive damage kills once; ordinary healing and positive HP edits cannot revive; explicit revival is atomic, durable and undoable', (t) => {
  const x = fixture(t);
  x.act({
    kind: 'edit',
    participantId: x.alba.id,
    changes: { hp: 8, maxHp: 20, tempHp: 0, concentrating: false },
  });
  x.act(x.hit());
  assert.equal(actor(x).death.dead, true);
  assert.equal(actor(x).hp, 0);
  const dead = structuredClone(actor(x));
  for (const action of [
    { kind: 'heal', participantId: x.alba.id, amount: 7 },
    { kind: 'edit', participantId: x.alba.id, changes: { hp: 7 } },
    { kind: 'revive', participantId: x.alba.id, hp: 0 },
    { kind: 'revive', participantId: x.alba.id, hp: 21 },
    { kind: 'revive', participantId: x.dragon.id, hp: 1 },
  ]) {
    const before = x.store.db.serialize();
    assert.throws(() => x.act(action));
    assert.ok(x.store.db.serialize().equals(before));
  }
  const command = x.cmd({ kind: 'revive', participantId: x.alba.id, hp: 1 }),
    result = x.store.executeCombat(command);
  x.combat = result.combat;
  assert.equal(actor(x).hp, 1);
  assert.equal(actor(x).death, undefined);
  assert.equal(actor(x).deathLast, undefined);
  assert.equal(actor(x).concentrating, false);
  assert.deepEqual(x.store.executeCombat(command), result);
  assert.throws(() => x.act({ kind: 'revive', participantId: x.alba.id, hp: 1 }));
  assert.equal(x.store.progress(x.w.token).characters[0].health.hp, 1);
  const id = x.combat.id;
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  x.combat = x.store.combat(x.w.token, x.scene.id, id).combat;
  assert.equal(actor(x).hp, 1);
  x.act({ kind: 'undo' });
  assert.deepEqual(actor(x), dead);
  assert.equal(x.store.progress(x.w.token).characters[0].health.death.dead, true);
});
test('ordinary healing remains valid for dying and stabilized PCs, including temporary HP absorbed damage', (t) => {
  const x = fixture(t);
  x.act(x.hit());
  x.act({ kind: 'death', participantId: x.alba.id, result: 'stabilize' });
  x.act({ kind: 'heal', participantId: x.alba.id, amount: 1 });
  assert.equal(actor(x).hp, 1);
  assert.equal(actor(x).death, undefined);
  x.act({ kind: 'edit', participantId: x.alba.id, changes: { hp: 8, maxHp: 20, tempHp: 11 } });
  x.act(x.hit());
  assert.equal(actor(x).hp, 0);
  assert.equal(actor(x).death?.dead, undefined);
  x.act({ kind: 'heal', participantId: x.alba.id, amount: 7 });
  assert.equal(actor(x).hp, 7);
});
test('hit preview reports massive damage after temporary HP, does not invent death failures for fully absorbed hits, and warns on the last failure', async (t) => {
  const x = fixture(t),
    document = await dom(t),
    root = document.getElementById('hit'),
    panel = new CombatHitPanel(
      root,
      async () => true,
      async () => null,
    );
  x.act({
    kind: 'edit',
    participantId: x.alba.id,
    changes: { hp: 8, maxHp: 20, tempHp: 0, concentrating: false },
  });
  panel.context(x.combat, x.w.token, false);
  panel.open({ attackerId: x.dragon.id, action: x.bite });
  const amounts = [...root.querySelectorAll('.combat-hit-part input[type=number]')];
  for (const [i, v] of ['30', '8'].entries()) {
    amounts[i].value = v;
    amounts[i].oninput();
  }
  assert.match(root.textContent, /Sofortiger Tod: 30 Restschaden ≥ 20 maximale HP/);
  root.querySelector('#combat-hit-cancel').onclick();
  x.act({ kind: 'edit', participantId: x.alba.id, changes: { hp: 0, tempHp: 40 } });
  panel.context(x.combat, x.w.token, false);
  panel.open({ attackerId: x.dragon.id, action: x.bite });
  assert.doesNotMatch(root.textContent, /Todesrettungs-Fehlschläge|Sofortiger Tod/);
  root.querySelector('#combat-hit-cancel').onclick();
  x.act({ kind: 'edit', participantId: x.alba.id, changes: { tempHp: 0, maxHp: 100 } });
  x.act({ kind: 'death', participantId: x.alba.id, result: 'failure' });
  panel.context(x.combat, x.w.token, false);
  panel.open({ attackerId: x.dragon.id, action: x.bite });
  root.querySelector('#combat-hit-critical').checked = true;
  root.querySelector('#combat-hit-critical').onchange();
  assert.match(root.textContent, /2 Todesrettungs-Fehlschläge → Tot/);
});

test('automatic mixed hit uses target immunity once, persists and undoes as one action; manual overrides remain explicit', (t) => {
  const x = fixture(t);
  x.act({
    kind: 'add-creature',
    creatureId: 'black-pudding',
    count: 1,
    grouped: false,
    initiative: 8,
  });
  const pudding = x.combat.participants.find((p) => p.sourceId === 'black-pudding'),
    target = () => x.combat.participants.find((p) => p.id === pudding.id),
    a = x.hit([17, 4], false);
  a.participantId = pudding.id;
  a.components.forEach((p) => (p.scale = 'auto'));
  const command = x.cmd(a),
    result = x.store.executeCombat(command);
  x.combat = result.combat;
  assert.equal(target().hp, 68);
  assert.deepEqual(x.store.executeCombat(command), result);
  const id = x.combat.id;
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  x.combat = x.store.combat(x.w.token, x.scene.id, id).combat;
  assert.equal(target().hp, 68);
  x.act({ kind: 'undo' });
  assert.equal(target().hp, 85);
  a.components[1].scale = 'full';
  x.act(a);
  assert.equal(target().hp, 64);
});
test('automatic defenses distinguish unconditional types from conditional physical protection without guessing magic, silver, adamantine or spell context', (t) => {
  const x = fixture(t),
    source = (changes) => ({
      ...x.source,
      damageImmunities: '',
      damageResistances: '',
      damageVulnerabilities: '',
      ...changes,
    }),
    damage = (type, amount = 17, changes = {}) =>
      adjustedHitDamage({ ...x.parts[0], damageType: type }, amount, 'auto', source(changes));
  assert.equal(
    damage('acid', 4, { damageImmunities: 'acid, cold, lightning, slashing' }).amount,
    0,
  );
  assert.equal(damage('acid', 9, { damageResistances: 'acid' }).amount, 4);
  assert.equal(damage('bludgeoning', 13, { damageVulnerabilities: 'bludgeoning' }).amount, 26);
  for (const material of ['', " that aren't silvered", " that aren't adamantine"]) {
    const d = {
      damageResistances:
        'cold, bludgeoning, piercing, and slashing from nonmagical weapons' + material,
    };
    assert.equal(damage('piercing', 17, d).amount, null);
    assert.equal(damage('cold', 9, d).amount, 4);
    assert.equal(damage('fire', 9, d).amount, 9);
  }
  assert.equal(
    damage('fire', 9, {
      damageResistances:
        'damage from spells, bludgeoning, piercing, and slashing from nonmagical attacks (from stoneskin)',
    }).amount,
    null,
  );
  assert.equal(
    damage('piercing', 17, {
      damageVulnerabilities: 'piercing from magic weapons wielded by good creatures',
    }).amount,
    null,
  );
  assert.equal(
    damage('fire', 9, {
      damageVulnerabilities: 'piercing from magic weapons wielded by good creatures',
    }).amount,
    9,
  );
  assert.equal(
    damage('acid', 9, { damageResistances: 'acid', damageVulnerabilities: 'acid' }).amount,
    8,
  );
  assert.equal(
    damage('acid', 9, { damageImmunities: 'acid', damageResistances: 'damage from spells' }).amount,
    0,
  );
  assert.equal(
    adjustedHitDamage({ ...x.parts[0], damageType: undefined }, 17, 'auto', source({})).amount,
    null,
  );
});
test('conditional auto defense rejects the entire hit and receipt; manual physical choice plus automatic acid resistance resolves it', (t) => {
  const x = fixture(t);
  x.act({ kind: 'add-creature', creatureId: 'wraith', count: 1, grouped: false, initiative: 8 });
  const wraith = x.combat.participants.find((p) => p.sourceId === 'wraith'),
    a = x.hit([17, 4], false);
  a.participantId = wraith.id;
  a.components.forEach((p) => (p.scale = 'auto'));
  const before = x.store.db.serialize();
  assert.throws(() => x.act(a), /Bedingung/);
  assert.ok(x.store.db.serialize().equals(before));
  a.components[0].scale = 'half';
  x.act(a);
  assert.equal(x.combat.participants.find((p) => p.id === wraith.id).hp, 57);
});
test('hit UI defaults to transparent automatic immunity; target changes recompute defenses and conditional protection requires a choice', async (t) => {
  const x = fixture(t);
  x.act({
    kind: 'add-creature',
    creatureId: 'black-pudding',
    count: 1,
    grouped: false,
    initiative: 8,
  });
  x.act({ kind: 'add-creature', creatureId: 'wraith', count: 1, grouped: false, initiative: 7 });
  const pudding = x.combat.participants.find((p) => p.sourceId === 'black-pudding'),
    wraith = x.combat.participants.find((p) => p.sourceId === 'wraith'),
    document = await dom(t),
    root = document.getElementById('hit'),
    calls = [],
    panel = new CombatHitPanel(
      root,
      async (a) => {
        calls.push(a);
        return true;
      },
      async () => null,
    );
  panel.context(x.combat, x.w.token, false);
  panel.open({ attackerId: x.dragon.id, action: x.bite, targetId: pudding.id });
  assert.match(root.textContent, /Immunität: acid → kein Schaden/);
  assert.match(root.textContent, /17 Schaden als ein Treffer/);
  assert.equal(root.querySelector('#combat-hit-apply').disabled, false);
  const select = root.querySelector('#combat-hit-target');
  for (const o of select.options) o.selected = o.value === wraith.id;
  select.onchange();
  assert.match(root.textContent, /Bedingung am Tisch prüfen/);
  assert.equal(root.querySelector('#combat-hit-apply').disabled, true);
  const scale = root.querySelector('.combat-hit-part select');
  scale.querySelector('option[value=half]').selected = true;
  scale.onchange();
  assert.equal(root.querySelector('#combat-hit-apply').disabled, false);
  await root.querySelector('#combat-hit-apply').onclick();
  assert.deepEqual(
    calls[0].components.map((p) => p.scale),
    ['half', 'auto'],
  );
});
