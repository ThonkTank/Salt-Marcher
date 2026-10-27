import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyReferences, linkDesktopKeyReference } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out =
  process.env.QA_EVIDENCE_DIR ??
  process.env.GM_TEMPLATE_EVIDENCE ??
  (await mkdtemp('/tmp/shared-template-evidence-'));
await runNativeProbe(
  { output: out, name: 'shared-template', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/shared-template-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/shared-template-store.cjs'),
      profile = native.profile,
      file = profile + '/workbench.sqlite';
    const material = [
      [
        'Torhalle',
        'Zwei leere Wachbänke flankieren das Tor. Ein Glockenseil hängt neben der inneren Tür.',
        'Das Glockenseil ruft Mara aus dem Archiv. Unter der linken Bank liegt ein ungeöffneter Brief.',
      ],
      [
        'Archiv',
        'Hohe Regale säumen den Schreibtisch. Mara sortiert versiegelte Lieferlisten.',
        'Das Dienstsiegel öffnet das Geheimfach unter dem Schreibtisch. Darin liegt Maras Nachtliste.',
      ],
      [
        'Keller',
        'Wasser tropft zwischen die Weinfässer. Die Nordtür trägt frische Kratzspuren.',
        'Der Nordtorschlüssel steckt zwischen den Weinfässern. Mara lässt nur markierte Lieferungen passieren.',
      ],
    ];
    const rooms = material.map(([name], i) => ({
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
      sections: [],
    }));
    const store = new CampaignStore(file),
      campaign = store.create('Burg Nebelwacht', rooms);
    store.close();
    const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
      hashes = {};
    for (const n of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      hashes[n] = createHash('sha256')
        .update(await readFile(root + '/.build/desktop/' + n))
        .digest('hex');
    await writeFile(
      out + '/fixture.json',
      JSON.stringify({ source, dirty, profile, file, campaign, rooms, hashes }, null, 2),
    );

    let app, page;
    const launches = [],
      errors = [],
      reads = [],
      captures = [];
    let stage = 'launch';
    async function tab(id) {
      if (!(await page.locator(id).isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator(id).click();
    }
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      launches.push({ pid: app.process().pid });
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page.locator('#campaign-screen-list').waitFor({ state: 'visible' });
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
        .click();
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .webContents.setZoomFactor(2),
      );
      await tab('#preparation-tab');
    }
    async function close() {
      if (!app || app.process().exitCode !== null) return;
      const child = app.process(),
        done = new Promise((r) => child.once('exit', (code, signal) => r({ code, signal })));
      await native.close();
      launches.at(-1).exit = await done;
      launches.at(-1).mainPidAbsent = await stat('/proc/' + child.pid)
        .then(() => false)
        .catch(() => true);
      app = null;
      await writeFile(out + '/processes.json', JSON.stringify({ launches, errors }, null, 2));
    }
    async function saved() {
      await page.locator('#key-save').click();
      await page.waitForFunction(
        () => document.querySelector('#key-save-status').dataset.state === 'saved',
      );
    }
    const preview = () =>
      page
        .locator('#key-dialog fieldset')
        .filter({ has: page.locator('legend').filter({ hasText: /^Beschreibungsvorschau$/ }) });
    async function capture(name) {
      const result = await app.evaluate(async ({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().endsWith('/index.html'),
          ),
          im = await w.capturePage();
        return {
          size: im.getSize(),
          bounds: w.getContentBounds(),
          png: im.toPNG().toString('base64'),
          zoom: w.webContents.getZoomFactor(),
        };
      });
      assert.equal(result.size.width, result.bounds.width);
      assert.equal(result.size.height, result.bounds.height);
      await writeFile(out + '/' + name + '.png', Buffer.from(result.png, 'base64'));
      captures.push({ name, size: result.size, zoom: result.zoom });
    }
    async function reveal(term, name) {
      const rect = () =>
        page.locator('#key-rendered').evaluate((el, term) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const at = n.textContent.indexOf(term);
            if (at < 0) continue;
            const range = document.createRange();
            range.setStart(n, at);
            range.setEnd(n, at + term.length);
            const r = range.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, screen: innerHeight };
          }
          return null;
        }, term);
      const pointer = await page.evaluate(() => ({ x: innerWidth - 55, y: innerHeight / 2 }));
      await page.mouse.move(pointer.x, pointer.y);
      for (let i = 0; i < 50; i++) {
        const r = await rect();
        assert(r, 'Missing exact rendered line: ' + term);
        if (r.y > 135 && r.y + r.height < r.screen - 45) {
          await capture(name);
          return r;
        }
        await page.mouse.wheel(0, r.y < 135 ? -280 : 280);
        await page
          .waitForFunction(
            ({ term, old }) => {
              const el = document.querySelector('#key-rendered'),
                walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
              let n;
              while ((n = walker.nextNode())) {
                const at = n.textContent.indexOf(term);
                if (at < 0) continue;
                const range = document.createRange();
                range.setStart(n, at);
                range.setEnd(n, at + term.length);
                return Math.abs(range.getBoundingClientRect().y - old) > 2;
              }
              return false;
            },
            { term, old: r.y },
            { timeout: 1500 },
          )
          .catch(() => {});
      }
      throw Error('Exact rendered line not revealed with real wheel scrolling: ' + term);
    }
    try {
      await launch();
      stage = 'create Mara';
      await page.getByRole('button', { name: 'Eintrag anlegen…', exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Name oder Titel', exact: true })
        .fill('Mara die Botenmeisterin');
      await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Notizen für die Spielleitung', exact: true })
        .fill(
          'Mara verwaltet die nächtlichen Lieferungen. Sie wechselt zwischen Torhalle, Archiv und Keller. Wer das Dienstsiegel zeigt, darf sie sprechen.',
        );
      await page.getByRole('button', { name: 'Raum-Keys', exact: true }).click();
      await openDesktopKeyReferences(page);
      stage = 'individual keys';
      for (const [name, publicText, privateText] of material) {
        await page
          .locator('#key-room-list')
          .getByRole('button', { name: new RegExp(name) })
          .click();
        await page.locator('#key-read-aloud').fill(publicText);
        await page.locator('#key-gm-notes').fill(privateText);
        await linkDesktopKeyReference(page, 'NSC: Mara die Botenmeisterin');
        await saved();
      }
      stage = 'shared template';
      await page.locator('#key-template-new').click();
      await page.locator('#key-new-name').fill('Nebelwacht · gemeinsame Atmosphäre');
      await page.locator('#key-create-owner').click();
      await page.waitForFunction(() =>
        document.querySelector('#key-owner').selectedOptions[0]?.textContent.startsWith('Vorlage:'),
      );
      await page
        .locator('#key-read-aloud')
        .fill(
          'In der Burg hängt der Geruch von kaltem Rauch. An jeder Tür glänzt ein bernsteinfarbenes Dienstsiegel.',
        );
      await page
        .locator('#key-gm-notes')
        .fill(
          'Mara erkennt berechtigte Boten am Dienstsiegel. Fremde Lieferungen bleiben verschlossen.',
        );
      await saved();
      for (const n of [1, 2, 3])
        await page
          .getByRole('checkbox', {
            name: 'Raum ' + n + ' für Sammeländerung auswählen',
            exact: true,
          })
          .check();
      await page.locator('#key-template-link').scrollIntoViewIfNeeded();
      const uncovered = await page.locator('#key-template-link').evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      assert(uncovered);
      for (const name of ['Torhalle', 'Archiv', 'Keller'])
        assert((await page.locator('#key-template-targets').innerText()).includes(name));
      await page.locator('#key-template-link').click();
      await page
        .locator('#key-template-status')
        .filter({ hasText: 'Individuelle Inhalte erhalten' })
        .waitFor();
      await capture('linked-three-rooms-200');
      assert(await page.locator('#key-template-link').isDisabled());
      stage = 'central change';
      await page.locator('#key-template-edit').click();
      const common = await page.locator('#key-read-aloud').inputValue();
      await page.locator('#key-read-aloud').fill(common.replace('bernsteinfarbenes', 'blaues'));
      await saved();
      await page.locator('#key-close').click();
      await close();
      stage = 'Fresh find and continue';
      await launch();
      await page.getByRole('button', { name: 'Raum-Keys', exact: true }).click();
      await page.locator('#key-search').fill('blaues Dienstsiegel');
      await page.locator('#key-search').press('Enter');
      await page
        .locator('summary')
        .filter({ hasText: /^Beschreibungsvorschau$/ })
        .click();
      await openDesktopKeyReferences(page);
      for (const [i, [name, publicText, privateText]] of material.entries()) {
        await page
          .locator('#key-room-list')
          .getByRole('button', { name: new RegExp(name) })
          .click();
        assert.equal(await page.locator('#key-read-aloud').inputValue(), publicText);
        assert.equal(await page.locator('#key-gm-notes').inputValue(), privateText);
        await preview().locator('select').selectOption('gm');
        let gm = await page.locator('#key-rendered').innerText();
        assert(gm.includes('blaues Dienstsiegel'));
        assert(gm.includes(privateText));
        assert(!gm.includes('bernsteinfarbenes'));
        await page
          .locator('#key-gm-notes')
          .fill(
            privateText +
              '\nFortsetzung: Raum ' +
              (i + 1) +
              ' wurde für den Nachtbesuch vorbereitet.',
          );
        await saved();
        await preview().locator('select').selectOption('public');
        const renderedPublic = await page.locator('#key-rendered').innerText();
        assert(renderedPublic.includes(publicText));
        assert(renderedPublic.includes('blaues Dienstsiegel'));
        for (const hidden of [privateText, 'Fortsetzung:', 'Fremde Lieferungen'])
          assert(!renderedPublic.includes(hidden));
        await preview().locator('select').selectOption('gm');
        const privateBounds = await reveal(privateText.slice(0, 24), 'fresh-' + i + '-private-200'),
          commonBounds = await reveal('blaues Dienstsiegel', 'fresh-' + i + '-shared-200');
        reads.push({
          name,
          publicText,
          privateText,
          gm,
          renderedPublic,
          privateBounds,
          commonBounds,
          reference: await page.locator('#key-references').innerText(),
        });
      }
      await page.locator('#key-close').click();
      await close();
      stage = 'stored result';
      const check = new CampaignStore(file),
        w = check.activate(campaign.id),
        keys = check.drawing(w.token).keyContent,
        notes = check.preparation(w.token, '').notes.filter((n) => !n.trashed);
      assert.equal(notes.length, 1);
      assert.equal(keys.filter((k) => k.kind === 'template').length, 1);
      for (const [i, room] of rooms.entries()) {
        const key = keys.find((k) => k.id === room.id);
        assert.equal(key.blocks.filter((b) => b.kind === 'template').length, 1);
        assert.equal(key.references.filter((r) => r.kind === 'npc').length, 1);
        assert.equal(key.references.find((r) => r.kind === 'npc').id, notes[0].note.id);
        assert(
          key.blocks.some(
            (b) =>
              b.kind === 'text' &&
              b.visibility === 'gm' &&
              b.text ===
                material[i][2] +
                  '\nFortsetzung: Raum ' +
                  (i + 1) +
                  ' wurde für den Nachtbesuch vorbereitet.',
          ),
        );
      }
      check.close();
      assert.equal(errors.length, 0);
      for (const p of launches) {
        assert.deepEqual(p.exit, { code: 0, signal: null });
        assert(p.mainPidAbsent);
      }
      await native.recordResult({
        source,
        dirty,
        hashes,
        profile,
        case: 23,
        stage: 'complete',
        uncovered,
        launches,
        errors,
        reads,
        captures,
        humanAcceptance: false,
        installedPackageAcceptance: false,
      });
      console.log(JSON.stringify({ out, profile, source, stage: 'complete', launches }));
    } catch (error) {
      await writeFile(
        out + '/failure.json',
        JSON.stringify({ source, profile, stage, error: error.stack, launches, errors }, null, 2),
      );
      console.error(error);
      if (app) await close().catch(() => {});
      process.exitCode = 1;
    } finally {
    }
  },
);
