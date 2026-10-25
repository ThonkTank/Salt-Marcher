import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/planner-workspace-shortcuts';
buildSync({
  stdin: {
    contents:
      "export {bindAtlasHistoryShortcut} from './src/app/workspace/workspace-shortcuts';export {initTutorial,lessons,tutorialLessonRevision} from './src/app/workspace/tutorial';export {initPartyTopbar,activatePartyTopbar} from './src/app/runtime/party-topbar-ui';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
function setup(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLElement: globalThis.HTMLElement,
    };
  Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement });
  t.after(async () => {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    Object.assign(globalThis, saved);
  });
  const el = (id) => document.getElementById(id);
  window.innerWidth = 1000;
  window.innerHeight = 800;
  el('party-shortcut').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  for (const node of document.querySelectorAll('[popover]')) {
    const matches = node.matches.bind(node);
    node.matches = (selector) =>
      selector === ':popover-open' ? node.dataset.keyboardOpen === 'true' : matches(selector);
  }
  const pop = el('party-popover');
  let open = false,
    count = 0;
  pop.matches = () => open;
  pop.showPopover = () => {
    open = true;
    count++;
  };
  pop.hidePopover = () => {
    open = false;
  };
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  const dialog = el('tutorial-dialog');
  Object.defineProperty(dialog, 'open', { get: () => dialog.hasAttribute('open') });
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => dialog.removeAttribute('open');
  window.campaign = {
    tutorial: async (state) => ({ ok: true, value: { state: state ?? 'shown' } }),
    live: async () => ({ ok: true, value: { roster: [], scenes: [], focusId: null } }),
    progress: async () => ({ ok: true, value: { characters: [], notices: [] } }),
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs');
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar({ token: 'workspace', campaign: { id: 'campaign' } });
  const key = (target, props) => {
    const e = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(e, {
      key: 'z',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      isComposing: false,
      ...props,
    });
    target.dispatchEvent(e);
    return e;
  };
  return { window, document, el, dialog, ui, key, partyOpens: () => count };
}
test('tutorial modal keeps history and party shortcuts out of the background while help/skip stay usable', async (t) => {
  const x = setup(t),
    changes = [],
    stop = x.ui.bindAtlasHistoryShortcut(
      () => true,
      () => false,
      (d) => changes.push(d),
    );
  t.after(stop);
  await x.ui.initTutorial();
  x.el('help').click();
  assert.equal(x.dialog.open, true);
  const undo = x.key(x.el('tutorial-heading'), { ctrlKey: true }),
    party = x.key(x.el('tutorial-heading'), { key: 'p', altKey: true });
  assert.equal(undo.defaultPrevented, false);
  assert.equal(party.defaultPrevented, false);
  assert.deepEqual(changes, []);
  assert.equal(x.partyOpens(), 0);
  x.el('tutorial-skip').click();
  assert.equal(x.dialog.open, false);
  x.key(x.document.body, { ctrlKey: true });
  x.key(x.document.body, { key: 'p', altKey: true });
  assert.deepEqual(changes, ['undo']);
  assert.equal(x.partyOpens(), 1);
});
for (const element of ['input', 'textarea', 'select', 'contenteditable', 'role-textbox'])
  test('author editing owns undo inside ' + element, (t) => {
    const x = setup(t),
      changes = [],
      stop = x.ui.bindAtlasHistoryShortcut(
        () => true,
        () => false,
        (d) => changes.push(d),
      );
    t.after(stop);
    const target = x.document.createElement(
      element === 'contenteditable' || element === 'role-textbox' ? 'div' : element,
    );
    if (element === 'contenteditable') target.setAttribute('contenteditable', 'true');
    if (element === 'role-textbox') target.setAttribute('role', 'textbox');
    const child = x.document.createElement('span');
    if (target.tagName === 'DIV') target.append(child);
    x.document.body.append(target);
    const event = x.key(target.tagName === 'DIV' ? child : target, { ctrlKey: true });
    assert.deepEqual(changes, []);
    assert.equal(event.defaultPrevented, false);
  });
test('active atlas owns undo/redo only when the gesture is unclaimed and not composing', (t) => {
  const x = setup(t),
    changes = [];
  let active = true,
    composing = false;
  const stop = x.ui.bindAtlasHistoryShortcut(
    () => active,
    () => composing,
    (d) => changes.push(d),
  );
  t.after(stop);
  assert.equal(x.key(x.document.body, { ctrlKey: true }).defaultPrevented, true);
  assert.equal(x.key(x.document.body, { metaKey: true, shiftKey: true }).defaultPrevented, true);
  active = false;
  x.key(x.document.body, { ctrlKey: true });
  active = true;
  composing = true;
  x.key(x.document.body, { ctrlKey: true });
  composing = false;
  x.key(x.document.body, { ctrlKey: true, isComposing: true });
  const target = x.document.createElement('button');
  x.document.body.append(target);
  target.addEventListener('keydown', (e) => e.preventDefault());
  x.key(target, { ctrlKey: true });
  assert.deepEqual(changes, ['undo', 'redo']);
});
test('an unrelated open editor dialog also retains its own keyboard context', (t) => {
  const x = setup(t),
    changes = [],
    stop = x.ui.bindAtlasHistoryShortcut(
      () => true,
      () => false,
      (d) => changes.push(d),
    );
  t.after(stop);
  const dialog = x.document.createElement('dialog');
  dialog.setAttribute('open', '');
  const button = x.document.createElement('button');
  dialog.append(button);
  x.document.body.append(dialog);
  x.key(button, { ctrlKey: true });
  x.key(button, { key: 'p', altKey: true });
  assert.deepEqual(changes, []);
  assert.equal(x.partyOpens(), 0);
});
test('current XP tutorial teaches downward levels without changing confirmed rest consumption', (t) => {
  const x = setup(t),
    lesson = x.ui.lessons.find((l) => l.id === 'party-awards');
  assert.match(lesson.text, /bis null/);
  assert.match(lesson.text, /Rastverbrauch.*erhalten/);
  assert.doesNotMatch(lesson.text, /Levelfloor|reduzieren die Rastzähler/);
  assert.notEqual(x.ui.tutorialLessonRevision, 'desktop-tutorial-session-packet-v32');
});
test('extension installation and unknown write recovery are discoverable through optional help', async (t) => {
  const x = setup(t);
  await x.ui.initTutorial();
  const lesson = x.ui.lessons.find((l) => l.id === 'extension-installation');
  assert.ok(lesson);
  const content = x.el('tutorial-lessons').textContent;
  assert.match(content, /Ergebnis prüfen/);
  assert.match(content, /Wiederaufnahme zurücksetzen/);
  assert.match(content, /Rechte widerrufen/);
  assert.match(lesson.text, /noch keinen zusätzlichen Inhaltseditor/);
});
test('open party and calculator popovers keep atlas history out while Alt+P still toggles the party', async (t) => {
  const x = setup(t),
    changes = [],
    stop = x.ui.bindAtlasHistoryShortcut(
      () => true,
      () => false,
      (d) => changes.push(d),
    );
  t.after(stop);
  x.key(x.document.body, { key: 'p', altKey: true });
  assert.equal(x.partyOpens(), 1);
  x.key(x.document.body, { ctrlKey: true });
  assert.deepEqual(changes, []);
  x.key(x.document.body, { key: 'p', altKey: true });
  x.key(x.document.body, { ctrlKey: true });
  assert.deepEqual(changes, ['undo']);
  const other = [...x.document.querySelectorAll('[popover]')].find((p) => p.id !== 'party-popover');
  assert.ok(other);
  other.dataset.keyboardOpen = 'true';
  x.key(x.document.body, { ctrlKey: true });
  assert.deepEqual(changes, ['undo']);
});

test('new instructions never interrupt the workspace and are marked shown only when opened', async (t) => {
  const x = setup(t),
    calls = [];
  x.window.campaign.tutorial = async (state) => {
    calls.push(state ?? 'read');
    return { ok: true, value: { state: state ?? 'new' } };
  };
  await x.ui.initTutorial();
  assert.equal(x.dialog.open, false);
  assert.deepEqual(calls, ['read']);
  assert.match(x.el('help').textContent, /neu/);
  x.el('help').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(x.dialog.open, true);
  assert.deepEqual(calls, ['read', 'shown']);
  assert.equal(x.el('help').textContent, 'Hilfe');
  x.el('tutorial-skip').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(x.dialog.open, false);
  assert.equal(calls.at(-1), 'skipped');
  x.el('help').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(x.dialog.open, true);
  assert.equal(calls.at(-1), 'shown');
});
test('help starts with the active area and its search filters the complete manual', async (t) => {
  const x = setup(t);
  x.document.body.classList.add('has-workspace');
  x.el('atlas-tab').setAttribute('aria-pressed', 'false');
  x.el('live-tab').setAttribute('aria-pressed', 'true');
  await x.ui.initTutorial();
  x.el('help').click();
  assert.equal(
    x.el('tutorial-lessons').firstElementChild.querySelector('h3').textContent,
    'Party und laufender Spielabend',
  );
  const all = x.el('tutorial-lessons').children.length;
  x.el('tutorial-search').value = 'roster';
  x.el('tutorial-search').oninput();
  const visible = [...x.el('tutorial-lessons').children].filter((row) => !row.hidden);
  assert.ok(visible.length > 0 && visible.length < all);
  for (const row of visible) assert.match(row.textContent, /roster/i);
  x.el('tutorial-search').value = 'nichtvorhandeneswort123';
  x.el('tutorial-search').oninput();
  assert.match(x.el('tutorial-search-status').textContent, /0 Hilfethemen/);
  x.el('tutorial-search').value = '';
  x.el('tutorial-search').oninput();
  assert.equal([...x.el('tutorial-lessons').children].filter((row) => !row.hidden).length, all);
});
test('late tutorial status cannot reopen help or advertise it again after the user closes it', async (t) => {
  const x = setup(t);
  let finishRead;
  x.window.campaign.tutorial = (state) =>
    state ? Promise.resolve({ ok: true, value: { state } }) : new Promise((r) => (finishRead = r));
  const loading = x.ui.initTutorial();
  x.el('help').click();
  x.el('tutorial-skip').click();
  finishRead({ ok: true, value: { state: 'new' } });
  await loading;
  assert.equal(x.dialog.open, false);
  assert.equal(x.el('help').textContent, 'Hilfe');
});

test('Atlas editor blocks party shortcuts while the runtime workspace retains them', (t) => {
  const x = setup(t);
  x.document.body.classList.add('atlas-workspace');
  x.key(x.document.body, { key: 'p', altKey: true });
  assert.equal(x.partyOpens(), 0);
  x.document.body.classList.remove('atlas-workspace');
  x.key(x.document.body, { key: 'p', altKey: true });
  assert.equal(x.partyOpens(), 1);
});
