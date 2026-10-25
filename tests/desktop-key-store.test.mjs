import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
for (const [name, entry] of [
  ['store', 'storage/store'],
  ['model', 'key-model'],
  ['contracts', 'key-contracts'],
  ['document', 'key-document'],
])
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/key-storage-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../.build/key-storage-store.cjs'),
  { emptyKey } = require('../.build/key-storage-contracts.cjs'),
  { renderDungeonKey } = require('../.build/key-storage-model.cjs'),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const { dungeonKeyMarkdown, dungeonKeyDocument } = require('../.build/key-storage-document.cjs');
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'key-store-')),
    store = new CampaignStore(path.join(dir, 'source.sqlite')),
    room = {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Authored room',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 3.048, y: 0 },
            { x: 3.048, y: 3.048 },
            { x: 0, y: 3.048 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Legacy GM prose\r\n' }],
    },
    campaign = store.create('Key integrity', [room]),
    w = store.activate(campaign.id);
  const send = (action) =>
      store.executeDrawing({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      }),
    key = emptyKey(room),
    block = (visibility, text) => ({
      id: randomUUID(),
      kind: 'text',
      visibility,
      text,
      templateId: null,
      suppressed: [],
      searchMethod: '',
      dc: null,
      discoveryNotes: '  Private discovery note\r\n',
      revealedText: '',
    });
  key.blocks.push(
    block('public', '  Public authored prose\r\n'),
    block('gm', 'Private hidden answer'),
    block('secret', 'Unknown hidden secret'),
  );
  send({ kind: 'key-content', content: key, expectedRevision: null });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    store,
    room,
    campaign,
    w,
    send,
    key: store.drawing(w.token).keyContent[0],
    geometry: store.dungeon(w.token),
  };
}
function replace(x, edit) {
  const row = x.store.db.prepare('SELECT * FROM dungeon_key_content WHERE id=?').get(x.room.id),
    value = JSON.parse(row.payload);
  edit(value);
  const payload = JSON.stringify(value);
  x.store.db
    .prepare('UPDATE dungeon_key_content SET payload=?,checksum=? WHERE id=?')
    .run(payload, sha(payload), x.room.id);
  return value;
}

test('public Dungeon exports retain stable room numbers and public labels without internal Level names', (t) => {
  const x = fixture(t),
    name = 'GM-Ebene & <Geheimarchiv>',
    level = {
      ...emptyKey(x.room),
      id: randomUUID(),
      kind: 'level',
      name,
      zSteps: [0, 1],
      blocks: [],
    };
  x.send({ kind: 'key-content', content: level, expectedRevision: null });
  x.send({
    kind: 'key-content',
    content: { ...x.key, levelId: level.id },
    expectedRevision: x.key.revision,
  });
  x.send({
    kind: 'style',
    style: {
      id: x.room.id,
      revision: 0,
      scopeId: x.room.scopeId,
      ceilingMeters: 3.048,
      fill: '#d8cbb5',
      wall: '#574b3f',
      publicLabel: 'Eingang',
      secret: false,
    },
    expectedRevision: null,
  });
  for (const secret of [false, true]) {
    const current = x.store.drawing(x.w.token).keyContent.find((k) => k.id === level.id);
    x.send({
      kind: 'key-content',
      content: { ...current, secret },
      expectedRevision: current.revision,
    });
    const g = x.store.dungeon(x.w.token),
      before = x.store.db.serialize();
    for (const output of [
      dungeonKeyMarkdown(g, x.room.scopeId, true),
      dungeonKeyDocument(g, x.room.scopeId, true),
    ]) {
      assert.ok(output.includes('1. Eingang'));
      assert.ok(output.includes('Public authored prose'));
      for (const privateText of [
        'GM-Ebene',
        'Geheimarchiv',
        'Authored room',
        'Legacy GM prose',
        'Private hidden answer',
        'Unknown hidden secret',
        'Private discovery note',
      ])
        assert.ok(!output.includes(privateText), privateText + ' must remain private');
    }
    const gm = dungeonKeyMarkdown(g, x.room.scopeId, false),
      html = dungeonKeyDocument(g, x.room.scopeId, false);
    assert.ok(gm.includes(name + ' · 1. Authored room'));
    assert.ok(html.includes('GM-Ebene &amp; &lt;Geheimarchiv&gt; · 1. Authored room'));
    assert.ok(gm.includes('Private hidden answer'));
    assert.ok(html.includes('Private hidden answer'));
    assert.ok(x.store.db.serialize().equals(before));
  }
});
const damages = [
  ['identity', (c) => (c.id = 'wrong')],
  ['scope', (c) => (c.scopeId = 'wrong')],
  ['kind', (c) => (c.kind = 'template')],
  ['revision', (c) => c.revision++],
  ['secret flag', (c) => (c.secret = 'false')],
  ['block visibility', (c) => (c.blocks.find((b) => b.visibility === 'gm').visibility = 'private')],
  ['suppression list', (c) => (c.blocks[1].suppressed = 'size')],
  ['tag list', (c) => (c.tags = 'invalid')],
  ['tag value', (c) => (c.tags = [false])],
  [
    'reference identity',
    (c) => (c.references = [{ kind: 'npc', id: 9, label: 'Preserved label' }]),
  ],
  ['reference label', (c) => (c.references = [{ kind: 'npc', id: 'ref', label: false }])],
  ['status', (c) => (c.status = false)],
  ['attribute object', (c) => (c.attributes = [])],
  ['block duplicate', (c) => c.blocks.push(c.blocks[0])],
  ['level identity', (c) => (c.levelId = 9)],
  ['DC', (c) => (c.blocks[0].dc = '12')],
];
for (const [name, damage] of damages)
  test(`checksummed key ${name} damage cannot be read or replace a qualified backup`, async (t) => {
    const x = fixture(t),
      file = path.join(x.dir, 'safe.sqlite');
    await x.store.backup(file);
    const bytes = readFileSync(file);
    replace(x, damage);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.drawing(x.w.token));
    await assert.rejects(x.store.backup(file));
    assert.ok(readFileSync(file).equals(bytes));
    assert.deepEqual(x.store.db.serialize(), before);
  });
