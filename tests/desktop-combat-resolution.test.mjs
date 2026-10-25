import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {makeTreasure} from './src/app/storage/progression';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-resolution-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  stdin: {
    contents:
      "export {CombatResolutionPanel} from './src/app/combat-resolution-ui';export {TreasureDistribution} from './src/app/treasure-distribution-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-resolution-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore, makeTreasure } = require('../.build/combat-resolution-store.cjs'),
  { CombatResolutionPanel, TreasureDistribution } = require('../.build/combat-resolution-ui.cjs');
const coin = { name: 'Silbermünzen', category: 'coins', quantity: 12, valueGold: '0.1' },
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await tick();
  assert.ok(check());
}
function fixture(t, loot = true) {
  const root = mkdtempSync(path.join(tmpdir(), 'combat-resolution-')),
    file = path.join(root, 'world.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Kronenruine'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const people = ['Ada', 'Borin'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  for (const c of people) {
    const v = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: v.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: v.focusRevision,
      }),
    );
    store.executeProgress(
      command({
        kind: 'xp',
        characterId: c.id,
        expectedRevision: store.progress(w.token).characters.find((p) => p.characterId === c.id)
          .revision,
        mode: 'set',
        amount: 0,
        reason: 'Anfang',
      }),
    );
  }
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const combat = store.executeCombat({
      ...command({
        kind: 'create',
        sceneId: scene.id,
        title: 'Torwache',
        includeParty: true,
        expectedMembershipRevision: scene.membershipRevision,
      }),
      combatId: null,
      expectedRevision: null,
    }).combat,
    recipients = store
      .progress(w.token)
      .characters.map((c) => ({ characterId: c.characterId, revision: c.revision })),
    finish = {
      ...command({
        kind: 'finish',
        outcome: 'Tor gesichert',
        rewards: {
          poolXp: 101,
          noXp: false,
          recipients,
          policyVersion: 'xp-ceil-2014-v1',
          loadXp: 0,
          items: loot ? [coin] : [],
        },
      }),
      combatId: combat.id,
      expectedRevision: combat.revision,
    };
  const finished = store.executeCombat(finish).combat;
  return { root, file, store, cam, w, command, scene, people, combat: finished, finish };
}
test('resolution reads typed Treasury identities and distribution preserves the once-only XP award through fresh and copy', async (t) => {
  const x = fixture(t),
    read = () => x.store.combatResolution(x.w.token, x.scene.id, x.combat.id, null),
    before = x.store.db.serialize(),
    result = read();
  assert.ok(before.equals(x.store.db.serialize()));
  assert.equal(result.rewards.totalXp, 102);
  assert.equal(result.treasures[0].source, 'combat');
  assert.equal(result.treasures[0].available, 12);
  assert.deepEqual(x.store.executeCombat(x.finish).combat, x.combat);
  const treasure = x.store.treasure(x.w.token, result.treasures[0].id),
    hero = x.store.live(x.w.token).roster[0];
  x.store.executeProgress(
    x.command({
      kind: 'allocate-batch',
      treasureId: treasure.id,
      expectedRevision: treasure.revision,
      allocations: [
        {
          itemId: treasure.items[0].id,
          expectedDefinitionRevision: treasure.items[0].currentDefinition.revision,
          quantity: 5,
          characterId: hero.id,
          expectedMembershipRevision: hero.membershipRevision,
        },
      ],
    }),
  );
  assert.equal(read().treasures[0].available, 7);
  assert(x.store.progress(x.w.token).characters.every((c) => c.xp === 51));
  const fresh = new CampaignStore(x.file);
  try {
    assert.equal(
      fresh.combatResolution(fresh.activate(x.cam.id).token, x.scene.id, x.combat.id, null)
        .treasures[0].available,
      7,
    );
  } finally {
    fresh.close();
  }
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
    w = x.store.activate(copy.id),
    row = x.store.db.prepare('SELECT id,scene_id FROM combat WHERE campaign_id=?').get(copy.id),
    copied = x.store.combatResolution(w.token, row.scene_id, row.id, null);
  assert.notEqual(copied.treasures[0].id, treasure.id);
  assert.equal(copied.rewards.treasureId, copied.treasures[0].id);
  assert.equal(copied.treasures[0].available, 7);
  assert(x.store.progress(w.token).characters.every((c) => c.xp === 51));
});
test('resolution pages only related nonempty treasures and distinguishes an actual no-loot result', (t) => {
  const x = fixture(t, false);
  assert.deepEqual(
    x.store.combatResolution(x.w.token, x.scene.id, x.combat.id, null).treasures,
    [],
  );
  const place = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: place,
        name: 'Kronenruine',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  const s = x.store.live(x.w.token).scene;
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: s.id,
      expectedRevision: s.revision,
      title: s.title,
      notes: s.notes,
      locationId: place,
    }),
  );
  x.store.db.transaction(() => {
    makeTreasure(x.store.db, x.cam.id, 'Nicht zugeordnet', null, null, [coin]);
    for (let i = 0; i < 28; i++)
      makeTreasure(x.store.db, x.cam.id, 'Ortsschatz ' + i, null, null, [coin], place);
  })();
  const first = x.store.combatResolution(x.w.token, x.scene.id, x.combat.id, null),
    second = x.store.combatResolution(x.w.token, x.scene.id, x.combat.id, first.next);
  assert.equal(first.treasures.length, 25);
  assert.equal(second.treasures.length, 3);
  assert.equal(second.next, null);
  assert(first.treasures.every((t) => t.source === 'location'));
  assert.equal(new Set([...first.treasures, ...second.treasures].map((t) => t.id)).size, 28);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.combatResolution(x.w.token, randomUUID(), x.combat.id, null));
  assert.throws(() => x.store.combatResolution(x.w.token, x.scene.id, x.combat.id, '-1'));
  assert.ok(bytes.equals(x.store.db.serialize()));
});
function dom(t) {
  const old = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><section id="root"></section></body></html>');
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, old));
  return { window, document };
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
test('late resolution results and old distribution buttons cannot act on another combat; failures stay distinct from no loot', async (t) => {
  const { window, document } = dom(t),
    pending = deferred(),
    sent = [],
    root = document.getElementById('root');
  let calls = 0;
  window.campaign = {
    combatResolution: async () =>
      ++calls === 1
        ? pending.promise
        : {
            ok: true,
            value: {
              combatId: 'b',
              sceneId: 's',
              combatRevision: 2,
              sceneRevision: 1,
              rewards: null,
              outcome: 'Neu',
              treasures: [],
              next: null,
            },
          },
  };
  const panel = new CombatResolutionPanel(
      root,
      async (...args) => sent.push(args),
      () => {},
    ),
    w = { token: 'token' },
    s = { id: 's', revision: 1 };
  panel.context(w, s, { id: 'a', sceneId: 's', phase: 'finished', revision: 2 });
  panel.context(w, s, { id: 'b', sceneId: 's', phase: 'finished', revision: 2 });
  await until(() => root.textContent.includes('Keine zugehörige'));
  pending.resolve({
    ok: true,
    value: {
      combatId: 'a',
      sceneId: 's',
      combatRevision: 2,
      sceneRevision: 1,
      rewards: null,
      outcome: 'Alt',
      treasures: [{ id: 'old', title: 'Alt', quantity: 1, available: 1, source: 'combat' }],
      next: null,
    },
  });
  await tick();
  assert(!root.textContent.includes('Alt'));
  assert.equal(sent.length, 0);
  window.campaign.combatResolution = async () => ({ ok: false, error: 'Datenträger nicht lesbar' });
  await panel.refresh();
  assert.match(root.textContent, /nicht lesbar/);
  assert(!root.textContent.includes('Keine zugehörige'));
  assert.equal(root.querySelector('#combat-resolution-refresh').disabled, false);
  window.campaign.combatResolution = async () => ({
    ok: true,
    value: {
      combatId: 'b',
      sceneId: 's',
      combatRevision: 2,
      sceneRevision: 1,
      rewards: null,
      outcome: 'Neu',
      treasures: [{ id: 'new', title: 'Fund', quantity: 1, available: 1, source: 'combat' }],
      next: null,
    },
  });
  await panel.refresh();
  const oldButton = root.querySelector('[data-treasure-id] button');
  panel.context(w, { id: 'other', revision: 1 }, null);
  oldButton.click();
  assert.equal(sent.length, 0);
});
test('shared distribution checks caller ownership after flush before opening or sending', async (t) => {
  const { window, document } = dom(t);
  let valid = true,
    calls = 0;
  const pending = deferred();
  window.campaign = {
    treasures: async () => {
      calls++;
      return { ok: true, value: { items: [], next: null } };
    },
    progress: async () => ({ ok: true, value: { characters: [] } }),
  };
  const w = { token: 't' },
    distribution = new TreasureDistribution(
      () => {},
      () => w,
      () => pending.promise,
      async () => {
        calls++;
        return true;
      },
    );
  const dialog = document.getElementById('treasure-distribution-dialog');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  const opening = distribution.open('old', 'scene', () => valid);
  valid = false;
  distribution.closeStale();
  pending.resolve(true);
  await opening;
  assert.equal(dialog.open, false);
  assert.equal(calls, 0);
});
