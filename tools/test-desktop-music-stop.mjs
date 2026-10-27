import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/music-stop-evidence');
await runNativeProbe(
  { root: source, output, name: 'gm-music-stop', resultName: 'music-' + phase + '.json' },
  async (native) => {
    const require = createRequire(source + '/package.json');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/music-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/music-native-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('Eine Szene in Ruhe wechseln'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    await mkdir(profile + '/audio', { recursive: true });
    const assets = [];
    for (const [name, kind, hz] of [
      ['Bühne', 'song', 220],
      ['Regen', 'ambience', 330],
      ['Wind', 'ambience', 80],
    ]) {
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
        bytes.writeInt16LE(Math.round(64 * Math.sin((2 * Math.PI * hz * i) / 8000)), 44 + i * 2);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      await writeFile(profile + '/audio/' + sha256 + '.wav', bytes);
      let asset = store.ingestAudio(w.token, {
        sha256,
        extension: '.wav',
        bytes: bytes.length,
        mime: 'audio/wav',
        originalName: name + '.wav',
      });
      asset = { ...asset, kind, notes: '  Eigene Probe\r\n' };
      store.executeMusic(command({ kind: 'asset', asset, expectedRevision: asset.revision }));
      assets.push(store.audioAsset(asset.id));
    }
    const people = ['Iri', 'Dorn'].map(
        (name) =>
          store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
      ),
      definition = store.executeItemShop(
        command({
          kind: 'definition',
          expectedRevision: null,
          definition: {
            id: randomUUID(),
            revision: 0,
            name: 'Seil',
            category: 'equipment',
            magic: false,
            rarity: '',
            attunement: 'no',
            unitCopper: '100',
            weightText: '',
            properties: [],
            description: '',
            source: { kind: 'authored', label: 'Eigene Vorlage', license: null, url: null },
            trashed: false,
          },
        }),
      ).definition;
    store.executeProgress(
      command({
        kind: 'manual-item',
        characterId: people[0].id,
        expectedMembershipRevision: people[0].membershipRevision,
        origin: 'manual',
        item: {
          name: 'Seil',
          category: 'equipment',
          quantity: 2,
          valueGold: '1',
          reference: {
            kind: 'authored',
            definitionId: definition.id,
            revision: definition.revision,
          },
        },
        note: '  Originalbeleg\r\n',
      }),
    );
    store.executeItemShop(
      command({
        kind: 'definition',
        expectedRevision: definition.revision,
        definition: { ...definition, unitCopper: '300' },
      }),
    );
    const originalLedger = store.db.prepare('SELECT * FROM character_ledger ORDER BY id').all();
    const state = store.music(w.token).state;
    store.executeMusic(
      command({
        kind: 'settings',
        expectedRevision: state.revision,
        autoplay: false,
        autoAmbience: false,
        volume: 0.7,
        ambienceVolume: 0.3,
        fadeSeconds: 0,
        loop: 'track',
      }),
    );
    store.close();
    const [song, rain, wind] = assets;
    let app;
    const errors = native.errors,
      launches = native.launches,
      results = {};
    async function launch() {
      const page = await native.launch();
      app = native.app;
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
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
      await page.waitForFunction(
        () => document.querySelectorAll('#audio-list article').length === 3,
      );
      return page;
    }
    async function close() {
      await native.close();
      app = null;
    }
    const sounding = () =>
      Array.from(document.querySelectorAll('audio'))
        .filter((a) => !a.paused && a.readyState >= 2)
        .map((a) => ({
          slot: a.dataset.musicSlot,
          ambience: a.dataset.ambienceId,
          seconds: a.currentTime,
          volume: a.volume,
          duration: a.duration,
        }));
    async function add(page, name) {
      await page
        .locator('#audio-list article')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
        .getByRole('button', { name: 'Sound hinzufügen', exact: true })
        .click();
    }
    async function stop(page) {
      await page.locator('#music-mini [data-music-transport=stop]').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#music-now').textContent.includes('Gestoppt') &&
          Array.from(document.querySelectorAll('audio')).every((a) => a.paused),
      );
    }
    {
      let page = await launch();
      await page
        .locator('#audio-list article')
        .filter({ has: page.getByRole('heading', { name: 'Bühne', exact: true }) })
        .getByRole('button', { name: 'Abspielen', exact: true })
        .click();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('audio[data-music-slot]')).some(
          (a) => !a.paused && a.currentTime > 0.1,
        ),
      );
      results.initialSongDuration = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('audio[data-music-slot]')).find((a) => !a.paused)
            .duration,
      );
      results.seekDisabled = await page.locator('#music-seek').isDisabled();
      if (!before) {
        assert.equal(results.initialSongDuration, 60);
        assert.equal(results.seekDisabled, false);
        await page.locator('#music-seek').focus();
        await page.locator('#music-seek').press('Home');
        for (let i = 0; i < 20; i++) await page.locator('#music-seek').press('ArrowRight');
        await page.waitForFunction(() =>
          Array.from(document.querySelectorAll('audio[data-music-slot]')).some(
            (a) => !a.paused && a.currentTime >= 1.9 && a.currentTime < 5,
          ),
        );
        results.nativeSeekUsable = true;
      }
      await add(page, 'Wind');
      await page.waitForFunction(
        (id) =>
          Array.from(document.querySelectorAll('audio[data-ambience-id]')).some(
            (a) => a.dataset.ambienceId === id && !a.paused && a.currentTime > 0.1,
          ),
        wind.id,
      );
      results.initialMusicAndWindDecoded = true;
      await stop(page);
      results.stopSilencesAll = true;
      await add(page, 'Regen');
      if (!before)
        await page.waitForFunction(
          (id) =>
            Array.from(document.querySelectorAll('audio[data-ambience-id]')).some(
              (a) => a.dataset.ambienceId === id && !a.paused && a.currentTime > 0.1,
            ),
          rain.id,
        );
      else await page.waitForTimeout(300);
      results.afterExplicitRain = await page.evaluate(sounding);
      await page.locator('#music-now').scrollIntoViewIfNeeded();
      await native.capture(page, 'music-' + phase + '.png');
      if (!before) {
        assert.equal(results.afterExplicitRain.length, 1);
        assert.equal(results.afterExplicitRain[0].ambience, rain.id);
        assert(Math.abs(results.afterExplicitRain[0].volume - 0.3) < 0.00001);
        await page.waitForTimeout(5200);
        const refreshed = await page.evaluate(sounding);
        assert.equal(refreshed.length, 1);
        assert.equal(refreshed[0].ambience, rain.id);
        results.afterRefresh = refreshed;
        results.onlyRainSurvivesRefresh = true;
        results.range = await app.evaluate(async ({ net }, id) => {
          const response = await net.fetch('campaign://app/audio/' + id, {
            headers: { Range: 'bytes=0-43' },
          });
          return {
            status: response.status,
            headers: Object.fromEntries(response.headers),
            bytes: (await response.arrayBuffer()).byteLength,
          };
        }, rain.id);
        assert.equal(results.range.status, 206);
        assert.equal(results.range.bytes, 44);
        assert.equal(results.range.headers['content-range'], 'bytes 0-43/' + rain.media.bytes);
        assert.equal(results.afterExplicitRain[0].duration, 60);
        results.sampleRms = await page.evaluate(async (id) => {
          const audio = Array.from(document.querySelectorAll('audio')).find(
              (a) => a.dataset.ambienceId === id && !a.paused,
            ),
            context = new AudioContext(),
            capture = audio.captureStream(),
            source = context.createMediaStreamSource(capture),
            analyser = context.createAnalyser(),
            silent = context.createGain();
          silent.gain.value = 0;
          source.connect(analyser);
          analyser.connect(silent);
          silent.connect(context.destination);
          await context.resume();
          await new Promise((r) => setTimeout(r, 150));
          const samples = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length);
          source.disconnect();
          await context.close();
          capture.getTracks().forEach((t) => t.stop());
          return rms;
        }, rain.id);
        assert(results.sampleRms > 0.000001);
        await page.locator('#live-tab').click();
        assert((await page.locator('#music-mini-title').innerText()).includes('1 Sound aktiv'));
        const liveSounds = await page.evaluate(sounding);
        assert.equal(liveSounds.length, 1);
        assert.equal(liveSounds[0].ambience, rain.id);
        results.playingLayerVisibleWhileLeading = true;
        await stop(page);
        await page.locator('#music-tab').click();
      }
      await close();
      const fresh = new CampaignStore(file);
      try {
        for (const asset of assets) {
          const current = fresh.audioAsset(asset.id);
          assert.deepEqual(current, asset);
          assert.equal(
            createHash('sha256')
              .update(await readFile(fresh.audioFile(asset.id)))
              .digest('hex'),
            asset.media.sha256,
          );
        }
        results.mediaAndDescriptionsUnchanged = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        assert.deepEqual(await page.evaluate(sounding), []);
        await add(page, 'Regen');
        await page.waitForFunction(
          (id) =>
            Array.from(document.querySelectorAll('audio[data-ambience-id]')).some(
              (a) => a.dataset.ambienceId === id && !a.paused && a.currentTime > 0.1,
            ),
          rain.id,
        );
        const sounds = await page.evaluate(sounding);
        assert.equal(sounds.length, 1);
        assert.equal(sounds[0].ambience, rain.id);
        await stop(page);
        await page.locator('#live-tab').click();
        await page.waitForFunction(() =>
          document.querySelector('#loot-balance-list').textContent.includes('Iri: 6,00 GM'),
        );
        await page.locator('#loot-balance summary').click();
        results.nativeLootBalance = await page.locator('#loot-balance-list').innerText();
        await page.locator('#loot-balance').scrollIntoViewIfNeeded();
        await native.capture(page, 'loot-balance.png');
        await close();
        results.freshStopAndExplicitSingleLayer = true;
        const ledgerCheck = new CampaignStore(file);
        try {
          assert.deepEqual(
            ledgerCheck.db.prepare('SELECT * FROM character_ledger ORDER BY id').all(),
            originalLedger,
          );
          results.lootLedgerUnchanged = true;
        } finally {
          ledgerCheck.close();
        }
      }
      assert.equal(
        results.afterExplicitRain.length,
        1,
        'Explicit rain after Stop must play one sound',
      );
      assert.equal(results.afterExplicitRain[0].ambience, rain.id);
      return { results, normalClose: true };
    }
  },
);
