// Focused isolated Obsidian host check for selection gestures.
// The broad host-test.cjs remains the separate regression suite.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");

const playwrightPath = process.env.DUNGEON_QA_PLAYWRIGHT ||
  "/home/aaron/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const { chromium } = require(playwrightPath);

const root = path.resolve(__dirname, ".."),
  qaRoot = process.env.DUNGEON_FAST_SELECTION_ROOT ||
    "/home/aaron/.cache/dungeon-native-qa/fast-selection",
  runtime = path.join(qaRoot, "runtime"),
  vault = path.join(runtime, "vault"),
  config = path.join(runtime, "config"),
  cache = path.join(runtime, "cache"),
  data = path.join(runtime, "data"),
  debugPort = Number(process.env.DUNGEON_FAST_SELECTION_PORT || 9237),
  run = `${Date.now()}-light-grips`,
  out = path.join(qaRoot, "evidence", run),
  resultFile = path.join(out, "result.json"),
  latestFile = path.join(qaRoot, "latest-result.json"),
  unit = `dungeon-fast-selection-${process.pid}`,
  mapPath = "Dungeons/Schnellauswahl/Karte.dungeon";

const startedAt = Date.now(),
  checks = [],
  cases = [],
  pageErrors = [],
  consoleErrors = [];
let browser,
  page,
  guardTimer,
  failure,
  guardFailure,
  stopping = false,
  finalizePromise,
  minAvailableBytes = Infinity,
  appReadyAt,
  workflowFinishedAt;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const closeEnough = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-7,
    `${message}: ${actual} statt ${expected}`);

function processes() {
  return fs.readdirSync("/proc")
    .filter((entry) => /^\d+$/.test(entry))
    .flatMap((entry) => {
      try {
        return [{
          pid: Number(entry),
          args: fs.readFileSync(`/proc/${entry}/cmdline`, "utf8")
            .replaceAll("\0", " ").trim().split(/\s+/),
        }];
      } catch {
        return [];
      }
    });
}

function isQaObsidian(process) {
  return process.args[0]?.startsWith("/app/obsidian") &&
    process.args.some((arg) =>
      arg.startsWith("--user-data-dir=") &&
      arg.includes("/dungeon-native-qa/"));
}

function ownObsidianProcesses() {
  const expected = `--user-data-dir=${path.join(config, "obsidian")}`;
  return processes().filter((process) =>
    process.args[0]?.startsWith("/app/obsidian") &&
    process.args.includes(expected));
}

function memoryPressure() {
  const meminfo = fs.readFileSync("/proc/meminfo", "utf8"),
    pressure = fs.readFileSync("/proc/pressure/memory", "utf8"),
    available = Number(meminfo.match(/^MemAvailable:\s+(\d+)/m)[1]) * 1024,
    fullTotal = Number(pressure.match(/^full .*total=(\d+)/m)[1]);
  minAvailableBytes = Math.min(minAvailableBytes, available);
  return { time: Date.now(), available, fullTotal };
}

