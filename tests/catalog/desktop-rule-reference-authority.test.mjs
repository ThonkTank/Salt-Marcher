import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  ...(process.env.RULE_REFERENCE_UI_SOURCE
    ? {
        stdin: {
          contents: readFileSync(process.env.RULE_REFERENCE_UI_SOURCE, 'utf8'),
          resolveDir: process.cwd() + '/src/app/catalog',
          sourcefile: 'rule-reference-ui.ts',
          loader: 'ts',
        },
      }
    : { entryPoints: ['src/app/catalog/rule-reference-ui.ts'] }),
  outfile: '.build/rule-reference-authority.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(fn) {
  for (let n = 0; n < 100 && !fn(); n++) await tick();
  assert.ok(fn());
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const rules = (sceneId, title, revision = 1) => ({
  sceneId,
  revision,
  pins: [
    {
      noteId: 'rule-' + title,
      title,
      sourceRevision: 1,
      currentRevision: 1,
      stale: false,
      unavailable: false,
      readAloud: 'Vorlesen ' + title,
      gmNotes: 'Privat ' + title,
    },
  ],
});
function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(async () => {
    await tick();
    await tick();
    Object.assign(globalThis, saved);
  });
  const reads = [],
    writes = [],
    rolls = [],
    messages = [];
  window.campaign = {
    executeSceneCheck: (command) => {
      const d = deferred();
      rolls.push({ ...d, command });
      return d.promise;
    },
    sceneChecks: async (token, sceneId) => ({
      ok: true,
      value: { sceneId, revision: 0, checks: [], truncated: false },
    }),
    sceneRules: (token, sceneId) => {
      const d = deferred();
      reads.push({ ...d, token, sceneId });
      return d.promise;
    },
    executeSceneRule: (command) => {
      const d = deferred();
      writes.push({ ...d, command });
      return d.promise;
    },
    searchDesk: async () => ({ ok: true, value: { entries: [], next: null } }),
  };
  delete require.cache[require.resolve('../../.build/rule-reference-authority.cjs')];
  const ui = require('../../.build/rule-reference-authority.cjs');
  ui.initRuleReferences((text, error) => messages.push({ text, error }));
  const lookup = document.getElementById('live-rule-lookup');
  if (lookup) {
    lookup.close = () => {
      lookup.open = false;
    };
    lookup.showModal = () => {
      lookup.open = true;
    };
  }
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.querySelector('option')?.value ?? '',
    });
  ui.activateRuleReferences({ token: 'token', campaign: { id: 'campaign' } });
  const context = (scene) => void ui.refreshRuleReferences(scene),
    text = () => document.getElementById('live-rule-pins').textContent,
    remove = () =>
      [...document.querySelectorAll('#live-rule-pins button')]
        .find((b) => b.textContent === 'Von Gruppe lösen')
        ?.click();
  return { window, document, ui, reads, writes, rolls, messages, context, text, remove };
}
test('late scene A read cannot change the revision used by a scene B command', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B', 7) });
  await until(() => x.text().includes('Vorlesen B'));
  x.reads[0].resolve({ ok: true, value: rules('A', 'A', 2) });
  await tick();
  x.remove();
  await until(() => x.writes.length);
  assert.equal(x.writes[0].command.sceneId, 'B');
  assert.equal(x.writes[0].command.expectedRevision, 7);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'B', revision: 8, pins: [] } });
});
test('late command from scene A cannot replace the basis in scene B or announce its save', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  x.remove();
  await until(() => x.writes.length);
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B', 7) });
  await until(() => x.text().includes('Vorlesen B'));
  x.writes[0].resolve({ ok: true, value: rules('A', 'A', 2) });
  await tick();
  assert.equal(x.messages.length, 0);
  x.remove();
  await until(() => x.writes.length === 2);
  assert.equal(x.writes[1].command.expectedRevision, 7);
  x.writes[1].resolve({ ok: true, value: { sceneId: 'B', revision: 8, pins: [] } });
});
test('A B A reactivation rejects the first A read', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.context('B');
  x.context('A');
  x.reads[2].resolve({ ok: true, value: rules('A', 'Latest', 9) });
  await until(() => x.text().includes('Vorlesen Latest'));
  // A retired request has no authority even if it returns a newer source revision.
  // A lower revision would let accept() mask a broken activation/request guard.
  x.reads[0].resolve({ ok: true, value: rules('A', 'Old activation', 12) });
  x.reads[1].resolve({ ok: true, value: rules('B', 'B', 2) });
  await tick();
  x.remove();
  await until(() => x.writes.length);
  assert.equal(x.writes[0].command.expectedRevision, 9);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'A', revision: 10, pins: [] } });
});
test('wrong-scene reply never becomes an editable rule set', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('Other', 'Foreign') });
  await until(() => x.messages.length || x.text().includes('Foreign'));
  assert.ok(
    !x.document.querySelector('#live-rule-pins button'),
    'wrong-scene rules must have no editable pin',
  );
  assert.ok(x.messages.some((m) => m.error));
});
test('an older known response cannot replace a newer scene revision', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Current', 9) });
  await until(() => x.text().includes('Vorlesen Current'));
  x.context('A');
  x.reads[1].resolve({ ok: true, value: rules('A', 'Old', 3) });
  await tick();
  x.remove();
  await until(() => x.writes.length);
  assert.equal(x.writes[0].command.expectedRevision, 9);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'A', revision: 10, pins: [] } });
});
test('rule changes stay serial while acknowledgement is pending', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  x.remove();
  x.remove();
  await tick();
  assert.equal(x.writes.length, 1);
  assert.equal(x.document.querySelector('#live-rule-pins button').disabled, true);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'A', revision: 2, pins: [] } });
});
test('a failed read clears old editable rules, shows its error locally and allows explicit refresh', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  x.context('B');
  x.reads[1].reject(new Error('Read unavailable'));
  await until(() => x.messages.length);
  assert.equal(x.document.querySelectorAll('#live-rule-pins button').length, 0);
  assert.equal(x.document.querySelectorAll('#live-rule-results button').length, 0);
  assert.match(
    x.document.querySelector('#live-rule-pins [role=alert]').textContent,
    /Read unavailable/,
  );
  x.context('B');
  x.reads[2].resolve({ ok: true, value: rules('B', 'Recovered') });
  await until(() => x.text().includes('Vorlesen Recovered'));
});

