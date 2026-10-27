import {
  stopOwnedChild,
  ownsProfile,
  observeExit,
  pidAbsent,
  registerNativeEvidence,
  nativeRuntimeArtifacts as artifacts,
  bounded,
} from './native-process.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { execFileSync } from 'node:child_process';
// Real filesystem watch + Electron cycle in copied sources and an isolated profile.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { startDevelopment } from './dev-desktop.mjs';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { chromium } = require('playwright-core');
const output = process.env.QA_EVIDENCE_DIR || path.join(root, '.build/development-evidence');
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
await registerNativeEvidence(path.join(output, 'result.json'));
const fixture = await mkdtemp(path.join(root, '.build/development-fixture-'));
for (const name of ['src', 'desktop', 'tools', 'resources', 'package.json', 'package-lock.json'])
  await cp(path.join(root, name), path.join(fixture, name), { recursive: true });
await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
const profile = await mkdtemp(path.join(output, 'profile-'));
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: path.join(output, 'fixture-store.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(path.join(output, 'fixture-store.cjs'));
const store = new CampaignStore(path.join(profile, 'workbench.sqlite')),
  campaign = store.create('Development draft'),
  workspace = store.activate(campaign.id),
  npcId = randomUUID();
store.executeNpc({
  commandId: randomUUID(),
  campaignId: campaign.id,
  token: workspace.token,
  expectedNoteRevision: null,
  expectedRecordRevision: 0,
  expectedActorRevision: null,
  expectedPositionRevision: null,
  npc: {
    id: npcId,
    name: 'Development NPC',
    creatureId: null,
    readAloud: '',
    gmNotes: 'Original',
    record: {
      id: npcId,
      revision: 0,
      factionId: null,
      modifier: 0,
      lifecycle: 'active',
      appearance: '',
      behavior: '',
      history: '',
    },
    locationId: null,
    health: null,
  },
});
store.tutorial('skipped');
store.close();
const events = [],
  logs = [],
  apps = [],
  rendererErrors = [];
let session, page;
const group = await currentProcessGroup();
const report = {
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  fixture,
  profile,
  events,
  launches: [],
  checks: [],
  passed: false,
  step: 'initial build',
};
const watched = new WeakSet();
const watchWindow = (window) => {
  if (watched.has(window)) return;
  watched.add(window);
  window.on('pageerror', (error) => rendererErrors.push(error.stack ?? error.message));
};
const watchBrowser = (browser) => {
  for (const context of browser.contexts()) {
    context.on('page', watchWindow);
    for (const window of context.pages()) watchWindow(window);
  }
  return browser;
};
const waitEvent = async (kind, after = events.length) => {
  report.step = 'wait for ' + kind;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const event = events.slice(after).find((e) => e.kind === kind);
    if (event) {
      if (kind === 'restart') await currentPage();
      if (kind === 'styles') {
        event.artifacts = Object.fromEntries(
          await Promise.all(
            artifacts.map(async (file) => [file, await digest(path.join(session.runtime, file))]),
          ),
        );
      }
      return event;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error('Missing development event ' + kind + ': ' + JSON.stringify(events.slice(after)));
};
const edit = async (file, transform) => {
  const target = path.join(fixture, file);
  await writeFile(target, transform(await readFile(target, 'utf8')));
};
const digest = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
async function currentPage() {
  const browser = await apps.at(-1).browser;
  const context = browser.contexts()[0];
  const p = context.pages()[0] || (await context.waitForEvent('page'));
  const watch = (window) => {
    if (watched.has(window)) return;
    watched.add(window);
    window.on('pageerror', (error) => rendererErrors.push(error.stack));
  };
  context.on('page', watch);
  for (const window of context.pages()) watch(window);
  await p.waitForURL('campaign://app/index.html');
  await p.waitForLoadState('domcontentloaded');
  await p.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const entry = apps.at(-1).evidence;
  const cdp = await context.newCDPSession(p);
  try {
    const metrics = await cdp.send('Page.getLayoutMetrics');
    entry.viewport = metrics.cssVisualViewport;
    entry.zoom = metrics.cssVisualViewport.zoom ?? metrics.visualViewport.zoom;
    assert.equal(entry.zoom, 1, 'Actual development UI zoom');
  } finally {
    await cdp.detach();
  }

  const bytes = await p.screenshot();
  const png = require('pngjs').PNG.sync.read(bytes),
    colors = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 31) colors.add(png.data.readUInt32BE(i));
  assert(colors.size > 8, 'Development capture is blank');
  entry.capture = 'generation-' + entry.generation + '.png';
  entry.captureSha256 = createHash('sha256').update(bytes).digest('hex');
  entry.captureSize = { width: png.width, height: png.height };
  entry.capturedAt = new Date().toISOString();
  await writeFile(path.join(output, entry.capture), bytes);
  return p;
}
try {
  session = await startDevelopment({
    root: fixture,
    dataDir: profile,
    onEvent: (e) => {
      events.push(e);
      console.log(JSON.stringify(e));
    },
    log: (line) => logs.push(line),
    launch: async ({ executable, args, env }) => {
      // Playwright's Electron launcher discards stdin. Spawn exactly the dev
      // child ourselves and attach a probe-only loopback debugger to its renderer.
      const runtime = path.dirname(args[0]);
      const hashes = Object.fromEntries(
        await Promise.all(
          artifacts.map(async (file) => [file, await digest(path.join(runtime, file))]),
        ),
      );
      const child = spawn(executable, ['--remote-debugging-port=0', ...args], {
        env,
        cwd: fixture,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const browser = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Probe debugger did not start')), 30000);
        let buffer = '';
        const receive = (chunk) => {
          buffer += chunk.toString();
          const found = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
          if (!found) return;
          clearTimeout(timeout);
          child.stderr.off('data', receive);
          chromium
            .connectOverCDP(found[1])
            .then((browser) => resolve(watchBrowser(browser)), reject);
        };
        child.stderr.on('data', receive);
      });
      browser.catch(() => {});
      const entry = {
        generation: apps.length + 1,
        pid: child.pid,
        profile,
        runtime,
        artifacts: hashes,
        cgroup: group,
        requestedZoom: 1,
        platform: { requested: 'default', desktopSession: process.env.XDG_SESSION_TYPE ?? null },
      };
      assert.equal(
        (await readFile('/proc/' + child.pid + '/cgroup', 'utf8')).trim().split('::')[1],
        group,
      );
      assert(await ownsProfile(child, profile));
      const ended = observeExit(child).then(async (exit) => {
        entry.exit = exit;
        await pidAbsent(child.pid);
        entry.pidAbsent = true;
      });
      apps.push({ child, browser, evidence: entry, ended });
      report.launches.push(entry);
      return child;
    },
  });
  page = await currentPage();
  async function openDraft() {
    await page
      .locator(`.campaign-card[data-campaign-id="${campaign.id}"]`)
      .getByRole('button', { name: /Öffnen|Fortsetzen/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    await page.waitForFunction(() =>
      ['groups-tab', 'atlas-navigation', 'workspace-nav-summary'].some((id) =>
        document.getElementById(id)?.checkVisibility(),
      ),
    );
    if (
      !(await page.locator('#groups-tab').isVisible()) &&
      (await page.locator('#atlas-navigation').isVisible())
    )
      await page.locator('#atlas-navigation').click();
    if (
      !(await page.locator('#groups-tab').isVisible()) &&
      (await page.locator('#workspace-nav-summary').isVisible())
    )
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#groups-tab').click();
    await page
      .locator('#npc-list')
      .getByRole('button', { name: /^Development NPC ·/ })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('#npc-name').value === 'Development NPC' ||
        document.querySelector('#npc-gmNotes').value === 'Development focus draft',
    );
  }
  await openDraft();
  await page.locator('#npc-name').fill('');
  const pid = session.pid;
  // An actual application control proves CSS refresh preserves focus and unsaved text.
  const input = page.locator('#npc-gmNotes');
  await input.fill('Development focus draft');
  await input.focus();
  const inputId = await input.evaluate((node) => {
    node.dataset.developmentFocus = 'true';
    return node.id;
  });
  let mark = events.length;
  await edit('src/app/shared/base.css', (s) => s + '\nbody { --development-probe: first; }\n');
  await waitEvent('styles', mark);
  assert.equal(session.pid, pid);
  assert.equal(await input.inputValue(), 'Development focus draft');
  assert.equal(await input.evaluate((node) => node === document.activeElement), true);
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--development-probe').trim(),
    ),
    'first',
  );
  mark = events.length;
  await edit('src/app/shared/base.css', (s) =>
    s.replace('body { --development-probe: first; }', ''),
  );
  await waitEvent('styles', mark);
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--development-probe').trim(),
    ),
    '',
  );
  report.checks.push({ name: 'CSS addition/removal, focus and raw value preserved', inputId, pid });
  const renderer = 'src/app/workspace/renderer.ts',
    original = await readFile(path.join(fixture, renderer), 'utf8');
  const before = await digest(path.join(session.runtime, 'ui/renderer.js'));
  mark = events.length;
  await writeFile(path.join(fixture, renderer), original + '\nconst = invalid syntax;\n');
  await waitEvent('error', mark);
  assert.equal(session.pid, pid);
  assert.equal(await digest(path.join(session.runtime, 'ui/renderer.js')), before);
  assert.equal(await input.inputValue(), 'Development focus draft');
  mark = events.length;
  await writeFile(
    path.join(fixture, renderer),
    original + '\ndocument.documentElement.dataset.developmentGeneration="fixed";\n',
  );
  await waitEvent('restart', mark);
  page = await currentPage();
  assert.notEqual(session.pid, pid);
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.developmentGeneration),
    'fixed',
  );
  await openDraft();
  assert.equal(await page.locator('#npc-name').inputValue(), '');
  assert.equal(await page.locator('#npc-gmNotes').inputValue(), 'Development focus draft');
  report.checks.push({
    name: 'Syntax failure retained live generation; correction restarted through normal close and restored an invalid NPC draft',
  });
  mark = events.length;
  await edit('src/app/workspace/index.html', (s) =>
    s.replace('<body', '<body data-development-markup="updated"'),
  );
  await waitEvent('restart', mark);
  page = await currentPage();
  assert.equal(await page.locator('body').getAttribute('data-development-markup'), 'updated');
  report.checks.push({ name: 'Desktop document build consumed changed markup' });
  // Dependency graph tracks additions, deletion errors and creation after failed resolution.
  mark = events.length;
  await edit(
    renderer,
    (s) =>
      s +
      '\nimport { developmentValue } from "./development-probe"; document.documentElement.dataset.developmentImport=developmentValue;\n',
  );
  await waitEvent('error', mark);
  mark = events.length;
  await writeFile(
    path.join(fixture, 'src/app/workspace/development-probe.ts'),
    'export const developmentValue="new import";\n',
  );
  await waitEvent('restart', mark);
  page = await currentPage();
  assert.equal(await page.locator('html').getAttribute('data-development-import'), 'new import');
  mark = events.length;
  await rm(path.join(fixture, 'src/app/workspace/development-probe.ts'));
  await waitEvent('error', mark);
  mark = events.length;
  await writeFile(
    path.join(fixture, 'src/app/workspace/development-probe.ts'),
    'export const developmentValue="restored import";\n',
  );
  await waitEvent('restart', mark);
  page = await currentPage();
  assert.equal(
    await page.locator('html').getAttribute('data-development-import'),
    'restored import',
  );
  report.checks.push({ name: 'Missing/new/deleted/restored dependency recovers' });
  mark = events.length;
  await edit(
    'desktop/preload.ts',
    (s) => s + '\ncontextBridge.exposeInMainWorld("developmentProbe", "preload refreshed");\n',
  );
  await waitEvent('restart', mark);
  page = await currentPage();
  assert.equal(await page.evaluate(() => window.developmentProbe), 'preload refreshed');
  report.checks.push({ name: 'Preload change restarted and executed' });
  mark = events.length;
  await edit(
    'desktop/store-worker.ts',
    (s) => s + '\nconsole.log("DEVELOPMENT_WORKER_REFRESHED");\n',
  );
  await waitEvent('restart', mark);
  assert(logs.some((line) => line.includes('DEVELOPMENT_WORKER_REFRESHED')));
  report.checks.push({ name: 'Store worker change restarted and executed' });
  // Node's actual exception stack must resolve to its original TypeScript file.
  mark = events.length;
  await edit(
    'desktop/main.ts',
    (s) => s + '\nconsole.log(new Error("DEVELOPMENT_MAP_PROBE").stack);\n',
  );
  await waitEvent('restart', mark);
  assert(logs.some((line) => line.includes('/desktop/main.ts:')));
  const source = await readFile(path.join(session.runtime, 'ui/renderer.js'), 'utf8');
  const match = source.match(/sourceMappingURL=data:application\/json;base64,([^\s]+)/);
  assert(match);
  const map = JSON.parse(Buffer.from(match[1], 'base64'));
  assert(map.sources.some((s) => s.endsWith('src/app/workspace/renderer.ts')));
  assert(map.sourcesContent.some((s) => s?.includes('developmentGeneration')));
  report.checks.push({ name: 'Node stack and renderer embedded map refer to original TypeScript' });
  page = await currentPage();
  await page.screenshot({ path: path.join(output, 'development.png') });
  await assert.rejects(startDevelopment({ root: fixture, dataDir: profile }), /already owned/);
  report.checks.push({ name: 'A second launcher cannot overwrite the active runtime' });
  const configurationPid = session.pid,
    configurationHash = await digest(path.join(session.runtime, 'ui/renderer.js'));
  mark = events.length;
  await edit('package.json', (s) => s + '\n');
  await waitEvent('error', mark);
  mark = events.length;
  await edit(renderer, (s) => s + '\n// configuration is stale\n');
  await waitEvent('error', mark);
  assert.equal(session.pid, configurationPid);
  assert.equal(await digest(path.join(session.runtime, 'ui/renderer.js')), configurationHash);
  report.checks.push({
    name: 'Configuration changes freeze publication until explicit launcher restart',
  });
  await bounded(session.stop(), 45000, 'Development stop timed out');
  session = null;
  assert(events.some((e) => e.kind === 'stopped'));
  report.checks.push({
    name: 'All owned Electron processes closed normally',
    processes: apps.length,
  });
  assert.deepEqual(rendererErrors, []);
  for (const { child, ended, evidence } of apps) {
    await ended;
    assert(evidence.capture, 'Every development generation needs a fresh capture');
    assert.equal(child.exitCode, 0);
    assert.equal(child.signalCode, null);
    await assert.rejects(readFile('/proc/' + child.pid + '/stat'), { code: 'ENOENT' });
  }
  report.rendererErrors = rendererErrors;
  report.step = 'all assertions and normal exits complete';
  report.passed = true;
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  let cleanupError;
  try {
    if (session) await bounded(session.stop(), 45000, 'Development cleanup stop timed out');
  } catch (error) {
    cleanupError = error;
    report.cleanupError = error.stack;
    report.passed = false;
  }
  report.cleanup = [];
  for (const { child } of apps) {
    try {
      const result = await stopOwnedChild(child, { owns: () => ownsProfile(child, profile) });
      report.cleanup.push(result);
      assert(!result.forced, 'Emergency cleanup prevents development qualification');
    } catch (error) {
      cleanupError = error;
      report.cleanupError = error.stack;
      report.passed = false;
    }
  }
  await writeFile(
    path.join(output, report.passed ? 'result.json' : 'failure.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(path.join(output, 'process.log'), logs.join('\n') + '\n');
  if (cleanupError) throw cleanupError;
  // Retain fixture and profile as failure evidence; this script never edits user sources.
}
console.log(JSON.stringify(report, null, 2));
