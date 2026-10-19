// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { atlasCanvasReady } from "./atlas-canvas-probe.mjs";
const root = process.cwd(),
  require = createRequire(root + "/package.json"),
  { _electron } = require("playwright-core");
require("esbuild").buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas-landscape';",
    resolveDir: root,
  },
  outfile: ".build/landscape-native-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore } = require(root + "/.build/landscape-native-store.cjs");
const dir = await mkdtemp("/tmp/saltmarcher-landscape-"),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? ".build/land-mask-native");
await mkdir(out, { recursive: true });
const store = new CampaignStore(dir + "/workbench.sqlite"),
  room = {
    id: "watch",
    scopeId: "local",
    floorId: "ground",
    number: "1",
    name: "Referenzhaus",
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 12, y: 0 },
          { x: 12, y: 8 },
          { x: 0, y: 8 },
        ],
        holes: [],
      },
    ],
    sections: [],
  };
const cam = store.create("Pinselvergleich", [room]),
  active = store.activate(cam.id);
store.tutorial("skipped");
store.close();
const Database = require("better-sqlite3"),
  db = new Database(dir + "/workbench.sqlite", { readonly: true }),
  records = () =>
    db
      .prepare("SELECT payload FROM atlas_landscape")
      .all()
      .map((r) => JSON.parse(r.payload));
