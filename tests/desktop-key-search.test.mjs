import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/key-search.ts'],
  outfile: '.build/key-search.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { RoomKeySearchIndex } = require('../.build/key-search.cjs');
const block = (id, text, extra = {}) => ({
  id,
  kind: 'text',
  visibility: 'gm',
  text,
  templateId: null,
  suppressed: [],
  searchMethod: '',
  dc: null,
  discoveryNotes: '',
  revealedText: '',
  ...extra,
});
const room = (id = 'room', scopeId = 'dungeon') => ({
  id,
  scopeId,
  number: '12',
  name: 'Wachstube',
  sections: [{ kind: 'markdown', markdown: '  Alter Raumkey\r\nmit Originalwortlaut.' }],
});
const key = (id, kind = 'room', extra = {}) => ({
  id,
  kind,
  scopeId: 'dungeon',
  revision: 0,
  name: id,
  levelId: null,
  groupId: null,
  zSteps: [],
  attributes: {},
  blocks: [],
  tags: [],
  secret: false,
  status: '',
  references: [],
  ...extra,
});

test('room search finds template prose and discovery details at the room with its source', () => {
  const template = key('template', 'template', {
    name: 'Wachposten',
    blocks: [
      block('secret', 'Ein Bronzeschlüssel liegt in der Schublade.', {
        visibility: 'secret',
        searchMethod: 'Genau untersuchen',
        discoveryNotes: 'Nur Nera kennt das Versteck.',
        revealedText: 'Die goldene Schublade ist geöffnet.',
      }),
    ],
  });
  const records = [
      template,
      key('room', 'room', {
        blocks: [block('link', '', { kind: 'template', templateId: template.id })],
      }),
    ],
    original = structuredClone(records),
    r = room(),
    index = new RoomKeySearchIndex(records);
  assert.deepEqual(index.find(r, '  BRONZESCHLÜSSEL  '), {
    label: 'Vorlage · Wachposten',
    excerpt: 'Ein Bronzeschlüssel liegt in der Schublade.',
  });
  for (const q of ['Wachposten', 'Genau untersuchen', 'Nera', 'goldene Schublade'])
    assert(index.find(r, q), q);
  assert.equal(index.find(room('unrelated'), 'Bronzeschlüssel'), null);
  assert.deepEqual(records, original);
});

test('search uses current typed reference labels and preserves unavailable reference wording', () => {
  const records = [
    key('room', 'room', {
      references: [
        { kind: 'npc', id: 'nera', label: 'Alter Name' },
        { kind: 'location', id: 'missing', label: 'Verlorene Kapelle' },
      ],
    }),
  ];
  const index = new RoomKeySearchIndex(records, [
      { kind: 'npc', id: 'nera', label: 'Nera die Quartiermeisterin' },
      { kind: 'location', id: 'nera', label: 'Fremdes Ziel mit gleicher Kennung' },
    ]),
    r = room();
  assert.deepEqual(index.find(r, 'Nera'), {
    label: 'Verweis',
    excerpt: 'Nera die Quartiermeisterin',
  });
  assert.equal(index.find(r, 'Alter Name'), null);
  assert.equal(index.find(r, 'Fremdes Ziel'), null);
  assert(index.find(r, 'Verlorene Kapelle'));
});

test('effective inherited properties honor overrides and suppression', () => {
  const records = [
      key('dungeon', 'dungeon', {
        name: 'Alte Garnison',
        attributes: { Material: 'Basalt', Geruch: 'Ozon', Farbe: 'Purpur' },
      }),
      key('room', 'room', { attributes: { Geruch: 'Staub', Farbe: null } }),
    ],
    index = new RoomKeySearchIndex(records),
    r = room();
  assert.deepEqual(index.find(r, 'Basalt'), {
    label: 'Eigenschaft · Alte Garnison',
    excerpt: 'Material: Basalt',
  });
  assert(index.find(r, 'Staub'));
  assert.equal(index.find(r, 'Ozon'), null);
  assert.equal(index.find(r, 'Purpur'), null);
});

test('templates and rooms in other dungeon scopes cannot supply a match', () => {
  const template = key('template', 'template', {
      scopeId: 'other',
      blocks: [block('secret', 'Fremdes Geheimnis')],
    }),
    records = [
      template,
      key('room', 'room', {
        blocks: [block('link', '', { kind: 'template', templateId: template.id })],
      }),
    ],
    index = new RoomKeySearchIndex(records);
  assert.equal(index.find(room(), 'Fremdes Geheimnis'), null);
  assert.equal(index.find(room('room', 'other'), 'Vorlage fehlt'), null);
});

test('a replacement snapshot immediately reflects changed templates', () => {
  const records = [
      key('template', 'template', { blocks: [block('text', 'Bronzeschlüssel')] }),
      key('room', 'room', {
        blocks: [block('link', '', { kind: 'template', templateId: 'template' })],
      }),
    ],
    r = room(),
    old = new RoomKeySearchIndex(records);
  assert(old.find(r, 'Bronzeschlüssel'));
  const changed = structuredClone(records);
  changed[0].blocks[0].text = 'Eisenschlüssel';
  const fresh = new RoomKeySearchIndex(changed);
  assert.equal(fresh.find(r, 'Bronzeschlüssel'), null);
  assert(fresh.find(r, 'Eisenschlüssel'));
});

test('legacy prose, tags and status remain searchable and long matches have bounded context', () => {
  const r = room(),
    index = new RoomKeySearchIndex([
      key('room', 'room', {
        tags: ['Wache'],
        status: 'ready',
        blocks: [block('long', 'a'.repeat(1000) + ' Nischenfund ' + 'b'.repeat(1000))],
      }),
    ]);
  for (const q of ['12', 'Wachstube', 'Raumkey mit', 'Wache', 'ready']) assert(index.find(r, q), q);
  const hit = index.find(r, 'Nischenfund');
  assert(hit.excerpt.length < 150);
  assert(hit.excerpt.includes('Nischenfund'));
  assert(hit.excerpt.startsWith('…'));
  assert(hit.excerpt.endsWith('…'));
  assert.deepEqual(index.find(r, ''), { label: '', excerpt: '' });
  assert.equal(index.find(r, 'unbekannt'), null);
});
