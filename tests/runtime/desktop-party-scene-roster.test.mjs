import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {PartyRosterPanel} from './src/app/runtime/party-roster-ui';export {partySceneLabels,partyMemberLabels} from './src/app/runtime/party-overview';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/party-scene-roster.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, PartyRosterPanel, partySceneLabels, partyMemberLabels } = createRequire(
  import.meta.url,
)('../../.build/party-scene-roster.cjs');
function fixture(t, count = 4) {
  const root = mkdtempSync(tmpdir() + '/party-scene-roster-'),
    x = { file: root + '/workbench.sqlite' };
  x.store = new CampaignStore(x.file);
  x.cam = x.store.create('Reisegruppe');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.heroes = Array.from(
    { length: count },
    (_, i) =>
      x.store.executeLive(
        x.command({
          kind: 'create-character',
          profile: {
            name: i < 2 ? 'Iri' : 'Figur ' + i,
            playerName: 'Spieler ' + i,
          },
        }),
      ).character,
  );
  x.store.executeLive(
    x.command({
      kind: 'initialize',
      expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
    }),
  );
  x.action = (ids) => {
    const v = x.store.live(x.w.token);
    return {
      kind: 'scene-roster',
      sceneId: v.scene.id,
      expectedRosterRevision: v.rosterRevision,
      expectedFocusRevision: v.focusRevision,
      expectedSceneMembershipRevision: v.scene.membershipRevision,
      memberIds: ids,
    };
  };
  x.execute = (ids) => x.store.executeLive(x.command(x.action(ids)));
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('one roster decision adds/removes the selected scene members atomically, reconciles masks, replays and survives restart', (t) => {
  const x = fixture(t),
    [a, b, c] = x.heroes;
  const first = x.execute([a.id, b.id]),
    scene = first.scene;
  let combat = x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: scene.id,
      title: 'Torwache',
      includeParty: true,
      expectedMembershipRevision: scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  const command = x.command(x.action([b.id, c.id])),
    ack = x.store.executeLive(command);
  assert.deepEqual(new Set(ack.scene.members), new Set([b.id, c.id]));
  assert.equal(ack.rosterRevision, first.rosterRevision + 1);
  assert.deepEqual(x.store.executeLive(command), ack);
  assert.equal(x.store.liveStatus(command, x.w.token).outcome, 'applied');
  assert.equal(
    x.store
      .combat(x.w.token, scene.id, combat.id)
      .combat.participants.some((p) => p.characterId === a.id),
    false,
  );
  assert.equal(
    x.store
      .combat(x.w.token, scene.id, combat.id)
      .combat.participants.some((p) => p.characterId === b.id),
    true,
  );
  assert.equal(
    x.store
      .chronicle(x.w.token)
      .entries.filter((e) => e.category === 'party' && e.title.startsWith('Szenenroster')).length,
    2,
  );
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  const fresh = x.store.live(x.w.token);
  assert.deepEqual(new Set(fresh.scene.members), new Set([b.id, c.id]));
  assert.equal(fresh.roster.find((h) => h.id === a.id).active, false);
  assert.equal(fresh.roster.find((h) => h.id === c.id).active, true);
});
test('foreign scene members and stale roster/focus reject the entire selection without partial writes', (t) => {
  const x = fixture(t),
    [a, b, c] = x.heroes;
  x.execute([a.id, b.id]);
  let v = x.store.live(x.w.token);
  const moved = x.store.executeLive(
    x.command({
      kind: 'move',
      sceneId: v.scene.id,
      expectedRosterRevision: v.rosterRevision,
      expectedFocusRevision: v.focusRevision,
      expectedClockRevision: v.scene.clock.revision,
      expectedSceneMembershipRevision: v.scene.membershipRevision,
      memberIds: [a.id],
      target: {
        kind: 'new',
        title: '',
        expectedContentRevision: v.scene.revision,
      },
    }),
  );
  v = x.store.live(x.w.token);
  const source = v.scenes.find((s) => s.id !== moved.session.createdScene.id);
  x.store.executeLive(
    x.command({
      kind: 'focus',
      sceneId: source.id,
      expectedRevision: v.focusRevision,
    }),
  );
  const invalid = x.command(x.action([b.id, c.id, a.id])),
    before = x.store.db.serialize();
  assert.throws(() => x.store.executeLive(invalid), /anderen Szene/);
  assert.ok(x.store.db.serialize().equals(before));
  const stale = x.command(x.action([b.id, c.id]));
  x.store.executeLive(x.command({ kind: 'create-character', profile: { name: 'Später' } }));
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeLive(stale), /inzwischen geändert/);
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.equal(x.store.liveStatus(stale, x.w.token).outcome, 'conflict');
});
test('the 45-character selector retains filtered selections, excludes other scenes, and revokes stale apply callbacks', async (t) => {
  const previous = globalThis.document;
  globalThis.document = parseHTML('<html><body><section></section></body></html>').document;
  t.after(() => {
    globalThis.document = previous;
  });
  const root = document.querySelector('section'),
    roster = Array.from({ length: 45 }, (_, i) => ({
      id: 'pc-' + String(i).padStart(3, '0'),
      profile: {
        name: i < 2 ? 'Iri' : 'Figur ' + i,
        playerName: 'Spieler ' + i,
      },
      active: i < 3,
      sceneId: i < 2 ? 'scene-a' : i === 2 ? 'scene-b' : null,
    })),
    view = {
      roster,
      rosterRevision: 4,
      focusId: 'scene-a',
      focusRevision: 2,
      scene: {
        id: 'scene-a',
        membershipRevision: 3,
        members: ['pc-000', 'pc-001'],
      },
    };
  let current = true,
    action = null;
  const panel = new PartyRosterPanel(
    root,
    async (a, valid) => {
      if (valid()) action = a;
    },
    async () => {},
    () => {},
  );
  panel.open(view, () => current);
  const search = root.querySelector('input[type=search]'),
    find = (id) => [...root.querySelectorAll('input[type=checkbox]')].find((i) => i.value === id);
  assert.equal(find('pc-002'), undefined);
  search.value = 'Figur 44';
  search.oninput();
  const extra = find('pc-044');
  extra.checked = true;
  extra.onchange();
  search.value = 'Spieler 1';
  search.oninput();
  assert.match(root.querySelector('#party-membership-count').textContent, /3 ausgewählt/);
  search.value = 'Iri';
  search.oninput();
  assert.equal(root.querySelectorAll('input[type=checkbox]').length, 2);
  root.querySelector('#party-membership-apply').onclick();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(new Set(action.memberIds), new Set(['pc-000', 'pc-001', 'pc-044']));
  const saved = action;
  current = false;
  panel.lock();
  root.querySelector('#party-membership-apply').onclick();
  await new Promise((r) => setImmediate(r));
  assert.equal(action, saved);
  assert.equal(root.querySelector('#party-membership-apply').disabled, true);
  assert.match(root.textContent, /Auswahl neu lesen/);
});
test('move destinations use place and membership, disambiguating only collisions without rewriting stored titles', () => {
  const view = {
      scenes: [
        { id: 'scene-a111', title: 'Historischer Name', locationTitle: 'Tor' },
        { id: 'scene-b222', title: 'Anderer Titel', locationTitle: 'Tor' },
        {
          id: 'scene-c333',
          title: 'Nicht als Zieltext',
          locationTitle: 'Wald',
        },
      ],
      roster: [
        { active: true, sceneId: 'scene-a111', profile: { name: 'Iri' } },
        { active: true, sceneId: 'scene-b222', profile: { name: 'Iri' } },
        { active: true, sceneId: 'scene-c333', profile: { name: 'Ada' } },
      ],
    },
    before = JSON.stringify(view),
    labels = partySceneLabels(view);
  assert.equal(labels.get('scene-a111'), 'Tor · Iri · scene-a1');
  assert.equal(labels.get('scene-b222'), 'Tor · Iri · scene-b2');
  assert.equal(labels.get('scene-c333'), 'Wald · Ada');
  assert.equal(JSON.stringify(view), before);
});