function prepare() {
  assert(fs.existsSync(path.join(root, "main.js")), "Gebautes main.js fehlt");
  assert(fs.existsSync(path.join(root, "manifest.json")), "manifest.json fehlt");
  assert(fs.existsSync(path.join(root, "styles.css")), "styles.css fehlt");
  assert(!processes().some(isQaObsidian),
    "Andere Obsidian-QA-Instanz aktiv; Schnelltest nicht gestartet");

  fs.rmSync(runtime, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const pluginDir = path.join(vault, ".obsidian/plugins/dungeon-editor");
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(path.join(config, "obsidian"), { recursive: true });
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  for (const file of ["main.js", "manifest.json", "styles.css"])
    fs.copyFileSync(path.join(root, file), path.join(pluginDir, file));

  fs.writeFileSync(path.join(vault, ".obsidian/community-plugins.json"),
    JSON.stringify(["dungeon-editor"]));
  fs.writeFileSync(path.join(vault, ".obsidian/app.json"), "{}");
  fs.writeFileSync(path.join(vault, ".obsidian/core-plugins.json"),
    JSON.stringify({ "file-explorer": true, "command-palette": true }));
  fs.writeFileSync(path.join(config, "obsidian/obsidian.json"), JSON.stringify({
    vaults: { fastselection: { path: vault, ts: Date.now(), open: true } },
  }));

  const fullMapPath = path.join(vault, mapPath);
  fs.mkdirSync(path.dirname(fullMapPath), { recursive: true });
  fs.writeFileSync(fullMapPath, JSON.stringify({
    format: "dungeon-map",
    version: 1,
    id: "fast-selection-light-grips",
    settings: {
      name: "Schnellauswahl",
      width: 12,
      height: 8,
      feetPerField: 5,
      wallShadows: false,
      objectShadows: false,
      buildingWear: 0,
    },
    floors: [{
      id: "floor-1",
      name: "Erdgeschoss",
      elevation: 0,
      ambient: 1,
    }],
    entities: [
      {
        id: "light-1",
        kind: "light",
        floorId: "floor-1",
        x: 6,
        y: 4,
        radius: 1.5,
        intensity: 1,
        color: 0xeccd8b,
        shadows: false,
      },
      {
        id: "object-1",
        kind: "object",
        floorId: "floor-1",
        x: 4,
        y: 2,
        rotation: 0,
        width: 1,
        height: 1,
        color: 0x6688aa,
        label: "",
        layer: 100,
        flip: false,
      },
    ],
    content: { definitions: [], occurrences: [], routes: [], archive: [] },
  }, null, 2));

  const main = fs.readFileSync(path.join(root, "main.js"));
  fs.writeFileSync(path.join(out, "build.json"), JSON.stringify({
    sha256: crypto.createHash("sha256").update(main).digest("hex"),
    bytes: main.length,
    modifiedAt: fs.statSync(path.join(root, "main.js")).mtime.toISOString(),
    scope: "isolated Obsidian light-selection grips at 50, 75 and 100 percent",
  }, null, 2));
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(guardTimer);
  if (page && !page.isClosed()) {
    try {
      const ownsPage = await page.evaluate((expected) =>
        typeof app !== "undefined" && app.vault?.adapter?.basePath === expected,
      vault);
      if (ownsPage)
        await page.evaluate(() =>
          setTimeout(() => window.electron.remote.app.quit(), 0));
    } catch {}
  }
  for (let attempt = 0; attempt < 40 && ownObsidianProcesses().length; attempt++)
    await sleep(100);
  for (const entry of ownObsidianProcesses()) {
    try {
      process.kill(entry.pid, "SIGTERM");
    } catch {}
  }
  await browser?.close().catch(() => {});
  try {
    cp.execFileSync("systemctl", ["--user", "stop", `${unit}.service`], {
      stdio: "ignore",
      timeout: 5000,
    });
  } catch {}
}

function result() {
  const endedAt = Date.now();
  return {
    run,
    resultFile,
    passed: !failure && !guardFailure && pageErrors.length === 0,
    checks,
    cases,
    pageErrors,
    consoleErrors,
    failure: failure ? String(failure.stack || failure) : null,
    guardFailure,
    timingsMs: {
      startup: appReadyAt ? appReadyAt - startedAt : null,
      gestures: workflowFinishedAt && appReadyAt
        ? workflowFinishedAt - appReadyAt : null,
      total: endedAt - startedAt,
    },
    minAvailableBytes: Number.isFinite(minAvailableBytes)
      ? minAvailableBytes : null,
    limitations: [
      "Synthetische Zeigergesten; keine physische Maus- oder Touchpadabnahme.",
      "Kleine isolierte Karte; keine Großkarten-, Speicher-, Save- oder Reopen-Regression.",
      "Prüft das aktuell gebaute main.js; die vollständige host-test.cjs-Regression bleibt separat.",
    ],
  };
}

function finalize() {
  if (!finalizePromise)
    finalizePromise = (async () => {
      await shutdown();
      const summary = result();
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(resultFile, JSON.stringify(summary, null, 2));
      fs.mkdirSync(qaRoot, { recursive: true });
      fs.writeFileSync(latestFile, JSON.stringify(summary, null, 2));
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      if (!summary.passed) process.exitCode = 1;
    })();
  return finalizePromise;
}

async function waitForDebugEndpoint() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  assert.fail("Obsidian-Debugschnittstelle nicht erreichbar");
}

