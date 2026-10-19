import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
const root = process.cwd(),
  require = createRequire(root + "/package.json"),
  { _electron } = require("playwright-core"),
  { buildSync } = require("esbuild");
const output =
  process.env.CARTOGRAPHY_QA ??
  "/home/aaron/.local/share/saltmarcher-qa/atlas-cartography-20261019";
await mkdir(output, { recursive: true });
buildSync({
  entryPoints: ["src/app/storage/store.ts"],
  outfile: ".build/cartography-native-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas-paint';export * from './src/app/atlas-cartography';export * from './src/app/atlas-map-labels';export {atlasImage} from './src/app/campaign-atlas-export';export {atlasExportTiles} from './src/app/atlas-landscape-export';",
    resolveDir: root,
  },
  outfile: ".build/cartography-browser.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "CartographyProbe",
});
const { CampaignStore } = require(
    root + "/.build/cartography-native-store.cjs",
  ),
  profile = await mkdtemp("/tmp/saltmarcher-cartography-"),
  file = profile + "/workbench.sqlite",
  seed = new CampaignStore(file),
  campaign = seed.create("Atlas Kartografie"),
  workspace = seed.activate(campaign.id);
const action = (a) =>
  seed.executeAtlasCommit({
    commandId: randomUUID(),
    token: workspace.token,
    campaignId: campaign.id,
    action: a,
  });
const city = action({
  kind: "city-create",
  name: "Nebelstadt",
  x: 0,
  y: 0,
  width: 1000,
  height: 1000,
}).result.id;
const put = (u) => {
  const payload = JSON.stringify({ protected: true, ...u });
  seed.db
    .prepare("INSERT INTO city_unit VALUES(?,?,?,?,?,?)")
    .run(
      campaign.id,
      city,
      u.id,
      u.kind,
      payload,
      createHash("sha256").update(payload).digest("hex"),
    );
};
seed.db.transaction(() => {
  put({
    id: "quarter",
    kind: "district",
    name: "Altstadt",
    outline: [
      { x: 40, y: 40 },
      { x: 900, y: 40 },
      { x: 900, y: 900 },
      { x: 40, y: 900 },
    ],
  });
  for (let i = 0; i < 1600; i++)
    put({
      id: "house" + i,
      kind: "building",
      name: i % 7 === 0 ? "Haus am Markt " + i : "",
      position: { x: 35 + (i % 40) * 22, y: 35 + Math.floor(i / 40) * 22 },
      notes: "",
      angle: 0,
      outline: [
        { x: -6, y: -5 },
        { x: 6, y: -5 },
        { x: 6, y: 5 },
        { x: -6, y: 5 },
      ],
    });
  for (let i = 0; i < 4; i++) {
    put({
      id: "nodeA" + i,
      kind: "node",
      name: "",
      point: { x: 5, y: 180 + i * 220 },
    });
    put({
      id: "nodeB" + i,
      kind: "node",
      name: "",
      point: { x: 990, y: 180 + i * 220 },
    });
    put({
      id: "street" + i,
      nodeIds: ["nodeA" + i, "nodeB" + i],
      kind: "road",
      name: ["Königsstraße", "Marktstraße", "Hafenstraße", "Lindenweg"][i],
      width: i === 3 ? 3 : 8,
      outline: [
        { x: 5, y: 180 + i * 220 },
        { x: 990, y: 180 + i * 220 },
      ],
    });
  }
})();
action({
  kind: "landscape-put",
  record: {
    id: randomUUID(),
    revision: 0,
    kind: "river",
    name: "Nebelstrom",
    points: [
      { x: -3000, y: 1080 },
      { x: 400, y: 1100 },
      { x: 5000, y: 1600 },
    ],
    polygons: [],
    resolution: 1,
    width: 25,
    values: {},
  },
  expectedRevision: null,
});
seed.tutorial("skipped");
const original = seed.db
  .prepare("SELECT payload FROM city_unit ORDER BY id")
  .all();
seed.close();
const results = { profile, output },
  errors = [];
let app,
  closed = false;
