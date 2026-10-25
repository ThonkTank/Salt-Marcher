import { openDesktopKeyReferences, linkDesktopKeyReference } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, appendFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out =
  process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? '/tmp/salt-note-room-plan-return';
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
const profile = await mkdtemp('/tmp/gm-npc-consolidation-'),
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
  'Nera hat ihren Sold erhalten. Sie kennt den Zugang zum Keller.\r\n',
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
const duplicate = make(
  'Quartiermeisterin Nera',
  'npc',
  'Ältere Mitschrift: Neras Sold ist noch offen.\r\nSie nimmt Lieferungen nur bei Nebel entgegen.\r\n',
);
for (const note of [nera, tarek, clue, duplicate])
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
const plan = {
  version: 1,
  id: randomUUID(),
  revision: 1,
  name: 'Nachtwache · Tor und Keller',
  scenes: rooms.map((r, i) => ({
    id: randomUUID(),
    title: r.name,
    notes: i === 0 ? 'Nera nach dem Schlüssel fragen.' : 'Lieferung mit Nera und Tarek besprechen.',
    locationId: null,
  })),
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
        gmNotes: {
          mode: 'replace',
          text:
            i === 0
              ? 'Nera hat den Sold erhalten. Der Schlüssel liegt noch bei ihr.'
              : 'Quartiermeisterin Nera kennt die Regeln für Lieferungen.',
        },
        references: [
          {
            kind: 'npc',
            id: i === 0 ? nera.id : duplicate.id,
            label: i === 0 ? nera.title : duplicate.title,
          },
          ...(i === 1
            ? [{ kind: 'npc', id: tarek.id, label: tarek.title }]
            : [{ kind: 'rumor', id: clue.id, label: clue.title }]),
          { kind: 'plan', id: plan.id, label: plan.name },
        ],
      },
    }),
  );
