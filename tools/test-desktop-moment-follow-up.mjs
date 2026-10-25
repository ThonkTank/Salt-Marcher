import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  out = process.argv.find((x) => x.startsWith('--out='))?.slice(6) ?? '/tmp/salt-moment-follow-up';
await mkdir(out, { recursive: true });
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-case17-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/note-case17-store.cjs');
const direct = !process.argv.includes('--legacy-navigation'),
  zoom = Number(process.argv.find((x) => x.startsWith('--zoom='))?.slice(7) ?? 1);
assert([1, 2].includes(zoom), 'Use --zoom=1 or --zoom=2');
const resume = process.argv.find((x) => x.startsWith('--resume='))?.slice(9);
async function newFixture() {
  const profile = await mkdtemp('/tmp/gm-note-case17-'),
    file = profile + '/workbench.sqlite';
  const store = new CampaignStore(file),
    campaign = store.create('Fall 17 · Absprache am Spieltisch'),
    w = store.activate(campaign.id),
    cmd = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const make = (title, kind, gmNotes) => ({
    version: 1,
    id: randomUUID(),
    revision: 1,
    title,
    kind,
    gmNotes,
    readAloud: '  Das Westtor steht offen.\r\n',
    relations: [],
    creatureId: null,
    deleted: false,
  });
  const nera = make(
      'Nera die Quartiermeisterin',
      'npc',
      'Nera verwahrt den silbernen Schlüssel.\r\n',
    ),
    guide = make(
      'Wachwechsel am Westtor',
      'rule',
      '## Vorbereitete Lage\r\nNera verlangt den ausstehenden Sold.\r\nDie Gruppe kann mit ihr über den Schlüssel verhandeln.\r\n',
    );
  for (const note of [nera, guide])
    store.changePreparation({
      ...cmd(null),
      change: { kind: 'note', expectedRevision: null, note },
    });
  const plan = (name, title) => ({
    version: 1,
    id: randomUUID(),
    revision: 1,
    name,
    scenes: [{ id: randomUUID(), title, notes: '  Eigene Besuchsplanung\r\n', locationId: null }],
  });
  const current = plan('Abend 17 · Westtor', 'Mit Nera verhandeln'),
    next = plan('Abend 18 · Nachgang', 'Den silbernen Schlüssel abholen');
  for (const p of [current, next])
    store.changePreparation({
      ...cmd(null),
      change: { kind: 'plan', expectedRevision: null, plan: p },
    });
  let visit = store.session(w.token, current.id).visits[0];
  store.executeSession(
    cmd({
      kind: 'visit',
      planId: current.id,
      expectedRevision: visit.revision,
      detail: { ...visit, noteIds: [guide.id, nera.id] },
    }),
  );
  const heroes = ['Ada', 'Borin'].map(
    (name) => store.executeLive(cmd({ kind: 'create-character', profile: { name } })).character,
  );
  const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
  for (const h of heroes) {
    const v = store.live(w.token);
    store.executeLive(
      cmd({
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
  const initial = {
    notes: store.preparation(w.token).notes,
    current: store.session(w.token, current.id),
    next: store.session(w.token, next.id),
    live: store.live(w.token),
  };
  store.close();
  const title = 'Neras silbernen Schlüssel abholen',
    summary =
      'Die Gruppe begleicht Neras Sold.\nNera verspricht den silbernen Schlüssel zum nächsten Wachwechsel.',
    extended = summary + '\nAbholung vor dem zweiten Glockenschlag.';
  return { profile, file, campaign, current, next, nera, guide, title, summary, extended, initial };
}
const fixture = resume ? JSON.parse(await readFile(resume, 'utf8')) : await newFixture();
const { profile, campaign, current, next, nera, guide, title, summary, extended, initial } =
    fixture,
  file = profile + '/workbench.sqlite';
let priorAttempt = null;
if (resume) {
  assert.equal(fixture.source, source);
  const failurePath = resume.slice(0, resume.lastIndexOf('/')) + '/failure.json';
  const f = JSON.parse(await readFile(failurePath, 'utf8'));
  for (const l of f.launches ?? [])
    assert(
      !(await stat('/proc/' + l.pid)
        .then(() => true)
        .catch(() => false)),
      'Previous native process still live',
    );
  priorAttempt = { failurePath, stage: f.stage, results: f.results, processesAbsent: true };
}
await writeFile(
  out + '/fixture.json',
  JSON.stringify(
    {
      source,
      dirty,
      profile,
      campaign,
      current,
      next,
      nera,
      guide,
      title,
      summary,
      extended,
      initial,
      resumedFrom: resume ?? null,
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
const hashes = {};
for (const f of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  hashes[f] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + f))
    .digest('hex');
let app,
  page,
  closed = true,
  stage = 'launch';
const launches = [],
  errors = [],
  results = priorAttempt ? { ...priorAttempt.results, resumedFrom: priorAttempt } : {};
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
  });
  closed = false;
  launches.push({ pid: app.process().pid });
  page = await app.firstWindow();
  await app.evaluate(
    ({ BrowserWindow }, zoom) =>
      BrowserWindow.getAllWindows()
        .find((x) => x.webContents.getURL().endsWith('/index.html'))
        .webContents.setZoomFactor(zoom),
    zoom,
  );
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('#campaign-screen-list article')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
}
async function tab(id) {
  if (!(await page.locator(id).isVisible())) await page.locator('#workspace-nav-summary').click();
  await page.locator(id).click();
}
async function planning(p) {
  await tab('#preparation-tab');
  await page.locator('#preparation-planning').click();
  await page.locator('#plans').selectOption({ label: p.name });
  await page.locator('#scene-list button').filter({ hasText: p.scenes[0].title }).click();
  await page.waitForFunction(
    (t) => document.querySelector('#scene-title').value === t,
    p.scenes[0].title,
  );
}
async function shot(name) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  if (zoom === 1) await page.screenshot({ path: out + '/' + name + '.png' });
  else {
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
  }
}
async function close() {
  const exit = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((x) => x.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  launches.at(-1).exit = await exit;
  assert.deepEqual(launches.at(-1).exit, { code: 0, signal: null });
  closed = true;
  launches.at(-1).mainPidAbsent = await stat('/proc/' + launches.at(-1).pid)
    .then(() => false)
    .catch(() => true);
}
async function inspectNewNote() {
  await tab('#preparation-tab');
  await page.locator('#preparation-knowledge').click();
  await page.locator('#world-search').fill(title);
  await page.locator('#world-list').getByRole('button', { name: title, exact: true }).click();
  await page.waitForFunction((t) => document.querySelector('#note-title').value === t, title);
}
try {
  await launch();
  if (!resume) {
    stage = 'adopt prepared visit through normal UI';
    await planning(current);
    await page.locator('#session-packet-open').click();
    await page.getByRole('button', { name: 'Am Spieltisch prüfen…', exact: true }).click();
    await page.locator('#adoption-dialog').waitFor({ state: 'visible' });
    await page.locator('#adoption-confirm-packet').click();
    await page.locator('#live-packet-host').waitFor({ state: 'visible' });
    stage = 'begin live session';
    if (await page.locator('#live-session-start').isVisible()) {
      await page.locator('#live-session-start').click();
      await page.waitForFunction(() => !document.querySelector('#live-session-end').hidden);
    }
    stage = 'capture from prepared knowledge';
    const block = page
      .locator('#session-packet-content .packet-block')
      .filter({ has: page.getByRole('heading', { name: guide.title + ' · rule', exact: true }) });
    await block.getByRole('button', { name: 'Als Chronikmoment vormerken', exact: true }).click();
    await page.locator('#live-moment-title').waitFor({ state: 'visible' });
    results.prefilled = {
      title: await page.locator('#live-moment-title').inputValue(),
      summary: await page.locator('#live-moment-summary').inputValue(),
    };
    await shot('capture-prefill');
    stage = 'publish actual outcome as linked quest';
    await page.locator('#live-moment-title').fill(title);
    await page.locator('#live-moment-summary').fill(summary);
    await page.locator('#live-moment-follow-up').selectOption('quest');
    await page.locator('#live-moment-save').click();
    await page.waitForFunction(() => document.querySelector('#live-moment-title').value === '');
    results.savedMessage = await page.locator('#live-moment-result').innerText();
    if (direct) {
      await page.locator('#live-moment-follow-up-open').scrollIntoViewIfNeeded();
      results.directActionVisible = await page
        .locator('#live-moment-follow-up-open')
        .evaluate((button) => {
          const r = button.getBoundingClientRect();
          return (
            r.left >= 0 &&
            r.right <= innerWidth + 1 &&
            r.top >= 0 &&
            r.bottom <= innerHeight + 1 &&
            button.contains(
              document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2),
            )
          );
        });
      assert(results.directActionVisible);
    }
    await shot('moment-saved');
    if (direct) {
      stage = 'open confirmed original directly';
      await page.locator('#live-moment-follow-up-open').click();
      await page.waitForFunction((t) => document.querySelector('#note-title').value === t, title);
      results.directOriginalOpened = true;
    } else if (await page.locator('#session-packet-close').isVisible())
      await page.locator('#session-packet-close').click();
    stage = 'find and organise original follow-up';
    if (!direct) await inspectNewNote();
    assert.equal(await page.locator('#note-gm').inputValue(), summary);
    await page.locator('#relation-target').selectOption({ label: nera.title });
    await page.locator('#relation-label').fill('Absprache mit');
    await page.locator('#relation-add').click();
    await page
      .locator('#note-relations')
      .getByText('Absprache mit', { exact: false })
      .waitFor({ state: 'visible' });
    await shot('quest-original');
  }
  stage = 'prepare next visit with existing quest';
  if (direct) {
    await page.locator('#note-thread-open').click();
    await page.locator('#note-thread-dialog').waitFor({ state: 'visible' });
    await page.locator('#note-thread-plan').selectOption(next.id);
    await page.locator('#note-thread-visit').selectOption(next.scenes[0].id);
    await page
      .locator('#note-thread-sources input[data-thread-source][value=\"' + nera.id + '\"]')
      .uncheck();
    await page.locator('#note-thread-use').scrollIntoViewIfNeeded();
    await shot('existing-note-map-destination');
    await page.locator('#note-thread-use').click();
    await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(
      (t) => document.querySelector('#scene-title').value === t,
      next.scenes[0].title,
    );
    results.existingNoteMapLinkedOriginal = true;
  } else {
    await planning(next);
    if (!(await page.locator('#visit-note-search').isVisible()))
      await page.getByText('Verknüpftes Weltwissen', { exact: true }).click();
    await page.locator('#visit-note-search').fill(title);
    await page
      .locator('#visit-note-results article')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Notiz lesen: ' + title, exact: true })
      .click();
    await page
      .locator('#visit-note-detail')
      .getByRole('button', { name: 'Mit diesem Besuch verknüpfen', exact: true })
      .click();
  }
  await page.locator('#session-packet-open').click();
  await page.waitForFunction(
    (t) =>
      t
        .split('\n')
        .filter(Boolean)
        .every((line) =>
          document.querySelector('#session-packet-content').textContent.includes(line),
        ),
    summary,
  );
  await page.locator('#session-packet-content').getByText(summary, { exact: true }).click();
  await shot('next-evening');
  await page.locator('#session-packet-close').click();
  await close();
  stage = 'fresh find and edit same follow-up';
  await launch();
  await inspectNewNote();
  assert.equal(await page.locator('#note-gm').inputValue(), summary);
  await page.locator('#note-gm').fill(extended);
  await planning(next);
  await page.locator('#session-packet-open').click();
  await page.waitForFunction(
    (t) =>
      t
        .split('\n')
        .filter(Boolean)
        .every((line) =>
          document.querySelector('#session-packet-content').textContent.includes(line),
        ),
    extended,
  );
  await page.locator('#session-packet-content').getByText(extended, { exact: true }).click();
  await shot('fresh-next-evening');
  await page.locator('#session-packet-close').click();
  await close();
  stage = 'verify persisted outcome';
  const saved = new CampaignStore(file),
    fresh = saved.activate(campaign.id),
    notes = saved.preparation(fresh.token).notes,
    created = notes.filter((x) => x.note.title === title);
  assert.equal(created.length, 1);
  const quest = created[0].note;
  assert.equal(quest.kind, 'quest');
  assert.equal(quest.gmNotes, extended);
  assert(quest.relations.some((x) => x.targetId === nera.id && x.label === 'Absprache mit'));
  assert.deepEqual(
    notes.filter((x) => x.note.id === nera.id || x.note.id === guide.id),
    initial.notes,
  );
  const linked = saved.session(fresh.token, next.id).visits[0];
  assert(linked.noteIds.includes(quest.id));
  const entries = saved.chronicle(fresh.token).entries.filter((x) => x.title === title);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].followUp.id, quest.id);
  assert.deepEqual(saved.live(fresh.token).scene.clock, initial.live.scene.clock);
  saved.close();
  results.completeOwnTask = true;
  results.persisted = {
    questId: quest.id,
    eventFollowUp: entries[0].followUp,
    nextVisitNoteIds: linked.noteIds,
    originalsUnchanged: true,
  };
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        source,
        dirty,
        zoom,
        profile,
        stage,
        results,
        launches,
        errors,
        hashes,
        counterpart: 'Not yet attempted; no paired-case completion claimed.',
      },
      null,
      2,
    ),
  );
  console.log(
    'COMPLETE OWN BASELINE case17: live outcome, linked quest, next evening, fresh edit; counterpart pending',
  );
} catch (error) {
  if (page) {
    await shot('failure').catch(() => {});
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
          visibleText: await page
            .locator('body')
            .innerText()
            .catch(() => ''),
          buttons: await page
            .getByRole('button')
            .allTextContents()
            .catch(() => []),
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  if (!closed) await close().catch(() => app?.process()?.kill('SIGTERM'));
  proxy.kill();
  await writeFile(out + '/cleanup.json', JSON.stringify({ launches, closed, errors }, null, 2));
}
