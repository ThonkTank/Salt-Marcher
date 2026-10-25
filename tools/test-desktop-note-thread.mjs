import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  before = process.argv.includes('--before'),
  newPlan = process.argv.includes('--new-plan') && !before,
  phase = before ? 'before' : newPlan ? 'after-new-plan' : 'after',
  out = path.join(root, '.build/note-thread', phase);
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-thread-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/note-thread-store.cjs');
const profile = await mkdtemp('/tmp/gm-note-thread-'),
  file = profile + '/workbench.sqlite',
  threadTitle = 'Die Aufzug-Verschwörung',
  threadText = 'Ziel: Die nächtliche Übergabe stoppen. Welche Spur ist noch offen?',
  notes = [
    [
      'Nera die Quartiermeisterin',
      'npc',
      'Nera hält den Messingschlüssel zum Lastenaufzug. Sie kennt die Nachtwache.',
    ],
    [
      'Drei Glockenschläge',
      'rumor',
      'Vor jeder Übergabe läutet es dreimal. Offen: Wer bezahlt die Nachtwache?',
    ],
    [
      'Wiedergefundene Fässer',
      'rumor',
      'Das fehlende Fass ist wieder da. Diese Spur wurde abgeschlossen.',
    ],
    ...Array.from({ length: 9 }, (_, i) => [
      'Andere Spur ' + (i + 1),
      'rumor',
      'Am Nordtor kennt jemand den Boten.',
    ]),
  ].map(([title, kind, gmNotes]) => ({
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
  }));
const room = {
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: '2',
    name: 'Archiv',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 6 },
          { x: 0, y: 6 },
        ],
        holes: [],
      },
    ],
    sections: [
      {
        id: randomUUID(),
        kind: 'markdown',
        markdown: '  Hinter den Listen liegt der Lastenaufzug.\r\n',
      },
    ],
  },
  store = new CampaignStore(file),
  campaign = store.create('Handlungsstrang wieder aufnehmen', [room]),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  }),
  plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Abend 8 · Die Nachtwache',
    scenes: [
      {
        id: randomUUID(),
        title: 'Die offene Spur verfolgen',
        notes: '  Den Auftraggeber erfragen.\r\n',
        locationId: null,
      },
    ],
  };
for (const note of notes)
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
store.changePreparation({
  ...command(null),
  change: { kind: 'plan', expectedRevision: null, plan },
});
const status = store.narrative(w.token, notes[2].id);
store.executeProgress(
  command({
    kind: 'narrative-state',
    state: { ...status.state, status: 'closed' },
    expectedRevision: status.state.revision,
    expectedNoteRevision: 1,
  }),
);
store.executeDrawing(
  command({
    kind: 'key-batch',
    rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
    patch: {
      references: notes.slice(0, 2).map((n) => ({ id: n.id, kind: n.kind, label: n.title })),
      gmNotes: {
        mode: 'replace',
        text: 'Die Nachtwache bringt die versiegelten Listen zum Aufzug.',
      },
    },
  }),
);
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
  closed = true,
  threadId;
