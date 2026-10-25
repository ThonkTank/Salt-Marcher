import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: { store: 'src/app/storage/store.ts', chronicle: 'src/app/storage/chronicle.ts' },
  outdir: '.build/chronicle-window',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/chronicle-window/store.cjs'),
  { readChronicle, chronicleMarkdown } = require('../../.build/chronicle-window/chronicle.cjs');
const hash = (value) => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'chronicle-window-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    campaign = store.create('Chronikquelle'),
    insert = store.db.prepare('INSERT INTO progress_event VALUES(?,?,?,?,?,?)');
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    campaign,
    add: (kind, body = {}) => {
      const id = randomUUID(),
        payload = JSON.stringify({ recordedAt: '2026-10-13T13:00:00.000Z', ...body });
      insert.run(campaign.id, id, null, kind, payload, hash(payload));
      return id;
    },
    read: () => readChronicle(store.db, campaign.id),
  };
}
test('bookkeeping does not hide an older visible chronicle entry or consume its window', (t) => {
  const x = fixture(t),
    id = x.add('xp', { reason: 'Sichtbare Belohnung', before: { xp: 0 }, after: { xp: 7 } });
  x.store.db.transaction(() => {
    for (let i = 0; i < 2500; i++) x.add('internal-only');
  })();
  const view = x.read();
  assert.deepEqual(
    view.entries.map((e) => e.id),
    ['progress:' + id],
  );
  assert.equal(view.truncated, false);
});
test('complete grouped awards preserve all receipts without a false truncation signal', (t) => {
  const x = fixture(t),
    awardId = randomUUID();
  x.store.db.transaction(() => {
    for (let i = 0; i < 2002; i++) x.add('combat-award', { awardId, xp: 0 });
  })();
  const view = x.read();
  assert.equal(view.entries.length, 1);
  assert.equal(view.truncated, false);
});
test('exact visible window remains complete while one more visible source is marked truncated', (t) => {
  const x = fixture(t);
  x.store.db.transaction(() => {
    for (let i = 0; i < 2000; i++) x.add('health', { reason: 'Zeitpunkt ' + i });
  })();
  assert.equal(x.read().entries.length, 2000);
  assert.equal(x.read().truncated, false);
  x.add('health');
  const view = x.read();
  assert.equal(view.entries.length, 2000);
  assert.equal(view.truncated, true);
});
test('truncated Markdown export discloses that older matching entries may be missing', () => {
  const view = { campaignName: 'Sichere Prosa', entries: [], truncated: true };
  assert.match(chronicleMarkdown(view, 'narrative', 'Ungefunden'), /unvollständiger Ausschnitt/i);
  assert.doesNotMatch(
    chronicleMarkdown({ ...view, truncated: false }, 'all', ''),
    /unvollständiger Ausschnitt/i,
  );
});
test('damaged visible event cannot become a chronicle or change source bytes', (t) => {
  const x = fixture(t),
    id = x.add('xp');
  x.store.db.prepare('UPDATE progress_event SET checksum=? WHERE id=?').run('broken', id);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.read(), /beschädigt/);
  assert.throws(() => x.read(), /beschädigt/);
  assert.ok(x.store.db.serialize().equals(bytes));
});

test('combined world and progress sources share the visible limit', (t) => {
  const x = fixture(t),
    insert = x.store.db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)');
  x.store.db.transaction(() => {
    for (let i = 0; i < 1200; i++) {
      x.add('health');
      const payload = JSON.stringify({
        recordedAt: '2026-10-13T14:00:00.000Z',
        text: 'Reise ' + i,
        facts: {},
      });
      insert.run(x.campaign.id, randomUUID(), null, payload, hash(payload));
    }
  })();
  const view = x.read();
  assert.equal(view.entries.length, 2000);
  assert.equal(view.truncated, true);
  assert.equal(view.entries.filter((e) => e.category === 'travel').length, 1200);
});
test('world source overflow is disclosed independently of progress history', (t) => {
  const x = fixture(t),
    insert = x.store.db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)');
  x.store.db.transaction(() => {
    for (let i = 0; i < 2002; i++) {
      const payload = JSON.stringify({
        recordedAt: '2026-10-13T14:00:00.000Z',
        text: 'Welt ' + i,
        facts: {},
      });
      insert.run(x.campaign.id, randomUUID(), null, payload, hash(payload));
    }
  })();
  const view = x.read();
  assert.equal(view.entries.length, 2000);
  assert.equal(view.truncated, true);
});

