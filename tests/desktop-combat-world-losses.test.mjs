import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/combat-world-losses.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/combat-npc-losses-ui.ts'],
  outfile: '.build/combat-world-losses-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../.build/combat-world-losses.cjs'),
  { CombatNpcLossesPanel } = require('../.build/combat-world-losses-ui.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'world-losses-')),
    file = path.join(root, 'workbench.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Die Torwache'),
    w = store.activate(cam.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      action,
    });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const hero = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Heldin' } }),
  ).character;
  let live = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: hero.id,
      expectedRevision: hero.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const scene = store.executeLive(
    command({
      kind: 'initialize',
      expectedRosterRevision: store.live(w.token).rosterRevision,
    }),
  ).scene;
  const npcs = [0, 1].map((i) => {
    const id = randomUUID();
    return store.executeNpc({
      ...command(null),
      expectedNoteRevision: null,
      expectedRecordRevision: 0,
      expectedActorRevision: null,
      expectedPositionRevision: null,
      npc: {
        id,
        name: 'Wache',
        creatureId: 'guard',
        readAloud: ' Öffentlich\r\n' + i,
        gmNotes: ' Geheim\r\n' + i,
        locationId: null,
        record: {
          id,
          revision: 0,
          factionId: null,
          modifier: -10,
          lifecycle: 'active',
          appearance: 'Blauer Mantel',
          behavior: 'bewacht das Tor',
          history: 'Geschützte Geschichte\r\n',
        },
        health: null,
      },
    });
  });
  let combat = store.executeCombat({
    ...command({
      kind: 'create',
      sceneId: scene.id,
      title: 'Am Tor',
      includeParty: false,
      expectedMembershipRevision: scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  const act = (action) => {
    combat = store.executeCombat({
      ...command(action),
      combatId: combat.id,
      expectedRevision: combat.revision,
    }).combat;
    return combat;
  };
  for (const n of npcs)
    act({
      kind: 'add-world-actor',
      actorId: n.id,
      expectedActorRevision: n.actorRevision,
      expectedRecordRevision: n.record.revision,
    });
  for (const p of [...combat.participants])
    act({ kind: 'damage', participantId: p.id, amount: p.maxHp });
  const finish = () => act({ kind: 'finish', outcome: 'Wachen überwältigt' });
  const read = () => store.combatResolution(w.token, scene.id, combat.id, null);
  const confirmation = (losses = read().npcLosses.map((r) => r.basis)) => ({
    ...command({ kind: 'confirm-npc-losses', losses }),
    combatId: combat.id,
    expectedRevision: combat.revision,
  });
  return {
    root,
    file,
    store,
    cam,
    w,
    npcs,
    scene,
    act,
    finish,
    read,
    confirmation,
    command,
    get combat() {
      return combat;
    },
  };
}
test('NPC defeat is explicit, atomic, replayable, durable and remapped with the finished combat', async (t) => {
  const x = fixture(t);
  for (const n of x.npcs) assert.equal(x.store.npc(x.w.token, n.id).record.lifecycle, 'active');
  assert.throws(
    () =>
      x.store.executeCombat({
        ...x.confirmation([]),
        action: {
          kind: 'confirm-npc-losses',
          losses: [{ actorId: x.npcs[0].id }],
        },
      }),
    /abschluss/i,
  );
  x.finish();
  const before = x.store.db.serialize(),
    result = x.read();
  assert(before.equals(x.store.db.serialize()));
  assert.equal(result.npcLosses.length, 2);
  assert(result.npcLosses.every((n) => n.status === 'available' && n.combatHp === 0));
  const originals = x.npcs.map((n) => x.store.npc(x.w.token, n.id)),
    c = x.confirmation(),
    ack = x.store.executeCombat(c);
  assert.equal(ack.combat.phase, 'finished');
  assert.equal(ack.combat.worldLosses.length, 2);
  assert.deepEqual(x.store.executeCombat(c), ack);
  for (const [i, n] of x.npcs.entries()) {
    const saved = x.store.npc(x.w.token, n.id);
    assert.equal(saved.record.lifecycle, 'defeated');
    assert.equal(saved.record.revision, originals[i].record.revision + 1);
    assert.equal(saved.noteRevision, originals[i].noteRevision);
    assert.equal(saved.gmNotes, originals[i].gmNotes);
    assert.deepEqual(saved.health, originals[i].health);
  }
  assert(x.read().npcLosses.every((n) => n.status === 'confirmed'));
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.cam.id);
    assert(
      fresh
        .combatResolution(w.token, x.scene.id, x.combat.id, null)
        .npcLosses.every((n) => n.status === 'confirmed'),
    );
  } finally {
    fresh.close();
  }
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Unabhängige Torwache', {}),
    cw = x.store.activate(copy.id),
    row = x.store.db.prepare('SELECT id,scene_id FROM combat WHERE campaign_id=?').get(copy.id),
    copied = x.store.combatResolution(cw.token, row.scene_id, row.id, null);
  assert.equal(copied.npcLosses.length, 2);
  for (const n of copied.npcLosses) {
    assert(!x.npcs.some((old) => old.id === n.actorId));
    assert.equal(n.status, 'confirmed');
    assert.equal(x.store.npc(cw.token, n.actorId).record.lifecycle, 'defeated');
  }
});
test('changed profile rejects the whole displayed selection and transaction failure rolls back every NPC and receipt', (t) => {
  const x = fixture(t);
  x.finish();
  const stale = x.confirmation(),
    n = x.store.npc(x.w.token, x.npcs[1].id);
  x.store.executeNpc({
    ...x.command(null),
    expectedNoteRevision: n.noteRevision,
    expectedRecordRevision: n.record.revision,
    expectedActorRevision: n.actorRevision,
    expectedPositionRevision: n.positionRevision,
    npc: { ...n, name: 'Wache mit neuer Geschichte' },
  });
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeCombat(stale), /inzwischen geändert/);
  assert(bytes.equals(x.store.db.serialize()));
  assert(x.npcs.every((n) => x.store.npc(x.w.token, n.id).record.lifecycle === 'active'));
  x.store.db.exec(
    "CREATE TRIGGER loss_fault BEFORE INSERT ON world_history WHEN json_extract(NEW.payload,'$.kind')='npc-losses' BEGIN SELECT RAISE(ABORT,'loss write failed'); END",
  );
  const c = x.confirmation(),
    before = x.store.db.serialize();
  assert.throws(() => x.store.executeCombat(c), /loss write failed/);
  assert(before.equals(x.store.db.serialize()));
  assert.equal(
    x.store.db.prepare('SELECT 1 FROM combat_receipt WHERE command_id=?').get(c.commandId),
    undefined,
  );
});
test('reactivation preserves authorship and an old confirmed combat cannot defeat the NPC a second time', (t) => {
  const x = fixture(t);
  x.finish();
  const c = x.confirmation();
  x.store.executeCombat(c);
  const n = x.store.npc(x.w.token, x.npcs[0].id);
  const revived = x.store.executeNpc({
    ...x.command(null),
    expectedNoteRevision: n.noteRevision,
    expectedRecordRevision: n.record.revision,
    expectedActorRevision: n.actorRevision,
    expectedPositionRevision: n.positionRevision,
    npc: {
      ...n,
      record: { ...n.record, lifecycle: 'active' },
      health: { ...n.health, hp: 1 },
    },
  });
  assert.equal(revived.record.history, n.record.history);
  assert.equal(revived.record.lifecycle, 'active');
  assert.equal(revived.health.hp, 1);
  const combat = x.store.combat(x.w.token, x.scene.id, x.combat.id).combat,
    old = {
      ...x.command(c.action),
      combatId: combat.id,
      expectedRevision: combat.revision,
    },
    before = x.store.db.serialize();
  assert.throws(() => x.store.executeCombat(old), /bereits bestätigt/);
  assert(before.equals(x.store.db.serialize()));
  assert.equal(x.read().npcLosses[0].status, 'confirmed');
});
test('loss UI requires explicit selection, offers only 0-HP suggestions and invalidates detached actions', async (t) => {
  const prior = { document: globalThis.document, window: globalThis.window },
    { document, window } = parseHTML('<html><body></body></html>');
  Object.assign(globalThis, { document, window });
  t.after(() => Object.assign(globalThis, prior));
  const panel = new CombatNpcLossesPanel();
  document.body.append(panel.root);
  const calls = [],
    profiles = [],
    rows = [0, 1].map((i) => ({
      participantId: 'p' + i,
      actorId: 'a' + i,
      name: 'Wache ' + i,
      combatHp: i ? 5 : 0,
      status: 'available',
      basis: {
        participantId: 'p' + i,
        actorId: 'a' + i,
        noteRevision: 1,
        recordRevision: 1,
        actorRevision: 2,
      },
    }));
  let valid = true;
  panel.draw(
    rows,
    () => valid,
    async (losses, current) => {
      calls.push({ losses, current: current() });
      return true;
    },
    async (id) => profiles.push(id),
  );
  const confirm = panel.root.querySelector('#combat-npc-loss-confirm');
  assert.equal(confirm.disabled, true);
  assert.equal(calls.length, 0);
  panel.root.querySelector('#combat-npc-loss-suggested').click();
  assert.match(panel.root.textContent, /1 NSCs ausgewählt/);
  confirm.click();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].losses, [rows[0].basis]);
  assert.equal(calls[0].current, true);
  const old = panel.root.querySelector('#combat-npc-loss-suggested');
  valid = false;
  old.click();
  confirm.click();
  assert.equal(calls.length, 1);
  valid = true;
  panel.clear();
  old.click();
  confirm.click();
  assert.equal(calls.length, 1);
});
