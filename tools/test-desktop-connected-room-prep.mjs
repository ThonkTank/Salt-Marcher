import { openDesktopKeyReferences } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, appendFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out =
  process.argv.find((x) => x.startsWith('--out='))?.slice(6) ?? '/tmp/salt-connected-room-prep';
await mkdir(out, { recursive: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/case21-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/case21-store.cjs');
const profile = await mkdtemp('/tmp/gm-connected-room-'),
  file = profile + '/workbench.sqlite';
const rooms = ['Torhalle', 'Wachstube'].map((name, i) => ({
  id: randomUUID(),
  scopeId: 'local',
  floorId: 'ground',
  number: String(i + 1),
  name,
  revision: 0,
  polygons: [
    {
      outer: [
        { x: i * 9, y: 0 },
        { x: i * 9 + 6, y: 0 },
        { x: i * 9 + 6, y: 6 },
        { x: i * 9, y: 6 },
      ],
      holes: [],
    },
  ],
  sections: [
    { id: randomUUID(), kind: 'markdown', markdown: 'Original ' + name + '\r\n  Raumtext.' },
  ],
}));
const store = new CampaignStore(file),
  campaign = store.create('Die widersprüchliche Nachtwache', rooms),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
const make = (title, kind, gmNotes) => ({
  version: 1,
  id: randomUUID(),
  revision: 1,
  title,
  kind,
  readAloud: '',
  gmNotes,
  relations: [],
  creatureId: null,
  deleted: false,
});
const nera = make(
  'Nera die Quartiermeisterin',
  'npc',
  'Nera kennt die Kellertür hinter der Torhalle. Sie fordert ihren ausstehenden Sold.\r\n',
);
const tarek = make(
  'Tarek die Torwache',
  'npc',
  'Tarek behauptet, die Kellertür sei zugemauert. Er hat die neue Lieferung nicht geprüft.\r\n',
);
const clue = make(
  'Das Zeichen an der Lieferkiste',
  'rumor',
  'Die blaue Kiste trägt ein silbernes Schlüsselsymbol. Nur Nera kennt den Empfänger.\r\n',
);
for (const note of [nera, tarek, clue])
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
const plan = {
  version: 1,
  id: randomUUID(),
  revision: 1,
  name: 'Nachtwache · Tor und Keller',
  scenes: rooms.map((r) => ({ id: randomUUID(), title: r.name, notes: '', locationId: null })),
};
store.changePreparation({
  ...command(null),
  change: { kind: 'plan', expectedRevision: null, plan },
});
for (const [i, r] of rooms.entries())
  store.executeDrawing(
    command({
      kind: 'key-batch',
      rooms: [{ id: r.id, expectedRevision: 0, keyRevision: null }],
      patch: {
        references: [
          { kind: 'npc', id: nera.id, label: nera.title },
          ...(i === 1
            ? [{ kind: 'npc', id: tarek.id, label: tarek.title }]
            : [{ kind: 'rumor', id: clue.id, label: clue.title }]),
          { kind: 'plan', id: plan.id, label: plan.name },
        ],
      },
    }),
  );
const heroes = ['Ada', 'Borin'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  ),
  scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
for (const h of heroes) {
  const v = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: h.id,
      expectedRevision: 0,
      expectedRosterRevision: v.rosterRevision,
      active: true,
      targetSceneId: scene.id,
      expectedFocusRevision: v.focusRevision,
    }),
  );
}
const initial = store.preparation(w.token),
  initialClock = store.live(w.token).scene.clock;
store.close();
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const hashes = {};
for (const n of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  hashes[n] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + n))
    .digest('hex');
