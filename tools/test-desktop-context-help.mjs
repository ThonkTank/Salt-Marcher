import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  zoom = 1;
const native = await createNativeSession({
  root,
  output: process.env.QA_EVIDENCE_DIR ?? root + '/.build/context-help',
  name: 'context-help',
});
try {
  assert([1].includes(zoom));
  const require = createRequire(import.meta.url);
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/context-help-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/context-help-store.cjs');
  let store = new CampaignStore(
    native.profile + '/workbench.sqlite',
    require(root + '/package.json').version,
  );
  const campaign = store.create('Hilfe beim Vorbereiten'),
    w = store.activate(campaign.id);
  const note = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    title: 'Wache am Nordtor',
    kind: 'npc',
    gmNotes: '  Originalwissen\r\n',
    readAloud: 'Privater Originaltext',
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
  store.changePreparation({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: { ...note, id: randomUUID(), title: 'Die Torwache', kind: 'faction' },
    },
  });
  store.tutorial('skipped');
  store.close();
  const storedNote = () => {
    const db = new (require('better-sqlite3'))(native.profile + '/workbench.sqlite', {
      readonly: true,
    });
    try {
      return db
        .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
        .get(campaign.id, note.id);
    } finally {
      db.close();
    }
  };
  const draft = '  Unfertige Ergänzung\nDie Wache kennt …',
    relation = 'liefert unfertigen Hinweis';
  async function launch() {
    const page = await native.launch(zoom);
    await native.app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      w.unmaximize();
      w.setContentSize(1400, 1000);
    });
    await page
      .locator('#campaign-screen-list article')
      .filter({ hasText: campaign.name })
      .getByRole('button', { name: 'Fortsetzen', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    if (!(await page.locator('#preparation-tab').isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#preparation-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
    }
    await page.locator('#preparation-tab').click();
    await page.locator('#preparation-knowledge').click();
    await page.locator('#world-search').fill(note.title);
    await page.locator('#world-list button').filter({ hasText: note.title }).click();
    await page.waitForFunction(
      (title) => document.querySelector('#note-title').value === title,
      note.title,
    );
    return page;
  }
  let page = await launch();
  await page.locator('#note-gm').fill(draft);
  await page.locator('#relation-label').fill(relation);
  const beforeHelp = storedNote();
  await page.keyboard.press('F1');
  await page.locator('#tutorial-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#tutorial-lessons li').first().locator('h3').textContent(),
    'Beziehungen verfolgen',
  );
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tutorial-heading');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tutorial-search');
  await page.keyboard.type('Zusatzpakete');
  assert.equal(await page.locator('#tutorial-lessons li:visible').count(), 1);
  assert.match(
    await page.locator('#tutorial-lessons li:visible').textContent(),
    /Rechte kontrollieren/,
  );
  await native.capture(page, 'searched-help');
  await page.keyboard.press('F1');
  assert.equal(await page.locator('#tutorial-search').inputValue(), 'Zusatzpakete');
  // Chromium search fields use the first Escape to clear their query.
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tutorial-search').inputValue(), '');
  await page.keyboard.press('Escape');
  await page.locator('#tutorial-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'relation-label');
  assert.equal(await page.locator('#relation-label').inputValue(), relation);
  assert.equal(await page.locator('#note-gm').inputValue(), draft);
  assert.deepEqual(
    storedNote(),
    beforeHelp,
    'Opening, searching and closing help must not commit the note draft',
  );
  await page.locator('#relation-label').press('End');
  await page.keyboard.type('!');
  assert.equal(await page.locator('#relation-label').inputValue(), relation + '!');
  // Nested help must leave its owning dialog open and return to the actual control.
  await page.locator('#application-trigger').click();
  await page.locator('#application-settings').click();
  await page.locator('#extensions-open').focus();
  await page.keyboard.press('F1');
  await page.locator('#tutorial-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#tutorial-search').inputValue(), '');
  assert.equal(
    await page.locator('#tutorial-lessons li').first().locator('h3').textContent(),
    'Lokale Erweiterungspakete kontrollieren',
  );
  await native.capture(page, 'nested-help');
  await page.keyboard.press('Escape');
  assert(await page.locator('#preset-manager').isVisible());
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'extensions-open');
  await page.locator('#preset-close').click();
  assert.equal(await page.locator('#note-gm').inputValue(), draft);
  await native.close();
  page = await launch();
  assert.equal(await page.locator('#note-gm').inputValue(), draft);
  await page.locator('#relation-label').focus();
  await page.keyboard.press('F1');
  await page.locator('#tutorial-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#tutorial-lessons li').first().locator('h3').textContent(),
    'Beziehungen verfolgen',
  );
  await page.locator('#tutorial-skip').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'relation-label');
  await native.close();
  store = new CampaignStore(
    native.profile + '/workbench.sqlite',
    require(root + '/package.json').version,
  );
  try {
    const active = store.activate(campaign.id);
    assert.deepEqual(
      store.preparation(active.token).notes.find((row) => row.note.id === note.id).note,
      { ...note, revision: 2, gmNotes: draft.replace(/\n/g, '\r\n') },
    );
    assert.equal(store.tutorial().state, 'skipped');
  } finally {
    store.close();
  }
  await native.finish({
    zoom,
    contextFromAncestor: true,
    searchAndKeyboardReturn: true,
    nestedDialogPreserved: true,
    helpDoesNotCommitDraft: true,
    sourceIdentityAndEditedTextPreserved: true,
    restart: true,
  });
  console.log('COMPLETE context help at ' + zoom);
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
