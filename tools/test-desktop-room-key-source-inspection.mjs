import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyReferences, linkDesktopKeyReference } from './qa-key-entry.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, mkdir, stat, copyFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { openDesktopKeyFromAtlas } from './qa-key-entry.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
if (!process.env.GM_QA_OUT || !process.env.GM_QA_START_RESULT)
  throw Error(
    'Set GM_QA_OUT to a new evidence directory and GM_QA_START_RESULT to the normally closed case26 result.',
  );
const out = process.env.QA_EVIDENCE_DIR ?? path.resolve(process.env.GM_QA_OUT);
await runNativeProbe(
  { output: out, name: 'room-key-source-inspection', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const resultPath = path.resolve(process.env.GM_QA_START_RESULT),
      completed = JSON.parse(await readFile(resultPath, 'utf8')),
      initial = JSON.parse(await readFile(path.dirname(resultPath) + '/fixture.json', 'utf8'));
    if (!completed.complete || completed.launches?.some((l) => !l.pidAbsent || l.exit?.code !== 0))
      throw Error('Starting fixture was not normally closed.');
    const profile = native.profile,
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
    await writeFile(
      out + '/fixture.json',
      JSON.stringify(
        { source, dirty, profile, file, campaign, rooms, sourceNote, raw, hashes },
        null,
        2,
      ),
    );

    let app, page, nativeProcess;
    const launches = [],
      errors = [],
      inspections = [],
      keyChecks = [],
      freshChecks = [];
    const zoom = Number(process.env.GM_QA_ZOOM ?? 2),
      sivCorrection = 'Dritte Nacht am Fährsteg: Siv spricht erst, wenn Varo außer Hörweite ist.',
      questCorrection =
        'Dritte Nacht am Schrank: Vor dem Öffnen nach einer Falle suchen; die Schatulle bleibt unbestätigt.';
    const notes = [
      ['Siv die Fährfrau', sivCorrection],
      ['Der Schrank in der Salzscheune', questCorrection],
    ];
    const keys = [
      [
        'Fährsteg',
        'Nebel hängt über dem Steg. Siv hält ihre Laterne tief über dem Wasser.',
        'Siv erwartet die Gruppe. Varo darf das Versteck ihres Bruders nicht erfahren.',
      ],
      [
        'Salzscheune',
        'Salzstaub liegt auf den Dielen. Ein verschlossener Schrank lehnt an der Nordwand.',
        'Varo wartet am Seiteneingang. Schrank und Schatulle getrennt untersuchen; das Siegel ist unbestätigt.',
      ],
    ];
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
    }
    async function close() {
      const exited = new Promise((r) =>
        nativeProcess.once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      launches.at(-1).exit = await exited;
      launches.at(-1).mainPidAbsent = await stat('/proc/' + launches.at(-1).pid)
        .then(() => false)
        .catch(() => true);
      await writeFile(out + '/processes.json', JSON.stringify({ launches, errors }, null, 2));
    }
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      nativeProcess = app.process();
      launches.push({ pid: nativeProcess.pid });
      page = await app.firstWindow();
      page.setDefaultTimeout(25000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await app.evaluate(
        ({ BrowserWindow }, z) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(z),
        zoom,
      );
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
      await revealWorkspaceNavigation(page);
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#atlas-tab').click();
      await openDesktopKeyFromAtlas(page, 'Fährsteg');
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
    }
    async function references() {
      await openDesktopKeyReferences(page);
    }
    async function saved() {
      await page.waitForFunction(
        () => document.querySelector('#key-save-status').dataset.state === 'saved',
      );
    }
    async function openNote(title) {
      await references();
      await page
        .locator('#key-references')
        .getByRole('button', { name: title, exact: true })
        .click();
      await page.waitForFunction((t) => document.getElementById('note-title').value === t, title);
    }
    async function backToKey() {
      await page.locator('#key-reference-return').click();
      await page.locator('#key-reference-panel').waitFor({ state: 'hidden' });
    }
    async function inspect(origin, passage, name, escape = false) {
      const a = page.locator('#note-gm'),
        body = await a.inputValue(),
        query = await page.locator('#key-search').inputValue(),
        roomText = await page.locator('#key-gm-notes').inputValue();
      await a.click();
      await a.press('Control+Home');
      await a.press('ArrowRight');
      const selection = await a.evaluate((e) => [e.selectionStart, e.selectionEnd]);
      const title = 'Zweite Nacht am Grauen Ufer · Rohprotokoll';
      await page.getByRole('button', { name: 'Ansehen: Quelle: ' + title, exact: true }).click();
      await page.locator('#quick-reference').waitFor({ state: 'visible' });
      await page.waitForFunction(
        (t) => document.querySelector('#quick-document h2')?.textContent === t,
        title,
      );
      const text = await page.locator('#quick-document').innerText();
      if (!text.includes(passage)) throw Error('Missing raw source passage');
      if (
        (await page.locator('#quick-document .toolbar button').count()) ||
        (await page.locator('#quick-pin').count())
      )
        throw Error('Inspection exposed game/edit handoff');
      await page.locator('#quick-document .quick-text').first().scrollIntoViewIfNeeded();
      if (origin.startsWith('Der')) {
        await page.locator('#quick-document').hover();
        await page.mouse.wheel(0, 600);
        await page.waitForFunction(() =>
          [...document.querySelectorAll('#quick-reference, #quick-reference *')].some(
            (e) => e.scrollTop > 0,
          ),
        );
      }
      await shot(name);
      if (escape) await page.keyboard.press('Escape');
      else await page.locator('#quick-close').click();
      await page.locator('#quick-reference').waitFor({ state: 'hidden' });
      if (
        !(await page.locator('#key-dialog').evaluate((e) => e.open)) ||
        (await page.locator('#note-title').inputValue()) !== origin ||
        (await a.inputValue()) !== body ||
        (await page.locator('#key-search').inputValue()) !== query ||
        (await page.locator('#key-gm-notes').inputValue()) !== roomText ||
        JSON.stringify(await a.evaluate((e) => [e.selectionStart, e.selectionEnd])) !==
          JSON.stringify(selection)
      )
        throw Error('Reader displaced owning editor/caret/room/filter');
      inspections.push({
        origin,
        title,
        passage,
        text,
        roomEditorAndCaretPreserved: true,
        query,
        escape,
      });
    }
    async function append(text) {
      await page.locator('#note-gm').click();
      await page.locator('#note-gm').press('Control+End');
      await page.locator('#note-gm').press('Enter');
      await page.locator('#note-gm').press('Enter');
      await page.keyboard.type(text);
      await backToKey();
    }
    function audit() {
      const db = require('better-sqlite3')(file, { readonly: true }),
        prior = require('better-sqlite3')(completed.file, { readonly: true });
      try {
        const rows = (d, t) => d.prepare('SELECT * FROM ' + t + ' ORDER BY id').all(),
          after = rows(db, 'world_note').map((r) => JSON.parse(r.payload)),
          before = rows(prior, 'world_note').map((r) => JSON.parse(r.payload));
        if (after.length !== 7) throw Error('Unexpected note copies');
        for (const old of before) {
          const now = after.find((n) => n.id === old.id),
            extra = notes.find((n) => n[0] === old.title)?.[1];
          if (
            !now ||
            !now.gmNotes.startsWith(old.gmNotes) ||
            (!extra && JSON.stringify(now) !== JSON.stringify(old)) ||
            (extra && !now.gmNotes.endsWith(extra)) ||
            JSON.stringify(now.relations) !== JSON.stringify(old.relations)
          )
            throw Error('Original mismatch ' + old.title);
        }
        for (const t of ['plan', 'planned_visit', 'session_visit'])
          if (JSON.stringify(rows(db, t)) !== JSON.stringify(rows(prior, t)))
            throw Error('Existing plan/visit changed');
        const oldRoom = rows(prior, 'room')[0],
          nowRoom = rows(db, 'room').find((r) => r.id === oldRoom.id);
        if (oldRoom.payload !== nowRoom.payload || oldRoom.name !== nowRoom.name)
          throw Error('Old room geometry/prose changed');
        const ks = rows(db, 'dungeon_key_content').map((r) => JSON.parse(r.payload));
        if (ks.length !== 2) throw Error('Room count mismatch');
        for (const k of ks)
          if (
            k.references.length !== 2 ||
            !k.references.some((r) => r.id === 'f7b74c4e-2237-4c0e-b10f-79dcb567eb1e') ||
            !k.references.some((r) => r.id === 'b0e321ca-bea5-4127-b235-9063e2285641')
          )
            throw Error('Shared original binding mismatch');
        return {
          sevenOriginalIdentities: true,
          onlyTwoIntendedNotesAppended: true,
          rawLogsAndOtherNotesExact: true,
          bothKeysUseSameTwoOriginals: true,
          oldRoomGeometryProseExact: true,
          existingPlansAndVisitsExact: true,
          publicRenderExcludesPrivateCues: true,
          schema: db.pragma('user_version', { simple: true }),
        };
      } finally {
        db.close();
        prior.close();
      }
    }
    try {
      await launch();
      for (const [i, [name, readAloud, gm]] of keys.entries()) {
        if (i) {
          await page.locator('#key-add-room').click();
          await page.waitForFunction(
            () => document.getElementById('key-name').value !== 'Fährsteg',
          );
          await page.locator('#key-name').fill(name);
        } else
          await page
            .locator('#key-room-list')
            .getByRole('button', { name: /Fährsteg/ })
            .click();
        await page.locator('#key-read-aloud').fill(readAloud);
        await page.locator('#key-gm-notes').fill(gm);
        await page.locator('#key-name').click();
        await saved();
        await references();
        for (const label of ['NSC: Siv die Fährfrau', 'Quest: Der Schrank in der Salzscheune']) {
          await linkDesktopKeyReference(page, label);
          await saved();
        }
      }
      await page
        .locator('#key-room-list')
        .getByRole('button', { name: /Fährsteg/ })
        .click();
      await openNote(notes[0][0]);
      await inspect(notes[0][0], 'das Signalfeuer freiwillig verlassen', 'siv-source');
      await append(sivCorrection);
      await page
        .locator('#key-room-list')
        .getByRole('button', { name: /Salzscheune/ })
        .click();
      await openNote(notes[1][0]);
      await inspect(
        notes[1][0],
        'Darin soll eine versiegelte Schatulle liegen.',
        'quest-source',
        true,
      );
      await append(questCorrection);
      for (const [name, readAloud, gm] of keys) {
        await page
          .locator('#key-room-list')
          .getByRole('button', { name: new RegExp(name) })
          .click();
        if ((await page.locator('#key-preview').getAttribute('open')) === null)
          await page.locator('#key-preview summary').click();
        await page.locator('#key-audience').selectOption('public');
        await page.waitForFunction(
          (t) => document.getElementById('key-rendered').textContent.includes(t),
          readAloud,
        );
        const publicRender = await page.locator('#key-rendered').innerText();
        if (/Varo|Versteck|unbestätigt/.test(publicRender)) throw Error('Private room cue leaked');
        await page.locator('#key-rendered').scrollIntoViewIfNeeded();
        await shot(name === 'Fährsteg' ? 'faehrsteg-public' : 'salzscheune-public');
        await page.locator('#key-audience').selectOption('gm');
        await page.waitForFunction(
          (t) => document.getElementById('key-rendered').textContent.includes(t),
          gm,
        );
        for (const [title, correction] of notes) {
          await openNote(title);
          if (!(await page.locator('#note-gm').inputValue()).includes(correction))
            throw Error('Shared update unavailable');
          await backToKey();
        }
        keyChecks.push({ name, readAloud, gm, publicRender, bothUpdatedOriginals: true });
      }
      await page.locator('#key-close').click();
      await close();
      await launch();
      await page.locator('#key-search').fill('Varo');
      await page.waitForFunction(
        () => document.querySelectorAll('#key-room-list button').length === 2,
      );
      for (const [name, readAloud, gm] of keys) {
        await page
          .locator('#key-room-list')
          .getByRole('button', { name: new RegExp(name) })
          .click();
        if (
          (await page.locator('#key-read-aloud').inputValue()) !== readAloud ||
          (await page.locator('#key-gm-notes').inputValue()) !== gm
        )
          throw Error('Fresh room text mismatch');
        for (const [title, correction] of notes) {
          await openNote(title);
          const body = await page.locator('#note-gm').inputValue();
          if (!body.includes(correction)) throw Error('Fresh shared update missing');
          await page.locator('#note-gm').scrollIntoViewIfNeeded();
          await shot(
            'fresh-' +
              (name === 'Fährsteg' ? 'faehrsteg' : 'salzscheune') +
              '-' +
              (title.startsWith('Siv') ? 'siv' : 'quest'),
          );
          if (name === 'Salzscheune' && title.startsWith('Der'))
            await inspect(
              title,
              'Darin soll eine versiegelte Schatulle liegen.',
              'fresh-quest-source',
            );
          freshChecks.push({ name, title, body });
          await backToKey();
        }
      }
      await page.locator('#key-close').click();
      await close();
      const checked = audit();
      if (errors.length || launches.some((l) => l.exit?.code !== 0 || !l.mainPidAbsent))
        throw Error('UI/process lifecycle mismatch');
      const result = {
        complete: true,
        source,
        dirty,
        hashes,
        profile,
        file,
        campaign,
        rooms,
        task: 'Prepare two room keys with separate public/private cues; reuse the same Siv and quest originals; inspect their raw source directly in the embedded room editor; append contextual updates; normalFresh contentfind and use both originals in both rooms.',
        sivCorrection,
        questCorrection,
        keyChecks,
        freshChecks,
        inspections,
        launches,
        errors,
        audit: checked,
        zoom,
        humanAcceptance: false,
        installedPackageAcceptance: false,
        completedAt: new Date().toISOString(),
      };
      await native.recordResult(result);
      console.log(
        JSON.stringify({ complete: true, out, source, launches, errors, audit: checked }),
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
    }
  },
);
