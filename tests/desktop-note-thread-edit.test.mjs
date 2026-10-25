import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/note-thread-edit.ts', 'src/app/text-references.ts'],
  outdir: '.build/note-thread-edit',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
});
const require = createRequire(import.meta.url),
  {
    detachNoteSource,
    noteSourceLinks,
    restoreNoteSource,
    noteThreadMembers,
  } = require('../.build/note-thread-edit/note-thread-edit.cjs'),
  { referenceMarkdown, textReferences } = require('../.build/note-thread-edit/text-references.cjs');
const make = () => ({
  version: 1,
  id: 'overview',
  revision: 7,
  title: 'Übersicht',
  kind: 'quest',
  readAloud: '',
  gmNotes: '',
  relations: [],
  creatureId: null,
  deleted: false,
});

test('unlinking one source retains prose, CRLF, literal examples and every other relationship', () => {
  const link = referenceMarkdown({ kind: 'note', id: 'target' }, 'Nera'),
    other = referenceMarkdown({ kind: 'note', id: 'other' }, 'Nera');
  const root = {
      ...make(),
      readAloud: '  ' + link + ' bleibt im Satz.\r\n',
      gmNotes:
        'Vor ' +
        link +
        ' und ' +
        other +
        '.\r\n`' +
        link +
        '`\r\n\r\n```md\r\n' +
        link +
        '\r\n```\r\n!' +
        link +
        '\r\n\\' +
        link +
        '\r\n',
      relations: [
        { targetId: 'target', label: 'Quelle' },
        { targetId: 'other', label: 'Quelle' },
        { targetId: 'target', label: 'kennt' },
      ],
    },
    before = structuredClone(root);
  const r = detachNoteSource(root, 'target');
  assert.equal(r.readAloud, 1);
  assert.equal(r.gmNotes, 1);
  assert.deepEqual(r.relationships, ['Quelle', 'kennt']);
  assert.equal(r.note.readAloud, '  Nera bleibt im Satz.\r\n');
  assert.equal(r.note.gmNotes, root.gmNotes.replace(link, 'Nera'));
  assert.deepEqual(r.note.relations, [{ targetId: 'other', label: 'Quelle' }]);
  assert.equal(r.note.revision, 7);
  assert.deepEqual(root, before);
  assert.deepEqual(
    textReferences(r.note.gmNotes).map((r) => r.ref.id),
    ['other'],
  );
});

test('a removed label cannot turn into a different active link and escaped text remains escaped', () => {
  const label = referenceMarkdown({ kind: 'note', id: 'unrelated' }, 'Andere Figur'),
    outer = referenceMarkdown({ kind: 'note', id: 'target' }, label),
    root = { ...make(), gmNotes: outer };
  const r = detachNoteSource(root, 'target');
  assert.equal(r.gmNotes, 1);
  assert.deepEqual(textReferences(r.note.gmNotes), []);
  assert.equal(r.note.gmNotes, '\\[Andere Figur\\](dungeon-ref:note/unrelated)');
});

test('all occurrences are unlinked beyond a reading page while same-name other identities stay linked', () => {
  const link = referenceMarkdown({ kind: 'note', id: 'target/älter' }, 'Nera'),
    other = referenceMarkdown({ kind: 'note', id: 'other' }, 'Nera');
  const root = { ...make(), gmNotes: Array(230).fill(link).join('\r\n') + '\r\n' + other };
  const r = detachNoteSource(root, 'target/älter');
  assert.equal(r.gmNotes, 230);
  assert.deepEqual(
    textReferences(r.note.gmNotes).map((r) => r.ref.id),
    ['other'],
  );
  assert.equal(r.note.gmNotes.split('\r\n').length, 231);
  assert.deepEqual(detachNoteSource(root, 'missing').note, root);
});

test('all preview counts share one document projection and preserve the family-pair boundary', () => {
  const link = referenceMarkdown({ kind: 'note', id: 'target' }, 'Nera'),
    root = {
      ...make(),
      kind: 'npc',
      readAloud: link,
      gmNotes: link + ' ' + link + ' `' + link + '`',
      relations: [
        { targetId: 'target', label: 'Partner', familyKind: 'partner' },
        { targetId: 'other', label: 'Quelle' },
      ],
    },
    before = structuredClone(root);
  const sources = noteSourceLinks(root);
  assert.deepEqual(sources.get('target'), {
    relationships: ['Partner'],
    readAloud: 1,
    gmNotes: 2,
    family: true,
  });
  assert.deepEqual(sources.get('other'), {
    relationships: ['Quelle'],
    readAloud: 0,
    gmNotes: 0,
    family: false,
  });
  assert.throws(() => detachNoteSource(root, 'target'), /vollständiges Paar/);
  assert.deepEqual(root, before);
});

