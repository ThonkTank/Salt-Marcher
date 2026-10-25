import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, stat, copyFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out = path.resolve(process.env.GM_QA_OUT ?? '/tmp/gm-source-inspection-after');
await mkdir(out, { recursive: true });
if (!process.env.GM_QA_START_RESULT)
  throw Error(
    'GM_QA_START_RESULT must identify a closed, completed second-session native fixture.',
  );
const resultPath = path.resolve(process.env.GM_QA_START_RESULT),
  completed = JSON.parse(await readFile(resultPath, 'utf8')),
  initial = JSON.parse(await readFile(path.dirname(resultPath) + '/fixture.json', 'utf8'));
if (!completed.complete || completed.launches?.some((l) => !l.mainPidAbsent || l.exit?.code !== 0))
  throw Error('First-session fixture was not normally closed.');
const profile = await mkdtemp('/tmp/gm-session-followup-'),
  file = profile + '/workbench.sqlite';
await copyFile(completed.file, file);
const campaign = initial.campaign,
  rooms = initial.rooms,
  sourceNote = initial.sourceNote,
  raw = initial.raw;
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

const starting = () => {
  const db = require('better-sqlite3')(file, { readonly: true });
  try {
    return {
      notes: db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND trashed=0')
        .all(campaign.id)
        .map((r) => JSON.parse(r.payload)),
      plans: db.prepare('SELECT * FROM plan WHERE campaign_id=?').all(campaign.id),
      visits: db.prepare('SELECT * FROM planned_visit WHERE campaign_id=?').all(campaign.id),
      bindings: db.prepare('SELECT * FROM session_visit WHERE campaign_id=?').all(campaign.id),
    };
  } finally {
    db.close();
  }
};
const before = starting(),
  inspections = [],
  fresh = [];
const sivCorrection =
    'Quellenprüfung: „sitzt im Leuchtturm fest“ stammt aus der ersten Nacht; seit 20:15 der zweiten Nacht gilt: freiwillig fort, Versteck geheim.',
  questCorrection =
    'Quellenprüfung: Die Schatulle ist nur angekündigt („soll ... liegen“); Inhalt und Siegel sind noch unbestätigt.';
