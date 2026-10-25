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
  ['model', 'campaign/key-model'],
  ['contracts', 'campaign/key-contracts'],
])
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/template-link-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/template-link-store.cjs'),
  { emptyKey } = require('../../.build/template-link-contracts.cjs'),
  { renderDungeonKey } = require('../../.build/template-link-model.cjs');
test('shared template linking preserves individual room material, is atomic, guarded, reversible and survives Fresh', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'key-template-link-')),
    file = path.join(dir, 'store.sqlite');
  let store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const rooms = ['Tor', 'Archiv', 'Keller'].map((name, i) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: String(i + 1),
      name,
      revision: 0,
      polygons: [
        {
          outer: [
            { x: i * 9, y: 0 },
            { x: i * 9 + 6, y: 0 },
            { x: i * 9 + 6, y: 6 },
            { x: i * 9, y: 6 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Original ' + name + '\r\n' }],
    })),
    cam = store.create('Nebelwacht', rooms);
  let w = store.activate(cam.id);
  const command = (action) => ({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      action,
    }),
    send = (action) => store.executeDrawing(command(action)),
    records = () => store.drawing(w.token).keyContent;
  const block = (text, visibility = 'public') => ({
    id: randomUUID(),
    kind: 'text',
    visibility,
    text,
    templateId: null,
    suppressed: [],
    searchMethod: 'Suchen',
    dc: 12,
    discoveryNotes: 'Privat',
    revealedText: 'Gefunden',
  });
  let template = {
    ...emptyKey(rooms[0]),
    id: randomUUID(),
    kind: 'template',
    name: 'Atmosphäre',
    blocks: [
      block('Bernsteinsiegel'),
      block('Gemeinsames Geheimnis', 'gm'),
      block('Versteck', 'secret'),
    ],
  };
  send({ kind: 'key-content', content: template, expectedRevision: null });
  const original = [];
  for (const room of rooms) {
    const key = {
      ...emptyKey(room),
      blocks: [
        block('Eigener Vorlesetext ' + room.name),
        block('Eigenes Geheimnis ' + room.name, 'gm'),
        block('Eigene Entdeckung ' + room.name, 'secret'),
      ],
      tags: ['vorbereitet'],
      status: 'ready',
      attributes: { Licht: 'dunkel' },
      references: [{ kind: 'npc', id: 'mara', label: 'Mara' }],
    };
    send({ kind: 'key-content', content: key, expectedRevision: null });
    original.push(records().find((k) => k.id === room.id));
  }
  const guards = () =>
    store.workspace().rooms.map((r) => ({
      id: r.id,
      expectedRevision: r.revision,
      keyRevision: records().find((k) => k.id === r.id)?.revision ?? null,
    }));
  const action = () => ({
    kind: 'key-batch',
    rooms: guards(),
    patch: {
      linkTemplate: {
        id: template.id,
        revision: records().find((k) => k.id === template.id).revision,
      },
    },
  });
  const beforeRooms = store.workspace().rooms;
  const cmd = command(action());
  store.executeDrawing(cmd);
  const linked = rooms.map((r) => records().find((k) => k.id === r.id));
  for (const [i, key] of linked.entries()) {
    assert.deepEqual(
      { ...key, revision: original[i].revision, blocks: key.blocks.slice(0, -1) },
      original[i],
    );
    assert.equal(key.blocks.at(-1).templateId, template.id);
  }
  assert.equal(new Set(linked.map((k) => k.blocks.at(-1).id)).size, 3);
  assert.deepEqual(
    store.workspace().rooms.map((r) => ({ ...r, revision: 0 })),
    beforeRooms.map((r) => ({ ...r, revision: 0 })),
  );
  const committed = store.db.serialize();
  store.executeDrawing(cmd);
  assert.ok(store.db.serialize().equals(committed));
  store.history(w.token, 'undo');
  for (const [i, room] of rooms.entries())
    assert.deepEqual(records().find((k) => k.id === room.id).blocks, original[i].blocks);
  store.history(w.token, 'redo');
  send(action());
  for (const room of rooms)
    assert.equal(
      records()
        .find((k) => k.id === room.id)
        .blocks.filter((b) => b.templateId === template.id).length,
      1,
    );
  const stale = action();
  template = records().find((k) => k.id === template.id);
  template.blocks[0].text = 'Blaues Dienstsiegel';
  send({ kind: 'key-content', content: template, expectedRevision: template.revision });
  let safe = store.db.serialize();
  assert.throws(() => send(stale), /Textvorlage geändert/);
  assert.ok(store.db.serialize().equals(safe));
  const bad = action();
  bad.rooms[2].expectedRevision--;
  safe = store.db.serialize();
  assert.throws(() => send(bad), /Raum geändert/);
  assert.ok(store.db.serialize().equals(safe));
  const both = action();
  both.patch.blocks = [];
  safe = store.db.serialize();
  assert.throws(() => send(both), /Blockersetzung/);
  assert.ok(store.db.serialize().equals(safe));
  const invalid = action();
  invalid.patch.linkTemplate.id = rooms[0].id;
  assert.throws(() => send(invalid), /Textvorlage geändert/);
  assert.ok(store.db.serialize().equals(safe));
  const group = {
    ...emptyKey(rooms[0]),
    id: randomUUID(),
    kind: 'group',
    name: 'Gemeinsam',
    blocks: [{ ...block(''), kind: 'template', templateId: template.id }],
  };
  send({ kind: 'key-content', content: group, expectedRevision: null });
  const first = records().find((k) => k.id === rooms[0].id);
  send({
    kind: 'key-batch',
    rooms: [guards()[0]],
    patch: { groupId: group.id, blocks: first.blocks.filter((b) => b.kind !== 'template') },
  });
  send({ ...action(), rooms: [guards()[0]] });
  assert.equal(
    records()
      .find((k) => k.id === rooms[0].id)
      .blocks.filter((b) => b.kind === 'template').length,
    1,
    'Group prose does not replace an explicit room-template link',
  );
  store.close();
  store = new CampaignStore(file);
  w = store.activate(cam.id);
  for (const room of store.workspace().rooms) {
    const gm = renderDungeonKey(room, records(), store.dungeon(w.token), {
        audience: 'gm',
        heading: null,
        discovered: new Set(),
      }).text,
      publicText = renderDungeonKey(room, records(), store.dungeon(w.token), {
        audience: 'public',
        heading: null,
        discovered: new Set(),
      }).text;
    assert.match(gm, /Blaues Dienstsiegel/);
    assert.match(gm, /Eigenes Geheimnis/);
    assert.match(publicText, /Blaues Dienstsiegel/);
    assert.doesNotMatch(publicText, /Geheimnis|Versteck|Entdeckung/);
    assert.equal(records().find((k) => k.id === room.id).references[0].id, 'mara');
  }
});