test('old scene acknowledgement cannot unlock a newer scene write', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  x.remove();
  await until(() => x.writes.length === 1);
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B', 7) });
  await until(() => x.text().includes('Vorlesen B'));
  x.remove();
  await until(() => x.writes.length === 2);
  x.writes[0].resolve({ ok: true, value: rules('A', 'A', 2) });
  await tick();
  x.remove();
  await tick();
  assert.equal(x.writes.length, 2);
  assert.equal(x.document.getElementById('live-rules-panel').inert, true);
  x.writes[1].resolve({ ok: true, value: { sceneId: 'B', revision: 8, pins: [] } });
  await tick();
  await tick();
  assert.equal(x.document.getElementById('live-rules-panel').inert, false);
});

const result = (sceneId, label, revision = 1) => ({
  sceneId,
  revision,
  checks: [
    {
      id: sceneId + '-check',
      sceneId,
      ordinal: revision,
      label,
      ruleNoteId: null,
      ruleTitle: null,
      ruleSourceRevision: null,
      mode: 'normal',
      modifier: 0,
      dc: null,
      rolls: [10],
      total: 10,
      outcome: null,
      sceneInstantMs: '0',
      recordedAt: new Date().toISOString(),
    },
  ],
  truncated: false,
});
function submit(x) {
  x.document.getElementById('live-check-label').value = 'Perception';
  x.document.getElementById('live-check-label').select = () => {};
  x.document.getElementById('live-check-form').onsubmit({ preventDefault() {} });
}
test('a rule-bound roll sends the displayed frozen revision and keeps input after stale rejection', async (t) => {
  const x = fixture(t),
    shown = rules('A', 'A');
  shown.pins[0].sourceRevision = 7;
  shown.pins[0].currentRevision = 9;
  shown.pins[0].stale = true;
  x.context('A');
  x.reads[0].resolve({ ok: true, value: shown });
  await until(() => x.text().includes('Vorlesen A'));
  x.document.getElementById('live-check-rule').value = 'rule-A';
  x.document.getElementById('live-check-mode').value = 'advantage';
  x.document.getElementById('live-check-modifier').value = '2';
  x.document.getElementById('live-check-dc').value = '12';
  submit(x);
  await until(() => x.rolls.length === 1);
  assert.equal(x.rolls[0].command.action.expectedRuleSourceRevision, 7);
  x.rolls[0].resolve({
    ok: false,
    error: 'Regelstand geändert. Aktualisieren und Regel erneut prüfen.',
  });
  await until(() => x.messages.length);
  for (const [id, value] of [
    ['live-check-label', 'Perception'],
    ['live-check-rule', 'rule-A'],
    ['live-check-mode', 'advantage'],
    ['live-check-modifier', '2'],
    ['live-check-dc', '12'],
  ])
    assert.equal(x.document.getElementById(id).value, value);
  assert.equal(x.document.getElementById('live-check-latest').textContent, '');
  x.context('A');
  const next = rules('A', 'A', 2);
  next.pins[0].sourceRevision = 9;
  next.pins[0].currentRevision = 9;
  x.reads[1].resolve({ ok: true, value: next });
  await until(() => x.text().includes('Quelle Revision 9'));
  submit(x);
  await until(() => x.rolls.length === 2);
  assert.equal(x.rolls[1].command.action.expectedRuleSourceRevision, 9);
  x.rolls[1].resolve({ ok: true, value: result('A', 'Reviewed') });
});
test('source update binds the source revision offered by the current pin view', async (t) => {
  const x = fixture(t),
    shown = rules('A', 'A');
  shown.pins[0].currentRevision = 9;
  shown.pins[0].stale = true;
  x.context('A');
  x.reads[0].resolve({ ok: true, value: shown });
  await until(() => x.text().includes('Vorlesen A'));
  [...x.document.querySelectorAll('#live-rule-pins button')]
    .find((b) => b.textContent === 'Aus Quelle aktualisieren')
    .click();
  await until(() => x.writes.length === 1);
  assert.deepEqual(x.writes[0].command.action, {
    kind: 'refresh',
    noteId: 'rule-A',
    expectedSourceRevision: 9,
  });
  x.writes[0].resolve({ ok: false, error: 'Regelquelle geändert' });
});
test('a pending roll cannot be submitted twice or shown in a different scene', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  submit(x);
  submit(x);
  await until(() => x.rolls.length);
  assert.equal(x.rolls.length, 1);
  x.context('B');
  assert.equal(x.document.getElementById('live-check-latest').textContent, '');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B') });
  await until(() => x.text().includes('Vorlesen B'));
  submit(x);
  await until(() => x.rolls.length === 2);
  assert.equal(x.rolls[1].command.sceneId, 'B');
  x.rolls[0].resolve({ ok: true, value: result('A', 'Foreign') });
  await tick();
  assert.equal(x.document.getElementById('live-check-latest').textContent, '');
  assert.equal(x.document.getElementById('live-rules-panel').inert, true);
  assert.equal(x.messages.length, 0);
  submit(x);
  assert.equal(x.rolls.length, 2);
  x.rolls[1].resolve({ ok: true, value: result('B', 'Current') });
  await until(() => x.document.getElementById('live-check-latest').textContent.includes('Current'));
  assert.equal(x.document.getElementById('live-rules-panel').inert, false);
});
test('a stale check refresh cannot roll back the revision used by the next roll', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  submit(x);
  await until(() => x.rolls.length);
  x.rolls[0].resolve({ ok: true, value: result('A', 'Latest', 9) });
  await until(() => x.document.getElementById('live-check-latest').textContent.includes('Latest'));
  x.context('A');
  x.reads[1].resolve({ ok: true, value: rules('A', 'A') });
  await tick();
  await tick();
  submit(x);
  await until(() => x.rolls.length === 2);
  assert.equal(x.rolls[1].command.expectedRevision, 9);
  x.rolls[1].resolve({ ok: true, value: result('A', 'Next', 10) });
});