async function enter() {
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await page.locator('#preparation-tab').waitFor({ state: 'attached' });
  await page.waitForFunction(
    () => document.getElementById('campaign-header-name').textContent === 'Das erloschene Ufer',
  );
  await tab('#preparation-tab');
  await page.locator('#preparation-knowledge').click();
}
async function findNote(title, query = title) {
  await page.locator('#world-search').fill(query);
  await page
    .locator('#world-list')
    .getByRole('button', { name: new RegExp('^' + title) })
    .click();
  await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
}
async function inspectSource(origin, title, expected, name, scroll = 0) {
  const a = page.locator('#note-gm'),
    prior = await a.inputValue(),
    query = await page.locator('#world-search').inputValue();
  await a.click();
  await a.press('Control+Home');
  await a.press('ArrowRight');
  const selection = await a.evaluate((e) => [e.selectionStart, e.selectionEnd]);
  await page.getByRole('button', { name: 'Ansehen: Quelle: ' + title, exact: true }).click();
  await page.locator('#quick-reference').waitFor({ state: 'visible' });
  await page.locator('#quick-document h2').waitFor();
  await page.waitForFunction(
    (t) => document.querySelector('#quick-document h2')?.textContent === t,
    title,
  );
  const text = await page.locator('#quick-document').innerText();
  if (!text.includes(expected)) throw Error('Source passage unavailable ' + expected);
  await page.locator('#quick-document .quick-text').first().scrollIntoViewIfNeeded();
  if (scroll) {
    await page.locator('#quick-document').hover();
    await page.mouse.wheel(0, scroll);
  }
  await shot(name);
  await page.locator('#quick-close').click();
  await page.locator('#quick-reference').waitFor({ state: 'hidden' });
  const afterSelection = await a.evaluate((e) => [e.selectionStart, e.selectionEnd]);
  if (
    (await page.locator('#note-title').inputValue()) !== origin ||
    (await page.locator('#world-search').inputValue()) !== query ||
    (await a.inputValue()) !== prior ||
    JSON.stringify(selection) !== JSON.stringify(afterSelection)
  )
    throw Error('Inspection displaced original editor/input/query/caret');
  inspections.push({
    origin,
    title,
    expected,
    editorUnchanged: true,
    queryPreserved: true,
    caretPreserved: true,
    text,
  });
}
async function append(text) {
  await page.locator('#note-gm').click();
  await page.locator('#note-gm').press('Control+End');
  await page.locator('#note-gm').press('Enter');
  await page.locator('#note-gm').press('Enter');
  await page.keyboard.type(text);
  await page.locator('#note-title').click();
}
async function evenings(prefix) {
  await page.locator('#preparation-planning').click();
  for (const title of ['Die Salzscheune', 'Nächste Flut']) {
    await page.locator('#plans').selectOption({ label: title });
    await page.locator('#session-packet-open').click();
    await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
    const text = await page.locator('#session-packet-dialog').innerText();
    if (
      !text.includes(sivCorrection) ||
      (title === 'Die Salzscheune' && !text.includes(questCorrection))
    )
      throw Error('Evening missing correction ' + title);
    await writeFile(
      out + '/' + prefix + '-' + (title === 'Die Salzscheune' ? 'next' : 'old') + '-evening.txt',
      text,
    );
    await shot(prefix + '-' + (title === 'Die Salzscheune' ? 'next' : 'old'));
    await page.locator('#session-packet-close').click();
  }
}
try {
  await launch();
  await enter();
  await findNote('Siv die Fährfrau');
  await inspectSource(
    'Siv die Fährfrau',
    'Nacht am Grauen Ufer · Rohprotokoll',
    'Ihr Bruder sitzt im alten Leuchtturm fest.',
    'older-source',
  );
  await inspectSource(
    'Siv die Fährfrau',
    'Zweite Nacht am Grauen Ufer · Rohprotokoll',
    'das Signalfeuer freiwillig verlassen',
    'newer-source',
  );
  await append(sivCorrection);
  await findNote('Der Schrank in der Salzscheune');
  await inspectSource(
    'Der Schrank in der Salzscheune',
    'Zweite Nacht am Grauen Ufer · Rohprotokoll',
    'Darin soll eine versiegelte Schatulle liegen.',
    'quest-source',
    450,
  );
  await append(questCorrection);
  await evenings('before-fresh');
  await close();
  await launch();
  await enter();
  for (const [title, query, expected] of [
    ['Siv die Fährfrau', 'Versteck geheim', sivCorrection],
    ['Der Schrank in der Salzscheune', 'noch unbestätigt', questCorrection],
  ]) {
    await findNote(title, query);
    const text = await page.locator('#note-gm').inputValue();
    if (!text.includes(expected)) throw Error('Fresh refind mismatch ' + title);
    fresh.push({ title, query, text });
  }
  // Re-open a source after Fresh as part of continuing the same verification.
  await inspectSource(
    'Der Schrank in der Salzscheune',
    'Zweite Nacht am Grauen Ufer · Rohprotokoll',
    'Darin soll eine versiegelte Schatulle liegen.',
    'fresh-quest-source',
    450,
  );
  await evenings('fresh');
  await close();
  const after = starting();
  if (after.notes.length !== before.notes.length) throw Error('Note identities changed');
  for (const prior of before.notes) {
    const now = after.notes.find((n) => n.id === prior.id),
      correction =
        prior.title === 'Siv die Fährfrau'
          ? sivCorrection
          : prior.title === 'Der Schrank in der Salzscheune'
            ? questCorrection
            : null;
    if (
      !now ||
      !now.gmNotes.startsWith(prior.gmNotes) ||
      (!correction && JSON.stringify(now) !== JSON.stringify(prior)) ||
      (correction && !now.gmNotes.endsWith(correction)) ||
      JSON.stringify(now.relations) !== JSON.stringify(prior.relations)
    )
      throw Error('Canonical original/source audit mismatch ' + prior.title);
  }
  for (const field of ['plans', 'visits', 'bindings'])
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      throw Error('Plan/use bindings changed');
  const result = {
    complete: true,
    source,
    dirty,
    hashes,
    profile,
    file,
    task: 'Verify Siv older and newer raw sources, correct current interpretation; verify quest uncertainty in raw source; correct quest; normalFresh content refind and use canonical updates in old and next evening.',
    sivCorrection,
    questCorrection,
    inspections,
    fresh,
    launches,
    errors,
    audit: {
      rawLogsAndUnrelatedNotesExact: true,
      editedOriginalIdsRelationsAndLiteralPrefixesPreserved: true,
      bothPlanVisitBindingsExact: true,
    },
    effect:
      'Three baseline editor replacements/backlink returns eliminated with direct existing-reader inspection. Fourth inspection after Fresh also preserves editor, caret and query. Existing shared reader remains scrollable; no pinpoint passage anchors introduced.',
    humanAcceptance: false,
    installedPackageAcceptance: false,
    zoom: Number(process.env.GM_QA_ZOOM ?? 1),
    completedAt: new Date().toISOString(),
  };
  if (errors.length || launches.some((l) => l.exit?.code !== 0 || !l.mainPidAbsent))
    throw Error('UI/process lifecycle mismatch');
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      complete: true,
      out,
      source,
      inspections: inspections.length,
      launches,
      errors,
    }),
  );
} catch (error) {
  if (nativeProcess?.exitCode === null) await shot('failure-visible-state').catch(() => {});
  await writeFile(
    out + '/failure.json',
    JSON.stringify({ error: error.stack, source, dirty, profile, launches, errors }, null, 2),
  );
  throw error;
} finally {
  if (nativeProcess?.exitCode === null) await close();
  proxy.kill();
}
