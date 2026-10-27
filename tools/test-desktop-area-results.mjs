import { runNativeProbe } from './native-session.mjs';
let native,
  nativeCase = 0;
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, stat, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/area-results';
await mkdir(output, { recursive: true });
await rm(output + '/result.json', { force: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  artifacts = {};
for (const name of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  artifacts[name] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + name))
    .digest('hex');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/area-results-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/area-results-store.cjs'),
  results = [];
for (const recovery of [false, true])
  for (const scale of [1, 2]) {
    await runNativeProbe(
      { output: output + '/case-' + ++nativeCase, name: 'area-results' },
      async (session) => {
        native = session;

        const profile = native.profile,
          file = profile + '/workbench.sqlite',
          store = new CampaignStore(file),
          campaign = store.create('Steinbrücke – Flächenzauber'),
          w = store.activate(campaign.id),
          command = (action) => ({
            commandId: randomUUID(),
            campaignId: campaign.id,
            token: w.token,
            action,
          });
        store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
        for (const [name, hp, armorClass] of [
          ['Mira', 20, 16],
          ['Rolan', 18, 14],
        ]) {
          const c = store.executeLive(
              command({ kind: 'create-character', profile: { name, armorClass } }),
            ).character,
            l = store.live(w.token);
          store.executeLive(
            command({
              kind: 'membership',
              characterId: c.id,
              expectedRevision: c.membershipRevision,
              expectedRosterRevision: l.rosterRevision,
              active: true,
              targetSceneId: l.scene.id,
              expectedFocusRevision: l.focusRevision,
            }),
          );
          const p = store.progress(w.token).characters.find((p) => p.characterId === c.id);
          store.executeProgress(
            command({
              kind: 'health',
              characterId: c.id,
              expectedRevision: p.revision,
              operation: 'set',
              reason: 'Isolierte Ausgangsgruppe',
              health: { hp, maxHp: hp, tempHp: 0, conditions: '', concentrating: false },
            }),
          );
        }
        const scene = store.live(w.token).scene,
          sceneId = scene.id;
        let combat;
        const act = (action) =>
          (combat = store.executeCombat({
            ...command(action),
            combatId: combat?.id ?? null,
            expectedRevision: combat?.revision ?? null,
          }).combat);
        act({
          kind: 'create',
          sceneId,
          title: 'Oger an der Steinbrücke',
          includeParty: true,
          expectedMembershipRevision: scene.membershipRevision,
          catalogCreature: { creatureId: 'ogre', count: 4, grouped: true },
        });
        for (const p of combat.participants)
          act({
            kind: 'edit',
            participantId: p.id,
            changes: { initiative: p.characterId ? (p.name === 'Mira' ? 18 : 8) : 12 },
          });
        act({ kind: 'start' });
        const turnId = combat.turnId;
        store.tutorial('skipped');
        store.close();

        let app;
        const exits = [],
          errors = [];
        async function launch() {
          app = await native.launchConfigured({
            executablePath: root + '/node_modules/electron/dist/electron',
            args: [
              root + '/.build/desktop/main.cjs',
              '--ozone-platform=x11',
              '--force-device-scale-factor=' + scale,
              '--data-dir',
              profile,
            ],
          });
          const page = await app.firstWindow();
          page.setDefaultTimeout(15000);
          page.on('pageerror', (e) => errors.push(e.stack));
          await page.waitForURL(/\/index\.html$/);
          await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
          await page
            .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
            .getByRole('button', { name: 'Fortsetzen' })
            .click();
          await page.waitForFunction(
            (id) =>
              document.getElementById('campaigns').value === id &&
              !document.querySelector('main').inert,
            campaign.id,
          );
          if (
            !(await page.locator('#live-tab').isVisible()) &&
            (await page.locator('#atlas-navigation').isVisible())
          )
            await page.locator('#atlas-navigation').click();
          if (!(await page.locator('#live-tab').isVisible()))
            await page.locator('#workspace-nav-summary').click();
          await page.locator('#live-tab').click();
          await page.locator('#combat-panel').waitFor();
          await page.waitForFunction(
            () => document.getElementById('combat-panel').getAttribute('aria-busy') === 'false',
          );
          return page;
        }
        async function close() {
          const pid = app.process().pid,
            exit = new Promise((r) =>
              app.process().once('exit', (code, signal) => r({ code, signal })),
            );
          await native.close();
          let timer;
          try {
            const result = await Promise.race([
              exit,
              new Promise(
                (_, reject) =>
                  (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
              ),
            ]);
            assert.deepEqual(result, { code: 0, signal: null });
            const pidAbsent = !(await stat('/proc/' + pid)
              .then(() => true)
              .catch(() => false));
            assert(pidAbsent);
            exits.push({ ...result, pid, pidAbsent });
            app = null;
          } finally {
            clearTimeout(timer);
          }
        }
        async function shot(name) {
          await app
            .firstWindow()
            .then((p) =>
              p.evaluate(
                () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
              ),
            );
          const png = await app.evaluate(async ({ BrowserWindow }) =>
            (
              await BrowserWindow.getAllWindows()
                .find((w) => w.webContents.getURL().endsWith('/index.html'))
                .webContents.capturePage()
            )
              .toPNG()
              .toString('base64'),
          );
          await writeFile(
            output + '/' + (recovery ? 'recovery-' : '') + name + '-' + scale + '.png',
            Buffer.from(png, 'base64'),
          );
        }
        try {
          let page = await launch();
          assert.match(await page.locator('#combat-status').innerText(), /Runde 1.*Am Zug: Mira/);
          assert.equal(
            await page.locator('#combat-rows tr[data-participant-id]').count(),
            2,
            'baseline mob starts collapsed',
          );
          await page.locator('#combat-area-open').click();
          await page.locator('#combat-area-amount').fill('21');
          await page.locator('#combat-area-type').selectOption('fire');
          const selection = page.locator('#combat-area-selection');
          await selection.press('Home');
          await selection.press('ArrowDown');
          assert.equal(await page.locator('#combat-area-targets input:checked').count(), 2);
          await selection.press('ArrowDown');
          assert.equal(await page.locator('#combat-area-targets input:checked').count(), 4);
          await selection.selectOption(
            'group:' + combat.participants.find((p) => p.sourceId === 'ogre').groupId,
          );
          await page.getByRole('checkbox', { name: 'Ziel Ogre D', exact: true }).uncheck();
          assert.equal(await page.locator('#combat-area-targets input:checked').count(), 3);
          assert.equal(await selection.inputValue(), '');
          for (const name of ['Ogre B', 'Ogre C'])
            await page
              .getByRole('combobox', { name: 'Rettungswurf für ' + name, exact: true })
              .selectOption('half');
          await shot('preview');
          let areaCommandId = null;
          if (recovery)
            await app.evaluate(({ ipcMain }) => {
              const write = ipcMain._invokeHandlers.get('campaign:execute-combat'),
                read = ipcMain._invokeHandlers.get('campaign:commit-status');
              let lose = true;
              globalThis.qaAreaStatusUnavailable = true;
              globalThis.qaAreaCommands = [];
              ipcMain.removeHandler('campaign:commit-status');
              ipcMain.handle('campaign:commit-status', (e, ...args) =>
                globalThis.qaAreaStatusUnavailable
                  ? { ok: false, error: 'Controlled status read failure' }
                  : read(e, ...args),
              );
              ipcMain.removeHandler('campaign:execute-combat');
              ipcMain.handle('campaign:execute-combat', async (e, c) => {
                globalThis.qaAreaCommands.push(c);
                const result = await write(e, c);
                if (c.action.kind === 'area-damage' && lose) {
                  lose = false;
                  throw Error('Controlled reply loss');
                }
                return result;
              });
            });
          await page.locator('#combat-area-apply').click();
          if (recovery) {
            await page.waitForFunction(() =>
              document
                .getElementById('combat-area-effect')
                .textContent.includes('Keine Bestätigung'),
            );
            await shot('unconfirmed');
            const commands = (await app.evaluate(() => globalThis.qaAreaCommands)).filter(
              (c) => c.action.kind === 'area-damage',
            );
            assert.equal(commands.length, 1);
            areaCommandId = commands[0].commandId;
            if (scale === 1) await page.locator('#combat-area-cancel').click();
            else await page.keyboard.press('Escape');
            await app.evaluate(() => {
              globalThis.qaAreaStatusUnavailable = false;
            });
            await page.locator('#commit-check').click();
            await page.waitForFunction(() =>
              document
                .getElementById('status')
                .textContent.includes('Buchung anhand ihres Belegs bestätigt'),
            );
            await page.locator('#commit-pending').waitFor({ state: 'hidden' });
            assert.equal(
              (await app.evaluate(() => globalThis.qaAreaCommands)).filter(
                (c) => c.action.kind === 'area-damage',
              ).length,
              1,
            );
          }
          await page.locator('#combat-area-effect').waitFor({ state: 'hidden' });
          await page.waitForFunction(
            () => document.getElementById('combat-panel').getAttribute('aria-busy') === 'false',
          );
          const areaMessage = await page.locator('#status').innerText();
          if (recovery) assert.match(areaMessage, /Buchung anhand ihres Belegs bestätigt/);
          else
            assert.match(
              areaMessage,
              /Flächenschaden gespeichert.*Ogre A 38\/59 HP.*Ogre B 49\/59 HP.*Ogre C 49\/59 HP/,
            );
          assert.equal(
            await page.locator('#combat-rows tr[data-participant-id]').count(),
            6,
            'all affected and untouched members are visible without another expansion',
          );
          for (const [name, hp, max] of [
            ['Ogre A', 38, 59],
            ['Ogre B', 49, 59],
            ['Ogre C', 49, 59],
            ['Ogre D', 59, 59],
            ['Mira', 20, 20],
            ['Rolan', 18, 18],
          ]) {
            await page
              .getByRole('button', {
                name: name + ' · ' + hp + ' / ' + max + ' HP · Schaden oder Heilung',
                exact: true,
              })
              .waitFor();
          }
          assert.match(await page.locator('#combat-status').innerText(), /Runde 1.*Am Zug: Mira/);
          await page.locator('#combat-rows').scrollIntoViewIfNeeded();
          await shot('applied');
          await page.locator('#combat-next').click();
          await page.waitForFunction(() =>
            document.getElementById('combat-status').textContent.includes('Am Zug: Ogre A'),
          );
          await shot('continued');
          await page.locator('#combat-finish').click();
          await page.locator('#combat-outcome').fill('Oger ziehen sich zurück');
          await page.locator('#finish-no-xp').check();
          await page
            .getByRole('button', { name: 'Ergebnis speichern und abschließen', exact: true })
            .click();
          await page.waitForFunction(() =>
            document
              .getElementById('combat-status')
              .textContent.includes('Abgeschlossen · Oger ziehen sich zurück'),
          );
          await close();
          page = await launch();
          assert.match(
            await page.locator('#combat-status').innerText(),
            /Abgeschlossen · Oger ziehen sich zurück/,
          );
          const losses = await page.locator('#combat-resolution').innerText();
          for (const [name, hp] of [
            ['Ogre A', 38],
            ['Ogre B', 49],
            ['Ogre C', 49],
            ['Ogre D', 59],
          ])
            assert(losses.includes(name + ' · ' + hp + ' HP bei Kampfabschluss'));
          await page.locator('#combat-resolution').scrollIntoViewIfNeeded();
          await shot('reopened');
          await close();
          assert.deepEqual(errors, []);
          const fresh = new CampaignStore(file);
          try {
            const active = fresh.activate(campaign.id),
              c = fresh.combat(active.token, sceneId).combat,
              groups = fresh.scenePreparation(active.token, sceneId).groups;
            if (areaCommandId)
              assert.equal(
                fresh.db
                  .prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?')
                  .get(areaCommandId).n,
                1,
              );
            assert.equal(c.phase, 'finished');
            assert.equal(c.round, 1);
            assert.equal(c.outcome, 'Oger ziehen sich zurück');
            assert.equal(c.rewards.totalXp, 0);
            assert.equal(c.participants.length, 6);
            assert.equal(groups.length, 1);
            const actors = groups.flatMap((g) => g.actors);
            assert.equal(actors.length, 4);
            assert.deepEqual(
              c.participants.filter((p) => p.sourceId === 'ogre').map((p) => p.hp),
              [38, 49, 49, 59],
            );
            assert.deepEqual(
              actors.map((p) => p.hp),
              [38, 49, 49, 59],
            );
            assert.deepEqual(
              c.participants.filter((p) => p.characterId).map((p) => p.hp),
              [20, 18],
            );
            assert(
              c.participants
                .filter((p) => p.sourceId === 'ogre')
                .every((p) => p.initiative === 12 && p.partitionKind === 'mob'),
            );
          } finally {
            fresh.close();
          }
          results.push({
            scale,
            recovery,
            areaCommandId,
            profile,
            exits,
            errors,
            participants: 6,
            areaMessage,
            ogreHp: [38, 49, 49, 59],
            unaffectedPartyHp: [20, 18],
            turnIdBeforeArea: turnId,
          });
        } finally {
          if (app) await native.dispose().catch(() => {});
        }
      },
    );
  }
await writeFile(
  output + '/result.json',
  JSON.stringify({ head, dirty, artifacts, results }, null, 2),
);
console.log(JSON.stringify({ output, results }));