test('typing removes old readable search results and a failed search can be retried', async (t) => {
  const x = fixture(t),
    entry = {
      ref: { kind: 'note', id: 'extra' },
      title: 'Sichtschutz',
      label: 'Regelreferenz',
      revision: 1,
    };
  x.window.campaign.searchDesk = async () => ({
    ok: true,
    value: { entries: [entry], next: null },
  });
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.document.querySelector('#live-rule-results summary'));
  x.window.campaign.searchDesk = async () => ({ ok: false, error: 'Search unavailable' });
  const input = x.document.getElementById('live-rule-search');
  input.value = 'Changed';
  input.oninput();
  assert.equal(x.document.querySelectorAll('#live-rule-results summary').length, 0);
  await new Promise((r) => setTimeout(r, 220));
  assert.match(
    x.document.querySelector('#live-rule-results [role=alert]').textContent,
    /Search unavailable/,
  );
  x.window.campaign.searchDesk = async () => ({
    ok: true,
    value: { entries: [entry], next: null },
  });
  input.value = 'Sichtschutz';
  input.oninput();
  await new Promise((r) => setTimeout(r, 220));
  assert.ok(x.document.querySelector('#live-rule-results summary'));
});
test('formula rolls share the owner guard and an old acknowledgement cannot unlock the next group', async (t) => {
  const x = fixture(t),
    action = {
      label: 'Spear',
      actor: 'Guard',
      formula: '1d20+3',
      dc: null,
      sourceCreatureId: 'guard',
      sourceActionId: 'spear',
    };
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  const first = x.ui.rollSceneFormula(action);
  await until(() => x.rolls.length === 1);
  assert.equal(await x.ui.rollSceneFormula(action), false);
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B') });
  await until(() => x.text().includes('Vorlesen B'));
  const second = x.ui.rollSceneFormula(action);
  await until(() => x.rolls.length === 2);
  x.rolls[0].resolve({ ok: true, value: result('A', 'Old') });
  assert.equal(await first, false);
  assert.equal(x.document.getElementById('live-rules-panel').inert, true);
  assert.equal(x.messages.length, 0);
  x.rolls[1].resolve({ ok: true, value: result('B', 'Current') });
  assert.equal(await second, true);
  assert.equal(x.document.getElementById('live-rules-panel').inert, false);
});