await writeFile(
  out + '/fixture.json',
  JSON.stringify(
    {
      source,
      dirty,
      profile,
      file,
      campaign,
      rooms,
      nera,
      tarek,
      clue,
      plan,
      initialClock,
      hashes,
    },
    null,
    2,
  ),
);
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
let app, page;
const launches = [],
  errors = [];
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
  });
  launches.push({ pid: app.process().pid });
  page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('#campaign-screen-list article')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  return await snapshot();
}
async function tab(id) {
  if (!(await page.locator(id).isVisible())) await page.locator('#workspace-nav-summary').click();
  await page.locator(id).click();
}
async function shot(name) {
  await page.screenshot({ path: out + '/' + name + '.png' });
  return out + '/' + name + '.png';
}
async function snapshot() {
  return await page.locator('body').innerText();
}
async function close() {
  const exited = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  launches.at(-1).exit = await exited;
  launches.at(-1).mainPidAbsent = await stat('/proc/' + launches.at(-1).pid)
    .then(() => false)
    .catch(() => true);
  await writeFile(out + '/processes.json', JSON.stringify({ launches, errors }, null, 2));
  return launches.at(-1);
}

const roomText = {
  Wachstube: {
    public: 'Eine rußige Laterne beleuchtet den Wachttisch. Tarek stellt seinen Becher ab.',
    private:
      'Tarek behauptet, die Kellertür sei zugemauert.\nNera kennt den Zugang; beide Aussagen vor dem Gespräch vergleichen.\nDas Schlüsselsymbol auf der Kiste nicht ungefragt verraten.',
  },
  Torhalle: {
    public: 'Am Westtor steht eine blaue Lieferkiste. Auf dem Deckel glänzt ein silbernes Zeichen.',
    private:
      'Die Kiste führt zur Kellertür. Erst mit Nera verhandeln, dann Tareks widersprüchliche Aussage prüfen.',
  },
};
const visitText = {
  Torhalle: {
    private:
      'Die Gruppe untersucht die Lieferkiste. Nach dem Zeichen fragen; Nera nennt ihren Sold.',
    public: 'Die Nachtwache lässt euch eintreten. Aus der blauen Kiste riecht es nach Lampenöl.',
  },
  Wachstube: {
    private:
      'Tarek mit Lieferkiste und Neras Aussage konfrontieren. Die Kellertür erst danach prüfen.',
    public: 'Tarek behauptet: Hinter diesem Tor gibt es seit Jahren keinen Keller mehr.',
  },
};
const title = 'Neras Kellerschlüssel abholen',
  summary =
    'Die Gruppe hat Neras Sold bezahlt.\nNera öffnet die Kellertür beim nächsten Glockenschlag.\nTareks Behauptung war veraltet.',
  extended = summary + '\nAbholung vor dem zweiten Glockenschlag.',
  recap =
    'Die Gruppe hat den Sold bezahlt und Tareks Irrtum erkannt. Die Kellertür bleibt bis zum Glockenschlag geschlossen.',
  handoff =
    'Am Westtor bei Nera beginnen. Den Kellerschlüssel abholen und die blaue Lieferkiste prüfen.';
let stage = 'launch',
  closed = true;
