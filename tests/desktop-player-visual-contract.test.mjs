import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
const base = '.build/planner-player-visual-contract';
mkdirSync(base + '/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  base + '/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {newLocation} from './src/features/location/location-schema';",
    resolveDir: process.cwd(),
    sourcefile: 'player-visual-contract.ts',
    loader: 'ts',
  },
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/player-render.ts'],
  outfile: base + '/render.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
buildSync({
  entryPoints: ['src/app/player-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore, newLocation } = require('../' + base + '/store.cjs'),
  { renderPlayer } = require('../' + base + '/render.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'player-visual-')),
    filename = path.join(root, 'campaign.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Bildschirmvertrag');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    expectedFocusId: x.store.live(x.w.token).focusId,
    expectedFocusRevision: x.store.live(x.w.token).focusRevision,
    expectedFocusMembershipRevision: x.store.live(x.w.token).scene?.membershipRevision ?? null,
    expectedFocusLocationId: x.store.live(x.w.token).scene?.locationId ?? null,
    action,
  });
  x.hero = x.store.executeLive(
    x.command({ kind: 'create-character', profile: { name: 'Ada' } }),
  ).character;
  let live = x.store.live(x.w.token);
  x.scene = x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }),
  ).scene;
  live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: x.hero.id,
      expectedRevision: x.hero.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  x.location = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: newLocation(x.location, 'Interner Ort: Vampir', 'poi', [
        randomUUID(),
        randomUUID(),
      ]),
    },
  });
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: x.scene.id,
      expectedRevision: 0,
      title: 'Geheime Scene',
      notes: 'Privater Hinterhalt',
      readAloud: 'Nicht für den passiven Kanal',
      locationId: x.location,
    }),
  );
  const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTfcAAAAASUVORK5CYII=',
      'base64',
    ),
    sha256 = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(root + '/player-images');
  writeFileSync(root + '/player-images/' + sha256 + '.png', bytes);
  x.asset = {
    id: randomUUID(),
    kind: 'location',
    subjectId: x.location,
    title: 'Freigegebene Ortsart',
    sha256,
    extension: '.png',
    bytes: bytes.length,
  };
  x.store.registerPlayerAsset(x.w.token, x.asset);
  x.settings = {
    blank: false,
    mode: 'follow',
    imageId: null,
    title: '',
    labels: false,
    light: 'daylight',
    displayId: null,
    fullscreen: false,
  };
  x.store.executePlayer({
    ...x.command({ kind: 'settings', settings: x.settings }),
    expectedRevision: 0,
  });
  return x;
}
for (const kind of ['combat', 'chase'])
  test(`active ${kind} preserves the approved location image and does not publish mechanics`, (t) => {
    const x = fixture(t),
      before = x.store.currentPlayerFrame();
    assert.equal(before.mode, 'image');
    if (kind === 'combat') {
      const scene = x.store.live(x.w.token).scene;
      let c = x.store.executeCombat({
        ...x.command({
          kind: 'create',
          sceneId: scene.id,
          title: 'Geheimer Kampf',
          includeParty: true,
          expectedMembershipRevision: scene.membershipRevision,
        }),
        combatId: null,
        expectedRevision: null,
      }).combat;
      c = x.store.executeCombat({
        ...x.command({ kind: 'add-creature', creatureId: 'goblin', count: 1, grouped: false }),
        combatId: c.id,
        expectedRevision: c.revision,
      }).combat;
      x.mask = x.store.executeCombat({
        ...x.command({ kind: 'start' }),
        combatId: c.id,
        expectedRevision: c.revision,
      }).combat;
    } else {
      x.mask = x.store.executeChase({
        ...x.command({ kind: 'create', title: 'Geheime Jagd', goal: 'Nicht veröffentlichen' }),
        sceneId: x.scene.id,
        chaseId: null,
        expectedRevision: null,
      }).chase;
    }
    const bytes = x.store.db.serialize(),
      frame = x.store.currentPlayerFrame();
    assert.deepEqual(frame, before);
    assert.doesNotMatch(
      JSON.stringify(frame),
      /combat|chase|Geheim|Vorles|HP|initiative|exhaustion/,
    );
    assert.ok(x.store.db.serialize().equals(bytes));
    assert.equal(
      kind === 'combat'
        ? x.store.combat(x.w.token, x.scene.id, x.mask.id).combat.id
        : x.store.chase(x.w.token, x.scene.id, x.mask.id).chase.id,
      x.mask.id,
    );
  });
