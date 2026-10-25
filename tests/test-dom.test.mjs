import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from './helpers/dom.mjs';

test('indexed DOM lookup follows synchronous replacement, ID edits, moves and detached controls', async () => {
  const { document } = parseHTML(
    '<html><body><main id="root"><p id="a">first</p></main><aside id="other"></aside></body></html>',
  );
  const root = document.getElementById('root'),
    other = document.getElementById('other');
  const check = (...ids) => {
    for (const id of ids)
      assert.equal(
        document.getElementById(id),
        [...document.querySelectorAll('[id]')].find((e) => e.id === id) ?? null,
        id,
      );
  };
  const old = document.getElementById('a');
  root.innerHTML = '<section id="b"><span id="a">replacement</span></section>';
  check('a', 'b');
  assert.notEqual(document.getElementById('a'), old);
  const section = document.getElementById('b');
  section.id = 'renamed';
  check('b', 'renamed');
  section.firstElementChild.removeAttribute('id');
  check('a');
  section.firstElementChild.setAttribute('id', 'a');
  check('a');
  other.append(section);
  check('a', 'renamed');
  section.remove();
  check('a', 'renamed');
  old.id = 'detached';
  check('detached');
  root.append(section);
  check('a', 'renamed');
  root.replaceChildren(old);
  check('a', 'renamed', 'detached');
  await Promise.resolve();
  check('detached', 'root', 'other');
});

test('duplicate IDs keep document order through insertion, reorder, rename and removal', async () => {
  const { document } = parseHTML(
    '<html><body><p id="same">first</p><p id="same">second</p></body></html>',
  );
  const [a, b] = document.querySelectorAll('p');
  assert.equal(document.getElementById('same'), a);
  document.body.prepend(b);
  assert.equal(document.getElementById('same'), b);
  b.id = 'different';
  assert.equal(document.getElementById('same'), a);
  b.id = 'same';
  assert.equal(document.getElementById('same'), b);
  b.remove();
  assert.equal(document.getElementById('same'), a);
  a.remove();
  assert.equal(document.getElementById('same'), null);
  await Promise.resolve();
  assert.equal(document.getElementById('same'), null);
  document.body.innerHTML = '<div id="same">new</div>';
  assert.equal(document.getElementById('same').textContent, 'new');
});

test('fragment insertion, nested removal and repeated mutations agree with a fresh document-order lookup', async () => {
  const { document } = parseHTML('<html><body><main></main></body></html>');
  const host = document.querySelector('main');
  for (let round = 0; round < 30; round++) {
    const fragment = document.createDocumentFragment();
    const parent = document.createElement('section');
    parent.innerHTML = `<i id="a">${round}</i><b id="b"></b>`;
    fragment.append(parent);
    host.append(fragment);
    if (round % 2) host.prepend(parent);
    parent.firstElementChild.id = round % 3 ? 'b' : 'a';
    if (round % 4 === 0 && host.children.length > 1) host.firstElementChild.remove();
    if (round % 5 === 0) await Promise.resolve();
    for (const id of ['a', 'b', 'absent']) {
      assert.ok(
        document.getElementById(id) ===
          ([...document.querySelectorAll('[id]')].find((e) => e.id === id) ?? null),
        `round ${round}, ID ${id}`,
      );
    }
  }
  host.textContent = '';
  assert.equal(document.getElementById('a'), null);
  assert.equal(document.getElementById('b'), null);
});

test('IDs in a shadow tree do not become document IDs', () => {
  const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
  const shadow = document.getElementById('host').attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span id="private"></span>';
  assert.equal(document.getElementById('private'), null);
  shadow.firstChild.id = 'renamed';
  assert.equal(document.getElementById('renamed'), null);
});
