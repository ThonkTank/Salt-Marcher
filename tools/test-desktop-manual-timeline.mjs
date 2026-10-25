import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3'),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1);
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/manual-timeline-evidence';
const native = await createNativeSession({ root, output, name: 'manual-timeline' }),
  file = native.profile + '/workbench.sqlite';
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/manual-timeline-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/manual-timeline-store.cjs'),
  store = new CampaignStore(file),
  campaign = store.create('Ein Abend am Hafen');
store.tutorial('skipped');
store.close();
const read = (fn) => {
  const db = new Database(file, { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
};
const plan = () =>
  read((db) => {
    const p = db.prepare('SELECT * FROM plan').get();
    return (
      p && {
        ...p,
        scenes: db
          .prepare('SELECT payload FROM planned_visit WHERE plan_id=? ORDER BY ordinal')
          .all(p.id)
          .map((r) => JSON.parse(r.payload)),
      }
    );
  });
async function until(check) {
  const deadline = Date.now() + 15000;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 30));
  assert(check(), 'Expected confirmed manual timeline');
}
async function nav(page, id) {
  if (!(await page.locator('#' + id).isVisible())) {
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#' + id).isVisible()))
      await page.locator('#workspace-nav-summary').click();
  }
  await page.locator('#' + id).click();
}
async function launch() {
  const page = await native.launch(zoom);
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(() => !document.querySelector('#workspace-navigation').inert);
  return page;
}
async function planning(page) {
  await nav(page, 'preparation-tab');
  await page.locator('#preparation-planning').click();
}
async function visit(page, title) {
  await page.locator('#scene-list button').filter({ hasText: title }).click();
  await page.waitForFunction(
    (title) => document.querySelector('#scene-title').value === title,
    title,
  );
}
try {
  let page = await launch();
  await planning(page);
  await page.locator('#plan-create').click();
  await page.locator('#plan-name').fill('Salzsteg zweimal');
  for (const [title, notes] of [
    ['Ankunft am Salzsteg', '  Erste Ankunft\n- Siv kennt das Losungswort'],
    ['Marktbesuch', 'Die Händlerin wartet.'],
    ['Rückkehr zum Salzsteg', '  Zweiter Besuch\n- Das Boot ist verschwunden.'],
  ]) {
    await page.locator('#scene-add').click();
    await page.waitForFunction(() => document.querySelector('#scene-title').value === 'Neue Szene');
    await page.locator('#scene-title').fill(title);
    await page.locator('#scene-notes').fill(notes);
    await page.locator('#plan-name').click();
    await until(() => plan()?.scenes.some((s) => s.title === title && s.notes === notes));
  }
  await page.locator('#scene-up').click();
  await until(() => plan().scenes[1].title === 'Rückkehr zum Salzsteg');
  await page.locator('#preparation-knowledge').click();
  await page.locator('#locations-tab').click();
  await page.locator('#location-new').click();
  await page.locator('#new-location-name').fill('Salzsteg');
  await page.locator('#location-create').click();
  await page.locator('#location-dialog').waitFor({ state: 'hidden' });
  const location = read((db) => db.prepare('SELECT id FROM location').get().id);
  await planning(page);
  for (const title of ['Ankunft am Salzsteg', 'Rückkehr zum Salzsteg']) {
    await visit(page, title);
    await page.locator('#scene-location').selectOption(location);
    await page.locator('#plan-name').click();
    await until(() => plan().scenes.find((s) => s.title === title).locationId === location);
  }
  assert.equal(
    read((db) => db.prepare('SELECT count(*) n FROM live_scene').get().n),
    0,
  );
  const before = plan();
  await native.capture(page, 'repeated-place', '#scene-list');
  await native.close();
  page = await launch();
  await planning(page);
  assert.deepEqual(plan(), before);
  await visit(page, 'Rückkehr zum Salzsteg');
  // Delay one real confirmation while the GM continues typing into the same visit.
  await native.app.evaluate(({ ipcMain }) => {
    const send = ipcMain._invokeHandlers.get('campaign:change-preparation-plan');
    let hold = true;
    globalThis.qaPlanWrites = [];
    ipcMain.removeHandler('campaign:change-preparation-plan');
    ipcMain.handle('campaign:change-preparation-plan', async (e, c) => {
      globalThis.qaPlanWrites.push(c.commandId);
      const result = await send(e, c);
      if (hold) {
        hold = false;
        globalThis.qaPlanHeld = true;
        await new Promise((resolve) => (globalThis.qaPlanRelease = resolve));
      }
      return result;
    });
  });
  const sent = '  Zweiter Besuch\n- Nach Neustart ergänzt.',
    later = sent + '\n- Während der Speicherung ergänzt.';
  await page.locator('#scene-notes').fill(sent);
  await page.locator('#scene-title').click();
  const deadline = Date.now() + 15000;
  while (!(await native.app.evaluate(() => globalThis.qaPlanHeld)) && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 30));
  assert(await native.app.evaluate(() => globalThis.qaPlanHeld));
  await page.locator('#scene-notes').fill(later);
  await native.app.evaluate(() => globalThis.qaPlanRelease());
  await page.locator('#plan-name').click();
  await until(() => plan().scenes[1].notes === later);
  assert.equal(await page.locator('#scene-notes').inputValue(), later);
  // Lose a committed reply. Recovery must only read the same target and receipt.
  await native.app.evaluate(({ ipcMain }) => {
    const send = ipcMain._invokeHandlers.get('campaign:change-preparation-plan');
    let lose = true;
    globalThis.qaPlanRecoveries = 0;
    const status = ipcMain._invokeHandlers.get('campaign:reconcile-preparation-plan');
    ipcMain.removeHandler('campaign:reconcile-preparation-plan');
    ipcMain.handle('campaign:reconcile-preparation-plan', (...args) => {
      globalThis.qaPlanRecoveries++;
      return status(...args);
    });
    ipcMain.removeHandler('campaign:change-preparation-plan');
    ipcMain.handle('campaign:change-preparation-plan', async (e, c) => {
      const result = await send(e, c);
      if (lose) {
        lose = false;
        throw Error('Controlled plan reply loss');
      }
      return result;
    });
  });
  await page.locator('#scene-title').fill('Rückkehr bei Nacht');
  await page.locator('#plan-name').click();
  await page.locator('#preparation-reconcile').waitFor();
  const writes = await native.app.evaluate(() => globalThis.qaPlanWrites.length);
  await page.locator('#preparation-reconcile').click();
  await page.locator('#preparation-reconcile').waitFor({ state: 'hidden' });
  assert.equal(await native.app.evaluate(() => globalThis.qaPlanWrites.length), writes);
  assert.equal(await native.app.evaluate(() => globalThis.qaPlanRecoveries), 1);
  await page.locator('#scene-list button').filter({ hasText: 'Rückkehr bei Nacht' }).waitFor();
  const prepared = plan();
  await native.capture(page, 'recovered-plan', '#scene-notes');
  await page.locator('#scene-adopt').click();
  await page.locator('#adoption-dialog').waitFor();
  await page.locator('#adoption-confirm').click();
  await page.locator('#adoption-dialog').waitFor({ state: 'hidden' });
  await until(() =>
    read((db) =>
      db
        .prepare('SELECT title,notes,location_id FROM live_scene')
        .all()
        .some(
          (r) =>
            r.title === 'Rückkehr bei Nacht' && r.notes === later && r.location_id === location,
        ),
    ),
  );
  assert.deepEqual(plan(), prepared);
  await native.capture(page, 'independent-live');
  await native.close();
  page = await launch();
  await planning(page);
  assert.deepEqual(plan(), prepared);
  await visit(page, 'Rückkehr bei Nacht');
  assert.equal(await page.locator('#scene-notes').inputValue(), later);
  assert.equal(await page.locator('#scene-location').inputValue(), location);
  await native.capture(page, 'fresh-plan', '#scene-notes');
  await native.close();
  await native.finish({
    zoom,
    manualWithoutParty: true,
    repeatedLocation: location,
    lateInputPreserved: true,
    receiptRecoveryWithoutReplay: true,
    independentLiveAdoption: true,
    prepared,
  });
  console.log(JSON.stringify({ output, launches: native.launches }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