test('targeted saves ignore old target callbacks after a group change', async (t) => {
  const x = fixture(t),
    callbacks = [],
    action = { label: 'Fire breath', actor: 'Ada', modifier: 2, mode: 'normal', dc: 15 };
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  const old = x.ui.rollSceneCheck(action, (c) => callbacks.push(c.id));
  await until(() => x.rolls.length === 1);
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B') });
  await until(() => x.text().includes('Vorlesen B'));
  x.rolls[0].resolve({ ok: true, value: result('A', 'Old') });
  assert.equal(await old, false);
  assert.deepEqual(callbacks, []);
  const current = x.ui.rollSceneCheck(action, (c) => callbacks.push(c.id));
  await until(() => x.rolls.length === 2);
  assert.equal(x.rolls[1].command.sceneId, 'B');
  assert.equal(x.rolls[1].command.expectedRevision, 0);
  x.rolls[1].resolve({ ok: true, value: result('B', 'Current') });
  assert.equal(await current, true);
  assert.deepEqual(callbacks, ['B-check']);
});
test('a wrong-group targeted save reply cannot call its target or poison the next revision', async (t) => {
  const x = fixture(t),
    callbacks = [],
    action = { label: 'Fire breath', actor: 'Ada', modifier: 2, mode: 'normal', dc: 15 };
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  const first = x.ui.rollSceneCheck(action, (c) => callbacks.push(c.id));
  await until(() => x.rolls.length === 1);
  x.rolls[0].resolve({ ok: true, value: result('Other', 'Foreign', 99) });
  assert.equal(await first, false);
  assert.deepEqual(callbacks, []);
  const next = x.ui.rollSceneCheck(action, (c) => callbacks.push(c.id));
  await until(() => x.rolls.length === 2);
  assert.equal(x.rolls[1].command.expectedRevision, 0);
  x.rolls[1].resolve({ ok: true, value: result('A', 'Current') });
  assert.equal(await next, true);
  assert.deepEqual(callbacks, ['A-check']);
});