async function launch() {
  const display = process.env.DISPLAY || ":0",
    xauthority = process.env.XAUTHORITY ||
      `/run/user/${process.getuid()}/xauth_BvBKvn`;
  cp.execFileSync("systemd-run", [
    "--user",
    "--expand-environment=no",
    `--unit=${unit}`,
    "--collect",
    `--setenv=DISPLAY=${display}`,
    `--setenv=XAUTHORITY=${xauthority}`,
    "flatpak",
    "run",
    `--env=XDG_CONFIG_HOME=${config}`,
    `--env=XDG_CACHE_HOME=${cache}`,
    `--env=XDG_DATA_HOME=${data}`,
    "md.obsidian.Obsidian",
    `--user-data-dir=${path.join(config, "obsidian")}`,
    `--remote-debugging-port=${debugPort}`,
    "--remote-debugging-address=127.0.0.1",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ], { stdio: "inherit" });
  await waitForDebugEndpoint();
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  for (let attempt = 0; attempt < 80; attempt++) {
    page = browser.contexts().flatMap((context) => context.pages())
      .find((candidate) => candidate.url().startsWith("app://obsidian.md/"));
    if (page) break;
    await sleep(100);
  }
  assert(page, "Obsidian-Fenster fehlt");
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.waitForFunction((expected) =>
    typeof app !== "undefined" &&
    app.vault?.adapter?.basePath === expected &&
    app.workspace?.layoutReady,
  vault, { timeout: 30000 });
  if (!(await page.evaluate(() => !!app.plugins.getPlugin("dungeon-editor"))))
    await page.getByRole("button", {
      name: "Dem Ersteller vertrauen und Erweiterungen aktivieren",
      exact: true,
    }).click();
  await page.waitForFunction(() => !!app.plugins.getPlugin("dungeon-editor"),
    null, { timeout: 5000 });
  await page.setViewportSize({ width: 1120, height: 840 });
  await page.bringToFront();
  appReadyAt = Date.now();
}

function editorState() {
  return page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor;
    if (!editor) return null;
    const light = editor.session.entities.get("light-1");
    return {
      selected: [...editor.selection],
      light: light ? {
        x: light.x,
        y: light.y,
        radius: light.radius,
        intensity: light.intensity,
        rotation: light.rotation ?? 0,
      } : null,
      frame: editor.renderer.selectionLightFrame ?? null,
      scale: editor.renderer.camera.scale,
      history: editor.session.historySize,
      dirty: editor.session.dirty,
    };
  });
}

async function worldPoint(x, y) {
  return page.evaluate(({ x, y }) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect();
    return {
      x: box.x + renderer.camera.x + x * renderer.camera.scale,
      y: box.y + renderer.camera.y + y * renderer.camera.scale,
    };
  }, { x, y });
}

async function clickWorld(x, y) {
  const point = await worldPoint(x, y);
  await page.mouse.click(point.x, point.y);
}

async function dragWorld(from, to) {
  const start = await worldPoint(from.x, from.y),
    end = await worldPoint(to.x, to.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
}

async function setZoom(scale) {
  await page.evaluate((target) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    renderer.zoom(target / renderer.camera.scale);
  }, scale);
  await sleep(30);
  closeEnough((await editorState()).scale, scale, "Kameramaßstab");
}

function assertSameLight(actual, expected, label) {
  for (const key of ["x", "y", "radius", "intensity", "rotation"])
    closeEnough(actual[key], expected[key], `${label} ${key}`);
}

async function undoAndVerify(before, history, label) {
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  const undone = await editorState();
  assertSameLight(undone.light, before.light, `${label} Undo`);
  assert.deepEqual(undone.selected, [], `${label}: Undo leert die Auswahl`);
  assert.equal(undone.frame, null, `${label}: Undo verwirft den flüchtigen Rahmen`);
  assert.equal(undone.history, history, `${label}: Undo stellt den Verlauf zurück`);
  assert.equal(undone.dirty, false, `${label}: Undo stellt den sauberen Zustand zurück`);
  return undone;
}

