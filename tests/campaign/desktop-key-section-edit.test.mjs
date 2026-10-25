import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/section-edit-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/section-edit-store.cjs');
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'section-edit-')),
    store = new CampaignStore(path.join(dir, 'campaign.sqlite')),
    rooms = Array.from({ length: 2 }, (_, i) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: String(i + 1),
      name: 'Raum ' + i,
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
      sections: [
        {
          id: randomUUID(),
          kind: 'markdown',
          markdown: '  Original\r\nGemischte Zeilen\nUnberührt.  ',
        },
        { id: randomUUID(), kind: 'markdown', markdown: '  Zweiter Abschnitt\r\n' },
        { id: randomUUID(), kind: 'passage', doorId: randomUUID() },
      ],
    })),
    campaign = store.create('Importierte Abschnitte', rooms),
    w = store.activate(campaign.id);
  const send = (action) =>
      store.executeDrawing({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      }),
    guards = () =>
      store.workspace().rooms.map((r) => ({
        id: r.id,
        expectedRevision: r.revision,
        keyRevision: store.drawing(w.token).keyContent.find((k) => k.id === r.id)?.revision ?? null,
      }));
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, w, rooms, campaign, send, guards };
}
test('one imported section changes through the existing key history while other sections and bindings retain their bytes', (t) => {
  const x = fixture(t),
    room = x.rooms[0],
    edits = [
      {
        id: room.sections[0].id,
        markdown: room.sections[0].markdown.replace('Original', 'Neue Spur'),
      },
    ];
  x.send({ kind: 'key-batch', rooms: [x.guards()[0]], patch: { sectionEdits: edits } });
  const saved = x.store.workspace().rooms[0];
  assert.equal(saved.sections[0].markdown, edits[0].markdown);
  assert.deepEqual(saved.sections.slice(1), room.sections.slice(1));
  assert.deepEqual(x.store.workspace().rooms[1], x.rooms[1]);
  x.store.history(x.w.token, 'undo');
  assert.deepEqual(x.store.workspace().rooms[0].sections, room.sections);
  x.store.history(x.w.token, 'redo');
  assert.equal(x.store.workspace().rooms[0].sections[0].markdown, edits[0].markdown);
});
for (const kind of ['foreign-id', 'duplicate', 'door', 'bad-text', 'multiple-rooms'])
  test(`${kind} section edits are rejected atomically`, (t) => {
    const x = fixture(t),
      id = x.rooms[0].sections[0].id,
      edits =
        kind === 'foreign-id'
          ? [{ id: x.rooms[1].sections[0].id, markdown: 'fremd' }]
          : kind === 'duplicate'
            ? [
                { id, markdown: 'a' },
                { id, markdown: 'b' },
              ]
            : kind === 'door'
              ? [{ id: x.rooms[0].sections[2].id, markdown: 'keine Tür mehr' }]
              : kind === 'bad-text'
                ? [{ id, markdown: false }]
                : [{ id, markdown: 'neu' }],
      before = x.store.db.serialize();
    assert.throws(() =>
      x.send({
        kind: 'key-batch',
        rooms: kind === 'multiple-rooms' ? x.guards() : [x.guards()[0]],
        patch: { sectionEdits: edits },
      }),
    );
    assert.deepEqual(x.store.db.serialize(), before);
  });
test('a stale room revision refuses an imported edit and preserves the newer content', (t) => {
  const x = fixture(t),
    guard = x.guards()[0],
    id = x.rooms[0].sections[0].id;
  x.send({
    kind: 'key-batch',
    rooms: [guard],
    patch: { sectionEdits: [{ id, markdown: 'Neuere Eingabe' }] },
  });
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.send({
        kind: 'key-batch',
        rooms: [guard],
        patch: { sectionEdits: [{ id, markdown: 'Veraltet' }] },
      }),
    /geändert/,
  );
  assert.deepEqual(x.store.db.serialize(), before);
});
test('a lost acknowledgement can replay the same section command without another history entry', (t) => {
  const x = fixture(t),
    command = {
      commandId: randomUUID(),
      token: x.w.token,
      campaignId: x.campaign.id,
      action: {
        kind: 'key-batch',
        rooms: [x.guards()[0]],
        patch: {
          sectionEdits: [{ id: x.rooms[0].sections[0].id, markdown: 'Gespeicherte Änderung' }],
        },
      },
    };
  x.store.executeDrawing(command);
  const before = x.store.db.serialize();
  x.store.executeDrawing(command);
  assert.deepEqual(x.store.db.serialize(), before);
});
