import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyReferences } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, appendFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out = process.env.QA_EVIDENCE_DIR ?? process.env.GM_QA_OUT;
await runNativeProbe(
  { output: out, name: 'quest-review', resultName: 'result.json' },
  async (native) => {
    if (!out || !process.env.GM_QA_START_RESULT)
      throw Error('Fresh GM_QA_OUT and closed GM_QA_START_RESULT required');
    await mkdir(out, { recursive: true });
    const start = process.env.GM_QA_START_RESULT;
    const initial = JSON.parse(
        await readFile(start.replace(/result\.json$/, 'fixture.json'), 'utf8'),
      ),
      completed = JSON.parse(await readFile(start, 'utf8'));
    if (!completed.complete || completed.launches.some((l) => l.exit?.code !== 0 || !l.pidAbsent))
      throw Error('Starting fixture must be normally closed.');
    const { openDesktopKeyFromAtlas } = await import(root + '/tools/qa-key-entry.mjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    // A normal exit can leave committed pages in WAL; copy the complete snapshot.
    const incoming = require('better-sqlite3')(completed.file, { readonly: true });
    try {
      await incoming.backup(file);
    } finally {
      incoming.close();
    }
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

    let app, page, nativeProcess, exitReceipt;
    const launches = [],
      errors = [];
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      nativeProcess = app.process();
      exitReceipt = new Promise((r) =>
        nativeProcess.once('exit', (code, signal) => r({ code, signal })),
      );
      launches.push({ pid: nativeProcess.pid });
      page = await app.firstWindow();
      page.setDefaultTimeout(20000);
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .webContents.setZoomFactor(1),
      );
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      return await snapshot();
    }
    async function tab(id) {
      await revealWorkspaceNavigation(page);
      if (!(await page.locator(id).isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator(id).click();
    }
    async function shot(name) {
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
      await writeFile(out + '/' + name + '.png', Buffer.from(png, 'base64'));
      return out + '/' + name + '.png';
    }
    async function snapshot() {
      return await page.locator('body').innerText();
    }
    async function close() {
      const exited = exitReceipt;
      await native.close();
      launches.at(-1).exit = await exited;
      launches.at(-1).mainPidAbsent = await stat('/proc/' + launches.at(-1).pid)
        .then(() => false)
        .catch(() => true);
      await writeFile(out + '/processes.json', JSON.stringify({ launches, errors }, null, 2));
      return launches.at(-1);
    }

    const quest = 'Der Schrank in der Salzscheune',
      npc = 'Siv die Fährfrau';
    const resolution =
      'Vierte Nacht · 22:40 – Der Schrank ist geöffnet und leer. Die Schatulle wurde nicht gefunden; diese Suche ist abgeschlossen. Offen bleibt das Gespräch mit Siv ohne Varo.';
    const nextEvening =
      'Nächster Abend nach der leeren Schatulle: Siv ohne Varo nach dem Versteck und der Kupfermarke fragen. Die Schranksuche ist abgeschlossen.';
    const followup =
      '22:55 – Ada bewahrt den leeren Siegelrest auf; Siv soll ihn am Fährsteg sehen.';
    const assert = (await import('node:assert/strict')).default;
    function database(file) {
      return JSON.parse(
        execFileSync(
          'python3',
          [
            '-c',
            `import sqlite3,json,sys
d=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True);d.row_factory=sqlite3.Row
tables=['world_note','room','dungeon_key_content','plan','planned_visit','session_visit','narrative_state','narrative_award','narrative_draft']
r={t:[dict(x) for x in d.execute('select * from '+t+' order by rowid')] for t in tables};r['schema']=d.execute('pragma user_version').fetchone()[0];print(json.dumps(r))`,
            file,
          ],
          { encoding: 'utf8' },
        ),
      );
    }
    const before = database(file);
    await writeFile(out + '/before.json', JSON.stringify(before, null, 2));
    async function enter() {
      await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
      await tab('#preparation-tab');
      await page.locator('#preparation-knowledge').click();
    }
    async function openNote(name) {
      await page.locator('#world-list').getByRole('button', { name, exact: true }).click();
      await page.waitForFunction((n) => document.querySelector('#note-title').value === n, name);
      if (name !== npc)
        await page.getByRole('combobox', { name: 'Narrativer Status', exact: true }).waitFor();
    }
    async function append(text) {
      const t = page.locator('#note-gm');
      await t.click();
      await t.press('Control+End');
      await t.press('Enter');
      await t.press('Enter');
      await page.keyboard.type(text);
    }
    async function packet() {
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption({ label: 'Unter vier Augen' });
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(() =>
        document
          .querySelector('#session-packet-content')
          .textContent.includes('Nächster Abend nach der leeren Schatulle'),
      );
    }
    async function readPacket(name, expected, shotName) {
      await page
        .locator('#session-packet-content .packet-runway')
        .getByRole('button', { name: new RegExp(name) })
        .click();
      await page.waitForFunction(
        ({ name, expected }) => {
          const root = document.querySelector('#session-packet-content');
          const h = [...root.querySelectorAll('h4')].find((n) => n.textContent.includes(name));
          const block = h?.closest('.packet-block');
          if (!block?.textContent.includes(expected)) return false;
          const b = block.getBoundingClientRect();
          return b.top >= 0 && b.top < innerHeight;
        },
        { name, expected },
      );
      await page
        .locator('#session-packet-content')
        .getByText(expected, { exact: false })
        .scrollIntoViewIfNeeded();
      await shot(shotName);
      return await page.locator('#session-packet-content').innerText();
    }
    async function readRoom() {
      await page
        .locator('#note-editor')
        .getByRole('button', { name: /^Fährsteg · Raum 1/ })
        .click();
      await page.locator('#key-dialog').waitFor();
      await openDesktopKeyReferences(page);
      await page
        .locator('#key-references')
        .getByRole('button', { name: quest, exact: true })
        .click();
      await page.waitForFunction(() => document.querySelector('#note-gm').value.includes('22:55'));
      const status = page.getByRole('combobox', { name: 'Narrativer Status', exact: true });
      assert.equal(await status.inputValue(), 'closed');
      await status.scrollIntoViewIfNeeded();
      await shot('room-current');
      const text = await page.locator('#note-gm').inputValue();
      await page.locator('#key-reference-return').click();
      await page.locator('#key-close').click();
      return text;
    }
    try {
      await launch();
      await enter();
      await openNote(quest);
      await append(resolution);
      await page
        .getByRole('combobox', { name: 'Narrativer Status', exact: true })
        .selectOption('closed');
      await page.getByRole('button', { name: 'Narrative Angaben speichern', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('#save-status')?.textContent.includes('Quest-/Gerüchtstatus') ||
          document.body.innerText.includes('Quest-/Gerüchtstatus und Belohnung gespeichert.'),
      );
      assert(
        !(await page
          .getByRole('button', {
            name: 'Geprüften Entwurf auf aktuellen Stand übernehmen',
            exact: true,
          })
          .isVisible()),
      );
      await page
        .getByRole('combobox', { name: 'Narrativer Status', exact: true })
        .scrollIntoViewIfNeeded();
      await shot('closed-without-recovery');
      const reviewed = [];
      for (const name of ['Das verschwundene Signalfeuer', 'Kupfermarke im Schlick']) {
        await openNote(name);
        reviewed.push({
          name,
          status: await page
            .getByRole('combobox', { name: 'Narrativer Status', exact: true })
            .inputValue(),
          text: await page.locator('#note-gm').inputValue(),
        });
      }
      await openNote(npc);
      await append(nextEvening);
      await packet();
      await readPacket(quest, resolution, 'evening-resolved');
      await readPacket(npc, nextEvening, 'evening-next-step');
      await page.locator('#session-packet-close').click();
      await close();
      await launch();
      await enter();
      await page.locator('#world-search').fill('Schrank ist geöffnet');
      await openNote(quest);
      assert.equal(
        await page.getByRole('combobox', { name: 'Narrativer Status', exact: true }).inputValue(),
        'closed',
      );
      await append(followup);
      const roomRead = await readRoom();
      await packet();
      const sessionRead = await readPacket(quest, followup, 'fresh-session-current');
      assert(sessionRead.includes('Geschlossen'));
      await page.locator('#session-packet-close').click();
      await close();
      await launch();
      await enter();
      await page.locator('#world-search').fill('leeren Siegelrest');
      await openNote(quest);
      assert((await page.locator('#note-gm').inputValue()).endsWith(followup));
      assert.equal(
        await page.getByRole('combobox', { name: 'Narrativer Status', exact: true }).inputValue(),
        'closed',
      );
      await readRoom();
      await packet();
      await readPacket(quest, followup, 'final-session-current');
      await page.locator('#session-packet-close').click();
      await close();
      const after = database(file),
        notes = new Map(
          after.world_note.map((r) => {
            const n = JSON.parse(r.payload);
            return [n.id, n];
          }),
        );
      assert.equal(after.world_note.length, before.world_note.length);
      for (const row of before.world_note) {
        const n = JSON.parse(row.payload),
          a = notes.get(n.id);
        if (n.title === quest || n.title === npc) {
          const appendage = n.title === quest ? resolution + '\n\n' + followup : nextEvening;
          assert.equal(a.gmNotes, n.gmNotes + '\n\n' + appendage);
          const b = { ...a, gmNotes: n.gmNotes, revision: n.revision };
          assert.deepEqual(b, n);
        } else
          assert.deepEqual(
            after.world_note.find((r) => r.id === row.id),
            row,
          );
      }
      for (const t of [
        'room',
        'dungeon_key_content',
        'plan',
        'planned_visit',
        'session_visit',
        'narrative_award',
      ])
        assert.deepEqual(after[t], before[t], t + ' must remain exact');
      assert.equal(after.narrative_draft.length, 0);
      assert.equal(after.schema, before.schema);
      assert.deepEqual(errors, []);
      assert(launches.every((l) => l.exit?.code === 0 && l.mainPidAbsent));
      await writeFile(out + '/after.json', JSON.stringify(after, null, 2));
      await native.recordResult({
        ...fixture,
        complete: true,
        task: 'Resolve quest with retained evidence; review other leads; prepare Siv; Fresh content refind/edit and same original from room and current evening; second Fresh persistence',
        reviewed,
        roomRead,
        sessionRead,
        launches,
        errors,
        zoom: 1,
        audit: {
          allEightOriginalIdentities: true,
          onlyQuestAndNpcAppended: true,
          allOtherNotesRawLogsExact: true,
          roomGeometryKeysPlansVisitsExact: true,
          noNarrativeDraftOrReward: true,
          schema: after.schema,
        },
        humanAcceptance: false,
      });
      console.log(JSON.stringify({ complete: true, out, launches, errors }));
    } catch (e) {
      if (
        nativeProcess &&
        !nativeProcess.exitCode &&
        (await stat('/proc/' + nativeProcess.pid)
          .then(() => true)
          .catch(() => false))
      )
        await close().catch(() => {});
      await writeFile(
        out + '/failure.json',
        JSON.stringify({ error: e.stack, launches, errors }, null, 2),
      );
      throw e;
    } finally {
    }
  },
);