test('public key rendering refuses unknown visibility before exposing private prose', (t) => {
  const x = fixture(t),
    bad = structuredClone(x.key);
  bad.blocks.find((b) => b.visibility === 'gm').visibility = 'private';
  assert.throws(() =>
    renderDungeonKey(x.room, [bad], x.geometry, {
      audience: 'public',
      heading: null,
      discovered: new Set(),
    }),
  );
});
test('public template expansion refuses malformed child visibility before exposing private prose', (t) => {
  const x = fixture(t),
    key = {
      ...x.key,
      blocks: [
        { ...x.key.blocks[0], kind: 'template', visibility: 'public', templateId: 'template' },
      ],
    },
    template = {
      ...x.key,
      id: 'template',
      kind: 'template',
      blocks: [{ ...x.key.blocks.find((b) => b.visibility === 'gm'), visibility: 'private' }],
    };
  assert.throws(() =>
    renderDungeonKey(x.room, [key, template], x.geometry, {
      audience: 'public',
      heading: null,
      discovered: new Set(),
    }),
  );
});
test('a real batch beyond 1000 rooms remains atomic, preserves original prose and independent blocks, and supports one Undo/Redo', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'key-large-')),
    store = new CampaignStore(path.join(dir, 'campaign.sqlite'));
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const rooms = Array.from({ length: 1001 }, (_, i) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: String(i + 1),
      name: 'Kammer ' + (i + 1),
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 6.096, y: 0 },
            { x: 6.096, y: 4.572 },
            { x: 0, y: 4.572 },
          ],
          holes: [],
        },
      ],
      sections: [
        {
          id: randomUUID(),
          kind: 'markdown',
          markdown: '  Original ' + (i + 1) + '\r\nUnverändert.\r\n',
        },
      ],
    })),
    campaign = store.create('Großer Dungeon', rooms),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    }),
    targets = () => {
      const byId = new Map(store.drawing(w.token).keyContent.map((k) => [k.id, k]));
      return store.workspace().rooms.map((r) => ({
        id: r.id,
        expectedRevision: r.revision,
        keyRevision: byId.get(r.id)?.revision ?? null,
      }));
    };
  store.executeDrawing(
    command({
      kind: 'key-batch',
      rooms: rooms.map((r) => ({ id: r.id, expectedRevision: 0, keyRevision: null })),
      patch: {
        readAloud: { mode: 'replace', text: 'Alle Raumtexte.' },
        gmNotes: { mode: 'replace', text: 'Gemeinsamer Alarm.' },
      },
    }),
  );
  let keys = store.drawing(w.token).keyContent;
  assert.equal(keys.length, rooms.length);
  for (const key of keys) {
    assert.ok(key.blocks.some((b) => b.text === 'Alle Raumtexte.'));
    assert.ok(key.blocks.some((b) => b.text === 'Gemeinsamer Alarm.'));
  }
  assert.equal(
    new Set(keys.flatMap((k) => k.blocks.map((b) => b.id))).size,
    keys.reduce((n, k) => n + k.blocks.length, 0),
  );
  assert.deepEqual(
    Object.fromEntries(store.workspace().rooms.map((r) => [r.id, r.sections])),
    Object.fromEntries(rooms.map((r) => [r.id, r.sections])),
  );
  const before = store.db.serialize(),
    stale = targets();
  stale.at(-1).expectedRevision--;
  assert.throws(
    () =>
      store.executeDrawing(
        command({
          kind: 'key-batch',
          rooms: stale,
          patch: { gmNotes: { mode: 'replace', text: 'Darf nirgends ankommen.' } },
        }),
      ),
    /geändert/,
  );
  assert.deepEqual(store.db.serialize(), before);
  store.history(w.token, 'undo');
  assert.equal(store.drawing(w.token).keyContent.length, 0);
  assert.deepEqual(
    Object.fromEntries(store.workspace().rooms.map((r) => [r.id, r.sections])),
    Object.fromEntries(rooms.map((r) => [r.id, r.sections])),
  );
  store.history(w.token, 'redo');
  assert.equal(
    store
      .drawing(w.token)
      .keyContent.filter((k) => k.blocks.some((b) => b.text === 'Gemeinsamer Alarm.')).length,
    rooms.length,
  );
  const current = targets().filter((t) => rooms.slice(0, 2).some((r) => r.id === t.id)),
    sameNumber = store.db.serialize();
  assert.throws(
    () =>
      store.executeDrawing(
        command({ kind: 'key-batch', rooms: current, patch: { renumberStart: 2 } }),
      ),
    /Anzeigezahl/,
  );
  assert.deepEqual(store.db.serialize(), sameNumber);
  const firstTwo = targets().filter((t) => rooms.slice(0, 2).some((r) => r.id === t.id));
  store.executeDrawing(
    command({ kind: 'key-batch', rooms: firstTwo, patch: { renumberStart: 2000 } }),
  );
  assert.deepEqual(
    rooms
      .slice(0, 2)
      .map((original) => store.workspace().rooms.find((r) => r.id === original.id).number),
    ['2000', '2001'],
  );
  assert.equal(store.workspace().rooms.find((r) => r.id === rooms[2].id).number, '3');
});
test('malformed historical visibility refuses backup and Undo without changing current valid key bytes', async (t) => {
  const x = fixture(t);
  x.send({
    kind: 'key-content',
    content: { ...x.key, status: 'ready' },
    expectedRevision: x.key.revision,
  });
  const safe = path.join(x.dir, 'safe.sqlite');
  await x.store.backup(safe);
  const bytes = readFileSync(safe),
    row = x.store.db.prepare('SELECT * FROM drawing_history ORDER BY ordinal DESC LIMIT 1').get(),
    history = JSON.parse(row.payload),
    state = history.changes.find((d) => d.key.table === 'dungeon_key_content').before,
    c = JSON.parse(state.payload);
  c.blocks.find((b) => b.visibility === 'gm').visibility = 'private';
  state.payload = JSON.stringify(c);
  state.checksum = sha(state.payload);
  const payload = JSON.stringify(history);
  x.store.db
    .prepare('UPDATE drawing_history SET payload=?,checksum=? WHERE ordinal=?')
    .run(payload, sha(payload), row.ordinal);
  const before = x.store.db.serialize();
  assert.equal(x.store.drawing(x.w.token).keyContent[0].status, 'ready');
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(bytes));
  assert.throws(() => x.store.history(x.w.token, 'undo'));
  assert.deepEqual(x.store.db.serialize(), before);
});
test('invalid key reference metadata cannot be saved or silently normalize the source', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  assert.throws(() =>
    x.send({
      kind: 'key-content',
      content: { ...x.key, references: [{ kind: 'npc', id: 9, label: 'Authored label' }] },
      expectedRevision: x.key.revision,
    }),
  );
  assert.deepEqual(x.store.db.serialize(), before);
});
test('a valid missing template remains preserved and its diagnostic stays outside public text', async (t) => {
  const x = fixture(t);
  const value = replace(x, (c) => {
    c.blocks = [
      { ...c.blocks[0], kind: 'template', visibility: 'public', templateId: 'missing template' },
    ];
  });
  const file = path.join(x.dir, 'missing-template.sqlite');
  await x.store.backup(file);
  const reopened = new CampaignStore(file);
  t.after(() => reopened.close());
  const w = reopened.activate(x.campaign.id),
    key = reopened.drawing(w.token).keyContent[0];
  assert.deepEqual(key, value);
  assert.ok(
    renderDungeonKey(x.room, [key], x.geometry, {
      audience: 'gm',
      heading: null,
      discovered: new Set(),
    }).text.includes('Vorlage fehlt'),
  );
  assert.equal(
    renderDungeonKey(x.room, [key], x.geometry, {
      audience: 'public',
      heading: null,
      discovered: new Set(),
    }).text,
    '',
  );
});
test('public key output contains only permitted prose and explicit revealed text', (t) => {
  const x = fixture(t),
    key = structuredClone(x.key),
    secret = key.blocks.find((b) => b.visibility === 'secret');
  secret.revealedText = 'Confirmed revelation';
  const hidden = renderDungeonKey(x.room, [key], x.geometry, {
    audience: 'public',
    heading: null,
    discovered: new Set(),
  });
  assert.ok(hidden.text.includes('  Public authored prose\r\n'));
  assert.ok(!hidden.text.includes('Private hidden answer'));
  assert.ok(!hidden.text.includes('Unknown hidden secret'));
  const visible = renderDungeonKey(x.room, [key], x.geometry, {
    audience: 'public',
    heading: null,
    discovered: new Set([secret.id]),
  });
  assert.ok(visible.text.includes('Confirmed revelation'));
  assert.ok(!visible.text.includes('Unknown hidden secret'));
  assert.ok(visible.blocks.every((b) => b.discoveryNotes === ''));
});
test('two room keys cannot reuse a secret block identity and share discovery accidentally', (t) => {
  const x = fixture(t),
    room = x
      .send({
        kind: 'create-room',
        scopeId: 'local',
        floorId: 'ground',
        name: 'Other room',
        polygons: [
          {
            outer: [
              { x: 6.096, y: 0 },
              { x: 9.144, y: 0 },
              { x: 9.144, y: 3.048 },
              { x: 6.096, y: 3.048 },
            ],
            holes: [],
          },
        ],
      })
      .workspace.rooms.find((r) => r.name === 'Other room'),
    before = x.store.db.serialize();
  assert.throws(() =>
    x.send({
      kind: 'key-content',
      content: { ...structuredClone(x.key), id: room.id, name: room.name },
      expectedRevision: null,
    }),
  );
  assert.deepEqual(x.store.db.serialize(), before);
});

