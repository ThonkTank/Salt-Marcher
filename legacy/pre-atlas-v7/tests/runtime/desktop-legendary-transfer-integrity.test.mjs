import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/legendary-transfer-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../../.build/legendary-transfer-integrity.cjs',
);
test('independent copy preserves the spent legendary action in the remapped current turn', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'legendary-transfer-')),
    store = new CampaignStore(path.join(root, 'store.sqlite'));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Legendäre Herkunft'),
    w = store.activate(cam.id),
    scene = store.executeLive({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene;
  let combat = null;
  const act = (action) => {
    combat = store.executeCombat({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      combatId: combat?.id ?? null,
      expectedRevision: combat?.revision ?? null,
      action,
    }).combat;
  };
  act({
    kind: 'create',
    sceneId: scene.id,
    title: 'Legendenprobe',
    includeParty: false,
    expectedMembershipRevision: scene.membershipRevision,
  });
  act({
    kind: 'add',
    name: 'Ziel',
    count: 1,
    grouped: false,
    maxHp: 20,
    armorClass: 10,
    initiativeBonus: 0,
  });
  act({ kind: 'add-creature', creatureId: 'aboleth', count: 1, grouped: false });
  act({ kind: 'edit', participantId: combat.participants[0].id, changes: { initiative: 20 } });
  act({ kind: 'start' });
  const actor = combat.participants.find((p) => p.sourceId === 'aboleth');
  act({
    kind: 'legendary-action',
    participantId: actor.id,
    actionId: 'psychic-drain-costs-2-actions',
    cost: 2,
  });
  const originalTurn = combat.turnId,
    file = path.join(root, 'legendary.sqlite');
  await store.campaignSnapshot(w.token, file);
  const bytes = readFileSync(file),
    copy = store.acceptCampaignSnapshot(file, 'Kopie', {}),
    next = store.activate(copy.id),
    copied = store.combat(next.token, store.live(next.token).scene.id).combat,
    aboleth = copied.participants.find((p) => p.sourceId === 'aboleth');
  assert.notEqual(copied.turnId, originalTurn);
  assert.equal(aboleth.legendaryActions.lastUsedTurnId, copied.turnId);
  const dbBytes = store.db.serialize();
  assert.throws(
    () =>
      store.executeCombat({
        commandId: randomUUID(),
        campaignId: copy.id,
        token: next.token,
        combatId: copied.id,
        expectedRevision: copied.revision,
        action: {
          kind: 'legendary-action',
          participantId: aboleth.id,
          actionId: 'detect',
          cost: 1,
        },
      }),
    /in diesem Zug bereits/,
  );
  assert.ok(dbBytes.equals(store.db.serialize()));
  assert.ok(bytes.equals(readFileSync(file)));
});
