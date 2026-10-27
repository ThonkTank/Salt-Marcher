import { runNativeProbe } from './native-session.mjs';
let native,
  nativeCase = 0;
// A dying PC: damage, death saves, normal restart, healing, finish and fresh Party health.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, stat, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/death-saves';
await mkdir(output, { recursive: true });
await rm(output + '/result.json', { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/death-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/death-native-store.cjs'),
  results = [];
for (const scale of [1, 2]) {
  await runNativeProbe(
    { output: output + '/case-' + ++nativeCase, name: 'death-saves' },
    async (session) => {
      native = session;

      const profile = native.profile,
        file = profile + '/workbench.sqlite',
        store = new CampaignStore(file),
        campaign = store.create('Todesrettung – Brückenduell'),
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
      const scene = store.live(w.token).scene;
      let combat;
      const act = (action) =>
        (combat = store.executeCombat({
          ...command(action),
          combatId: combat?.id ?? null,
          expectedRevision: combat?.revision ?? null,
        }).combat);
      act({
        kind: 'create',
        sceneId: scene.id,
        title: 'Erzmagier am Tor',
        includeParty: true,
        expectedMembershipRevision: scene.membershipRevision,
        catalogCreature: { creatureId: 'archmage', count: 1, grouped: false },
      });
      for (const p of combat.participants)
        act({
          kind: 'edit',
          participantId: p.id,
          changes: { initiative: p.characterId ? (p.name === 'Mira' ? 18 : 8) : 12 },
        });
      act({ kind: 'start' });
      const actorId = combat.participants.find((p) => p.name === 'Mira').id;
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
        await ready(page);
        return page;
      }
      async function ready(page) {
        await page.waitForFunction(
          () =>
            document.getElementById('combat-panel').getAttribute('aria-busy') === 'false' &&
            !document.getElementById('combat-refresh').disabled,
        );
      }
      async function close() {
        const pid = app.process().pid;
        const exit = new Promise((r) =>
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
          let pidAbsent = false;
          try {
            process.kill(pid, 0);
          } catch (error) {
            if (error.code === 'ESRCH') pidAbsent = true;
            else throw error;
          }
          assert(pidAbsent);
          exits.push({ ...result, pid, pidAbsent });
          app = null;
        } finally {
          clearTimeout(timer);
        }
      }
      async function shot(page, name) {
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
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
        await writeFile(output + '/' + name + '-' + scale + '.png', Buffer.from(png, 'base64'));
      }
      const row = (page) => page.locator('[data-participant-id="' + actorId + '"]');
      try {
        let page = await launch();
        await row(page)
          .getByRole('button', { name: /HP · Schaden oder Heilung/ })
          .click();
        await page.locator('#fighter-amount').fill('20');
        await page.locator('#fighter-damage').click();
        await ready(page);
        await page.waitForFunction(() => !document.getElementById('fighter-death-saves').hidden);
        await shot(page, 'zero-hp');
        const layout = await page.evaluate(() => {
          const box = (id) => {
            const e = document.getElementById(id),
              r = e.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, visible: r.top >= 0 && r.bottom <= innerHeight };
          };
          return {
            viewport: { width: innerWidth, height: innerHeight },
            hp: box('fighter-amount'),
            death: box('fighter-death-saves'),
            success: box('fighter-death-success'),
            failure: box('fighter-death-failure'),
            roll: box('fighter-death-roll'),
            safeBottom: document.getElementById('music-mini').getBoundingClientRect().top,
            controls: [
              ...document.querySelectorAll(
                '#combat-participant button,#combat-participant input,#combat-participant select,#combat-participant summary',
              ),
            ]
              .filter((e) => e.checkVisibility())
              .map((e) => ({ id: e.id, text: e.textContent, top: e.getBoundingClientRect().top })),
          };
        });
        for (const key of ['success', 'failure', 'roll']) {
          assert(layout[key].visible, key + ' must be visible beside HP actions');
          assert(
            layout[key].bottom <= layout.safeBottom,
            key + ' must not be covered by music controls',
          );
        }
        await page.locator('#fighter-death-success').click();
        await ready(page);
        await page.waitForFunction(() =>
          document.getElementById('fighter-death-summary').textContent.includes('1 Erfolge'),
        );
        await page.locator('#fighter-death-failure').click();
        await ready(page);
        await shot(page, 'death-tracked');
        await close();
        page = await launch();
        await row(page)
          .getByRole('button', { name: /HP · Schaden oder Heilung/ })
          .click();
        assert.match(
          await page.locator('#fighter-death-summary').innerText(),
          /1 Erfolge.*1 Fehlschläge/,
        );
        await page.locator('#fighter-amount').fill('7');
        await page.locator('#fighter-heal').click();
        await ready(page);
        await page.waitForFunction(() => document.getElementById('fighter-death-saves').hidden);
        assert.match(await row(page).innerText(), /7 \/ 20/);
        await shot(page, 'healed');
        await page.locator('#combat-next').click();
        await ready(page);
        await page.locator('#combat-finish').click();
        await page.locator('#combat-outcome').fill('Mira gerettet; Erzmagier zieht ab');
        await page.locator('#finish-no-xp').check();
        await page
          .getByRole('button', { name: 'Ergebnis speichern und abschließen', exact: true })
          .click();
        await page.waitForFunction(() =>
          document
            .getElementById('combat-status')
            .textContent.includes('Abgeschlossen · Mira gerettet'),
        );
        await close();
        page = await launch();
        assert.match(await row(page).innerText(), /7 \/ 20/);
        await page.locator('#combat-resolution').scrollIntoViewIfNeeded();
        await shot(page, 'finished');
        await close();
        assert.deepEqual(errors, []);
        const fresh = new CampaignStore(file);
        try {
          const token = fresh.activate(campaign.id).token,
            c = fresh.combat(token, scene.id).combat,
            hero = c.participants.find((p) => p.id === actorId),
            health = fresh
              .progress(token)
              .characters.find((p) => p.characterId === hero.characterId).health;
          assert.equal(c.phase, 'finished');
          assert.equal(hero.hp, 7);
          assert.equal(hero.death, undefined);
          assert.equal(health.hp, 7);
          assert.equal(health.death, undefined);
          assert.equal(c.participants.find((p) => p.name === 'Rolan').hp, 18);
          assert.equal(c.participants.find((p) => p.name === 'Archmage A').hp, 99);
        } finally {
          fresh.close();
        }
        results.push({ scale, profile, exits, errors, layout, hp: 7, deathCleared: true });
      } finally {
        if (app) await native.dispose().catch(() => {});
      }
    },
  );
}
const artifacts = {};
for (const name of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  artifacts[name] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + name))
    .digest('hex');
await writeFile(
  output + '/result.json',
  JSON.stringify({ head: sourceRevision, dirty, artifacts, results }, null, 2),
);
console.log(JSON.stringify({ output, results }));