async function selectLight() {
  await clickWorld(6, 4);
  const selected = await editorState();
  assert.deepEqual(selected.selected, ["light-1"]);
  assert.equal(selected.frame.width, 1);
  assert.equal(selected.frame.height, 1);
  return selected;
}

async function scaleGesture(percent, scale, startOffset, delta) {
  const label = `${percent}% Griffskalierung`,
    selected = await selectLight(),
    began = Date.now();
  await dragWorld({ x: 6 + startOffset, y: 4 + startOffset }, {
    x: 6 + startOffset + delta,
    y: 4 + startOffset + delta,
  });
  const changed = await editorState();
  closeEnough(changed.light.x, selected.light.x + delta / 2, `${label} x`);
  closeEnough(changed.light.y, selected.light.y + delta / 2, `${label} y`);
  closeEnough(changed.frame.width, 1 - delta, `${label} Rahmenbreite`);
  closeEnough(changed.frame.height, 1 - delta, `${label} Rahmenhöhe`);
  assert.equal(changed.light.radius, selected.light.radius);
  assert.equal(changed.light.intensity, selected.light.intensity);
  assert.equal(changed.light.rotation, selected.light.rotation);
  assert.equal(changed.history, selected.history + 1);
  const undone = await undoAndVerify(selected, selected.history, label);
  cases.push({
    label,
    scale,
    startOffset,
    pointerDelta: delta,
    changed,
    undone,
    durationMs: Date.now() - began,
  });
  checks.push(`${label}: feste Griffzone skaliert den Rahmen; Undo stellt Licht und UI-Zustand wieder her`);
}

async function moveGesture(percent, scale) {
  const label = `${percent}% Mittelpunktbewegung`,
    selected = await selectLight(),
    delta = 1,
    began = Date.now();
  await dragWorld({ x: 6, y: 4 }, { x: 6 + delta, y: 4 + delta });
  const changed = await editorState();
  closeEnough(changed.light.x, selected.light.x + delta, `${label} x`);
  closeEnough(changed.light.y, selected.light.y + delta, `${label} y`);
  closeEnough(changed.frame.width, 1, `${label} Rahmenbreite`);
  closeEnough(changed.frame.height, 1, `${label} Rahmenhöhe`);
  assert.equal(changed.history, selected.history + 1);
  const undone = await undoAndVerify(selected, selected.history, label);
  cases.push({ label, scale, pointerDelta: delta, changed, undone,
    durationMs: Date.now() - began });
  checks.push(`${label}: die Mitte bleibt außerhalb der Eckgriffe; Undo stellt den Ausgangszustand wieder her`);
}

async function exactLightGripEdge() {
  const label = "50% exakter rechter oberer Griff",
    selected = await selectLight(),
    began = Date.now();
  await dragWorld({ x: 6.5, y: 3.5 }, { x: 6.75, y: 3.25 });
  const changed = await editorState();
  closeEnough(changed.light.x, selected.light.x + 0.125, `${label} x`);
  closeEnough(changed.light.y, selected.light.y - 0.125, `${label} y`);
  closeEnough(changed.frame.width, 1.25, `${label} Rahmenbreite`);
  const undone = await undoAndVerify(selected, selected.history, label);
  cases.push({ label, scale: 32, changed, undone,
    durationMs: Date.now() - began });
  checks.push(`${label}: bei exakt 32 px Abstand von Ecke 0 übernimmt Ecke 1; Undo stellt alles wieder her`);
}