const results = {};
const assert = (await import('node:assert/strict')).default;
async function chooseRoom(name) {
  await page.locator('#key-search').fill(name);
  const number = name === 'Torhalle' ? 1 : 2;
  await page
    .locator('#key-room-list button')
    .filter({ hasText: new RegExp('^(?:Ohne Geometrie · )?' + number + '[.] ' + name) })
    .click();
}
async function openKey(name) {
  await tab('#atlas-tab');
  if (await page.locator('#campaign-atlas').isVisible()) {
    await page.locator('#atlas-families button[data-family=interior]').click();
    if ((await page.locator('#atlas-advanced').getAttribute('open')) === null)
      await page.locator('#atlas-advanced > summary').click();
  }
  await page.locator('#key-open').click();
  await chooseRoom(name);
}
async function refs() {
  if (!(await page.locator('#key-references').isVisible())) await openDesktopKeyReferences(page);
}
async function readSource(note) {
  await refs();
  await page
    .locator('#key-references')
    .getByRole('button', { name: note.title, exact: true })
    .click();
  assert.equal(await page.locator('#note-gm').inputValue(), note.gmNotes.replace(/\r\n/g, '\n'));
  await page.locator('#key-reference-return').click();
  await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
}
async function authorRoom(name) {
  await page.locator('#key-read-aloud').fill(roomText[name].public);
  await page.locator('#key-gm-notes').fill(roomText[name].private);
  await page.waitForFunction(
    () => document.querySelector('#key-save-status').dataset.state === 'saved',
  );
  await refs();
}
async function chooseVisit(name) {
  await page.locator('#scene-list button').filter({ hasText: name }).click();
  await page.waitForFunction((name) => document.querySelector('#scene-title').value === name, name);
}
async function authorVisit(name) {
  await chooseVisit(name);
  await page.locator('#scene-notes').fill(visitText[name].private);
  await page.locator('#visit-read-aloud').fill(visitText[name].public);
}
async function linkNotes(notes) {
  if (!(await page.locator('#visit-note-search').isVisible()))
    await page.getByText('Verknüpftes Weltwissen', { exact: true }).click();
  for (const note of notes) {
    await page.locator('#visit-note-search').fill(note.title);
    await page
      .locator('#visit-note-results article')
      .filter({ hasText: note.title })
      .getByRole('button', { name: 'Notiz lesen: ' + note.title, exact: true })
      .click();
    await page
      .locator('#visit-note-detail')
      .getByRole('button', { name: 'Mit diesem Besuch verknüpfen', exact: true })
      .click();
    await page
      .locator('#visit-note-detail')
      .getByRole('button', { name: 'Verknüpfung zu diesem Besuch lösen', exact: true })
      .waitFor({ state: 'visible' });
  }
}
async function followPlan() {
  await refs();
  await page
    .locator('#key-references')
    .getByRole('button', { name: plan.name, exact: true })
    .click();
  await page.waitForFunction((id) => document.querySelector('#plans').value === id, plan.id);
  await page.locator('#key-plan-return').waitFor({ state: 'visible' });
}
async function checkReturn(name) {
  await page.locator('#key-plan-return').scrollIntoViewIfNeeded();
  await shot('plan-return-control');
  await page.locator('#key-plan-return').click();
  await page.locator('#key-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#key-search').inputValue(), name);
  assert.equal(await page.locator('#key-gm-notes').inputValue(), roomText[name].private);
  assert(await page.locator('#key-gm-notes').evaluate((e) => document.activeElement === e));
}
try {
  await launch();
  closed = false;
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  stage = 'author room and compare sources before first Preparation';
  await openKey('Wachstube');
  await authorRoom('Wachstube');
  await readSource(nera);
  await readSource(tarek);
  await shot('watch-room-written');
  stage = 'ordinary planning after first key note lookup';
  await page.locator('#key-close').click();
  await tab('#preparation-tab');
  await page.locator('#preparation-planning').click();
  await page.waitForFunction(
    (id) => [...document.querySelector('#plans').options].some((o) => o.value === id),
    plan.id,
  );
  results.planningAvailableWithoutRestart = true;
  stage = 'follow plan and return with pending visit prose';
  await openKey('Wachstube');
  await refs();
  await followPlan();
  await authorVisit('Wachstube');
  await checkReturn('Wachstube');
  results.roomAndPendingPlanDraftPreserved = true;
  await shot('returned-watch-room');
  stage = 'author second room and its plan';
  await chooseRoom('Torhalle');
  await authorRoom('Torhalle');
  await readSource(clue);
  await followPlan();
  await authorVisit('Torhalle');
  await linkNotes([nera, clue]);
  await chooseVisit('Wachstube');
  assert.equal(await page.locator('#scene-notes').inputValue(), visitText.Wachstube.private);
  assert.equal(await page.locator('#visit-read-aloud').inputValue(), visitText.Wachstube.public);
  await linkNotes([tarek, nera]);
  stage = 'use both visit packets';
  await chooseVisit('Torhalle');
  await page.locator('#session-packet-open').click();
  await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
  await page
    .locator('#session-packet-dialog')
    .getByRole('button', { name: 'Nächster Besuch', exact: true })
    .click();
  await page
    .locator('#session-packet-content')
    .getByRole('heading', { name: tarek.title + ' · npc', exact: true })
    .waitFor({ state: 'visible' });
  await shot('watch-packet');
  await page
    .locator('#session-packet-dialog')
    .getByRole('button', { name: 'Voriger Besuch', exact: true })
    .click();
  await page.getByRole('button', { name: 'Am Spieltisch prüfen…', exact: true }).click();
  await page.locator('#adoption-dialog').waitFor({ state: 'visible' });
  await page.locator('#adoption-confirm-packet').click();
  await page.locator('#live-packet-host').waitFor({ state: 'visible' });
  if (await page.locator('#live-session-start').isVisible())
    await page.locator('#live-session-start').click();
  stage = 'record actual outcome and quest';
  const block = page
    .locator('#session-packet-content .packet-block')
    .filter({ has: page.getByRole('heading', { name: nera.title + ' · npc', exact: true }) });
  await block.getByRole('button', { name: 'Als Chronikmoment vormerken', exact: true }).click();
  await page.locator('#live-moment-title').fill(title);
  await page.locator('#live-moment-summary').fill(summary);
  await page.locator('#live-moment-follow-up').selectOption('quest');
  await page.locator('#live-moment-save').click();
  await page.locator('#live-moment-follow-up-open').click();
  await page.locator('#relation-target').selectOption({ label: nera.title });
  await page.locator('#relation-label').fill('Zusage von');
  await page.locator('#relation-add').click();
  stage = 'finish and prepare handoff';
  await tab('#live-tab');
  await page.locator('#live-session-end').click();
  await page.locator('#live-session-close-dialog').waitFor({ state: 'visible' });
  await page.locator('#live-session-close-summary').fill(recap);
  await page.locator('#live-session-close-handoff').fill(handoff);
  await page.locator('#live-session-close-prepare').click();
  await page.locator('#handoff-visit-dialog').waitFor({ state: 'visible' });
  await page.locator('#handoff-visit-plan').selectOption('');
  await page.locator('#handoff-visit-title').fill('Rückkehr zur Kellertür');
  await page
    .locator('#handoff-visit-read-aloud')
    .fill('Die Glocke am Westtor schlägt. Nera wartet bereits an der Lieferkiste.');
  await page.locator('#handoff-visit-open').click();
  await page.locator('#handoff-visit-dialog').waitFor({ state: 'hidden' });
  await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
  await page.locator('#session-packet-close').click();
  await page.locator('#preparation-knowledge').click();
  await page.locator('#world-search').fill(title);
  await page.locator('#world-list').getByRole('button', { name: title, exact: true }).click();
  await page.locator('#note-thread-open').click();
  await page.locator('#note-thread-plan').selectOption({ label: 'Nächster Spielabend' });
  await page.locator('#note-thread-visit').selectOption({ label: 'Rückkehr zur Kellertür' });
  const n = page.locator('#note-thread-sources input[data-thread-source][value="' + nera.id + '"]');
  if ((await n.count()) && (await n.isChecked())) await n.uncheck();
  await page.locator('#note-thread-use').click();
  await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
  await close();
  closed = true;
  stage = 'fresh find edit and use same original';
  await launch();
  closed = false;
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  await tab('#preparation-tab');
  await page.locator('#preparation-knowledge').click();
  await page.locator('#world-search').fill(title);
  await page.locator('#world-list').getByRole('button', { name: title, exact: true }).click();
  assert.equal(await page.locator('#note-gm').inputValue(), summary);
  await page.locator('#note-gm').fill(extended);
  await page.locator('#preparation-planning').click();
  await page.locator('#plans').selectOption({ label: 'Nächster Spielabend' });
  await chooseVisit('Rückkehr zur Kellertür');
  await page.locator('#session-packet-open').click();
  const deadline = page
    .locator('#session-packet-content')
    .getByText('Abholung vor dem zweiten Glockenschlag.', { exact: false });
  await deadline.waitFor({ state: 'visible' });
  await deadline.click();
  await shot('fresh-handoff-original-extended');
  await page.locator('#session-packet-close').click();
  await openKey('Wachstube');
  assert.equal(await page.locator('#key-read-aloud').inputValue(), roomText.Wachstube.public);
  assert.equal(await page.locator('#key-gm-notes').inputValue(), roomText.Wachstube.private);
  await page.locator('#key-close').click();
  await close();
  closed = true;
  results.fullTaskAndFreshComplete = true;
  stage = '200percent contextual return';
  await launch();
  closed = false;
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .webContents.setZoomFactor(2),
  );
  await page.waitForFunction(
    () =>
      innerWidth < 900 &&
      document.querySelector('#workspace-nav-summary').getBoundingClientRect().width > 0,
  );
  await openKey('Wachstube');
  await followPlan();
  await page.locator('#key-plan-return').scrollIntoViewIfNeeded();
  results.returnAt200 = await page.locator('#key-plan-return').evaluate((b) => {
    const r = b.getBoundingClientRect();
    return {
      visible:
        r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
      uncovered: b.contains(
        document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2),
      ),
    };
  });
  assert(results.returnAt200.visible && results.returnAt200.uncovered);
  await writeFile(
    out + '/plan-return-200.png',
    Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        )
          .toPNG()
          .toString('base64'),
      ),
      'base64',
    ),
  );
  await checkReturn('Wachstube');
  await page.locator('#key-close').click();
  await close();
  closed = true;
  stage = 'verify canonical outcome';
  const final = new CampaignStore(file);
  try {
    const fw = final.activate(campaign.id),
      prep = final.preparation(fw.token),
      q = prep.notes.filter((r) => r.note.title === title),
      next = prep.plans.filter((p) => p.name === 'Nächster Spielabend');
    assert.equal(q.length, 1);
    assert.equal(next.length, 1);
    assert.equal(q[0].note.gmNotes, extended);
    assert(final.session(fw.token, next[0].id).visits[0].noteIds.includes(q[0].note.id));
    for (const note of [nera, tarek, clue])
      assert.deepEqual(prep.notes.find((r) => r.note.id === note.id).note, note);
    assert.deepEqual(
      final.workspace().rooms.map((r) => r.sections),
      rooms.map((r) => r.sections),
    );
    const events = final.chronicle(fw.token).entries;
    assert.equal(events.filter((e) => e.followUp?.id === q[0].note.id).length, 1);
    assert(
      events.some((e) => e.sessionMarker === 'end' && e.handoff === handoff && e.summary === recap),
    );
    assert.deepEqual(final.live(fw.token).scene.clock, initialClock);
    results.questId = q[0].note.id;
    results.nextPlanId = next[0].id;
    results.originalSourcesAndClockUnchanged = true;
  } finally {
    final.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    out + '/result.json',
    JSON.stringify({ source, dirty, profile, stage, results, launches, errors, hashes }, null, 2),
  );
  console.log(
    'COMPLETE connected-room preparation, plan return, live outcome, handoff and Fresh; bounded200% return separately checked.',
  );
} catch (error) {
  if (page) await shot('failure').catch(() => {});
  await writeFile(
    out + '/failure.json',
    JSON.stringify(
      {
        source,
        dirty,
        profile,
        stage,
        error: error.stack,
        results,
        launches,
        errors,
        text: await snapshot().catch(() => ''),
        hashes,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (!closed) await close().catch(() => {});
  proxy.kill();
  await writeFile(out + '/cleanup.json', JSON.stringify({ closed, launches, errors }, null, 2));
}
