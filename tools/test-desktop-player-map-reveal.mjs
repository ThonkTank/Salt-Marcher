// Real GM controls -> passive native window -> blank -> normal restart -> explicit resume.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
const root = process.cwd(), require = createRequire(root + '/package.json'), { _electron } = require('playwright-core'), Database = require('better-sqlite3');
require('esbuild').buildSync({ entryPoints: ['src/app/storage/store.ts'], outfile: '.build/native-player-map-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'] });
const { CampaignStore } = require(root + '/.build/native-player-map-store.cjs'), out = process.env.QA_EVIDENCE_DIR??root + '/.build/player-map-reveal';
await mkdir(out, { recursive: true });await rm(out+'/result.json',{force:true});
const artifacts = Object.fromEntries(await Promise.all(['main.cjs', 'preload.cjs', 'atlas-region-worker.cjs', 'ui/renderer.js', 'ui/index.html','ui/app.css','ui/player.css'].map(async (file) => [file, createHash('sha256').update(await readFile(root + '/.build/desktop/' + file)).digest('hex')]))), launches = [], results = [];
let app, page, proxy, db;
async function until(check) { const end = Date.now() + 15000; while (!check() && Date.now() < end)
    await new Promise(r => setTimeout(r, 25)); assert(check(), 'Expected confirmed application state'); }
