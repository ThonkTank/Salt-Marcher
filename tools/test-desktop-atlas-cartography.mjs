// Actual Electron UI in a synthetic profile; canonical data checked after each gesture.
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { atlasCanvasReady } from "./atlas-canvas-probe.mjs";
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { _electron } = require("playwright-core");
require("esbuild").buildSync({
  entryPoints: ["src/app/storage/store.ts"],
  outfile: ".build/cartography-native-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore } = require(
    root + "/.build/cartography-native-store.cjs",
  ),
  dir = await mkdtemp("/tmp/saltmarcher-cartography-"),
  out = path.resolve(
    process.env.QA_EVIDENCE_DIR ?? ".build/cartography-native",
  );
await mkdir(out, { recursive: true });
const store = new CampaignStore(dir + "/workbench.sqlite"),
  cam = store.create("Regionswerkstatt"),
  active = store.activate(cam.id);
const write = (action) =>
  store.executeAtlasCommit({
    commandId: randomUUID(),
    token: active.token,
    campaignId: cam.id,
    action,
  });
const polygon = (x, y, w, h) => [
  {
    outer: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    holes: [],
  },
];
for (const [id, x, color] of [
  ["Westmark", -100, "#587a49"],
  ["Ostmark", 0, "#b58445"],
])
  write({
    kind: "territory-put",
    expectedRevision: null,
    territory: {
      id,
      revision: 0,
      name: id,
      layerId: "politics",
      parentId: null,
      typeId: "kingdom",
      rank: 5,
      polygons: polygon(x, -50, 100, 100),
      color,
      opacity: 0.15,
      border: "solid",
    },
  });
write({
  kind: "landscape-batch",
  records: [
    {
      id: "ground",
      revision: 0,
      kind: "patch",
      name: "Land",
      polygons: polygon(-500, -500, 1000, 1000),
      points: [],
      resolution: 1,
      width: 0,
      values: { terrain: "plains" },
    },
    {
      id: "road",
      revision: 0,
      kind: "road",
      name: "Königsstraße",
      points: [
        { x: -80, y: 25 },
        { x: 80, y: 25 },
      ],
      polygons: [],
      width: 4,
      resolution: 1,
      values: {},
    },
    {
      id: "river",
      revision: 0,
      kind: "river",
      name: "Silberfluss",
      points: [
        { x: -80, y: -30 },
        { x: 80, y: -10 },
      ],
      polygons: [],
      width: 3,
      resolution: 1,
      values: {},
    },
  ].map((record) => ({ record, expectedRevision: null })),
});
const made = write({
    kind: "city-create",
    name: "Eichenfurt",
    x: 500,
    y: 500,
    width: 200,
    height: 200,
  }),
  cityId = made.result.id,
  city = store.city(active.token, cityId);
store.executeCity({
  commandId: randomUUID(),
  token: active.token,
  campaignId: cam.id,
  cityId,
  expectedRevision: city.header.revision,
  action: {
    kind: "change",
    upsert: [
      {
        id: "tavern",
        kind: "building",
        name: "Goldene Taverne",
        protected: true,
        position: { x: 100, y: 100 },
        outline: [
          { x: -20, y: -10 },
          { x: 20, y: -10 },
          { x: 20, y: 10 },
          { x: -20, y: 10 },
        ],
        angle: 0,
        notes: "",
        residentIds: [],
        workerIds: [],
        households: [],
        jobs: [],
      },
    ],
    remove: [],
    label: "Taverne",
  },
});
store.tutorial("skipped");
store.close();
const Database = require("better-sqlite3"),
  db = new Database(dir + "/workbench.sqlite", { readonly: true });
const records = () =>
  db
    .prepare("SELECT payload FROM atlas_territory ORDER BY id")
    .all()
    .map((r) => JSON.parse(r.payload));
const result = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  profile: dir,
  checks: [],
  errors: [],
};
let app, page;
async function start() {
  app = await _electron.launch({
    executablePath: root + "/node_modules/electron/dist/electron",
    args: [
      root + "/.build/desktop/main.cjs",
      "--data-dir",
      dir,
      "--ozone-platform=x11",
    ],
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => result.errors.push(e.stack ?? e.message));
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
  await page.locator("#atlas-section").selectOption("terrain");
  await page.locator('[data-tool-group="regions"]').click();
  await page.locator('[data-atlas-tool="territory"]').click();
  await page
    .locator('#territory-region option[value="Westmark"]')
    .waitFor({ state: "attached" });
  await page.locator("#territory-region").selectOption("Westmark");
  await page.locator("#territory-focus").click();
  await atlasCanvasReady(page);
}
async function at(x, y) {
  return page.locator("#campaign-map").evaluate(
    (n, p) => {
      const b = n.getBoundingClientRect(),
        v = JSON.parse(n.dataset.atlasView);
      return {
        x: b.x + ((p.x - v.x) / v.width) * b.width,
        y: b.y + ((p.y - v.y) / v.height) * b.height,
      };
    },
    { x, y },
  );
}
async function stroke(points) {
  const p = await at(...points[0]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    const q = await at(...p);
    await page.mouse.move(q.x, q.y, { steps: 8 });
  }
  await page.mouse.up();
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate(records())) {
      await atlasCanvasReady(page);
      return;
    }
    await page.waitForTimeout(100);
  }
  throw Error("Canonical postcondition failed");
}
async function shot(name) {
  await page.screenshot({ path: out + "/" + name + ".png" });
}
try {
  await start();
  await shot("01-regions");
  await page.locator("#territory-radius").fill("12");
  await stroke([
    [-5, -15],
    [5, 15],
  ]);
  await waitFor((rows) => rows.every((r) => r.revision === 2));
  const painted = records();
  await shot("02-painted");
  result.checks.push(
    "brush release atomically changes both neighbouring regions",
  );
  await page.locator("#atlas-undo").click();
  await waitFor((rows) => rows.every((r) => r.revision === 3));
  await page.locator("#atlas-redo").click();
  await waitFor((rows) => rows.every((r) => r.revision === 4));
  assert.deepEqual(
    records().map((r) => r.polygons),
    painted.map((r) => r.polygons),
  );
  result.checks.push(
    "native undo and redo restore complete neighbour geometry",
  );
  await page.locator("#territory-operation").selectOption("erase");
  await stroke([
    [-20, 0],
    [-10, 0],
  ]);
  await waitFor((rows) => rows.find((r) => r.id === "Westmark").revision === 5);
  assert.deepEqual(
    records().find((r) => r.id === "Ostmark").polygons,
    painted.find((r) => r.id === "Ostmark").polygons,
  );
  result.checks.push("erasure does not give land to neighbour");
  await page.locator("#territory-operation").selectOption("vertices");
  const openPolygons = (polygons) =>
    polygons.map((p) => {
      const open = (r) =>
        r.length > 3 && r[0].x === r.at(-1).x && r[0].y === r.at(-1).y
          ? r.slice(0, -1)
          : r;
      return { outer: open(p.outer), holes: p.holes.map(open) };
    });
  const beforeInsert = records().find((r) => r.id === "Westmark").polygons;
  const edge = await at(-100, 0);
  await page.keyboard.down("Shift");
  await page.mouse.click(edge.x, edge.y);
  await page.keyboard.up("Shift");
  await waitFor((rows) => rows.find((r) => r.id === "Westmark").revision === 6);
  await page
    .locator("#territory-name")
    .evaluate((n) => (n.closest("details").open = true));
  await page.locator("#territory-vertex-delete").click();
  await waitFor((rows) => rows.find((r) => r.id === "Westmark").revision === 7);
  assert.deepEqual(
    openPolygons(records().find((r) => r.id === "Westmark").polygons),
    openPolygons(beforeInsert),
  );
  result.checks.push(
    "inserted boundary point remains selected for immediate deletion",
  );
  await stroke([
    [-100, -50],
    [-95, -45],
  ]);
  await waitFor((rows) => rows.find((r) => r.id === "Westmark").revision === 8);
  result.checks.push("point refinement after brush stroke");
  await page.locator("#territory-operation").selectOption("label");
  const point = await at(-65, 0);
  await page.mouse.click(point.x, point.y);
  await waitFor((rows) => !!rows.find((r) => r.id === "Westmark").labelPoint);
  await shot("03-label-position");
  result.checks.push("object-bound manual region label anchor");
  await page
    .locator("#territory-layer-new")
    .evaluate((n) => (n.closest("details").open = true));
  await page.locator("#territory-layer-name").fill("Handelsbünde");
  await page.locator("#territory-layer-new").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#territory-layer").selectedOptions[0]
        ?.textContent === "Handelsbünde",
  );
  await page
    .locator("#territory-name")
    .evaluate((n) => (n.closest("details").open = true));
  await page.locator("#territory-name").fill("Kaufmannsbund");
  await page.locator("#territory-new").click();
  await waitFor((rows) => rows.some((r) => r.name === "Kaufmannsbund"));
  await page.locator("#territory-operation").selectOption("add");
  await stroke([
    [-50, 20],
    [-30, 20],
  ]);
  await waitFor(
    (rows) => rows.find((r) => r.name === "Kaufmannsbund").polygons.length > 0,
  );
  result.checks.push(
    "custom layer and a new region created with ordinary controls and painted",
  );
  const saved = records();
  await app.close();
  app = null;
  await start();
  assert.deepEqual(records(), saved);
  await shot("04-fresh");
  result.checks.push(
    "fresh process retains region geometry, style and label anchor",
  );
  await page.locator("#atlas-search").fill("Goldene Taverne");
  await page
    .locator("#atlas-search-results button")
    .filter({ hasText: "Goldene Taverne" })
    .click();
  await atlasCanvasReady(page);
  await page.locator("#city-labels summary").click();
  await page.locator("#city-label-rank").fill("4");
  await page.locator('#city-unit-form button[type="submit"]').click();
  await page.waitForTimeout(1000);
  assert.equal(
    JSON.parse(
      db.prepare("SELECT payload FROM city_unit WHERE id='tavern'").get()
        .payload,
    ).label.rank,
    4,
  );
  await shot("05-building-label");
  result.checks.push(
    "building label prominence edited and committed through native inspector",
  );
  await page.locator("#atlas-search").fill("");
  await page.locator("#atlas-section").selectOption("terrain");
  await page.locator('[data-tool-group="regions"]').click();
  await page.locator('[data-atlas-tool="territory"]').click();
  await page.locator("#territory-layer").selectOption("politics");
  await page.locator("#territory-region").selectOption("Westmark");
  await page.locator("#territory-focus").click();
  await atlasCanvasReady(page);
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "Verkleinern", exact: true })
      .click();
  await atlasCanvasReady(page);
  await shot("05-zoom");
  await page.locator("#territory-focus").click();
  await atlasCanvasReady(page);
  await page.locator("#atlas-output-open").click();
  await page
    .locator("#atlas-output summary")
    .filter({ hasText: "Bildoptionen" })
    .click();
  await page.locator("#atlas-export-size").fill("1600");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + "/atlas.png");
  await page.locator("#atlas-export-png").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#atlas-save-status").textContent ===
      "Atlas-PNG gespeichert",
    null,
    { timeout: 60000 },
  );
  const png = require("pngjs").PNG.sync.read(
    await readFile(out + "/atlas.png"),
  );
  assert.equal(Math.max(png.width, png.height), 1600);
  result.checks.push("native tiled PNG export with global labels");
  await shot("06-export");
  assert.deepEqual(result.errors, []);
  result.ok = true;
} catch (e) {
  result.error = e.stack ?? String(e);
  if (page) await shot("failure").catch(() => {});
  throw e;
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
