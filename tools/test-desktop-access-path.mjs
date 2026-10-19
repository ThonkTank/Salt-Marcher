// Native access-path correction: original building, one bend, Undo/Redo, editable JSON, PNG and Fresh.
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { atlasCanvasReady, atlasCanvasPoint } from "./atlas-canvas-probe.mjs";
const root = process.cwd(),
  require = createRequire(root + "/package.json"),
  { _electron } = require("playwright-core"),
  Database = require("better-sqlite3"),
  { PNG } = require("pngjs"),
  out = process.env.QA_EVIDENCE_DIR ?? (await mkdtemp(root + "/.build/access-path-evidence-"));
await mkdir(out, { recursive: true });
assert.equal((await readdir(out)).length, 0, "Use an empty evidence directory.");
require("esbuild").buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {newElement} from './src/app/drawing-model';",
    resolveDir: root,
  },
  outfile: ".build/access-path-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore, newElement } = require(root + "/.build/access-path-store.cjs"),
  source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty = !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  buildHashes = Object.fromEntries(
    await Promise.all(
      ["main.cjs", "ui/renderer.js"].map(async (f) => [
        f,
        createHash("sha256")
          .update(await readFile(root + "/.build/desktop/" + f))
          .digest("hex"),
      ]),
    ),
  );
const launches = [],
  results = [];