test('mask reconciliation failure rolls back the whole roster decision and its receipt', (t) => {
  const x = fixture(t),
    [a, b, c] = x.heroes;
  x.execute([a.id, b.id]);
  const v = x.store.live(x.w.token);
  x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: v.scene.id,
      title: 'Torwache',
      includeParty: true,
      expectedMembershipRevision: v.scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  });
  x.store.db.exec(
    "CREATE TRIGGER roster_reconcile_failure BEFORE INSERT ON mask_reconciliation_receipt BEGIN SELECT RAISE(ABORT,'reconciliation blocked'); END",
  );
  const command = x.command(x.action([b.id, c.id])),
    before = x.store.db.serialize();
  assert.throws(() => x.store.executeLive(command), /reconciliation blocked/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.store.liveStatus(command, x.w.token).outcome, 'not-applied');
});

test('move targets with colliding short IDs stay distinct and stable when scene order changes', () => {
  const a = '12345678-aaaa-4000-8000-111111111111',
    b = '12345678-bbbb-4000-8000-222222222222',
    view = {
      scenes: [
        { id: a, title: 'Historische Prosa A', locationTitle: 'Tor' },
        { id: b, title: 'Historische Prosa B', locationTitle: 'Tor' },
        { id: 'elsewhere', title: 'Unverändert', locationTitle: 'Wald' },
      ],
      roster: [
        { active: true, sceneId: a, profile: { name: 'Iri' } },
        { active: true, sceneId: b, profile: { name: 'Iri' } },
        { active: true, sceneId: 'elsewhere', profile: { name: 'Ada' } },
      ],
    };
  view.scenes.splice(1, 0, view.scenes.pop());
  const before = structuredClone(view),
    labels = partySceneLabels(view);
  assert.deepEqual(
    [...labels.keys()],
    view.scenes.map((scene) => scene.id),
  );
  assert.notEqual(
    labels.get(a),
    labels.get(b),
    'visible move targets must identify different scenes',
  );
  assert.match(labels.get(a), /^Tor · Iri · 12345678-a/);
  assert.match(labels.get(b), /^Tor · Iri · 12345678-b/);
  assert.equal(labels.get('elsewhere'), 'Wald · Ada');
  assert.deepEqual(
    partySceneLabels({ ...view, scenes: [...view.scenes].reverse() }),
    new Map([...labels].reverse()),
  );
  assert.deepEqual(view, before);
});
test('long shared scene-ID prefixes and prefix IDs do not leave equal move labels', () => {
  const ids = ['scene-prefix', 'scene-prefix-a', 'scene-prefix-b', 'scene-prefix-b1'],
    view = {
      scenes: ids.map((id) => ({ id, title: 'Titel ' + id, locationTitle: null })),
      roster: [],
    },
    labels = partySceneLabels(view);
  assert.equal(new Set(labels.values()).size, ids.length);
  for (const id of ids) {
    assert(labels.get(id).startsWith('Ohne Ort · Keine Figuren · '));
    assert(id.startsWith(labels.get(id).split(' · ').at(-1)));
  }
  assert.deepEqual(partySceneLabels(view), labels);
});
test('canonically equivalent visible place and member names also receive distinct scene IDs without normalization writes', () => {
  const a = 'scene-a111',
    b = 'scene-b222',
    view = {
      scenes: [
        { id: a, title: 'Titel A', locationTitle: 'Café' },
        { id: b, title: 'Titel B', locationTitle: 'Cafe\u0301' },
      ],
      roster: [
        { active: true, sceneId: a, profile: { name: 'Íri' } },
        { active: true, sceneId: b, profile: { name: 'I\u0301ri' } },
      ],
    },
    before = JSON.stringify(view),
    labels = partySceneLabels(view);
  assert.notEqual(labels.get(a).normalize('NFC'), labels.get(b).normalize('NFC'));
  assert(labels.get(a).endsWith('scene-a1'));
  assert(labels.get(b).endsWith('scene-b2'));
  assert.equal(JSON.stringify(view), before);
});

