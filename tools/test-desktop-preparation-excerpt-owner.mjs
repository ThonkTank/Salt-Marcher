import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { runNativeProbe } from './native-session.mjs';
import { openNativeCampaign, revealWorkspaceNavigation } from './native-navigation.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const output = path.resolve(
  process.env.QA_EVIDENCE_DIR ?? '.build/preparation-excerpt-owner-native',
);
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/preparation-excerpt-owner-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/preparation-excerpt-owner-store.cjs');
await runNativeProbe({ output, name: 'preparation-excerpt-owner' }, async (native) => {
  const file = native.profile + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Auszüge mit eigenem Besitzer'),
    w = store.activate(campaign.id);
  const raw = {
    gmNotes: '  Siv wartet auf ein Lebenszeichen.\r\nWeitere wörtliche Zeile.  ',
    readAloud: 'Öffentliche Beschreibung.\r\nNoch eine Zeile.',
  };
  const note = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'note',
    title: 'Unverändertes Original',
    ...raw,
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    change: { kind: 'note', expectedRevision: null, note },
  });
  store.tutorial('skipped');
  store.close();
  async function open() {
    const page = await native.launch(1);
    await openNativeCampaign(page, campaign.id);
    await page.locator('#preparation-tab').click();
    await page.locator('#world-search').fill(note.title);
    await page
      .locator('#world-list')
      .getByRole('button', { name: /^Unverändertes Original/ })
      .click();
    await page.waitForFunction(
      (title) => document.getElementById('note-title').value === title,
      note.title,
    );
    return page;
  }
  async function excerpt(page, field) {
    const area = page.locator(field === 'gmNotes' ? '#note-gm' : '#note-read-aloud');
    if (field === 'readAloud' && !(await area.isVisible()))
      await page.locator('#note-read-aloud-summary').click();
    await area.click();
    await area.press('Control+Home');
    await area.press('Control+Shift+End');
    await page.locator('#note-excerpt').click();
    await page.locator('#note-excerpt-dialog').waitFor({ state: 'visible' });
    assert.equal(
      await page.locator('#note-excerpt-text').inputValue(),
      raw[field].replace(/\r\n/g, '\n'),
    );
    return area;
  }
  let page = await open();
  await native.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('campaign:change-preparation');
    globalThis.excerptOwnerCommands = [];
    let lose = true;
    ipcMain.removeHandler('campaign:change-preparation');
    ipcMain.handle('campaign:change-preparation', async (event, command) => {
      globalThis.excerptOwnerCommands.push({
        id: command.commandId,
        excerpt: !!command.change.excerpt,
      });
      const result = await original(event, command);
      if (lose && command.change.excerpt && result.ok) {
        lose = false;
        return { ok: false, error: 'QA: bestätigte Auszugsantwort verloren' };
      }
      return result;
    });
  });
  await excerpt(page, 'gmNotes');
  await page.locator('#note-excerpt-title').fill('Siv · Auszug');
  await page.locator('#note-excerpt-kind').selectOption('npc');
  await native.capture(page, '01-new-excerpt');
  await page.locator('#note-excerpt-save').click();
  await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
  await page.locator('#preparation-reconcile').waitFor({ state: 'visible' });
  await native.capture(page, '02-lost-response');
  await page.locator('#preparation-reconcile').click();
  await page.locator('#preparation-reconcile').waitFor({ state: 'hidden' });
  assert.equal((await native.app.evaluate(() => globalThis.excerptOwnerCommands)).length, 1);
  assert.equal(await page.locator('#note-title').inputValue(), note.title);
  await excerpt(page, 'readAloud');
  await page.locator('#note-excerpt-title').fill('Siv');
  await page.locator('#note-excerpt-choices button').filter({ hasText: 'Siv · Auszug' }).click();
  await page.locator('#note-excerpt-existing').waitFor({ state: 'visible' });
  await page.locator('#note-excerpt-save').click();
  await page.locator('#note-excerpt-dialog').waitFor({ state: 'hidden' });
  await page
    .locator('#note-excerpt-status')
    .getByRole('button', { name: 'Originalnotiz öffnen' })
    .waitFor();
  assert.equal(await page.locator('#note-title').inputValue(), note.title);
  assert.equal(await page.locator('#note-gm').inputValue(), raw.gmNotes.replace(/\r\n/g, '\n'));
  assert.equal(
    await page.locator('#note-read-aloud').inputValue(),
    raw.readAloud.replace(/\r\n/g, '\n'),
  );
  assert.equal(
    await page.locator('#note-read-aloud').evaluate((node) => node === document.activeElement),
    true,
  );
  const commands = await native.app.evaluate(() => globalThis.excerptOwnerCommands);
  assert.equal(commands.length, 2);
  assert(commands.every((c) => c.excerpt));
  assert.notEqual(commands[0].id, commands[1].id);
  await native.capture(page, '03-existing-excerpt-source-return');
  await native.close();
  page = await open();
  await page.locator('#world-search').fill('Siv · Auszug');
  await page
    .locator('#world-list')
    .getByRole('button', { name: /^Siv · Auszug/ })
    .click();
  await page.waitForFunction(() => document.getElementById('note-title').value === 'Siv · Auszug');
  assert.match(await page.locator('#note-gm').inputValue(), /Siv wartet auf ein Lebenszeichen/);
  assert.match(await page.locator('#note-read-aloud').inputValue(), /Öffentliche Beschreibung/);
  await native.capture(page, '04-fresh-process');
  await revealWorkspaceNavigation(page);
  await page.locator('#live-tab').click();
  await native.close();
  const reopened = new CampaignStore(file);
  try {
    const current = reopened.activate(campaign.id),
      notes = reopened.preparation(current.token).notes.map((row) => row.note),
      source = notes.find((n) => n.id === note.id),
      destination = notes.find((n) => n.title === 'Siv · Auszug');
    assert.equal(notes.length, 2);
    assert.equal(source.gmNotes, raw.gmNotes);
    assert.equal(source.readAloud, raw.readAloud);
    assert(destination.gmNotes.includes(raw.gmNotes));
    assert(destination.readAloud.includes(raw.readAloud));
    assert.equal(
      destination.relations.filter((relation) => relation.targetId === source.id).length,
      1,
    );
    return {
      commands,
      sourceUnchanged: true,
      existingDestinationPreserved: true,
      normalRestart: true,
    };
  } finally {
    reopened.close();
  }
});
