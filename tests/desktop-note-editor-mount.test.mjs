import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from './helpers/dom.mjs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/note-editor-mount.ts'],
  outfile: '.build/note-editor-mount-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { mountNoteEditor } = createRequire(import.meta.url)('../.build/note-editor-mount-test.cjs');
function fixture(t) {
  const { document, window } = parseHTML(
      '<html><body><section id=home><div id=preparation-problems></div><div id=note-editor><button id=note-back></button><textarea id=note-gm></textarea></div><button id=preparation-apply></button><button id=preparation-reconcile></button><button id=preparation-refresh></button></section><section id=outer></section><section id=inner></section></body></html>',
    ),
    prior = globalThis.document;
  globalThis.document = document;
  const el = (id) => document.getElementById(id),
    releases = [];
  t.after(() => {
    for (const r of releases.reverse()) r();
    globalThis.document = prior;
  });
  return {
    el,
    window,
    document,
    lease: (host, retire) => {
      const release = mountNoteEditor(el(host), retire);
      releases.push(release);
      return release;
    },
  };
}
test('nested room and collection contexts return the identical live editor to each caller in reverse order', (t) => {
  const x = fixture(t),
    editor = x.el('note-editor'),
    field = x.el('note-gm');
  let input = 0;
  field.addEventListener('input', () => input++);
  field.value = 'Spätere Eingabe';
  const outer = x.lease('outer', () => {}),
    inner = x.lease('inner', () => {});
  assert(x.el('inner').contains(editor));
  field.dispatchEvent(new x.window.Event('input'));
  assert.equal(input, 1);
  inner();
  assert(x.el('outer').contains(editor));
  assert.equal(x.el('note-back').hidden, true);
  outer();
  assert(x.el('home').contains(editor));
  assert.equal(x.el('note-back').hidden, false);
  assert.equal(field.value, 'Spätere Eingabe');
  assert.equal(x.document.querySelectorAll('#note-editor').length, 1);
});
test('retiring an outer context revokes its borrower before restoring Preparation and old releases cannot move a newer editor', (t) => {
  const x = fixture(t);
  let retire = 0;
  const outer = x.lease('outer', () => {}),
    inner = x.lease('inner', () => {
      retire++;
    });
  outer();
  assert.equal(retire, 1);
  assert(x.el('home').contains(x.el('note-editor')));
  const next = x.lease('inner', () => {});
  inner();
  outer();
  assert(x.el('inner').contains(x.el('note-editor')));
  next();
  assert(x.el('home').contains(x.el('note-editor')));
});
test('a borrower that restores itself during retirement does not retire another owner or duplicate controls', (t) => {
  const x = fixture(t);
  const outer = x.lease('outer', () => {});
  let inner;
  inner = x.lease('inner', () => inner());
  outer();
  assert(x.el('home').contains(x.el('note-editor')));
  assert.equal(x.el('note-back').hidden, false);
  assert.equal(x.document.querySelectorAll('#preparation-apply').length, 1);
});