test('a failed check reader leaves healthy rule pins usable and recovers independently', async (t) => {
  const x = fixture(t);
  x.window.campaign.sceneChecks = async () => ({ ok: false, error: 'Check history unavailable' });
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Readable', 7) });
  await until(() => x.text().includes('Vorlesen Readable'));
  assert.match(
    x.document.querySelector('#live-check-history [role=alert]').textContent,
    /Check history unavailable/,
  );
  assert.equal(x.document.querySelector('#live-check-form button').disabled, true);
  x.remove();
  await until(() => x.writes.length);
  assert.equal(x.writes[0].command.expectedRevision, 7);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'A', revision: 8, pins: [] } });
  await tick();
  await tick();
  x.window.campaign.sceneChecks = async () => ({ ok: true, value: result('A', 'Recovered', 5) });
  x.context('A');
  x.reads[1].resolve({ ok: true, value: { sceneId: 'A', revision: 8, pins: [] } });
  await until(() =>
    x.document.getElementById('live-check-latest').textContent.includes('Recovered'),
  );
  submit(x);
  await until(() => x.rolls.length);
  assert.equal(x.rolls[0].command.expectedRevision, 5);
  x.rolls[0].resolve({ ok: true, value: result('A', 'Next', 6) });
});
test('a failed rule reader leaves healthy free checks usable', async (t) => {
  const x = fixture(t);
  x.window.campaign.sceneChecks = async () => ({ ok: true, value: result('A', 'Existing', 4) });
  x.context('A');
  x.reads[0].reject(new Error('Rule source unavailable'));
  await until(() =>
    x.document.getElementById('live-check-latest').textContent.includes('Existing'),
  );
  assert.match(
    x.document.querySelector('#live-rule-pins [role=alert]').textContent,
    /Rule source unavailable/,
  );
  assert.equal(x.document.querySelectorAll('#live-rule-pins button').length, 0);
  submit(x);
  await until(() => x.rolls.length);
  assert.equal(x.rolls[0].command.action.ruleNoteId, null);
  assert.equal(x.rolls[0].command.expectedRevision, 4);
  x.rolls[0].resolve({ ok: true, value: result('A', 'New', 5) });
});
test('pending rule lookup does not delay checks or gain authority over a later check result', async (t) => {
  const x = fixture(t);
  x.window.campaign.sceneChecks = async () => ({ ok: true, value: result('A', 'Independent', 3) });
  x.context('A');
  await until(() =>
    x.document.getElementById('live-check-latest').textContent.includes('Independent'),
  );
  submit(x);
  await until(() => x.rolls.length);
  x.rolls[0].resolve({ ok: true, value: result('A', 'Newer', 4) });
  await until(() => x.document.getElementById('live-check-latest').textContent.includes('Newer'));
  x.reads[0].resolve({ ok: true, value: rules('A', 'Late', 7) });
  await until(() => x.text().includes('Vorlesen Late'));
  assert.match(x.document.getElementById('live-check-latest').textContent, /Newer/);
  x.remove();
  await until(() => x.writes.length);
  assert.equal(x.writes[0].command.expectedRevision, 7);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'A', revision: 8, pins: [] } });
});
test('pending check lookup does not delay rule actions or get invalidated by their success', async (t) => {
  const x = fixture(t),
    check = deferred();
  x.window.campaign.sceneChecks = () => check.promise;
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Independent', 7) });
  await until(() => x.text().includes('Vorlesen Independent'));
  x.remove();
  await until(() => x.writes.length);
  x.writes[0].resolve({ ok: true, value: { sceneId: 'A', revision: 8, pins: [] } });
  await tick();
  await tick();
  check.resolve({ ok: true, value: result('A', 'Late checks', 4) });
  await until(() =>
    x.document.getElementById('live-check-latest').textContent.includes('Late checks'),
  );
  submit(x);
  await until(() => x.rolls.length);
  assert.equal(x.rolls[0].command.expectedRevision, 4);
  x.rolls[0].resolve({ ok: true, value: result('A', 'New', 5) });
});
test('late independent check failure from the previous scene cannot erase current checks', async (t) => {
  const x = fixture(t),
    old = deferred();
  x.window.campaign.sceneChecks = (token, id) =>
    id === 'A' ? old.promise : Promise.resolve({ ok: true, value: result('B', 'Current', 9) });
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Old') });
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'Current') });
  await until(() => x.document.getElementById('live-check-latest').textContent.includes('Current'));
  old.reject(new Error('Old check failure'));
  await tick();
  await tick();
  assert.match(x.document.getElementById('live-check-latest').textContent, /Current/);
  assert.equal(x.document.querySelector('#live-check-history [role=alert]'), null);
  assert.equal(x.messages.length, 0);
});

