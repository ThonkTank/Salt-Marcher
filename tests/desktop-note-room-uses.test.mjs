import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-room-test-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/note-room-test-store.cjs');
function fixture(t, count = 3) {
  const dir = mkdtempSync(path.join(tmpdir(), 'note-uses-')),
    store = new CampaignStore(path.join(dir, 'campaign.sqlite'));
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const rooms = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: String(i + 1),
    name: 'Raum ' + String(i).padStart(3, '0'),
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 6 },
          { x: 0, y: 6 },
        ],
        holes: [],
      },
    ],
    sections: [{ id: randomUUID(), kind: 'markdown', markdown: ' Original\r\n' }],
  }));
  const campaign = store.create('Raumverweise', rooms),
    w = store.activate(campaign.id),
    note = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'npc',
      title: 'Nera',
      readAloud: '',
      gmNotes: ' Unverändert\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  store.changePreparation({
    commandId: randomUUID(),
    token: w.token,
    change: { kind: 'note', expectedRevision: null, note },
  });
  const send = (action) =>
    store.executeDrawing({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  send({
    kind: 'key-batch',
    rooms: rooms.map((r) => ({ id: r.id, expectedRevision: 0, keyRevision: null })),
    patch: {
      references: [{ kind: 'npc', id: note.id, label: 'Alter Alias' }],
      gmNotes: { mode: 'replace', text: 'Neras Wachposten.' },
    },
  });
  const read = (offset = 0) => store.noteRoomUses(w.token, note.id, offset);
  return { store, w, rooms, note, send, read, campaign };
}
function damageKey(x, edit, rehash = true) {
  const row = x.store.db
      .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
      .get(x.campaign.id, x.rooms[0].id),
    key = JSON.parse(row.payload);
  edit(key);
  const payload = JSON.stringify(key);
  x.store.db
    .prepare('UPDATE dungeon_key_content SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(
      payload,
      rehash ? createHash('sha256').update(payload).digest('hex') : row.checksum,
      x.campaign.id,
      row.id,
    );
}

test('room uses are unique, bounded, ordered and read-only across every page', (t) => {
  const x = fixture(t, 45),
    before = x.store.db.serialize(),
    first = x.read(),
    second = x.read(first.next);
  assert.equal(first.entries.length, 40);
  assert.equal(first.next, 40);
  assert.equal(second.entries.length, 5);
  assert.equal(second.next, null);
  assert.equal(new Set([...first.entries, ...second.entries].map((e) => e.id)).size, 45);
  assert.equal(first.entries[0].title, 'Raum 000');
  assert.equal(second.entries[4].title, 'Raum 044');
  assert.equal(first.entries[0].excerpt, 'Neras Wachposten.');
  assert.equal(first.notice, undefined);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('only the matching explicit reference kind counts and removing it immediately updates the projection', (t) => {
  const x = fixture(t);
  damageKey(x, (k) => (k.references = [{ kind: 'faction', id: x.note.id, label: 'Nera' }]));
  assert.equal(x.read().entries.length, 2);
  damageKey(x, (k) => (k.references = []));
  assert.equal(x.read().entries.length, 2);
  damageKey(
    x,
    (k) =>
      (k.references = [
        { kind: 'npc', id: x.note.id, label: 'Nera' },
        { kind: 'npc', id: x.note.id, label: 'Anderer Alias' },
      ]),
  );
  assert.equal(x.read().entries.length, 3);
});
for (const rehash of [true, false])
  test(`damaged key metadata reports incompleteness, including after a warm cache (rehash ${rehash})`, (t) => {
    const x = fixture(t);
    assert.equal(x.read().entries.length, 3);
    damageKey(
      x,
      (k) => {
        if (rehash) k.id = 'forged';
        else k.references = [];
      },
      rehash,
    );
    const before = x.store.db.serialize(),
      page = x.read();
    assert.equal(page.entries.length, 2);
    assert.match(page.notice, /unvollständig/);
    assert.deepEqual(x.store.db.serialize(), before);
  });
test('missing or damaged room sources remain visible as unavailable links', (t) => {
  const x = fixture(t);
  x.store.db
    .prepare('UPDATE room SET payload=? WHERE campaign_id=? AND id=?')
    .run('{}', x.campaign.id, x.rooms[0].id);
  const page = x.read();
  assert.equal(page.entries.length, 3);
  assert.equal(page.entries.filter((e) => e.unavailable).length, 1);
  assert.match(page.notice, /unvollständig/);
});
test('renamed rooms and hidden rooms are resolved from current campaign data', (t) => {
  const x = fixture(t);
  x.store.db
    .prepare('UPDATE room SET name=? WHERE campaign_id=? AND id=?')
    .run('Neue Wachstube', x.campaign.id, x.rooms[0].id);
  x.store.db
    .prepare('INSERT INTO drawing_hidden VALUES(?,?,?,?,?,?)')
    .run(x.campaign.id, x.rooms[0].id, 'local', 'room', 1, 1);
  assert.equal(x.read().entries.find((e) => e.id === x.rooms[0].id).title, 'Neue Wachstube');
  assert.equal(x.read().entries.length, 3);
});
test('another campaign, stale token, forged target identity and invalid pagination are rejected', (t) => {
  const x = fixture(t);
  for (const offset of [-1, 0.5, NaN, Infinity, 1_000_001]) assert.throws(() => x.read(offset));
  const row = x.store.db
      .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.campaign.id, x.note.id),
    payload = JSON.stringify({ ...x.note, id: randomUUID() });
  x.store.db
    .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.campaign.id, x.note.id);
  assert.throws(() => x.read(), /Notizzuordnung/);
  const other = x.store.create('Andere Kampagne'),
    active = x.store.activate(other.id);
  assert.throws(() => x.read());
  assert.throws(() => x.store.noteRoomUses(active.token, x.note.id), /nicht verfügbar/);
});

test('empty and exhausted pages retain campaign-wide damage notices without producing placeholder rooms', (t) => {
  const x = fixture(t, 2);
  assert.deepEqual(x.read(40), { entries: [], next: null });
  damageKey(x, (k) => {
    k.id = 'forged';
  });
  assert.deepEqual(x.read(40), {
    entries: [],
    next: null,
    notice: 'Raumverweise unvollständig: 1 Quellen konnten nicht gelesen oder zugeordnet werden.',
  });
  const key = x.store.db
      .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
      .get(x.campaign.id, x.rooms[1].id),
    value = JSON.parse(key.payload);
  value.references = [];
  const payload = JSON.stringify(value);
  x.store.db
    .prepare('UPDATE dungeon_key_content SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.campaign.id, key.id);
  assert.deepEqual(x.read(), {
    entries: [],
    next: null,
    notice: 'Raumverweise unvollständig: 1 Quellen konnten nicht gelesen oder zugeordnet werden.',
  });
  x.store.db.prepare('DELETE FROM dungeon_key_content WHERE campaign_id=?').run(x.campaign.id);
  assert.deepEqual(x.read(), { entries: [], next: null });
});

test('room places keep same-named floor identities separate and retain links when their floor is missing', (t) => {
  const x = fixture(t, 2),
    before = x.read(),
    otherScope = randomUUID();
  x.store.db
    .prepare('INSERT INTO scope VALUES(?,?,?)')
    .run(x.campaign.id, otherScope, 'Andere Karte');
  x.store.db
    .prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)')
    .run(x.campaign.id, otherScope, 'ground', 'Fremdes Geschoss', 0);
  assert.deepEqual(x.read(), before);
  x.store.db
    .prepare('UPDATE drawing_floor SET name=? WHERE campaign_id=? AND scope_id=? AND id=?')
    .run('Untergeschoss', x.campaign.id, 'local', 'ground');
  assert(x.read().entries.every((e) => e.place.endsWith(' · Untergeschoss')));
  x.store.db
    .prepare('DELETE FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?')
    .run(x.campaign.id, 'local', 'ground');
  const bytes = x.store.db.serialize(),
    missing = x.read();
  assert.equal(missing.entries.length, 2);
  assert(missing.entries.every((e) => e.unavailable));
  assert.match(missing.notice, /unvollständig: 2 Quellen/);
  assert.deepEqual(x.store.db.serialize(), bytes);
});

test('joined room sources reject rehashed identity overrides and keep missing uses visible without changing bytes', (t) => {
  const x = fixture(t),
    row = x.store.db
      .prepare('SELECT * FROM room WHERE campaign_id=? AND id=?')
      .get(x.campaign.id, x.rooms[0].id);
  for (const [field, value] of Object.entries({
    id: randomUUID(),
    scopeId: 'other',
    floorId: 'other',
    revision: 999,
    name: 'Forged title',
    number: '999',
  })) {
    const payload = JSON.stringify({ ...JSON.parse(row.payload), [field]: value });
    x.store.db
      .prepare('UPDATE room SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.campaign.id, row.id);
    const before = x.store.db.serialize(),
      page = x.read();
    assert.equal(page.entries.length, 3);
    assert.deepEqual(
      page.entries.filter((e) => e.unavailable).map((e) => e.id),
      [row.id],
      field,
    );
    assert.match(page.notice, /unvollständig: 1 Quellen/);
    assert.deepEqual(x.store.db.serialize(), before);
  }
  x.store.db.prepare('DELETE FROM room WHERE campaign_id=? AND id=?').run(x.campaign.id, row.id);
  const before = x.store.db.serialize(),
    page = x.read();
  assert.equal(page.entries.length, 3);
  assert.deepEqual(
    page.entries.filter((e) => e.unavailable).map((e) => e.id),
    [row.id],
  );
  assert.match(page.notice, /unvollständig: 1 Quellen/);
  assert.deepEqual(x.store.db.serialize(), before);
});
