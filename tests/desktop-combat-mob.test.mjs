import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export * from './src/app/combat-mob-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-mob.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, combatMobs, combatMobRow, canReinforceTroop } = createRequire(
  import.meta.url,
)('../.build/combat-mob.cjs');
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/combat-mob-'),
    x = { root, file: root + '/workbench.sqlite' };
  x.store = new CampaignStore(x.file);
  x.cam = x.store.create('Goblintrupp');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.combat = x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: x.scene.id,
      title: 'Goblinwache',
      includeParty: false,
      expectedMembershipRevision: x.scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  x.execute = (action) =>
    (x.combat = x.store.executeCombat({
      ...x.command(action),
      combatId: x.combat.id,
      expectedRevision: x.combat.revision,
    }).combat);
  x.execute({
    kind: 'add-creature',
    creatureId: 'goblin',
    count: 8,
    grouped: true,
    initiative: 12,
  });
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('mob front, individual conditions, loss, undo and restart project the saved member identities', (t) => {
  const x = fixture(t),
    first = x.combat.participants[0],
    second = x.combat.participants[1];
  x.execute({
    kind: 'edit',
    participantId: second.id,
    changes: { conditions: 'Liegend', tempHp: 3 },
  });
  x.execute({ kind: 'start' });
  let mob = combatMobs(x.combat)[0];
  assert.equal(mob.front.id, first.id);
  assert.equal(mob.living, 8);
  assert.equal(mob.members.length, 8);
  x.execute({ kind: 'damage', participantId: first.id, amount: 7 });
  mob = combatMobs(x.combat)[0];
  assert.equal(mob.front.id, second.id);
  assert.equal(mob.front.conditions, 'Liegend');
  assert.equal(mob.front.tempHp, 3);
  assert.equal(mob.living, 7);
  assert.equal(x.combat.participants[0].hp, 0);
  const saved = structuredClone(x.combat);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(
    combatMobs(x.store.combat(x.w.token, x.scene.id, x.combat.id).combat),
    combatMobs(saved),
  );
  x.execute({ kind: 'undo' });
  assert.equal(combatMobs(x.combat)[0].front.id, first.id);
  assert.equal(combatMobs(x.combat)[0].living, 8);
});
test('packing uses the confirmed partition, retaining separate same-source troops and individual turns', (t) => {
  const x = fixture(t),
    group = x.combat.participants[0].groupId;
  x.execute({
    kind: 'add-creature',
    creatureId: 'goblin',
    count: 2,
    grouped: true,
    initiative: 9,
  });
  x.execute({
    kind: 'add-creature',
    creatureId: 'goblin',
    count: 2,
    grouped: false,
    initiative: 7,
  });
  x.execute({ kind: 'start' });
  let mobs = combatMobs(x.combat);
  assert.deepEqual(
    mobs.map((m) => m.members.length),
    [8, 2],
  );
  assert.equal(mobs[0].active.id, x.combat.turnId);
  x.execute({ kind: 'next' });
  mobs = combatMobs(x.combat);
  assert.equal(mobs[0].completed, 1);
  assert.equal(mobs[0].active.id, x.combat.turnId);
  assert.equal(mobs[0].id, group);
  assert.equal(mobs[1].completed, 0);
  x.execute({
    kind: 'add-creature',
    creatureId: 'goblin',
    count: 1,
    grouped: true,
    groupId: group,
  });
  assert.equal(combatMobs(x.combat)[0].members.length, 9);
  assert.equal(combatMobs(x.combat)[0].completed, 1);
});
test('compact card exposes front HP and conditions, distinguishes the active actor and revokes stale callbacks', (t) => {
  const old = globalThis.document;
  globalThis.document = parseHTML('<html><body></body></html>').document;
  t.after(() => {
    globalThis.document = old;
  });
  const x = fixture(t);
  x.execute({
    kind: 'edit',
    participantId: x.combat.participants[0].id,
    changes: { conditions: 'Vergiftet', tempHp: 2 },
  });
  x.execute({ kind: 'start' });
  x.execute({ kind: 'next' });
  const calls = [];
  let current = true;
  const mob = combatMobs(x.combat)[0],
    row = combatMobRow(mob, x.combat, {
      selected: mob.front.id,
      expanded: false,
      current: () => current,
      choose: (id) => calls.push(['choose', id]),
      health: (id) => calls.push(['health', id]),
      initiative: (id) => calls.push(['initiative', id]),
      toggle: () => calls.push(['toggle']),
    });
  assert.match(row.textContent, /8 \/ 8 mit HP/);
  assert.match(row.textContent, /7 \/ 7 HP \+ 2 temporär/);
  assert.match(row.textContent, /Vergiftet/);
  assert.match(row.textContent, /1 \/ 8 Züge/);
  assert.match(row.textContent, /Aktiven Teilnehmer öffnen/);
  row.querySelector('.combat-mob-health').onclick();
  assert.deepEqual(calls, [['health', mob.front.id]]);
  row.querySelector('.combat-mob-toggle').onclick();
  assert.deepEqual(calls.at(-1), ['toggle']);
  current = false;
  for (const button of row.querySelectorAll('button')) button.onclick();
  assert.equal(calls.length, 2);
  assert.equal(row.querySelector('.combat-mob-toggle').getAttribute('aria-expanded'), 'false');
});

test('direct reinforcement applies only to live source-backed troops and retains the card owner guard', (t) => {
  const x = fixture(t);
  x.execute({ kind: 'start' });
  const mob = combatMobs(x.combat)[0],
    { document } = parseHTML('<main></main>'),
    previous = globalThis.document;
  globalThis.document = document;
  try {
    let current = true;
    const calls = [],
      options = {
        expanded: false,
        selected: null,
        current: () => current,
        choose() {},
        health() {},
        initiative() {},
        toggle() {},
        reinforce: (id) => calls.push(id),
      };
    const row = combatMobRow(mob, x.combat, options);
    row.querySelector('.combat-mob-reinforce').onclick();
    assert.deepEqual(calls, [mob.id]);
    current = false;
    row.querySelector('.combat-mob-reinforce').onclick();
    assert.equal(calls.length, 1);
    assert.equal(
      canReinforceTroop(
        mob.members.map((m) => ({ ...m, worldActorId: 'prepared', sourceOrdinal: undefined })),
      ),
      false,
    );
    assert.equal(
      combatMobRow(
        {
          ...mob,
          members: mob.members.map((m) => ({
            ...m,
            worldActorId: 'prepared',
            sourceOrdinal: undefined,
          })),
        },
        x.combat,
        options,
      ).querySelector('.combat-mob-reinforce'),
      null,
    );
    assert.equal(
      combatMobRow(mob, { ...x.combat, phase: 'finished' }, options).querySelector(
        '.combat-mob-reinforce',
      ),
      null,
    );
  } finally {
    globalThis.document = previous;
  }
});