test('a malformed check response cannot hide healthy rule references', async (t) => {
  const x = fixture(t);
  x.window.campaign.sceneChecks = async () => ({ ok: true, value: result('Other', 'Foreign', 99) });
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Healthy', 7) });
  await until(() => x.text().includes('Vorlesen Healthy'));
  assert.match(
    x.document.querySelector('#live-check-history [role=alert]').textContent,
    /ungültigen Stand/,
  );
  assert.equal(x.document.getElementById('live-check-latest').textContent, '');
  assert.equal(x.document.querySelector('#live-check-form button').disabled, true);
});
test('a failed check refresh after a confirmed roll cannot erase its new basis', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Healthy') });
  await until(() => x.text().includes('Vorlesen Healthy'));
  const late = deferred();
  x.window.campaign.sceneChecks = () => late.promise;
  x.context('A');
  submit(x);
  await until(() => x.rolls.length);
  x.rolls[0].resolve({ ok: true, value: result('A', 'Confirmed', 5) });
  await until(() =>
    x.document.getElementById('live-check-latest').textContent.includes('Confirmed'),
  );
  late.reject(new Error('Old refresh failure'));
  x.reads[1].resolve({ ok: true, value: rules('A', 'Still readable', 2) });
  await until(() => x.text().includes('Vorlesen Still readable'));
  assert.match(x.document.getElementById('live-check-latest').textContent, /Confirmed/);
  assert.equal(x.document.querySelector('#live-check-history [role=alert]'), null);
  assert.equal(x.messages.filter((m) => m.error).length, 0);
});
test('changing scenes clears the previous rule choice before independent checks become usable', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'Old') });
  await until(() => x.text().includes('Vorlesen Old'));
  x.document.getElementById('live-check-rule').value = 'rule-Old';
  x.context('B');
  await tick();
  await tick();
  assert.equal(x.document.getElementById('live-check-rule').value, '');
  submit(x);
  await until(() => x.rolls.length);
  assert.equal(x.rolls[0].command.sceneId, 'B');
  assert.equal(x.rolls[0].command.action.ruleNoteId, null);
  x.rolls[0].resolve({ ok: true, value: result('B', 'New', 1) });
  x.reads[1].resolve({ ok: true, value: rules('B', 'New') });
  await tick();
  await tick();
});

