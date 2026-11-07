import {
  bounded,
  observeExit,
  pidAbsent,
  ownsProfile,
  stopOwnedChild,
  registerOwnedPid,
  stopRegisteredPid,
  startNativeBus,
  registerNativeEvidence,
  nativeRuntimeArtifacts,
} from './native-process.mjs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { rm, mkdtemp, mkdir, cp, readFile, writeFile, realpath } from 'node:fs/promises';
import { generateKeyPairSync, sign, randomUUID, createHash } from 'node:crypto';
import { currentProcessGroup } from './process-group.mjs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
const require = createRequire(import.meta.url),
  { _electron, chromium } = require('playwright-core');
const base = path.resolve(process.argv[2] ?? '.build/update-native-base');
const forced = process.argv.includes('--force'),
  activeWorkspace = process.argv.includes('--workspace') || forced,
  scenario = (activeWorkspace ? 'workspace' : 'start-screen') + (forced ? '-forced' : '');
const softwareGpu = process.argv.includes('--software-gpu');
const evidence = path.resolve(
  process.env.QA_EVIDENCE_DIR
    ? path.join(process.env.QA_EVIDENCE_DIR, 'result.json')
    : `.build/update-native-${scenario}-evidence.json`,
);
await mkdir(path.dirname(evidence), { recursive: true });
await rm(evidence, { force: true });
await registerNativeEvidence(evidence);
const { schema } = JSON.parse(
  await readFile(path.join(base, 'resources/app/build-info.json'), 'utf8'),
);
const fixtureBase = path.resolve('.build/native-update-fixtures');
await mkdir(fixtureBase, { recursive: true });
const temp = await mkdtemp(path.join(fixtureBase, 'run-')),
  root = path.join(temp, 'installation'),
  profile = path.join(temp, 'custom-profile');
let replacementOwner, originalChild, originalExit, completedEvidence, busSession;
let step = 'fixture setup';
const group = await currentProcessGroup(),
  launches = [],
  cleanup = [];
const runtimeFiles = ['electron', ...nativeRuntimeArtifacts.map((file) => 'resources/app/' + file)];
const runtimeHashes = async (directory) =>
  Object.fromEntries(
    await Promise.all(
      runtimeFiles.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(path.join(directory, file)))
          .digest('hex'),
      ]),
    ),
  );