const results = {},
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
  closed = false;
  launches.push({ pid: app.process().pid });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page.locator('#campaigns').selectOption(campaign.id);
  await page.locator('#preparation-tab').click();
  await page.locator('#preparation-knowledge').click();
  return page;
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
  closed = true;
}
try {
  let page = await launch();
  await page.locator('#world-new').click();
  await page.locator('#world-name').fill(threadTitle);
  await page.locator('#world-kind').selectOption('quest');
  await page.locator('#world-form button[type=submit]').click();
  await page.waitForFunction((t) => document.querySelector('#note-title').value === t, threadTitle);
  await page.locator('#note-gm').fill(threadText);
  if (before) {
    for (const [i, note] of notes.slice(0, 3).entries()) {
      await page.locator('#relation-target').selectOption({ label: note.title });
      await page.locator('#relation-label').fill('Quelle');
      await page.locator('#relation-add').click();
      await page.waitForFunction(
        (count) => document.querySelectorAll('#note-relations>div').length === count,
        i + 1,
      );
    }
    await page.locator('#note-relations').scrollIntoViewIfNeeded();
    results.rootRelations = await page.locator('#note-relations').innerText();
    results.memberStatusVisibleAtRoot =
      results.rootRelations.includes('Geschlossen') || results.rootRelations.includes('Offen');
    await page.screenshot({ path: path.join(out, 'linked-sources.png') });
  } else {
    await page.locator('#note-thread-open').click();
    await page.locator('#note-thread-dialog').waitFor({ state: 'visible' });
    await page
      .locator('#note-thread-dialog summary')
      .filter({ hasText: 'Quellen zu dieser Notizmappe hinzufügen' })
      .click();
    await page.locator('#note-thread-find').click();
    for (const n of notes.slice(0, 3))
      await page
        .locator('#note-thread-candidates label')
        .filter({ hasText: n.title })
        .locator('input[type=checkbox]')
        .check();
    await page.locator('#note-thread-add').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('#note-thread-sources article').length === 2 &&
        document.querySelector('#note-thread-summary').textContent.includes('von 3'),
    );
    await page.waitForFunction(() =>
      document
        .querySelector('#note-thread-sources')
        .textContent.includes('Wer bezahlt die Nachtwache?'),
    );
    results.openSourcesTogether = await page.locator('#note-thread-sources').innerText();
    assert(!results.openSourcesTogether.includes(notes[2].title));
    await page.screenshot({ path: path.join(out, 'open-thread.png') });
    const pickedNera = page
      .locator('#note-thread-sources article')
      .filter({ hasText: notes[0].title })
      .locator('input[type=checkbox]');
    await pickedNera.uncheck();
    await page.locator('#note-thread-plan').selectOption('');
    await page.locator('#note-thread-plan-name').fill('Meine Fortsetzung');
    await page.locator('#note-thread-visit-title').fill('Meine offene Frage');
    await page.locator('#note-thread-active').uncheck();
    await page.waitForFunction(
      () => document.querySelectorAll('#note-thread-sources article').length === 3,
    );
    assert.equal(await pickedNera.isChecked(), false);
    assert.equal(await page.locator('#note-thread-plan-name').inputValue(), 'Meine Fortsetzung');
    assert.equal(await page.locator('#note-thread-visit-title').inputValue(), 'Meine offene Frage');
    assert(
      (
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: notes[2].title })
          .innerText()
      ).includes('Geschlossen'),
    );
    assert.equal(
      await page
        .locator('#note-thread-sources article')
        .filter({ hasText: notes[2].title })
        .locator('input[type=checkbox]')
        .isChecked(),
      false,
    );
    await page.screenshot({ path: path.join(out, 'all-source-states.png') });
    await page.locator('#note-thread-active').check();
    await page.waitForFunction(
      () => document.querySelectorAll('#note-thread-sources article').length === 2,
    );
    assert.equal(await pickedNera.isChecked(), false);
    await pickedNera.check();
    results.filterRetainsSourceChoiceAndDestinationNames = true;
    await page
      .locator('#note-thread-sources article')
      .filter({ hasText: notes[0].title })
      .getByRole('button', { name: 'Raum öffnen: Archiv', exact: true })
      .click();
    await page.locator('#key-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#key-name').inputValue(), 'Archiv');
    assert.equal(
      await page.locator('#key-gm-notes').inputValue(),
      'Die Nachtwache bringt die versiegelten Listen zum Aufzug.',
    );
    await page.locator('#key-close').click();
    assert.equal(await page.locator('#note-thread-dialog').isVisible(), true);
    await page
      .locator('#note-thread-dialog')
      .getByRole('button', { name: 'Schließen', exact: true })
      .click();
    results.sourceStatesAndRoomReadWithoutReassembly = true;
  }
  await close();
  page = await launch();
  await page.locator('#world-search').fill(threadTitle);
  await page.locator('#world-list button').filter({ hasText: threadTitle }).click();
  await page.waitForFunction((t) => document.querySelector('#note-title').value === t, threadTitle);
  if (before) {
    results.memberReads = [];
    for (const [i, note] of notes.slice(0, 3).entries()) {
      await page.locator('#note-relations button').filter({ hasText: note.title }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        note.title,
      );
      await page.waitForFunction(
        () => !document.querySelector('#note-editor').getAttribute('aria-busy'),
      );
      const state =
        i === 0 ? null : await page.getByLabel('Narrativer Status', { exact: true }).inputValue();
      results.memberReads.push({
        title: await page.locator('#note-title').inputValue(),
        text: await page.locator('#note-gm').inputValue(),
        status: state,
      });
      if (i === 0) {
        await page.locator('#note-room-uses-list button').filter({ hasText: 'Archiv' }).click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#key-name').inputValue(), 'Archiv');
        await page.locator('#key-close').click();
        results.relatedRoomReadWithoutLosingNote = true;
      }
      await page.locator('#note-incoming button').filter({ hasText: threadTitle }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        threadTitle,
      );
    }
    assert.equal(results.memberReads[1].status, 'open');
    assert.equal(results.memberReads[2].status, 'closed');
    results.backlinkReturnAvailable = true;
    await page.locator('#preparation-planning').click();
    await page.locator('#plans').selectOption(plan.id);
    await page.locator('#scene-list button').filter({ hasText: plan.scenes[0].title }).click();
    await page
      .locator('#visit-preparation summary')
      .filter({ hasText: 'Verknüpftes Weltwissen' })
      .click();
    await page.locator('#visit-note-search').fill(threadTitle);
    await page.locator('#visit-note-find').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#visit-note-search-status').textContent === '1 Notizen angezeigt.',
    );
    results.threadSearchResults = await page
      .locator('#visit-note-results strong')
      .allTextContents();
    await page.locator('#visit-note-refs').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(out, 'thread-search-in-plan.png') });
    for (const title of [threadTitle, notes[0].title, notes[1].title]) {
      await page.locator('#visit-note-search').fill(title);
      await page.locator('#visit-note-find').click();
      await page
        .locator('#visit-note-results article')
        .filter({ hasText: title })
        .locator('input[type=checkbox]')
        .check();
    }
  } else {
    await page.locator('#note-thread-open').click();
    await page.waitForFunction(
      () => document.querySelectorAll('#note-thread-sources article').length === 2,
    );
    await page.waitForFunction(() =>
      document
        .querySelector('#note-thread-sources')
        .textContent.includes('Wer bezahlt die Nachtwache?'),
    );
    if (newPlan) {
      await page.locator('#note-thread-plan').selectOption('');
      await page.locator('#note-thread-visit').selectOption('');
      await page.locator('#note-thread-plan-name').fill('Abend 9 · Aufzug erneut beobachten');
      await page.locator('#note-thread-visit-title').fill('Die Nachtwache befragen');
    } else {
      await page.locator('#note-thread-plan').selectOption({ label: plan.name });
      await page.locator('#note-thread-visit').selectOption({ label: plan.scenes[0].title });
    }
    assert((await page.locator('#note-thread-choice').innerText()).startsWith('3 Originalnotizen'));
    await page.screenshot({ path: path.join(out, 'fresh-thread.png') });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2),
    );
    await page.locator('#note-thread-use').scrollIntoViewIfNeeded();
    assert(
      await page.locator('#note-thread-use').evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    );
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await writeFile(
      path.join(out, 'prepare-200percent.png'),
      Buffer.from(
        await app.evaluate(async ({ BrowserWindow }) =>
          (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
            .toPNG()
            .toString('base64'),
        ),
        'base64',
      ),
    );
    await page.locator('#note-thread-use').click();
    await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
    );
    assert.equal(
      await page.locator('#scene-title').inputValue(),
      newPlan ? 'Die Nachtwache befragen' : plan.scenes[0].title,
    );
    results.freshThreadPreparedWithoutSearchingMembersAgain = true;
    results.zoom200PreparationActuallyExecuted = true;
  }
  await page.locator('#session-packet-open').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#session-packet-dialog').open &&
      document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
  );
  results.packet = await page.locator('#session-packet-content').innerText();
  assert(results.packet.includes('Wer bezahlt die Nachtwache?'));
  assert(!results.packet.includes(notes[2].gmNotes));
  await page.screenshot({ path: path.join(out, 'next-session-packet.png') });
  await close();
  const check = new CampaignStore(file);
  try {
    const a = check.activate(campaign.id),
      all = check.preparation(a.token).notes;
    const thread = all.find((r) => r.note.title === threadTitle).note;
    threadId = thread.id;
    assert.equal(thread.gmNotes, threadText);
    assert.deepEqual(
      new Set(thread.relations.map((r) => r.targetId)),
      new Set(notes.slice(0, 3).map((n) => n.id)),
    );
    for (const n of notes) assert.deepEqual(all.find((r) => r.note.id === n.id).note, n);
    const plans = check.preparation(a.token).plans;
    assert.deepEqual(
      plans.find((p) => p.id === plan.id),
      plan,
    );
    const destination = newPlan
      ? plans.find((p) => p.name === 'Abend 9 · Aufzug erneut beobachten')
      : plan;
    assert(destination);
    if (newPlan) {
      assert.equal(plans.length, 2);
      assert.equal(check.session(a.token, plan.id).visits[0].noteIds.length, 0);
    }
    assert.deepEqual(
      new Set(check.session(a.token, destination.id).visits[0].noteIds),
      new Set([threadId, notes[0].id, notes[1].id]),
    );
    assert.equal(check.narrative(a.token, notes[2].id).state.status, 'closed');
    assert.deepEqual(check.workspace().rooms[0].sections, room.sections);
    results.threadPersistedAndOnlyIntendedVisitLinksChanged = true;
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
      { phase, profile, threadId, results, launches, artifactHashes, errors, normalClose: true },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ phase, results, normalClose: true }));
} catch (error) {
  await writeFile(
    path.join(out, 'failure.json'),
    JSON.stringify({ error: error.stack, results, launches, errors }, null, 2),
  );
  if (app && !closed)
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
    } catch {}
  throw error;
} finally {
  if (app && !closed) await app.close();
  proxy.kill();
}
