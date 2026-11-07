import { createRequire } from 'node:module';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';

// Real UI, disposable databases, a confirmed deadline and the same group after Fresh.
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/agenda-deadline';
await mkdir(output, { recursive: true });
await rm(output + '/result.json', { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/agenda-deadline-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/agenda-deadline-store.cjs');
const results = [];
for (const scale of [1]) {
  const native = await createNativeSession({
      root,
      output: output + '/zoom-' + scale,
      name: 'agenda-deadline',
    }),
    profile = native.profile;
  let page,
    stage = 'fixture';
  const capture = (name, selector) => native.capture(page, name, selector),
    close = () => native.close();
  const file = profile + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Frist des Nordtors'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  let scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  scene = store.executeLive(
    command({
      kind: 'scene-content',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      title: 'Wache am Nordtor',
      notes: '  Laufende Gruppenprosa\r\n',
      locationId: null,
    }),
  ).scene;
  const original = {
    id: randomUUID(),
    revision: 0,
    name: 'Unbeteiligter Feiertag',
    startMs: String(10 * 86400000),
    durationMs: '3600000',
    repeatMs: null,
    locationId: null,
    notes: '  Geschützter Originaltext\r\n',
    trashed: false,
  };
  store.executeWorld(command({ kind: 'calendar-event', event: original, expectedRevision: null }));
  const savedOriginal = store.world(w.token).events[0],
    originalScene = structuredClone(store.live(w.token).scene);
  store.tutorial('skipped');
  store.close();
  async function launch() {
    page = await native.launch(scale);
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await page
      .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
      .getByRole('button', { name: /Öffnen|Fortsetzen/ })
      .click();
    await page.waitForFunction(
      (id) =>
        document.getElementById('campaigns').value === id &&
        !document.getElementById('workspace-navigation').inert,
      campaign.id,
    );
    const tab = page.getByRole('button', { name: 'Party und Leiten', exact: true });
    if (!(await tab.isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await tab.isVisible())) await page.locator('#workspace-nav-summary').click();
    }
    await tab.click();
    await page.locator('#live-agenda-open').waitFor();
  }
  async function agenda() {
    await page.locator('#live-agenda-open').click();
    await page.waitForFunction(() =>
      document.getElementById('agenda-status').textContent.includes('Countdowns'),
    );
  }
  async function snapshot() {
    const fresh = new CampaignStore(file);
    try {
      const active = fresh.activate(campaign.id);
      return {
        scene: fresh.live(active.token).scene,
        events: fresh.world(active.token).events,
        calendar: fresh.world(active.token).calendar,
      };
    } finally {
      fresh.close();
    }
  }
  try {
    stage = 'create relative deadline at ' + scale;
    await launch();
    await agenda();
    assert.equal(await page.locator('#agenda-horizon').inputValue(), '5');
    stage = 'calendar settings and fractional day at ' + scale;
    const beforeCalendar = await snapshot();
    await page.getByRole('button', { name: 'Kalenderregeln bearbeiten…', exact: true }).click();
    await page.locator('#calendar-hours').fill('1.5');
    await page.locator('#calendar-name').fill('Kalender des Nordtors');
    await page
      .locator('#calendar-rules')
      .getByRole('button', { name: 'Schließen', exact: true })
      .click();
    assert.equal(await page.locator('#calendar-rules').isVisible(), true);
    assert.deepEqual(await snapshot(), beforeCalendar, 'Editing and blocked close cannot write');
    await capture('calendar-input-' + scale, '#calendar-hours');
    await native.app.evaluate(({ ipcMain }) => {
      const send = ipcMain._invokeHandlers.get('world:execute');
      assertHandler(send);
      let lose = true;
      globalThis.qaCalendarWrites = [];
      function assertHandler(handler) {
        if (!handler) throw Error('World writer missing');
      }
      ipcMain.removeHandler('world:execute');
      ipcMain.handle('world:execute', async (e, c) => {
        if (c.action.kind === 'calendar') globalThis.qaCalendarWrites.push(c.commandId);
        const result = await send(e, c);
        if (lose && c.action.kind === 'calendar' && result.ok) {
          lose = false;
          throw Error('Controlled calendar reply loss');
        }
        return result;
      });
    });
    await page.getByRole('button', { name: 'Kalender speichern', exact: true }).click();
    await page.locator('#calendar-write-check').waitFor();
    await page
      .locator('#calendar-rules')
      .getByRole('button', { name: 'Eingaben verwerfen', exact: true })
      .click();
    assert.equal(await page.locator('#calendar-rules').isVisible(), true);
    assert.equal(await page.locator('#calendar-hours').inputValue(), '1.5');
    await capture('calendar-recovery-' + scale, '#calendar-write-check');
    await page.locator('#calendar-write-check').click();
    await page.waitForFunction(() =>
      document
        .getElementById('calendar-rules-status')
        .textContent.startsWith('Kalender gespeichert.'),
    );
    assert.equal(
      await native.app.evaluate(() => globalThis.qaCalendarWrites.length),
      1,
      'Recovery must not resend the calendar write',
    );
    const configured = await snapshot();
    assert.equal(configured.calendar.daySeconds, 5400);
    assert.equal(configured.calendar.revision, beforeCalendar.calendar.revision + 1);
    assert.deepEqual(configured.events, beforeCalendar.events);
    assert.deepEqual(configured.scene, beforeCalendar.scene);
    await capture('calendar-' + scale, '#calendar-hours');
    await page
      .getByRole('button', { name: 'Zurück zu Ereignissen und Fristen', exact: true })
      .click();
    await page.locator('#campaign-agenda').waitFor();
    await page.getByRole('button', { name: 'Neue Frist / Ereignis', exact: true }).click();
    await page.locator('#agenda-name').fill('Nordtor schließt');
    await page.locator('#agenda-offset').fill('6');
    await page.locator('#agenda-offset-unit').selectOption('day');
    await page.locator('#agenda-duration').fill('1');
    await page.locator('#agenda-duration-unit').selectOption('hour');
    const notes = '  Die Wache wartet auf die Gruppe.\nOriginale Vorbereitung bleibt erhalten.';
    await page.locator('#agenda-notes').fill(notes);
    await page.getByRole('button', { name: 'Ereignis speichern', exact: true }).click();
    await page.waitForFunction(() =>
      document.getElementById('agenda-status').textContent.includes('Ereignis gespeichert.'),
    );
    const created = await snapshot(),
      event = created.events.find((e) => e.name === 'Nordtor schließt');
    assert(event);
    assert.equal(event.startMs, String(6 * 5400000));
    assert.equal(event.notes, notes);
    assert.deepEqual(created.scene, originalScene);
    const row = () => page.locator('#agenda-list [data-event-id="' + event.id + '"]');
    await row().waitFor();
    assert.equal(await row().getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('#campaign-agenda').innerText(), /Einzelansicht/);
    await capture('saved-' + scale);
    await page.getByRole('button', { name: 'Ereignis bearbeiten', exact: true }).click();
    assert.equal(await page.locator('#agenda-notes').inputValue(), notes);
    await page.getByRole('button', { name: 'Eingaben verwerfen', exact: true }).click();
    await page
      .locator('#campaign-agenda')
      .getByRole('button', { name: 'Schließen', exact: true })
      .click();
    stage = 'preview and confirm time at ' + scale;
    await page.locator('#time-plan-open').click();
    await page.locator('#time-navigator-amount').fill('7');
    await page.locator('#time-navigator-unit').selectOption('day');
    await page
      .locator('#time-navigator')
      .getByRole('button', { name: 'Vorschau berechnen', exact: true })
      .click();
    await page.waitForFunction(() =>
      document.getElementById('time-navigator-preview').textContent.includes('Nordtor schließt'),
    );
    assert.match(
      await page.locator('#time-navigator-preview').innerText(),
      /Ereignisbeginne in dieser Zeit: 1/,
    );
    assert.deepEqual((await snapshot()).scene, originalScene);
    await capture('time-preview-' + scale);
    await page
      .locator('#time-navigator')
      .getByRole('button', { name: 'Zeit ausdrücklich verstreichen lassen', exact: true })
      .click();
    await page.locator('#time-navigator').waitFor({ state: 'hidden' });
    const advanced = await snapshot();
    assert.equal(advanced.scene.clock.instantMs, String(7 * 5400000));
    assert.equal(advanced.scene.clock.revision, originalScene.clock.revision + 1);
    assert.equal(advanced.scene.id, scene.id);
    assert.equal(advanced.scene.notes, originalScene.notes);
    assert.equal(advanced.scene.locationId, originalScene.locationId);
    assert.deepEqual(advanced.events, created.events);
    await close();
    stage = 'Fresh and further edit at ' + scale;
    await launch();
    await agenda();
    await page.locator('#agenda-past').check();
    await page.locator('#agenda-search').fill('Nordtor schließt');
    await row().waitFor();
    await row().click();
    assert.match(await page.locator('#agenda-document').innerText(), /Abgelaufen/);
    await capture('fresh-' + scale);
    await page.getByRole('button', { name: 'Ereignis bearbeiten', exact: true }).click();
    assert.equal(await page.locator('#agenda-notes').inputValue(), notes);
    const changed = notes + '\nDie Gruppe steht vor dem geschlossenen Tor.';
    await page.locator('#agenda-notes').fill(changed);
    await page.getByRole('button', { name: 'Ereignis speichern', exact: true }).click();
    await page.waitForFunction(() =>
      document.getElementById('agenda-status').textContent.includes('Ereignis gespeichert.'),
    );
    await row().waitFor();
    assert.match(await page.locator('#agenda-document').innerText(), /Abgelaufen/);
    await close();
    const final = await snapshot(),
      saved = final.events.find((e) => e.id === event.id);
    assert.equal(final.events.length, 2);
    assert.deepEqual(
      final.events.find((e) => e.id === original.id),
      savedOriginal,
    );
    assert.deepEqual(saved, { ...event, revision: event.revision + 1, notes: changed });
    assert.deepEqual(final.scene, advanced.scene);
    assert.deepEqual(final.calendar, configured.calendar);
    results.push({
      zoom: scale,
      profile,
      calendarDaySeconds: 5400,
      calendarPreservesInstants: true,
      calendarRecoveredWithoutResend: true,
      eventId: event.id,
      creationLeavesSceneUntouched: true,
      savedOutsideHorizonSelected: true,
      previewReadOnly: true,
      crossedEvents: 1,
      timeConfirmedOnce: true,
      reopenedSameEvent: true,
      furtherEditPreservesInstant: true,
      unrelatedEventUnchanged: true,
    });
    await native.finish({ result: results.at(-1) });
  } catch (error) {
    error.message = stage + ': ' + error.message;
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
await writeFile(output + '/result.json', JSON.stringify({ results }, null, 2));
console.log(JSON.stringify({ results }));
