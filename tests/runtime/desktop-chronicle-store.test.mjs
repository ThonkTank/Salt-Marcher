import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/chronicle-store-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
test('SQLite groups award receipts before filtering and retains the newest bounded combat history', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'chronicle-store-')),
    { CampaignStore } = require('../../.build/chronicle-store-test.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite');
  try {
    const campaign = store.create('SQL-Chronik'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const iri = store.executeLive(
        command({ kind: 'create-character', profile: { name: 'Iri' } }),
      ).character,
      aran = store.executeLive(
        command({ kind: 'create-character', profile: { name: 'Aran' } }),
      ).character;
    const insert = store.db.prepare(
      'INSERT INTO progress_event(campaign_id,id,character_id,kind,payload,checksum) VALUES(?,?,?,?,?,?)',
    );
    const receipt = (id, character, awardId, time) => {
      const payload = JSON.stringify({
        recordedAt: new Date(time).toISOString(),
        awardId,
        xp: 10,
        combatId: 'receipt-fixture',
      });
      insert.run(
        campaign.id,
        id,
        character,
        'combat-award',
        payload,
        createHash('sha256').update(payload).digest('hex'),
      );
    };
    // Isolated valid receipt fixtures exercise the SQL reader; no battle acceptance is claimed.
    store.db.transaction(() => {
      for (let i = 0; i < 2003; i++)
        receipt('event-' + i, iri.id, 'award-' + String(i).padStart(4, '0'), 5000 - i);
      receipt('old-aran', aran.id, 'old-pair', 1);
      receipt('old-iri', iri.id, 'old-pair', 2);
    })();
    const original = store.db
      .prepare('SELECT id,payload,checksum FROM progress_event ORDER BY id')
      .all();
    const all = store.chronicle(w.token, 'combat');
    assert.equal(all.entries.length, 2000);
    assert.equal(all.entries[0].id, 'progress:event-0');
    assert.equal(all.entries.at(-1).id, 'progress:event-1999');
    assert.equal(all.truncated, true);
    for (const query of ['Aran', 'Iri, Aran']) {
      const view = store.chronicle(w.token, 'combat', query);
      assert.equal(view.entries.length, 1);
      assert.deepEqual(view.entries[0].people, ['Iri', 'Aran']);
      assert.equal(view.truncated, false);
    }
    assert.deepEqual(
      store.db.prepare('SELECT id,payload,checksum FROM progress_event ORDER BY id').all(),
      original,
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test('SQLite searches older time and party events before truncating each source', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'chronicle-time-')),
    { CampaignStore } = require('../../.build/chronicle-store-test.cjs'),
    store = new CampaignStore(root + '/workbench.sqlite');
  try {
    const campaign = store.create('Zeitnotizen'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const hero = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character;
    const scene = store.executeLive(
        command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
      ).scene,
      insertReceipt = store.db.prepare(
        'INSERT INTO receipt(command_id,fingerprint,campaign_id,room_id,revision) VALUES(?,?,?,?,?)',
      ),
      insertStep = store.db.prepare(
        'INSERT INTO scene_time_step(campaign_id,id,scene_id,command_id,ordinal,payload,checksum) VALUES(?,?,?,?,?,?,?)',
      );
    // Chronicle paging needs valid persisted history, not 2,003 repetitions of the separately tested clock command.
    store.db.transaction(() => {
      for (let i = 0; i < 2003; i++) {
        const commandId = 'time-fixture-' + i,
          payload = JSON.stringify({
            epochId: scene.clock.epochId,
            from: String(i * 60000),
            to: String((i + 1) * 60000),
            beforeRevision: i,
            afterRevision: i + 1,
            amount: 1,
            unit: 'minutes',
            calendarVersion: 'relative-v1',
            reason: i === 0 ? 'Bronzeschlüssel nach der Nachtwache' : 'Routinenotiz ' + i,
            recordedAt: new Date(i).toISOString(),
          });
        insertReceipt.run(
          commandId,
          createHash('sha256').update(commandId).digest('hex'),
          campaign.id,
          scene.id,
          i + 1,
        );
        insertStep.run(
          campaign.id,
          'time-' + i,
          scene.id,
          commandId,
          i,
          payload,
          createHash('sha256').update(payload).digest('hex'),
        );
      }
    })();
    const original = store.db
      .prepare('SELECT id,payload,checksum FROM scene_time_step ORDER BY id')
      .all();
    const match = store.chronicle(w.token, 'world', 'Bronzeschlüssel');
    assert.equal(match.entries.length, 1);
    assert.match(match.entries[0].summary, /Bronzeschlüssel/);
    assert.equal(match.truncated, false);
    assert.equal(store.chronicle(w.token, 'party', 'Bronzeschlüssel').entries.length, 0);
    const all = store.chronicle(w.token, 'world');
    assert.equal(all.entries.length, 2000);
    assert.equal(all.truncated, true);
    const insert = store.db.prepare(
      'INSERT INTO world_history(campaign_id,id,scene_id,payload,checksum) VALUES(?,?,?,?,?)',
    );
    store.db.transaction(() => {
      for (let i = 0; i < 2003; i++) {
        const payload = JSON.stringify({
          recordedAt: new Date(i).toISOString(),
          text: 'Gruppe gewechselt',
          facts: {
            kind: 'party-move',
            characterIds: [hero.id],
            fromSceneId: scene.id,
            toSceneId: scene.id,
            reason: i === 0 ? 'alt' : '',
          },
        });
        insert.run(
          campaign.id,
          'party-' + i,
          scene.id,
          payload,
          createHash('sha256').update(payload).digest('hex'),
        );
      }
    })();
    assert.equal(store.chronicle(w.token, 'party', 'Iri').entries.length, 2000);
    assert.equal(store.chronicle(w.token, 'party', 'Iri').truncated, true);
    assert.equal(store.chronicle(w.token, 'travel', 'Iri').entries.length, 0);
    assert.deepEqual(
      store.db.prepare('SELECT id,payload,checksum FROM scene_time_step ORDER BY id').all(),
      original,
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('live moment follow-ups stay atomic and replay once across Fresh and independent copy', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'moment-copy-')),
    { CampaignStore } = require('../../.build/chronicle-store-test.cjs');
  let store = new CampaignStore(root + '/store.sqlite');
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Spuren'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action });
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
    id = randomUUID(),
    summary = '  Wortlaut ' + id + '\r\n';
  const cmd = command({
      kind: 'live-moment',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      category: 'narrative',
      title: 'Spur',
      summary,
      followUp: { kind: 'quest', id },
    }),
    ack = store.executeLive(cmd),
    beforeReplay = store.db.serialize();
  assert.deepEqual(store.executeLive(cmd), ack);
  assert.ok(store.db.serialize().equals(beforeReplay));
  assert.equal(store.preparation(w.token).notes.filter((n) => n.note.id === id).length, 1);
  store.close();
  store = new CampaignStore(root + '/store.sqlite');
  const fresh = store.activate(cam.id),
    source = store.chronicle(fresh.token).entries.find((e) => e.followUp);
  assert.equal(source.followUp.id, id);
  assert.equal(
    store.preparation(fresh.token).notes.find((n) => n.note.id === id).note.gmNotes,
    summary,
  );
  const file = root + '/campaign.sqlite';
  await store.campaignSnapshot(fresh.token, file);
  const copy = store.acceptCampaignSnapshot(file, 'Kopie', {}),
    cw = store.activate(copy.id),
    event = store.chronicle(cw.token).entries.find((e) => e.followUp),
    note = store.preparation(cw.token).notes.find((n) => n.note.id === event.followUp.id)?.note;
  assert.ok(note, 'Copied chronicle link must resolve to its copied note');
  assert.notEqual(note.id, id);
  assert.equal(note.kind, 'quest');
  assert.equal(note.gmNotes, summary);
  assert.equal(event.summary, summary);
});
test('failed follow-up creation cannot leave a confirmed moment or receipt behind', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'moment-atomic-')),
    { CampaignStore } = require('../../.build/chronicle-store-test.cjs'),
    store = new CampaignStore(root + '/store.sqlite');
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Atomar'),
    w = store.activate(cam.id),
    scene = store.executeLive({
      commandId: randomUUID(),
      token: w.token,
      campaignId: cam.id,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene,
    id = randomUUID();
  store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    campaignId: cam.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'quest',
        title: 'Original',
        readAloud: '',
        gmNotes: 'Erhalten',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  const before = store.db.serialize(),
    cmd = {
      commandId: randomUUID(),
      token: w.token,
      campaignId: cam.id,
      action: {
        kind: 'live-moment',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        category: 'world',
        title: 'Neue Spur',
        summary: 'Neu',
        followUp: { kind: 'rumor', id },
      },
    };
  assert.throws(() => store.executeLive(cmd));
  assert.ok(store.db.serialize().equals(before));
  assert.equal(store.chronicle(w.token).entries.length, 0);
  assert.equal(
    store.db.prepare('SELECT 1 FROM live_receipt WHERE command_id=?').get(cmd.commandId),
    undefined,
  );
});

test('session markers enforce valid boundaries and replay without another history entry', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'session-boundary-')),
    { CampaignStore } = require('../../.build/chronicle-store-test.cjs'),
    store = new CampaignStore(root + '/store.sqlite');
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Spielabend'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action }),
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
    marker = (kind) =>
      command({
        kind: 'session-marker',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        marker: kind,
        summary: kind === 'end' ? '  Wortlaut\r\n' : '',
      });
  const before = store.db.serialize();
  assert.throws(() => store.executeLive(marker('end')));
  assert.ok(store.db.serialize().equals(before));
  const start = marker('start'),
    ack = store.executeLive(start),
    saved = store.db.serialize();
  assert.deepEqual(store.executeLive(start), ack);
  assert.ok(store.db.serialize().equals(saved));
  assert.throws(() => store.executeLive(marker('start')));
  assert.ok(store.db.serialize().equals(saved));
  const end = marker('end'),
    finished = store.executeLive(end),
    bytes = store.db.serialize();
  assert.deepEqual(store.executeLive(end), finished);
  assert.ok(store.db.serialize().equals(bytes));
  assert.throws(() => store.executeLive(marker('end')));
  assert.ok(store.db.serialize().equals(bytes));
  const events = store.chronicle(w.token).entries;
  assert.deepEqual(
    events.map((e) => e.sessionMarker),
    ['end', 'start'],
  );
  assert.equal(events[0].summary, '  Wortlaut\r\n');
});