test('room descriptions retain height limits across 100000 columns and 200000 spans', (t) => {
  const x = fixture(t),
    geometry = structuredClone(x.geometry);
  geometry.drawing.volumes = [
    {
      id: 'large-volume',
      revision: 0,
      scopeId: x.room.scopeId,
      roomId: x.room.id,
      floorId: x.room.floorId,
      faces: {},
      columns: Array.from({ length: 100000 }, (_, i) => ({
        x: i % 1000,
        y: Math.floor(i / 1000),
        spans: [
          { z: 0, height: i === 99999 ? 1 : 2, floor: true, ceiling: true, medium: 'air' },
          { z: 10, height: i === 0 ? 7 : 5, floor: true, ceiling: true, medium: 'air' },
        ],
      })),
    },
  ];
  const description = renderDungeonKey(x.room, [x.key], geometry, {
    audience: 'public',
    heading: null,
    discovered: new Set(),
  });
  assert.ok(description.text.includes('Die lichte Höhe beträgt 1.524 bis 10.668 Meter.'));
  assert.equal(geometry.drawing.volumes[0].columns.length, 100000);
});
test('room descriptions compute large polygon bounds without spreading vertices into calls', (t) => {
  const x = fixture(t),
    room = structuredClone(x.room);
  room.polygons = [
    {
      outer: Array.from({ length: 200000 }, (_, i) => ({
        x: i % 2 ? 30 : 0,
        y: i % 4 < 2 ? 0 : 12,
      })),
      holes: [],
    },
  ];
  const description = renderDungeonKey(room, [x.key], x.geometry, {
    audience: 'public',
    heading: null,
    discovered: new Set(),
  });
  assert.ok(description.text.includes('Der Raum erstreckt sich über 30.0 × 12.0 Meter.'));
});