test('selective recovery retains later title, adjacent prose, CRLF, new relationships and literal examples', () => {
  const link = referenceMarkdown({ kind: 'note', id: 'target' }, 'Nera'),
    before = {
      ...make(),
      readAloud: '  ' + link + ' wartet.\r\n',
      gmNotes: 'Altes Ziel.\r\nEin Verweis auf ' + link + '.\r\n`' + link + '`\r\n',
      relations: [
        { targetId: 'target', label: 'Quelle' },
        { targetId: 'other', label: 'Quelle' },
        { targetId: 'target', label: 'kennt' },
      ],
    };
  const after = { ...detachNoteSource(before, 'target').note, revision: 8 },
    current = {
      ...after,
      title: 'Neu',
      revision: 10,
      readAloud: after.readAloud + 'Später.\r\n',
      gmNotes: after.gmNotes.replace('Altes Ziel.', 'Neues Ziel.') + 'Neue Tatsache.\r\n',
      relations: [...after.relations, { targetId: 'new', label: 'Neue Quelle' }],
    },
    snapshot = structuredClone(current);
  const restored = restoreNoteSource(current, {
    id: 'H',
    sourceId: 'target',
    title: 'Nera',
    before,
    after,
  });
  assert.equal(restored.title, 'Neu');
  assert.equal(restored.revision, 10);
  assert.equal(restored.readAloud, before.readAloud + 'Später.\r\n');
  assert.equal(
    restored.gmNotes,
    before.gmNotes.replace('Altes Ziel.', 'Neues Ziel.') + 'Neue Tatsache.\r\n',
  );
  assert.deepEqual(noteSourceLinks(restored).get('target'), {
    relationships: ['Quelle', 'kennt'],
    readAloud: 1,
    gmNotes: 1,
    family: false,
  });
  assert.equal(restored.relations[1].targetId, 'new');
  assert.deepEqual(current, snapshot);
  assert.throws(
    () => restoreNoteSource(restored, { sourceId: 'target', before, after }),
    /bereits verknüpft/,
  );
});
test('changed, ambiguous or newly fenced target passages fail without mutating any input', () => {
  const link = referenceMarkdown({ kind: 'note', id: 'target' }, 'Nera'),
    before = { ...make(), gmNotes: link + ' wartet.\n' },
    after = detachNoteSource(before, 'target').note,
    recovery = { id: 'H', sourceId: 'target', title: 'Nera', before, after };
  for (const gmNotes of [
    'Nera ist gegangen.\n',
    after.gmNotes + after.gmNotes,
    '```md\n' + after.gmNotes + '```\n',
  ]) {
    const current = { ...after, gmNotes },
      snapshot = structuredClone(current);
    assert.throws(() => restoreNoteSource(current, recovery), /geändert|mehrdeutig/);
    assert.deepEqual(current, snapshot);
  }
  assert.throws(
    () => restoreNoteSource(after, { ...recovery, after: { ...after, title: 'falsche Änderung' } }),
    /widersprüchlich/,
  );
});

test('canonical member order excludes self and literal links while retaining labels and text-source order', () => {
  const root = {
      ...make(),
      relations: [
        { targetId: 'overview', label: 'Selbst' },
        { targetId: 'B', label: 'kennt' },
        { targetId: 'A', label: 'Quelle' },
        { targetId: 'B', label: 'kennt' },
      ],
      readAloud: '[C](dungeon-ref:note/C) [B](dungeon-ref:note/B)',
      gmNotes:
        '[Selbst](dungeon-ref:note/overview) [D](dungeon-ref:note/D) `[Code](dungeon-ref:note/ignored)` [Ort](dungeon-ref:location/place)',
    },
    before = structuredClone(root);
  assert.deepEqual(
    [...noteThreadMembers(root)],
    [
      ['B', ['kennt', 'Textverweis: B']],
      ['A', ['Quelle']],
      ['C', ['Textverweis: C']],
      ['D', ['Textverweis: D']],
    ],
  );
  assert.deepEqual(root, before);
});