const candidate = {
  ref: { kind: 'note', id: 'source' },
  title: 'Sicherung',
  label: 'Regelreferenz',
  revision: 3,
};
const content = {
  ...candidate,
  revision: 3,
  note: {
    id: 'source',
    kind: 'rule',
    title: 'Sicherung',
    revision: 3,
    readAloud: 'Vorteil',
    gmNotes: 'Ohne Ankerpunkt gilt dies nicht.',
  },
};
function expand(x) {
  const d = x.document.querySelector('#live-rule-results details');
  d.open = true;
  d.ontoggle();
  return d;
}
async function withCandidate(t) {
  const x = fixture(t);
  x.window.campaign.searchDesk = async () => ({
    ok: true,
    value: { entries: [candidate], next: null },
  });
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.document.querySelector('#live-rule-results summary'));
  return x;
}
test('reading the complete rule is read-only and pinning binds the displayed source revision', async (t) => {
  const x = await withCandidate(t);
  x.window.campaign.deskContent = async () => ({ ok: true, value: content });
  assert.equal(x.document.querySelector('#live-rule-results button'), null);
  expand(x);
  await until(() => x.document.querySelector('#live-rule-results button'));
  assert.match(x.document.getElementById('live-rule-results').textContent, /Ohne Ankerpunkt/);
  assert.equal(x.writes.length, 0);
  x.document.querySelector('#live-rule-results button').click();
  await until(() => x.writes.length);
  assert.deepEqual(x.writes[0].command.action, {
    kind: 'pin',
    noteId: 'source',
    expectedSourceRevision: 3,
  });
  x.writes[0].resolve({ ok: true, value: rules('A', 'Pinned', 2) });
});
test('a late detail from a previous group cannot enable a pin or change the current reading', async (t) => {
  const x = await withCandidate(t),
    d = deferred();
  x.window.campaign.deskContent = () => d.promise;
  expand(x);
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'B') });
  await until(() => x.text().includes('Vorlesen B'));
  d.resolve({ ok: true, value: content });
  await tick();
  await tick();
  assert.doesNotMatch(
    x.document.getElementById('live-rule-results').textContent,
    /Ohne Ankerpunkt/,
  );
  assert.equal(x.writes.length, 0);
  assert.equal(x.document.querySelector('#live-rule-results button'), null);
});
test('more rule pages remain retryable and an old page cannot repopulate a changed search', async (t) => {
  const x = fixture(t),
    calls = [],
    late = deferred();
  x.window.campaign.searchDesk = async (_token, kind, q, offset) => {
    calls.push({ kind, q, offset });
    if (offset) return late.promise;
    return { ok: true, value: { entries: [candidate], next: 40 } };
  };
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.document.querySelector('#live-rule-results button'));
  x.document.querySelector('#live-rule-results button').click();
  await until(() => calls.length === 2);
  assert.equal(calls[1].offset, 40);
  assert.equal(calls[1].kind, 'rule');
  const input = x.document.getElementById('live-rule-search');
  input.value = 'Other';
  input.oninput();
  late.resolve({
    ok: true,
    value: {
      entries: [{ ...candidate, title: 'Old page', ref: { kind: 'note', id: 'old' } }],
      next: null,
    },
  });
  await tick();
  await tick();
  assert.doesNotMatch(x.document.getElementById('live-rule-results').textContent, /Old page/);
  x.ui.activateRuleReferences({ token: 'next', campaign: { id: 'next' } });
});
test('a failed or wrong-kind detail offers reading retry without a pin command', async (t) => {
  const x = await withCandidate(t);
  x.window.campaign.deskContent = async () => ({
    ok: true,
    value: { ...content, note: { ...content.note, kind: 'npc' } },
  });
  expand(x);
  await until(() => x.document.querySelector('#live-rule-results [role=alert]'));
  assert.equal(
    x.document.querySelector('#live-rule-results button').textContent,
    'Regel erneut lesen',
  );
  x.window.campaign.deskContent = async () => ({ ok: true, value: content });
  x.document.querySelector('#live-rule-results button').click();
  await until(() =>
    x.document.getElementById('live-rule-results').textContent.includes('Ohne Ankerpunkt'),
  );
  assert.equal(x.writes.length, 0);
});