for (const [i, visit] of store.session(w.token, plan.id).visits.entries())
  store.executeSession(
    command({
      kind: 'visit',
      planId: plan.id,
      expectedRevision: visit.revision,
      detail: { ...visit, noteIds: i === 0 ? [nera.id, clue.id] : [duplicate.id, tarek.id] },
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
store.close();
const checkoutSource = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const hashes = {};
for (const n of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  hashes[n] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + n))
    .digest('hex');
const proofPath = process.argv.find((a) => a.startsWith('--baseline-proof='))?.slice(17),
  proof = proofPath ? JSON.parse(await readFile(proofPath, 'utf8')) : null,
  source = proof?.source ?? checkoutSource;
if (proof && JSON.stringify(proof.hashes) !== JSON.stringify(hashes))
  throw Error('Baseline product assets differ from their existing source-bound proof');
await writeFile(
  out + '/fixture.json',
  JSON.stringify(
    {
      source,
      checkoutSource,
      dirty,
      profile,
      file,
      campaign,
      rooms,
      nera,
      tarek,
      clue,
      duplicate,
      plan,
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
const assert = (await import('node:assert/strict')).default;
const merged =
    'Nera hat ihren Sold erhalten. Sie kennt den Zugang zum Keller.\n\nAus älterer Mitschrift (Quartiermeisterin Nera):\nSold damals noch offen; inzwischen bezahlt.\nSie nimmt Lieferungen nur bei Nebel entgegen.',
  extended = merged + '\nFür den nächsten Abend: Nebelregel von Nera bestätigen lassen.',
  watchText =
    'Nera hat ihren Sold erhalten. Lieferungen nimmt sie nur bei Nebel entgegen. Tarek prüft die Liste.';
let stage = 'launch',
  closed = true;
const results = {};
async function openNote(title) {
  await page.locator('#world-search').fill(title);
  await page.locator('#world-list').getByRole('button', { name: title, exact: true }).click();
  await page.waitForFunction((t) => document.querySelector('#note-title').value === t, title);
}
async function openUse(room) {
  await page.locator('#note-room-uses-list button').filter({ hasText: room }).click();
  await page.locator('#key-dialog').waitFor({ state: 'visible' });
}
async function refs() {
  if (!(await page.locator('#key-references').isVisible())) await openDesktopKeyReferences(page);
}
try {
  await launch();
  closed = false;
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  await tab('#preparation-tab');
  stage = 'read two NPC sources and reconcile';
  await openNote(duplicate.title);
  assert.equal(
    await page.locator('#note-gm').inputValue(),
    duplicate.gmNotes.replaceAll('\r\n', '\n'),
  );
  await openNote(nera.title);
  assert.equal(await page.locator('#note-gm').inputValue(), nera.gmNotes.replaceAll('\r\n', '\n'));
  await page.locator('#note-gm').fill(merged);
  await openUse('Torhalle');
  assert.equal(
    await page.locator('#key-gm-notes').inputValue(),
    'Nera hat den Sold erhalten. Der Schlüssel liegt noch bei ihr.',
  );
  await page.locator('#key-close').click();
  stage = 'redirect duplicate room reference';
  await openNote(duplicate.title);
  await openUse('Wachstube');
  assert.equal(
    await page.locator('#key-gm-notes').inputValue(),
    'Quartiermeisterin Nera kennt die Regeln für Lieferungen.',
  );
  await refs();
  await page
    .locator('#key-references p')
    .filter({ has: page.getByRole('button', { name: duplicate.title, exact: true }) })
    .getByRole('button', { name: 'Entfernen', exact: true })
    .click();
  await linkDesktopKeyReference(page, 'NSC: ' + nera.title);
  await page.locator('#key-gm-notes').fill(watchText);
  stage = 'redirect plan source and return through room to original note';
  await page
    .locator('#key-references')
    .getByRole('button', { name: plan.name, exact: true })
    .click();
  await page.waitForFunction((id) => document.querySelector('#plans').value === id, plan.id);
  await page.locator('#scene-list button').filter({ hasText: 'Wachstube' }).click();
  if (!(await page.locator('#visit-note-search').isVisible()))
    await page.getByText('Verknüpftes Weltwissen', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Verknüpfung lösen: ' + duplicate.title, exact: true })
    .click();
  await page.locator('#visit-note-search').fill(nera.title);
  await page
    .locator('#visit-note-results')
    .getByRole('button', { name: 'Notiz lesen: ' + nera.title, exact: true })
    .click();
  await page
    .locator('#visit-note-detail')
    .getByRole('button', { name: 'Mit diesem Besuch verknüpfen', exact: true })
    .click();
  await page
    .locator('#visit-note-detail')
    .getByRole('button', { name: 'Verknüpfung zu diesem Besuch lösen', exact: true })
    .waitFor({ state: 'visible' });
  await page.locator('#key-plan-return').click();
  await page.locator('#key-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#key-close').innerText(), 'Zurück zur Notiz');
  await page.locator('#key-close').click();
  await page.locator('#key-dialog').waitFor({ state: 'hidden' });
  if (proof) {
    assert.equal(await page.locator('#preparation').isVisible(), false);
    results.baselineWrongAtlasReturnObserved = true;
    await shot('parent-return-baseline-atlas');
    await tab('#preparation-tab');
    await page.locator('#preparation-knowledge').click();
    await openNote(duplicate.title);
  } else {
    await page.locator('#preparation-knowledge-workspace').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#note-title').inputValue(), duplicate.title);
    await page
      .getByText('Keine gespeicherten Raum-Key-Verknüpfungen.', { exact: true })
      .waitFor({ state: 'visible' });
    const box = await page.locator('#note-title').boundingBox();
    assert(box && box.y >= 0 && box.y + box.height < (await page.evaluate(() => innerHeight)));
    results.parentKnowledgeRestored = true;
    results.originalNoteBroughtIntoView = true;
    await shot('parent-original-return');
  }
  stage = 'retire duplicate and use both planned visits';
  await page.locator('#note-remove').click();
  await openNote(nera.title);
  await page
    .locator('#note-room-uses-list button')
    .filter({ hasText: 'Wachstube' })
    .waitFor({ state: 'visible' });
  await shot('canonical-two-room-uses');
  await page.locator('#preparation-planning').click();
  await page.locator('#session-packet-open').click();
  assert(
    (await page.locator('#session-packet-content').innerText()).includes(
      'Sold damals noch offen; inzwischen bezahlt.',
    ),
  );
  await page.getByRole('button', { name: 'Voriger Besuch', exact: true }).click();
  assert(
    (await page.locator('#session-packet-content').innerText()).includes(
      'Sold damals noch offen; inzwischen bezahlt.',
    ),
  );
  await page.locator('#session-packet-close').click();
  await close();
  closed = true;
  stage = 'fresh find same original and further edit';
  await launch();
  closed = false;
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  await tab('#preparation-tab');
  await page.locator('#preparation-knowledge').click();
  await openNote(nera.title);
  assert.equal(await page.locator('#note-gm').inputValue(), merged);
  await page.locator('#note-gm').fill(extended);
  await openUse('Wachstube');
  assert.equal(await page.locator('#key-gm-notes').inputValue(), watchText);
  await refs();
  assert(!(await page.locator('#key-references').innerText()).includes(duplicate.title));
  await page.locator('#key-close').click();
  await page.locator('#world-trash').check();
  await openNote(duplicate.title);
  assert.equal(
    await page.locator('#note-gm').inputValue(),
    duplicate.gmNotes.replaceAll('\r\n', '\n'),
  );
  assert(await page.locator('#note-restore').isVisible());
  await page.locator('#world-trash').uncheck();
  await page.locator('#preparation-planning').click();
  await page.locator('#session-packet-open').click();
  await page
    .locator('#session-packet-content')
    .getByText('Für den nächsten Abend: Nebelregel von Nera bestätigen lassen.', { exact: false })
    .waitFor({ state: 'visible' });
  await shot('fresh-edited-original-in-plan');
  await page.locator('#session-packet-close').click();
  await close();
  closed = true;
  stage = 'canonical verification after writers close';
  const final = new CampaignStore(file);
  try {
    const fw = final.activate(campaign.id),
      prep = final.preparation(fw.token),
      keys = final.drawing(fw.token).keyContent,
      visits = final.session(fw.token, plan.id).visits;
    assert.equal(
      prep.notes.find((r) => r.note.id === nera.id).note.gmNotes.replaceAll('\r\n', '\n'),
      extended,
    );
    const archived = prep.notes.find((r) => r.note.id === duplicate.id);
    assert(archived.trashed);
    assert.equal(archived.note.gmNotes, duplicate.gmNotes);
    for (const original of [tarek, clue])
      assert.deepEqual(prep.notes.find((r) => r.note.id === original.id).note, original);
    assert.deepEqual(
      final.workspace().rooms.map((r) => r.sections),
      rooms.map((r) => r.sections),
    );
    assert(
      keys
        .filter((k) => k.kind === 'room')
        .every(
          (k) =>
            k.references.some((r) => r.id === nera.id) &&
            !k.references.some((r) => r.id === duplicate.id),
        ),
    );
    assert(visits.every((v) => v.noteIds.includes(nera.id) && !v.noteIds.includes(duplicate.id)));
    results.canonicalId = nera.id;
    results.archivedDuplicateByteTextExact = true;
    results.originalSourcesAndSectionsExact = true;
    results.bothRoomAndVisitReferencesRetargeted = true;
    results.freshEditReadComplete = true;
  } finally {
    final.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      { source, checkoutSource, dirty, profile, stage, results, launches, errors, hashes },
      null,
      2,
    ),
  );
  console.log(
    'COMPLETE duplicate NPC reconciliation, room and visit retargeting, nested source return, recoverable archive, Fresh find/edit/read.',
  );
} catch (error) {
  if (page) await shot('failure').catch(() => {});
  await writeFile(
    out + '/failure.json',
    JSON.stringify(
      {
        source,
        checkoutSource,
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
  if (!closed) {
    await close().catch(() => {});
    closed = true;
  }
  proxy.kill();
  await writeFile(out + '/cleanup.json', JSON.stringify({ closed, launches, errors }, null, 2));
}