const ready = async (page) => {
  await page.waitForFunction(
    () =>
      document.querySelector("#campaign-atlas")?.dataset.regionState ===
        "ready" &&
      document.querySelector("#campaign-map")?.dataset.canvasState === "loaded",
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(180);
};
try {
  app = await _electron.launch({
    executablePath: process.env.ATLAS_PACKAGE
      ? path.join(process.env.ATLAS_PACKAGE, "electron")
      : path.join(root, "node_modules/electron/dist/electron"),
    args: [
      ...(process.env.ATLAS_PACKAGE
        ? []
        : [path.join(root, ".build/desktop/main.cjs")]),
      "--data-dir",
      profile,
    ],
    timeout: 30000,
  });
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.waitForFunction(
    () => document.body.dataset.tutorialReady === "true",
  );
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole("button", { name: "Fortsetzen", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains("has-workspace") &&
      !document.querySelector("main").inert,
  );
  if (await page.locator("#campaign-atlas").isHidden())
    await page
      .getByRole("button", { name: "Atlas", exact: true })
      .filter({ visible: true })
      .click();
  await ready(page);
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype,
      clear = proto.clearRect,
      fill = proto.fillText;
    window.cartographyTexts = [];
    proto.clearRect = function (...args) {
      if (this.canvas.id === "campaign-map") window.cartographyTexts = [];
      return clear.apply(this, args);
    };
    proto.fillText = function (text, x, y, ...rest) {
      if (this.canvas.id === "campaign-map") {
        const m = this.getTransform(),
          ratio = this.canvas.width / this.canvas.clientWidth;
        window.cartographyTexts.push({
          text,
          font: this.font,
          size:
            (parseFloat(this.font.match(/([\d.]+)px/)?.[1] ?? "0") *
              Math.hypot(m.a, m.b)) /
            ratio,
          x: m.e / ratio,
          y: m.f / ratio,
        });
      }
      return fill.call(this, text, x, y, ...rest);
    };
  });
  await page.locator("#atlas-search").fill("Nebelstadt");
  await page
    .locator("#atlas-search-results button")
    .filter({ hasText: /^Nebelstadt$/ })
    .click();
  await ready(page);
  results.frames = [];
  for (let i = 0; i < 4; i++) {
    const frame = await page.evaluate(() => ({
      box: JSON.parse(
        document.querySelector("#campaign-map").dataset.atlasView,
      ),
      texts: window.cartographyTexts,
    }));
    results.frames.push(frame);
    const names = frame.texts.filter((t) =>
      /Nebelstadt|Haus am Markt|straße|Lindenweg|Altstadt|Nebelstrom/.test(
        t.text,
      ),
    );
    assert(names.length > 0, "visible scene must have geographic names");
    assert(
      names.every((t) => t.size >= 12 && t.size <= 20.1),
      JSON.stringify(names),
    );
    await page.screenshot({ path: output + "/zoom-" + i + ".png" });
    const b = await page.locator("#campaign-map").boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, i < 2 ? -400 : 1400);
    await ready(page);
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "SaltMarcher")
      .setSize(800, 1000),
  );
  await ready(page);
  await page.screenshot({ path: output + "/narrow.png" });
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "SaltMarcher",
    );
    win.setSize(1600, 1000);
    win.webContents.setZoomFactor(2);
  });
  await ready(page);
  results.enlarged = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    map: (() => {
      const r = document.querySelector("#campaign-map").getBoundingClientRect();
      return { width: r.width, height: r.height };
    })(),
    names: window.cartographyTexts.filter((t) =>
      /Nebelstadt|Haus am Markt|straße|Lindenweg|Altstadt|Nebelstrom/.test(
        t.text,
      ),
    ),
  }));
  assert(results.enlarged.map.width >= 300);
  assert(results.enlarged.names.length > 0);
  assert(results.enlarged.names.every((t) => t.size >= 12 && t.size <= 20.1));
  await writeFile(
    output + "/ui-200-percent.png",
    Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.getTitle() === "SaltMarcher")
            .webContents.capturePage()
        )
          .toPNG()
          .toString("base64"),
      ),
      "base64",
    ),
  );
  await page.locator("#atlas-secondary-close").click();
  await ready(page);
  await writeFile(
    output + "/ui-200-percent-map.png",
    Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.getTitle() === "SaltMarcher")
            .webContents.capturePage()
        )
          .toPNG()
          .toString("base64"),
      ),
      "base64",
    ),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "SaltMarcher")
      .webContents.setZoomFactor(1),
  );
  await page.evaluate(
    (await readFile(root + "/.build/cartography-browser.js", "utf8")) +
      "\nglobalThis.CartographyProbe=CartographyProbe;",
  );
  const native = await page.evaluate(async () => {
    const p = CartographyProbe,
      canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d"),
      measure = p.mapTextMeasurer(ctx),
      state = new p.MapLabelLayout();
    const labels = Array.from({ length: 250 }, (_, i) => ({
      id: String(i),
      text: "Name " + i,
      kind: i % 2 ? "place" : "building",
      point: { x: 60 + (i % 20) * 47, y: 50 + Math.floor(i / 20) * 32 },
      priority: i % 10,
    }));
    const placed = state.layout(
      labels,
      { width: 1024, height: 512 },
      1,
      measure,
    );
    for (let i = 0; i < placed.length; i++)
      for (let j = 0; j < i; j++) {
        const a = placed[i].box,
          b = placed[j].box;
        if (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        )
          throw Error("Native label collision");
      }
    const box = { x: 0, y: 0, width: 1024, height: 400 },
      name = {
        id: "gate",
        text: "Brückentor an der Stadtmauer",
        kind: "place",
        point: { x: 510, y: 200 },
        priority: 80,
      };
    const texts = [],
      original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas.id !== "campaign-map")
        texts.push({ text, width: this.canvas.width });
      return original.call(this, text, ...args);
    };
    let bytes;
    try {
      bytes = await p.atlasImage(
        p.atlasExportTiles(
          box,
          1024,
          400,
          "c",
          1,
          async (part) => {
            const scene = p.atlasPaint("group", {
              mapLabels: [
                p.transformLabel(name, (v) => ({
                  x: v.x - part.x,
                  y: v.y - part.y,
                })),
              ],
            });
            scene.append(
              p.atlasPaint("rect", {
                width: part.width,
                height: part.height,
                style: { fill: "#eee4ce" },
              }),
            );
            return {
              ok: true,
              value: {
                campaignId: "c",
                revision: 1,
                box: part,
                width: part.width,
                height: part.height,
                scene,
              },
            };
          },
          () => true,
        ),
        1024,
        400,
        box,
      );
    } finally {
      CanvasRenderingContext2D.prototype.fillText = original;
    }
    return { placed: placed.length, texts, bytes: Array.from(bytes) };
  });
  assert(native.placed > 30);
  assert.deepEqual(native.texts, [
    { text: "Brückentor an der Stadtmauer", width: 1024 },
  ]);
  await writeFile(output + "/export-seam.png", Buffer.from(native.bytes));
  results.native = { placed: native.placed, exportTexts: native.texts };
  assert.deepEqual(errors, []);
  results.errors = errors;
  const exit = new Promise((resolve) =>
    app.process().once("exit", (code, signal) => resolve({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "SaltMarcher")
      .close(),
  );
  assert.deepEqual(await exit, { code: 0, signal: null });
  closed = true;
  const reopened = new CampaignStore(file);
  try {
    assert.deepEqual(
      reopened.db.prepare("SELECT payload FROM city_unit ORDER BY id").all(),
      original,
    );
  } finally {
    reopened.close();
  }
  results.authorDataUnchanged = true;
  results.normalExit = true;
  await writeFile(output + "/result.json", JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      output,
      frames: results.frames.length,
      native: results.native,
      authorDataUnchanged: true,
    }),
  );
} catch (e) {
  await writeFile(
    output + "/failure.json",
    JSON.stringify({ error: e.stack, errors, results }, null, 2),
  );
  throw e;
} finally {
  if (app && !closed) await app.close();
}
