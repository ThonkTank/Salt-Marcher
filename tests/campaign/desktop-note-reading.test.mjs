import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from '../helpers/dom.mjs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/shared/markdown-view';export * from './src/app/shared/literal-text-edit';",
    resolveDir: process.cwd(),
    sourcefile: 'note-reading.ts',
  },
  outfile: '.build/note-reading-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { markdownView, preserveLiteralEdit } = createRequire(import.meta.url)(
  '../../.build/note-reading-test.cjs',
);
const source =
  '# Glockentor\n\n## Dritter Schlag\n\n| Signal | Reaktion |\n| --- | --- |\n| Drei | **Nera** öffnet das Tor. |\n\n- [ ] Liste prüfen\n- [x] Zeichen erkannt\n\n> Nicht vorlesen.\n';
function document(t) {
  const prior = globalThis.document,
    { document } = parseHTML('<html><body></body></html>');
  globalThis.document = document;
  t.after(() => (globalThis.document = prior));
  return document;
}
test('structured notes retain headings, associated table columns, lists and passive task state', (t) => {
  document(t);
  const view = markdownView(source, 4);
  assert.equal(view.querySelector('h5').textContent, 'Glockentor');
  assert.equal(view.querySelector('h6').textContent, 'Dritter Schlag');
  assert.deepEqual(
    [...view.querySelectorAll('th')].map((x) => x.textContent),
    ['Signal', 'Reaktion'],
  );
  assert.deepEqual(
    [...view.querySelectorAll('td')].map((x) => x.textContent),
    ['Drei', 'Nera öffnet das Tor.'],
  );
  assert.equal(view.querySelector('td strong').textContent, 'Nera');
  assert.equal(view.querySelector('blockquote').textContent.trim(), 'Nicht vorlesen.');
  const boxes = [...view.querySelectorAll('input')];
  assert.equal(boxes.length, 2);
  assert(boxes.every((b) => b.disabled));
  assert.equal(boxes[0].checked, false);
  assert.equal(boxes[1].checked, true);
});
test('HTML, events, images and executable links remain passive source text without resource nodes', (t) => {
  document(t);
  const view = markdownView(
    '<script>window.bad=1</script>\n\n<img src="https://outside.invalid/x" onerror="window.bad=2">\n\n[x](javascript:alert(1))\n\n![Karte](https://outside.invalid/map.png)',
  );
  assert.equal(view.querySelectorAll('script,img,iframe,a,object,embed,style,link').length, 0);
  assert.match(view.textContent, /window.bad=1/);
  assert.match(view.textContent, /Karte/);
  assert.equal(view.querySelectorAll('[onerror]').length, 0);
});
test('entities become literal characters once; code and escaped references stay literal', (t) => {
  document(t);
  const view = markdownView(
    '**A &amp; B &#x1f4a1;**\n\n`[Nera](dungeon-ref:note/id)`\n\n```html\n<script>literal</script>\n```\n\n[Nera](dungeon-ref:note/id)',
  );
  assert.equal(view.querySelector('strong').textContent, 'A & B 💡');
  assert.equal(view.querySelector('code').textContent, '[Nera](dungeon-ref:note/id)');
  assert.equal(view.querySelector('pre code').textContent, '<script>literal</script>');
  assert.equal(view.querySelectorAll('script').length, 0);
  assert(view.textContent.endsWith('Nera\n'));
});
test('plain authored reading text keeps original spacing and line endings', (t) => {
  document(t);
  const raw = '  Die Glocke schlägt.\r\nNicht jetzt.  \r';
  assert.equal(markdownView(raw).textContent, raw);
});
for (const [name, before, next, expected] of [
  [
    'single phrase',
    'Alpha\r\nNera bleibt.\r\nEnde\r\n',
    'Alpha\nNera wartet.\nEnde\n',
    'Alpha\r\nNera wartet.\r\nEnde\r\n',
  ],
  ['unchanged source', 'A\r\nB\rC\n', 'A\nB\nC\n', 'A\r\nB\rC\n'],
  ['mixed surrounding endings', 'A\r\nB\rC\n', 'A\nNeu\nC\n', 'A\r\nNeu\rC\n'],
  ['inserted paragraph', 'A\r\nB\r\n', 'A\nNeu\nB\n', 'A\r\nNeu\r\nB\r\n'],
  ['deleted line break', 'A\r\nB\r\nC', 'AB\nC', 'AB\r\nC'],
  ['Unicode edit', 'Tür 💡\r\nNera\r\n', 'Tür 🔑\nNera\n', 'Tür 🔑\r\nNera\r\n'],
  ['empty replacement', 'A\r\nB', '', ''],
])
  test('a textarea ' + name + ' edit does not normalize unrelated source bytes', () =>
    assert.equal(preserveLiteralEdit(before, next), expected),
  );

test('explicit raw non-DOM input retains its supplied line endings', () =>
  assert.equal(preserveLiteralEdit('Old', 'New\r\nRaw\rText'), 'New\r\nRaw\rText'));
