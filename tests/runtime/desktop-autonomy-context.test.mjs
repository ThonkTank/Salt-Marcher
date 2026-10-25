import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/autonomy-context',
  require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setTimeout(r, 0));
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/runtime/autonomy-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'Expected autonomy state did not arrive');
}
async function fixture(t, { jobSeconds = 60, campaignNames = ['Alpha'] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'autonomy-context-')),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = new CampaignStore(path.join(root, 'world.sqlite')),
    rows = [];
  for (const name of campaignNames) {
    const cam = store.create(name),
      w = store.activate(cam.id),
      id = randomUUID(),
      cmd = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
    store.changePreparation({
      ...cmd(null),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          kind: 'npc',
          title: name,
          readAloud: '',
          gmNotes: '',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    store.executeAutonomy(
      cmd({
        kind: 'actor',
        expectedRevision: null,
        initialLocationId: null,
        actor: {
          id,
          revision: 0,
          enabled: true,
          paused: false,
          role: name,
          needs: [],
          jobPriorities: {},
          assignedJobId: null,
          allowConflict: false,
          defense: 12,
          attackBonus: 0,
          maxHpLossPercent: 10,
          cursor: 0,
          offsetSeconds: 0,
          jobId: null,
          progressSeconds: 0,
          pending: null,
        },
      }),
    );
    store.executeAutonomy(
      cmd({
        kind: 'job',
        expectedRevision: null,
        job: {
          id: randomUUID(),
          revision: 0,
          name: name + ' wartet',
          kind: 'wait',
          locationId: null,
          routeId: null,
          targetActorId: null,
          roles: [],
          priority: 1,
          durationSeconds: jobSeconds,
          exclusive: false,
          enabled: true,
          needEffects: {},
          maxDamage: 0,
        },
      }),
    );
    const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
    store.executeLive(
      cmd({
        kind: 'advance-clock',
        sceneId: scene.id,
        expectedRevision: 0,
        amount: 1800,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Explizit bestätigte NPC-Zeit',
      }),
    );
    rows.push({ cam, id });
  }
  const saved = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  const held = [],
    sent = [],
    messages = [];
  let holdKind = null,
    holdRead = false,
    current;
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  window.campaign = {
    autonomy: async (token) => {
      const result = response(() => store.autonomy(token));
      if (holdRead) {
        holdRead = false;
        return new Promise((resolve) => held.push(() => resolve(result)));
      }
      return result;
    },
    executeAutonomy: async (command) => {
      sent.push(structuredClone(command));
      const result = response(() => store.executeAutonomy(command));
      if (command.action.kind === holdKind) {
        holdKind = null;
        return new Promise((resolve) => held.push(() => resolve(result)));
      }
      return result;
    },
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs');
  ui.initAutonomy((text, error) => messages.push({ text, error }));
  const get = (id) => document.getElementById('autonomy-' + id);
  const activate = (i) => {
    current = store.activate(rows[i].cam.id);
    ui.activateAutonomy(current);
    return current;
  };
  activate(0);
  await ui.openAutonomy();
  t.after(() => {
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    rows,
    ui,
    get,
    activate,
    sent,
    messages,
    hold(kind) {
      holdKind = kind;
    },
    holdRead() {
      holdRead = true;
    },
    held,
    release() {
      held.shift()();
    },
    current: () => current,
    async edit(i, role) {
      get('actor').value = rows[i].id;
      get('actor').onchange();
      await until(() => get('actor-title').textContent.includes(rows[i].cam.name));
      get('role').value = role;
      get('actor-form').dispatchEvent(new window.Event('input'));
    },
    draw() {
      get('filter').oninput();
    },
  };
}
test('a late campaign read cannot poison the newly opened autonomy model', async (t) => {
  const x = await fixture(t, { campaignNames: ['Alpha', 'Beta'] });
  x.holdRead();
  const old = x.ui.openAutonomy();
  await until(() => x.held.length === 1);
  x.activate(1);
  await x.ui.openAutonomy();
  x.release();
  await old;
  x.draw();
  assert.match(x.get('actors').textContent, /Beta/);
  assert.doesNotMatch(x.get('actors').textContent, /Alpha/);
});
test('same-token reactivation rejects a late command view and preserves current actor controls', async (t) => {
  const x = await fixture(t);
  x.hold('pause');
  [...x.get('actors').querySelectorAll('button')]
    .find((b) => b.textContent === 'Pausieren')
    .click();
  await until(() => x.held.length === 1);
  const actor = x.store.autonomy(x.current().token).actors[0];
  x.store.executeAutonomy({
    commandId: randomUUID(),
    campaignId: x.rows[0].cam.id,
    token: x.current().token,
    action: {
      kind: 'actor',
      actor: { ...actor, role: 'Neuer bestätigter Stand' },
      expectedRevision: actor.revision,
      initialLocationId: null,
    },
  });
  x.ui.activateAutonomy(x.current());
  await x.ui.openAutonomy();
  await x.edit(0, 'Frische offene Eingabe');
  x.release();
  await tick();
  await tick();
  assert.equal(x.get('role').value, 'Frische offene Eingabe');
  assert.equal(x.get('actor-form').hidden, false);
  assert.equal(await x.ui.flushAutonomy(), true);
  assert.equal(x.store.autonomy(x.current().token).actors[0].role, 'Frische offene Eingabe');
});
test('an old catch-up reply cannot replace or unlock a new campaign catch-up run', async (t) => {
  const x = await fixture(t, { campaignNames: ['Alpha', 'Beta'] });
  x.hold('catch-up');
  x.get('catchup').click();
  await until(() => x.held.length === 1);
  x.activate(1);
  await x.ui.openAutonomy();
  assert.equal(x.get('catchup').disabled, false, 'new campaign owns a fresh runner');
  x.hold('catch-up');
  x.get('catchup').click();
  await until(() => x.held.length === 2);
  x.release();
  await tick();
  await tick();
  assert.match(x.get('actors').textContent, /Beta/);
  assert.equal(x.get('catchup').disabled, true);
  assert.equal(x.sent.length, 2, 'old run must not enqueue a command under the new campaign');
  x.get('cancel-run').click();
  x.release();
  await until(() => !x.get('catchup').disabled);
  assert.equal(x.sent.length, 2);
  assert.equal(x.sent[0].campaignId, x.rows[0].cam.id);
  assert.equal(x.sent[1].campaignId, x.rows[1].cam.id);
});
test('a context switch detaches an old flush without clearing the new pending flush or its edits', async (t) => {
  const x = await fixture(t, { campaignNames: ['Alpha', 'Beta'] });
  await x.edit(0, 'A bestätigt');
  x.hold('actor');
  const old = x.ui.flushAutonomy();
  await until(() => x.held.length === 1);
  x.activate(1);
  await x.ui.openAutonomy();
  await x.edit(1, 'B bestätigt');
  x.hold('actor');
  const fresh = x.ui.flushAutonomy();
  await until(() => x.held.length === 2);
  x.release();
  assert.equal(await old, false);
  x.get('role').value = 'B später';
  x.get('actor-form').dispatchEvent(new window.Event('input'));
  const joined = x.ui.flushAutonomy();
  await tick();
  assert.equal(x.sent.length, 2, 'joining the current pending flush must not send another write');
  x.release();
  assert.equal(await fresh, true);
  assert.equal(await joined, true);
  assert.equal(x.get('role').value, 'B später', 'later edits survive old and current replies');
  assert.equal(await x.ui.flushAutonomy(), true);
  assert.equal(x.store.autonomy(x.current().token).actors[0].role, 'B später');
});
test('cancelling catch-up stops future chunks and preserves exactly the already committed original step', async (t) => {
  const x = await fixture(t);
  const before = x.store.autonomy(x.current().token).actors[0];
  x.hold('catch-up');
  x.get('catchup').click();
  await until(() => x.held.length === 1);
  x.get('cancel-run').click();
  x.release();
  await until(() => !x.get('catchup').disabled);
  const after = x.store.autonomy(x.current().token).actors[0];
  assert.ok(after.offsetSeconds > before.offsetSeconds);
  assert.equal(x.sent.length, 1);
  assert.match(x.get('progress').textContent, /atomare NPC-Schritte bestätigt/);
  assert.match(x.messages.at(-1).text, /Bereits bestätigte Schritte bleiben/);
});

test('cancellation during preparatory save prevents the first catch-up command', async (t) => {
  const x = await fixture(t);
  await x.edit(0, 'Erlaubte Konfiguration');
  const before = x.store.autonomy(x.current().token).actors[0];
  x.hold('actor');
  x.get('catchup').click();
  await until(() => x.held.length === 1);
  x.get('cancel-run').click();
  x.release();
  await until(() => x.sent.length === 1 && x.get('role').value === 'Erlaubte Konfiguration');
  await tick();
  await tick();
  const after = x.store.autonomy(x.current().token).actors[0];
  assert.deepEqual(
    x.sent.map((c) => c.action.kind),
    ['actor'],
  );
  assert.equal(after.cursor, before.cursor);
  assert.equal(after.offsetSeconds, before.offsetSeconds);
  assert.equal(x.get('catchup').disabled, false);
});
test('two queued starts share one runner and cancellation stops its next chunk', async (t) => {
  const x = await fixture(t);
  x.hold('catch-up');
  x.get('catchup').click();
  x.get('catchup').click();
  await until(() => x.held.length === 1);
  assert.equal(x.sent.length, 1);
  x.get('cancel-run').click();
  x.release();
  await until(() => !x.get('catchup').disabled);
  assert.equal(x.sent.length, 1);
});

test('an older read in the same activation cannot replace a newer read', async (t) => {
  const x = await fixture(t);
  x.holdRead();
  const old = x.ui.openAutonomy();
  await until(() => x.held.length === 1);
  const a = x.store.autonomy(x.current().token).actors[0];
  x.store.executeAutonomy({
    commandId: randomUUID(),
    campaignId: x.rows[0].cam.id,
    token: x.current().token,
    action: {
      kind: 'actor',
      actor: { ...a, role: 'Späterer Stand' },
      expectedRevision: a.revision,
      initialLocationId: null,
    },
  });
  await x.ui.openAutonomy();
  x.release();
  await old;
  x.get('filter').value = 'Späterer Stand';
  x.draw();
  assert.match(x.get('actors').textContent, /Alpha/);
  assert.match(x.get('actor-result').textContent, /1 NPCs/);
});

test('compact actor setup preserves need edits and current job feedback through save and reopen', async (t) => {
  const x = await fixture(t, { jobSeconds: 3600 });
  await x.edit(0, 'Torwache');
  const settings = x.get('needs-settings');
  assert.equal(settings.hasAttribute('open'), false);
  settings.setAttribute('open', '');
  // The fixture has no needs yet; add one using the ordinary UI before editing it.
  x.get('new-need-name').value = 'Wachsamkeit';
  x.get('add-need').click();
  const need = x.get('needs').querySelector('[data-need-field="value"]');
  assert.ok(need);
  need.value = '37';
  x.get('actor-form').dispatchEvent(new window.Event('input'));
  settings.removeAttribute('open');
  assert.equal(await x.ui.flushAutonomy(), true);
  await x.ui.openAutonomy();
  const saved = x.store.autonomy(x.current().token).actors.find((a) => a.id === x.rows[0].id);
  assert.equal(saved.role, 'Torwache');
  assert.equal(saved.needs.find((n) => n.name === 'Wachsamkeit').value, 37);
  assert.match(x.get('actors').textContent, /Kein laufender Job/);
  x.get('catchup').click();
  await until(() => !x.get('catchup').disabled && x.sent.some((c) => c.action.kind === 'catch-up'));
  assert.match(x.get('actors').textContent, /Aktueller Job: Alpha wartet · 30 \/ 60 min/);
});

test('special job controls can be opened without clearing normal job inputs', async (t) => {
  const x = await fixture(t);
  x.get('job-new').click();
  await until(() => !x.get('job-form').hidden);
  x.get('job-name').value = 'Torpatrouille';
  x.get('job-duration').value = '15';
  x.get('job-kind').value = 'patrol';
  x.get('job-kind').onchange();
  assert.equal(x.get('job-special').open, true);
  assert.equal(x.get('job-name').value, 'Torpatrouille');
  assert.equal(x.get('job-duration').value, '15');
  x.get('job-kind').value = 'wait';
  x.get('job-form').dispatchEvent(new window.Event('input'));
  assert.equal(await x.ui.flushAutonomy(), true);
  const saved = x.store.autonomy(x.current().token).jobs.find((j) => j.name === 'Torpatrouille');
  assert.equal(saved.kind, 'wait');
  assert.equal(saved.durationSeconds, 900);
});

test('configuring a new NPC preserves opt-out until the GM explicitly enables autonomy', async (t) => {
  const x = await fixture(t),
    w = x.current(),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: w.campaign.id,
    token: w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'npc',
        title: 'Tilda',
        readAloud: '',
        gmNotes: '',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  await x.ui.openAutonomy();
  x.get('actor').value = id;
  x.get('actor').onchange();
  await until(
    () => !x.get('actor-form').hidden && x.get('actor-title').textContent.includes('Tilda'),
  );
  assert.equal(x.get('enabled').checked, false);
  x.get('role').value = 'Anlegerwache';
  x.get('actor-form').dispatchEvent(new window.Event('input'));
  assert.equal(await x.ui.flushAutonomy(), true);
  let actor = x.store.autonomy(w.token).actors.find((a) => a.id === id);
  assert.equal(actor.enabled, false);
  assert.equal(actor.role, 'Anlegerwache');
  x.ui.activateAutonomy(w);
  await x.ui.openAutonomy();
  x.get('actor').value = id;
  x.get('actor').onchange();
  await until(
    () => !x.get('actor-form').hidden && x.get('actor-title').textContent.includes('Tilda'),
  );
  assert.equal(x.get('enabled').checked, false);
  x.get('enabled').checked = true;
  x.get('actor-form').dispatchEvent(new window.Event('input'));
  assert.equal(await x.ui.flushAutonomy(), true);
  x.ui.activateAutonomy(w);
  await x.ui.openAutonomy();
  x.get('actor').value = id;
  x.get('actor').onchange();
  await until(
    () => !x.get('actor-form').hidden && x.get('actor-title').textContent.includes('Tilda'),
  );
  actor = x.store.autonomy(w.token).actors.find((a) => a.id === id);
  assert.equal(actor.enabled, true);
  assert.equal(x.get('enabled').checked, true);
});
