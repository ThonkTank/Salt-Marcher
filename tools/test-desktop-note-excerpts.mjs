import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, appendFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out = process.env.GM_QA_OUT ?? (await mkdtemp('/tmp/gm-note-excerpts-evidence-'));
await mkdir(out, { recursive: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-excerpts-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/note-excerpts-native-store.cjs');
const profile = await mkdtemp('/tmp/gm-session-log-'),
  file = profile + '/workbench.sqlite';
const rooms = [
  {
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Fährsteg',
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
    sections: [],
  },
];
const store = new CampaignStore(file),
  campaign = store.create('Das erloschene Ufer', rooms),
  w = store.activate(campaign.id);
const raw =
  '# Nacht am Grauen Ufer – unbearbeitetes Spielprotokoll\r\n\r\n22:05 – Siv die Fährfrau hat Ada heimlich übergesetzt. Ihr Bruder sitzt im alten Leuchtturm fest. Sie verlangt kein Geld, sondern ein Lebenszeichen. Niemand soll erfahren, dass sie nachts rudert.\r\n\r\n22:25 – Ein Beobachter nennt sich Bruder der Bruderschaft vom Grauen Ufer. Die Bruderschaft bewacht das Signalfeuer und hält Reisende fern. Ihr Treffpunkt ist die alte Salzscheune.\r\n\r\n22:40 – Seit drei Nächten bleibt das Signalfeuer dunkel. Ada versprach Siv, den Bruder zu suchen und bis zur nächsten Flut ein Zeichen vom Turm zu senden. Offen bleibt, ob der Wärter verschwunden oder übergelaufen ist.\r\n\r\n23:10 – Borin findet eine Kupfermarke im Schlick. Auf ihr stehen drei Kerben und ein Vogelfuß. Laut einem betrunkenen Händler erlaubt sie Zutritt zur Salzscheune; niemand hat das überprüft.\r\n\r\n23:30 – Die Gruppe zieht sich an den Fährsteg zurück. Nächstes Mal: erst Siv aufsuchen, dann über die Kupfermarke entscheiden. Das Versprechen läuft mit der nächsten Flut ab.\r\n';
const sourceNote = {
  version: 1,
  id: randomUUID(),
  revision: 1,
  title: 'Nacht am Grauen Ufer · Rohprotokoll',
  kind: 'note',
  readAloud: '',
  gmNotes: raw,
  relations: [],
  creatureId: null,
  deleted: false,
};
store.changePreparation({
  commandId: randomUUID(),
  token: w.token,
  campaignId: campaign.id,
  change: { kind: 'note', expectedRevision: null, note: sourceNote },
});
store.close();
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  hashes = {};
for (const n of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  hashes[n] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + n))
    .digest('hex');
const fixture = { source, dirty, profile, file, campaign, rooms, sourceNote, raw, hashes };
await writeFile(out + '/fixture.json', JSON.stringify(fixture, null, 2));
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
let app, page, nativeProcess;
const launches = [],
  errors = [];
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
  });
  nativeProcess = app.process();
  launches.push({ pid: nativeProcess.pid });
  page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await app.evaluate(
    ({ BrowserWindow }, zoom) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.setZoomFactor(zoom),
    Number(process.env.GM_QA_ZOOM ?? 1),
  );
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  return await snapshot();
}
async function tab(id) {
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') &&
      !document.querySelector('#workspace-navigation').inert,
  );
  if (
    !(await page.locator(id).isVisible()) &&
    (await page.locator('#atlas-navigation').isVisible())
  )
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator(id).isVisible())) await page.locator('#workspace-nav-summary').click();
  await page.locator(id).click();
}
async function shot(name) {
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.capturePage()
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(out + '/' + name + '.png', Buffer.from(png, 'base64'));
  return out + '/' + name + '.png';
}
async function snapshot() {
  return await page.locator('body').innerText();
}
async function close() {
  const exited = new Promise((r) =>
    nativeProcess.once('exit', (code, signal) => r({ code, signal })),
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
const tasks = [
  [
    'Siv die Fährfrau',
    'npc',
    'Lebenszeichen',
    'Nächster Abend: Siv wartet am Fährsteg auf ein Signal vom Turm.',
  ],
  [
    'Bruderschaft vom Grauen Ufer',
    'faction',
    'Salzscheune',
    'Nächster Abend: Nach dem Erkennungszeichen der Bruderschaft fragen.',
  ],
  [
    'Das verschwundene Signalfeuer',
    'quest',
    'Wärter',
    'Nächster Abend: Vor der Flut ein Lebenszeichen vom Bruder sichern.',
  ],
  [
    'Kupfermarke im Schlick',
    'rumor',
    'Vogelfuß',
    'Nächster Abend: Die drei Kerben an der Scheunentür prüfen.',
  ],
];
const results = [];
async function record(stage, value) {
  await appendFile(
    out + '/ui-trace.jsonl',
    JSON.stringify({ at: new Date().toISOString(), stage, ...value }) + '\n',
  );
}
async function openCampaign() {
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await tab('#preparation-tab');
}
try {
  await launch();
  await openCampaign();
  await page.locator('#world-search').fill(sourceNote.title);
  await page
    .locator('#world-list')
    .getByRole('button', { name: /^Nacht am Grauen Ufer/ })
    .click();
  await page.waitForFunction(
    (t) => document.getElementById('note-title').value === t,
    sourceNote.title,
  );
  if ((await page.locator('#note-kind').innerText()) !== 'Notiz')
    throw Error('Generic log kind missing');
  for (const [j, [title, kind]] of tasks.entries()) {
    const a = page.locator('#note-gm');
    await a.click();
    await a.press('Control+Home');
    for (let k = 0; k < 2 + 2 * j; k++) await a.press('Control+ArrowDown');
    await a.press('Control+Shift+ArrowDown');
    if (await page.locator('#note-text-tools').evaluate((e) => e.open))
      throw Error('Selection required opening text tools');
    await page.locator('#note-excerpt').waitFor({ state: 'visible' });
    await a.press('Tab');
    if ((await page.evaluate(() => document.activeElement.id)) !== 'note-excerpt')
      throw Error('Selection action is not keyboard-adjacent');
    await page.keyboard.press('Enter');
    await page.locator('#note-excerpt-dialog').waitFor({ state: 'visible' });
    const text = await page.locator('#note-excerpt-text').inputValue();
    if (!text.includes(raw.split('\r\n\r\n')[j + 1].trim()))
      throw Error('Incomplete selected paragraph: ' + title);
    await page.locator('#note-excerpt-kind').selectOption(kind);
    await page.locator('#note-excerpt-title').fill(title);
    if (j === 0) await shot('excerpt-dialog');
    await page.locator('#note-excerpt-save').click();
    await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
    await page
      .locator('#note-excerpt-status')
      .getByText('Neue Notiz öffnen', { exact: true })
      .waitFor();
    if (
      (await page.locator('#note-title').inputValue()) !== sourceNote.title ||
      (await a.inputValue()) !== raw.replace(/\r\n/g, '\n')
    )
      throw Error('Original editor or source prose changed');
    results.push({ title, kind, text });
    await record('excerpt-created', { title, kind, sourceEditorPreserved: true });
  }
  await page.locator('#note-thread-prepare').click();
  await page
    .locator('#note-thread-sources')
    .getByText('Kupfermarke im Schlick', { exact: true })
    .waitFor();
  if ((await page.locator('#note-thread-sources article').count()) !== 4)
    throw Error('Notebook needs extra manual source links');
  await shot('four-auto-linked-sources');
  await page.locator('#note-thread-plan-name').fill('Nächste Flut');
  await page.locator('#note-thread-visit-title').fill('Fährsteg · Siv und die Kupfermarke');
  await page.locator('#note-thread-use').click();
  await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
  await page.locator('#session-packet-open').click();
  await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
  const firstPacket = await page.locator('#session-packet-content').innerText();
  for (const [title] of tasks)
    if (!firstPacket.includes(title)) throw Error('Missing source ' + title);
  if ((await page.locator('#session-packet-content .packet-block').count()) !== 5)
    throw Error('Private source sections remain fragmented');
  await writeFile(out + '/packet-before-fresh.txt', firstPacket);
  await shot('packet-before-fresh');
  await page.locator('#session-packet-close').click();
  await close();
  await launch();
  await openCampaign();
  await page.locator('#preparation-knowledge').click();
  for (const [title, kind, query, extra] of tasks) {
    await page.locator('#world-search').fill(query);
    await page
      .locator('#world-list')
      .getByRole('button', { name: new RegExp('^' + title) })
      .click();
    await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
    const a = page.locator('#note-gm');
    await a.press('Control+End');
    await a.press('Enter');
    await a.press('Enter');
    await page.keyboard.type(extra, { delay: 5 });
    await page.locator('#note-title').click();
    await record('fresh-find-edit', { title, query, extra });
  }
  await page
    .locator('#note-relations')
    .getByRole('button', { name: 'Quelle: Nacht am Grauen Ufer · Rohprotokoll', exact: true })
    .click();
  await page.waitForFunction(
    (t) => document.getElementById('note-title').value === t,
    sourceNote.title,
  );
  if ((await page.locator('#note-gm').inputValue()) !== raw.replace(/\r\n/g, '\n'))
    throw Error('Raw log changed after Fresh edits');
  await page.locator('#preparation-planning').click();
  await page.locator('#session-packet-open').click();
  await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
  const finalPacket = await page.locator('#session-packet-content').innerText();
  for (const [title, , , extra] of tasks)
    if (!finalPacket.includes(extra)) throw Error('Stale reused source ' + title);
  if ((await page.locator('#session-packet-content .packet-block').count()) !== 5)
    throw Error('Packet has duplicate source groups');
  if ((await page.locator('#session-packet-content .packet-source-actions button').count()) !== 5)
    throw Error('Repeated source editor actions');
  await writeFile(out + '/packet-after-fresh.txt', finalPacket);
  await shot('packet-after-fresh');
  if (!(await page.locator('#session-packet-search').isVisible()))
    await page.locator('#session-packet-index summary').click();
  await page.locator('#session-packet-search').fill('Erkennungszeichen');
  const faction = page
    .locator('#session-packet-content .packet-block')
    .filter({ hasText: 'Nächster Abend: Nach dem Erkennungszeichen der Bruderschaft fragen.' });
  await faction.getByRole('button', { name: 'Original bearbeiten…', exact: true }).click();
  await page.locator('#packet-note-content #note-title').waitFor({ state: 'visible' });
  if ((await page.locator('#note-title').inputValue()) !== 'Bruderschaft vom Grauen Ufer')
    throw Error('Grouped original editor opens wrong identity');
  await shot('search-to-original-editor');
  await page.locator('#packet-note-return').click();
  await page.locator('#packet-note-editor').waitFor({ state: 'hidden' });
  await page.locator('#session-packet-close').click();
  await close();
  const db = require('better-sqlite3')(file, { readonly: true });
  let audit;
  try {
    const notes = db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND trashed=0')
        .all(campaign.id)
        .map((r) => JSON.parse(r.payload)),
      original = notes.find((n) => n.id === sourceNote.id);
    if (
      notes.length !== 5 ||
      original.gmNotes !== raw ||
      original.readAloud !== '' ||
      original.kind !== 'note' ||
      original.relations.length !== 4
    )
      throw Error('Canonical original/identity mismatch');
    for (const [title, kind, , extra] of tasks) {
      const n = notes.find((n) => n.title === title);
      if (
        !n ||
        n.kind !== kind ||
        n.readAloud !== '' ||
        !n.gmNotes.includes(extra) ||
        n.relations.length !== 1 ||
        n.relations[0].targetId !== sourceNote.id
      )
        throw Error('Canonical excerpt mismatch ' + title);
    }
    const plans = db.prepare('SELECT id FROM plan WHERE campaign_id=?').all(campaign.id),
      visits = db.prepare('SELECT payload FROM planned_visit WHERE campaign_id=?').all(campaign.id);
    if (plans.length !== 1 || visits.length !== 1) throw Error('Duplicate next-evening handoff');
    const detail = db
      .prepare('SELECT payload FROM session_visit WHERE campaign_id=?')
      .all(campaign.id)
      .map((r) => JSON.parse(r.payload));
    if (
      detail.length !== 1 ||
      detail[0].noteIds.length !== 5 ||
      new Set(detail[0].noteIds).size !== 5
    )
      throw Error('Visit source identities mismatch');
    audit = {
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        kind: n.kind,
        revision: n.revision,
        relations: n.relations,
      })),
      plans,
      visits,
      detail,
      rawBytesEqual: true,
    };
  } finally {
    db.close();
  }
  const result = {
    complete: true,
    source,
    dirty,
    hashes,
    profile,
    file,
    zoom: Number(process.env.GM_QA_ZOOM ?? 1),
    task: 'Rawlog to4typedreusable notes withprovenance,sourceoverview,nextplan,normalFresh,fulltextfind/edit,liveupdatedpacket andcorrectoriginaleditor',
    results,
    audit,
    packetPrivateGroups: 5,
    sourceEditorActions: 5,
    launches,
    errors,
    humanAcceptance: false,
    installedPackageAcceptance: false,
    completedAt: new Date().toISOString(),
  };
  if (errors.length || launches.some((l) => l.exit?.code !== 0 || !l.mainPidAbsent))
    throw Error('Native process or UI error');
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ complete: true, out, profile, launches, errors }));
} catch (error) {
  await writeFile(
    out + '/failure.json',
    JSON.stringify({ error: error.stack, profile, source, dirty, launches, errors }, null, 2),
  );
  throw error;
} finally {
  if (nativeProcess?.exitCode === null) await close();
  proxy.kill();
}
