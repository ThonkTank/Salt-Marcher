// Native task: unfinished recap -> normal Fresh -> confirmed ending with no
// separate cleanup writer -> cancelled preparation -> Fresh -> prepare from
// historic handoff -> Fresh -> edit the same saved visit.
import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const initialRecap = '  Siv hat den Schlüssel übergeben.\r\nDas Signalfeuer bleibt dunkel.  ',
  recap = initialRecap + '\r\nZusatz: Borin bewacht das Boot.',
  handoff = 'Am Salzsteg beginnen.\r\nSiv nach dem verschwundenen Wärter fragen.',
  preparedNotes = handoff + '\r\nDie Laterne bleibt auf dem Boot.',
  editedNotes = preparedNotes + '\r\nNächster Abend: Am Nordsteg warten.';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  out = process.env.QA_EVIDENCE_DIR;
assert(out);
const native = await createNativeSession({ root, output: out, name: 'salt-evening-handoff' }),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1);
try {
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/planner-evening-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/planner-evening-store.cjs'),
    file = native.profile + '/workbench.sqlite',
    s = new CampaignStore(file, JSON.parse(await readFile('package.json', 'utf8')).version),
    campaign = s.create('Übergabe am Salzsteg'),
    w = s.activate(campaign.id),
    cmd = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const heroes = ['Ada', 'Borin'].map(
    (name) => s.executeLive(cmd({ kind: 'create-character', profile: { name } })).character,
  );
  let scene = s.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
  for (const h of heroes) {
    const v = s.live(w.token);
    s.executeLive(
      cmd({
        kind: 'membership',
        characterId: h.id,
        expectedRevision: h.membershipRevision,
        expectedRosterRevision: v.rosterRevision,
        active: true,
        targetSceneId: scene.id,
        expectedFocusRevision: v.focusRevision,
      }),
    );
  }
  scene = s.live(w.token).scene;
  const initialClock = scene.clock;
  s.keepSessionRecapDraft(w.token, { summary: initialRecap, handoff }, null);
  s.tutorial('skipped');
  s.close();
  let page;
  async function tab(id) {
    await page.waitForFunction(() => !document.querySelector('#workspace-navigation').inert);
    if (
      !(await page.locator(id).isVisible()) &&
      (await page.locator('#atlas-navigation').isVisible())
    )
      await page.locator('#atlas-navigation').click();
    // Fresh activation restores the last area asynchronously. The wide sidebar
    // hides its compact summary; wait for the requested tab instead of clicking
    // that hidden summary while restoration is still in flight.
    if (
      !(await page.locator(id).isVisible()) &&
      (await page.locator('#workspace-nav-summary').isVisible())
    )
      await page.locator('#workspace-nav-summary').click();
    await page.locator(id).click();
  }
  async function launch() {
    page = await native.launch(zoom);
    await page
      .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
      .getByRole('button', { name: /Öffnen|Fortsetzen/ })
      .click();
    await tab('#live-tab');
    if (await page.locator('#live-continue').isVisible())
      await page.locator('#live-continue').click();
    await page.locator('#running-notes').waitFor({ state: 'visible' });
  }
  const shot = (name) => native.capture(page, name),
    close = () => native.close();
  function canonical() {
    const audit = new CampaignStore(file);
    try {
      const aw = audit.activate(campaign.id),
        prep = audit.preparation(aw.token);
      return {
        live: audit.live(aw.token),
        events: audit.chronicle(aw.token).entries,
        prep,
        visits: prep.plans.flatMap((p) => audit.session(aw.token, p.id).visits),
      };
    } finally {
      audit.close();
    }
  }
  const audits = [];
  let stage = 'start';
  await launch();
  stage = 'begin';
  await page.locator('#live-session-start').click();
  await page.locator('#live-session-end').waitFor({ state: 'visible' });
  stage = 'unfinished recap';
  await page.locator('#live-session-end').click();
  await page.locator('#live-session-close-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#live-session-close-summary').inputValue(),
    initialRecap.replace(/\r/g, ''),
  );
  await page.locator('#live-session-close-summary').press('Control+End');
  await page.locator('#live-session-close-summary').press('Enter');
  await page.keyboard.type('Zusatz: Borin bewacht das Boot.');
  await shot('unfinished-review');
  await page.locator('#live-session-close-cancel').click();
  await close();
  let saved = canonical();
  assert.deepEqual(saved.live.recapDraft, { summary: recap, handoff });
  assert.equal(saved.events.filter((e) => e.sessionMarker === 'end').length, 0);
  assert.equal(saved.prep.plans.length, 0);
  audits.push({ stage: 'unfinished', draft: saved.live.recapDraft });
  stage = 'fresh draft';
  await launch();
  await page.locator('#live-session-end').click();
  await page.locator('#live-session-close-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#live-session-close-summary').inputValue(),
    recap.replace(/\r/g, ''),
  );
  assert.equal(
    await page.locator('#live-session-close-handoff').inputValue(),
    handoff.replace(/\r/g, ''),
  );
  await shot('fresh-draft');
  stage = 'confirm then cancel preparation';
  await native.app.evaluate(({ ipcMain }) => {
    const channel = 'campaign:keep-session-recap-draft',
      original = ipcMain._invokeHandlers.get(channel);
    assertHandler(original);
    function assertHandler(handler) {
      if (!handler) throw Error('Recap draft handler missing');
    }
    globalThis.recapCleanupCalls = 0;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event, token, draft, expected) => {
      if (draft.summary === '' && draft.handoff === '') {
        globalThis.recapCleanupCalls++;
        throw Error('Separate recap cleanup is unavailable');
      }
      return original(event, token, draft, expected);
    });
  });
  await page.locator('#live-session-close-prepare').click();
  await page.locator('#handoff-visit-dialog').waitFor({ state: 'visible' });
  assert.deepEqual(
    canonical().live.recapDraft,
    { summary: '', handoff: '' },
    'The ending itself must consume its draft',
  );
  assert.equal(
    await native.app.evaluate(() => globalThis.recapCleanupCalls),
    0,
    'No second cleanup write',
  );
  await shot('confirmed-handoff');
  await page.locator('#handoff-visit-cancel').click();
  await close();
  saved = canonical();
  let end = saved.events.find((e) => e.sessionMarker === 'end');
  assert.equal(end.summary, recap);
  assert.equal(end.handoff, handoff);
  assert.equal(saved.events.filter((e) => e.sessionMarker === 'end').length, 1);
  assert.equal(saved.prep.plans.length, 0);
  assert.deepEqual(saved.live.recapDraft, { summary: '', handoff: '' });
  const historicalEnd = end;
  audits.push({ stage: 'cancelled-preparation', end });
  stage = 'fresh confirmed handoff';
  await launch();
  await page.locator('#live-session-resume').click();
  await page.locator('#live-session-resume-dialog').waitFor({ state: 'visible' });
  await page
    .locator('#live-session-resume-groups')
    .getByRole('button', { name: 'Einstieg aus Übergabe vorbereiten…', exact: true })
    .click();
  await page.locator('#handoff-visit-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#handoff-visit-notes').inputValue(), handoff.replace(/\r/g, ''));
  await page.locator('#handoff-visit-title').fill('Siv am Salzsteg');
  await page.locator('#handoff-visit-read-aloud').fill('Im Dunst wartet Siv mit einer Laterne.');
  await page.locator('#handoff-visit-notes').press('Control+End');
  await page.locator('#handoff-visit-notes').press('Enter');
  await page.keyboard.type('Die Laterne bleibt auf dem Boot.');
  await shot('editable-handoff');
  await page.locator('#handoff-visit-open').click();
  await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
  await page.waitForFunction(() =>
    document
      .querySelector('#session-packet-content')
      .textContent.includes('Die Laterne bleibt auf dem Boot.'),
  );
  await shot('prepared-packet');
  await page.locator('#session-packet-close').click();
  await close();
  saved = canonical();
  assert.equal(saved.prep.plans.length, 1);
  const plan = saved.prep.plans[0],
    visit = plan.scenes[0];
  assert.equal(plan.scenes.length, 1);
  assert.equal(visit.notes, preparedNotes);
  assert.equal(saved.visits[0].readAloud, 'Im Dunst wartet Siv mit einer Laterne.');
  assert.deepEqual(
    saved.events.find((e) => e.sessionMarker === 'end'),
    historicalEnd,
  );
  audits.push({ stage: 'prepared', plan });
  stage = 'fresh edit same visit';
  await launch();
  await tab('#preparation-tab');
  await page.locator('#preparation-planning').click();
  await page.locator('#plans').selectOption(plan.id);
  await page.locator('#scene-list button').filter({ hasText: 'Siv am Salzsteg' }).click();
  assert.equal(await page.locator('#scene-notes').inputValue(), preparedNotes.replace(/\r/g, ''));
  await page.locator('#scene-notes').press('Control+End');
  await page.locator('#scene-notes').press('Enter');
  await page.keyboard.type('Nächster Abend: Am Nordsteg warten.');
  await page.locator('#scene-title').click();
  await page.locator('#session-packet-open').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#session-packet-content')
      .textContent.includes('Nächster Abend: Am Nordsteg warten.'),
  );
  await page
    .locator('#session-packet-content .packet-runway-steps')
    .getByRole('button', { name: '2. GM-Notizen', exact: true })
    .click();
  await shot('fresh-edited-packet');
  await page.locator('#session-packet-close').click();
  await close();
  saved = canonical();
  assert.equal(saved.prep.plans.length, 1);
  assert.equal(saved.prep.plans[0].id, plan.id);
  assert.equal(saved.prep.plans[0].scenes[0].id, visit.id);
  assert.equal(saved.prep.plans[0].scenes[0].notes, editedNotes);
  assert.deepEqual(
    saved.events.find((e) => e.sessionMarker === 'end'),
    historicalEnd,
  );
  assert.equal(saved.events.filter((e) => e.sessionMarker === 'end').length, 1);
  assert.deepEqual(saved.live.scene.clock, initialClock);
  assert.deepEqual(
    saved.live.scene.members,
    heroes.map((h) => h.id),
  );
  audits.push({ stage: 'fresh-edited', plan: saved.prep.plans[0] });
  await native.finish({
    complete: true,
    zoom,
    audits,
    canonical: saved,
    separateCleanupWrites: 0,
    humanAcceptance: false,
    installedPackageAcceptance: false,
  });
  console.log(
    'COMPLETE literal recap, atomic ending, cancelled preparation, historic handoff, saved visit and Fresh edit',
  );
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
