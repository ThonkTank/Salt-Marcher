import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
for (const [name, entry] of [
  ['store', 'storage/store'],
  ['model', 'key-model'],
  ['discovery', 'storage/dungeon-key'],
])
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/template-discovery-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../.build/template-discovery-store.cjs'),
  {
    expandedKeyBlocks,
    templateBlockId,
    renderDungeonKey,
  } = require('../.build/template-discovery-model.cjs'),
  { revealKey, keyDiscoveries } = require('../.build/template-discovery-discovery.cjs');
const block = (text, visibility = 'secret') => ({
  id: randomUUID(),
  kind: 'text',
  visibility,
  text,
  templateId: null,
  suppressed: [],
  searchMethod: 'Inspect',
  dc: 12,
  discoveryNotes: 'Private GM clue',
  revealedText: '',
});
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'template-discovery-')),
    file = path.join(dir, 'campaign.sqlite'),
    store = new CampaignStore(file),
    rooms = ['Guardroom', 'Echo room'].map((name, i) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: String(i + 1),
      name,
      revision: 0,
      polygons: [
        {
          outer: [
            { x: i * 6.096, y: 0 },
            { x: i * 6.096 + 3.048, y: 0 },
            { x: i * 6.096 + 3.048, y: 3.048 },
            { x: i * 6.096, y: 3.048 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Protected legacy prose\r\n' }],
    })),
    campaign = store.create('Template discoveries', rooms),
    w = store.activate(campaign.id),
    character = randomUUID();
  const command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    }),
    send = (action) => store.executeDrawing(command(action));
  const base = {
      revision: 0,
      scopeId: 'local',
      levelId: null,
      groupId: null,
      zSteps: [],
      attributes: {},
      tags: [],
      secret: false,
      status: '',
      references: [],
    },
    template = {
      ...base,
      id: randomUUID(),
      kind: 'template',
      name: 'Two secrets',
      blocks: [block('Bronze key'), block('Trapdoor'), block('GM code 88', 'gm')],
    };
  send({ kind: 'key-content', content: template, expectedRevision: null });
  const keys = rooms.map((r) => ({
    ...base,
    id: r.id,
    kind: 'room',
    name: r.name,
    blocks: [{ ...block('', 'public'), kind: 'template', templateId: template.id }],
  }));
  for (const content of keys) send({ kind: 'key-content', content, expectedRevision: null });
  const records = () => store.drawing(w.token).keyContent,
    reveal = (index, subject, known = true) =>
      revealKey(store.db, campaign.id, rooms[index].id, subject, [character], known),
    known = () => keyDiscoveries(store.db, campaign.id, [character]),
    render = (index, audience = 'public') =>
      renderDungeonKey(rooms[index], records(), store.dungeon(w.token), {
        audience,
        heading: null,
        discovered: known(),
      });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    store,
    file,
    rooms,
    campaign,
    w,
    character,
    template,
    keys,
    send,
    records,
    reveal,
    known,
    render,
  };
}
test('derived identities are stable, compact, and distinguish unambiguous long identity pairs', () => {
  const pairs = [
    ['a:b', 'c'],
    ['a', 'b:c'],
    ['x'.repeat(1000), 'y'.repeat(1000)],
    ['é', '雪'],
  ];
  const ids = pairs.map(([a, b]) => templateBlockId(a, b));
  assert.equal(new Set(ids).size, pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    assert.equal(
      ids[i],
      'template:' + createHash('sha256').update(JSON.stringify(pairs[i])).digest('hex'),
    );
    assert.equal(ids[i].length, 73);
  }
});
test('revealing, hiding, template edits, detachment and fresh reopening preserve individual knowledge', async (t) => {
  const x = fixture(t),
    expanded = expandedKeyBlocks(x.keys[0], x.records()),
    first = expanded[0].id,
    second = expanded[1].id;
  assert.equal(x.render(0).text, '');
  x.reveal(0, first);
  assert.equal(x.render(0).text, 'Bronze key');
  assert.equal(x.render(1).text, '');
  x.reveal(0, second);
  x.reveal(0, first, false);
  assert.equal(x.render(0).text, 'Trapdoor');
  const template = x.records().find((k) => k.id === x.template.id);
  template.blocks[1].text = 'Edited trapdoor';
  x.send({ kind: 'key-content', content: template, expectedRevision: template.revision });
  assert.equal(x.render(0).text, 'Edited trapdoor');
  const room = x.records().find((k) => k.id === x.rooms[0].id);
  room.blocks = expandedKeyBlocks(room, x.records()).map((b) => structuredClone(b));
  x.send({ kind: 'key-content', content: room, expectedRevision: room.revision });
  assert.equal(x.render(0).text, 'Edited trapdoor');
  assert.ok(room.blocks.some((b) => b.id === second));
  x.store.close();
  const fresh = new CampaignStore(x.file);
  t.after(() => fresh.close());
  const w = fresh.activate(x.campaign.id),
    records = fresh.drawing(w.token).keyContent;
  assert.equal(
    renderDungeonKey(x.rooms[0], records, fresh.dungeon(w.token), {
      audience: 'public',
      heading: null,
      discovered: keyDiscoveries(fresh.db, x.campaign.id, [x.character]),
    }).text,
    'Edited trapdoor',
  );
  assert.deepEqual(
    fresh.workspace().rooms.map((r) => r.sections),
    x.rooms.map((r) => r.sections),
  );
});
test('legacy parent knowledge remains private with an actionable GM-only cue', (t) => {
  const x = fixture(t);
  x.store.db
    .prepare('INSERT INTO dungeon_key_discovery VALUES(?,?,?,1)')
    .run(x.campaign.id, x.character, x.keys[0].blocks[0].id);
  assert.equal(x.render(0).text, '');
  assert.equal(x.known().has(x.keys[0].blocks[0].id), true);
  const gm = x.render(0, 'gm');
  assert.equal(
    gm.blocks.filter((b) => b.discoveryNotes.includes('Frühere Vorlagenfreigabe')).length,
    2,
  );
  x.reveal(0, gm.blocks[0].id);
  assert.equal(x.render(0).text, 'Bronze key');
  assert.ok(x.render(0).blocks.every((b) => b.discoveryNotes === ''));
});
test('parent, private child, raw template child and another room cannot be revealed', (t) => {
  const x = fixture(t),
    blocks = expandedKeyBlocks(x.keys[0], x.records()),
    before = x.store.db.serialize();
  for (const id of [x.keys[0].blocks[0].id, x.template.blocks[0].id, blocks[2].id])
    assert.throws(() => x.reveal(0, id), /Beschreibungsblock/);
  assert.throws(() => x.reveal(1, blocks[0].id), /Beschreibungsblock/);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('a forged authored identity cannot alias an existing template discovery, including template updates', (t) => {
  const x = fixture(t),
    id = expandedKeyBlocks(x.keys[0], x.records())[0].id,
    other = x.records().find((k) => k.id === x.rooms[1].id),
    before = x.store.db.serialize();
  other.blocks = [{ ...block('Forged secret'), id }];
  assert.throws(
    () => x.send({ kind: 'key-content', content: other, expectedRevision: other.revision }),
    /mehreren/,
  );
  assert.deepEqual(x.store.db.serialize(), before);
  const template = x.records().find((k) => k.id === x.template.id),
    child = block('New secret'),
    futureId = templateBlockId(x.keys[0].blocks[0].id, child.id);
  other.blocks = [{ ...block('Future alias'), id: futureId }];
  x.send({ kind: 'key-content', content: other, expectedRevision: other.revision });
  const safe = x.store.db.serialize();
  template.blocks.push(child);
  assert.throws(
    () => x.send({ kind: 'key-content', content: template, expectedRevision: template.revision }),
    /mehreren/,
  );
  assert.deepEqual(x.store.db.serialize(), safe);
});
test('a checksummed alias cannot enter rendering or replace a qualified backup', async (t) => {
  const x = fixture(t),
    safe = path.join(path.dirname(x.file), 'safe.sqlite');
  await x.store.backup(safe);
  const fs = await import('node:fs'),
    bytes = fs.readFileSync(safe),
    row = x.store.db.prepare('SELECT * FROM dungeon_key_content WHERE id=?').get(x.rooms[1].id),
    value = JSON.parse(row.payload);
  value.blocks = [
    { ...block('Aliased secret'), id: expandedKeyBlocks(x.keys[0], x.records())[0].id },
  ];
  const payload = JSON.stringify(value);
  x.store.db
    .prepare('UPDATE dungeon_key_content SET payload=?,checksum=? WHERE id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), value.id);
  assert.throws(() => x.records(), /mehreren/);
  await assert.rejects(x.store.backup(safe), /mehreren/);
  assert.ok(fs.readFileSync(safe).equals(bytes));
});
