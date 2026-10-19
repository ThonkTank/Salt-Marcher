// Native Atlas regions: an isolated synthetic campaign, real pointer/keyboard input,
// shared geometry, export and a fresh process. Never opens a user campaign.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";
import { atlasCanvasReady, atlasCanvasPoint } from "./atlas-canvas-probe.mjs";
const root = process.cwd(),
  require = createRequire(root + "/package.json"),
  { _electron } = require("playwright-core"),
  Database = require("better-sqlite3");
require("esbuild").buildSync({
  entryPoints: ["src/app/storage/store.ts"],
  outfile: ".build/territory-native-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore } = require(root + "/.build/territory-native-store.cjs");
const out = path.resolve(
  process.env.QA_EVIDENCE_DIR ??
    "/home/aaron/.cache/dungeon-native-qa/atlas-territories",
);
await mkdir(out, { recursive: true });
const profile = await mkdtemp("/tmp/saltmarcher-territories-native-"),
  store = new CampaignStore(profile + "/workbench.sqlite");
const campaign = store.create("Regionswerkstatt", []);
store.tutorial("skipped");
store.close();
const executable = process.env.ATLAS_PACKAGE
    ? path.join(process.env.ATLAS_PACKAGE, "electron")
    : root + "/node_modules/electron/dist/electron",
  prefix = process.env.ATLAS_PACKAGE ? [] : [root + "/.build/desktop/main.cjs"];
const builtRoot = process.env.ATLAS_PACKAGE
  ? path.join(process.env.ATLAS_PACKAGE, "resources/app")
  : root + "/.build/desktop";
const result = {
  profile,
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  build: JSON.parse(
    await readFile(path.join(builtRoot, "build-info.json"), "utf8"),
  ),
  artifacts: Object.fromEntries(
    await Promise.all(
      ["main.cjs", "atlas-region-worker.cjs", "ui/renderer.js"].map(
        async (file) => [
          file,
          createHash("sha256")
            .update(await readFile(path.join(builtRoot, file)))
            .digest("hex"),
        ],
      ),
    ),
  ),
  errors: [],
  checks: [],
};
let app, page;
const dbread = (fn) => {
  const db = new Database(profile + "/workbench.sqlite", { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
};
const records = () =>
  dbread((db) =>
    db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE json_extract(payload,'$.kind')='territory'",
      )
      .all()
      .map((r) => JSON.parse(r.payload)),
  );
async function launch() {
  app = await _electron.launch({
    executablePath: executable,
    args: [...prefix, "--data-dir", profile, "--ozone-platform=x11"],
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => {
    result.errors.push(e.stack ?? e.message);
    console.error(e);
  });
  await page.waitForFunction(
    () => document.body.dataset.tutorialReady === "true",
  );
  await page
    .locator(".campaign-card")
    .filter({ hasText: "Regionswerkstatt" })
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
}
async function draw(x, y, dx) {
  const p = await atlasCanvasPoint(page, { x, y }, false),
    q = await atlasCanvasPoint(page, { x: x + dx, y }, false);
  assert.equal(p.target, "campaign-map");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector("#territory-status").textContent ===
      "Region gespeichert.",
    null,
    { timeout: 20000 },
  );
  await atlasCanvasReady(page);
}
try {
  await launch();
  // Restore a reproducible metric camera through the supported persisted view.
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        "atlas-camera:" + id,
        JSON.stringify({ x: -400, y: -300, width: 800, height: 600 }),
      ),
    campaign.id,
  );
  await app.close();
  app = null;
  await launch();
  await page.locator('[data-family="regions"]').click();
  await page.locator("#territory-new").click();
  await page.locator("#territory-name").fill("Königreich Eichmark");
  await page.locator("#territory-preset").selectOption("80");
  await page.locator("#territory-radius").fill("90");
  await draw(-100, 0, 200);
  assert.equal(records().length, 1);
  assert.equal(records()[0].territory.prominence, 80);
  result.checks.push("paint-and-save");
  await page.locator("#territory-new").click();
  await page.locator("#territory-name").fill("Stadt Eichenfurt");
  await page.locator("#territory-parent").selectOption(records()[0].id);
  await page.locator("#territory-preset").selectOption("40");
  await page.locator("#territory-radius").fill("20");
  await draw(-30, 0, 60);
  assert.equal(records().length, 2);
  result.checks.push("nested-region");
  await page.locator("#atlas-undo").click();
  await atlasCanvasReady(page);
  assert.equal(records().length, 1);
  await page.locator("#atlas-redo").click();
  await atlasCanvasReady(page);
  assert.equal(records().length, 2);
  result.checks.push("undo-redo");
  await page
    .locator("#territory-list button")
    .filter({ hasText: "Eichenfurt" })
    .click();
  await page.locator("#territory-mode").selectOption("label");
  let at = await atlasCanvasPoint(page, { x: 0, y: 0 }, false);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 20, at.y + 10, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector("#territory-status").textContent ===
      "Region gespeichert.",
  );
  assert(
    records().find((r) => r.name === "Stadt Eichenfurt").territory.label
      .position,
  );
  result.checks.push("move-label");
  // Exact boundary edits keep the same region and use one atomic commit.
  await page.locator("#territory-mode").selectOption("points");
  const beforePoints = records().find((r) => r.name === "Stadt Eichenfurt"),
    vertex = beforePoints.polygons[0].outer[0];
  const v = await atlasCanvasPoint(page, vertex, false);
  await page.mouse.move(v.x, v.y);
  await page.mouse.down();
  await page.mouse.move(v.x + 8, v.y + 5, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector("#territory-status").textContent ===
      "Region gespeichert.",
  );
  assert.notDeepEqual(
    records().find((r) => r.id === beforePoints.id).polygons,
    beforePoints.polygons,
  );
  result.checks.push("boundary-point-drag");
  const beforeInsert = records().find((r) => r.id === beforePoints.id),
    ring = beforeInsert.polygons[0].outer;
  const longest = ring
    .map((p, i) => ({
      p,
      q: ring[(i + 1) % ring.length],
      d: Math.hypot(
        p.x - ring[(i + 1) % ring.length].x,
        p.y - ring[(i + 1) % ring.length].y,
      ),
    }))
    .sort((a, b) => b.d - a.d)[0];
  const middle = await atlasCanvasPoint(
    page,
    { x: (longest.p.x + longest.q.x) / 2, y: (longest.p.y + longest.q.y) / 2 },
    false,
  );
  await page.mouse.dblclick(middle.x, middle.y);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x, middle.y + 10, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector("#territory-status").textContent ===
      "Region gespeichert.",
  );
  // Insertion and the following drag form one persisted boundary edit.
  assert(
    records().find((r) => r.id === beforePoints.id).revision >
      beforeInsert.revision,
  );
  result.checks.push("boundary-point-insert");
  await page.locator("#territory-layer-add").click();
  await page.waitForFunction(
    () => document.querySelector("#territory-layer").options.length === 3,
  );
  const custom = page
    .locator('#territory-layers input[aria-label="Ebenenname"]')
    .last();
  await custom.fill("Handelsräume");
  await custom.press("Tab");
  await page.waitForFunction(() =>
    [...document.querySelector("#territory-layer").options].some(
      (o) => o.text === "Handelsräume",
    ),
  );
  result.checks.push("custom-layer");
  const check = page
    .locator('#territory-layers input[type="checkbox"]')
    .first();
  await check.uncheck();
  await atlasCanvasReady(page);
  await check.check();
  await atlasCanvasReady(page);
  await page.screenshot({ path: out + "/regions.png" });
  // Direct building authoring has no creation or placement step.
  await page.locator('[data-family="city"]').click();
  await atlasCanvasReady(page);
  assert(await page.locator("#atlas-create-city").isHidden());
  await page
    .locator('[data-tool-select="city-tool"][data-tool-value="building"]')
    .click();
  at = await atlasCanvasPoint(page, { x: 0, y: 0 }, false);
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() =>
    document.querySelector("#city-count").textContent.includes("1 Häuser"),
  );
  assert.equal(
    dbread((db) => db.prepare("SELECT count(*) n FROM atlas_place").get().n),
    0,
  );
  for (const id of [
    "city-demographics",
    "city-factions",
    "city-paper",
    "city-export-svg",
    "city-export-json",
  ])
    assert(
      await page.locator("#" + id).isHidden(),
      id + " must not expose a separate city administration",
    );
  result.checks.push("direct-building");
  await page.locator('[data-family="interior"]').click();
  await atlasCanvasReady(page);
  assert(await page.locator("#atlas-create-dungeon").isHidden());
  await page
    .locator(
      '[data-tool-select="drawing-tool"][data-tool-value="room-rectangle"]',
    )
    .click();
  let a = await atlasCanvasPoint(page, { x: 25, y: 25 }, false),
    b = await atlasCanvasPoint(page, { x: 35, y: 32 }, false);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await atlasCanvasReady(page);
  assert(dbread((db) => db.prepare("SELECT count(*) n FROM room").get().n) > 0);
  result.checks.push("direct-room");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + "/regions.png-export.png");
  await page.locator("#atlas-output-open").click();
  await page.locator("#atlas-export-png").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#atlas-save-status").textContent ===
      "Atlas-PNG gespeichert",
    null,
    { timeout: 60000 },
  );
  result.checks.push("export");
  const before = records();
  await app.close();
  app = null;
  await launch();
  await page.locator('[data-family="regions"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("#territory-list")
      .textContent.includes("Eichenfurt"),
  );
  assert.deepEqual(records(), before);
  result.checks.push("fresh-reopen");
  await page.screenshot({ path: out + "/reopened.png" });
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (error) {
  result.error = error.stack ?? String(error);
  if (page)
    try {
      await page.screenshot({ path: out + "/failure.png" });
      result.status = await page.locator("#status").textContent();
      result.atlasStatus = await page
        .locator("#atlas-save-status")
        .textContent();
    } catch {}
  throw error;
} finally {
  if (app) await app.close();
  await writeFile(out + "/result.json", JSON.stringify(result, null, 2) + "\n");
}
