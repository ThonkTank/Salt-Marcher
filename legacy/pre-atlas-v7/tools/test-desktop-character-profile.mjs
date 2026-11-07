// Isolated real Party workflow. No user profile or campaign is opened.
import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/character-profile-native');
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/character-profile-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/character-profile-store.cjs'),
  Database = require('better-sqlite3');
for (const zoom of [1]) {
  const native = await createNativeSession({
    root,
    output: path.join(output, String(zoom)),
    name: 'character-profile',
  });
  let db;
  try {
    const store = new CampaignStore(
      native.profile + '/workbench.sqlite',
      require(root + '/package.json').version,
    );
    let campaign, ids;
    try {
      campaign = store.create('Neue Figur und XP-Korrektur');
      const w = store.activate(campaign.id),
        command = (action) => ({
          commandId: randomUUID(),
          token: w.token,
          campaignId: campaign.id,
          action,
        });
      store.tutorial('skipped');
      store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
      ids = Array.from(
        { length: 45 },
        (_, i) =>
          store.executeLive(
            command({
              kind: 'create-character',
              profile: { name: i === 0 ? 'Borin' : i < 3 ? 'Ada' : 'Reserve ' + i },
            }),
          ).character.id,
      );
    } finally {
      store.close();
    }
    db = new Database(native.profile + '/workbench.sqlite', { readonly: true });
    const others = () =>
      ['character_profile', 'character_progress', 'roster_member'].map((table) =>
        db
          .prepare(
            'SELECT * FROM ' +
              table +
              ' WHERE id IN (' +
              ids.map(() => '?').join(',') +
              ') ORDER BY id',
          )
          .all(...ids),
      );
    const original = others(),
      clock = () => db.prepare('SELECT * FROM scene_clock ORDER BY scene_id').all(),
      originalClock = clock();
    const profile = (id) =>
      JSON.parse(db.prepare('SELECT payload FROM character_profile WHERE id=?').get(id).payload);
    const progress = (id) =>
      JSON.parse(db.prepare('SELECT payload FROM character_progress WHERE id=?').get(id).payload);
    let page;
    async function open() {
      page = await native.launch(zoom);
      await native.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .setSize(1600, 1000),
      );
      assert.equal(
        await native.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.getZoomFactor(),
        ),
        zoom,
      );
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (!(await page.locator('#live-tab').isVisible())) {
        if (await page.locator('#atlas-navigation').isVisible())
          await page.locator('#atlas-navigation').click();
        if (!(await page.locator('#live-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
      }
      await page.locator('#live-tab').click();
      await page.locator('#party-shortcut').click();
      await settled();
      await page.locator('#party-roster-panel summary').click();
    }
    async function settled() {
      await page.waitForFunction(
        () =>
          !document.querySelector('#party-create').disabled &&
          !document.querySelector('#party-status').textContent.includes('geladen'),
      );
    }
    const search = (text) => page.locator('#party-search').fill(text);
    const row = (id) => page.locator('#party-roster [data-character-id="' + id + '"]');
    async function xp(id, amount, action) {
      await row(id).locator('.party-level-meter').click();
      await page.locator('#party-xp-amount').fill(String(amount));
      if (action === 'set') await page.locator('#party-xp-amount').press('Enter');
      else await page.locator('#party-xp-' + action).click();
      await page.locator('#party-xp-editor').waitFor({ state: 'hidden' });
      await settled();
    }
    await open();
    await search('Borin');
    assert.equal(await page.locator('#party-roster .party-card').count(), 1);
    await page.locator('#party-create').click();
    await page.locator('#party-name').fill('Ada');
    await page.locator('#party-profile-form button[type=submit]').click();
    await page.locator('#party-editor').waitFor({ state: 'hidden' });
    await settled();
    const created = db
      .prepare(
        'SELECT id FROM character_profile WHERE id NOT IN (' + ids.map(() => '?').join(',') + ')',
      )
      .all(...ids);
    assert.equal(created.length, 1);
    const id = created[0].id;
    assert.equal(
      await page.locator('#party-search').inputValue(),
      id,
      'Confirmed new character must be reachable through the existing roster route despite the old filter',
    );
    assert.equal(await page.locator('#party-roster .party-card').count(), 1);
    assert.equal(await row(id).count(), 1);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'party-search',
      'Only unlocked controls can receive the confirmed handoff focus',
    );
    assert.deepEqual(profile(id), { name: 'Ada' });
    assert.equal(progress(id).xp, null);
    assert.equal(progress(id).health, null);
    console.log('Confirmed filtered creation', zoom);
    await native.capture(page, 'created');
    // Repeat the same handoff for a renamed homonym found under its previous name.
    await search('Ada');
    await row(id).locator('.party-member-toggle').click();
    await row(id).getByRole('button', { name: 'Profil bearbeiten', exact: true }).click();
    await page.locator('#party-name').fill('Ada neu');
    await page.locator('#party-field-playerName').fill('Lea Ω');
    await page.locator('#party-field-languages').fill('Common, Elvish');
    await page.locator('#party-profile-form button[type=submit]').click();
    await page.locator('#party-editor').waitFor({ state: 'hidden' });
    await settled();
    assert.equal(await page.locator('#party-search').inputValue(), id);
    assert.equal(await page.locator('#party-roster .party-card').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'party-search');
    assert.deepEqual(profile(id), {
      name: 'Ada neu',
      playerName: 'Lea Ω',
      languages: ['Common', 'Elvish'],
    });
    if (await row(id).locator('.party-card-details').isHidden())
      await row(id).locator('.party-member-toggle').click();
    await row(id).getByRole('button', { name: 'Zur Party', exact: true }).click();
    await settled();
    await xp(id, 900, 'set');
    assert.equal(progress(id).xp, 900);
    await page.locator('#party-actions summary').click();
    await page.locator('#party-award-open').click();
    await page.locator('#party-award-xp').fill('0');
    await page.locator('#party-award-load').fill('400');
    await page.locator('#party-award-submit').click();
    await page.locator('#party-award-panel').waitFor({ state: 'hidden' });
    await settled();
    const rest = progress(id).rest;
    assert.equal(rest.longXp, 400);
    await xp(id, 100, 'add');
    assert.equal(progress(id).xp, 1000);
    assert.deepEqual(progress(id).rest, rest);
    await xp(id, 2000, 'subtract');
    assert.equal(progress(id).xp, 0);
    assert.deepEqual(progress(id).rest, rest);
    assert.match(await row(id).locator('.party-level-meter').innerText(), /L1/);
    console.log('Profile and XP correction preserve rest', zoom);
    await native.capture(page, 'corrected');
    const saved = { profile: profile(id), progress: progress(id) };
    assert.deepEqual(others(), original);
    assert.deepEqual(clock(), originalClock);
    await native.close();
    await open();
    await search('Ada neu');
    assert.equal(await row(id).count(), 1);
    assert.match(await row(id).locator('.party-level-meter').innerText(), /L1/);
    assert.deepEqual({ profile: profile(id), progress: progress(id) }, saved);
    assert.deepEqual(others(), original);
    assert.deepEqual(clock(), originalClock);
    console.log('Fresh process and 45 original characters verified', zoom);
    await native.capture(page, 'reopened');
    await native.close();
    await native.finish({
      characterId: id,
      checks: [
        'Filtered creation and homonym rename return to the confirmed identity',
        'Optional profile and HP remain unknown',
        'Set/add/subtract XP derive level and retain 400 consumed rest XP',
        '45 existing characters and scene clock preserved through normal restart',
      ],
    });
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    db?.close();
    await native.dispose();
  }
}
const runs = await Promise.all(
  [1].map(async (z) =>
    JSON.parse(await readFile(path.join(output, String(z), 'result.json'), 'utf8')),
  ),
);
await writeFile(path.join(output, 'result.json'), JSON.stringify({ runs }, null, 2));