const recordLaunch = async (pid, directory) => {
  const entry = {
    pid,
    directory,
    profile,
    cgroup: group,
    requestedZoom: 1,
    platform: { requested: 'default', desktopSession: process.env.XDG_SESSION_TYPE ?? null },
    artifacts: await runtimeHashes(directory),
  };
  assert.equal((await readFile('/proc/' + pid + '/cgroup', 'utf8')).trim().split('::')[1], group);
  launches.push(entry);
  return entry;
};
async function captureUpdate(page, entry, name) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const metrics = await cdp.send('Page.getLayoutMetrics');
    entry.viewport = metrics.cssVisualViewport;
    entry.zoom = metrics.cssVisualViewport.zoom ?? metrics.visualViewport.zoom;
    assert.equal(entry.zoom, 1, 'Actual packaged UI zoom');
  } finally {
    await cdp.detach();
  }
  const bytes = await page.screenshot(),
    png = require('pngjs').PNG.sync.read(bytes),
    colors = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 31) colors.add(png.data.readUInt32BE(i));
  assert(colors.size > 8, 'Packaged update capture is blank');
  const file = path.join(path.dirname(evidence), name + '.png');
  await writeFile(file, bytes);
  (entry.captures ??= []).push({
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: png.width,
    height: png.height,
  });
}
const { privateKey, publicKey } = generateKeyPairSync('ed25519'),
  publicPem = publicKey.export({ type: 'spki', format: 'pem' }),
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
await new Promise((r) => server.close(r));
await build({
  entryPoints: ['desktop/update-package.ts'],
  outfile: '.build/native-update-package.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
await build({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desktop/native-update-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { packUpdate, unpackUpdate } = require(path.resolve('.build/native-update-package.cjs')),
  { CampaignStore } = require(path.resolve('.build/desktop/native-update-store.cjs'));
async function version(v, debug = false) {
  const dir = path.join(temp, 'source-' + v);
  await cp(base, dir, { recursive: true });
  // CI has no physical GPU. Configure both test versions so the updater's
  // independently launched child uses the same explicit software WebGL backend.
  const switches = [
    ...(softwareGpu
      ? [
          ['use-gl', 'angle'],
          ['use-angle', 'swiftshader'],
          ['enable-unsafe-swiftshader', ''],
        ]
      : []),
    ...(debug ? [['remote-debugging-port', String(port)]] : []),
  ];
  const exitLog = path.join(temp, 'exit-' + v + '.json');
  const rendererLog = path.join(temp, 'renderer-' + v + '.json');
  const rendererBanner = `{
    const {app}=require('electron'), fs=require('node:fs'), errors=[];
    const record=error=>{errors.push(error);fs.writeFileSync(${JSON.stringify(rendererLog)},JSON.stringify(errors));};
    fs.writeFileSync(${JSON.stringify(rendererLog)},'[]');
    app.on('web-contents-created',(_,contents)=>{
      contents.on('console-message',details=>{if(details.level==='error' && /Uncaught/.test(details.message))record({kind:'renderer',message:details.message});});
      contents.on('preload-error',(_,file,error)=>record({kind:'preload',file,error:String(error)}));
      contents.on('render-process-gone',(_,details)=>{if(details.reason!=='clean-exit')record({kind:'renderer-exit',...details});});
    });
  }\n`;
  const banner =
    rendererBanner +
    `process.on('exit', code => require('node:fs').writeFileSync(${JSON.stringify(exitLog)}, JSON.stringify({pid:process.pid,code})));\n` +
    switches
      .map(
        ([name, value]) =>
          `require('electron').app.commandLine.appendSwitch(${JSON.stringify(name)}, ${JSON.stringify(value)});`,
      )
      .join('\n');
  await build({
    entryPoints: ['desktop/main.ts'],
    outfile: path.join(dir, 'resources/app/main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron', 'better-sqlite3'],
    define: { __APP_VERSION__: JSON.stringify(v) },
    banner: { js: banner },
  });
  await writeFile(path.join(dir, 'resources/app/update-public-key.pem'), publicPem);
  await writeFile(
    path.join(dir, 'resources/app/build-info.json'),
    JSON.stringify({
      applicationVersion: v,
      commit,
      product: 'saltmarcher-workbench',
      dataLine: 'CampaignWorkbench',
      schema,
    }),
  );
  const archive = path.join(temp, `SaltMarcher-${v}-linux-x64.zip`),
    hashes = await packUpdate(dir, archive, v, commit);
  const manifest = {
    format: 1,
    product: 'saltmarcher-workbench',
    dataLine: 'CampaignWorkbench',
    version: v,
    commit,
    platform: 'linux-x64',
    archive: path.basename(archive),
    ...hashes,
    schema,
  };
  const signed = Buffer.from(JSON.stringify(manifest)),
    signature = sign(null, signed, privateKey);
  return { dir, archive, manifest, signed, signature };
}
let app,
  browser,
  childPid,
  gpuRenderer = null;
const errors = [];
try {
  step = 'build signed test packages';
  const old = await version('90.0.0'),
    next = await version('90.0.1', true);
  const extracted = await unpackUpdate(old.archive, path.join(temp, 'unpacked'), old.manifest);
  await writeFile(path.join(extracted, 'saltmarcher-update.json'), old.signed);
  await writeFile(path.join(extracted, 'saltmarcher-update.json.sig'), old.signature);
  // Seed a genuine database plus opaque local files and media before bootstrap.
  await mkdir(profile);
  let store = new CampaignStore(path.join(profile, 'workbench.sqlite'), '90.0.0');
  const campaign = store.create('Update-Abend'),
    other = store.create('Inaktive Kampagne');
  const workspace = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: workspace.token,
      campaignId: campaign.id,
      action,
    });
  const groupId = store.executeProgress(
    command({
      kind: 'group-create',
      title: 'Hafenwache',
      encounterId: null,
      expectedEncounterRevision: null,
    }),
  ).groupId;
  const draft = {
    writeId: randomUUID(),
    groupId,
    revision: 1,
    title: '',
    notes: 'Unfertige Notiz\r\nbleibt vollständig',
    locationId: null,
    actors: [],
  };
  store.keepGroupDraft(workspace.token, draft, null);
  const scene = store.executeLive(
    command({
      kind: 'initialize',
      expectedRosterRevision: store.live(workspace.token).rosterRevision,
    }),
  ).scene;
  const liveBefore = store.live(workspace.token);
  store.close();
  await mkdir(path.join(profile, 'audio'));
  await writeFile(path.join(profile, 'audio/retained.ogg'), 'unchanged media');
  await writeFile(path.join(profile, 'unfinished-notes.txt'), 'Unfertiger Entwurf – unverändert');
  const busDirectory = path.join(temp, 'session-bus');
  await mkdir(busDirectory, { recursive: true });
  busSession = await startNativeBus(busDirectory);
  const env = {
    ...process.env,
    DBUS_SESSION_BUS_ADDRESS: busSession.address,
    XDG_DATA_HOME: path.join(temp, 'desktop-data'),
  };
  execFileSync(path.join(extracted, 'Installieren.sh'), [root, profile], { env, timeout: 120000 });
  const oldDir = await realpath(path.join(root, 'current'));
  step = 'launch installed original package';
  app = await _electron.launch({
    executablePath: path.join(oldDir, 'electron'),
    args: ['--data-dir', profile],
    env,
    timeout: 45000,
  });
  originalChild = app.process();
  originalExit = observeExit(originalChild);
  const firstLaunch = await recordLaunch(originalChild.pid, oldDir);
  assert(await ownsProfile(originalChild, profile));
  const page = await app.firstWindow();
  const watch = (p) => p.on('pageerror', (e) => errors.push(e.stack ?? e.message));
  app.on('window', watch);
  for (const window of app.windows()) watch(window);
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  if (activeWorkspace) {
    await page
      .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
      .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    await page.waitForFunction(
      () => document.querySelector('#campaign-map')?.dataset.terrainReady === 'ready',
      null,
      { timeout: 60000 },
    );
    gpuRenderer = await page.evaluate(() => {
      const gl = document.querySelector('#atlas-terrain-spatial canvas').getContext('webgl2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    });
    if (softwareGpu) assert.match(gpuRenderer, /SwiftShader/i);
  }
  async function openUpdates(page) {
    const trigger = (await page
      .locator('body')
      .evaluate((b) => b.classList.contains('atlas-workspace')))
      ? '#atlas-navigation'
      : '#application-trigger';
    await page.locator(trigger).click();
    await page.locator('#application-settings').click();
    await page.locator('#settings-updates').click();
    assert.equal(
      await page.locator('#preset-manager').evaluate((d) => d.open),
      false,
      'Settings must close before updates can leave the workspace',
    );
    return trigger;
  }
  await app.evaluate(
    async (_, { archive, signed, signature, manifest }) => {
      const fs = process.getBuiltinModule('node:fs'),
        stream = process.getBuiltinModule('node:stream');
      globalThis.fetch = async (url) => {
        if (String(url).includes('/releases?'))
          return new Response(
            JSON.stringify([
              {
                draft: false,
                prerelease: false,
                tag_name: 'v' + manifest.version,
                body: 'Native Testversion',
                assets: [
                  { name: 'saltmarcher-update.json' },
                  { name: 'saltmarcher-update.json.sig' },
                  { name: manifest.archive },
                ],
              },
            ]),
          );
        if (String(url).endsWith('.json.sig'))
          return new Response(Buffer.from(signature, 'base64'));
        if (String(url).endsWith('.json')) return new Response(Buffer.from(signed, 'base64'));
        if (String(url).endsWith('.zip'))
          return new Response(stream.Readable.toWeb(fs.createReadStream(archive)));
        throw new Error('Unexpected URL ' + url);
      };
    },
    {
      archive: next.archive,
      signed: next.signed.toString('base64'),
      signature: next.signature.toString('base64'),
      manifest: next.manifest,
    },
  );
  step = 'download and confirm update';
  const menuTrigger = await openUpdates(page);
  await page.locator('#updates-close').click();
  assert.equal(await page.locator(menuTrigger).evaluate((b) => document.activeElement === b), true);
  await openUpdates(page);
  await page.locator('#updates-check').click();
  await page.locator('#updates-download').waitFor({ state: 'visible' });
  assert.equal(await realpath(path.join(root, 'current')), oldDir);
  await page.locator('#updates-download').click();
  await page.locator('#updates-install').waitFor({ state: 'visible', timeout: 120000 });
  await captureUpdate(page, firstLaunch, 'ready');
  assert.equal(
    await page.locator('#updates-version').textContent(),
    'Installiert: 90.0.0 · Verfügbar: 90.0.1',
  );
  // A real workspace owns the close guard. Force scenarios open that prepared
  // workspace so this test editor can actually block the first restart.
  if (forced) await page.locator('#preset-manager').evaluate((d) => d.show());
  const immediateFeedback = await page.evaluate(() => {
    document.querySelector('#updates-install').click();
    return {
      message: document.querySelector('#updates-message').textContent,
      progressVisible: !document.querySelector('#updates-progress').hidden,
      indeterminate: !document.querySelector('#updates-progress').hasAttribute('value'),
      disabled: document.querySelector('#updates-install').disabled,
    };
  });
  assert.match(immediateFeedback.message, /Neustart wird vorbereitet/);
  assert(
    immediateFeedback.progressVisible &&
      immediateFeedback.indeterminate &&
      immediateFeedback.disabled,
  );
  if (forced) {
    await page.locator('#updates-force').waitFor({ state: 'visible' });
    assert.match(
      await page.locator('#updates-message').textContent(),
      /Installation nicht gestartet/,
    );
    await page.locator('#updates-force').click();
    assert.equal(
      await page.locator('#updates-force-back').evaluate((b) => document.activeElement === b),
      true,
    );
    await captureUpdate(page, firstLaunch, 'confirmation');
    await page.locator('#updates-force-back').click();
    assert.equal(await realpath(path.join(root, 'current')), oldDir);
    await page.locator('#updates-force').click();
    await page.locator('#updates-force-confirm').click({ noWaitAfter: true });
  }
  for (let n = 0; n < 600; n++) {
    const journal = await readFile(path.join(root, '.update-journal.json'), 'utf8').then(
      JSON.parse,
      () => null,
    );
    if (journal?.childPid) childPid = journal.childPid;
    if (journal?.phase === 'rolled-back') throw new Error('Update rolled back: ' + journal.error);
    if (journal?.phase === 'committed') break;
    await new Promise((r) => setTimeout(r, 200));
    if (n === 599) throw new Error('Update did not commit. ' + JSON.stringify(journal));
  }
  step = 'observe replacement and validate preserved data';
  replacementOwner = await registerOwnedPid(childPid, profile);
  const replacementDirectory = await realpath(path.join(root, 'current'));
  const replacementLaunch = await recordLaunch(childPid, replacementDirectory);
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
  const restarted = browser
    .contexts()[0]
    .pages()
    .find((p) => p.url().startsWith('campaign://app/'));
  assert(restarted);
  for (const context of browser.contexts()) {
    const watch = (page) =>
      page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    context.on('page', watch);
    for (const page of context.pages()) watch(page);
  }
  await restarted.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await openUpdates(restarted);
  await restarted.waitForFunction(() =>
    document.querySelector('#updates-version').textContent.includes('90.0.1'),
  );
  assert.equal(await readFile(path.join(profile, 'audio/retained.ogg'), 'utf8'), 'unchanged media');
  assert.equal(
    await readFile(path.join(profile, 'unfinished-notes.txt'), 'utf8'),
    'Unfertiger Entwurf – unverändert',
  );
  await captureUpdate(restarted, replacementLaunch, 'restarted');
  assert.deepEqual(
    await runtimeHashes(replacementDirectory),
    replacementLaunch.artifacts,
    'Replacement runtime changed',
  );
  step = 'normal close and SQLite assertions';
  // Close through the normal UI guard, not a force kill, then inspect SQLite.
  await restarted.evaluate(() => {
    document.querySelector('#updates-close').click();
    window.campaign.closeReady();
  });
  await pidAbsent(childPid, 10000);
  const replacementExit = JSON.parse(await readFile(path.join(temp, 'exit-90.0.1.json'), 'utf8'));
  assert.deepEqual(replacementExit, { pid: childPid, code: 0 });
  const firstExit = await bounded(originalExit, 10000, 'Original updater process did not exit');
  assert.deepEqual(firstExit, { code: 0, signal: null });
  await pidAbsent(originalChild.pid);
  firstLaunch.exit = firstExit;
  firstLaunch.pidAbsent = true;
  replacementLaunch.exit = { code: replacementExit.code, signal: null };
  replacementLaunch.pidAbsent = true;
  store = new CampaignStore(path.join(profile, 'workbench.sqlite'), '90.0.1');
  try {
    assert.deepEqual(
      store
        .list()
        .campaigns.map((c) => c.id)
        .sort(),
      [campaign.id, other.id].sort(),
    );
    const reopened = store.activate(campaign.id);
    assert.deepEqual(store.groupDraft(reopened.token, groupId), draft);
    assert.deepEqual(store.live(reopened.token), liveBefore);
    assert(scene.id);
  } finally {
    store.close();
  }
  const journal = JSON.parse(await readFile(path.join(root, '.update-journal.json'), 'utf8'));
  assert.equal(journal.phase, 'committed');
  assert.equal(
    await readFile(path.join(journal.backup, 'audio/retained.ogg'), 'utf8'),
    'unchanged media',
  );
  for (const version of ['90.0.0', '90.0.1']) {
    const observed = JSON.parse(
      await readFile(path.join(temp, 'renderer-' + version + '.json'), 'utf8'),
    );
    assert.deepEqual(observed, [], 'Renderer observations ' + version);
  }
  assert.deepEqual(errors, []);
  completedEvidence = JSON.stringify(
    {
      passed: true,
      source: commit,
      dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      step: 'all scenario assertions complete',
      launches,
      cleanup,
      packages: { original: old.manifest, replacement: next.manifest },
      processes: { original: firstExit, replacement: replacementExit, pidsAbsent: true },
      adapter: 'packaged-update with application-owned replacement and exit observer',
      from: '90.0.0',
      to: '90.0.1',
      profile,
      root,
      bootstrap: true,
      manualDownload: true,
      manualInstall: true,
      settingsNavigation: true,
      activeWorkspace,
      softwareGpu,
      gpuRenderer,
      forcedWithConfirmation: forced,
      immediateFeedback,
      normalRestart: true,
      customProfile: true,
      mediaAndCampaignsPreserved: true,
      unfinishedDraftAndLiveStatePreserved: true,
      backup: journal.backup,
    },
    null,
    2,
  );
} catch (error) {
  await rm(evidence, { force: true });
  await writeFile(
    evidence.replace('.json', '-failure.json'),
    JSON.stringify({ step, error: error.stack, profile, launches, cleanup, errors }, null, 2),
  );
  throw error;
} finally {
  const failures = [];
  await browser?.close().catch(() => {});
  try {
    if (originalChild)
      cleanup.push({
        kind: 'original',
        ...(await stopOwnedChild(originalChild, {
          owns: () => ownsProfile(originalChild, profile),
        })),
      });
  } catch (error) {
    failures.push(error);
  }
  try {
    if (childPid && !replacementOwner) {
      try {
        replacementOwner = await registerOwnedPid(childPid, profile);
      } catch {
        await pidAbsent(childPid);
      }
    }
    cleanup.push({ kind: 'replacement', ...(await stopRegisteredPid(replacementOwner)) });
  } catch (error) {
    failures.push(error);
  }
  try {
    if (busSession) {
      const unexpected = busSession.child.exitCode !== null || busSession.child.signalCode !== null;
      cleanup.push({ kind: 'bus', unexpected, ...(await stopOwnedChild(busSession.child)) });
      if (unexpected)
        failures.push(Error('Native bus proxy exited during packaged update workflow'));
    }
  } catch (error) {
    failures.push(error);
  }
  if (failures.length) {
    await rm(evidence, { force: true });
    await writeFile(
      evidence.replace('.json', '-cleanup-failure.json'),
      JSON.stringify({ profile, errors: failures.map((error) => error.stack) }, null, 2),
    );
    throw new AggregateError(failures, 'Packaged native cleanup incomplete');
  }
}

const completed = JSON.parse(completedEvidence);
completed.cleanup = cleanup;
assert(
  !cleanup.some((item) => item.forced),
  'Emergency cleanup prevents packaged update qualification',
);
await writeFile(evidence, JSON.stringify(completed, null, 2));
console.log('Native packaged update passed: ' + evidence);
