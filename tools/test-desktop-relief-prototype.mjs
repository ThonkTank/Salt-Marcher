// R0 native source probe. No product profile, no GPU-disabling/software flags.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/relief-r0-evidence');
await mkdir(out, { recursive: true });
const result = {
  phase: 'R0',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty:
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
  bundleSha256: createHash('sha256')
    .update(await readFile('.build/relief-r0/app.js'))
    .digest('hex'),
  memoryGiB: os.totalmem() / 1024 ** 3,
  hardware: os.cpus()[0]?.model,
  cases: [],
  errors: [],
  ownerAcceptance: 'pending',
};
let app, page;
async function ready() {
  await page.waitForFunction(() => window.reliefProbe?.read().frameNumber > 0);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function change(id, value) {
  const before = await page.evaluate(() => reliefProbe.read().frameNumber);
  await page.locator('#' + id).selectOption(value);
  await page.waitForFunction((n) => reliefProbe.read().frameNumber > n, before);
  await ready();
}
async function capture(name) {
  await ready();
  await writeFile(
    out + '/' + name + '.png',
    Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
          .toPNG()
          .toString('base64'),
      ),
      'base64',
    ),
  );
  result.cases.push({ name, probe: await page.evaluate(() => reliefProbe.read()) });
}
async function location(x, y) {
  const rect = await page.locator('#viewport').boundingBox(),
    p = await page.evaluate(([x, y]) => reliefProbe.project(x, y), [x, y]);
  return { x: rect.x + p.x, y: rect.y + p.y };
}
async function stroke(p, escape = false) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 1, p.y + 1, { steps: 2 });
  if (escape) await page.keyboard.press('Escape');
  await page.mouse.up();
  await ready();
}
try {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/relief-r0/main.cjs', '--ozone-platform=x11'],
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => result.errors.push(e.stack));
  await ready();
  result.gpu = await app.evaluate(async ({ app }) => ({
    features: app.getGPUFeatureStatus(),
    info: await app.getGPUInfo('complete'),
  }));
  result.webgl = await page.evaluate(() => {
    const gl = document.querySelector('#spatial').getContext('webgl2'),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      version: gl.getParameter(gl.VERSION),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  });
  assert.equal(await page.evaluate(() => reliefProbe.read().diagnostics.errors.length), 0);
  for (const scale of ['continent', 'region', 'place']) {
    await change('scale', scale);
    for (const mode of ['top', 'tilted']) {
      await page.locator('#' + mode).click();
      await ready();
      for (const style of ['shade', 'drawn']) {
        await change('style', style);
        await capture(scale + '-' + mode + '-' + style);
      }
    }
  }
  assert.equal(
    await page.evaluate(() => reliefProbe.read().strokes),
    0,
    'all view changes are read-only',
  );
  await change('scale', 'region');
  await page.locator('#tilted').click();
  await ready();
  const inverse = await page.evaluate(() => {
    const p = reliefProbe.project(-16800, 10400);
    return reliefProbe.hit(p.x, p.y);
  });
  result.inverse = inverse;
  assert(
    Math.abs(inverse.x + 16800) < 1 && Math.abs(inverse.y - 10400) < 1,
    'tilted mesh hit preserves world position under exaggeration: ' + JSON.stringify(inverse),
  );
  await change('tool', 'raise');
  const p = await location(-16800, 10400),
    before = await page.evaluate(() => reliefProbe.height(-16800, 10400));
  await stroke(p);
  const after = await page.evaluate(() => reliefProbe.height(-16800, 10400));
  assert(after > before + 250);
  assert.equal(await page.evaluate(() => reliefProbe.read().strokes), 1);
  await capture('raised-pass-tilted');
  await page.locator('#top').click();
  await ready();
  assert.equal(await page.evaluate(() => reliefProbe.height(-16800, 10400)), after);
  await page.locator('#undo').click();
  await ready();
  assert.equal(await page.evaluate(() => reliefProbe.height(-16800, 10400)), before);
  await page.locator('#redo').click();
  await ready();
  assert.equal(await page.evaluate(() => reliefProbe.height(-16800, 10400)), after);
  const q = await location(-16800, 10400);
  await stroke(q, true);
  assert.equal(await page.evaluate(() => reliefProbe.height(-16800, 10400)), after);
  assert.equal(await page.evaluate(() => reliefProbe.read().draft), false);
  result.cases.push({ name: 'real-pointer-sculpt-view-switch-undo-redo-escape', before, after });
  await change('tool', 'navigate');
  await page.locator('#tilted').click();
  await ready();
  const b = await page.locator('#viewport').boundingBox(),
    old = await page.evaluate(() => reliefProbe.read().state);
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5 + 70, b.y + b.height * 0.6 + 40, { steps: 8 });
  await page.mouse.up();
  await ready();
  const moved = await page.evaluate(() => reliefProbe.read().state);
  assert.notEqual(moved.x, old.x);
  await page.mouse.wheel(0, -180);
  await ready();
  assert((await page.evaluate(() => reliefProbe.read().state.span)) < moved.span);
  const movedHit = await page.evaluate(() => {
    const p = reliefProbe.project(-16800, 10400);
    return reliefProbe.hit(p.x, p.y);
  });
  assert(
    Math.abs(movedHit.x + 16800) < 1 && Math.abs(movedHit.y - 10400) < 1,
    'camera movement retains world-space terrain picking',
  );
  // Keyboard range interaction exercises normal input, no mutation through probe.
  await page.locator('#tilt').focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await ready();
  assert.equal(await page.locator('#tilt').inputValue(), '48');
  await capture('camera-pan-zoom-tilt');
  result.cases.push({ name: 'input-pan-zoom-tilt' });
  // A one-event jump longer than the brush diameter used to leave unpainted gaps.
  await page.locator('#reset').click();
  await ready();
  await change('scale', 'place');
  await page.locator('#top').click();
  await ready();
  await change('tool', 'raise');
  const corridor = Array.from({ length: 17 }, (_, i) => [3000 + i * 250, 14500]);
  const baseline = await page.evaluate(
    (points) => points.map(([x, y]) => reliefProbe.height(x, y)),
    corridor,
  );
  const outside = await page.evaluate(() => reliefProbe.height(5000, 15500));
  const start = await location(3000, 14500),
    end = await location(7000, 14500);
  const drag = async (steps) => {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps });
    await page.mouse.up();
    await ready();
  };
  await drag(1);
  const fast = await page.evaluate(
    (points) => points.map(([x, y]) => reliefProbe.height(x, y)),
    corridor,
  );
  fast.forEach((h, i) =>
    assert(Math.abs(h - baseline[i] - 300) < 0.01, `continuous fast stroke at ${i}`),
  );
  assert.equal(await page.evaluate(() => reliefProbe.height(5000, 15500)), outside);
  assert.equal(await page.evaluate(() => reliefProbe.read().strokes), 1);
  await capture('continuous-fast-stroke-top');
  await page.locator('#undo').click();
  await ready();
  assert.deepEqual(
    await page.evaluate((points) => points.map(([x, y]) => reliefProbe.height(x, y)), corridor),
    baseline,
  );
  await drag(24);
  const slow = await page.evaluate(
    (points) => points.map(([x, y]) => reliefProbe.height(x, y)),
    corridor,
  );
  slow.forEach((h, i) =>
    assert(Math.abs(h - fast[i]) < 0.01, `same relief with dense events at ${i}`),
  );
  assert.equal(await page.evaluate(() => reliefProbe.read().strokes), 1);
  await page.locator('#tilted').click();
  await ready();
  assert.deepEqual(
    await page.evaluate((points) => points.map(([x, y]) => reliefProbe.height(x, y)), corridor),
    slow,
  );
  await capture('continuous-stroke-tilted');
  result.cases.push({
    name: 'continuous-sparse-dense-stroke-and-undo',
    baseline,
    fast,
    slow,
    outside,
  });
  assert.deepEqual(result.errors, []);
  result.final = await page.evaluate(() => reliefProbe.read());
  const exit = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  result.exit = await exit;
  app = null;
  assert.deepEqual(result.exit, { code: 0, signal: null });
  result.complete = true;
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      { complete: true, out, cases: result.cases.map((c) => c.name), gpu: result.gpu.features },
      null,
      2,
    ),
  );
} catch (error) {
  result.complete = false;
  result.error = error.stack;
  if (page) await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  throw error;
} finally {
  if (app) {
    const proc = app.process(),
      timer = setTimeout(() => proc.kill('SIGTERM'), 5000);
    try {
      await app.close();
    } finally {
      clearTimeout(timer);
    }
  }
}
