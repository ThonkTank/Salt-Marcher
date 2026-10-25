import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  before = process.argv.includes('--before'),
  zoom = process.argv.includes('--zoom') ? 2 : 1,
  phase = before ? 'before' : zoom === 2 ? 'after-zoom' : 'after',
  out = path.join(root, '.build/note-map-overlap', phase);
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-map-overlap-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/note-map-overlap-store.cjs');
const profile = await mkdtemp('/tmp/gm-note-map-overlap-'),
  file = profile + '/workbench.sqlite';
const make = (title, kind, gmNotes) => ({
  version: 1,
  id: randomUUID(),
  revision: 1,
  title,
  kind,
  gmNotes,
  readAloud: '',
  relations: [],
  creatureId: null,
  deleted: false,
});
const nera = make(
    'Nera die Quartiermeisterin',
    'npc',
    'Nera kennt die Nachtwache am Lastenaufzug.',
  ),
  clue = make('Das blaue Siegel', 'rumor', 'Das blaue Siegel gehört dem Auftraggeber.'),
  closed = make('Die verlorenen Fässer', 'rumor', 'Diese Fasssuche ist abgeschlossen.'),
  irrelevant = make('Die Fährmannspur', 'rumor', 'Diese Spur soll heute nicht verwendet werden.'),
  personal = make(
    'Eigene Spielnotiz',
    'rule',
    'Die Gruppe will den Zeugen zuerst allein sprechen.',
  ),
  mapA = {
    ...make('Die Nachtwache', 'quest', 'Die Befragung der Wachen vorbereiten.'),
    relations: [nera, clue, closed].map((n) => ({ targetId: n.id, label: 'Quelle' })),
  },
  mapB = {
    ...make('Die Lieferlisten', 'quest', 'Den Siegelbesitzer in den Listen finden.'),
    relations: [nera, clue, irrelevant].map((n) => ({ targetId: n.id, label: 'Quelle' })),
  },
  other = {
    ...make('Andere Verwendung', 'quest', 'Dieser Auftrag bleibt unangetastet.'),
    relations: [{ targetId: nera.id, label: 'Quelle' }],
  };
const notes = [nera, clue, closed, irrelevant, personal, mapA, mapB, other],
  makePlan = (name, titles) => ({
    version: 1,
    id: randomUUID(),
    revision: 1,
    name,
    scenes: titles.map((title) => ({
      id: randomUUID(),
      title,
      notes: '  Eigene Besuchsnotizen\r\nbleiben unverändert.\r\n',
      locationId: null,
    })),
  }),
  oldPlan = makePlan('Abend 01 · Alte Lieferung', ['Die alte Lieferung prüfen']),
  plan = makePlan('Abend 14 · Die doppelte Spur', [
    'Vorher am Kai',
    'Listen und Nachtwache zusammenführen',
  ]),
  target = plan.scenes[1],
  newNera = nera.gmNotes + ' Sie verlangt jetzt eine Kupfermarke für die Auskunft.';