let app, page, proxy, db;
async function close() {
  const exited = new Promise((r) => app.process().once("exit", (code, signal) => r({ code, signal })));
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith("/index.html"))
      .close(),
  );
  let timer;
  try {
    const exit = await Promise.race([
      exited,
      new Promise((_, reject) => (timer = setTimeout(() => reject(Error("Normal close timed out")), 10000))),
    ]);
    assert.deepEqual(exit, { code: 0, signal: null });
    launches.at(-1).exit = exit;
    app = null;
  } finally {
    clearTimeout(timer);
  }
}
try {
  for (const scale of [1, 2]) {
    const profile = await mkdtemp("/tmp/access-path-"),
      store = new CampaignStore(profile + "/workbench.sqlite"),
      room = {
        id: randomUUID(),
        scopeId: "local",
        floorId: "ground",
        number: "1",
        name: "Zollhaus",
        revision: 0,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 12.192, y: 0 },
              { x: 12.192, y: 12.192 },
              { x: 0, y: 12.192 },
            ],
            holes: [],
          },
        ],
        sections: [{ id: randomUUID(), kind: "markdown", markdown: "  Erhaltener Grundriss\r\n- Zollschalter" }],
      },
      campaign = store.create("Zugangsweg am Zollhaus", [room]),
      w = store.activate(campaign.id),
      command = (action) => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
    const path = {
      ...newElement("path", "local", "ground", null, [
        { x: -6.096, y: 6.096 },
        { x: 18.288, y: 6.096 },
      ]),
      name: "Zugangsweg",
      notes: "  Am Zollhaus entlang\r\n",
      width: 0.6,
      color: "#b44b22",
    };
    store.executeDrawing(command({ kind: "element", element: path, expectedRevision: null }));
    const binding = store.campaignAtlas(w.token).bindings.find((b) => b.kind === "dungeon" && b.ownerId === "local");
    assert(binding && binding.x === 0 && binding.y === 0 && binding.angle === 0);
    store.tutorial("skipped");
    store.close();
    const bus = profile + "/bus";
    proxy = spawn(
      "xdg-dbus-proxy",
      [
        process.env.DBUS_SESSION_BUS_ADDRESS,
        bus,
        "--filter",
        "--talk=org.freedesktop.portal.Desktop",
        "--talk=org.freedesktop.Notifications",
      ],
      { stdio: "ignore" },
    );
    for (let i = 0; i < 100 && !(await stat(bus).catch(() => null)); i++) await new Promise((r) => setTimeout(r, 20));
    const errors = [];
    const choose = async () => {
      await page.locator("#atlas-search").fill("Zollhaus");
      await page.locator("#atlas-search-results button").filter({ hasText: "Zollhaus" }).click();
      await page.waitForFunction(() => document.getElementById("room-name")?.value === "Zollhaus");
      await atlasCanvasReady(page);
      if (await page.locator("#atlas-secondary").isVisible()) await page.locator("#atlas-secondary-close").click();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await atlasCanvasReady(page);
      const snapshot = new Database(profile + "/workbench.sqlite", { readonly: true });
      const points = JSON.parse(
        snapshot.prepare("SELECT payload FROM drawing_element WHERE id=?").get(path.id).payload,
      ).points;
      snapshot.close();
      const p = await atlasCanvasPoint(
        page,
        { x: points[0].x + (points[1].x - points[0].x) * 0.15, y: points[0].y + (points[1].y - points[0].y) * 0.15 },
        false,
      );
      await page.mouse.click(p.x, p.y);
      await page.waitForFunction(() => document.getElementById("drawing-element-name").value === "Zugangsweg");
      await atlasCanvasReady(page);
    };
    async function launch() {
      app = await _electron.launch({
        executablePath: root + "/node_modules/electron/dist/electron",
        args: [
          root + "/.build/desktop/main.cjs",
          "--ozone-platform=x11",
          "--force-device-scale-factor=" + scale,
          "--data-dir",
          profile,
        ],
        env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: "unix:path=" + bus },
      });
      launches.push({ scale, pid: app.process().pid });
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith("/index.html"));
        w.unmaximize();
        w.setContentSize(1400, 1000);
      });
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === "true");
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole("button", { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        () => document.body.classList.contains("has-workspace") && !document.querySelector("main").inert,
      );
      if (await page.locator("#campaign-atlas").isHidden()) {
        if (!(await page.locator("#atlas-tab").isVisible())) await page.locator("#workspace-nav-summary").click();
        await page.locator("#atlas-tab").click();
      }
      await page.locator('button[data-family="interior"]').click();
      await atlasCanvasReady(page);
      await choose();
    }
    await launch();
    if (await page.locator("#atlas-secondary").isVisible()) await page.locator("#atlas-secondary-close").click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Verkleinern", exact: true }).click();
    await atlasCanvasReady(page);
    db = new Database(profile + "/workbench.sqlite", { readonly: true });
    const readPath = () =>
        JSON.parse(db.prepare("SELECT payload FROM drawing_element WHERE id=?").get(path.id).payload),
      readRoom = () => db.prepare("SELECT * FROM room WHERE id=?").get(room.id),
      originalPath = readPath(),
      originalRoom = readRoom();
    async function until(check) {
      const end = Date.now() + 20000;
      while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
      assert(check(), "Expected confirmed source state");
    }
    async function png(label) {
      await page.locator("#atlas-output-open").click();
      if (!(await page.locator("#atlas-export-size").isVisible()))
        await page.locator("#atlas-output details summary").click();
      await page.locator("#atlas-export-size").fill("1536");
      await page.locator("#atlas-export-format").selectOption("png");
      await page.locator("#atlas-export-audience").selectOption("gm");
      await page.locator("#atlas-export-grid").uncheck();
      const box = JSON.parse(await page.locator("#campaign-map").getAttribute("data-atlas-view")),
        file = out + "/" + scale + "-" + label + ".png";
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      }, file);
      await page.locator("#atlas-export-png").click();
      await until(() => {
        try {
          return require("node:fs").statSync(file).size > 100;
        } catch {
          return false;
        }
      });
      await page.waitForFunction(() => !document.getElementById("atlas-export-png").disabled);
      const data = PNG.sync.read(await readFile(file)),
        red = (p) => {
          const x = Math.round(((p.x - box.x) / box.width) * data.width),
            y = Math.round(((p.y - box.y) / box.height) * data.height);
          let count = 0;
          for (let dx = -3; dx <= 3; dx++)
            for (let dy = -3; dy <= 3; dy++) {
              const i = ((y + dy) * data.width + x + dx) * 4;
              if (
                data.data[i] > 100 &&
                data.data[i] > data.data[i + 1] * 1.4 &&
                data.data[i + 1] > data.data[i + 2] * 1.2
              )
                count++;
            }
          return count;
        };
      const pixels = { old: red({ x: 6.096, y: 6.096 }), bend: red({ x: 6.096, y: -9.144 }) };
      await page.locator("#atlas-output-back").click();
      return pixels;
    }
    const before = await png("crossing");
    assert(before.old > 0);
    assert.equal(before.bend, 0);
    if (await page.locator("#atlas-secondary").isVisible()) await page.locator("#atlas-secondary-close").click();
    const start = await atlasCanvasPoint(page, { x: 6.096, y: 6.096 }, false),
      end = await atlasCanvasPoint(page, { x: 6.096, y: -9.144 }, false);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
    await until(() => readPath().points.length === 3);
    const corrected = readPath();
    assert.deepEqual(corrected.points, [path.points[0], { x: 6.096, y: -9.144 }, path.points[1]]);
    assert.deepEqual(readRoom(), originalRoom);
    for (const key of ["id", "name", "notes", "scopeId", "floorId", "width", "color"])
      assert.deepEqual(corrected[key], originalPath[key]);
    await page.locator("#atlas-undo").click();
    await until(() => JSON.stringify(readPath().points) === JSON.stringify(originalPath.points));
    assert.deepEqual(readRoom(), originalRoom);
    await page.locator("#atlas-redo").click();
    await until(() => JSON.stringify(readPath().points) === JSON.stringify(corrected.points));
    assert.deepEqual(readRoom(), originalRoom);
    await atlasCanvasReady(page);
    const after = await png("corrected");
    assert.equal(after.old, 0);
    assert(after.bend > 0);
    if (await page.locator("#atlas-secondary").isHidden()) await page.locator("#atlas-context-toggle").click();
    await page.getByText("Archiv und Ausgabe", { exact: true }).click();
    await page.locator("#drawing-public-export").uncheck();
    const editable = out + "/" + scale + "-editable.json";
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, editable);
    await page.locator("#drawing-export-json").click();
    await until(() => {
      try {
        return require("node:fs").statSync(editable).size > 100;
      } catch {
        return false;
      }
    });
    const document = JSON.parse(await readFile(editable, "utf8"));
    assert.deepEqual(
      document.view.elements.find((e) => e.id === path.id),
      readPath(),
    );
    assert.deepEqual(
      document.rooms.find((r) => r.id === room.id),
      room,
    );
    await page.screenshot({ path: out + "/" + scale + "-edited.png" });
    const savedPath = readPath();
    db.close();
    db = null;
    await close();
    await launch();
    assert.equal(await page.locator("#drawing-element-points").isEnabled(), true);
    db = new Database(profile + "/workbench.sqlite", { readonly: true });
    assert.deepEqual(readPath(), savedPath);
    assert.deepEqual(readRoom(), originalRoom);
    db.close();
    db = null;
    await close();
    proxy.kill();
    proxy = null;
    assert.deepEqual(errors, []);
    results.push({
      scale,
      profile,
      before,
      after,
      points: corrected.points,
      buildingBytesPreserved: true,
      metadataPreserved: true,
      undoRedo: true,
      editableExport: true,
      fresh: true,
    });
  }
  await writeFile(out + "/result.json", JSON.stringify({ source, dirty, buildHashes, launches, results }, null, 2));
  console.log(JSON.stringify({ source, launches, results }));
} catch (e) {
  if (page) await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  throw e;
} finally {
  db?.close();
  if (app) {
    const proc = app.process(),
      timer = setTimeout(() => proc.kill("SIGKILL"), 5000);
    try {
      await app.close().catch(() => {});
    } finally {
      clearTimeout(timer);
    }
  }
  proxy?.kill();
}