async function retainedLightFrame() {
  const label = "Lichtrahmen nach Wiederwahl",
    selected = await selectLight(),
    began = Date.now();
  await dragWorld({ x: 6.5, y: 4.5 }, { x: 6.75, y: 4.75 });
  const scaled = await editorState();
  closeEnough(scaled.frame.width, 1.25, `${label}: Skalierung`);
  await sleep(4000);
  closeEnough((await editorState()).frame.width, 1.25,
    `${label}: Rahmen bleibt während der Auswahl bestehen`);
  await page.locator('input[aria-label="Objektarten: Objekte"]')
    .evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await clickWorld(4, 2);
  assert.deepEqual((await editorState()).selected, ["object-1"]);
  await clickWorld(scaled.light.x, scaled.light.y);
  const reselected = await editorState();
  assert.deepEqual(reselected.selected, ["light-1"]);
  closeEnough(reselected.frame.width, 1, `${label}: neuer Rahmen`);
  closeEnough(reselected.frame.height, 1, `${label}: neue Rahmenhöhe`);
  assertSameLight(reselected.light, scaled.light, `${label}: Licht unverändert`);
  const undone = await undoAndVerify(selected, selected.history, label);
  cases.push({ label, scale: 64, scaled, reselected, undone,
    durationMs: Date.now() - began });
  checks.push(`${label}: der vergrößerte Rahmen bleibt vier Sekunden erhalten und beginnt nach Fremdauswahl und Wiederwahl normal; Undo stellt das Licht wieder her`);
}

async function workflow() {
  await page.evaluate(async (targetPath) => {
    for (const leaf of app.workspace.getLeavesOfType("dungeon-native-map"))
      leaf.detach();
    await app.workspace.getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(targetPath));
  }, mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count())) {
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
    await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
  }
  await page.locator(".dn-group-rail")
    .getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.locator(".dn-tool-rail")
    .getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.locator('.dn-selection-filter input[type="checkbox"]')
    .evaluateAll((inputs) => {
      for (const input of inputs) {
        const label = input.getAttribute("aria-label");
        if (!label?.startsWith("Objektarten: ") || label === "Objektarten: Alle")
          continue;
        const checked = label === "Objektarten: Lichter";
        if (input.checked !== checked) {
          input.checked = checked;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });

  await setZoom(32);
  await scaleGesture(50, 32, 0, 0.25);
  await exactLightGripEdge();

  await setZoom(48);
  await moveGesture(75, 48);
  await scaleGesture(75, 48, -(0.5 - 21 / 48), -0.25);

  await setZoom(64);
  await moveGesture(100, 64);
  await scaleGesture(100, 64, -(0.5 - 21 / 64), -0.25);
  await retainedLightFrame();

  const final = await editorState();
  assert.deepEqual(final.selected, []);
  assert.equal(final.history, 0);
  assert.equal(final.dirty, false);
  assertSameLight(final.light, {
    x: 6, y: 4, radius: 1.5, intensity: 1, rotation: 0,
  }, "Endzustand");
  checks.push("Alle sieben Gesten enden nach Undo im exakten sauberen Ausgangszustand");
  workflowFinishedAt = Date.now();
}

async function main() {
  prepare();
  let baseline = memoryPressure();
  fs.writeFileSync(path.join(out, "memory.jsonl"), `${JSON.stringify(baseline)}\n`);
  let rejectGuard;
  const guard = new Promise((_, reject) => { rejectGuard = reject; });
  guardTimer = setInterval(() => {
    try {
      const row = memoryPressure(),
        elapsed = row.time - baseline.time;
      fs.appendFileSync(path.join(out, "memory.jsonl"), `${JSON.stringify(row)}\n`);
      if (row.available < 256 * 1048576 ||
        (elapsed >= 2000 && row.fullTotal - baseline.fullTotal > elapsed * 1000 * 0.5)) {
        guardFailure = "Akuter systemweiter Speichermangel";
        rejectGuard(new Error(guardFailure));
      }
      if (elapsed >= 2000) baseline = row;
    } catch (error) {
      rejectGuard(error);
    }
  }, 500);
  await launch();
  await Promise.race([workflow(), guard]);
}

process.on("SIGTERM", () => {
  failure ||= new Error("Externer Timeout oder Abbruch");
  void finalize().finally(() => process.exit(124));
});

(async () => {
  try {
    await main();
  } catch (error) {
    failure = error;
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: path.join(out, "failure.png"), timeout: 4000 });
      } catch {}
    }
  } finally {
    await finalize();
  }
})();