test('new read-aloud display requests fail without changing data or adding a receipt', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    c = {
      ...x.command({ kind: 'settings', settings: { ...x.settings, mode: 'scene' } }),
      expectedRevision: 1,
    };
  assert.throws(() => x.store.executePlayer(c), /Karten|Art|Text/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM player_receipt WHERE command_id=?').get(c.commandId)
      .n,
    0,
  );
});
test('legacy read-aloud settings remain intact across Fresh, backup and copy but produce a neutral frame', async (t) => {
  const x = fixture(t),
    row = x.store.db
      .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='settings'")
      .get(x.cam.id),
    saved = { ...JSON.parse(row.payload), mode: 'scene', boundSceneId: x.scene.id },
    payload = JSON.stringify(saved);
  x.store.db
    .prepare(
      "UPDATE player_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='settings'",
    )
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id);
  assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  assert.equal(x.store.playerView(x.w.token).settings.mode, 'scene');
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  assert.equal(
    x.store.db
      .prepare("SELECT payload FROM player_record WHERE campaign_id=? AND kind='settings'")
      .get(x.cam.id).payload,
    payload,
  );
  const file = path.join(x.root, 'legacy.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Kopie', {});
  x.w = x.store.activate(copy.id);
  assert.equal(x.store.playerView(x.w.token).settings.mode, 'scene');
  assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  assert.ok(readFileSync(file).equals(bytes));
});
for (const mode of ['scene', 'combat', 'chase'])
  test(`renderer rejects old ${mode} packages including their headings`, () => {
    const { document } = parseHTML('<html><body><div id="stage"></div></body></html>'),
      previous = globalThis.document;
    globalThis.document = document;
    try {
      const stage = document.getElementById('stage');
      renderPlayer(stage, {
        mode,
        title: 'Nicht freigegebene Überschrift',
        scene: { text: 'Vorlesetext' },
        combat: { round: 1, currentName: 'Ada', participants: [] },
        chase: { round: 1, participants: [] },
      });
      assert.equal(stage.children.length, 0);
    } finally {
      globalThis.document = previous;
    }
  });

test('live visual cues use approved artwork and blank without changing scene prose', async (t) => {
  const x = fixture(t),
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  window.campaign = {
    playerView: async (token) => ({ ok: true, value: x.store.playerView(token) }),
    executePlayer: async (command) => ({ ok: true, value: x.store.executePlayer(command) }),
    playerWindow: async (token, open) => {
      x.store.playerWindowOpen(token, open);
      return { ok: true };
    },
  };
  delete require.cache[require.resolve('../' + base + '/ui.cjs')];
  const ui = require('../' + base + '/ui.cjs');
  ui.initPlayerUI(
    () => {},
    () => x.w,
    async () => true,
  );
  try {
    const before = x.store.db
      .prepare('SELECT * FROM live_scene WHERE campaign_id=? AND id=?')
      .get(x.cam.id, x.scene.id);
    assert.equal(await ui.cuePlayer('follow', x.store.playerView(x.w.token)), true);
    assert.equal(x.store.currentPlayerFrame().mode, 'image');
    assert.equal(await ui.cuePlayer('blank', null), true);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    assert.deepEqual(
      x.store.db
        .prepare('SELECT * FROM live_scene WHERE campaign_id=? AND id=?')
        .get(x.cam.id, x.scene.id),
      before,
    );
    assert.equal(document.getElementById('running-player-scene'), null);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('visual write authority rejects a same-group A-B-A focus cycle and missing focus basis atomically', (t) => {
  const x = fixture(t),
    live = x.store.live(x.w.token),
    b = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Borin' } }),
    ).character,
    after = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: b.id,
      expectedRevision: b.membershipRevision,
      expectedRosterRevision: after.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: after.focusRevision,
    }),
  );
  const current = x.store.live(x.w.token),
    split = x.store.executeLive(
      x.command({
        kind: 'move',
        sceneId: x.scene.id,
        expectedRosterRevision: current.rosterRevision,
        expectedFocusRevision: current.focusRevision,
        expectedClockRevision: current.scene.clock.revision,
        expectedSceneMembershipRevision: current.scene.membershipRevision,
        memberIds: [b.id],
        target: {
          kind: 'new',
          title: 'Andere Gruppe',
          expectedContentRevision: current.scene.revision,
        },
      }),
    ).session.createdScene;
  const c = {
    ...x.command({ kind: 'settings', settings: x.settings }),
    expectedRevision: x.store.playerView(x.w.token).settings.revision,
  };
  x.store.executeLive(
    x.command({
      kind: 'focus',
      sceneId: split.id,
      expectedRevision: x.store.live(x.w.token).focusRevision,
    }),
  );
  x.store.executeLive(
    x.command({
      kind: 'focus',
      sceneId: x.scene.id,
      expectedRevision: x.store.live(x.w.token).focusRevision,
    }),
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executePlayer(c), /Fokussierte Gruppe geändert/);
  assert.ok(x.store.db.serialize().equals(before));
  const legacy = {
    ...x.command({ kind: 'settings', settings: x.settings }),
    expectedRevision: x.store.playerView(x.w.token).settings.revision,
  };
  delete legacy.expectedFocusId;
  delete legacy.expectedFocusRevision;
  assert.throws(() => x.store.executePlayer(legacy), /Fokussierte Gruppe geändert/);
  assert.ok(x.store.db.serialize().equals(before));
});

