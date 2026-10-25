import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-choice-search-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/note-choice-search-store.cjs');
function fixture(t, count = 1) {
  const dir = mkdtempSync(path.join(tmpdir(), 'note-choice-')),
    store = new CampaignStore(path.join(dir, 'db.sqlite')),
    campaign = store.create('Notizen'),
    w = store.activate(campaign.id),
    notes = Array.from({ length: count }, (_, i) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'rumor',
      title: 'Spur ' + String(i).padStart(3, '0'),
      readAloud: i === 0 ? 'Eine alte Tür.' : '',
      gmNotes:
        i === 0
          ? '  Nächtliche Wächter prüfen den Lastenaufzug.\r\nZwei Glocken.  '
          : 'Am Nordtor steht ein Bote.',
      relations: [],
      creatureId: null,
      deleted: false,
    }));
  for (const note of notes)
    store.changePreparation({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      change: { kind: 'note', expectedRevision: null, note },
    });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, campaign, w, notes };
}
test('note-only search finds prose and returns bounded literal evidence without rewriting authored data', (t) => {
  const x = fixture(t, 2),
    before = x.store.db.serialize(),
    r = x.store.searchDesk(x.w.token, 'note', 'Lastenaufzug', 0);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].ref.id, x.notes[0].id);
  assert(r.entries[0].preview.parts.some((p) => p.matched && p.text === 'Lastenaufzug'));
  assert(r.entries[0].preview.parts.map((p) => p.text).join('').length < 240);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('search supports Unicode case folding, multiple terms and quoted contiguous phrases', (t) => {
  const x = fixture(t, 2);
  for (const q of ['NÄCHTLICHE WÄCHTER', 'Lastenaufzug Glocken', '"Wächter prüfen"'])
    assert.equal(x.store.searchDesk(x.w.token, 'note', q, 0).entries[0].ref.id, x.notes[0].id);
  assert.equal(x.store.searchDesk(x.w.token, 'note', '"Glocken Wächter"', 0).entries.length, 0);
});
test('note candidates page at forty and retain distinct note identities', (t) => {
  const x = fixture(t, 82),
    first = x.store.searchDesk(x.w.token, 'note', '', 0),
    second = x.store.searchDesk(x.w.token, 'note', '', 40),
    third = x.store.searchDesk(x.w.token, 'note', '', 80);
  assert.equal(first.entries.length, 40);
  assert.equal(second.entries.length, 40);
  assert.equal(third.entries.length, 2);
  assert.equal(first.next, 40);
  assert.equal(second.next, 80);
  assert.equal(third.next, null);
  assert.equal(
    new Set([...first.entries, ...second.entries, ...third.entries].map((e) => e.ref.id)).size,
    82,
  );
});
test('damaged matching sources remain explicit and cannot masquerade as selectable notes', (t) => {
  const x = fixture(t);
  x.store.db.prepare("UPDATE world_note SET checksum='broken' WHERE id=?").run(x.notes[0].id);
  const before = x.store.db.serialize(),
    r = x.store.searchDesk(x.w.token, 'note', 'Lastenaufzug', 0);
  assert.equal(r.entries[0].unavailable, true);
  assert.match(r.notice, /beschädigt/);
  assert.equal(r.entries[0].preview, undefined);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('trash and other campaigns are excluded and obsolete activation cannot search', (t) => {
  const x = fixture(t, 2);
  x.store.changePreparation({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.campaign.id,
    change: { kind: 'note-trash', id: x.notes[0].id, expectedRevision: 1, trashed: true },
  });
  assert.equal(x.store.searchDesk(x.w.token, 'note', 'Lastenaufzug', 0).entries.length, 0);
  const b = x.store.activate(x.store.create('Andere').id);
  assert.equal(x.store.searchDesk(b.token, 'note', '', 0).entries.length, 0);
  assert.throws(() => x.store.searchDesk(x.w.token, 'note', '', 0));
});
test('invalid queries and offsets do not change storage', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  for (const [q, o] of [
    ['', -1],
    ['', 1.2],
    ['', 1000001],
    ['x'.repeat(1001), 0],
  ])
    assert.throws(() => x.store.searchDesk(x.w.token, 'note', q, o));
  assert.deepEqual(x.store.db.serialize(), before);
});
test('pasted titles with punctuation separators find the same original in World and source search', (t) => {
  const x = fixture(t),
    n = x.notes[0];
  x.store.changePreparation({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.campaign.id,
    change: {
      kind: 'note',
      expectedRevision: 1,
      note: { ...n, title: 'Das Glockentor · Einsatznotizen' },
    },
  });
  const before = x.store.db.serialize();
  for (const query of [
    'Das Glockentor · Einsatznotizen',
    'Das Glockentor – Einsatznotizen',
    '"Das Glockentor · Einsatznotizen"',
  ]) {
    assert.equal(x.store.searchDesk(x.w.token, 'note', query, 0).entries[0].ref.id, n.id);
    assert.equal(x.store.preparation(x.w.token, query).notes[0].note.id, n.id);
  }
  assert.equal(x.store.searchDesk(x.w.token, 'note', '···', 0).entries.length, 0);
  assert.deepEqual(x.store.db.serialize(), before);
});

// One prose-matching non-rule sorts before all rules; extra non-matching notes do not exercise this query.
test('rule candidates use the same bounded prose search and filter before paging', (t) => {
  const x = fixture(t),
    rules = [];
  for (let i = 0; i < 45; i++) {
    const note = {
      ...x.notes[0],
      id: randomUUID(),
      kind: 'rule',
      title: 'Z Regel ' + String(i).padStart(2, '0'),
    };
    rules.push(note);
    x.store.changePreparation({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      change: { kind: 'note', expectedRevision: null, note },
    });
  }
  const before = x.store.db.serialize(),
    first = x.store.searchDesk(x.w.token, 'rule', 'Lastenaufzug', 0),
    second = x.store.searchDesk(x.w.token, 'rule', 'Lastenaufzug', 40);
  assert.equal(first.entries.length, 40);
  assert.equal(first.next, 40);
  assert.equal(second.entries.length, 5);
  assert.equal(second.next, null);
  assert.deepEqual(
    new Set([...first.entries, ...second.entries].map((e) => e.ref.id)),
    new Set(rules.map((n) => n.id)),
  );
  assert.deepEqual(x.store.db.serialize(), before);
});