const result = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty: !!execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { encoding: "utf8" },
  ).trim(),
  profile: dir,
  errors: [],
  checks: [],
};
let app, page;
async function start() {
  const executable = process.env.ATLAS_PACKAGE
    ? path.join(process.env.ATLAS_PACKAGE, "electron")
    : root + "/node_modules/electron/dist/electron";
  app = await _electron.launch({
    executablePath: executable,
    args: [
      ...(process.env.ATLAS_PACKAGE ? [] : [root + "/.build/desktop/main.cjs"]),
      "--data-dir",
      dir,
      "--ozone-platform=x11",
    ],
    timeout: 60000,
  });
  if (process.env.ATLAS_PACKAGE)
    assert.equal(
      await app.evaluate(({ app }) => app.getVersion()),
      JSON.parse(await readFile(root + "/package.json", "utf8")).version,
    );
  page = await app.firstWindow();
  page.on("pageerror", (e) => result.errors.push(e.stack ?? e.message));
  await page.waitForFunction(
    () => document.body.dataset.tutorialReady === "true",
  );
  await page
    .locator(".campaign-card")
    .filter({ hasText: "Pinselvergleich" })
    .getByRole("button", { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains("has-workspace") &&
      !document.querySelector("main").inert,
  );
  if (await page.locator("#campaign-atlas").isHidden()) {
    if (!(await page.locator("#atlas-tab").isVisible()))
      await page.locator("#workspace-nav-summary").click();
    await page.locator("#atlas-tab").click();
  }
  await atlasCanvasReady(page);
  await page.locator("#atlas-search").fill("Referenzhaus");
  await page
    .locator("#atlas-search-results button")
    .filter({ hasText: "Referenzhaus" })
    .click();
  await atlasCanvasReady(page);
  await page.locator("#atlas-search").fill("");
  await page.locator('button[data-family="terrain"]').click();
  await atlasCanvasReady(page);
}
const tool = async (value) => {
  await page.waitForFunction(
    () => !document.querySelector("#land-tool").disabled,
  );
  await page
    .locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`)
    .click();
  await page.waitForFunction(
    (value) => document.querySelector("#land-tool").value === value,
    value,
  );
  await atlasCanvasReady(page);
};
const camera = () =>
  page.locator("#campaign-map").evaluate((n) => ({
    view: JSON.parse(n.dataset.atlasView),
    left: n.getBoundingClientRect().left,
    top: n.getBoundingClientRect().top,
    width: n.getBoundingClientRect().width,
    height: n.getBoundingClientRect().height,
  }));
async function at(x, y) {
  const c = await camera();
  return {
    x: c.left + ((x - c.view.x) / c.view.width) * c.width,
    y: c.top + ((y - c.view.y) / c.view.height) * c.height,
  };
}
async function capture(name) {
  await page.screenshot({ path: out + "/" + name + ".png" });
}
async function stroke(points) {
  const p = await at(...points[0]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    const q = await at(...point);
    await page.mouse.move(q.x, q.y, { steps: 12 });
  }
  await page.mouse.up();
}

const maskBytes = () =>
  require("node:crypto")
    .createHash("sha256")
    .update(
      JSON.stringify(
        records()
          .filter((r) => r.mask)
          .map((r) => [r.id, r.mask.data])
          .sort(),
      ),
    )
    .digest("hex");
async function settled() {
  await page.waitForFunction(
    () =>
      !document.querySelector("#land-tool").disabled &&
      document.querySelector("#land-status").textContent === "Gespeichert",
    null,
    { timeout: 30000 },
  );
  await atlasCanvasReady(page);
}
async function mode(value, radius) {
  await page.locator(`[data-land-mode="${value}"]`).click();
  await page.locator("#land-radius").fill(String(radius));
}
async function hold(x, y, ms) {
  const p = await at(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await settled();
}
try {
  await start();
  await tool("paint");
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Verkleinern", exact: true })
      .click();
  await atlasCanvasReady(page);
  const c = await camera(),
    x = c.view.x + c.view.width * 0.35,
    y = c.view.y + c.view.height * 0.65,
    r = Math.max(3, c.view.width * 0.05);
  const core = require(root + "/.build/landscape-native-store.cjs"),
    atTerrain = (x, y) => core.effectiveLandscape(records(), { x, y }).terrain;
  assert.equal(atTerrain(x, y), "water");
  await capture("01-water-default");
  result.checks.push("blank atlas is water");
  await mode("land", r);
  await stroke([
    [x - r * 2, y],
    [x + r * 2, y],
  ]);
  await settled();
  assert.equal(atTerrain(x, y), "plains");
  await capture("02-land");
  await mode("land-erase", r * 0.35);
  await hold(x, y, 80);
  assert.equal(atTerrain(x, y), "water");
  const erased = maskBytes();
  await page.locator("#atlas-undo").click();
  await atlasCanvasReady(page);
  assert.equal(atTerrain(x, y), "plains");
  await page.locator("#atlas-redo").click();
  await atlasCanvasReady(page);
  assert.equal(maskBytes(), erased);
  result.checks.push("land, eraser, undo/redo through actual controls");
  const island = {
    x: c.view.x + c.view.width * 0.77,
    y: c.view.y + c.view.height * 0.28,
  };
  await mode("raise", r);
  await page.locator("#land-coast-roughness").fill("2");
  await hold(island.x, island.y, 2100);
  assert.equal(atTerrain(island.x, island.y), "plains");
  await capture("03-fractal-island");
  result.checks.push("stationary fractal raise creates an island");
  await mode("lower", r * 0.45);
  await hold(island.x, island.y, 2100);
  assert.equal(atTerrain(island.x, island.y), "water");
  await capture("04-fractal-hole");
  result.checks.push("stationary fractal lower creates interior water");
  await mode("raise", r);
  const before = maskBytes(),
    p = await at(x, y + r * 2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert(maskBytes() === before, "Escape must not commit the draft");
  result.checks.push("Escape discards mask preview");
  const lock = new Database(dir + "/workbench.sqlite");
  await mode("land", r);
  const retryPoint = {
      x: c.view.x + c.view.width * 0.75,
      y: c.view.y + c.view.height * 0.78,
    },
    rp = await at(retryPoint.x, retryPoint.y),
    beforeRetry = maskBytes();
  await page.mouse.move(rp.x, rp.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  lock.exec("BEGIN IMMEDIATE");
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      /database is locked|SQLITE_BUSY/.test(
        document.querySelector("#atlas-save-status").textContent,
      ),
    null,
    { timeout: 30000 },
  );
  assert.equal(maskBytes(), beforeRetry);
  lock.exec("ROLLBACK");
  lock.close();
  await page.locator("#land-finish").click();
  await settled();
  assert.equal(atTerrain(retryPoint.x, retryPoint.y), "plains");
  result.checks.push(
    "actual SQLite write failure retains mask stroke for retry",
  );
  const persisted = maskBytes();
  await app.close();
  app = null;
  await start();
  assert(maskBytes() === persisted, "Reopen must retain mask bytes");
  await capture("05-reopened");
  result.checks.push("fresh installed process retains exact mask");
  await page.locator("#atlas-output-open").click();
  await page
    .locator("#atlas-output summary")
    .filter({ hasText: "Bildoptionen" })
    .click();
  await page.locator("#atlas-export-size").fill("1600");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + "/comparison.png");
  await page.locator("#atlas-export-png").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#atlas-save-status").textContent ===
      "Atlas-PNG gespeichert",
    null,
    { timeout: 60000 },
  );
  const png = require("pngjs").PNG.sync.read(
    await readFile(out + "/comparison.png"),
  );
  assert.equal(Math.max(png.width, png.height), 1600);
  result.checks.push("native PNG export");
  assert.deepEqual(result.errors, []);
  result.ok = true;
} catch (error) {
  result.error = error.stack ?? String(error);
  if (page) {
    result.status = await page.locator("#atlas-save-status").textContent();
    await capture("failure").catch(() => {});
  }
  throw error;
} finally {
  if (app) {
    if (result.ok) {
      await app.close();
      result.normalExit = true;
    } else await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
  db.close();
  await writeFile(out + "/result.json", JSON.stringify(result, null, 2));
}