test('roster namesakes with colliding ID prefixes remain visibly distinct and keep their identity through filtering', async (t) => {
  const previous = globalThis.document;
  globalThis.document = parseHTML('<html><body><section></section></body></html>').document;
  t.after(() => (globalThis.document = previous));
  const ids = [
      '12345678-aaaa-4000-8000-11111111111a',
      '12345678-aaaa-4000-8000-11111111111b',
      '87654321-aaaa-4000-8000-111111111111',
    ],
    view = {
      roster: ids.map((id) => ({
        id,
        profile: { name: 'Iri', playerName: 'Gleicher Spieler' },
        active: false,
        sceneId: null,
      })),
      rosterRevision: 1,
      focusId: 'scene-a',
      focusRevision: 1,
      scene: { id: 'scene-a', membershipRevision: 1, members: [] },
    },
    before = structuredClone(view),
    root = document.querySelector('section');
  let saved;
  const panel = new PartyRosterPanel(
    root,
    async (action) => {
      saved = action;
    },
    async () => {},
    () => {},
  );
  panel.open(view, () => true);
  const labels = () =>
      new Map(
        [...root.querySelectorAll('.party-membership-row')].map((row) => [
          row.dataset.characterId,
          row.textContent,
        ]),
      ),
    all = labels(),
    short = (id) => all.get(id).split(' · ').at(-1);
  assert.equal(
    new Set(all.values()).size,
    3,
    'visible labels must distinguish the actual selectable characters',
  );
  assert.equal(short(ids[0]), ids[0]);
  assert.equal(short(ids[1]), ids[1]);
  assert.equal(short(ids[2]), ids[2].slice(0, 8), 'unrelated IDs stay compact');
  const search = root.querySelector('input[type=search]');
  search.value = ids[1];
  search.oninput();
  assert.equal(
    labels().get(ids[1]),
    all.get(ids[1]),
    'filter must not change the displayed identity',
  );
  const box = root.querySelector('input[type=checkbox]');
  box.checked = true;
  box.onchange();
  search.value = 'Gleicher Spieler';
  search.oninput();
  assert.deepEqual(labels(), all);
  assert.match(root.querySelector('#party-membership-count').textContent, /1 ausgewählt/);
  root.querySelector('#party-membership-apply').onclick();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(saved.memberIds, [ids[1]]);
  assert.deepEqual(view, before);
  panel.open({ ...view, roster: [...view.roster].reverse() }, () => true);
  assert.deepEqual(
    labels(),
    new Map([...all].reverse()),
    'source order may change; prefixes must not',
  );
});

test('rest identity labels distinguish canonically equal names and shared ID prefixes without rewriting profiles', () => {
  const members = [
      { id: 'same-prefix', profile: { name: 'Áda', playerName: 'Nora' } },
      { id: 'same-prefix-a', profile: { name: 'A\u0301da', playerName: 'Nora' } },
      { id: 'same-prefix-ab', profile: { name: ' Áda ', playerName: 'Nora' } },
      { id: 'unique-person', profile: { name: 'Borin' } },
    ],
    before = structuredClone(members),
    labels = partyMemberLabels(members);
  assert.equal(
    new Set(
      [...labels.values()].map((label) => label.normalize('NFC').replace(/\s+/gu, ' ').trim()),
    ).size,
    4,
  );
  assert.equal(labels.get('unique-person'), 'Borin');
  for (const member of members.slice(0, 3)) assert(labels.get(member.id).includes(member.id));
  assert.deepEqual(partyMemberLabels([...members].reverse()), new Map([...labels].reverse()));
  assert.deepEqual(members, before);
});
