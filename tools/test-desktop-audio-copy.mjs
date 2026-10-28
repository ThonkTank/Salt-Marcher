// Native task: copy a local description beside a homonym, edit only that copy,
// restart, then explicitly select both records with real local audio decoding.
import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/audio-copy-native');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/audio-copy-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/audio-copy-store.cjs'),
  Database = require('better-sqlite3');
for (const zoom of [1]) {
  const native = await createNativeSession({
    root,
    output: path.join(output, String(zoom)),
    name: 'audio-copy',
  });
  let db;
  try {
    const store = new CampaignStore(
        native.profile + '/workbench.sqlite',
        require(root + '/package.json').version,
      ),
      campaign = store.create('Eigene Hafenmusik'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    const samples = 8000 * 60,
      bytes = Buffer.alloc(44 + samples * 2);
    bytes.write('RIFF');
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write('WAVE', 8);
    bytes.write('fmt ', 12);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24);
    bytes.writeUInt32LE(16000, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++)
      bytes.writeInt16LE(Math.round(32 * Math.sin((2 * Math.PI * 220 * i) / 8000)), 44 + i * 2);
    const sha256 = createHash('sha256').update(bytes).digest('hex'),
      media = {
        sha256,
        extension: '.wav',
        bytes: bytes.length,
        mime: 'audio/wav',
        originalName: 'Hafenlied.wav',
      };
    await mkdir(native.profile + '/audio');
    const mediaFile = native.profile + '/audio/' + sha256 + '.wav';
    await writeFile(mediaFile, bytes);
    let original, homonym;
    try {
      for (const name of ['Hafenlied', 'Hafenlied – Kopie']) {
        const asset = store.ingestAudio(w.token, { ...media, originalName: name + '.wav' });
        store.executeMusic(
          command({
            kind: 'asset',
            expectedRevision: asset.revision,
            asset: {
              ...asset,
              name,
              vibes: ['Hafen'],
              genres: ['Folk'],
              notes:
                name === 'Hafenlied'
                  ? '  Original\r\n[Quelle](https://example.invalid)  '
                  : 'Anderer Eintrag',
            },
          }),
        );
        if (name === 'Hafenlied') original = store.audioAsset(asset.id);
        else homonym = store.audioAsset(asset.id);
      }
      const s = store.music(w.token).state;
      store.executeMusic(
        command({
          kind: 'settings',
          ...s,
          expectedRevision: s.revision,
          autoplay: false,
          autoAmbience: false,
          fadeSeconds: 0,
        }),
      );
      store.tutorial('skipped');
    } finally {
      store.close();
    }
    db = new Database(native.profile + '/workbench.sqlite', { readonly: true });
    const rows = () => db.prepare('SELECT * FROM audio_asset ORDER BY id').all(),
      savedRows = rows(),
      state = () =>
        JSON.parse(
          db.prepare('SELECT payload FROM music_state WHERE campaign_id=?').get(campaign.id)
            .payload,
        );
    let page;
    async function launch() {
      page = await native.launch(zoom);
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (
        !(await page.locator('#music-tab').isVisible()) &&
        (await page.locator('#atlas-navigation').isVisible())
      )
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#music-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#music-tab').click();
      await page.locator('#audio-list article').first().waitFor();
    }
    const card = (name) =>
      page
        .locator('#audio-list article')
        .filter({ has: page.getByRole('heading', { name, exact: true }) });
    async function play(name, id) {
      await card(name).getByRole('button', { name: 'Abspielen', exact: true }).click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('audio[data-music-slot]')].some(
          (a) => !a.paused && a.readyState >= 2 && a.currentTime > 0.05,
        ),
      );
      assert.equal(state().current.assetId, id);
      await page.locator('#music > .music-console [data-music-transport=stop]').click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('audio')].every((a) => a.paused),
      );
    }
    await launch();
    await card('Hafenlied')
      .getByRole('button', { name: 'Beschreibung bearbeiten', exact: true })
      .click();
    await page.waitForFunction(() => document.querySelector('#audio-name').value === 'Hafenlied');
    await page.locator('#audio-clone').click();
    await page.waitForFunction(() => document.querySelectorAll('#audio-list article').length === 3);
    assert.equal(
      await page.locator('#audio-name').inputValue(),
      'Hafenlied – Kopie',
      'Confirmed copy must become the editor target',
    );
    assert.equal(await page.evaluate(() => document.activeElement.id), 'audio-name');
    assert(
      await page.locator('#audio-name').evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      }),
      'Confirmed copy name must be inside the visible viewport',
    );
    await native.capture(page, 'confirmed-copy', '#audio-name');
    const created = rows().filter((r) => !savedRows.some((old) => old.id === r.id));
    assert.equal(created.length, 1);
    const copyId = created[0].id,
      copyName = 'Hafenlied – Bootsfahrt',
      copyNotes = original.notes + '\r\nNur für die Bootsfahrt.';
    await page.locator('#audio-name').fill(copyName);
    await page.locator('#audio-vibes').fill('Hafen, Abend');
    await page.locator('#audio-genres').fill('Folk, Geige');
    await page.locator('#audio-notes').press('Control+End');
    await page.locator('#audio-notes').press('Enter');
    await page.keyboard.type('Nur für die Bootsfahrt.');
    await page.locator('#audio-editor button[type=submit]').click();
    await page.waitForFunction(
      (name) => document.querySelector('#audio-list').textContent.includes(name),
      copyName,
    );
    await native.capture(page, 'edited-copy', '#audio-editor');
    await native.close();
    await launch();
    await card(copyName)
      .getByRole('button', { name: 'Beschreibung bearbeiten', exact: true })
      .click();
    await page.waitForFunction(
      (name) => document.querySelector('#audio-name').value === name,
      copyName,
    );
    assert.equal(await page.locator('#audio-notes').inputValue(), copyNotes.replace(/\r/g, ''));
    await native.capture(page, 'fresh-copy', '#audio-editor');
    await play(copyName, copyId);
    await play('Hafenlied', original.id);
    await native.close();
    const after = rows(),
      copy = JSON.parse(after.find((r) => r.id === copyId).payload);
    assert.equal(after.length, 3);
    for (const row of savedRows)
      assert.deepEqual(
        after.find((r) => r.id === row.id),
        row,
      );
    assert.equal(copy.name, copyName);
    assert.deepEqual(copy.vibes, ['Hafen', 'Abend']);
    assert.deepEqual(copy.genres, ['Folk', 'Geige']);
    assert.equal(copy.notes, copyNotes);
    assert.deepEqual(copy.media, original.media);
    assert.equal(
      createHash('sha256')
        .update(await readFile(mediaFile))
        .digest('hex'),
      sha256,
    );
    await native.finish({
      complete: true,
      zoom,
      copyId,
      originalId: original.id,
      homonymId: homonym.id,
      originalRowsUnchanged: true,
      mediaHashUnchanged: true,
      copy,
      canonicalState: state(),
      nativeDecoding: true,
      hardwareAudibility: false,
    });
    console.log('COMPLETE exact audio copy, metadata, restart and explicit selections at ' + zoom);
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    db?.close();
    await native.dispose();
  }
}
