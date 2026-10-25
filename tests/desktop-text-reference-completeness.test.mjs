import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/text-reference-completeness.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../.build/text-reference-completeness.cjs',
);
const hash = (s) => createHash('sha256').update(s).digest('hex'),
  doc = (id, title, gmNotes = '') => ({
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
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'reference-completeness-'));
  let store = new CampaignStore(join(root, 'campaign.sqlite'));
  const c = store.create('Quellen'),
    w = store.activate(c.id);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const save = (n) =>
    store.changePreparation({
      commandId: randomUUID(),
      campaignId: c.id,
      token: w.token,
      change: { kind: 'note', expectedRevision: null, note: n },
    });
  return {
    store,
    c,
    w,
    save,
    root,
    fresh() {
      store.close();
      store = new CampaignStore(join(root, 'campaign.sqlite'));
      return store;
    },
  };
}
test('search and Fresh find a real alias after 200 earlier references without editing author bytes', (t) => {
  const x = fixture(t),
    target = randomUUID(),
    source = randomUUID(),
    raw = Array.from(
      { length: 240 },
      (_, i) => `[Alias ${String(i).padStart(3, '0')}](dungeon-ref:note/${target})`,
    ).join('\r\n');
  x.save(doc(target, 'Ziel'));
  x.save(doc(source, 'Quelle', raw));
  assert.equal(
    x.store.searchDesk(x.w.token, 'reference', 'Alias 239', 0).entries[0]?.ref.id,
    target,
  );
  const graph = x.store.worldLinks(x.w.token, {
    text: 'Alias 239',
    kind: 'reference',
    offset: 0,
    focus: null,
  });
  assert.equal(graph.matches[0]?.ref.id, target);
  assert.equal(
    x.store.preparation(x.w.token, '').notes.find((r) => r.note.id === source).note.gmNotes,
    raw,
  );
  const fresh = x.fresh(),
    w = fresh.activate(x.c.id);
  assert.equal(fresh.searchDesk(w.token, 'reference', 'Alias 239', 0).entries[0]?.ref.id, target);
});
for (const fault of ['checksum', 'identity', 'revision'])
  test(`${fault} source remains unknown while healthy aliases remain searchable`, (t) => {
    const x = fixture(t),
      target = randomUUID(),
      source = randomUUID(),
      good = randomUUID(),
      link = `[Wache](dungeon-ref:note/${target})`;
    x.save(doc(target, 'Ziel'));
    x.save(doc(source, 'Defekte Quelle', link));
    x.save(doc(good, 'Gesunde Quelle', `[Gesund](dungeon-ref:note/${target})`));
    const row = x.store.db
        .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
        .get(x.c.id, source),
      d = JSON.parse(row.payload);
    if (fault === 'identity') d.id = randomUUID();
    if (fault === 'revision') d.revision++;
    const payload = JSON.stringify(d);
    x.store.db
      .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, fault === 'checksum' ? 'broken' : hash(payload), x.c.id, source);
    const page = x.store.searchDesk(x.w.token, 'reference', 'Wache', 0);
    assert.equal(page.entries.length, 0);
    assert.match(page.notice ?? '', /unvollständig|nicht gelesen/);
    assert.equal(
      x.store.searchDesk(x.w.token, 'reference', 'Gesund', 0).entries[0]?.ref.id,
      target,
    );
    const graph = x.store.worldLinks(x.w.token, {
      text: 'Gesund',
      kind: 'reference',
      offset: 0,
      focus: { kind: 'note', id: target },
    });
    assert.match(graph.notice ?? '', /unvollständig|nicht gelesen/);
    assert.equal(
      graph.edges.some((e) => e.source.id === source),
      false,
    );
  });
test('alias pages remain bounded and deterministic beyond 40 unique targets', (t) => {
  const x = fixture(t),
    ids = [];
  for (let i = 0; i < 83; i++) {
    const id = randomUUID();
    ids.push(id);
    x.save(doc(id, 'Ziel ' + i));
  }
  x.save(
    doc(
      randomUUID(),
      'Quelle',
      ids
        .map((id, i) => `[Wache ${String(i).padStart(3, '0')}](dungeon-ref:note/${id})`)
        .join('\n'),
    ),
  );
  let after = 0,
    seen = [];
  while (after !== null) {
    const p = x.store.searchDesk(x.w.token, 'reference', 'Wache', after);
    assert(p.entries.length <= 40);
    seen.push(...p.entries.map((e) => e.ref.id));
    after = p.next;
  }
  assert.deepEqual(seen, ids);
});