async function close() { const exit = new Promise(r => app.process().once('exit', (code, signal) => r({ code, signal }))); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')).close()); let timer; try {
    const result = await Promise.race([exit, new Promise((_, reject) => timer = setTimeout(() => reject(Error('Normal close timed out')), 10000))]);
    assert.deepEqual(result, { code: 0, signal: null });
    launches.at(-1).exit = result;launches.at(-1).pidAbsent=!await stat('/proc/'+launches.at(-1).pid).then(()=>true).catch(()=>false);assert(launches.at(-1).pidAbsent);
    app = null;
}
finally {
    clearTimeout(timer);
} }
async function shot(file, player = false) { await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))); await writeFile(out + '/' + file, Buffer.from(await app.evaluate(async ({ BrowserWindow }, player) => (await BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith(player ? '/player-display.html' : '/index.html')).webContents.capturePage()).toPNG().toString('base64'), player), 'base64')); }
try {
    for (const scale of [1, 2]) {
        const profile = await mkdtemp('/tmp/native-player-map-'), store = new CampaignStore(profile + '/workbench.sqlite'), cam = store.create('Spielerkarte am Nordpass'), w = store.activate(cam.id), command = action => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action }), hero = store.executeLive(command({ kind: 'create-character', profile: { name: 'Mira' } })).character, scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 1 })).scene;
        store.executeLive(command({ kind: 'membership', characterId: hero.id, expectedRevision: hero.membershipRevision, expectedRosterRevision: 1, active: true, targetSceneId: scene.id, expectedFocusRevision: 0 }));
        let map = store.world(w.token).maps[0];
        map = { ...map, name: 'Nordpass', cells: ['Eichenfurt', 'Nordpass', 'GM_GEHEIM_Drache'].map((label, q) => ({ q, r: 0, level: 0, terrain: ['forest', 'hills', 'mountains'][q], elevationM: 0, climate: null, road: false, river: false, label, faction: 'GM_GEHEIM_Kult', interrupt: '' })) };
        store.executeWorld(command({ kind: 'map', map, expectedRevision: map.revision }));
        const position = store.sceneWorld(w.token, scene.id).position;
        store.executeWorld(command({ kind: 'place-scene', sceneId: scene.id, expectedSceneRevision: scene.revision, expectedPositionRevision: position.revision, position: { mapId: map.id, q: 0, r: 0, locationId: null, dungeon: null } }));
        const v = store.playerView(w.token);
        store.executePlayer({ ...command({ kind: 'observer', observer: { characterId: hero.id, enabled: false, rangeMeters: 10000, darkvisionMeters: 0, eyeHeightMeters: 1.7 } }), expectedRevision: v.settings.revision, expectedFocusId: v.focusId, expectedFocusRevision: v.focusRevision, expectedFocusMembershipRevision: v.focusMembershipRevision, expectedFocusLocationId: v.focusLocationId });
        store.tutorial('skipped');
        store.close();
        const bus = profile + '/bus';
        proxy = spawn('xdg-dbus-proxy', [process.env.DBUS_SESSION_BUS_ADDRESS, bus, '--filter', '--talk=org.freedesktop.portal.Desktop', '--talk=org.freedesktop.Notifications'], { stdio: 'ignore' });
        for (let i = 0; i < 100 && !await stat(bus).catch(() => null); i++)
            await new Promise(r => setTimeout(r, 20));
        const errors = [];
        async function launch() {
            app = await _electron.launch({ executablePath: root + '/node_modules/electron/dist/electron', args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--force-device-scale-factor=' + scale, '--data-dir', profile], env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + bus } });
            launches.push({ scale, pid: app.process().pid, runtime: await app.evaluate(() => ({ electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome })) });
            page = await app.firstWindow();
            page.setDefaultTimeout(15000);
            page.on('pageerror', e => errors.push(e.stack));
            await page.waitForURL(/\/index\.html$/);
            await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')); w.unmaximize(); w.setContentSize(1280, 852); });
            await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
            await page.locator('.campaign-card[data-campaign-id="' + cam.id + '"]').getByRole('button', { name: /Öffnen|Fortsetzen/ }).click();
            await page.waitForFunction(() => document.body.classList.contains('has-workspace') && !document.querySelector('main').inert);
            if (await page.locator('#campaign-atlas').isVisible()) {
                await page.locator('#atlas-view').click();await page.locator('#atlas-player-open-controls').click();
            } else
                await page.locator('#player-open-controls').click();
            await page.locator('#player-dialog').waitFor({ state: 'visible' });
        }
        await launch();
        db = new Database(profile + '/workbench.sqlite', { readonly: true });
        const privateBefore = JSON.stringify({ map: db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map'").get(cam.id).payload, land: db.prepare('SELECT id,payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id').all(cam.id) });
        assert(privateBefore.includes('GM_GEHEIM_Kult'));
        const settings = () => JSON.parse(db.prepare("SELECT payload FROM player_record WHERE campaign_id=? AND kind='settings'").get(cam.id).payload);
        assert.match(await page.locator('#player-state').innerText(), /ausgeblendet/);
        const revision = settings().revision;
        await page.locator('#player-labels').check();
        await until(() => settings().revision > revision);
        const discover = async (q,name)=>{
            const before=settings().revision;
            if(q===0)await page.locator('[data-player-cell="0,0"]').press('Enter');
            else{
                await page.locator('[data-player-cell="0,0"]').press('ArrowRight');
                assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-player-cell')),'1,0');
                assert.equal(await page.locator('#player-q').inputValue(),'0');
                assert.equal(settings().revision,before);
                await page.keyboard.press('Enter');
            }
            await page.waitForFunction(key=>document.activeElement?.getAttribute('data-player-cell')===key,q+',0');
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
            assert.equal(await page.locator('#player-map-picker [tabindex="0"]').count(),1);
            assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-player-cell')),q+',0');
            assert.equal(await page.locator('#player-public-label').inputValue(),'');
            assert.equal(settings().revision,before);
            await shot('keyboard-'+scale+'-'+q+'.png');
            await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'player-public-label');
            await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'player-copy-label');
            await page.keyboard.press('Enter');await page.waitForFunction(name=>document.querySelector('#player-public-label').value===name,name);
            assert.equal(settings().revision,before);
            await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'player-discover');await page.keyboard.press('Enter');
            await until(()=>settings().revision>before);await page.waitForFunction(()=>document.querySelector('#player-feedback').textContent.includes('Kenntnis und öffentliche Beschriftung gespeichert.'));
        };
        await discover(0, 'Eichenfurt');
        assert.equal(settings().blank, true);
        await page.locator('#player-show-follow').click();
        await until(() => app.windows().some(w => w.url().endsWith('/player-display.html')));
        let player = app.windows().find(w => w.url().endsWith('/player-display.html'));
        await player.waitForFunction(async()=>document.querySelector('.player-atlas')?.dataset.ready==='true'&&(await window.playerDisplay.frame()).value.frame.map?.cells.some(c=>c.label==='Eichenfurt'));
        assert(!await player.evaluate(async()=>(await window.playerDisplay.frame()).value.frame.map.cells.some(c=>c.label==='Nordpass')));
        await discover(1, 'Nordpass');
        await player.waitForFunction(async()=>document.querySelector('.player-atlas')?.dataset.ready==='true'&&(await window.playerDisplay.frame()).value.frame.map?.cells.some(c=>c.label==='Nordpass'));
        await player.waitForFunction(()=>document.querySelector('.player-atlas')?.dataset.ready==='true');
        let frame = await player.evaluate(async () => { const r = await window.playerDisplay.frame(); return r.value.frame; });
        assert.equal(frame.mode, 'map');
        assert.equal(frame.map.cells[0].terrain,'forest','Public forest uses only disclosed terrain');
        assert.deepEqual(frame.map.cells.map(c => [c.q, c.label]), [[0, 'Eichenfurt'], [1, 'Nordpass']]);
        assert.doesNotMatch(JSON.stringify(frame), /GM_GEHEIM/);
        assert.equal(await player.evaluate(() => typeof window.campaign), 'undefined');
        await shot('controls-' + scale + '.png');
        await shot('player-' + scale + '.png', true);
        await page.locator('#player-blank').click();
        await player.waitForFunction(() => document.getElementById('player-stage')?.classList.contains('player-blank') || document.querySelector('.player-blank'));
        assert.equal(await player.locator('body').innerText(), '');
        db.close();
        db = null;
        await close();
        await launch();
        assert.match(await page.locator('#player-state').innerText(), /ausgeblendet/);
        assert(await page.locator('#player-map-picker [role=button]').count() <= 61);
        assert(await page.locator('#player-map-picker [role=button]').count() >= 3);
        await page.locator('#player-show-follow').click();
        await until(() => app.windows().some(w => w.url().endsWith('/player-display.html')));
        player = app.windows().find(w => w.url().endsWith('/player-display.html'));
        await player.waitForFunction(async()=>document.querySelector('.player-atlas')?.dataset.ready==='true'&&(await window.playerDisplay.frame()).value.frame.map?.cells.length===2);
        frame = await player.evaluate(async () => { const r = await window.playerDisplay.frame(); return r.value.frame; });
        assert.equal(frame.map.cells.length, 2);
        assert.doesNotMatch(JSON.stringify(frame), /GM_GEHEIM/);
        await shot('resumed-' + scale + '.png', true);
        db = new Database(profile + '/workbench.sqlite', { readonly: true });
        assert.equal(JSON.stringify({ map: db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map'").get(cam.id).payload, land: db.prepare('SELECT id,payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id').all(cam.id) }), privateBefore);
        db.close();
        db = null;
        await close();
        proxy.kill();
        proxy = null;
        assert.deepEqual(errors, []);
        results.push({ scale, profile, knownHexes: 2, secretHidden: true, publicLabelsAtomic: true, privateSourcePreserved: true, blankPersisted: true, explicitResume: true,keyboardSelections:2,oneMapTabStop:true,arrowDoesNotPublish:true,tabToLabel:true });
    }
    await writeFile(out + '/result.json', JSON.stringify({ source:sourceRevision,dirty:sourceDirty, artifacts, launches, results }, null, 2));
    console.log(JSON.stringify({ launches, results }));
}
catch (e) {
    if (app)
        await shot('failure.png').catch(() => { });
    throw e;
}
finally {
    db?.close();
    if (app) {
        const proc = app.process(), timer = setTimeout(() => proc.kill('SIGKILL'), 5000);
        try {
            await app.close().catch(() => { });
        }
        finally {
            clearTimeout(timer);
        }
    }
    proxy?.kill();
}