test('reviewed publication rejects changed membership even when focus identity and revision stay the same', (t) => {
  const x = fixture(t),
    reviewed = x.store.playerView(x.w.token),
    b = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Borin' } }),
    ).character,
    live = x.store.live(x.w.token);
  const command = {
    ...x.command({ kind: 'settings', settings: x.settings }),
    expectedRevision: reviewed.settings.revision,
    expectedFocusMembershipRevision: reviewed.focusMembershipRevision,
  };
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: b.id,
      expectedRevision: b.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const updated = x.store.playerView(x.w.token);
  assert.equal(updated.focusId, reviewed.focusId);
  assert.equal(updated.focusRevision, reviewed.focusRevision);
  assert.notEqual(updated.focusMembershipRevision, reviewed.focusMembershipRevision);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executePlayer(command), /Fokussierte Gruppe geändert/);
  assert.ok(x.store.db.serialize().equals(before));
  x.store.executePlayer({
    ...command,
    commandId: randomUUID(),
    expectedFocusMembershipRevision: updated.focusMembershipRevision,
  });
  assert.equal(x.store.currentPlayerFrame().mode, 'image');
});

test('a reviewed image loses authority after the same group changes location without changing membership', (t) => {
  const x = fixture(t),
    reviewed = x.store.playerView(x.w.token),
    command = {
      ...x.command({
        kind: 'settings',
        settings: { ...x.settings, mode: 'image', imageId: x.asset.id },
      }),
      expectedRevision: reviewed.settings.revision,
    },
    scene = x.store.live(x.w.token).scene;
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      title: scene.title,
      notes: scene.notes,
      readAloud: scene.readAloud,
      locationId: null,
    }),
  );
  const current = x.store.playerView(x.w.token);
  assert.equal(current.focusId, reviewed.focusId);
  assert.equal(current.focusRevision, reviewed.focusRevision);
  assert.equal(current.focusMembershipRevision, reviewed.focusMembershipRevision);
  assert.notEqual(current.focusLocationId, reviewed.focusLocationId);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executePlayer(command), /Fokussierte Gruppe geändert/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM player_receipt WHERE command_id=?')
      .get(command.commandId).n,
    0,
  );
  x.store.executePlayer({
    ...command,
    commandId: randomUUID(),
    expectedFocusLocationId: current.focusLocationId,
  });
  assert.equal(x.store.currentPlayerFrame().mode, 'image');
});

test('direct NPC portrait cue uses approved art and preserves private note and scene records', async (t) => {
  const x = fixture(t),
    npcId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: npcId,
        revision: 1,
        kind: 'npc',
        title: 'GM Geheimidentität',
        readAloud: 'Privater Vorlesetext',
        gmNotes: 'Geheimer Plan',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  const asset = {
    ...x.asset,
    id: randomUUID(),
    kind: 'npc',
    subjectId: npcId,
    title: 'Freigegebenes Porträt',
  };
  x.store.registerPlayerAsset(x.w.token, asset);
  const before = x.store.db
      .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.cam.id, npcId),
    sceneBefore = x.store.db
      .prepare('SELECT * FROM live_scene WHERE campaign_id=? AND id=?')
      .get(x.cam.id, x.scene.id),
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  let picks = 0;
  window.campaign = {
    playerView: async (token) => ({ ok: true, value: x.store.playerView(token) }),
    executePlayer: async (command) => ({ ok: true, value: x.store.executePlayer(command) }),
    playerWindow: async (token, open) => {
      x.store.playerWindowOpen(token, open);
      return { ok: true };
    },
    pickPlayerArt: async () => {
      picks++;
      throw Error('Existing approved portrait must be used');
    },
  };
  delete require.cache[require.resolve('../' + base + '/ui.cjs')];
  const ui = require('../' + base + '/ui.cjs');
  ui.initPlayerUI(
    () => {},
    () => x.w,
    async () => true,
  );
  try {
    assert.equal(await ui.cuePlayerImage('npc', npcId, x.store.playerView(x.w.token)), true);
    assert.deepEqual(x.store.currentPlayerFrame(), {
      mode: 'image',
      title: asset.title,
      imageId: asset.id,
    });
    assert.equal(picks, 0);
    assert.doesNotMatch(
      JSON.stringify(x.store.currentPlayerFrame()),
      /GM Geheimidentität|Privater Vorlesetext|Geheimer Plan/,
    );
    assert.deepEqual(
      x.store.db
        .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
        .get(x.cam.id, npcId),
      before,
    );
    assert.deepEqual(
      x.store.db
        .prepare('SELECT * FROM live_scene WHERE campaign_id=? AND id=?')
        .get(x.cam.id, x.scene.id),
      sceneBefore,
    );
  } finally {
    Object.assign(globalThis, saved);
  }
});