test('a forged location source cannot supply aliases or direct reader details', (t) => {
  const x = fixture(t),
    id = randomUUID(),
    target = randomUUID();
  x.save(doc(target, 'Ziel'));
  const document = {
    kind: 'location',
    version: 1,
    id,
    name: 'Ort',
    type: 'poi',
    sections: [
      { id: randomUUID(), title: 'Text', markdown: `[Ortalias](dungeon-ref:note/${target})` },
    ],
    detailMaps: [],
    keyLinks: [],
  };
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: x.c.id,
    token: x.w.token,
    change: { kind: 'location', expectedRevision: null, document },
  });
  const payload = JSON.stringify({ ...document, id: randomUUID() });
  x.store.db
    .prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, hash(payload), x.c.id, id);
  const page = x.store.searchDesk(x.w.token, 'reference', 'Ortalias', 0);
  assert.equal(page.entries.length, 0);
  assert.match(page.notice ?? '', /unvollständig/);
  assert.throws(() => x.store.deskContent(x.w.token, { kind: 'location', id }), /Ortszuordnung/);
});

test('a warm derived cache cannot conceal altered bytes, row revision, repair, or trash', (t) => {
  const x = fixture(t),
    target = randomUUID(),
    id = randomUUID(),
    n = doc(id, 'Quelle', `[Alt](dungeon-ref:note/${target})`);
  x.save(doc(target, 'Ziel'));
  x.save(n);
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Alt', 0).entries.length, 1);
  const original = JSON.stringify(n),
    altered = JSON.stringify({ ...n, gmNotes: `[Neu](dungeon-ref:note/${target})` }),
    update = (p, checksum, revision = 1) =>
      x.store.db
        .prepare(
          'UPDATE world_note SET payload=?,checksum=?,revision=? WHERE campaign_id=? AND id=?',
        )
        .run(p, checksum, revision, x.c.id, id);
  update(altered, hash(original));
  assert.match(x.store.searchDesk(x.w.token, 'reference', 'Alt', 0).notice ?? '', /unvollständig/);
  update(original, hash(original), 2);
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Alt', 0).entries.length, 0);
  update(altered, hash(altered));
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Neu', 0).entries[0]?.ref.id, target);
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Alt', 0).entries.length, 0);
  update(original, hash(original));
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Alt', 0).entries.length, 1);
  x.store.changePreparation({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.c.id,
    change: { kind: 'note-trash', id, expectedRevision: 1, trashed: true },
  });
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Alt', 0).entries.length, 0);
});

test('identical source IDs and bytes never cache campaign-specific target details', (t) => {
  const x = fixture(t),
    target = randomUUID(),
    source = randomUUID(),
    raw = `[Alias](dungeon-ref:note/${target})`;
  x.save(doc(target, 'A Ziel'));
  x.save(doc(source, 'Quelle', raw));
  assert.equal(x.store.searchDesk(x.w.token, 'reference', 'Alias', 0).entries[0].title, 'A Ziel');
  const b = x.store.create('B'),
    bw = x.store.activate(b.id);
  for (const n of [doc(target, 'B Ziel'), doc(source, 'Quelle', raw)])
    x.store.changePreparation({
      commandId: randomUUID(),
      campaignId: b.id,
      token: bw.token,
      change: { kind: 'note', expectedRevision: null, note: n },
    });
  assert.equal(x.store.searchDesk(bw.token, 'reference', 'Alias', 0).entries[0].title, 'B Ziel');
  const back = x.store.activate(x.c.id);
  assert.equal(x.store.searchDesk(back.token, 'reference', 'Alias', 0).entries[0].title, 'A Ziel');
});
test('a document reader loads each repeated large target only once', (t) => {
  const x = fixture(t),
    target = randomUUID(),
    id = randomUUID();
  x.save(doc(target, 'Lange Zielnotiz', 'Eigener Text. '.repeat(10000)));
  x.save(
    doc(
      id,
      'Quelle',
      Array.from({ length: 200 }, (_, i) => `[Alias ${i}](dungeon-ref:note/${target})`).join('\n'),
    ),
  );
  let reads = 0;
  const prepare = x.store.db.prepare.bind(x.store.db);
  x.store.db.prepare = (sql) => {
    const statement = prepare(sql);
    if (sql.includes('FROM world_note') && sql.includes('id=?')) {
      const get = statement.get.bind(statement);
      statement.get = (...args) => {
        if (args[1] === target) reads++;
        return get(...args);
      };
    }
    return statement;
  };
  const content = x.store.deskContent(x.w.token, { kind: 'note', id });
  assert.equal(content.links.length, 200);
  assert.equal(content.links[199].entry.title, 'Lange Zielnotiz');
  assert.equal(reads, 1);
});
