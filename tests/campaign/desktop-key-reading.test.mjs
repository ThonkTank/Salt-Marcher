import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';
for (const [name, entry] of [
  ['model', 'campaign/key-reading-model'],
  ['ui', 'campaign/key-document-ui'],
])
  buildSync({
    entryPoints: ['src/app/' + entry + '.ts'],
    outfile: '.build/key-reading-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
const require = createRequire(import.meta.url),
  {
    keyDocumentParts,
    keyDocumentSources,
    editTextareaText,
  } = require('../../.build/key-reading-model.cjs'),
  { KeyDocumentReader } = require('../../.build/key-reading-ui.cjs');
const source = (text, id = 'source', target = true) => ({
  id,
  text,
  label: 'Vorhandener Raumkey',
  visibility: 'gm',
  target: target ? { kind: 'legacy', sectionId: 'section', expectedText: text } : null,
});
test('headings retain exact source offsets through CRLF, setext and code fences', () => {
  const raw =
    '# Titel\r\n\r\nText.\r\n\r\nUntertitel\r\n-----------\r\n\r\n```md\r\n## Kein Titel\r\n```\r\n\r\n## Finale ##\r\nEnde.';
  const { parts } = keyDocumentParts(source(raw));
  assert.deepEqual(
    parts.filter((p) => p.level).map((p) => p.text),
    ['Titel', 'Untertitel', 'Finale'],
  );
  for (const p of parts) assert.equal(raw.slice(p.start, p.end), p.text);
  assert(parts.some((p) => p.text.includes('## Kein Titel') && !p.level));
});
test('large documents retain the complete tail while bounding their outline projection', () => {
  const raw = Array.from({ length: 5000 }, (_, i) => 'Absatz ' + i).join('\n\n'),
    parsed = keyDocumentParts(source(raw));
  assert.equal(parsed.limited, true);
  assert(parsed.parts.length <= 2001);
  assert(parsed.parts.at(-1).text.endsWith('Absatz 4999'));
  for (let i = 1; i < parsed.parts.length; i++)
    assert(parsed.parts[i].start >= parsed.parts[i - 1].end);
});
test('textarea edits retain untouched mixed newline spans and the raw no-op bytes', () => {
  const raw = '  Anfang\r\n\nHier liegt der Hebel.\r\nEnde\rRest  ';
  assert.equal(editTextareaText(raw, raw.replace(/\r\n?/g, '\n')), raw);
  assert.equal(
    editTextareaText(raw, raw.replace(/\r\n?/g, '\n').replace('liegt', 'ruht')),
    raw.replace('liegt', 'ruht'),
  );
  assert.equal(editTextareaText(raw, ''), '');
});
test('read projections distinguish imported sections, own blocks, templates and generated prose', () => {
  const room = {
      id: 'room',
      scopeId: 'local',
      sections: [
        { id: 'a', kind: 'markdown', markdown: '# Alter Key' },
        { id: 'b', kind: 'markdown', markdown: '  Zweiter\r\n' },
      ],
    },
    block = (id, kind, text = '', extra = {}) => ({ id, kind, text, ...extra }),
    template = {
      id: 'template',
      scopeId: 'local',
      kind: 'template',
      name: 'Wache',
      blocks: [block('child', 'text', 'Vorlagenwort')],
    },
    key = {
      id: 'room',
      scopeId: 'local',
      kind: 'room',
      blocks: [
        block('legacy', 'legacy'),
        block('own', 'text', 'Eigener Text'),
        block('link', 'template', '', { templateId: 'template' }),
      ],
    };
  buildSync({
    entryPoints: ['src/app/campaign/key-model.ts'],
    outfile: '.build/key-reading-provenance.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
  const { templateBlockId } = require('../../.build/key-reading-provenance.cjs');
  const rendered = {
      blocks: [
        { id: 'legacy', text: '# Alter Key\n\n  Zweiter\r\n', visibility: 'gm' },
        { id: 'own', text: 'Eigener Text', visibility: 'gm' },
        { id: templateBlockId('link', 'child'), text: 'Vorlagenwort', visibility: 'public' },
        { id: 'geometry', text: '6 Meter', visibility: 'public' },
      ],
    },
    before = JSON.stringify([room, key, template, rendered]),
    rows = keyDocumentSources(room, [key, template], rendered);
  assert.deepEqual(
    rows.slice(0, 2).map((s) => s.target.sectionId),
    ['a', 'b'],
  );
  assert.equal(rows[2].target.ownerId, 'room');
  assert.equal(rows[3].target.ownerId, 'template');
  assert.equal(rows[3].target.blockId, 'child');
  assert.equal(rows[4].target, null);
  assert.equal(JSON.stringify([room, key, template, rendered]), before);
});
function fixture(t, sources, query = 'Hebel') {
  const { document, window } = parseHTML(
      '<html><body><section id="reader"></section></body></html>',
    ),
    prior = globalThis.document;
  globalThis.document = document;
  let focused = null;
  window.HTMLElement.prototype.focus = function () {
    focused = this;
  };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  let current = true;
  const edits = [],
    host = document.getElementById('reader'),
    reader = new KeyDocumentReader(
      host,
      sources,
      query,
      () => current,
      (target, bookmark) => edits.push({ target, bookmark }),
    );
  reader.start();
  t.after(() => {
    host.remove();
    globalThis.document = prior;
  });
  return {
    reader,
    host,
    edits,
    setCurrent: (v) => (current = v),
    focused: () => focused,
    el: (id) => document.getElementById(id),
    window,
  };
}
test('all paragraph matches are navigable and editing carries the exact source range', (t) => {
  const text =
      '# Auftakt\n\nHebel Skizze.\n\n## Auslösefolge\n\nDer Hebel ist bereit.\n\n## Wartung\n\nHebel ölen.',
    x = fixture(t, [source(text)]);
  assert.equal(x.host.querySelectorAll('mark').length, 3);
  x.el('key-document-next').click();
  assert.match(x.host.querySelector('mark.active').parentElement.textContent, /ist bereit/);
  x.el('key-document-edit').click();
  assert.equal(x.edits.length, 1);
  const { target } = x.edits[0];
  assert.equal(target.expectedText.slice(target.start, target.end), 'Der Hebel ist bereit.');
  assert.equal(x.reader.bookmark().sourceId, 'source');
});
test('literal search and safe text nodes do not interpret regex syntax or author HTML', (t) => {
  const x = fixture(t, [source('# <img src=x>\n\nHier [x]. und x?.')], '[x].');
  assert.equal(x.host.querySelectorAll('mark').length, 1);
  assert.equal(x.host.querySelector('mark').textContent, '[x].');
  assert.equal(x.host.querySelector('img'), null);
});
test('a returned bookmark restores the same source paragraph after its text changed', (t) => {
  const x = fixture(t, [source('Hebel eins.\n\nHebel zwei.\n\nHebel drei.')]);
  x.el('key-document-next').click();
  const bookmark = x.reader.bookmark();
  x.host.replaceChildren();
  const updated = new KeyDocumentReader(
    x.host,
    [source('Hebel eins.\n\nHebel zwei ist gesichert.\n\nHebel drei.')],
    '',
    () => true,
    () => {},
  );
  updated.start(bookmark);
  assert.match(x.host.querySelector('mark.active').parentElement.textContent, /zwei ist gesichert/);
  assert.equal(x.focused(), x.host.querySelector('mark.active'));
});
test('generated text stays searchable without exposing an impossible source edit', (t) => {
  const x = fixture(t, [source('Hebel aus Geometrie', 'generated', false)]);
  assert.equal(x.host.querySelectorAll('mark').length, 1);
  assert.equal(x.el('key-document-edit').disabled, true);
});
test('a detached or retired reader cannot invoke an editor or steal focus', (t) => {
  const x = fixture(t, [source('Hebel eins.\n\nHebel zwei.')]),
    edit = x.el('key-document-edit'),
    next = x.el('key-document-next');
  x.setCurrent(false);
  edit.onclick();
  next.onclick();
  assert.equal(x.edits.length, 0);
  x.setCurrent(true);
  x.host.remove();
  edit.onclick();
  next.onclick();
  assert.equal(x.edits.length, 0);
});
test('no match does not enable a misleading edit of the first paragraph', (t) => {
  const x = fixture(t, [source('Nur eine Beschreibung.')], 'Hebel');
  assert.match(x.el('key-document-match-count').textContent, /Keine Fundstelle/);
  assert.equal(x.el('key-document-edit').disabled, true);
  assert.equal(x.el('key-document-next').disabled, true);
  assert.equal(x.el('key-document-prev').disabled, true);
});
test('match navigation is bounded and discloses when additional occurrences exist', (t) => {
  const x = fixture(t, [source('Hebel '.repeat(1000))]);
  assert.equal(x.host.querySelectorAll('mark').length, 200);
  assert.match(x.el('key-document-match-count').textContent, /200/);
  assert(x.host.textContent.includes('Hebel '.repeat(100)));
  x.el('key-document-prev').click();
  assert.match(x.el('key-document-match-count').textContent, /200 \//);
});

test('private discovery guidance and confirmed-knowledge labels remain in the GM reading projection', () => {
  const room = { id: 'room', scopeId: 'local', sections: [] },
    rendered = {
      blocks: [
        {
          id: 'secret',
          text: 'Verborgener Mechanismus',
          visibility: 'secret',
          searchMethod: 'Unter dem Hebel tasten',
          dc: 12,
          discoveryNotes: 'Nur bei gutem Licht',
        },
      ],
    };
  const sources = keyDocumentSources(room, [], rendered, new Set(['secret']));
  assert.match(sources[0].label, /für Gruppe bestätigt/);
  assert.equal(sources[1].visibility, 'secret');
  assert.match(sources[1].text, /Unter dem Hebel tasten · DC 12 · Nur bei gutem Licht/);
  assert.equal(sources[1].target, null);
});

test('repeated Enter and Shift+Enter navigate without taking focus away from the query', (t) => {
  const x = fixture(t, [source('Hebel eins.\n\nHebel zwei.\n\nHebel drei.')]),
    input = x.el('key-document-search');
  input.focus();
  const enter = (shift) => {
    const event = new x.window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(event, { key: 'Enter', shiftKey: shift, isComposing: false });
    input.dispatchEvent(event);
  };
  enter(false);
  assert.match(x.host.querySelector('mark.active').parentElement.textContent, /zwei/);
  enter(false);
  assert.match(x.host.querySelector('mark.active').parentElement.textContent, /drei/);
  enter(true);
  assert.match(x.host.querySelector('mark.active').parentElement.textContent, /zwei/);
  assert.equal(x.focused(), input);
});

test('return keeps the edited paragraph even when it no longer contains the search word', (t) => {
  const x = fixture(t, [source('Hebel eins.\n\nHebel zwei.\n\nHebel drei.')]);
  x.el('key-document-next').click();
  const bookmark = x.reader.bookmark();
  x.host.replaceChildren();
  const reader = new KeyDocumentReader(
    x.host,
    [source('Hebel eins.\n\nSchalter zwei ist gesichert.\n\nHebel drei.')],
    '',
    () => true,
    () => {},
  );
  reader.start(bookmark);
  assert.match(x.focused().textContent, /Schalter zwei/);
  assert.match(x.el('key-document-match-count').textContent, /Lesestelle/);
  assert.equal(x.host.querySelector('mark.active'), null);
  x.el('key-document-next').click();
  assert.match(x.host.querySelector('mark.active').parentElement.textContent, /eins/);
});
