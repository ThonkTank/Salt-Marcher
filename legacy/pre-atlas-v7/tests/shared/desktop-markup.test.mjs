import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseHTML } from '../helpers/dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';

function fixture(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'workspace-markup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, 'src/app', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

test('nested fragments retain ordering, form values, and literal text', (t) => {
  const root = fixture(t, {
    'workspace/index.html':
      '<!doctype html><html><body>Before<!-- workspace:include ../runtime/panel.html -->After</body></html>',
    'runtime/panel.html': '<form id="f"><!-- workspace:include input.html --></form>\n',
    'runtime/input.html':
      '<textarea name="prose">  first\nsecond  </textarea><input value="&lt;x&gt;">',
  });
  const html = readWorkspaceMarkup(root);
  assert.doesNotMatch(html, /workspace:include/);
  const { document } = parseHTML(html);
  assert.equal(document.querySelector('textarea').value, '  first\nsecond  ');
  assert.equal(document.querySelector('input').value, '<x>');
  assert.equal(document.body.firstChild.textContent, 'Before');
  assert.equal(document.body.lastChild.textContent, 'After');
});

for (const [name, marker, files, message] of [
  ['missing file', '../runtime/missing.html', {}, /cannot read workspace fragment/],
  ['cycle', 'index.html', {}, /cyclic/],
  ['escape', '../../../outside.html', {}, /inside src\/app/],
  ['URL', 'https://example.test/panel.html', {}, /relative local/],
  ['wrong type', 'panel.txt', {}, /expected an HTML/],
  [
    'nested missing file',
    'panel.html',
    { 'workspace/panel.html': '<!-- workspace:include missing.html -->' },
    /panel.html:1.*cannot read/,
  ],
]) {
  test(`workspace includes reject ${name} with source context`, (t) => {
    const root = fixture(t, {
      'workspace/index.html': `<!-- workspace:include ${marker} -->`,
      ...files,
    });
    writeFileSync(path.join(root, 'outside.html'), '<p>outside</p>');
    assert.throws(
      () => readWorkspaceMarkup(root),
      (error) => {
        assert.match(error.message, /src\/app\/workspace\/index.html:1/);
        assert.match(error.message, message);
        return true;
      },
    );
  });
}

test('duplicate, malformed, unclosed and symlink includes fail explicitly', (t) => {
  const root = fixture(t, {
    'workspace/index.html':
      '<!-- workspace:include panel.html --><!-- workspace:include panel.html -->',
    'workspace/panel.html': '<p>Panel</p>',
  });
  const entry = path.join(root, 'src/app/workspace/index.html');
  assert.throws(() => readWorkspaceMarkup(root), /duplicate/);
  writeFileSync(entry, '<!-- workspace:unknown panel.html -->');
  assert.throws(() => readWorkspaceMarkup(root), /invalid.*marker/);
  writeFileSync(entry, '<!-- workspace:include panel.html');
  assert.throws(() => readWorkspaceMarkup(root), /Unclosed/);
  writeFileSync(path.join(root, 'outside.html'), '<p>Outside</p>');
  symlinkSync(path.join(root, 'outside.html'), path.join(root, 'src/app/workspace/link.html'));
  writeFileSync(entry, '<!-- workspace:include link.html -->');
  assert.throws(() => readWorkspaceMarkup(root), /inside src\/app/);
});

test('real workspace composes unique controls and keeps the offline document boundary', () => {
  const html = readWorkspaceMarkup();
  assert.doesNotMatch(html, /<!--\s*workspace:/);
  const { document } = parseHTML(html);
  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM IDs');
  for (const id of [
    'atlas',
    'preparation',
    'live',
    'combat-panel',
    'campaign-screen',
    'player-dialog',
    'key-dialog',
  ])
    assert.ok(document.getElementById(id), id);
  assert.equal(document.documentElement.lang, 'de');
  assert.equal(document.querySelector('script').getAttribute('src'), 'renderer.js');
  assert.equal(document.querySelectorAll('script').length, 1);
  assert.match(
    document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
    /default-src 'none'/,
  );
  assert.deepEqual(
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) =>
      node.getAttribute('href'),
    ),
    ['app.css', 'player.css'],
  );
});