test('a session start beyond the 2000-event window remains authoritative and can be ended', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'session-window-')),
    { CampaignStore } = require('../../.build/chronicle-store-test.cjs'),
    store = new CampaignStore(root + '/store.sqlite');
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Langer Abend'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action }),
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  store.executeLive(
    command({
      kind: 'session-marker',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      marker: 'start',
      summary: '',
    }),
  );
  store.db.transaction(() => {
    for (let i = 0; i < 2001; i++)
      store.executeLive(
        command({
          kind: 'live-moment',
          sceneId: scene.id,
          expectedRevision: scene.revision,
          category: 'world',
          title: 'Moment ' + i,
          summary: '',
        }),
      );
  })();
  const view = store.chronicle(w.token);
  assert.equal(view.truncated, true);
  assert.equal(view.entries.length, 2000);
  assert.equal(
    view.entries.some((e) => e.sessionMarker),
    false,
  );
  assert.equal(view.latestSessionMarker.sessionMarker, 'start');
  const before = store.db.serialize();
  assert.throws(() =>
    store.executeLive(
      command({
        kind: 'session-marker',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        marker: 'start',
        summary: '',
      }),
    ),
  );
  assert.ok(store.db.serialize().equals(before));
  store.executeLive(
    command({
      kind: 'session-marker',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      marker: 'end',
      summary: 'Ende',
    }),
  );
  assert.equal(store.chronicle(w.token).latestSessionMarker.sessionMarker, 'end');
});