test('changed source rejection requires another read before a new explicit pin', async (t) => {
  const x = await withCandidate(t);
  let revision = 3;
  x.window.campaign.deskContent = async () => ({
    ok: true,
    value: { ...content, revision, note: { ...content.note, revision } },
  });
  expand(x);
  await until(() => x.document.querySelector('#live-rule-results button'));
  x.document.querySelector('#live-rule-results button').click();
  await until(() => x.writes.length);
  x.writes[0].resolve({ ok: false, error: 'Regelquelle geändert' });
  await until(() => x.document.querySelectorAll('#live-rule-results button').length === 2);
  assert.equal(x.document.querySelector('#live-rule-results button').disabled, true);
  revision = 4;
  x.document.querySelectorAll('#live-rule-results button')[1].click();
  await until(
    () =>
      x.document.querySelectorAll('#live-rule-results button').length === 1 &&
      x.document.getElementById('live-rule-results').textContent.includes('Revision 4'),
  );
  x.document.querySelector('#live-rule-results button').click();
  await until(() => x.writes.length === 2);
  assert.equal(x.writes[1].command.action.expectedSourceRevision, 4);
  x.writes[1].resolve({ ok: true, value: rules('A', 'Pinned', 2) });
});
test('failed additional page preserves existing readable matches and retries the same offset', async (t) => {
  const x = fixture(t),
    calls = [];
  let fail = true;
  x.window.campaign.searchDesk = async (_token, kind, q, offset) => {
    calls.push(offset);
    if (offset && fail) return { ok: false, error: 'Page unavailable' };
    return {
      ok: true,
      value: {
        entries: [
          offset
            ? { ...candidate, ref: { kind: 'note', id: 'second' }, title: 'Second' }
            : candidate,
        ],
        next: offset ? null : 40,
      },
    };
  };
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.document.querySelector('#live-rule-results button'));
  x.document.querySelector('#live-rule-results button').click();
  await until(
    () =>
      x.messages.length &&
      x.document.querySelector('#live-rule-results button').textContent.includes('erneut'),
  );
  assert.equal(x.document.querySelectorAll('#live-rule-results summary').length, 1);
  fail = false;
  x.document.querySelector('#live-rule-results button').click();
  await until(() => x.document.querySelectorAll('#live-rule-results summary').length === 2);
  assert.deepEqual(calls, [0, 40, 40]);
});

// Preparing a rule is an explicit handoff, not a roll or a replacement of typed inputs.
test('rule preparation selects its frozen basis without overwriting the drafted check', async (t) => {
  const x = fixture(t);
  x.context('A');
  x.reads[0].resolve({ ok: true, value: rules('A', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  const label = x.document.getElementById('live-check-label');
  label.value = 'Balancieren';
  label.scrollIntoView = () => {};
  label.focus = () => {};
  for (const [id, value] of [
    ['live-check-mode', 'advantage'],
    ['live-check-modifier', '2'],
    ['live-check-dc', '12'],
  ])
    x.document.getElementById(id).value = value;
  x.document.querySelector('#live-rule-pins [data-rule-id]').click();
  assert.equal(x.document.getElementById('live-check-rule').value, 'rule-A');
  assert.equal(label.value, 'Balancieren');
  for (const [id, value] of [
    ['live-check-mode', 'advantage'],
    ['live-check-modifier', '2'],
    ['live-check-dc', '12'],
  ])
    assert.equal(x.document.getElementById(id).value, value);
  assert.equal(x.writes.length, 0);
  assert.equal(x.rolls.length, 0);
  const stale = x.document.querySelector('#live-rule-pins [data-rule-id]');
  x.context('B');
  x.reads[1].resolve({ ok: true, value: rules('B', 'A') });
  await until(() => x.text().includes('Vorlesen A'));
  stale.click();
  assert.equal(x.document.getElementById('live-check-rule').value, '');
});
test('latest result names its historical rule revision independently of the current pin', async (t) => {
  const x = fixture(t),
    r = result('A', 'Balancieren');
  Object.assign(r.checks[0], {
    ruleNoteId: 'rule-A',
    ruleTitle: 'Alte Sicherung',
    ruleSourceRevision: 3,
  });
  x.window.campaign.sceneChecks = async () => ({ ok: true, value: r });
  x.context('A');
  const pins = rules('A', 'Neue Sicherung');
  pins.pins[0].sourceRevision = 4;
  x.reads[0].resolve({ ok: true, value: pins });
  await until(() =>
    x.document.getElementById('live-check-latest').textContent.includes('Balancieren'),
  );
  assert.match(
    x.document.getElementById('live-check-latest').textContent,
    /Regelbasis: Alte Sicherung · Regelrevision 3/,
  );
  assert.doesNotMatch(x.document.getElementById('live-check-latest').textContent, /Neue Sicherung/);
});
