import {createRequire} from 'node:module';
import {mkdtemp, mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import {spawn, execFileSync} from 'node:child_process';
import {randomUUID, createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// Real Electron, a disposable profile, original note IDs and an existing session.
const root = process.cwd(), require = createRequire(root + '/package.json');
const {_electron} = require('playwright-core');
const out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/note-reopen';
await mkdir(out, {recursive: true});
require('esbuild').buildSync({entryPoints: ['src/app/storage/store.ts'], outfile: '.build/note-reopen-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3']});
const {CampaignStore} = require(root + '/.build/note-reopen-store.cjs');
const profile = await mkdtemp('/tmp/salt-note-reopen-'), file = profile + '/workbench.sqlite';
const store = new CampaignStore(file), campaign = store.create('Die zurückgekehrte Spur'), w = store.activate(campaign.id);
const cmd = action => ({commandId: randomUUID(), campaignId: campaign.id, token: w.token, action});
const make = (title, kind, gmNotes) => ({version: 1, id: randomUUID(), revision: 1, title, kind, gmNotes, readAloud: '  Original zum Vorlesen\r\n', relations: [], creatureId: null, deleted: false});
const npc = make('Nera die Quartiermeisterin', 'npc', 'Nera verwahrt den Schlüssel.\r\n');
const clue = make('Die wiedergefundenen Fässer', 'rumor', 'Die Lieferung galt als geklärt.\r\n');
const other = make('Das blaue Siegel', 'rumor', 'Unabhängige offene Frage.\r\n');
const overview = {...make('Die Aufzug-Verschwörung', 'quest', 'Die Übergabe beobachten.\r\n'), relations: [npc, clue, other].map(n => ({targetId: n.id, label: 'Quelle'}))};
const plan = {version: 1, id: randomUUID(), revision: 1, name: 'Abend 9 · Die Rückkehr', scenes: [{id: randomUUID(), title: 'Die Wache erneut befragen', notes: '  Bisherige Planung\r\n', locationId: null}]};
for (const note of [npc, clue, other, overview]) store.changePreparation({...cmd(null), change: {kind: 'note', expectedRevision: null, note}});
store.changePreparation({...cmd(null), change: {kind: 'plan', expectedRevision: null, plan}});
const visit = store.session(w.token, plan.id).visits[0];
store.executeSession(cmd({kind: 'visit', planId: plan.id, expectedRevision: visit.revision, detail: {...visit, noteIds: [other.id]}}));
const narrative = store.narrative(w.token, clue.id);
store.executeProgress(cmd({kind: 'narrative-state', state: {...narrative.state, status: 'closed'}, expectedRevision: narrative.state.revision, expectedNoteRevision: clue.revision}));
store.tutorial('skipped'); store.close();
const source = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim(), hashes = {};
for (const rel of ['main.cjs', 'preload.cjs', 'ui/renderer.js']) hashes[rel] = createHash('sha256').update(await readFile(root + '/.build/desktop/' + rel)).digest('hex');
const bus = profile + '/bus', proxy = spawn('xdg-dbus-proxy', [process.env.DBUS_SESSION_BUS_ADDRESS, bus, '--filter', '--talk=org.freedesktop.portal.Desktop', '--talk=org.freedesktop.Notifications'], {stdio: 'ignore'});
for (let i = 0; i < 100 && !await stat(bus).catch(() => null); i++) await new Promise(r => setTimeout(r, 20));
let app, page, stage = 'launch'; const launches = [], errors = [], results = [];
async function launch(scale) {
  app = await _electron.launch({executablePath: root + '/node_modules/electron/dist/electron', args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--force-device-scale-factor=' + scale, '--data-dir', profile], env: {...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + bus}});
  launches.push({scale, pid: app.process().pid}); page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page.locator('.campaign-card[data-campaign-id="' + campaign.id + '"]').getByRole('button', {name: /Öffnen|Fortsetzen/}).click();
  await page.waitForFunction(id => document.getElementById('campaigns').value === id && !document.getElementById('workspace-navigation').inert, campaign.id);
  if (!await page.locator('#preparation-tab').isVisible()) {
    if (await page.locator('#atlas-navigation').isVisible()) await page.locator('#atlas-navigation').click();
    else await page.locator('#workspace-nav-summary').click();
  }
  await page.locator('#preparation-tab').click(); await page.locator('#preparation-knowledge').click();
  await page.locator('#world-search').fill(overview.title);
  await page.locator('#world-list').getByRole('button', {name: overview.title, exact: true}).click();
  await page.waitForFunction(title => document.getElementById('note-title').value === title, overview.title);
  await page.locator('#note-thread-open').click();
  await page.waitForFunction(() => document.querySelectorAll('#note-thread-sources article').length === 2 || document.querySelectorAll('#note-thread-sources article').length === 3);
}
async function close() {
  const exited = new Promise(r => app.process().once('exit', (code, signal) => r({code, signal})));
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')).close());
  let timer;
  try {
    const exit = await Promise.race([exited, new Promise((_, reject) => timer = setTimeout(() => reject(Error('Normal close timed out')), 10000))]);
    assert.deepEqual(exit, {code: 0, signal: null}); launches.at(-1).exit = exit; app = null;
  } finally { clearTimeout(timer); }
}
const card = id => page.locator('#note-thread-sources article[data-note-id="' + id + '"]');
async function edit(id) {
  await card(id).getByRole('button', {name: 'Notiz bearbeiten…', exact: true}).click();
  await page.waitForFunction(title => document.querySelector('#note-thread-editor:not([hidden]) #note-title')?.value === title && !document.getElementById('note-thread-return').disabled, [npc, clue].find(n => n.id === id).title);
}
async function back() {
  await page.locator('#note-thread-return').click();
  await page.waitForFunction(() => document.getElementById('note-thread-editor').hidden && !document.getElementById('note-thread-use').disabled);
}
try {
  for (const scale of [1, 2]) {
    stage = 'reopen and update originals at ' + scale; await launch(scale);
    await page.locator('#note-thread-active').uncheck(); await card(clue.id).waitFor();
    if (scale === 1) assert.match(await card(clue.id).innerText(), /Geschlossen/);
    // Explicitly exclude an unrelated source. Its existing visit link must survive.
    await card(other.id).locator('input[type=checkbox]').uncheck();
    await edit(clue.id);
    const clueText = 'Die Lieferung galt als geklärt.\nNeuer Hinweis ' + scale + ': Eine zweite Lieferung kommt um Mitternacht.';
    await page.locator('#note-gm').fill(clueText);
    await page.getByLabel('Narrativer Status', {exact: true}).selectOption('open');
    await page.getByRole('button', {name: 'Narrative Angaben speichern', exact: true}).click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Quest-/Gerüchtstatus und Belohnung gespeichert.');
    await back(); await card(clue.id).getByText('Gerücht · Offen', {exact: true}).waitFor();
    await card(clue.id).locator('input[type=checkbox]').check();
    await edit(npc.id);
    const npcText = 'Nera verwahrt den Schlüssel.\nGespräch ' + scale + ': Sie erwartet die zweite Lieferung.';
    await page.locator('#note-gm').fill(npcText); await back();
    assert(await card(clue.id).locator('input[type=checkbox]').isChecked());
    assert(!await card(other.id).locator('input[type=checkbox]').isChecked());
    await page.locator('#note-thread-active').check();
    await card(clue.id).waitFor();
    assert(await card(clue.id).locator('input[type=checkbox]').isChecked());
    await page.locator('#note-thread-plan').selectOption(plan.id); await page.locator('#note-thread-visit').selectOption(plan.scenes[0].id);
    await page.screenshot({path: out + '/reopened-' + scale + '.png'});
    await page.locator('#note-thread-use').click(); await page.locator('#note-thread-dialog').waitFor({state: 'hidden'});
    assert.equal(await page.locator('#scene-title').inputValue(), plan.scenes[0].title);
    await page.locator('#session-packet-open').click();
    await page.waitForFunction(() => document.getElementById('session-packet-dialog').open && document.getElementById('session-packet-dialog').getAttribute('aria-busy') === 'false');
    const packet = await page.locator('#session-packet-content').innerText();
    assert(packet.includes('Neuer Hinweis ' + scale)); assert(packet.includes('Gespräch ' + scale)); assert(packet.includes(other.gmNotes.trim()));
    await page.screenshot({path: out + '/packet-' + scale + '.png'}); await page.locator('#session-packet-close').click(); await close();
    stage = 'fresh reopen and further edit at ' + scale; await launch(scale);
    await card(clue.id).waitFor(); assert.match(await card(clue.id).innerText(), /Offen/);
    await edit(clue.id); assert.equal(await page.locator('#note-gm').inputValue(), clueText);
    await page.locator('#note-gm').fill(clueText + '\nFür den nächsten Abend bestätigt.'); await back(); await close();
    const check = new CampaignStore(file);
    try {
      const a = check.activate(campaign.id), prep = check.preparation(a.token), original = prep.notes.find(r => r.note.id === clue.id).note;
      assert.equal(prep.notes.length, 4); assert.equal(prep.plans.length, 1); assert.deepEqual(prep.plans[0], plan);
      assert.equal(original.gmNotes.replaceAll('\r\n', '\n'), clueText + '\nFür den nächsten Abend bestätigt.'); assert.equal(original.readAloud, clue.readAloud);
      const dossier = prep.notes.find(r => r.note.id === npc.id).note;
      assert.equal(dossier.gmNotes.replaceAll('\r\n', '\n'), npcText); assert.equal(dossier.readAloud, npc.readAloud);
      for (const untouched of [overview, other]) assert.deepEqual(prep.notes.find(r => r.note.id === untouched.id).note, untouched);
      assert.equal(check.narrative(a.token, clue.id).state.status, 'open');
      assert.deepEqual(new Set(check.session(a.token, plan.id).visits[0].noteIds), new Set([other.id, overview.id, npc.id, clue.id]));
    } finally { check.close(); }
    results.push({scale, reopenedOriginal: true, existingPlanUpdated: true, freshEdit: true});
  }
  assert.deepEqual(errors, []);
  for (const {pid} of launches) assert.throws(() => process.kill(pid, 0), {code: 'ESRCH'});
  await writeFile(out + '/result.json', JSON.stringify({source, dirty, hashes, profile, launches, errors, results}, null, 2));
  console.log(JSON.stringify({results, launches}));
} catch (error) {
  if (app) await page.screenshot({path: out + '/failure.png'}).catch(() => {});
  await writeFile(out + '/failure.json', JSON.stringify({source, dirty, hashes, profile, stage, launches, errors, error: error.stack}, null, 2)); throw error;
} finally { if (app) await app.close(); proxy.kill(); }
