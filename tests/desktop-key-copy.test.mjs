import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
for (const [name, entry] of [
  ['store', 'storage/store'],
  ['copy', 'key-copy-model'],
  ['model', 'key-model'],
  ['contracts', 'key-contracts'],
])
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/key-copy-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../.build/key-copy-store.cjs'),
  { keyCopyDependencies } = require('../.build/key-copy-copy.cjs'),
  { emptyKey } = require('../.build/key-copy-contracts.cjs'),
  { expandedKeyBlocks, renderDungeonKey } = require('../.build/key-copy-model.cjs');
test('independent room-content copy is guarded, atomic, reversible and does not inherit discovery', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'key-copy-')),
    file = path.join(dir, 'store.sqlite');
  let store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const rooms = ['Quellraum', 'Wache', 'Gruft'].map((name, i) => ({
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
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Alter Key ' + name + '\r\n' }],
    })),
    cam = store.create('Kopieren', rooms);
  let w = store.activate(cam.id);
  const command = (action) => ({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      action,
    }),
    send = (action) => store.executeDrawing(command(action)),
    records = () => store.drawing(w.token).keyContent,
    block = (text, visibility = 'public') => ({
      id: randomUUID(),
      kind: 'text',
      visibility,
      text,
      templateId: null,
      suppressed: [],
      searchMethod: 'Suchen',
      dc: 12,
      discoveryNotes: 'Privater Hinweis',
      revealedText: 'Entdeckter Geheimgang',
    });
  const template = {
    ...emptyKey(rooms[0]),
    id: randomUUID(),
    kind: 'template',
    name: 'Nische',
    blocks: [block('  Vorlesetext\r\n'), block('Geheimgang', 'secret')],
  };
  send({ kind: 'key-content', content: template, expectedRevision: null });
  send({
    kind: 'key-content',
    content: {
      ...emptyKey(rooms[0]),
      id: 'local',
      kind: 'dungeon',
      name: 'Dungeon',
      attributes: { Material: 'Basalt' },
      blocks: [],
    },
    expectedRevision: null,
  });
  const source = {
    ...emptyKey(rooms[0]),
    attributes: { Licht: null },
    tags: ['Nische'],
    references: [{ kind: 'npc', id: 'external-npc', label: 'Alte Referenz' }],
  };
  source.blocks.unshift({ ...block(''), kind: 'template', templateId: template.id });
  send({ kind: 'key-content', content: source, expectedRevision: null });
  const existing = { ...emptyKey(rooms[1]), tags: ['Wache'], attributes: { Geruch: 'Rauch' } };
  existing.blocks.unshift(block('Bisheriger Text'));
  send({ kind: 'key-content', content: existing, expectedRevision: null });
  const options = {
      fields: ['blocks', 'attributes', 'tags', 'references'],
      mode: 'replace',
      attributes: 'effective',
    },
    guard = (id) => {
      const r = store.workspace().rooms.find((r) => r.id === id);
      return {
        id,
        expectedRevision: r.revision,
        keyRevision: records().find((k) => k.id === id)?.revision ?? null,
      };
    },
    action = () => ({
      kind: 'key-copy',
      source: guard(rooms[0].id),
      dependencies: keyCopyDependencies(store.workspace().rooms[0], records(), options),
      rooms: rooms.slice(1).map((r) => guard(r.id)),
      options,
    });
  const discovered = expandedKeyBlocks(
    records().find((k) => k.id === source.id),
    records(),
  ).find((b) => b.visibility === 'secret').id;
  store.db
    .prepare('INSERT INTO dungeon_key_discovery VALUES(?,?,?,1)')
    .run(cam.id, 'pc', discovered);
  const beforeRooms = store.workspace().rooms,
    knowledge = JSON.stringify(store.db.prepare('SELECT * FROM dungeon_key_discovery').all()),
    a = command(action());
  store.executeDrawing(a);
  const keys = records(),
    copied = rooms.slice(1).map((r) => keys.find((k) => k.id === r.id));
  assert.equal(
    new Set(copied.flatMap((k) => k.blocks.map((b) => b.id))).size,
    copied.reduce((n, k) => n + k.blocks.length, 0),
  );
  for (const [i, key] of copied.entries()) {
    assert.equal(
      key.blocks.some((b) => b.kind === 'template'),
      false,
    );
    assert.equal(
      key.blocks.some((b) => b.id === discovered),
      false,
    );
    assert.equal(key.attributes.Material, 'Basalt');
    assert.equal(key.attributes.Licht, null);
    assert.ok(key.blocks.some((b) => b.text === rooms[0].sections[0].markdown));
    const output = renderDungeonKey(store.workspace().rooms[i + 1], keys, store.dungeon(w.token), {
      audience: 'public',
      heading: null,
      discovered: new Set([discovered]),
    });
    assert.match(output.text, /Vorlesetext/);
    assert.doesNotMatch(output.text, /Geheimgang|Privater Hinweis/);
  }
  assert.equal(
    JSON.stringify(store.db.prepare('SELECT * FROM dungeon_key_discovery').all()),
    knowledge,
  );
  assert.deepEqual(
    store.workspace().rooms.map((r) => [r.id, r.number, r.polygons, r.sections]),
    beforeRooms.map((r) => [r.id, r.number, r.polygons, r.sections]),
  );
  const committed = store.db.serialize();
  store.executeDrawing(a);
  assert.ok(store.db.serialize().equals(committed));
  store.history(w.token, 'undo');
  assert.equal(
    records().find((k) => k.id === rooms[2].id),
    undefined,
  );
  assert.deepEqual(records().find((k) => k.id === rooms[1].id).blocks, existing.blocks);
  store.history(w.token, 'redo');
  assert.deepEqual(records().find((k) => k.id === rooms[1].id).blocks, copied[0].blocks);
  const stale = action(),
    tpl = records().find((k) => k.id === template.id);
  tpl.blocks[0].text = 'Neue Vorlage';
  send({ kind: 'key-content', content: tpl, expectedRevision: tpl.revision });
  let safe = store.db.serialize();
  assert.throws(() => send(stale), /Quellvorlage/);
  assert.ok(store.db.serialize().equals(safe));
  const invalid = action();
  invalid.rooms[1].expectedRevision--;
  safe = store.db.serialize();
  assert.throws(() => send(invalid), /Raum geändert/);
  assert.ok(store.db.serialize().equals(safe));
  store.close();
  store = new CampaignStore(file);
  w = store.activate(cam.id);
  assert.deepEqual(records().find((k) => k.id === rooms[1].id).blocks, copied[0].blocks);
  assert.equal(
    JSON.stringify(store.db.prepare('SELECT * FROM dungeon_key_discovery').all()),
    knowledge,
  );
});
