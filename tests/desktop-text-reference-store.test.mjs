import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/text-reference-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/text-reference-store.cjs');
const save = (s, w, note) =>
  s.changePreparation({
    commandId: randomUUID(),
    campaignId: w.campaign.id,
    token: w.token,
    change: { kind: 'note', expectedRevision: null, note },
  });
const note = (id, title, gmNotes = '') => ({
  version: 1,
  id,
  revision: 1,
  kind: 'npc',
  title,
  readAloud: '',
  gmNotes,
  relations: [],
  creatureId: null,
  deleted: false,
});
test('SQLite alias search and graph ignore code examples, and copy/Fresh only remap live author targets', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'text-ref-copy-')),
    source = new CampaignStore(join(root, 'source.sqlite'));
  let target = new CampaignStore(join(root, 'target.sqlite'));
  t.after(() => {
    source.close();
    target.close();
    rmSync(root, { recursive: true, force: true });
  });
  const c = source.create('Original'),
    w = source.activate(c.id),
    id = randomUUID(),
    author = randomUUID(),
    real = `[Lebender Alias](dungeon-ref:note/${id})`,
    literal = `[Beispiel Alias](dungeon-ref:note/${id})`,
    raw =
      real +
      '\r\n~~~md\r\n' +
      literal +
      '\r\n~~~\r\n`' +
      literal +
      '`\r\n\\' +
      literal +
      '\r\n!' +
      literal +
      '\r\n[[Vault note]]';
  save(source, w, note(id, 'Gleichnamig'));
  save(source, w, note(author, 'Quelle', raw));
  assert.equal(source.searchDesk(w.token, 'reference', 'Beispiel', 0).entries.length, 0);
  const hits = source.searchDesk(w.token, 'reference', 'Lebender', 0).entries;
  assert.equal(hits.length, 1);
  assert.equal(hits[0].ref.id, id);
  const graph = source.worldLinks(w.token, {
    text: '',
    kind: 'all',
    offset: 0,
    focus: { kind: 'note', id: author },
  });
  assert.equal(graph.edges.filter((e) => e.label.startsWith('Textverweis')).length, 1);
  const snapshot = join(root, 'campaign.sqlite');
  await source.campaignSnapshot(w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = target.acceptCampaignSnapshot(snapshot, 'Kopie', {});
  target.close();
  target = new CampaignStore(join(root, 'target.sqlite'));
  const tw = target.activate(copy.id),
    p = target.preparation(tw.token, ''),
    copied = p.notes.find((r) => r.note.title === 'Quelle').note,
    newId = p.notes.find((r) => r.note.title === 'Gleichnamig').note.id;
  assert.notEqual(newId, id);
  assert.equal(copied.gmNotes, raw.replace(real, `[Lebender Alias](dungeon-ref:note/${newId})`));
  assert.equal(target.searchDesk(tw.token, 'reference', 'Beispiel', 0).entries.length, 0);
  assert.equal(target.searchDesk(tw.token, 'reference', 'Lebender', 0).entries[0].ref.id, newId);
  assert.equal(
    source.preparation(w.token, '').notes.find((r) => r.note.id === author).note.gmNotes,
    raw,
  );
  assert.ok(readFileSync(snapshot).equals(bytes));
});
test('equal display names retain distinct targets in alias search and Fresh', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'text-ref-alias-'));
  let store = new CampaignStore(join(root, 'campaign.sqlite'));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const c = store.create('Gleiche Namen'),
    w = store.activate(c.id),
    a = randomUUID(),
    b = randomUUID();
  for (const id of [a, b]) save(store, w, note(id, 'Gleichnamig'));
  save(
    store,
    w,
    note(
      randomUUID(),
      'Quelle',
      `[Wache](dungeon-ref:note/${a})\r\n[Wache](dungeon-ref:note/${b})`,
    ),
  );
  assert.deepEqual(
    new Set(store.searchDesk(w.token, 'reference', 'Wache', 0).entries.map((e) => e.ref.id)),
    new Set([a, b]),
  );
  store.close();
  store = new CampaignStore(join(root, 'campaign.sqlite'));
  const fresh = store.activate(c.id);
  assert.deepEqual(
    new Set(store.searchDesk(fresh.token, 'reference', 'Wache', 0).entries.map((e) => e.ref.id)),
    new Set([a, b]),
  );
});