const store = new CampaignStore(file),
  campaign = store.create('Zwei Mappen in einem bestehenden Besuch'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
for (const note of notes)
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
for (const p of [oldPlan, plan])
  store.changePreparation({
    ...command(null),
    change: { kind: 'plan', expectedRevision: null, plan: p },
  });
const state = store.narrative(w.token, closed.id).state;
store.executeProgress(
  command({
    kind: 'narrative-state',
    state: { ...state, status: 'closed' },
    expectedRevision: state.revision,
    expectedNoteRevision: 1,
  }),
);
for (const p of [oldPlan, plan]) {
  const visit = store.session(w.token, p.id).visits[p === plan ? 1 : 0];
  store.executeSession(
    command({
      kind: 'visit',
      planId: p.id,
      expectedRevision: visit.revision,
      detail: { ...visit, readAloud: '  Bestehende Begrüßung\r\n', noteIds: [personal.id] },
    }),
  );
}
const oldView = store.session(w.token, oldPlan.id),
  initialView = store.session(w.token, plan.id);
store.close();
const busPath = profile + '/qa-bus',
  proxy = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      busPath,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
for (let i = 0; i < 100; i++) {
  if (
    await stat(busPath)
      .then(() => true)
      .catch(() => false)
  )
    break;
  await new Promise((r) => setTimeout(r, 20));
}
let app,
  closedApp = true;
const results = { destinations: [] },
  launches = [],
  errors = [],
  artifactHashes = {};
for (const rel of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  artifactHashes[rel] = createHash('sha256')
    .update(await readFile(path.join('.build/desktop', rel)))
    .digest('hex');
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
  });
  closedApp = false;
  launches.push({ pid: app.process().pid });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await app.evaluate(
    ({ BrowserWindow }, z) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.setZoomFactor(z),
    zoom,
  );
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('#campaign-screen-list article')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  if (!(await page.locator('#preparation-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#preparation-tab').click();
  return page;
}
async function selectVisit(page) {
  await page.locator('#preparation-planning').click();
  await page.locator('#plans').selectOption({ label: plan.name });
  await page.locator('#scene-list button').filter({ hasText: target.title }).click();
  await page.waitForFunction(
    (t) => document.querySelector('#scene-title').value === t,
    target.title,
  );
}
async function openMap(page, map) {
  await page.locator('#preparation-knowledge').click();
  await page.locator('#world-search').fill(map.title);
  await page.locator('#world-list').getByRole('button', { name: map.title, exact: true }).click();
  await page.waitForFunction((t) => document.querySelector('#note-title').value === t, map.title);
  await page.locator('#note-thread-open').click();
  await page.waitForFunction(() => !document.querySelector('#note-thread-use').disabled);
}
async function screenshot(page, name) {
  if (zoom === 1) return page.screenshot({ path: path.join(out, name) });
  const data = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.capturePage()
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(path.join(out, name), Buffer.from(data, 'base64'));
}
async function close() {
  const ended = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  const exit = await ended;
  assert.deepEqual(exit, { code: 0, signal: null });
  launches.at(-1).exit = exit;
  closedApp = true;
}
async function packet(page, name) {
  await page.locator('#session-packet-open').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#session-packet-dialog').open &&
      document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
  );
  const initialVisit = await page.locator('#session-packet-content h3').first().textContent();
  results[name + 'InitialVisit'] = initialVisit;
  if (!before) assert.equal(initialVisit, target.title);
  if (before)
    await page.locator('#session-packet-visits button').filter({ hasText: target.title }).click();
  const text = await page.locator('#session-packet-content').innerText();
  for (const n of [personal, clue, mapA, mapB]) assert(text.includes(n.gmNotes));
  assert(text.includes(newNera));
  assert(!text.includes(closed.gmNotes));
  assert(!text.includes(irrelevant.gmNotes));
  results[name] = text;
  await screenshot(page, name + '.png');
  const original = page
    .locator('#session-packet-content .packet-text')
    .filter({ hasText: newNera });
  await original.scrollIntoViewIfNeeded();
  assert.equal(await original.isVisible(), true);
  await screenshot(page, name + '-original.png');
  results[name + 'OriginalVisible'] = true;
  await page.locator('#session-packet-close').click();
}
try {
  let page = await launch();
  await selectVisit(page);
  for (const [i, map] of [mapA, mapB].entries()) {
    await openMap(page, map);
    if (i === 0) {
      assert.equal(
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: closed.title })
          .count(),
        0,
      );
      await page.waitForFunction(
        (t) => document.querySelector('#note-thread-sources').textContent.includes(t),
        clue.gmNotes,
      );
    } else
      await page
        .locator('#note-thread-sources article')
        .filter({ hasText: irrelevant.title })
        .locator('input[type=checkbox]')
        .uncheck();
    const destination = {
      map: map.title,
      plan: await page.locator('#note-thread-plan option:checked').textContent(),
      visit: await page.locator('#note-thread-visit option:checked').textContent(),
    };
    results.destinations.push(destination);
    await page.locator('#note-thread-use').scrollIntoViewIfNeeded();
    await screenshot(page, 'map-' + (i + 1) + '-destination.png');
    if (!before) {
      assert.equal(destination.plan, plan.name);
      assert.equal(destination.visit, target.title);
    }
    if (before) {
      await page.locator('#note-thread-plan').selectOption({ label: plan.name });
      await page.locator('#note-thread-visit').selectOption({ label: target.title });
    }
    await page.locator('#note-thread-use').click();
    await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#scene-title').inputValue(), target.title);
  }
  const knowledge = page.locator('#preparation-knowledge');
  await knowledge.click();
  await page.locator('#world-search').fill(nera.title);
  await page.locator('#world-list').getByRole('button', { name: nera.title, exact: true }).click();
  await page.waitForFunction((t) => document.querySelector('#note-title').value === t, nera.title);
  await page.locator('#note-gm').fill(newNera);
  await page.locator('#preparation-apply').click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Gespeichert.',
  );
  await selectVisit(page);
  await page
    .locator('#visit-preparation summary')
    .filter({ hasText: 'Verknüpftes Weltwissen' })
    .click();
  await page.waitForFunction(() =>
    document.querySelector('#visit-note-selection-summary').textContent.startsWith('5 '),
  );
  results.selected = await page.locator('#visit-note-selected').innerText();
  for (const n of [personal, nera, clue, mapA, mapB])
    assert.equal(
      await page
        .locator('#visit-note-selected')
        .getByRole('button', { name: n.title, exact: true })
        .count(),
      1,
    );
  await packet(page, 'combined-packet');
  await close();
  page = await launch();
  await selectVisit(page);
  await packet(page, 'fresh-packet');
  await close();
  const check = new CampaignStore(file);
  try {
    const a = check.activate(campaign.id),
      view = check.session(a.token, plan.id),
      prep = check.preparation(a.token);
    assert.deepEqual(check.session(a.token, oldPlan.id), oldView);
    assert.deepEqual(view.visits[0], initialView.visits[0]);
    assert.deepEqual(
      new Set(view.visits[1].noteIds),
      new Set([personal, nera, clue, mapA, mapB].map((n) => n.id)),
    );
    assert.equal(view.visits[1].noteIds.length, 5);
    assert.equal(view.visits[1].readAloud, initialView.visits[1].readAloud);
    assert.deepEqual(
      prep.plans.find((p) => p.id === plan.id),
      plan,
    );
    assert.deepEqual(
      prep.plans.find((p) => p.id === oldPlan.id),
      oldPlan,
    );
    assert.equal(prep.notes.length, notes.length);
    for (const n of notes)
      assert.deepEqual(
        prep.notes.find((r) => r.note.id === n.id).note,
        n === nera ? { ...n, revision: 2, gmNotes: newNera } : n,
      );
    results.noDuplicateSourcesAndOnlyIntendedChanges = true;
  } finally {
    check.close();
  }
  assert.deepEqual(errors, []);
  for (const l of launches) {
    let alive = false;
    try {
      process.kill(l.pid, 0);
      alive = true;
    } catch {}
    assert.equal(alive, false);
    l.mainPidAbsent = true;
  }
  await writeFile(
    path.join(out, 'result.json'),
    JSON.stringify(
      { phase, zoom, profile, results, launches, artifactHashes, errors, normalClose: true },
      null,
      2,
    ),
  );
  console.log('COMPLETE ' + phase + ' overlapping maps used in the existing visit');
} catch (error) {
  await writeFile(
    path.join(out, 'failure.json'),
    JSON.stringify({ error: error.stack, results, errors, launches }, null, 2),
  );
  if (app && !closedApp)
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
    } catch {}
  throw error;
} finally {
  if (app && !closedApp) await app.close();
  proxy.kill();
}