test('death save outcomes remain visible in the bounded chronicle source query', (t) => {
  const x = fixture(t),
    id = x.add('death-save', {
      after: { health: { death: { successes: 3, failures: 1, stable: true, dead: false } } },
    }),
    view = x.read();
  assert.equal(view.entries.length, 1);
  assert.equal(view.entries[0].id, 'progress:' + id);
  assert.equal(view.entries[0].title, 'Todesrettungswurf');
  assert.equal(view.entries[0].summary, 'stabilisiert');
  assert.equal(view.truncated, false);
});
test('historical narrative status changes remain visible without a recorded title', (t) => {
  const x = fixture(t),
    id = x.add('narrative-state', {
      after: { status: 'closed', poolXp: 25, items: [], contributors: [], locationId: null },
    }),
    view = x.read();
  assert.equal(view.entries.length, 1);
  assert.equal(view.entries[0].id, 'progress:' + id);
  assert.equal(view.entries[0].category, 'narrative');
  assert.match(view.entries[0].title, /Quest oder Gerücht/);
  assert.match(view.entries[0].summary, /Geschlossen.*25 Gruppen-XP/);
});
test('an explicitly invalid narrative chronicle status fails without modifying the source', (t) => {
  const x = fixture(t);
  x.add('narrative-state', { title: 'Auftrag', after: { status: 'invented' } });
  const before = x.store.db.serialize();
  assert.throws(() => x.read(), /Chronikstatus.*beschädigt/);
  assert.equal(x.store.db.serialize().equals(before), true);
});

test('session handoff keeps authored bytes through receipt replay and Fresh without reviving a retired note', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'handoff-fresh-')),
    file = path.join(root, 'store.sqlite');
  let store = new CampaignStore(file);
  try {
    const campaign = store.create('Übergabe'),
      workspace = store.activate(campaign.id),
      request = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: workspace.token,
        action,
      }),
      scene = store.executeLive(request({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
    const marker = (kind, handoff = '') =>
      request({
        kind: 'session-marker',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        marker: kind,
        summary: 'Rückblick',
        handoff,
      });
    store.executeLive(marker('start'));
    const authored = '  Am Nordtor weiter.\r\n\r\nErst die Wache befragen.  ',
      end = marker('end', authored),
      ack = store.executeLive(end);
    assert.deepEqual(store.executeLive(end), ack);
    assert.equal(
      store.chronicle(workspace.token).entries.filter((e) => e.sessionMarker === 'end').length,
      1,
    );
    assert.equal(
      store.chronicle(workspace.token, 'all', 'Wache befragen').entries[0].handoff,
      authored,
    );
    store.close();
    store = new CampaignStore(file);
    const fresh = store.activate(campaign.id),
      entries = store.chronicle(fresh.token).entries;
    assert.equal(entries.find((e) => e.sessionMarker === 'end').handoff, authored);
    assert.ok(chronicleMarkdown(store.chronicle(fresh.token), 'all', '').includes(authored));
    const next = (kind) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: fresh.token,
      action: {
        kind: 'session-marker',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        marker: kind,
        summary: '',
        handoff: '',
      },
    });
    store.executeLive(next('start'));
    store.executeLive(next('end'));
    assert.equal(
      store.chronicle(fresh.token).entries.find((e) => e.sessionMarker === 'end').handoff,
      undefined,
    );
    assert.equal(
      store.chronicle(fresh.token).entries.filter((e) => e.sessionMarker === 'end').length,
      2,
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('a damaged session marker cannot be filtered away to permit another session start', (t) => {
  const x = fixture(t),
    w = x.store.activate(x.campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: w.token,
      action,
    }),
    scene = x.store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  x.store.executeLive(
    command({
      kind: 'session-marker',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      marker: 'start',
      summary: 'Original',
      handoff: '',
    }),
  );
  const row = x.store.db
      .prepare(
        "SELECT * FROM world_history WHERE campaign_id=? AND json_extract(payload,'$.facts.kind')='session-marker'",
      )
      .get(x.campaign.id),
    doc = JSON.parse(row.payload);
  doc.facts.kind = 'unrelated';
  x.store.db
    .prepare('UPDATE world_history SET payload=? WHERE campaign_id=? AND id=?')
    .run(JSON.stringify(doc), x.campaign.id, row.id);
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeLive(
        command({
          kind: 'session-marker',
          sceneId: scene.id,
          expectedRevision: scene.revision,
          marker: 'start',
          summary: 'Duplicate',
          handoff: '',
        }),
      ),
    /Chronikquelle.*beschädigt/,
  );
  assert.ok(x.store.db.serialize().equals(before));
});
