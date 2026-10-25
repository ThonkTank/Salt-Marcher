import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/npc-rename-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/npc-rename-store.cjs');
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'npc-rename-')),
    file = root + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Umbenennung ohne zweite Figur'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const createNpc = (name = 'Borin') => {
    const id = randomUUID();
    return store.executeNpc({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      expectedNoteRevision: null,
      expectedRecordRevision: 0,
      expectedActorRevision: null,
      expectedPositionRevision: null,
      npc: {
        id,
        name,
        creatureId: 'goblin',
        readAloud: '  Blick.\r\n- Mantel',
        gmNotes: '  Borin verbirgt den Ring.\r\n- Geheim',
        record: {
          id,
          revision: 0,
          factionId: null,
          modifier: 0,
          lifecycle: 'active',
          appearance: '',
          behavior: '',
          history: '',
        },
        locationId: null,
        health: { hp: 6, maxHp: 7, tempHp: 2, conditions: 'vergiftet', concentrating: true },
      },
    });
  };
  const npc = createNpc(),
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  const edit = (c, action) =>
    store.executeCombat({ ...command(action), combatId: c.id, expectedRevision: c.revision })
      .combat;
  const add = (c, id = npc.id) => {
    const n = store.npc(w.token, id);
    return edit(c, {
      kind: 'add-world-actor',
      actorId: id,
      expectedActorRevision: n.actorRevision,
      expectedRecordRevision: n.record.revision,
    });
  };
  const make = (title) => {
    let c = store.executeCombat({
      ...command({
        kind: 'create',
        sceneId: scene.id,
        title,
        includeParty: false,
        expectedMembershipRevision: scene.membershipRevision,
      }),
      combatId: null,
      expectedRevision: null,
    }).combat;
    return add(c);
  };
  let finished = edit(make('Gestern'), { kind: 'finish', outcome: 'Unverändert beendet' }),
    a = make('Torwache'),
    b = make('Hinterhalt');
  a = edit(a, { kind: 'edit', participantId: a.participants[0].id, changes: { initiative: 17 } });
  a = edit(a, { kind: 'add-creature', creatureId: 'goblin', count: 1, grouped: false });
  a = edit(a, { kind: 'start' });
  const current = (id) => store.combat(w.token, scene.id, id).combat,
    raw = (id) =>
      store.db.prepare('SELECT revision,payload,checksum FROM combat WHERE id=?').get(id);
  const rename = (name = 'Borin Nachtwache') => {
    const old = store.npc(w.token, npc.id);
    return {
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      expectedNoteRevision: old.noteRevision,
      expectedRecordRevision: old.record.revision,
      expectedActorRevision: old.actorRevision,
      expectedPositionRevision: old.positionRevision,
      npc: { ...old, name },
    };
  };
  return {
    root,
    file,
    store,
    campaign,
    w,
    command,
    npc,
    scene,
    a,
    b,
    finished,
    current,
    raw,
    rename,
    createNpc,
    add,
    edit,
    cleanup() {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test('renaming a world NPC updates both open masks once, retains combat facts and historical bytes', () => {
  const x = fixture();
  try {
    const before = [x.current(x.a.id), x.current(x.b.id)],
      history = x.raw(x.finished.id),
      c = x.rename();
    const ack = x.store.executeNpc(c);
    assert.deepEqual(x.store.executeNpc(c), ack);
    for (const old of before) {
      const now = x.current(old.id);
      assert.equal(now.revision, old.revision + 1);
      assert.deepEqual(now.participants[0], {
        ...old.participants[0],
        name: c.npc.name,
        worldActorRevision: ack.actorRevision,
      });
      assert.equal(now.turnId, old.turnId);
      assert.equal(now.round, old.round);
      assert.equal(x.store.combat(x.w.token, x.scene.id, old.id).canUndo, false);
    }
    assert.deepEqual(x.raw(x.finished.id), history);
    const fresh = new CampaignStore(x.file);
    try {
      const w = fresh.activate(x.campaign.id);
      for (const c of [x.a, x.b])
        assert.equal(fresh.combat(w.token, x.scene.id, c.id).combat.participants[0].name, ack.name);
      assert.equal(fresh.npc(w.token, x.npc.id).gmNotes, x.npc.gmNotes);
    } finally {
      fresh.close();
    }
  } finally {
    x.cleanup();
  }
});
test('explicit encounter aliases remain local when the source NPC is renamed', () => {
  const x = fixture();
  try {
    const alias = x.edit(x.current(x.a.id), {
      kind: 'edit',
      participantId: x.a.participants[0].id,
      changes: { name: 'Der Vermummte' },
    });
    x.store.executeNpc(x.rename());
    assert.equal(x.current(x.a.id).participants[0].name, 'Der Vermummte');
    assert.equal(x.current(x.b.id).participants[0].name, 'Borin Nachtwache');
    const changed = x.edit(x.current(x.b.id), {
      kind: 'damage',
      participantId: x.b.participants[0].id,
      amount: 3,
    });
    assert.equal(changed.participants[0].hp, 5);
    assert.equal(x.current(alias.id).participants[0].name, 'Der Vermummte');
    assert.equal(x.current(alias.id).participants[0].hp, 5);
  } finally {
    x.cleanup();
  }
});
test('equal NPC names do not merge identities or rename the other figure', () => {
  const x = fixture();
  try {
    const other = x.createNpc(),
      b = x.add(x.current(x.b.id), other.id),
      original = b.participants.find((p) => p.worldActorId === other.id);
    x.store.executeNpc(x.rename());
    const now = x.current(b.id);
    assert.deepEqual(
      now.participants.find((p) => p.worldActorId === other.id),
      original,
    );
    assert.equal(
      now.participants.find((p) => p.worldActorId === x.npc.id).name,
      'Borin Nachtwache',
    );
    assert.equal(x.store.npc(x.w.token, other.id).name, 'Borin');
  } finally {
    x.cleanup();
  }
});
test('the general world-note editor publishes the same rename without changing prose or health', () => {
  const x = fixture();
  try {
    const note = x.store.preparation(x.w.token, '').notes.find((r) => r.note.id === x.npc.id).note,
      c = {
        commandId: randomUUID(),
        token: x.w.token,
        campaignId: x.campaign.id,
        change: {
          kind: 'note',
          expectedRevision: note.revision,
          note: { ...note, title: 'Borin im Weltplaner' },
        },
      };
    x.store.changePreparation(c);
    const revision = x.current(x.a.id).revision;
    x.store.changePreparation(c);
    assert.equal(x.current(x.a.id).revision, revision);
    for (const old of [x.a, x.b]) {
      const p = x.current(old.id).participants[0];
      assert.equal(p.name, 'Borin im Weltplaner');
      assert.equal(p.hp, 6);
      assert.equal(p.tempHp, 2);
    }
    const n = x.store.npc(x.w.token, x.npc.id);
    assert.equal(n.readAloud, x.npc.readAloud);
    assert.equal(n.gmNotes, x.npc.gmNotes);
  } finally {
    x.cleanup();
  }
});
test('a late mask publication failure rolls back note, actor health, receipts and both masks', () => {
  const x = fixture();
  try {
    const c = x.rename(),
      before = {
        npc: x.store.npc(x.w.token, x.npc.id),
        a: x.raw(x.a.id),
        b: x.raw(x.b.id),
        history: x.store.db.prepare('SELECT * FROM world_history ORDER BY id').all(),
      };
    x.store.db.exec(
      `CREATE TEMP TRIGGER qa_mask_unavailable BEFORE UPDATE ON combat WHEN NEW.id='${x.b.id}' BEGIN SELECT RAISE(ABORT,'QA mask unavailable'); END`,
    );
    assert.throws(() => x.store.executeNpc(c), /QA mask unavailable/);
    assert.deepEqual(
      {
        npc: x.store.npc(x.w.token, x.npc.id),
        a: x.raw(x.a.id),
        b: x.raw(x.b.id),
        history: x.store.db.prepare('SELECT * FROM world_history ORDER BY id').all(),
      },
      before,
    );
    assert.equal(
      x.store.db.prepare('SELECT count(*) n FROM npc_receipt WHERE command_id=?').get(c.commandId)
        .n,
      0,
    );
    x.store.db.exec('DROP TRIGGER qa_mask_unavailable');
    x.store.executeNpc(c);
    assert.equal(x.current(x.a.id).participants[0].name, c.npc.name);
    assert.equal(x.current(x.b.id).participants[0].name, c.npc.name);
  } finally {
    x.cleanup();
  }
});
test('editing a prepared group publishes its NPC rename and health to the same open mask', () => {
  const x = fixture();
  try {
    const created = x.store.executeProgress(
        x.command({
          kind: 'group-create',
          title: 'Verbündete',
          encounterId: null,
          expectedEncounterRevision: null,
        }),
      ),
      id = created.groupId,
      g = x.store.groupView(x.w.token, id),
      draft = {
        writeId: randomUUID(),
        groupId: id,
        revision: g.revision,
        title: g.title,
        notes: g.notes,
        locationId: null,
        actors: [
          {
            id: null,
            creatureId: 'goblin',
            revision: 0,
            profileRevision: 0,
            name: 'Nera',
            hp: '7',
            maxHp: '7',
            tempHp: '0',
            conditions: '',
            concentrating: false,
            gmNotes: '  Gruppenhinweis\r\n- Original',
            readAloud: 'Vorlesetext',
          },
        ],
      };
    x.store.keepGroupDraft(x.w.token, draft, null);
    x.store.executeProgress(
      x.command({ kind: 'group-edit', groupId: id, expectedRevision: g.revision, draft }),
    );
    const group = x.store.groupView(x.w.token, id),
      actor = group.actors[0];
    x.add(x.current(x.b.id), actor.id);
    const next = {
      ...draft,
      writeId: randomUUID(),
      revision: group.revision,
      actors: [
        {
          ...draft.actors[0],
          id: actor.id,
          revision: actor.revision,
          profileRevision: actor.profileRevision,
          name: 'Nera Fährfrau',
          hp: '4',
        },
      ],
    };
    x.store.keepGroupDraft(x.w.token, next, null);
    x.store.executeProgress(
      x.command({ kind: 'group-edit', groupId: id, expectedRevision: group.revision, draft: next }),
    );
    const p = x.current(x.b.id).participants.find((p) => p.worldActorId === actor.id);
    assert.equal(p.name, 'Nera Fährfrau');
    assert.equal(p.hp, 4);
    assert.equal(x.store.npc(x.w.token, actor.id).gmNotes, draft.actors[0].gmNotes);
  } finally {
    x.cleanup();
  }
});
