// Isolated native Obsidian test. No fixed CPU, RAM, swap or admission limits.
// User authorization 2026-10-02 supersedes the old launch guard.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const {
  chromium,
} = require("/home/aaron/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { PNG } = require("pngjs");
const { prepareLarge } = require("./large-fixture.cjs");
const dd041HostNavigation = require("./dd041-host-navigation.cjs");
const { createGroupRecord } = require("./group-record.cjs");
const { loadGroups } = require("./group-catalog.cjs");
const root = path.resolve(__dirname, ".."),
  pluginRoot = process.env.DUNGEON_PLUGIN_ROOT || root,
  sourceVault = process.env.DUNGEON_SOURCE_VAULT || path.resolve(root, "../../.."),
  qa = process.env.DUNGEON_QA_ROOT || "/home/aaron/.cache/dungeon-native-qa",
  vault = qa + "/vault",
  debugPort = Number(process.env.DUNGEON_QA_PORT || 9226);
const restart = process.argv.includes("--restart"),
  groupArgument = process.argv.indexOf("--group"),
  activeGroupId = groupArgument < 0 ? null : process.argv[groupArgument + 1],
  v2Open = process.argv.includes("--v2-open"),
  patternOutline = process.argv.includes("--pattern-outline"),
  patternAlpha = process.argv.includes("--pattern-alpha") || patternOutline,
  prefabForget = process.argv.includes("--prefab-forget"),
  objectAlpha = process.argv.includes("--object-alpha"),
  pathLibrary = process.argv.includes("--path-library"),
  nativePathDialog = process.argv.includes("--native-path-dialog"),
  dd041Navigation = process.argv.includes("--dd041-navigation"),
  dd041PanOnly = process.argv.includes("--pan-only"),
  large = process.argv.includes("--large"),
  compactSmoke = process.argv.includes("--compact-smoke"),
  selectionSmoke = process.argv.includes("--selection-smoke"),
  run = Date.now() + (activeGroupId ? `-${activeGroupId}` : nativePathDialog ? "-native-path-dialog" : v2Open ? "-v2-open" : patternAlpha ? "-pattern-alpha" : prefabForget ? "-prefab-forget" : objectAlpha ? "-object-alpha" : pathLibrary ? "-path-library" : dd041Navigation ? dd041PanOnly ? "-dd041-pan" : "-dd041-navigation" : selectionSmoke ? "-selection" : compactSmoke ? "-compact" : large ? "-large" : "") + (restart ? "-reopen" : "-edit"),
  out = qa + "/evidence/" + run;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitForFileAbsent = async (file, timeoutMs = 12000) => {
  const deadline = Date.now() + timeoutMs;
  while (fs.existsSync(file)) {
    if (Date.now() >= deadline)
      throw new Error("Gespeicherter Entwurf wurde nicht entfernt: " + file);
    await sleep(50);
  }
};
let browser,
  page,
  timer,
  scope,
  stopping = false,
  guardFailure,
  groupResult,
  nativePathDialogResult;
if (activeGroupId && !/^[a-z0-9-]+$/.test(activeGroupId))
  throw new Error(`Ungültige Gruppenkennung: ${activeGroupId}`);
const checks = [],
  errors = [];
let peak = 0;
const unit = "dungeon-native-" + process.pid;
const toolNavigation = {
  Auswahl: ["Auswahl", "Auswahl"],
  Verschieben: ["Auswahl", "Hand"],
  Raum: ["Bauwerk", "Rechteck"],
  Polygonraum: ["Bauwerk", "Polygon"],
  Ellipsenraum: ["Bauwerk", "Ellipse"],
  Gang: ["Bauwerk", "Gang"],
  Wand: ["Bauwerk", "Wände"],
  Tür: ["Bauwerk", "Durchgänge"],
  Dach: ["Bauwerk", "Dächer"],
  Höhle: ["Bauwerk", "Höhle"],
  Muster: ["Bauwerk", "Musterflächen"],
  Material: ["Gelände", "Materialpinsel"],
  Wasser: ["Gelände", "Wasser"],
  Terrain: ["Gelände", "Terrain"],
  Pfad: ["Gelände", "Pfade"],
  Möbel: ["Objekte", "Objekte platzieren"],
  Baustein: ["Objekte", "Zeichenvorlagen"],
  Streuen: ["Objekte", "Streuen"],
  Licht: ["Beleuchtung", "Lichtquelle"],
};
const navigate = async (group, item) => {
  await page
    .locator(".dn-group-rail")
    .getByRole("button", { name: group, exact: true })
    .click();
  await page
    .locator(".dn-tool-rail")
    .getByRole("button", { name: item, exact: true })
    .click();
};
const ensureMaximized = async () => {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count())) {
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
    await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
  }
};
const chooseTool = async (label) => {
  await ensureMaximized();
  await navigate(...toolNavigation[label]);
};
const editorAction = (label) =>
  navigate(
    ...{
      Assets: ["Dungeon", "Bibliothek"],
      Karte: ["Dungeon", "Einstellungen"],
      Vorlage: ["Dungeon", "Vorlagen"],
      Generator: ["Dungeon", "Assistent"],
      Inhalte: ["Inhalte", "Dungeon-Inhalte"],
      Geschosse: ["Dungeon", "Geschosse"],
    }[label],
  );
const selectionKinds = (...labels) =>
  page
    .locator('.dn-selection-filter input[type="checkbox"]')
    .evaluateAll((inputs, labels) => {
      for (const input of inputs) {
        const label = input.getAttribute("aria-label");
        if (!label?.startsWith("Objektarten: ") || label === "Objektarten: Alle")
          continue;
        const checked = labels.includes("Alle") ||
          labels.includes(label.slice("Objektarten: ".length));
        if (input.checked !== checked) {
          input.checked = checked;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }, labels);
function processes() {
  return fs
    .readdirSync("/proc")
    .filter((p) => /^\d+$/.test(p))
    .flatMap((p) => {
      try {
        return [
          {
            pid: Number(p),
            args: fs
              .readFileSync("/proc/" + p + "/cmdline", "utf8")
              .replaceAll("\0", " ")
              .trim()
              .split(/\s+/),
            group: fs
              .readFileSync("/proc/" + p + "/cgroup", "utf8")
              .trim()
              .split(":")
              .at(-1),
          },
        ];
      } catch {
        return [];
      }
    });
}
function telemetry() {
  const mem = fs.readFileSync("/proc/meminfo", "utf8"),
    psi = fs.readFileSync("/proc/pressure/memory", "utf8");
  const available = Number(mem.match(/^MemAvailable:\s+(\d+)/m)[1]) * 1024,
    total = Number(psi.match(/^full .*total=(\d+)/m)[1]);
  const app = processes().find(
    (p) =>
      p.args[0]?.startsWith("/app/obsidian") &&
      p.args.some((a) => a === "--user-data-dir=" + qa + "/config/obsidian"),
  );
  if (app) scope = app.group;
  let current = 0,
    details = {};
  if (scope)
    try {
      const base = "/sys/fs/cgroup" + scope;
      current = Number(fs.readFileSync(base + "/memory.current", "utf8"));
      details = Object.fromEntries(
        fs
          .readFileSync(base + "/memory.stat", "utf8")
          .trim()
          .split("\n")
          .filter((l) => /^(anon|file|shmem) /.test(l))
          .map((l) => {
            const [k, v] = l.split(" ");
            return [k, Number(v)];
          }),
      );
    } catch {}
  peak = Math.max(peak, current);
  return { time: Date.now(), available, total, current, ...details };
}
function prepare() {
  if (!restart) {
    fs.rmSync(vault + "/Dungeons", { recursive: true, force: true });
    fs.rmSync(vault + "/.obsidian/workspace.json", { force: true });
    if (patternAlpha || prefabForget || objectAlpha || pathLibrary || nativePathDialog)
      fs.rmSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", { force: true });
    if (pathLibrary)
      fs.rmSync(vault + "/.obsidian/dungeon-editor-assets", { recursive: true, force: true });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(vault + "/.obsidian/plugins/dungeon-editor", {
    recursive: true,
  });
  fs.mkdirSync(qa + "/config/obsidian", { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"])
    fs.copyFileSync(
      pluginRoot + "/" + f,
      vault + "/.obsidian/plugins/dungeon-editor/" + f,
    );
  fs.writeFileSync(
    vault + "/.obsidian/community-plugins.json",
    JSON.stringify(["dungeon-editor"]),
  );
  fs.writeFileSync(vault + "/.obsidian/app.json", "{}");
  fs.writeFileSync(
    vault + "/.obsidian/core-plugins.json",
    JSON.stringify({ "file-explorer": true, "command-palette": true }),
  );
  fs.writeFileSync(
    qa + "/config/obsidian/obsidian.json",
    JSON.stringify({
      vaults: { fedcba9876543210: { path: vault, ts: Date.now(), open: true } },
    }),
  );
  if (large && !restart) prepareLarge(vault);
  if (compactSmoke) {
    const dungeon = "Dungeons/Drachenhöhle/Karte.dungeon";
    fs.mkdirSync(path.dirname(vault + "/" + dungeon), { recursive: true });
    fs.copyFileSync(path.resolve(sourceVault, dungeon), vault + "/" + dungeon);
  }
  if (v2Open && !restart) {
    for (const dungeon of ["Dungeons/Drachenhöhle/Karte.dungeon", "Dungeons/test/Karte.dungeon"]) {
      fs.mkdirSync(path.dirname(vault + "/" + dungeon), { recursive: true });
      fs.copyFileSync(path.resolve(sourceVault, dungeon), vault + "/" + dungeon);
    }
  }
  if (selectionSmoke && !restart) {
    fs.rmSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", {force:true});
    const dungeon = "Dungeons/Auswahl/Karte.dungeon";
    fs.mkdirSync(path.dirname(vault + "/" + dungeon), { recursive: true });
    fs.writeFileSync(vault + "/" + dungeon, JSON.stringify({
      format: "dungeon-map", version: 1, id: "selection-smoke",
      settings: {name: "Auswahlprobe",width: 12,height: 8,feetPerField: 5,wallShadows: false,objectShadows: false,buildingWear: 0},
      floors: [{id: "floor-1",name: "Erdgeschoss",elevation: 0,ambient: 1}],
      entities: [
        {id: "object-1",kind: "object",floorId: "floor-1",x: 3,y: 3,rotation: 0,width: 2,height: 1.5,color: 0x6688aa,label: "",layer: 100,flip: false},
        {id: "object-2",kind: "object",floorId: "floor-1",x: 6,y: 3,rotation: 0,width: 2,height: 1.5,color: 0xaa8866,label: "",layer: 100,flip: false},
        {id: "light-1",kind: "light",floorId: "floor-1",x: 9,y: 3,radius: 1.5,intensity: 1,color: 0xeccd8b,shadows: false},
        {id: "material-1",kind: "surface",floorId: "floor-1",category: "material",
          polygons: [{outer: [{x:9,y:5},{x:11,y:5},{x:11,y:7},{x:9,y:7}],holes: []}],
          layer: -400,color: 0xc37436,wallColor: 0,wallWidth: 0},
      ],
      content: {definitions: [],occurrences: [],routes: [],archive: []},
    }, null, 2));
  }
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  if (page && !page.isClosed())
    try {
      if (
        await page.evaluate(
          (expected) =>
            typeof app !== "undefined" &&
            app.vault?.adapter?.basePath === expected,
          vault,
        )
      ) {
        await page.evaluate(() =>
          setTimeout(() => window.electron.remote.app.quit(), 0),
        );
        await sleep(700);
      }
    } catch {}
  for (let i = 0; i < 30; i++) {
    if (
      !processes().some((p) =>
        p.args.some((a) => a === "--user-data-dir=" + qa + "/config/obsidian"),
      )
    )
      break;
    await sleep(100);
  }
  const remaining = processes().filter(
    (p) =>
      p.args[0]?.startsWith("/app/obsidian") &&
      p.args.some((a) => a === "--user-data-dir=" + qa + "/config/obsidian"),
  );
  for (const p of remaining) {
    try {
      process.kill(p.pid, "SIGTERM");
      errors.push("Application required termination");
    } catch {}
  }
  if (remaining.length) await sleep(1000);
  await browser?.close().catch(() => {});
  if (scope) {
    try {
      cp.execFileSync(
        "systemctl",
        ["--user", "stop", scope.split("/").at(-1)],
        { stdio: "ignore", timeout: 5000 },
      );
    } catch {}
  }
  try {
    cp.execFileSync("systemctl", ["--user", "stop", unit + ".service"], {
      stdio: "ignore",
      timeout: 5000,
    });
  } catch {}
}
process.on("SIGTERM", () => {
  guardFailure = "External timeout or termination";
  void shutdown().finally(() => process.exit(1));
});
async function main() {
  assert(
    !processes().some(
      (p) =>
        p.args[0]?.startsWith("/app/obsidian") &&
        p.args.some((a) => a === "--user-data-dir=" + qa + "/config/obsidian"),
    ),
    "Existing QA app; test not launched",
  );
  prepare();
  fs.writeFileSync(
    out + "/build.json",
    JSON.stringify({
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(pluginRoot + "/main.js"))
        .digest("hex"),
      mode: (activeGroupId ? `group-${activeGroupId}-` : nativePathDialog ? "native-path-dialog-" : v2Open ? "v2-open-" : patternAlpha ? "pattern-alpha-" : prefabForget ? "prefab-forget-" : objectAlpha ? "object-alpha-" : pathLibrary ? "path-library-" : dd041Navigation ? dd041PanOnly ? "dd041-pan-" : "dd041-navigation-" : selectionSmoke ? "selection-" : compactSmoke ? "compact-" : large ? "large-" : "") + (restart ? "restart" : "edit"),
      memoryPolicy: "normal OS management; only emergency global pressure stop",
    }),
  );
  let baseline = telemetry();
  fs.appendFileSync(out + "/memory.jsonl", JSON.stringify(baseline) + "\n");
  let rejectGuard;
  const guard = new Promise((_, reject) => (rejectGuard = reject));
  timer = setInterval(() => {
    try {
      const row = telemetry();
      fs.appendFileSync(out + "/memory.jsonl", JSON.stringify(row) + "\n");
      const elapsed = row.time - baseline.time;
      if (
        row.available < 256 * 1048576 ||
        (elapsed >= 2000 && row.total - baseline.total > elapsed * 1000 * 0.5)
      ) {
        guardFailure = "Acute system-wide memory shortage";
        rejectGuard(new Error(guardFailure));
      }
      if (elapsed >= 2000) baseline = row;
    } catch (error) {
      rejectGuard(error);
    }
  }, 500);
  cp.execFileSync(
    "systemd-run",
    [
      "--user",
      "--expand-environment=no",
      "--unit=" + unit,
      "--collect",
      "--setenv=DISPLAY=:0",
      "--setenv=XAUTHORITY=/run/user/1000/xauth_BvBKvn",
      "flatpak",
      "run",
      "--env=XDG_CONFIG_HOME=" + qa + "/config",
      "--env=XDG_CACHE_HOME=" + qa + "/cache",
      "--env=XDG_DATA_HOME=" + qa + "/data",
      "md.obsidian.Obsidian",
      "--user-data-dir=" + qa + "/config/obsidian",
      "--remote-debugging-port=" + debugPort,
      "--remote-debugging-address=127.0.0.1",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
    { stdio: "inherit" },
  );
  await Promise.race([workflow(), guard]);
}
async function workflow() {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      ready = (
        await fetch("http://127.0.0.1:" + debugPort + "/json/list", {
          signal: AbortSignal.timeout(500),
        })
      ).ok;
    } catch {}
    if (ready) break;
    await sleep(250);
  }
  assert(ready, "Debug endpoint");
  browser = await chromium.connectOverCDP("http://127.0.0.1:" + debugPort);
  for (let i = 0; i < 80; i++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().startsWith("app://obsidian.md/"));
    if (page) break;
    await sleep(100);
  }
  assert(page, "Obsidian window");
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error")
      fs.appendFileSync(out + "/console.log", e.text() + "\n");
  });
  await page.waitForFunction(
    (expected) =>
      typeof app !== "undefined" &&
      app.vault?.adapter?.basePath === expected &&
      app.workspace?.layoutReady,
    vault,
    { timeout: 90000 },
  );
  fs.writeFileSync(
    out + "/startup.json",
    JSON.stringify(
      await page.evaluate(() => ({
        body: document.body.innerText,
        plugins: Object.keys(app.plugins.manifests),
        enabled: [...app.plugins.enabledPlugins],
        safeMode: app.plugins.safeMode,
      })),
      null,
      2,
    ),
  );
  if (!(await page.evaluate(() => !!app.plugins.getPlugin("dungeon-editor")))) {
    await page
      .getByRole("button", {
        name: "Dem Ersteller vertrauen und Erweiterungen aktivieren",
        exact: true,
      })
      .click();
  }
  await page.waitForFunction(
    () => !!app.plugins.getPlugin("dungeon-editor"),
    null,
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    for (const leaf of app.workspace.getLeavesOfType("dungeon-native-map"))
      leaf.detach();
  });
  fs.writeFileSync(
    out + "/plugin-state.json",
    JSON.stringify(
      await page.evaluate(() => ({
        commands: Object.keys(app.commands.commands).filter((k) =>
          k.includes("dungeon"),
        ),
        pluginKeys: Object.keys(app.plugins.getPlugin("dungeon-editor")),
        pluginType: app.plugins.getPlugin("dungeon-editor")?.constructor?.name,
      })),
      null,
      2,
    ),
  );
  await page.setViewportSize({ width: 1120, height: 840 });
  await page.bringToFront();
  const view = () =>
    page.evaluate(() => {
      const e =
        app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view.editor;
      if (!e) return null;
      return {
        document: e.session.document(),
        notes: Object.fromEntries(
          e.session.draft().notes.map((n) => [n.path, n.current]),
        ),
        dirty: e.session.dirty,
        history: e.session.historySize,
        renderCount: e.renderer.renderCount,
      };
    });
  if (activeGroupId) {
    const group = loadGroups(root).find((item) => item.id === activeGroupId);
    assert(group, `Unknown group: ${activeGroupId}`);
    const scenario = require(`./groups/scenarios/${activeGroupId}.cjs`);
    const build = crypto.createHash("sha256").update(fs.readFileSync(pluginRoot + "/main.js")).digest("hex");
    const record = createGroupRecord(group, out, build, restart ? "reopen" : "edit");
    try {
      await scenario({ page, out, qa, vault, restart, group, record });
    } finally {
      groupResult = record.finish();
    }
    checks.push(`${activeGroupId}: ${groupResult.counts.pass} pass, ${groupResult.counts.fail} fail, ${groupResult.counts.deviation} deviation, ${groupResult.counts.open} open`);
    assert.equal(groupResult.counts.fail, 0, `Group ${activeGroupId} has failing cases`);
    return;
  }
  if (nativePathDialog) {
    const scenario = require("./groups/scenarios/material-pfad-dialog.cjs");
    nativePathDialogResult = await scenario({ page, out, qa, vault, restart });
    checks.push(`DD-021.15 PCK dialog substep: ${nativePathDialogResult.state}`);
    assert.notEqual(nativePathDialogResult.state, "fail", "Native path dialog substep failed");
    return;
  }
  if (v2Open) {
    await v2OpenWorkflow(view);
    return;
  }
  if (patternAlpha) {
    await patternAlphaWorkflow(view);
    return;
  }
  if (prefabForget) {
    await prefabForgetWorkflow(view);
    return;
  }
  if (objectAlpha) {
    await objectAlphaWorkflow(view);
    return;
  }
  if (pathLibrary) {
    await pathLibraryWorkflow(view);
    return;
  }
  if (dd041Navigation) {
    assert(!restart, "DD-041 uses a fresh isolated map in one host run");
    const result = await dd041HostNavigation({ page, out, panOnly: dd041PanOnly });
    checks.push(...result.records.map((entry) =>
      `${entry.caseId} ${entry.name}: ${entry.passed ? "pass" : "deviation"}`));
    assert(result.passed, `DD-041 deviations: ${result.failures.join(", ")}`);
    return;
  }
  if (compactSmoke) {
    await compactWorkflow();
    return;
  }
  if (selectionSmoke) {
    if (restart) await selectionReopenWorkflow();
    else await selectionWorkflow();
    return;
  }
  if (large) {
    await largeWorkflow();
    return;
  }
  const source = qa + "/saved.json";
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(source, "utf8"));
    assert.equal(
      await page.evaluate(
        () =>
          app.plugins.getPlugin("dungeon-editor").toolDefaults().object.assetId,
      ),
      saved.toolDefaultAssetId,
    );
    await page.evaluate(async (p) => {
      await app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(p));
    }, saved.path);
    await page.locator(".dn-canvas canvas").waitFor();
    assert.deepEqual((await view()).document, saved.document);
    assert.equal((await view()).dirty, false);
    for (const [p, contents] of Object.entries(saved.files))
      assert.equal(fs.readFileSync(vault + "/" + p, "utf8"), contents);
    checks.push("Fresh native process opens exact map and Markdown files");
    const roomPath = Object.keys(saved.files).find((p) => p.endsWith(".md"));
    await page.evaluate(async (p) => {
      const file = app.vault.getAbstractFileByPath(p),
        leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "preview" } });
    }, roomPath);
    await page.locator(".markdown-preview-view .dn-map-card canvas").waitFor();
    checks.push(
      "Fresh process renders the native map embedded in the room key",
    );
    await page.evaluate(() => {
      const leaf = app.workspace.getLeavesOfType("dungeon-native-map")[0];
      if (leaf) app.workspace.setActiveLeaf(leaf, { focus: true });
    });
    await editorAction("Assets");
    await page.getByText("Codex QA Own Pack", { exact: true }).waitFor();
    checks.push("Fresh native process retains the imported asset catalogue");
    await page.keyboard.press("Escape");
    await page.screenshot({ path: out + "/reopened.png" });
    return;
  }
  const name = "Ablauf " + run;
  await page.waitForFunction(
    () => !!app.commands.commands["dungeon-editor:create-dungeon"],
    null,
    { timeout: 5000 },
  );
  assert.equal(
    await page.evaluate(() =>
      app.commands.executeCommandById("dungeon-editor:create-dungeon"),
    ),
    true,
    "Creation command accepted",
  );
  const createModal = page.locator(".modal:visible").last(),
    createInputs = createModal.locator("input");
  await createInputs.nth(1).fill("40");
  await createInputs.nth(2).fill("30");
  const presetRow = createModal
    .locator(".setting-item")
    .filter({ hasText: "Aktuelle Größe als Vorlage" });
  await presetRow.locator("input").fill("QA 40 × 30");
  await presetRow.getByRole("button", { name: "Merken", exact: true }).click();
  await page.getByText("Größenvorlage gespeichert.", { exact: true }).waitFor();
  const sizePreset = createModal
    .locator(".setting-item")
    .filter({ hasText: "Größenvorlage" })
    .locator('select:not([aria-hidden="true"])');
  await sizePreset.selectOption({ label: "QA 40 × 30 (40 × 30)" });
  assert.equal(await createInputs.nth(1).inputValue(), "40");
  assert.equal(await createInputs.nth(2).inputValue(), "30");
  await createInputs.nth(0).fill(name);
  await createModal
    .getByRole("button", { name: "Anlegen", exact: true })
    .evaluate((button) => button.click());
  await page.waitForFunction(
    () =>
      !!app.workspace
        .getLeavesOfType("dungeon-native-map")
        .find((leaf) => leaf.view?.editor),
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    const leaf = app.workspace
      .getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view?.editor);
    if (leaf) {
      app.workspace.setActiveLeaf(leaf, { focus: true });
      app.workspace.revealLeaf(leaf);
    }
  });
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  const embeddedLayout = await page.evaluate(() => {
    const root = document.querySelector(".dungeon-native-editor"),
      group = root.querySelector(".dn-group-rail"),
      tool = root.querySelector(".dn-tool-rail"),
      canvas = root.querySelector(".dn-canvas"),
      r = (e) => e.getBoundingClientRect();
    return {
      parent: root.parentElement?.tagName,
      groupFlow: getComputedStyle(group).flexDirection,
      group: r(group),
      tool: r(tool),
      canvas: r(canvas),
      maximized: root.classList.contains("dn-maximized"),
    };
  });
  assert.equal(embeddedLayout.parent, "BODY");
  assert.equal(embeddedLayout.maximized, true);
  assert.ok(embeddedLayout.canvas.height > 100);
  checks.push("Editing opens directly in the maximized editor");
  await ensureMaximized();
  const wideLayout = await page.evaluate(() => {
    const root = document.querySelector(".dungeon-native-editor"),
      group = root.querySelector(".dn-group-rail"),
      tool = root.querySelector(".dn-tool-rail"),
      inspector = root.querySelector(".dn-inspector"),
      canvas = root.querySelector(".dn-canvas"),
      r = (e) => e.getBoundingClientRect();
    return {
      parent: root.parentElement?.tagName,
      groupFlow: getComputedStyle(group).flexDirection,
      group: r(group),
      tool: r(tool),
      inspector: r(inspector),
      canvas: r(canvas),
    };
  });
  assert.equal(wideLayout.parent, "BODY");
  assert.equal(wideLayout.groupFlow, "column");
  assert.ok(
    wideLayout.group.right <= wideLayout.tool.left + 1 &&
      wideLayout.tool.right <= wideLayout.inspector.left + 1 &&
      wideLayout.inspector.right <= wideLayout.canvas.left + 1 &&
      wideLayout.canvas.width > 500,
  );
  checks.push(
    "Optional wide editor keeps the group rail, tool rail, options and map workspace order",
  );
  await editorAction("Assets");
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Pakete wählen", exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles([
    root +
      "/../dungeon-auswertung/tests/fixtures/own-asset-pack/own.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/surface-parts/own-surfaces.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/path-texture-probe/own-path.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/wall-texture-probe/own-walls.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/portal-texture-probe/own-portals.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/light-texture-probe/own-lights.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/wizard-material-probe/own-tileset.dungeondraft_pack",
    root +
      "/../dungeon-auswertung/tests/fixtures/smart-tileset-probe/own-smart-coordinates.dungeondraft_pack",
  ]);
  await page.getByText("Codex QA Own Pack", { exact: true }).waitFor();
  await page.getByText("QA Surface Parts", { exact: true }).waitFor();
  await page.getByText("QA Path Pack", { exact: true }).waitFor();
  await page.getByText("QA Wall Pack", { exact: true }).waitFor();
  await page.getByText("QA Portal Pack", { exact: true }).waitFor();
  await page.getByText("QA Light Pack", { exact: true }).waitFor();
  await page.getByText("QA Wizard Floor", { exact: true }).waitFor();
  await page.getByText("QA Smart Coordinates", { exact: true }).waitFor();
  assert.ok((await view()).document.settings.assetPacks.includes("9cnj0KJ6"));
  assert.match(
    fs.readFileSync(
      vault + "/.obsidian/dungeon-editor-assets/catalog.json",
      "utf8",
    ),
    /9cnj0KJ6/,
  );
  checks.push(
    "Approved Dungeondraft package imports into the persistent lazy asset catalogue",
  );
  await page.keyboard.press("Escape");
  const at = async (p) =>
    page.evaluate((p) => {
      const r =
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
            .renderer,
        b = r.canvas.getBoundingClientRect();
      return {
        x: b.x + r.camera.x + p.x * r.camera.scale,
        y: b.y + r.camera.y + p.y * r.camera.scale,
      };
    }, p);
  const click = async (p) => {
    const q = await at(p);
    await page.mouse.click(q.x, q.y);
  };
  const drag = async (a, b) => {
      a = await at(a);
      b = await at(b);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await page.mouse.up();
    },
    waitForPaint = () =>
      page.waitForFunction(() => {
        const editor =
          app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
        return !!editor && !editor.paintWorker;
      });
  const beforeHand = await view(),
    cameraBeforeHand = await page.evaluate(() => ({
      ...app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .renderer.camera,
    }));
  await chooseTool("Verschieben");
  await drag({ x: 20, y: 15 }, { x: 22, y: 17 });
  const cameraAfterHand = await page.evaluate(() => ({
    ...app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .renderer.camera,
  }));
  assert.notDeepEqual(cameraAfterHand, cameraBeforeHand);
  assert.deepEqual((await view()).document, beforeHand.document);
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  checks.push("Hand tool pans without changing map content");
  await editorAction("Vorlage");
  const imageChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Bild wählen", exact: true }).click();
  const imageChooser = await imageChooserPromise;
  await imageChooser.setFiles(
    root +
      "/../dungeon-auswertung/tests/fixtures/native-pattern-pack/QA Pattern.png",
  );
  await page.waitForFunction(() =>
    app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.document()
      .entities.some((e) => e.kind === "reference"),
  );
  await page.keyboard.press("Escape");
  await chooseTool("Auswahl");
  await click({ x: 20, y: 15 });
  await page
    .getByRole("slider", { name: "Vorlagendeckkraft" })
    .evaluate((el) => {
      el.value = ".3";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await page.getByRole("checkbox", { name: "Sichtbar" }).uncheck();
  await page.getByRole("checkbox", { name: "Sichtbar" }).check();
  await drag({ x: 20, y: 15 }, { x: 22, y: 16 });
  const referenceState = await view(),
    reference = referenceState.document.entities.find(
      (e) => e.kind === "reference",
    );
  assert.equal(reference.x, 22);
  assert.equal(reference.y, 16);
  assert.equal(reference.opacity, 0.3);
  assert.equal(reference.visible, true);
  assert.ok(fs.existsSync(vault + "/" + reference.asset));
  checks.push(
    "Reference image imports once, renders below the map, aligns, hides and edits through normal history",
  );
  const beforeGeneratorIds = new Set(
    referenceState.document.entities.map((e) => e.id),
  );
  await editorAction("Generator");
  await page.getByRole("button", { name: "Generieren", exact: true }).click();
  let generatedState = await view(),
    proposal = generatedState.document.entities.filter(
      (e) => !beforeGeneratorIds.has(e.id),
    );
  assert.equal(
    proposal.filter((e) => e.kind === "surface" && e.category === "pattern")
      .length,
    1,
  );
  assert.equal(proposal.filter((e) => e.kind === "path").length, 1);
  const generatorType = page
    .locator(".setting-item")
    .filter({ hasText: "Generatorart" })
    .locator('select:not([aria-hidden="true"])');
  await generatorType.selectOption("cave");
  await page
    .locator(".setting-item")
    .filter({ hasText: "Startwert" })
    .locator("input")
    .fill("2");
  await page
    .locator(".setting-item")
    .filter({ hasText: "Räume oder Formdetails" })
    .locator("input")
    .fill("18");
  await page
    .getByRole("button", { name: "Neu generieren", exact: true })
    .click();
  generatedState = await view();
  proposal = generatedState.document.entities.filter(
    (e) => !beforeGeneratorIds.has(e.id),
  );
  assert.equal(proposal.length, 1);
  assert.equal(proposal[0].kind, "surface");
  assert.equal(proposal[0].category, "cave");
  await page
    .getByRole("button", { name: "Fertigstellen", exact: true })
    .click();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal(
    (await view()).document.entities.filter(
      (e) => !beforeGeneratorIds.has(e.id) && e.kind === "path",
    ).length,
    1,
  );
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal(
    (await view()).document.entities.filter(
      (e) =>
        !beforeGeneratorIds.has(e.id) &&
        e.kind === "surface" &&
        e.category === "cave",
    ).length,
    1,
  );
  checks.push(
    "Dungeon and cave proposals generate, regenerate, finish and undo as ordinary edits",
  );
  await chooseTool("Raum");
  await page
    .getByRole("combobox", { name: "Paketwand für Räume" })
    .selectOption({ label: "QA Wall" });
  await page
    .getByRole("combobox", { name: "Paketmaterial" })
    .selectOption({ label: "QA Floor" });
  await drag({ x: 4, y: 4 }, { x: 18, y: 15 });
  await page.waitForFunction(() => {
    const entities = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document().entities;
    return entities?.some(
      (entity) => entity.kind === "surface" && entity.category === "floor",
    );
  });
  const drawnFloor = (await view()).document.entities.find(
    (entity) => entity.kind === "surface" && entity.category === "floor",
  );
  assert.equal(drawnFloor.polygons[0].outer.length, 4);

  await drag({ x: 12, y: 10 }, { x: 22, y: 18 });
  await page.waitForFunction((id) => {
    const floors = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document()
      .entities.filter(
        (entity) => entity.kind === "surface" && entity.category === "floor",
      );
    return (
      floors?.length === 1 &&
      floors[0].id === id &&
      Math.max(...floors[0].polygons[0].outer.map((point) => point.x)) === 22
    );
  }, drawnFloor.id);
  await page.keyboard.press("Control+z");
  await page.waitForFunction((id) => {
    const floor = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document()
      .entities.find((entity) => entity.id === id);
    return (
      floor?.kind === "surface" &&
      Math.max(...floor.polygons[0].outer.map((point) => point.x)) === 18
    );
  }, drawnFloor.id);

  await page.keyboard.down("Alt");
  await drag({ x: 7, y: 7 }, { x: 9, y: 9 });
  await page.keyboard.up("Alt");
  await page.waitForFunction((id) => {
    const floor = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document()
      .entities.find((entity) => entity.id === id);
    return floor?.kind === "surface" && floor.polygons[0].holes.length === 1;
  }, drawnFloor.id);
  await page.keyboard.press("Control+z");
  await page.waitForFunction((id) => {
    const floor = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document()
      .entities.find((entity) => entity.id === id);
    return floor?.kind === "surface" && floor.polygons[0].holes.length === 0;
  }, drawnFloor.id);
  await page.keyboard.press("e");
  assert.equal(
    await page.getByRole("combobox", { name: "Modus" }).inputValue(),
    "erase",
  );
  await page.keyboard.press("e");
  checks.push(
    "Rectangle room tool composes overlaps, Alt-erases, toggles E mode and adopts the floor as one numbered room",
  );

  await chooseTool("Gang");
  await click({ x: 25, y: 20 });
  await click({ x: 30, y: 20 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const floors = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document()
      .entities.filter(
        (entity) => entity.kind === "surface" && entity.category === "floor",
      );
    return floors?.length === 2;
  });
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() => {
    const floors = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      ?.view.editor.session.document()
      .entities.filter(
        (entity) => entity.kind === "surface" && entity.category === "floor",
      );
    return floors?.length === 1;
  });
  checks.push("Corridor tool draws a multi-point floor stroke and undoes it");
  await chooseTool("Raum");
  await page.evaluate(async (id) => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    await editor.select(id);
  }, drawnFloor.id);
  await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
  let state = await view();
  assert.equal(
    state.document.entities.filter((e) => e.kind === "room").length,
    1,
  );
  const room = state.document.entities.find((e) => e.kind === "room");
  assert.match(room.wallAssetId, /^pack:/);
  assert.ok(
    state.notes[room.note.path].includes(
      "![[Dungeons/" + name + "/Karte.dungeon]]",
    ),
  );
  checks.push("Normal command and mouse drawing create room plus key");
  if (process.env.DUNGEON_FLOOR_ONLY) return;
  await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("Escape");
  await page
    .locator(".dungeon-native-editor.dn-maximized")
    .waitFor({ state: "detached" });
  assert.equal(await page.locator(".dungeon-native-editor").count(), 0);
  checks.push("Leaving the editor returns to the read-only map layout");
  await page.evaluate(async (path) => {
    const file = app.vault.getAbstractFileByPath(path);
    await app.workspace.getLeaf(true).openFile(file);
  }, `Dungeons/${name}/Karte.dungeon`);
  await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
  await page.getByText("▶ Menü", { exact: true }).click();
  await page.getByRole("button", { name: "Spielansicht", exact: true }).click();
  await page.locator(".dn-play-view .dn-map-viewport canvas").waitFor();
  await page.waitForFunction(
    () =>
      app.workspace.getLeavesOfType("dungeon-native-play")[0]?.view?.card
        ?.loaded === true,
  );
  await page.evaluate(() => {
    for (const leaf of app.workspace.getLeavesOfType("dungeon-native-play"))
      leaf.detach();
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0];
    if (editor) app.workspace.setActiveLeaf(editor, { focus: true });
  });
  await sleep(300);
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.evaluate(async (path) => {
      const file = app.vault.getAbstractFileByPath(path);
      await app.workspace.getLeaf(true).openFile(file);
    }, `Dungeons/${name}/Karte.dungeon`);
  await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  checks.push(
    "Editor maximizes and the read-only game view uses the same live map with room focus",
  );
  await page.evaluate(async (roomId) => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    await editor.select(roomId);
  }, room.id);
  await navigate("Inhalte", "Key bearbeiten");
  const keyLayout = await page.evaluate(() => {
    const dock = document.querySelector(".dn-key-dock"),
      canvas = document.querySelector(".dn-canvas"),
      r = (e) => e.getBoundingClientRect();
    return {
      open: document
        .querySelector(".dungeon-native-editor")
        .classList.contains("dn-key-open"),
      dock: r(dock),
      canvas: r(canvas),
    };
  });
  assert.ok(
    keyLayout.open &&
      keyLayout.dock.width >= 300 &&
      keyLayout.canvas.right <= keyLayout.dock.left + 1,
  );
  checks.push(
    "Key opens in the legacy right dock while the map remains visible",
  );
  const text = page.getByRole("textbox", { name: "Raum-Key bearbeiten" });
  await text.fill(
    (await text.inputValue()) +
      "**Geschützter  Wortlaut.** [[Ziel#Abschnitt|Name]]\n",
  );
  await chooseTool("Tür");
  await page
    .getByRole("combobox", { name: "Paketportal" })
    .selectOption({ label: "QA Door" });
  await page
    .getByRole("textbox", { name: "Beschreibung" })
    .fill("Massive Eichentür");
  await page.getByRole("combobox", { name: "Zustand" }).selectOption("locked");
  await page.getByRole("spinbutton", { name: "SG zum Entdecken" }).fill("15");
  await page.getByRole("checkbox", { name: "Versteckt" }).check();
  await page.getByRole("spinbutton", { name: "HP" }).fill("18");
  await page.getByRole("spinbutton", { name: "RK" }).fill("16");
  await page
    .getByRole("textbox", { name: "Schlüssel-Verweis" })
    .fill("[[Messingschlüssel]]");
  if (
    await page.evaluate(
      () =>
        app.plugins.getPlugin("dungeon-editor").toolDefaults().portal
          .freestanding,
    )
  )
    await page.getByRole("checkbox", { name: "Freistehend" }).click();
  const beforeDoor = await view();
  await click({ x: 10, y: 4 });
  await page.waitForFunction(() =>
    app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.document()
      .entities.some((e) => e.kind === "door"),
  );
  const withDoor = await view(),
    createdDoor = withDoor.document.entities.find((e) => e.kind === "door");
  assert.match(createdDoor.assetId, /^pack:/);
  assert.deepEqual(createdDoor.passage, {
    description: "Massive Eichentür",
    state: "locked",
    hidden: true,
    hiddenDC: 15,
    hp: 18,
    ac: 16,
    key: "[[Messingschlüssel]]",
    direction: "north",
  });
  assert.match(
    withDoor.notes[room.note.path],
    /Norden: Massive Eichentür\. Verschlossen\. Versteckt \(SG 15\)\. 18 HP, RK 16\. Schlüssel: \[\[Messingschlüssel\]\]\./,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.deepEqual((await view()).document, beforeDoor.document);
  assert.deepEqual((await view()).notes, beforeDoor.notes);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.deepEqual((await view()).document, withDoor.document);
  assert.deepEqual((await view()).notes, withDoor.notes);
  checks.push("Native door creation and exact joint map/text undo/redo");
  await page.evaluate(
    ({ floorId, width }) => {
      const editor =
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
        path = {
          id: "qa-portal-alignment-path",
          floorId,
          kind: "path",
          points: [
            { x: 10, y: 1 },
            { x: 10, y: 4 },
          ],
          closed: false,
          smooth: false,
          width,
          style: "road",
          color: 0xa99473,
          outlineColor: 0x625744,
          outlineWidth: 0.12,
          layer: 80,
          start: "square",
          end: "square",
          blocksLight: false,
        };
      editor.session.execute({
        label: "Ausrichtungspfad anlegen",
        entities: [{ id: path.id, before: null, after: path }],
      });
    },
    { floorId: room.floorId, width: createdDoor.width },
  );
  await chooseTool("Auswahl");
  await drag({ x: 10, y: 4 }, { x: 10.42, y: 4 });
  state = await view();
  const alignedDoor = state.document.entities.find(
    (entity) => entity.id === createdDoor.id,
  );
  assert.ok(Math.abs(alignedDoor.at - 0.12) < 1e-6);
  await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      path = editor.session.entities.get("qa-portal-alignment-path");
    editor.session.execute({
      label: "Ausrichtungspfad entfernen",
      entities: [{ id: path.id, before: path, after: null }],
    });
  });
  checks.push(
    "Bound passage dragged near a matching corridor endpoint snaps exactly to its center",
  );
  await chooseTool("Möbel");
  await page
    .getByRole("combobox", { name: "Paketobjekt" })
    .selectOption({ label: "qa_chest" });
  const objectPreview = page.locator('img[alt="Paketobjekt Vorschau"]');
  await objectPreview.waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document.querySelector('img[alt="Paketobjekt Vorschau"]')?.naturalWidth >
      0,
  );
  await page.getByRole("spinbutton", { name: "Drehung in Grad" }).fill("0");
  await page
    .getByRole("spinbutton", { name: "Zeichenreihenfolge" })
    .fill("700");
  await page.getByRole("checkbox", { name: "Schatten" }).uncheck();
  await page.getByRole("checkbox", { name: "Blockiert Licht" }).check();
  await page.getByRole("checkbox", { name: "Horizontal spiegeln" }).check();
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("a");
  await page.keyboard.press("a");
  await page.keyboard.press("]");
  await click({ x: 9, y: 10 });
  await chooseTool("Auswahl");
  await drag({ x: 9, y: 10 }, { x: 13, y: 11 });
  state = await view();
  const object = state.document.entities.find((e) => e.kind === "object");
  assert.match(object.assetId, /^pack:/);
  assert.equal(object.x, 13);
  assert.equal(object.y, 11);
  assert.equal(object.layer, 700);
  assert.equal(object.shadow, false);
  assert.equal(object.blocksLight, true);
  assert.equal(object.flip, true);
  assert.ok(Math.abs(object.rotation - Math.PI / 12) < 1e-9);
  checks.push(
    "Object tool previews and places a package asset, then layers, mirrors, rotates, shadows, blocks light and moves it",
  );
  const beforeCancel = state;
  const a = await at({ x: 13, y: 11 }),
    b = await at({ x: 15, y: 12 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual((await view()).document, beforeCancel.document);
  checks.push("Escape cancels gesture without model mutation");
  await editorAction("Inhalte");
  await page
    .getByRole("button", { name: "Definition anlegen", exact: true })
    .click();
  let modal = page.locator(".modal").last();
  await modal
    .locator(".setting-item")
    .filter({ hasText: /^Name$/ })
    .locator("input")
    .fill("Schattenwache");
  await modal
    .locator(".setting-item")
    .filter({ hasText: "Art" })
    .locator('select:not([aria-hidden="true"])')
    .selectOption("creature");
  await modal
    .locator(".setting-item")
    .filter({ hasText: "XP je Vorkommen" })
    .locator("input")
    .fill("450");
  await modal
    .locator(".setting-item")
    .filter({ hasText: "Beutewert je Vorkommen" })
    .locator("input")
    .fill("75");
  await modal.locator("textarea").fill("Bewacht den Nordausgang");
  const definitionTextInputs = modal.locator('input[type="text"]');
  await definitionTextInputs.nth(3).fill("Torwachen");
  await definitionTextInputs.nth(4).fill("[[Encounter Torwachen]]");
  await definitionTextInputs.nth(5).fill("[[Schattenwache]]");
  await modal.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await page.getByText("Schattenwache", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Vorkommen anlegen", exact: true })
    .click();
  modal = page.locator(".modal").last();
  await modal
    .locator(".setting-item")
    .filter({ hasText: "Menge" })
    .locator("input")
    .fill("3");
  await modal.locator("textarea").nth(0).fill("wartet reglos");
  await modal.locator("textarea").nth(1).fill("greift bei Alarm an");
  await modal
    .getByRole("button", { name: "Vorkommen anlegen", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      app.workspace
        .getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.document().content.occurrences.length === 1,
  );
  await page
    .getByRole("button", { name: "Eingang oder Weg", exact: true })
    .click();
  modal = page.locator(".modal").last();
  await modal
    .locator(".setting-item")
    .filter({ hasText: /^Name$/ })
    .locator("input")
    .fill("Haupteingang");
  await modal
    .locator(".setting-item")
    .filter({ hasText: "Voraussetzungen" })
    .locator("textarea")
    .fill("Siegelstein");
  await modal
    .locator(".setting-item")
    .filter({ hasText: "Bossziel-Reihenfolge" })
    .locator("input")
    .fill("1");
  await modal.getByRole("button", { name: "Übernehmen", exact: true }).click();
  state = await view();
  assert.equal(state.document.content.definitions.length, 1);
  assert.equal(state.document.content.occurrences[0].quantity, 3);
  assert.equal(
    state.document.content.occurrences[0].situation,
    "wartet reglos",
  );
  assert.equal(state.document.content.routes[0].bossGoalOrder, 1);
  assert.match(state.notes[room.note.path], /\*\*Geschützter  Wortlaut\.\*\*/);
  assert.match(state.notes[room.note.path], /## SC · Schattenwache \^feature-/);
  assert.match(
    state.notes[room.note.path],
    /Besetzung: 3× Schattenwache\. Auswertung: 1\.350 XP, Beutewert 225\. Aktuelle Situation: wartet reglos\. Reaktion: greift bei Alarm an\./,
  );
  const featureText = state.notes[room.note.path];
  let occurrenceRow = page
    .locator(".setting-item")
    .filter({ hasText: "SC · Schattenwache" });
  await occurrenceRow.locator('[aria-label="Vorkommen archivieren"]').click();
  state = await view();
  assert.equal(state.document.content.occurrences.length, 0);
  assert.equal(state.document.content.archive.length, 1);
  assert.equal(state.notes[room.note.path], featureText);
  await page
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .click();
  state = await view();
  assert.equal(state.document.content.occurrences.length, 1);
  assert.ok(state.document.entities.some((e) => e.id === object.id));
  const routeRow = page
    .locator(".setting-item")
    .filter({ hasText: "Haupteingang" });
  await routeRow.locator('[aria-label="Weg archivieren"]').click();
  assert.equal((await view()).document.content.routes.length, 0);
  await page
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .click();
  assert.equal((await view()).document.content.routes.length, 1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await view()).document.content.routes.length, 0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await view()).document.content.routes.length, 1);
  checks.push(
    "Structured passages, definitions, occurrences, XP, loot, encounters, readable key prose, routes and linked archive share exact history",
  );
  await chooseTool("Ellipsenraum");
  await page
    .getByRole("combobox", { name: "Paketmaterial" })
    .selectOption({ label: "QA smart" });
  await drag({ x: 22, y: 3 }, { x: 34, y: 12 });
  await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
  assert.equal(
    (await view()).document.entities.filter((e) => e.kind === "room").length,
    2,
  );
  checks.push("Ellipse room tool creates and adopts an editable ellipse");
  await chooseTool("Polygonraum");
  await page
    .getByRole("combobox", { name: "Paketmaterial" })
    .selectOption({ label: "QA smart_double" });
  for (const point of [
    { x: 24, y: 17 },
    { x: 36, y: 17 },
    { x: 37, y: 27 },
    { x: 25, y: 27 },
    { x: 24, y: 17 },
  ])
    await click(point);
  await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
  state = await view();
  assert.equal(
    state.document.entities.filter((e) => e.kind === "room").length,
    3,
  );
  assert.equal(
    new Set(
      state.document.entities
        .filter((e) => e.kind === "room")
        .map((e) => e.material.assetId),
    ).size,
    3,
  );
  checks.push(
    "Polygon room tool closes and adopts an editable free contour with package floor material",
  );
  await chooseTool("Wand");
  await page.getByRole("checkbox", { name: "Kurvige Wand" }).check();
  await page
    .getByRole("spinbutton", { name: "Zeichenreihenfolge" })
    .fill("800");
  await page.getByRole("checkbox", { name: "Schatten" }).uncheck();
  await page
    .getByRole("combobox", { name: "Paketwand" })
    .selectOption({ label: "QA Wall" });
  for (const point of [
    { x: 2, y: 26 },
    { x: 12, y: 20 },
    { x: 22, y: 26 },
  ])
    await click(point);
  await page.keyboard.press("Enter");
  let wall = (await view()).document.entities.find((e) => e.kind === "wall");
  assert.equal(wall.smooth, true);
  assert.equal(wall.points.length, 3);
  assert.equal(wall.layer, 800);
  assert.equal(wall.shadow, false);
  assert.match(wall.assetId, /^pack:/);
  await chooseTool("Tür");
  await page
    .getByRole("combobox", { name: "Portalart" })
    .selectOption("window");
  await page
    .getByRole("combobox", { name: "Paketportal" })
    .selectOption({ label: "QA Window" });
  if (
    await page.evaluate(
      () =>
        app.plugins.getPlugin("dungeon-editor").toolDefaults().portal
          .freestanding,
    )
  )
    await page.getByRole("checkbox", { name: "Freistehend" }).click();
  await click({ x: 12, y: 20 });
  await chooseTool("Tür");
  await page.getByRole("combobox", { name: "Portalart" }).selectOption("bars");
  await page.getByRole("checkbox", { name: "Freistehend" }).click();
  await click({ x: 31, y: 25 });
  state = await view();
  assert.equal(
    state.document.entities.filter((e) => e.kind === "door").length,
    3,
  );
  assert.ok(
    state.document.entities.some(
      (e) =>
        e.kind === "door" && e.variant === "window" && e.boundaryId === wall.id,
    ),
  );
  assert.ok(
    state.document.entities.some(
      (e) => e.kind === "door" && e.variant === "bars" && !e.boundaryId,
    ),
  );
  checks.push(
    "Window binds to a curved wall and freestanding bars keep their own pose",
  );
  await chooseTool("Auswahl");
  await drag({ x: 2, y: 26 }, { x: 2, y: 24 });
  wall = (await view()).document.entities.find((e) => e.kind === "wall");
  assert.equal(wall.points[0].y, 24);
  const insertionTarget = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      e = editor.renderer.hitTest({ x: 6.375, y: 21.625 });
    window.__dungeonDbl = 0;
    editor.renderer.canvas.addEventListener(
      "dblclick",
      () => window.__dungeonDbl++,
      { once: true },
    );
    return e ? { id: e.id, kind: e.kind } : null;
  });
  assert.deepEqual(insertionTarget, { id: wall.id, kind: "wall" });
  const insert = await at({ x: 6.375, y: 21.625 });
  await page.mouse.dblclick(insert.x, insert.y);
  assert.equal(await page.evaluate(() => window.__dungeonDbl), 1);
  wall = (await view()).document.entities.find((e) => e.kind === "wall");
  assert.equal(wall.points.length, 4);
  const remove = await at({ x: 6, y: 22 });
  await page.keyboard.down("Alt");
  await page.mouse.click(remove.x, remove.y);
  await page.keyboard.up("Alt");
  wall = (await view()).document.entities.find((e) => e.kind === "wall");
  assert.equal(wall.points.length, 3);
  checks.push(
    "Wall point move, insertion and removal preserve the bound portal",
  );
  await chooseTool("Wand");
  await page.keyboard.down("Control");
  await click({ x: 22, y: 26 });
  await page.keyboard.up("Control");
  await click({ x: 25, y: 26 });
  await page.keyboard.press("Enter");
  const extendedWall = (await view()).document.entities.find(
    (e) => e.id === wall.id,
  );
  assert.equal(extendedWall.points.length, 4);
  assert.deepEqual(extendedWall.points.at(-1), { x: 25, y: 26 });
  assert.equal(extendedWall.layer, 800);
  assert.equal(extendedWall.shadow, false);
  assert.ok(
    (await view()).document.entities.some(
      (e) => e.kind === "door" && e.boundaryId === extendedWall.id,
    ),
  );
  checks.push(
    "Wall tool continues an existing endpoint with Ctrl while retaining layer, shadow and bound portal",
  );
  await chooseTool("Höhle");
  await page
    .getByRole("spinbutton", { name: "Pinselradius in Feldern" })
    .fill("1");
  await drag({ x: 31, y: 28 }, { x: 34, y: 28 });
  await waitForPaint();
  state = await view();
  const caveId = await page.evaluate(
      () =>
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
          .selected,
    ),
    cave = state.document.entities.find((e) => e.id === caveId),
    caveBeforeErase = JSON.stringify(cave.polygons);
  assert.equal(cave.color, 0xafa99b);
  await page.keyboard.down("Alt");
  await drag({ x: 32, y: 28 }, { x: 33, y: 28 });
  await page.keyboard.up("Alt");
  await waitForPaint();
  state = await view();
  assert.notEqual(
    JSON.stringify(
      state.document.entities.find((e) => e.id === cave.id).polygons,
    ),
    caveBeforeErase,
  );
  await page.keyboard.press("Control+z");
  assert.equal(
    JSON.stringify(
      (await view()).document.entities.find((e) => e.id === cave.id).polygons,
    ),
    caveBeforeErase,
  );
  checks.push("Cave brush paints, Alt-erases and restores one organic surface");

  await chooseTool("Material");
  await page
    .getByRole("combobox", { name: "Paketmaterial" })
    .selectOption({ label: "acid" });
  await drag({ x: 36, y: 2 }, { x: 39, y: 2 });
  await waitForPaint();
  state = await view();
  assert.ok(
    state.document.entities.some(
      (e) =>
        e.kind === "surface" &&
        e.category === "material" &&
        e.material?.assetPart === "tile",
    ),
  );
  checks.push(
    "Material brush paints the selected package material as one stroke",
  );

  await chooseTool("Muster");
  await page
    .getByRole("combobox", { name: "Flächenform" })
    .selectOption("rectangle");
  await drag({ x: 0.5, y: 0.5 }, { x: 3.5, y: 3.5 });
  await page
    .getByRole("combobox", { name: "Flächenform" })
    .selectOption("ellipse");
  await drag({ x: 0.5, y: 5 }, { x: 3.5, y: 8 });
  await page
    .getByRole("combobox", { name: "Flächenform" })
    .selectOption("polygon");
  for (const point of [
    { x: 0.5, y: 10 },
    { x: 3.5, y: 10 },
    { x: 2, y: 13 },
  ])
    await click(point);
  await page.keyboard.press("Enter");
  assert.equal(
    (await view()).document.entities.filter(
      (e) => e.kind === "surface" && e.category === "pattern",
    ).length,
    3,
  );
  checks.push("Pattern tool creates rectangle, ellipse and free polygon");

  await chooseTool("Pfad");
  await page
    .getByRole("combobox", { name: "Paketmaterial" })
    .selectOption({ label: "QA Path" });
  await page.getByRole("combobox", { name: "Pfadart" }).selectOption("rail");
  await page
    .getByRole("spinbutton", { name: "Pfadbreite in Feldern" })
    .fill("1.4");
  await page.getByRole("spinbutton", { name: "Konturbreite" }).fill("0.2");
  await page
    .getByRole("combobox", { name: "Pfadanfang" })
    .selectOption("square");
  await page.getByRole("combobox", { name: "Pfadende" }).selectOption("taper");
  await page.getByRole("checkbox", { name: "Blockiert Licht" }).check();
  for (const point of [
    { x: 19, y: 1 },
    { x: 20, y: 8 },
    { x: 19, y: 15 },
  ])
    await click(point);
  await page.keyboard.press("Enter");
  state = await view();
  const testedPath = state.document.entities.find((e) => e.kind === "path");
  assert.equal(testedPath.style, "rail");
  assert.equal(testedPath.material.assetPart, "image");
  assert.equal(testedPath.width, 1.4);
  assert.equal(testedPath.outlineWidth, 0.2);
  assert.equal(testedPath.start, "square");
  assert.equal(testedPath.end, "taper");
  assert.equal(testedPath.blocksLight, true);
  checks.push(
    "Path tool creates an editable curved package path with width, outline, ends and light blocking",
  );

  await chooseTool("Dach");
  await page
    .getByRole("combobox", { name: "Zeichenmodus" })
    .selectOption("rectangle");
  await page.getByRole("combobox", { name: "Dachform" }).selectOption("gable");
  await drag({ x: 1, y: 16 }, { x: 8, y: 22 });
  await chooseTool("Dach");
  await page
    .getByRole("combobox", { name: "Zeichenmodus" })
    .selectOption("polygon");
  await page.getByRole("combobox", { name: "Dachform" }).selectOption("dormer");
  for (const point of [
    { x: 9, y: 16 },
    { x: 15, y: 17 },
    { x: 14, y: 23 },
    { x: 9, y: 22 },
  ])
    await click(point);
  await page.keyboard.press("Enter");
  state = await view();
  const roofs = state.document.entities.filter((e) => e.kind === "roof");
  assert.equal(roofs.length, 2);
  assert.deepEqual(
    roofs.map((roof) => roof.roofType),
    ["gable", "dormer"],
  );
  assert.equal(roofs[1].points.length, 4);
  checks.push("Roof tool creates quick rectangles and free dormer contours");

  await chooseTool("Wasser");
  await page
    .getByRole("combobox", { name: "Zeichenform" })
    .selectOption("brush");
  await drag({ x: 35, y: 14 }, { x: 39, y: 14 });
  await waitForPaint();
  const waterGeometry = async () =>
      JSON.stringify(
        (await view()).document.entities
          .filter((e) => e.kind === "surface" && e.category === "water")
          .map((e) => e.polygons),
      ),
    waterBrushGeometry = await waterGeometry();
  await page
    .getByRole("combobox", { name: "Zeichenform" })
    .selectOption("rectangle");
  await drag({ x: 35, y: 17 }, { x: 39, y: 19 });
  await waitForPaint();
  const waterRectangleGeometry = await waterGeometry();
  assert.notEqual(waterRectangleGeometry, waterBrushGeometry);
  await page
    .getByRole("combobox", { name: "Zeichenform" })
    .selectOption("ellipse");
  await drag({ x: 35, y: 20 }, { x: 39, y: 22 });
  await waitForPaint();
  const waterEllipseGeometry = await waterGeometry();
  assert.notEqual(waterEllipseGeometry, waterRectangleGeometry);
  await page
    .getByRole("combobox", { name: "Zeichenform" })
    .selectOption("polygon");
  for (const point of [
    { x: 35, y: 23 },
    { x: 39, y: 23 },
    { x: 37, y: 26 },
  ])
    await click(point);
  await page.keyboard.press("Enter");
  await waitForPaint();
  const waterPolygonGeometry = await waterGeometry();
  assert.notEqual(waterPolygonGeometry, waterEllipseGeometry);
  const waterBeforeErase = await waterGeometry();
  await page
    .getByRole("combobox", { name: "Zeichenform" })
    .selectOption("rectangle");
  await page.keyboard.down("Alt");
  await drag({ x: 36, y: 17 }, { x: 38, y: 19 });
  await page.keyboard.up("Alt");
  await waitForPaint();
  assert.notEqual(await waterGeometry(), waterBeforeErase);
  await page.keyboard.press("Control+z");
  assert.equal(await waterGeometry(), waterBeforeErase);
  checks.push(
    "Water tool paints and creates rectangle, ellipse and polygon areas with Alt erase and undo",
  );

  await chooseTool("Terrain");
  await drag({ x: 35, y: 29 }, { x: 39, y: 29 });
  await waitForPaint();
  assert.ok(
    (await view()).document.entities.some(
      (e) => e.kind === "surface" && e.category === "terrain",
    ),
  );
  checks.push("Terrain brush paints and retains its own layer and style");

  await chooseTool("Licht");
  await page
    .getByRole("combobox", { name: "Paketlicht" })
    .selectOption({ label: "QA Light" });
  await page
    .getByRole("spinbutton", { name: "Lichtreichweite in Feldern" })
    .fill("6");
  await page.getByRole("spinbutton", { name: "Lichtstärke" }).fill("1.4");
  await page.locator('input[aria-label="Lichtfarbe"]').fill("#ffaa00");
  await page.getByRole("checkbox", { name: "Schatten" }).uncheck();
  await click({ x: 31, y: 14 });
  state = await view();
  const light = state.document.entities.find((e) => e.kind === "light");
  assert.match(light.assetId, /^pack:/);
  assert.equal(light.radius, 6);
  assert.equal(light.intensity, 1.4);
  assert.equal(light.color, 0xffaa00);
  assert.equal(light.shadows, false);
  checks.push(
    "Light tool places a package light with range, intensity, color and shadow control",
  );
  const objectsBeforeScatter = state.document.entities.filter(
    (e) => e.kind === "object",
  ).length;
  await chooseTool("Streuen");
  await page.getByRole("combobox", { name: "Möbelset" }).selectOption("chest");
  await page
    .getByRole("spinbutton", { name: "Streuabstand in Feldern" })
    .fill("1.5");
  await page
    .getByRole("spinbutton", { name: "Streuradius in Feldern" })
    .fill("0.4");
  await page.getByRole("checkbox", { name: "Zufallsdrehung" }).check();
  await page.getByRole("slider", { name: "Größenabweichung" }).fill("0.3");
  await drag({ x: 10, y: 28 }, { x: 20, y: 28 });
  state = await view();
  const scattered = state.document.entities
    .filter((e) => e.kind === "object")
    .slice(objectsBeforeScatter);
  assert.ok(scattered.length >= 5);
  assert.ok(scattered.some((object) => object.rotation !== 0));
  assert.ok(
    scattered.some(
      (object) =>
        object.width !== scattered[0].width ||
        object.height !== scattered[0].height,
    ),
  );
  checks.push(
    "Scatter tool applies spacing, spread, random rotation and size variation in one deterministic edit",
  );
  await chooseTool("Auswahl");
  await selectionKinds("Objekte");
  await click({ x: 13, y: 11 });
  await page.keyboard.down("Shift");
  await click({ x: scattered[0].x, y: scattered[0].y });
  await page.keyboard.up("Shift");
  await page
    .locator(".dn-menu-content button")
    .filter({ hasText: "Gruppieren" })
    .evaluate((el) => el.click());
  state = await view();
  const grouped = state.document.entities.filter(
    (e) => e.kind === "object" && e.groupId,
  );
  assert.ok(grouped.length >= 2);
  const groupId = grouped[0].groupId,
    groupMembers = grouped.filter((e) => e.groupId === groupId);
  assert.equal(groupMembers.length, 2);
  const memberBefore = groupMembers.map((e) => ({ id: e.id, x: e.x, y: e.y }));
  await drag(
    { x: memberBefore[0].x, y: memberBefore[0].y },
    { x: memberBefore[0].x + 1, y: memberBefore[0].y + 1 },
  );
  state = await view();
  for (const before of memberBefore) {
    const after = state.document.entities.find((e) => e.id === before.id);
    assert.equal(after.x, before.x + 1);
    assert.equal(after.y, before.y + 1);
  }
  await page.keyboard.press("Control+c");
  const objectCountBeforePaste = state.document.entities.filter(
    (e) => e.kind === "object",
  ).length;
  await page.keyboard.press("Control+v");
  state = await view();
  assert.equal(
    state.document.entities.filter((e) => e.kind === "object").length,
    objectCountBeforePaste + 2,
  );
  const pasted = state.document.entities.filter(
    (e) =>
      e.kind === "object" &&
      !memberBefore.some((before) => before.id === e.id) &&
      e.groupId &&
      e.groupId !== groupId,
  );
  assert.equal(pasted.length, 2);
  assert.equal(pasted[0].groupId, pasted[1].groupId);
  await page
    .locator(".dn-menu-content button")
    .filter({ hasText: "Gruppierung lösen" })
    .evaluate((el) => el.click());
  state = await view();
  for (const copy of pasted)
    assert.equal(
      state.document.entities.find((e) => e.id === copy.id).groupId,
      undefined,
    );
  const locked = state.document.entities.find((e) => e.id === pasted.at(-1).id);
  await click({ x: locked.x, y: locked.y });
  await page.getByRole("button", { name: "Sperren", exact: true }).click();
  await drag(
    { x: locked.x, y: locked.y },
    { x: locked.x + 2, y: locked.y + 2 },
  );
  const lockedAfter = (await view()).document.entities.find(
    (e) => e.id === locked.id,
  );
  assert.equal(lockedAfter.x, locked.x);
  assert.equal(lockedAfter.y, locked.y);
  checks.push(
    "Selection filter, multi-select groups, group movement, copy/paste, ungroup and lock work together",
  );
  const beforeSelectionArchive = await view();
  await selectionKinds("Lichter", "Portale");
  await drag({ x: 29, y: 12 }, { x: 33, y: 16 });
  const marquee = await page.evaluate(() => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return [...editor.selection].map(
      (id) => editor.session.entities.get(id)?.kind,
    );
  });
  assert.ok(marquee.includes("light"));
  assert.ok(marquee.every((kind) => kind === "light" || kind === "door"));
  await page.keyboard.press("Delete");
  state = await view();
  assert.equal(
    state.document.content.archive.length,
    beforeSelectionArchive.document.content.archive.length + 1,
  );
  assert.deepEqual(state.notes, beforeSelectionArchive.notes);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.deepEqual((await view()).document, beforeSelectionArchive.document);
  checks.push(
    "Independent selection categories, marquee and linked archive with undo work together",
  );
  await selectionKinds("Alle");
  await click({ x: 20, y: 8 });
  await sleep(100);
  const renders = (await view()).renderCount;
  await sleep(500);
  assert.equal((await view()).renderCount, renders);
  checks.push("Idle scene does not keep rendering");
  state = await view();
  const sourceFloor = state.document.floors[0],
    sourceEntities = state.document.entities.filter(
      (e) => e.floorId === sourceFloor.id,
    );
  await editorAction("Geschosse");
  await page
    .getByRole("button", { name: "Geschoss kopieren", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session
        .floors.size === 2,
  );
  state = await view();
  const copiedFloor = state.document.floors.find(
      (f) => f.id !== sourceFloor.id,
    ),
    copiedEntities = state.document.entities.filter(
      (e) => e.floorId === copiedFloor.id,
    );
  assert.equal(copiedEntities.length, sourceEntities.length);
  assert.ok(
    Object.values(state.notes).some((text) =>
      text?.includes("**Geschützter  Wortlaut.**"),
    ),
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await view()).document.floors.length, 1);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await view()).document.floors.length, 2);
  checks.push(
    "Floor duplication remaps the full topology and room keys as one undoable edit",
  );
  const beforeFloorArchive = await view(),
    archivedFloorName = await page.evaluate(() => {
      const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
      return editor.session.floors.get(editor.renderer.floorId).name;
    }),
    floorArchiveButton = page.getByRole("button", {
      name: "Geschoss archivieren",
      exact: true,
    });
  if (!(await floorArchiveButton.isVisible())) await editorAction("Geschosse");
  await floorArchiveButton.click();
  state = await view();
  assert.equal(state.document.floors.length, 1);
  assert.equal(
    state.document.content.archive.length,
    beforeFloorArchive.document.content.archive.length + 1,
  );
  assert.deepEqual(state.notes, beforeFloorArchive.notes);
  await editorAction("Inhalte");
  const floorArchive = page
    .locator(".setting-item")
    .filter({ hasText: "Geschoss " + archivedFloorName });
  await floorArchive
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .click();
  assert.deepEqual((await view()).document, beforeFloorArchive.document);
  await page.keyboard.press("Escape");
  checks.push(
    "Floor archive keeps every room key and restores the complete floor at its original layer",
  );
  const beforeResize = await view(),
    resizeRoom = beforeResize.document.entities.find((e) => e.kind === "room");
  await editorAction("Karte");
  await page
    .getByText("Datei: Dungeons/" + name + "/Karte.dungeon", { exact: true })
    .waitFor();
  await page.getByText(/Verwendete Pakete:.*Codex QA Own Pack/).waitFor();
  const setting = (label) =>
      page.locator(".setting-item").filter({ hasText: label }),
    margin = (label) => setting(label + " in Feldern").locator("input");
  await setting("Wandschatten").getByRole("checkbox").click();
  await setting("Objektschatten").getByRole("checkbox").click();
  await setting("Gebäudeabnutzung").locator('input[type="range"]').fill("55");
  await margin("Oben").fill("2");
  await margin("Rechts").fill("-1");
  await margin("Unten").fill("3");
  await margin("Links").fill("4");
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  state = await view();
  assert.equal(state.document.settings.width, 43);
  assert.equal(state.document.settings.height, 35);
  assert.equal(state.document.settings.wallShadows, false);
  assert.equal(state.document.settings.objectShadows, false);
  assert.equal(state.document.settings.buildingWear, 0.55);
  const resizedRoom = state.document.entities.find(
    (e) => e.id === resizeRoom.id,
  );
  assert.equal(resizedRoom.points[0].x, resizeRoom.points[0].x + 4);
  assert.equal(resizedRoom.points[0].y, resizeRoom.points[0].y + 2);
  assert.deepEqual(state.notes, beforeResize.notes);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.deepEqual((await view()).document, beforeResize.document);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  state = await view();
  assert.equal(state.document.settings.width, 43);
  assert.equal(state.document.settings.buildingWear, 0.55);
  checks.push(
    "Map appearance and reversible four-edge resize form one undo step and preserve all floors and room text",
  );
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(
    () =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .session.dirty,
  );
  await page.evaluate(async (p) => {
    const file = app.vault.getAbstractFileByPath(p),
      leaf = app.workspace.getLeaf("tab");
    await leaf.openFile(file, { state: { mode: "preview" } });
  }, room.note.path);
  await page.locator(".markdown-preview-view .dn-map-card canvas").waitFor();
  const embeddedMapSize = await page
    .locator(".markdown-preview-view .dn-map-card")
    .evaluate((card) => {
      const viewport = card.querySelector(".dn-map-viewport"),
        canvas = card.querySelector("canvas");
      return {
        viewport: [viewport.clientWidth, viewport.clientHeight],
        canvas: [canvas.clientWidth, canvas.clientHeight],
      };
    });
  assert.ok(
    embeddedMapSize.viewport[0] > 200 &&
      embeddedMapSize.viewport[1] >= 200 &&
      embeddedMapSize.viewport[1] <= 620,
  );
  assert.deepEqual(embeddedMapSize.canvas, embeddedMapSize.viewport);
  checks.push(
    "The saved room key embeds the bounded native read-only dungeon map",
  );
  const document = (await view()).document,
    mapPath = "Dungeons/" + name + "/Karte.dungeon",
    toolDefaultAssetId = await page.evaluate(
      () =>
        app.plugins.getPlugin("dungeon-editor").toolDefaults().object.assetId,
    );
  assert.match(toolDefaultAssetId, /^pack:/);
  const files = {};
  for (const p of [mapPath, room.note.path])
    files[p] = fs.readFileSync(vault + "/" + p, "utf8");
  fs.writeFileSync(
    source,
    JSON.stringify(
      { path: mapPath, document, files, toolDefaultAssetId },
      null,
      2,
    ),
  );
  checks.push("Map, linked Markdown and global tool defaults saved");
  await page.screenshot({ path: out + "/editor.png", timeout: 30000 });
}
async function selectionWorkflow() {
  const mapPath = "Dungeons/Auswahl/Karte.dungeon";
  await page.evaluate(async (path) => {
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, mapPath);
  await page.locator(".dn-canvas canvas").waitFor({state: "visible"});
  await chooseTool("Auswahl");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return {
      selected: [...editor.selection],
      objectFlip: editor.session.entities.get("object-1").flip,
      objectLocked: editor.session.entities.get("object-1").locked ?? false,
      lightKind: editor.session.entities.get("light-1")?.kind,
      history: editor.session.historySize,
    };
  });
  const clickWorld = async (x, y, modifier) => {
    const p = await page.evaluate(({x,y}) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer,
        box = renderer.canvas.getBoundingClientRect();
      return {x: box.x + renderer.camera.x + x * renderer.camera.scale,
        y: box.y + renderer.camera.y + y * renderer.camera.scale};
    }, {x,y});
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.click(p.x,p.y);
    if (modifier) await page.keyboard.up(modifier);
  };
  const mirror = page.getByRole("button", {name: "Spiegeln",exact: true});
  const copy = page.getByRole("button", {name: "Kopieren",exact: true});
  const paste = page.getByRole("button", {name: "Einfügen",exact: true});
  const remove = page.getByRole("button", {name: "Löschen",exact: true});
  const setFilter = (title, labels) => page
    .locator('.dn-selection-filter input[type="checkbox"]')
    .evaluateAll((inputs, {title, labels}) => {
      for (const input of inputs) {
        const label = input.getAttribute("aria-label");
        if (!label?.startsWith(title + ": ") || label === title + ": Alle") continue;
        const checked = labels.includes(label.slice(title.length + 2));
        if (input.checked !== checked) {
          input.checked = checked;
          input.dispatchEvent(new Event("change", {bubbles: true}));
        }
      }
    }, {title, labels});
  assert.equal(await page.locator('input[aria-label="Objektarten: Muster"]').count(),1);
  assert.equal(await page.locator('input[aria-label="Objektarten: Materialflächen"]').count(),1);
  assert.equal(await page.locator('input[aria-label="Objektarten: Muster"]').isChecked(),true);
  assert.equal(await page.locator('input[aria-label="Objektarten: Dächer"]').isChecked(),true);
  assert.equal(await page.locator('input[aria-label="Objektarten: Materialflächen"]').isChecked(),false);
  checks.push("Native selection kinds start enabled while editable material surfaces remain opt-in");
  assert.equal(await mirror.isDisabled(), true);
  assert.equal(await copy.isDisabled(), true);
  assert.equal(await paste.isDisabled(), true);
  assert.equal(await remove.isDisabled(), true);
  await clickWorld(10,6);
  assert.deepEqual((await state()).selected,[], "Default Select does not pick painted material");
  await setFilter("Objektarten", ["Wände","Portale","Objekte","Pfade","Lichter","Muster","Dächer","Materialflächen"]);
  await clickWorld(10,6);
  assert.deepEqual((await state()).selected,["material-1"], "Opt-in material filter selects the surface");
  await setFilter("Objektarten", ["Wände","Portale","Objekte","Pfade","Lichter","Muster","Dächer"]);
  checks.push("Painted material is skipped by default and selected only after enabling its extra filter");
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-1"]);
  assert.equal(await mirror.isEnabled(), true);
  assert.equal(await copy.isEnabled(), true);
  assert.equal(await remove.isEnabled(), true);
  await setFilter("Objektarten", ["Lichter"]);
  assert.deepEqual((await state()).selected,["object-1"], "Changing a filter retains the current selection");
  await clickWorld(6,3);
  assert.deepEqual((await state()).selected,[], "The filter excludes new object selections");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  await setFilter("Objektarten", ["Objekte", "Lichter"]);
  await setFilter("Zeichenebenen", ["Feste Ebenen"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,[], "Layer filter excludes objects on user layer 1");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  await setFilter("Zeichenebenen", ["Feste Ebenen", "Benutzerebene 1"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-1"]);
  checks.push("Selection type and layer filters intersect for new clicks and retain the existing selection");
  await mirror.click();
  assert.equal((await state()).objectFlip,true);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal((await state()).objectFlip,false);
  assert.deepEqual((await state()).selected,[], "Undo clears the original selection");
  await clickWorld(3,3);
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("a");
  assert.equal((await state()).objectFlip,true);
  checks.push("Selection Mirror button, A shortcut and Undo change one selected object");
  await copy.click();
  assert.equal(await paste.isEnabled(),true);
  checks.push("Copy and Paste actions follow the current selection and clipboard states");
  await page.evaluate(() => {
    window.__qaSelectionClipboard =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.clipboard;
  });
  await page.locator('input[aria-label="Breite in Feldern"]').focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+z");
  assert.equal(await page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return editor.clipboard === window.__qaSelectionClipboard &&
      editor.session.entities.get("object-1").flip;
  }),true);
  await page.locator(".dn-canvas canvas").focus();
  checks.push("Copy and Undo shortcuts inside a property input do not alter the map selection or history");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  assert.equal(await mirror.isDisabled(),true);
  await clickWorld(3,3);
  await page.getByRole("button",{name:"Sperren",exact:true}).click();
  assert.equal((await state()).objectLocked,true);
  assert.equal(await mirror.isDisabled(),true);
  await clickWorld(0.5,0.5);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,[]);
  await clickWorld(3,3,"Alt");
  assert.deepEqual((await state()).selected,["object-1"]);
  await page.getByRole("button",{name:"Entsperren",exact:true}).click();
  assert.equal((await state()).objectLocked,false);
  assert.equal(await mirror.isEnabled(),true);
  checks.push("Mirror stays disabled for lights and locked objects; Alt selection unlocks the object");
  await page.getByRole("button",{name:"Sperren",exact:true}).click();
  await clickWorld(0.5,0.5);
  await clickWorld(3,3,"Alt");
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("Backspace");
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.has("object-1")),false);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal((await state()).objectLocked,true);
  await clickWorld(3,3,"Alt");
  await page.getByRole("button",{name:"Entsperren",exact:true}).click();
  checks.push("Backspace removes an Alt-selected locked object; Undo restores it with its lock");
  await page.screenshot({path:out+"/selection-mirror.png"});
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() =>
    !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  const saved = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
  const object = saved.entities.find((entity) => entity.id === "object-1");
  assert.equal(object.flip,true);
  assert.equal(object.locked,false);
  checks.push("Selection Mirror and unlock persist in the saved native map");
  const cameraState = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const renderer = editor.renderer;
    const {x,y,scale} = renderer.camera;
    const width = renderer.host.clientWidth, height = renderer.host.clientHeight;
    return {x,y,scale,width,height,rootWidth:editor.root.clientWidth,
      maximized:editor.root.classList.contains("dn-maximized"),
      centerX:(width/2-x)/scale,centerY:(height/2-y)/scale};
  });
  const cameras = {before:await cameraState()};
  await chooseTool("Möbel");
  cameras.object = await cameraState();
  await chooseTool("Auswahl");
  cameras.select = await cameraState();
  await page.getByRole("button",{name:"Vorheriges Werkzeug",exact:true}).click();
  cameras.previous = await cameraState();
  fs.writeFileSync(out+"/selection-cameras.json",JSON.stringify(cameras,null,2));
  assert.equal(await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.tool),"object");
  for (const [stage, current] of Object.entries(cameras)) {
    assert.equal(current.maximized,true,stage + " keeps the maximized editor");
    assert.equal(current.rootWidth,cameras.before.rootWidth,stage + " keeps the editor width");
    assert.equal(current.width,cameras.before.width,stage + " keeps the canvas width");
    assert.equal(current.height,cameras.before.height,stage + " keeps the canvas height");
    assert.equal(current.scale,cameras.before.scale,stage + " preserves zoom");
    assert.ok(Math.abs(current.centerX-cameras.before.centerX)<1e-9,stage + " preserves horizontal center");
    assert.ok(Math.abs(current.centerY-cameras.before.centerY)<1e-9,stage + " preserves vertical center");
  }
  checks.push("Previous Tool returns to the last drawing tool without resetting the camera");
  await chooseTool("Auswahl");
  await setFilter("Objektarten",["Objekte"]);
  await setFilter("Zeichenebenen",["Benutzerebene 1"]);
  const worldPoint = (x,y) => page.evaluate(({x,y}) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return {x:box.x+renderer.camera.x+x*renderer.camera.scale,
      y:box.y+renderer.camera.y+y*renderer.camera.scale};
  },{x,y});
  const dragWorld = async (from,to,steps=6) => {
    const a = await worldPoint(...from), b = await worldPoint(...to);
    await page.mouse.move(a.x,a.y);
    await page.mouse.down();
    await page.mouse.move(b.x,b.y,{steps});
    await page.mouse.up();
  };
  await clickWorld(0.5,0.5);
  await dragWorld([1.2,2],[2.8,4]);
  assert.deepEqual((await state()).selected,[],"A box clipping an object without its anchor must not select it");
  await dragWorld([1,1],[8,5]);
  assert.deepEqual(new Set((await state()).selected),new Set(["object-1","object-2"]));
  await dragWorld([3,3],[4,4]);
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-1"),entities.get("object-2")].map(({x,y})=>({x,y}));
  }),[{x:4,y:4},{x:7,y:4}]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-1"),entities.get("object-2")].map(({x,y})=>({x,y}));
  }),[{x:3,y:3},{x:6,y:3}]);
  await dragWorld([1.2,2],[3.2,4]);
  assert.deepEqual((await state()).selected,["object-1"],"The object is selected when its anchor is inside a clipping box");
  checks.push("Selection marquee, joint movement and one Undo preserve both object positions");
  await setFilter("Objektarten",["Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(11,7);
  assert.deepEqual((await state()).selected,[],"A blank click clears the prior object selection");
  await dragWorld([6.5,1.2],[8.8,3.6]);
  assert.deepEqual((await state()).selected,[],"A box clipping the light symbol without its anchor must not select it");
  await dragWorld([6.5,1.2],[9.2,3.6]);
  assert.deepEqual((await state()).selected,["light-1"],"The light is selected when its anchor is inside a clipping box");
  await clickWorld(9,3);
  await page.locator(".dn-canvas canvas").focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await page.keyboard.press("Control+v");
  const lightCopies = await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      center=editor.renderer.toWorld({x:editor.renderer.host.clientWidth/2,y:editor.renderer.host.clientHeight/2});
    return {center,lights:[...editor.session.entities.values()]
      .filter((entity)=>entity.kind==="light").map(({x,y})=>({x,y}))};
  });
  assert.equal(lightCopies.lights.length,3);
  assert.deepEqual(lightCopies.lights.slice(1),[lightCopies.center,lightCopies.center]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await page.evaluate(() => [...app.workspace
    .getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.values()]
    .filter((entity)=>entity.kind==="light").length),1);
  checks.push("Light copy and repeated paste land at the viewport center; two Undo steps remove the copies");
  await setFilter("Objektarten",["Objekte"]);
  await setFilter("Zeichenebenen",["Benutzerebene 1"]);
  await clickWorld(6,3);
  await dragWorld([6,3],[3,3]);
  const stacking = () => page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      visuals=editor.renderer.visuals,
      first=visuals.get("object-1").container,
      second=visuals.get("object-2").container;
    return {
      order:[...editor.session.entities.keys()],
      drawn:[first.parent.getChildIndex(first),second.parent.getChildIndex(second)],
      hit:editor.renderer.hitTest({x:3,y:3})?.id,
      dirty:editor.session.dirty,
    };
  });
  assert.equal((await stacking()).hit,"object-2");
  await page.getByRole("button",{name:"Ganz nach hinten",exact:true}).click();
  let stack=await stacking();
  assert.deepEqual(stack.order.slice(0,2),["object-2","object-1"]);
  assert(stack.drawn[1]<stack.drawn[0]);
  assert.equal(stack.hit,"object-1");
  assert.equal(stack.dirty,true);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  stack=await stacking();
  assert.deepEqual(stack.order.slice(0,2),["object-1","object-2"]);
  assert.equal(stack.hit,"object-2");
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  assert.deepEqual(JSON.parse(fs.readFileSync(vault+"/"+mapPath,"utf8")).entities.slice(0,2).map(({id})=>id),
    ["object-2","object-1"]);
  checks.push("Overlapping object stack order changes drawing and hit tests, Undo restores it, and save persists the order");
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session,
      source=session.entities.get("object-2"),
      object={...source,id:"object-3",x:3,y:3,layer:200};
    session.execute({label:"Ebenenprobe",entities:[{id:object.id,before:null,after:object}]});
  });
  await setFilter("Zeichenebenen",["Benutzerebene 1","Benutzerebene 2"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  await page.getByRole("button",{name:"Ganz nach hinten",exact:true}).click();
  assert.equal((await stacking()).order[0],"object-3");
  assert.equal((await stacking()).hit,"object-3",
    "The higher numeric layer stays clickable above lower-layer objects after reordering");
  checks.push("Stack actions cross object layers while hit tests still select the visually higher layer");
  await setFilter("Objektarten",["Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(9,3);
  await page.getByRole("button",{name:"Vorlage erstellen",exact:true}).click();
  const prefabModal=page.locator(".modal-container").last();
  await prefabModal.getByRole("button",{name:"Sammlung hinzufügen",exact:true}).click();
  await prefabModal.locator("input").fill("Beispiele");
  await prefabModal.getByRole("button",{name:"Hinzufügen",exact:true}).click();
  assert.equal(await prefabModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await prefabModal.locator("input").fill("Fackel");
  await prefabModal.getByRole("button",{name:"Erstellen",exact:true}).click();
  await page.waitForFunction(() => app.plugins.getPlugin("dungeon-editor").prefabs().length===1);
  const prefabId=await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").prefabs()[0].id);
  await page.getByRole("button",{name:"Vorlage erstellen",exact:true}).click();
  const emptySetModal=page.locator(".modal-container").last();
  assert.equal(await emptySetModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await emptySetModal.getByRole("button",{name:"Sammlung hinzufügen",exact:true}).click();
  await emptySetModal.locator("input").fill("Nur vorübergehend");
  await emptySetModal.getByRole("button",{name:"Hinzufügen",exact:true}).click();
  assert.equal(await emptySetModal.locator('select:not([aria-hidden="true"])').inputValue(),"Nur vorübergehend");
  await emptySetModal.getByRole("button",{name:"Leere Sammlung entfernen",exact:true}).click();
  assert.equal(await emptySetModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await page.keyboard.press("Escape");
  assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length,1);
  checks.push("Removing an empty temporary prefab set restores the previously selected set without saving it");
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.get("light-1").prefabId),prefabId);
  await page.getByRole("button",{name:"Vorlage lösen",exact:true}).click();
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.get("light-1").prefabId),undefined);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.get("light-1").prefabId),prefabId);
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(prefabId);
  await clickWorld(2,6);
  const prefabState=await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      lights=[...editor.session.entities.values()].filter((e)=>e.kind==="light");
    return {lights,tool:editor.tool};
  });
  assert.equal(prefabState.lights.length,2);
  assert.equal(prefabState.tool,"prefab");
  assert.deepEqual([prefabState.lights[1].x,prefabState.lights[1].y],
    [2,6]);
  assert.equal(prefabState.lights[1].prefabId,prefabId);
  assert.deepEqual(
    [prefabState.lights[1].radius,prefabState.lights[1].intensity,
      prefabState.lights[1].color,prefabState.lights[1].shadows],
    [prefabState.lights[0].radius,prefabState.lights[0].intensity,
      prefabState.lights[0].color,prefabState.lights[0].shadows]);
  await clickWorld(7,6);
  const lightCount=() => page.evaluate(() => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity)=>entity.kind==="light").length);
  assert.equal(await lightCount(),3);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await lightCount(),2);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await lightCount(),1);
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  assert.equal(await lightCount(),3);
  assert.equal(await page.evaluate(() => app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.tool),"prefab");
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  await waitForFileAbsent(vault+"/"+mapPath+".draft");
  assert.equal(JSON.parse(fs.readFileSync(vault+"/.obsidian/plugins/dungeon-editor/data.json","utf8")).prefabs.length,1);
  checks.push("Make Prefab persists a named global light drawing, Separate is undoable, and repeated prefab-tool clicks place independent lights with separate Undo steps");
  await chooseTool("Auswahl");
  await setFilter("Objektarten",["Objekte","Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen","Benutzerebene 2"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  await dragWorld([3,3],[4,3]);
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-3"),entities.get("light-1")].map(({x,y})=>({x,y}));
  }),[{x:4,y:3},{x:10,y:3}]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await page.evaluate(() => {
    const entities=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities;
    return [entities.get("object-3"),entities.get("light-1")].map(({x,y})=>({x,y}));
  }),[{x:3,y:3},{x:9,y:3}]);
  assert.deepEqual((await state()).selected,[]);
  checks.push("A mixed object-and-light selection moves together; one Undo restores both positions and clears selection");
  await clickWorld(3,3);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  await copy.click();
  await paste.click();
  const copiedPair=await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return [...editor.selection].map((id) => editor.session.entities.get(id));
  });
  assert.deepEqual(copiedPair.map((entity)=>entity.kind),["object","light"]);
  assert.ok(Math.abs(copiedPair[1].x-copiedPair[0].x-6)<1e-9);
  assert.ok(Math.abs(copiedPair[1].y-copiedPair[0].y)<1e-9);
  const pastedCenterError=await page.evaluate((ids) => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      object=editor.session.entities.get(ids[0]),light=editor.session.entities.get(ids[1]),
      bounds={left:Math.min(object.x-object.width/2,light.x-0.5),
        right:Math.max(object.x+object.width/2,light.x+0.5),
        top:Math.min(object.y-object.height/2,light.y-0.5),
        bottom:Math.max(object.y+object.height/2,light.y+0.5)},
      center=editor.renderer.toWorld({x:editor.renderer.host.clientWidth/2,
        y:editor.renderer.host.clientHeight/2});
    return Math.hypot((bounds.left+bounds.right)/2-center.x,
      (bounds.top+bounds.bottom)/2-center.y);
  },copiedPair.map((entity)=>entity.id));
  assert.ok(pastedCenterError<1e-9,"The pasted pair is centered in the visible viewport");
  await paste.click();
  const secondPair=await page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return [...editor.selection].map((id) => editor.session.entities.get(id));
  });
  assert.deepEqual(secondPair.map((entity)=>entity.kind),["object","light"]);
  assert.deepEqual(secondPair.map(({x,y})=>({x,y})),copiedPair.map(({x,y})=>({x,y})));
  const copiedIds=[...copiedPair,...secondPair].map((entity)=>entity.id);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual((await state()).selected,[]);
  assert.deepEqual(await page.evaluate((ids) => ids.map((id) =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.has(id)),copiedIds),[true,true,false,false]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await page.evaluate((ids) => ids.map((id) =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.entities.has(id)),copiedIds),[false,false,false,false]);
  checks.push("Mixed object-and-light Copy/Paste preserves offset and reuses viewport placement; two Undo steps remove each pair");
  await clickWorld(3,3);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  await page.getByRole("button",{name:"Vorlage erstellen",exact:true}).click();
  const mixedModal=page.locator(".modal-container").last();
  assert.equal(await mixedModal.locator('select:not([aria-hidden="true"])').inputValue(),"Beispiele");
  await mixedModal.locator("input").fill("Möbellicht");
  await mixedModal.getByRole("button",{name:"Erstellen",exact:true}).click();
  await page.waitForFunction(() => app.plugins.getPlugin("dungeon-editor").prefabs().length===2);
  const mixed=await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs()[1]);
  assert.deepEqual(mixed.entities.map((entity)=>entity.kind),["object","light"]);
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(mixed.id);
  await clickWorld(6,6);
  const mixedCopies=await page.evaluate((id) => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity) => entity.prefabId===id &&
      !["object-3","light-1"].includes(entity.id)),mixed.id);
  assert.equal(mixedCopies.length,2);
  assert.deepEqual(mixedCopies.map((entity)=>entity.kind),["object","light"]);
  assert.deepEqual([mixedCopies[1].x-mixedCopies[0].x,mixedCopies[1].y-mixedCopies[0].y],[6,0]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await page.evaluate((id) => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity) => entity.prefabId===id &&
      !["object-3","light-1"].includes(entity.id)).length,mixed.id),0);
  await page.getByRole("button",{name:"Wiederholen",exact:true}).click();
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  await waitForFileAbsent(vault+"/"+mapPath+".draft");
  checks.push("Shift-click creates a mixed object-and-light prefab; click placement preserves both offsets and one Undo restores the pair");
  await chooseTool("Auswahl");
  await setFilter("Objektarten",["Objekte"]);
  await setFilter("Zeichenebenen",["Benutzerebene 2"]);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  const shape = () => page.evaluate(() => {
    const object=app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.entities.get("object-3");
    return {x:object.x,y:object.y,width:object.width,height:object.height,
      rotation:object.rotation};
  });
  const originalShape=await shape();
  await dragWorld([3.9,3.65],[4.4,4.15]);
  const insetGripShape=await shape();
  assert.ok(insetGripShape.width>originalShape.width &&
    insetGripShape.height>originalShape.height,
  "The inner portion of the corner grip scales instead of moving");
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),originalShape);
  await clickWorld(3,3);
  assert.deepEqual((await state()).selected,["object-3"]);
  await dragWorld([4.2,3.95],[4.7,4.45]);
  const scaledShape=await shape();
  assert.ok(scaledShape.width>originalShape.width);
  assert.ok(scaledShape.height>originalShape.height);
  assert.ok(Math.abs(scaledShape.width/originalShape.width-
    scaledShape.height/originalShape.height)<1e-9,
  "Corner scaling preserves the object's aspect ratio");
  await dragWorld([6,6],[6,7]);
  const rotatedShape=await shape();
  assert.notEqual(rotatedShape.rotation,scaledShape.rotation);
  const halfWidth=(Math.abs(rotatedShape.width*Math.cos(rotatedShape.rotation))+
    Math.abs(rotatedShape.height*Math.sin(rotatedShape.rotation)))/2,
    halfHeight=(Math.abs(rotatedShape.width*Math.sin(rotatedShape.rotation))+
      Math.abs(rotatedShape.height*Math.cos(rotatedShape.rotation)))/2,
    frameCorner=[rotatedShape.x+halfWidth,rotatedShape.y+halfHeight];
  await dragWorld(frameCorner,[frameCorner[0]+0.5,frameCorner[1]+0.5]);
  const scaledRotatedShape=await shape();
  assert.ok(scaledRotatedShape.width>rotatedShape.width,
    "The axis-aligned grip scales rotated furniture");
  assert.equal(scaledRotatedShape.rotation,rotatedShape.rotation);
  await page.screenshot({path:out+"/selection-transform.png"});
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),rotatedShape);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),scaledShape);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await shape(),originalShape);
  checks.push("Single-object inner and outer corner grips scale, outer drag rotates, and rotated furniture scales at its axis-aligned frame with separate Undo steps");
  await setFilter("Objektarten",["Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  const lightRotation = () => page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .session.entities.get("light-1").rotation ?? 0);
  const beforeRotation=await lightRotation();
  await dragWorld([10.8,3],[9,4.8]);
  assert.notEqual(await lightRotation(),beforeRotation);
  await page.screenshot({path:out+"/selection-light-rotation.png"});
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.equal(await lightRotation(),beforeRotation);
  checks.push("Selected light rotates around its center, and one Undo restores its angle");
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  const lightShape=()=>page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      light=editor.session.entities.get("light-1");
    return {x:light.x,y:light.y,radius:light.radius,
      intensity:light.intensity,rotation:light.rotation??0,
      frame:editor.renderer.selectionLightFrame};
  });
  const originalLight=await lightShape();
  await dragWorld([9.5,3.5],[10,4]);
  const scaledLight=await lightShape();
  assert.ok(scaledLight.x>originalLight.x && scaledLight.y>originalLight.y);
  assert.equal(scaledLight.radius,originalLight.radius);
  assert.equal(scaledLight.intensity,originalLight.intensity);
  assert.equal(scaledLight.rotation,originalLight.rotation);
  assert.ok(scaledLight.frame.width>originalLight.frame.width);
  await page.screenshot({path:out+"/selection-light-scale.png"});
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.dirty);
  const savedLight=JSON.parse(fs.readFileSync(vault+"/"+mapPath,"utf8"))
    .entities.find((entity)=>entity.id==="light-1");
  assert.deepEqual([savedLight.x,savedLight.y,savedLight.radius,
    savedLight.intensity,savedLight.rotation??0],
  [scaledLight.x,scaledLight.y,scaledLight.radius,
    scaledLight.intensity,scaledLight.rotation]);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  const restoredLight=await lightShape();
  assert.deepEqual([restoredLight.x,restoredLight.y,restoredLight.radius,
    restoredLight.intensity,restoredLight.rotation],
  [originalLight.x,originalLight.y,originalLight.radius,
    originalLight.intensity,originalLight.rotation]);
  checks.push("Single-light corner grips enlarge the active frame, move the source by half the drag, preserve illumination through save and Undo cleanly");
  const previousLightZoom=await page.evaluate(() => {
    const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer,
      scale=renderer.camera.scale;
    renderer.zoom(32/scale);
    return scale;
  });
  await clickWorld(15,9);
  assert.deepEqual((await state()).selected,[]);
  await clickWorld(9,3);
  assert.deepEqual((await state()).selected,["light-1"]);
  const lowZoomLight=await lightShape();
  await dragWorld([9,3],[9.25,3.25]);
  const lowZoomScaled=await lightShape();
  assert.ok(lowZoomScaled.frame.width<lowZoomLight.frame.width,
    "At 50 percent, the native light grip covers the symbol center");
  assert.equal(lowZoomScaled.x,lowZoomLight.x+0.125);
  assert.equal(lowZoomScaled.y,lowZoomLight.y+0.125);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await lightShape(),{...lowZoomLight,frame:undefined});
  assert.deepEqual((await state()).selected,[]);
  await page.evaluate((scale) => {
    const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    renderer.zoom(scale/renderer.camera.scale);
  },previousLightZoom);
  checks.push("At 50 percent zoom, dragging the selected light from its center uses the native top-left scale grip and one Undo restores it");
  await setFilter("Objektarten",["Objekte","Lichter"]);
  await setFilter("Zeichenebenen",["Feste Ebenen","Benutzerebene 2"]);
  await clickWorld(3,3);
  await clickWorld(9,3,"Shift");
  assert.deepEqual((await state()).selected.sort(),["light-1","object-3"]);
  const groupShape = () => page.evaluate(() => {
    const editor=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return ["object-3","light-1"].map((id) => {
      const e=editor.session.entities.get(id);
      return {x:e.x,y:e.y,rotation:e.rotation??0,
        width:e.kind==="object"?e.width:null,
        height:e.kind==="object"?e.height:null,
        radius:e.kind==="light"?e.radius:null};
    });
  });
  const originalGroup=await groupShape();
  const firstFrame=await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .renderer.selectionGroupFrame);
  assert.ok(firstFrame?.width>0);
  const distance=firstFrame.width/2+1;
  await dragWorld([firstFrame.x+distance,firstFrame.y],
    [firstFrame.x+distance*Math.cos(0.65),
      firstFrame.y+distance*Math.sin(0.65)]);
  const rotatedGroup=await groupShape();
  assert.notEqual(rotatedGroup[0].rotation,originalGroup[0].rotation);
  assert.ok(Math.abs(rotatedGroup[0].rotation-rotatedGroup[1].rotation)<1e-9);
  assert.equal(rotatedGroup[1].radius,originalGroup[1].radius);
  const rotatedFrame=await page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
      .renderer.selectionGroupFrame);
  assert.ok(Math.abs(rotatedFrame.rotation)>0.1);
  const c=Math.cos(rotatedFrame.rotation),s=Math.sin(rotatedFrame.rotation),
    corner=(x,y)=>[rotatedFrame.x+x*c-y*s,
      rotatedFrame.y+x*s+y*c],
    scaleStart=corner(rotatedFrame.width/2+0.15,
      rotatedFrame.height/2+0.15),
    scaleEnd=corner(rotatedFrame.width/2+0.65,
      rotatedFrame.height/2+0.65);
  await dragWorld(scaleStart,scaleEnd);
  const scaledGroup=await groupShape();
  assert.ok(scaledGroup[0].width>rotatedGroup[0].width);
  assert.equal(scaledGroup[1].radius,rotatedGroup[1].radius);
  assert.equal(scaledGroup[1].rotation,rotatedGroup[1].rotation);
  await page.screenshot({path:out+"/selection-mixed-transform.png"});
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await groupShape(),rotatedGroup);
  await page.getByRole("button",{name:"Rückgängig",exact:true}).click();
  assert.deepEqual(await groupShape(),originalGroup);
  checks.push("Mixed object-and-light frame rotates and scales as two shared Undo steps without changing light reach");
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const wall={id:"portal-wall",floorId:"floor-1",kind:"wall",
      points:[{x:2,y:6},{x:6,y:6}],closed:false,smooth:false,
      color:0x665544,width:0.15};
    const bound={id:"portal-bound",floorId:"floor-1",kind:"door",
      boundaryId:wall.id,at:0.5,width:1,variant:"door"};
    const free={id:"portal-free",floorId:"floor-1",kind:"door",
      x:10,y:6,rotation:0,width:1,variant:"door"};
    session.execute({label:"Portal-Rahmenprobe",entities:[wall,bound,free]
      .map((entity)=>({id:entity.id,before:null,after:entity}))});
  });
  await setFilter("Objektarten",["Portale"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(11,7);
  await dragWorld([2.8,5.3],[5.2,6.7]);
  assert.deepEqual((await state()).selected,[],
    "A wall-bound portal is not captured by a complete marquee");
  await clickWorld(4,6);
  assert.deepEqual((await state()).selected,["portal-bound"],
    "The wall-bound portal remains directly clickable");
  await clickWorld(11,7);
  await dragWorld([9.85,5.3],[10.15,6.7]);
  assert.deepEqual((await state()).selected,["portal-free"],
    "A clipping marquee captures a free portal when its center is inside");
  await clickWorld(11,7);
  await dragWorld([9.3,5.3],[9.7,6.7]);
  assert.deepEqual((await state()).selected,[],
    "A clipping marquee without the free portal center does not capture it");
  await page.screenshot({path:out+"/selection-portals.png"});
  checks.push("Wall-bound portals require direct click; free portals use their center in a marquee");
  await setFilter("Objektarten",["Wände"]);
  await clickWorld(2,6);
  assert.deepEqual((await state()).selected,["portal-wall"],
    "The free wall remains directly clickable");
  await clickWorld(11,7);
  await dragWorld([1.5,5.4],[6.5,6.6]);
  assert.deepEqual((await state()).selected,[],
    "A complete marquee does not select the free wall in the original");
  await page.screenshot({path:out+"/selection-wall.png"});
  checks.push("Free wall direct click works while complete marquee leaves it unselected");
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const roof={id:"selection-roof",floorId:"floor-1",kind:"roof",
      points:[{x:3,y:5},{x:5,y:5},{x:5,y:7},{x:3,y:7}],
      ridge:[{x:3.4,y:6},{x:4.6,y:6}],roofType:"gable",
      color:0x776a60,outlineColor:0x332b29,layer:400};
    session.execute({label:"Dach-Rahmenprobe",entities:[
      {id:roof.id,before:null,after:roof}]});
  });
  await setFilter("Objektarten",["Dächer"]);
  await setFilter("Zeichenebenen",["Feste Ebenen"]);
  await clickWorld(3.5,5.3);
  assert.deepEqual((await state()).selected,["selection-roof"],
    "The roof remains directly clickable");
  await clickWorld(11,7);
  assert.deepEqual((await state()).selected,[]);
  await dragWorld([2.5,4.5],[4,6]);
  assert.deepEqual((await state()).selected,[],
    "A partial marquee does not select the roof");
  await dragWorld([2.5,4.5],[5.5,7.5]);
  assert.deepEqual((await state()).selected,["selection-roof"],
    "A marquee enclosing the entire roof selects it");
  await page.screenshot({path:out+"/selection-roof.png"});
  await page.evaluate(() => {
    const session=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
    const pattern={id:"selection-pattern",floorId:"floor-1",kind:"surface",
      category:"pattern",polygons:[{outer:[{x:6,y:5},{x:8,y:5},
        {x:8,y:7},{x:6,y:7}],holes:[]}],layer:100,
      color:0x7c6c5d,wallColor:0,wallWidth:0};
    session.execute({label:"Muster-Rahmenprobe",entities:[
      {id:pattern.id,before:null,after:pattern}]});
  });
  await setFilter("Objektarten",["Muster"]);
  await setFilter("Zeichenebenen",["Benutzerebene 1"]);
  await clickWorld(7,5.2);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The pattern remains directly clickable");
  await clickWorld(11.5,7.5);
  assert.deepEqual((await state()).selected,[]);
  await dragWorld([5.5,4.5],[7,6],16);
  assert.deepEqual((await state()).selected,[],
    "A partial marquee does not select the pattern");
  await dragWorld([5.5,4.5],[8,7],16);
  assert.deepEqual((await state()).selected,[],
    "A marquee ending exactly at the pattern contour does not select it");
  await dragWorld([5.5,4.5],[8.125,7.125],16);
  assert.deepEqual((await state()).selected,[],
    "The previous movement event has not yet enclosed the pattern");
  await dragWorld([5.5,4.5],[8.25,7.25],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The preceding movement event encloses the pattern");
  await clickWorld(11.5,7.5);
  assert.deepEqual((await state()).selected,[]);
  await dragWorld([6,4.5],[8.5,7.5],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The exact left contour is inside the marquee");
  await clickWorld(11.5,7.5);
  await dragWorld([5.5,5],[8.5,7.5],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "The exact top contour is inside the marquee");
  await clickWorld(11.5,7.5);
  await dragWorld([5.5,4.5],[8.5,7.5],16);
  assert.deepEqual((await state()).selected,["selection-pattern"],
    "A marquee enclosing the pattern contour selects it");
  await page.screenshot({path:out+"/selection-pattern.png"});
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  checks.push("Roof direct click and full-extent marquee match the measured original and persist");
  checks.push("Pattern direct click, asymmetric contour bounds and movement-event marquee timing persist");
}
async function selectionReopenWorkflow() {
  const mapPath="Dungeons/Auswahl/Karte.dungeon";
  await page.evaluate(async (path) => {
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  },mapPath);
  await page.locator(".dn-canvas canvas").waitFor({state:"visible"});
  await chooseTool("Auswahl");
  const saved=JSON.parse(fs.readFileSync(vault+"/"+mapPath,"utf8"));
  assert.ok(saved.entities.some((entity)=>entity.id==="selection-roof"));
  assert.ok(saved.entities.some((entity)=>entity.id==="selection-pattern"));
  const existingLights=saved.entities.filter((entity)=>entity.kind==="light").length;
  assert(existingLights>=2);
  const prefabs=await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs());
  assert.equal(prefabs.length,2);
  assert.deepEqual([prefabs[0].set,prefabs[0].name],["Beispiele","Fackel"]);
  assert.deepEqual([prefabs[1].set,prefabs[1].name],["Beispiele","Möbellicht"]);
  const clickAtWorld=async (x,y) => {
    const point=await page.evaluate(({x,y}) => {
      const renderer=app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer,
        box=renderer.canvas.getBoundingClientRect();
      return {x:box.x+renderer.camera.x+x*renderer.camera.scale,
        y:box.y+renderer.camera.y+y*renderer.camera.scale};
    },{x,y});
    await page.mouse.click(point.x,point.y);
  };
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(prefabs[0].id);
  await clickAtWorld(7,6);
  assert.equal(await page.evaluate(() => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity)=>entity.kind==="light").length),existingLights+1);
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  checks.push("A fresh Obsidian process reloads the named prefab and places another working light");
  const otherPath="Dungeons/Auswahl/Zweite Karte.dungeon";
  const other={...saved,id:"selection-other",settings:{...saved.settings,name:"Zweite Karte"},
    entities:[],content:{definitions:[],occurrences:[],routes:[],archive:[]}};
  await page.evaluate(async ({path,document}) => {
    let file=app.vault.getAbstractFileByPath(path);
    if (file) await app.vault.modify(file,JSON.stringify(document));
    else file=await app.vault.create(path,JSON.stringify(document));
    await app.workspace.getLeaf(false).openFile(file);
  },{path:otherPath,document:other});
  await page.locator(".dn-canvas canvas").waitFor({state:"visible"});
  await chooseTool("Baustein");
  await page.getByRole("combobox",{name:"Vorlage",exact:true}).selectOption(prefabs[0].id);
  await clickAtWorld(3,5);
  const otherLights=await page.evaluate(() => [...app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.entities.values()].filter((entity)=>entity.kind==="light"));
  assert.equal(otherLights.length,1);
  assert.equal(otherLights[0].prefabId,prefabs[0].id);
  assert.equal(otherLights[0].radius,prefabs[0].entities[0].radius);
  assert.deepEqual([otherLights[0].x,otherLights[0].y],[3,5]);
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  assert.equal(JSON.parse(fs.readFileSync(vault+"/"+otherPath,"utf8")).entities.filter((e)=>e.kind==="light").length,1);
  checks.push("The same global prefab places a saved light on a second dungeon map");
}
async function prefabForgetWorkflow(view) {
  const mapPath = "Dungeons/PrefabQA/Karte.dungeon";
  const prefabId = "prefab-forget-qa";
  if (!restart) {
    await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").create("PrefabQA", 12, 8),
    );
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await page.evaluate(async (id) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.savePrefab({
        id, set: "QA", name: "Tisch mit Licht", center: { x: 3.5, y: 3 },
        entities: [
          { id: "source-object", kind: "object", floorId: "floor-1",
            x: 3, y: 3, rotation: 0, width: 1, height: 1,
            color: 0x886644, label: "", layer: 100, flip: false },
          { id: "source-light", kind: "light", floorId: "floor-1",
            x: 4, y: 3, radius: 2, intensity: 1, color: 0xeccd8b,
            shadows: false },
        ],
      });
      window.__qaPrefabForForget = plugin.prefabs()[0];
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.refreshPrefabs();
    }, prefabId);
    await chooseTool("Baustein");
    await page.getByRole("combobox", { name: "Vorlage", exact: true })
      .selectOption(prefabId);
    const at = await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      const box = renderer.canvas.getBoundingClientRect();
      return { x: box.x + renderer.camera.x + 6 * renderer.camera.scale,
        y: box.y + renderer.camera.y + 4 * renderer.camera.scale };
    });
    await page.mouse.click(at.x, at.y);
    const placed = (await view()).document.entities.filter((entity) =>
      entity.prefabId === prefabId);
    assert.deepEqual(placed.map((entity) => entity.kind).sort(),
      ["light", "object"]);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
    const before = fs.readFileSync(vault + "/" + mapPath, "utf8");
    const forget = page.getByRole("button", { name: "Vorlage vergessen", exact: true });
    assert.equal(await forget.isEnabled(), true);
    await forget.click();
    const dialog = page.locator("dialog.dn-confirm-dialog");
    await dialog.getByText("Bereits platzierte Elemente bleiben", { exact: false }).waitFor();
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 1);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    checks.push("Cancel keeps the saved prefab and placed pair in this host build");
    await forget.click();
    await dialog.waitFor();
    await page.evaluate(async () => {
      const note = await app.vault.create("Dungeons/PrefabQA/Dialogwechsel.md", "# Dialogwechsel\n");
      await app.workspace.getLeavesOfType("dungeon-native-map")[0].openFile(note);
    });
    await dialog.waitFor({ state: "detached" });
    assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 1);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    checks.push("Closing the map while Forget warning is open cancels it and preserves the saved pair");
    await page.evaluate(async (path) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
    mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseTool("Baustein");
    await page.getByRole("combobox", { name: "Vorlage", exact: true })
      .selectOption(prefabId);
    await forget.click();
    await dialog.getByRole("button", { name: "Vergessen", exact: true }).click();
    await page.waitForFunction(() =>
      app.plugins.getPlugin("dungeon-editor").prefabs().length === 0);
    assert.equal(await page.getByRole("combobox", { name: "Vorlage", exact: true }).inputValue(), "");
    assert.equal(await forget.isEnabled(), false);
    assert.equal((await view()).document.entities.filter((entity) =>
      entity.prefabId === prefabId).length, 2);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    assert.equal(JSON.parse(fs.readFileSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", "utf8")).prefabs.length, 0);
    await page.screenshot({ path: out + "/prefab-forgotten.png" });
    checks.push("Confirmed Forget durably removes only the definition and leaves the saved object-light pair byte-exact");
    await page.evaluate(async () => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.savePrefab(window.__qaPrefabForForget);
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.refreshPrefabs();
      const original = plugin.saveData.bind(plugin);
      let release;
      const blocked = new Promise((resolve) => { release = resolve; });
      let entered;
      const started = new Promise((resolve) => { entered = resolve; });
      let held = false;
      plugin.saveData = async (data) => {
        if (!held && data.prefabs.length === 0) {
          held = true;
          entered();
          await blocked;
        }
        return original(data);
      };
      window.__qaForgetRace = { plugin, original, started, release };
    });
    await page.getByRole("combobox", { name: "Vorlage", exact: true })
      .selectOption(prefabId);
    await forget.click();
    await dialog.getByRole("button", { name: "Vergessen", exact: true }).click();
    await page.evaluate(() => window.__qaForgetRace.started);
    await page.evaluate(async () => {
      const race = window.__qaForgetRace;
      race.plugin.persistToolDefaults();
      race.release();
      await race.plugin.pluginDataWrites;
      race.plugin.saveData = race.original;
      delete window.__qaForgetRace;
    });
    assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 0);
    assert.equal(JSON.parse(fs.readFileSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", "utf8")).prefabs.length, 0);
    assert.equal(fs.readFileSync(vault + "/" + mapPath, "utf8"), before);
    checks.push("Concurrent tool-default persistence cannot restore a confirmed forgotten prefab");
    return;
  }
  await page.evaluate(async (path) =>
    app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
  mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  assert.equal((await page.evaluate(() => app.plugins.getPlugin("dungeon-editor").prefabs())).length, 0);
  const pair = (await view()).document.entities.filter((entity) => entity.prefabId === prefabId);
  assert.deepEqual(pair.map((entity) => entity.kind).sort(), ["light", "object"]);
  assert.equal(JSON.parse(fs.readFileSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", "utf8")).prefabs.length, 0);
  await page.screenshot({ path: out + "/prefab-reopened.png" });
  checks.push("Fresh Obsidian process keeps the definition forgotten while the object-light pair reopens intact");
}
function twoPathFixture(bytes) {
  const input = Buffer.from(bytes);
  const original = new DataView(input.buffer, input.byteOffset, input.byteLength);
  assert.equal(original.getUint32(0, true), 0x43504447);
  const files = [];
  let cursor = 88;
  for (let index = 0; index < original.getUint32(84, true); index++) {
    const length = original.getUint32(cursor, true);
    cursor += 4;
    const name = input.subarray(cursor, cursor + length).toString("utf8").replace(/\0+$/, "");
    cursor += length;
    const offset = Number(original.getBigUint64(cursor, true));
    const size = Number(original.getBigUint64(cursor + 8, true));
    cursor += 32;
    files.push({ name, bytes: input.subarray(offset, offset + size) });
  }
  const image = files.find((file) => file.name.endsWith("/QA Path.png"));
  assert(image);
  files.push({ name: "res://packs/QAPath01/textures/paths/Other Path.png", bytes: image.bytes });
  const header = Buffer.from(input.subarray(0, 88));
  header.writeUInt32LE(files.length, 84);
  const tableSize = files.reduce((sum, file) => sum + 4 + Buffer.byteLength(file.name) + 32, 0);
  let payloadOffset = 88 + tableSize;
  const table = files.map((file) => {
    const name = Buffer.from(file.name);
    const row = Buffer.alloc(4 + name.length + 32);
    row.writeUInt32LE(name.length, 0);
    name.copy(row, 4);
    row.writeBigUInt64LE(BigInt(payloadOffset), 4 + name.length);
    row.writeBigUInt64LE(BigInt(file.bytes.length), 12 + name.length);
    payloadOffset += file.bytes.length;
    return row;
  });
  return Buffer.concat([header, ...table, ...files.map((file) => file.bytes)]);
}
async function pathLibraryWorkflow(view) {
  const mapPath = "Dungeons/PathLibraryQA/Karte.dungeon";
  const packPath = root + "/../dungeon-auswertung/tests/fixtures/" +
    "path-texture-probe/own-path.dungeondraft_pack";
  const packDigest = crypto.createHash("sha256")
    .update(fs.readFileSync(packPath)).digest("hex");
  assert.equal(packDigest,
    "69aeb699a8008ac874b61ba988c9463aa6a569f32c851d8c638a6815936f7c41");
  const fixture = twoPathFixture(fs.readFileSync(packPath));
  fs.writeFileSync(out + "/two-path-fixture.dungeondraft_pack", fixture);
  fs.writeFileSync(out + "/two-path-fixture.sha256",
    crypto.createHash("sha256").update(fixture).digest("hex") + "\n");
  if (restart) {
    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(mapPath)),
    mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const saved = await view();
    const path = saved.document.entities.find((entity) => entity.kind === "path");
    assert(path);
    const asset = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets()
        .find((asset) => asset.kind === "path" && asset.name === "QA Path"));
    assert(asset);
    assert.equal(path.material.assetId, asset.id);
    assert.equal(path.material.assetPart, "image");
    assert(saved.document.settings.assetPacks.includes("QAPath01"));
    await chooseTool("Pfad");
    assert.equal(await page.locator(".dn-path-library-tiles button").count(), 2);
    const rendered = await page.evaluate((id) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
      const visual = editor.renderer.visuals.get(id);
      return { present: !!visual, assets: visual?.assets ?? [] };
    }, path.id);
    assert(rendered.present);
    assert(rendered.assets.includes(asset.id + "\0image"));
    checks.push("Saved path texture reference and rendered visual reopen with both library tiles");
    return;
  }
  await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").create("PathLibraryQA", 12, 8));
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  const encoded = fixture.toString("base64");
  await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.assets.add([new Blob([bytes])]);
    await plugin.reloadAssets();
    const session = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session;
    const before = session.settings;
    session.execute({ label: "QA-Paket für Karte aktivieren",
      settings: { before, after: { ...before, assetPacks: ["QAPath01"] } } });
  }, encoded);
  await chooseTool("Pfad");
  const tiles = page.locator(".dn-path-library-tiles button");
  await tiles.first().waitFor();
  assert.equal(await tiles.count(), 2);
  const input = page.getByRole("searchbox", { name: "Pfadbibliothek durchsuchen" });
  await input.fill("QA Path");
  await input.press("Enter");
  assert.equal(await tiles.count(), 1);
  assert.equal(await input.inputValue(), "QA Path");
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  assert.equal(await tiles.count(), 2);
  assert.equal(await input.inputValue(), "QA Path");
  checks.push("Clear Search restores every available path tile while retaining the visible query");
  const asset = await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").listAssets()
      .find((asset) => asset.kind === "path" && asset.name === "QA Path"));
  assert(asset);
  await page.locator('.dn-path-library-tiles button[aria-label="QA Path"]').click();
  assert.equal(await page.getByRole("combobox", { name: "Paketmaterial" }).inputValue(), asset.id);
  const beforePlace = await view();
  const at = async (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  for (const point of [{ x: 2, y: 2 }, { x: 6, y: 2 }]) {
    const screen = await at(point);
    await page.mouse.click(screen.x, screen.y);
  }
  await page.keyboard.press("Enter");
  const placed = await view();
  const path = placed.document.entities.find((entity) => entity.kind === "path");
  assert(path);
  assert.equal(path.material.assetId, asset.id);
  assert.equal(placed.history, beforePlace.history + 1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await view()).document.entities.filter((entity) => entity.kind === "path").length, 0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await view()).document.entities.find((entity) => entity.kind === "path").material.assetId, asset.id);
  checks.push("Library tile selects the package path; placement has one Undo step and Redo restores it");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() =>
    !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);
  await page.screenshot({ path: out + "/path-library.png" });
  checks.push("Path Library selection and path save cleanly");
}
async function objectAlphaWorkflow(view) {
  const mapPath = "Dungeons/ObjectAlphaQA/Karte.dungeon";
  const packPath = root + "/../dungeon-auswertung/tests/fixtures/" +
    "colorable-object-alpha-solid-probe/own-object-color.dungeondraft_pack";
  const packDigest = crypto.createHash("sha256")
    .update(fs.readFileSync(packPath)).digest("hex");
  assert.equal(packDigest,
    "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088");
  if (!restart) {
    await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").create("ObjectAlphaQA", 12, 8));
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    const encoded = fs.readFileSync(packPath).toString("base64");
    await page.evaluate(async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      const session = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session;
      const before = session.settings;
      session.execute({ label: "QA-Paket für Karte aktivieren",
        settings: { before, after: { ...before, assetPacks: ["QAObjASl"] } } });
    }, encoded);
    await page.waitForFunction(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets()
        .some((asset) => asset.name === "QA Object Color" && asset.tintable));
    const asset = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets()
        .find((asset) => asset.name === "QA Object Color"));
    assert.equal(asset.kind, "object");
    assert.equal(asset.tintable, true);
    assert((await view()).document.settings.assetPacks.includes("QAObjASl"));
    checks.push("Hash-checked Colorable object pack loads with its native tag");
    await chooseTool("Möbel");
    await page.getByRole("combobox", { name: "Paketobjekt", exact: true })
      .selectOption(asset.id);
    const color = page.locator('input[aria-label="Objektfarbe"]');
    await color.fill("#4080c0");
    await color.press("Tab");
    for (const [name, value] of [["Breite in Feldern", "2.8"], ["Höhe in Feldern", "2.8"]]) {
      const input = page.locator(`input[aria-label="${name}"]`);
      await input.fill(value);
      await input.press("Tab");
    }
    await page.locator('input[aria-label="Schatten"]').uncheck();
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      renderer.appearance.mapFill = 0x252525;
      renderer.appearance.grid = false;
      renderer.drawGrid();
      renderer.invalidate();
    });
    const at = (x, y) => page.evaluate(({ x, y }) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      const box = renderer.canvas.getBoundingClientRect();
      return { x: box.x + renderer.camera.x + x * renderer.camera.scale,
        y: box.y + renderer.camera.y + y * renderer.camera.scale };
    }, { x, y });
    const ids = [];
    for (const [index, alpha] of [255, 128, 0].entries()) {
      await chooseTool("Möbel");
      const input = page.locator('input[aria-label="Objektfarbe Alpha (0–255)"]');
      await input.fill(String(alpha));
      await input.press("Tab");
      const before = (await view()).document.entities.length;
      const point = await at(2 + index * 3, 4);
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction((length) =>
        app.workspace.getLeavesOfType("dungeon-native-map")[0]
          .view.editor.session.document().entities.length === length + 1,
      before);
      const placed = (await view()).document.entities.at(-1);
      assert.equal(placed.kind, "object");
      assert.equal(placed.assetId, asset.id);
      assert.equal(placed.color, 0x4080c0);
      assert.equal(placed.alpha, alpha);
      assert.equal(placed.shadow, false);
      ids.push(placed.id);
    }
    await page.waitForFunction((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      return ids.every((id) => renderer.visuals.get(id)?.container.children
        .some((child) => !!child.texture));
    }, ids);
    const visualAlpha = await page.evaluate((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      return ids.map((id) => {
        const visual = renderer.visuals.get(id);
        const sprite = visual.container.children.find((child) =>
          !!child.texture);
        return { id, spriteAlpha: sprite.alpha,
          shadowAlpha: visual.container.children[0]?.alpha };
      });
    }, ids);
    assert.deepEqual(visualAlpha.map((item) => item.spriteAlpha), [1, 1, 1]);
    const screenshot = await page.locator(".dn-canvas canvas")
      .screenshot({ path: out + "/object-alpha-before-save.png" });
    const pixels = PNG.sync.read(screenshot),
      sample = (x, y) => [...pixels.data.subarray(
        (y * pixels.width + x) * 4, (y * pixels.width + x) * 4 + 3)];
    const colorablePixels = [60, 204, 348].map((x) => sample(x, 500));
    const fixedPixels = [100, 244, 388].map((x) => sample(x, 500));
    assert.deepEqual(colorablePixels[2], [37, 37, 37]);
    for (let channel = 0; channel < 3; channel++) {
      const expected = 37 + (colorablePixels[0][channel] - 37) * 128 / 255;
      assert(Math.abs(colorablePixels[1][channel] - expected) <= 2);
      assert(Math.abs(fixedPixels[1][channel] - fixedPixels[0][channel]) <= 1);
      assert(Math.abs(fixedPixels[2][channel] - fixedPixels[0][channel]) <= 1);
    }
    checks.push("Colorable object keeps fixed pixels while A=128 halves and A=0 hides only tinted pixels");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await view()).document.entities.some((e) => e.id === ids[2]), false);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal((await view()).document.entities.some((e) => e.id === ids[2]), true);
    checks.push("Object alpha remains attached to its creation through host undo and redo");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.dirty);
    const disk = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
    assert.equal(disk.version, 3);
    assert.deepEqual(ids.map((id) => disk.entities.find((e) => e.id === id).alpha),
      [255, 128, 0]);
    fs.writeFileSync(qa + "/object-alpha-saved.json",
      JSON.stringify({ mapPath, ids, assetId: asset.id }));
    checks.push("V3 save preserves all three 8-bit alpha bytes and object instances");
    return;
  }
  const { ids, assetId } = JSON.parse(
    fs.readFileSync(qa + "/object-alpha-saved.json", "utf8"));
  await page.evaluate(async (path) =>
    app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
  mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await page.evaluate(() => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    renderer.appearance.mapFill = 0x252525;
    renderer.appearance.grid = false;
    renderer.drawGrid();
    renderer.invalidate();
  });
  const saved = (await view()).document;
  assert.equal(saved.version, 3);
  assert.deepEqual(ids.map((id) => saved.entities.find((e) => e.id === id).alpha),
    [255, 128, 0]);
  assert(ids.every((id) => saved.entities.find((e) => e.id === id).assetId === assetId));
  await page.waitForFunction((ids) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return ids.every((id) => renderer.visuals.get(id)?.container.children
      .some((child) => !!child.texture));
  }, ids);
  const alpha = await page.evaluate((ids) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return ids.map((id) => renderer.visuals.get(id).container.children
      .find((child) => !!child.texture).alpha);
  }, ids);
  assert.deepEqual(alpha, [1, 1, 1]);
  const reopenedImage = await page.locator(".dn-canvas canvas")
    .screenshot({ path: out + "/object-alpha-reopened.png" });
  const reopenedPixels = PNG.sync.read(reopenedImage);
  const reopenedSample = (x, y) => [...reopenedPixels.data.subarray(
    (y * reopenedPixels.width + x) * 4,
    (y * reopenedPixels.width + x) * 4 + 3)];
  const reopenedColorable = [60, 204, 348]
    .map((x) => reopenedSample(x, 500));
  const reopenedFixed = [100, 244, 388]
    .map((x) => reopenedSample(x, 500));
  assert.deepEqual(reopenedColorable[2], [37, 37, 37]);
  for (let channel = 0; channel < 3; channel++) {
    const expected = 37 + (reopenedColorable[0][channel] - 37) * 128 / 255;
    assert(Math.abs(reopenedColorable[1][channel] - expected) <= 2);
    assert(Math.abs(reopenedFixed[1][channel] - reopenedFixed[0][channel]) <= 1);
    assert(Math.abs(reopenedFixed[2][channel] - reopenedFixed[0][channel]) <= 1);
  }
  checks.push("Fresh Obsidian process preserves alpha bytes, selective pixels and fixed pixels");
}
async function patternAlphaWorkflow(view) {
  const mapPath = "Dungeons/PatternQA/Karte.dungeon";
  if (!restart) {
    await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").create("PatternQA", 12, 8),
    );
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseTool("Muster");
    const patternDefaults = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.settings.surfaces.pattern,
    );
    assert.equal(patternDefaults.wallWidth, patternOutline ? 0 : 0.08);
    const alpha = page.locator('input[aria-label="Alpha (0–255)"]');
    assert.equal(await alpha.inputValue(), "255");
    await alpha.fill("160");
    await alpha.press("Tab");
    const canvas = page.locator(".dn-canvas canvas");
    const at = (point) => page.evaluate((point) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      const box = renderer.canvas.getBoundingClientRect();
      return {
        x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: box.y + renderer.camera.y + point.y * renderer.camera.scale,
      };
    }, point);
    const a = await at({ x: 2, y: 2 });
    const b = await at({ x: 6, y: 5 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0]
        ?.view.editor.session.document().entities.some(
          (entity) => entity.kind === "surface" && entity.category === "pattern"),
    );
    const pattern = (await view()).document.entities.find(
      (entity) => entity.kind === "surface" && entity.category === "pattern",
    );
    assert.equal(pattern.opacity, 160 / 255);
    assert.equal(pattern.wallWidth, patternOutline ? 0 : 0.08);
    assert.equal(pattern.layer, 100);
    checks.push("Pattern stores exact 8-bit alpha 160/255 with the current outline setting");
    await canvas.screenshot({ path: out + "/pattern-alpha-160.png" });
    await page.keyboard.press("Control+z");
    assert.equal((await view()).document.entities.some((entity) => entity.id === pattern.id), false);
    await page.keyboard.press("Control+Shift+z");
    assert.equal((await view()).document.entities.some((entity) => entity.id === pattern.id), true);
    checks.push("Pattern alpha survives creation undo and redo");
    if (patternOutline) {
    await page.evaluate(async (id) =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.select(id),
    pattern.id);
    const outline = page.locator('input[aria-label="Konturbreite"]');
    await outline.fill("0.08");
    await outline.press("Tab");
    const wallWidth = async () => (await view()).document.entities.find(
      (entity) => entity.id === pattern.id,
    ).wallWidth;
    assert.equal(await wallWidth(), 0.08);
    await canvas.screenshot({ path: out + "/pattern-outline-on.png" });
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal(await wallWidth(), 0);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal(await wallWidth(), 0.08);
    await page.evaluate(async (id) =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.select(id),
    pattern.id);
    await outline.fill("0");
    await outline.press("Tab");
    assert.equal(await wallWidth(), 0);
    checks.push("Pattern outline enabled with undo and redo, then disabled and saved");
    }
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.dirty,
    );
    const disk = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
    assert.equal(disk.version, 3);
    const saved = disk.entities.find((entity) => entity.id === pattern.id);
    assert.equal(saved.opacity, 160 / 255);
    assert.equal(saved.wallWidth, patternOutline ? 0 : 0.08);
    fs.writeFileSync(qa + "/pattern-alpha-saved.json", JSON.stringify({ mapPath, id: pattern.id }));
    checks.push("Pattern map saves as V3 with exact alpha and outline setting");
    return;
  }
  const { id } = JSON.parse(fs.readFileSync(qa + "/pattern-alpha-saved.json", "utf8"));
  await page.evaluate(async (path) =>
    app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path)),
  mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  const opened = (await view()).document;
  const pattern = opened.entities.find((entity) => entity.id === id);
  assert.equal(opened.version, 3);
  assert.equal(pattern.opacity, 160 / 255);
  assert.equal(pattern.wallWidth, patternOutline ? 0 : 0.08);
  await page.locator(".dn-canvas canvas").screenshot({ path: out + "/pattern-alpha-reopened.png" });
  checks.push("Fresh Obsidian process reopens exact pattern alpha and outline setting");
}
async function v2OpenWorkflow(view) {
  for (const mapPath of ["Dungeons/Drachenhöhle/Karte.dungeon", "Dungeons/test/Karte.dungeon"]) {
    const expected = JSON.parse(fs.readFileSync(path.resolve(sourceVault, mapPath), "utf8"));
    assert.equal(expected.version, 2);
    await page.evaluate(async (path) => {
      const file = app.vault.getAbstractFileByPath(path);
      const leaf = app.workspace.getLeavesOfType("dungeon-native-map")[0] ?? app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 30000 });
    const opened = (await view()).document;
    assert.deepEqual(opened, { ...expected, version: 3 });
    checks.push(`V2 map ${mapPath} opens as V3 in the real Obsidian editor with exact fields`);
    if (!restart) {
      assert.equal(JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8")).version, 2);
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      let saved;
      for (let attempt = 0; attempt < 100; attempt++) {
        try { saved = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8")); }
        catch { saved = undefined; }
        if (saved?.version === 3) break;
        await sleep(50);
      }
      assert.deepEqual(saved, { ...expected, version: 3 });
      checks.push(`Isolated copy of ${mapPath} saves without changing any map field except version`);
    } else {
      const saved = JSON.parse(fs.readFileSync(vault + "/" + mapPath, "utf8"));
      assert.deepEqual(saved, { ...expected, version: 3 });
      checks.push(`Fresh Obsidian process reopens saved V3 copy of ${mapPath}`);
    }
  }
  await page.screenshot({ path: out + "/v2-maps-opened.png" });
}
async function compactWorkflow() {
  const mapPath = "Dungeons/Drachenhöhle/Karte.dungeon";
  await page.evaluate(async (path) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:10000;left:540px;top:70px;width:520px;height:550px;background:white";
    document.body.append(host);
    const card = app.plugins.getPlugin("dungeon-editor").createDungeonMap({path,compact:true});
    host.append(card.el);
    window.__qaCompact = {host,card};
    await card.ready;
    card.fit();
  }, mapPath);
  const state = () => page.evaluate(() => {
    const renderer = window.__qaCompact.card.renderer;
    return {
      scale: renderer.camera.scale,
      objects: [...renderer.visuals.values()].filter((v) => v.entity.kind === "object").length,
      totalObjects: [...renderer.session.entities.values()].filter((entity) => entity.kind === "object").length,
      markerLabels: [...renderer.visuals.values()].filter((v) => v.entity.kind === "object" && v.label?.visible).length,
      visibleLabels: [...renderer.visuals.values()].filter((v) => v.label?.visible).length,
      renderCount: renderer.renderCount,
      lastRenderMs: renderer.lastRenderMs,
    };
  });
  await sleep(500);
  const overview = await state();
  assert(overview.objects < overview.totalObjects / 2, "Compact overview keeps only legible furniture");
  assert.equal(overview.markerLabels, 0, "Tiny feature markers do not crowd the overview");
  assert(overview.visibleLabels >= 15, "Room numbers remain visible");
  await page.screenshot({ path: out + "/compact-overview.png" });
  await page.evaluate(() => {
    const card = window.__qaCompact.card,
      room = [...card.map.session.entities.values()].find(
        (entity) => entity.kind === "room" && entity.number === "1",
      );
    card.focus(room.id);
  });
  await sleep(500);
  const focus = await state();
  assert(focus.objects > 0 && focus.markerLabels > 0, "Room focus restores map details and markers");
  await page.screenshot({ path: out + "/compact-room-focus.png" });
  const idleBefore = focus.renderCount;
  await sleep(500);
  const idle = await state();
  assert.equal(idle.renderCount, idleBefore, "Compact map does not redraw while idle");
  await page.evaluate(() => {
    const {host,card} = window.__qaCompact;
    host.style.height = "260px";
    card.el.style.height = "260px";
  });
  await sleep(250);
  await page.evaluate(() => window.__qaCompact.card.fit());
  await sleep(250);
  const narrow = await state();
  assert.equal(narrow.markerLabels, 0, "Small map hides unreadable markers");
  assert.equal(narrow.visibleLabels, 15, "Small map keeps every room number");
  assert(narrow.objects < overview.objects, "Smaller viewport draws fewer details");
  await page.screenshot({ path: out + "/compact-narrow-overview.png" });
  fs.writeFileSync(out + "/metrics.json", JSON.stringify({overview,focus,narrow,idleAdditionalRenders:idle.renderCount-idleBefore}, null, 2));
  await page.evaluate(() => {
    window.__qaCompact.card.destroy();
    window.__qaCompact.host.remove();
    delete window.__qaCompact;
  });
  checks.push("Productive Dragon Cave compact overview and room focus reduce details without hiding room numbers or redrawing at idle");
}
async function largeWorkflow() {
  const mapPath = "Dungeons/Grosskarte/Karte.dungeon",
    source = qa + "/large-saved.json",
    metrics = {};
  const started = Date.now();
  await page.evaluate(async (p) => {
    await app.workspace
      .getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(p));
  }, mapPath);
  await page
    .locator(".dn-canvas canvas")
    .waitFor({ state: "visible", timeout: 30000 });
  metrics.openMs = Date.now() - started;
  const state = () =>
    page.evaluate(() => {
      const editor =
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
        d = editor.session.document(),
        counts = {};
      for (const entity of d.entities)
        counts[entity.kind] = (counts[entity.kind] ?? 0) + 1;
      const object = editor.session.entities.get("object-1-0");
      return {
        counts,
        total: d.entities.length,
        dirty: editor.session.dirty,
        history: editor.session.historySize,
        renderCount: editor.renderer.renderCount,
        lastRenderMs: editor.renderer.lastRenderMs,
        drawnObjects: [...editor.renderer.visuals.values()].filter(
          (visual) => visual.entity.kind === "object",
        ).length,
        floor: editor.renderer.floorId,
        object: object ? { x: object.x, y: object.y } : null,
      };
    });
  const digest = () =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(vault + "/" + mapPath))
      .digest("hex");
  if (restart) {
    const saved = JSON.parse(fs.readFileSync(source, "utf8"));
    assert.equal(digest(), saved.sha256);
    const reopened = await state();
    assert.equal(reopened.dirty, false);
    assert.deepEqual(reopened.counts, saved.counts);
    assert.deepEqual(reopened.object, saved.object);
    checks.push("Fresh native process reopens the exact large edited map");
    await sleep(1500);
    await page.screenshot({ path: out + "/large-reopened.png" });
    fs.writeFileSync(
      out + "/metrics.json",
      JSON.stringify({ ...metrics, reopened }, null, 2),
    );
    return;
  }
  let current = await state();
  assert.equal(current.total, 4292);
  metrics.overviewDrawnObjects = current.drawnObjects;
  assert.deepEqual(current.counts, {
    surface: 4,
    room: 192,
    door: 64,
    object: 4000,
    light: 32,
  });
  checks.push(
    "Large native map opens with two floors, complex surfaces, 4000 objects and 32 lights",
  );
  await sleep(2000);
  await page.screenshot({ path: out + "/large-overview.png" });
  const canvas = page.locator(".dn-canvas canvas"),
    box = await canvas.boundingBox();
  assert(box, "Canvas bounds");
  const panStarted = Date.now();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.56, {
    steps: 12,
  });
  await page.mouse.up({ button: "middle" });
  metrics.panMs = Date.now() - panStarted;
  const zoomStarted = Date.now();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -65);
  await page.keyboard.up("Control");
  metrics.zoomMs = Date.now() - zoomStarted;
  checks.push("Pan and zoom respond on the large retained scene");
  await editorAction("Geschosse");
  const floorStarted = Date.now();
  await page
    .locator('select[aria-label="Geschoss"]')
    .selectOption("floor-upper");
  await page.waitForFunction(
    () =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .renderer.floorId === "floor-upper",
  );
  metrics.floorSwitchMs = Date.now() - floorStarted;
  await page
    .locator('select[aria-label="Vergleichsgeschoss"]')
    .selectOption("floor-ground");
  await editorAction("Geschosse");
  checks.push(
    "Floor switch and aligned comparison overlay work on the large scene",
  );
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  const at = (point) =>
    page.evaluate((point) => {
      const renderer =
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
            .renderer,
        box = renderer.canvas.getBoundingClientRect();
      return {
        x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: box.y + renderer.camera.y + point.y * renderer.camera.scale,
      };
    }, point);
  const drag = async (a, b) => {
    a = await at(a);
    b = await at(b);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };
  await chooseTool("Auswahl");
  const target = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      reference = editor.session.entities.get("object-1-0");
    editor.renderer.focus(reference.id, 8);
    const e = editor.renderer.hitTest({ x: 10, y: 10 });
    return e?.kind === "object" ? { id: e.id, x: e.x, y: e.y } : null;
  });
  assert(target, "Selectable furniture at test point");
  metrics.focusDrawnObjects = (await state()).drawnObjects;
  await drag(
    { x: target.x, y: target.y },
    { x: target.x + 2, y: target.y + 1 },
  );
  const moved = await page.evaluate((id) => {
    const e = app.workspace
      .getLeavesOfType("dungeon-native-map")[0]
      .view.editor.session.entities.get(id);
    return { x: e.x, y: e.y };
  }, target.id);
  assert.deepEqual(moved, { x: target.x + 2, y: target.y + 1 });
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  checks.push("Furniture moves without rebuilding the model on the large map");
  const beforePaint = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      e = editor.session.entities.get("surface-material-1");
    return {
      history: editor.session.historySize,
      shape: JSON.stringify(e.polygons),
    };
  });
  await chooseTool("Material");
  const paintStarted = Date.now();
  await drag({ x: 15, y: 40 }, { x: 8, y: 40 });
  await page.waitForFunction(
    () =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .paintWorker,
    null,
    { timeout: 30000 },
  );
  metrics.paintMs = Date.now() - paintStarted;
  const afterPaint = await page.evaluate(() => {
    const editor =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor,
      e = editor.session.entities.get("surface-material-1");
    return {
      history: editor.session.historySize,
      shape: JSON.stringify(e.polygons),
      processing: editor.lastPaintMetrics,
    };
  });
  assert.equal(afterPaint.history, beforePaint.history + 1);
  assert.notEqual(afterPaint.shape, beforePaint.shape);
  metrics.paintProcessing = afterPaint.processing;
  checks.push(
    "Background material brush commits one complete large-map command",
  );
  await chooseTool("Licht");
  const lightAt = await at({ x: 102, y: 72 });
  await page.mouse.click(lightAt.x, lightAt.y);
  await page.locator('input[aria-label="Lichtstärke"]').fill("1.4");
  await page.locator('input[aria-label="Lichtstärke"]').press("Tab");
  await page.waitForFunction(
    () =>
      app.workspace
        .getLeavesOfType("dungeon-native-map")[0]
        .view.editor.session.document()
        .entities.filter((e) => e.kind === "light").length === 33,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  checks.push(
    "Light range, strength, color and shadows remain separate editable properties",
  );
  await page.screenshot({ path: out + "/large-edited.png", timeout: 30000 });
  const saveStarted = Date.now();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(
    () =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .session.dirty,
    null,
    { timeout: 30000 },
  );
  metrics.saveMs = Date.now() - saveStarted;
  current = await state();
  const saved = {
    path: mapPath,
    sha256: digest(),
    counts: current.counts,
    object: current.object,
  };
  fs.writeFileSync(source, JSON.stringify(saved, null, 2));
  checks.push("Large edited map saves without a fixed memory ceiling");
  const renders = current.renderCount;
  await sleep(1000);
  const idle = await state();
  metrics.idleAdditionalRenders = idle.renderCount - renders;
  metrics.lastRenderMs = idle.lastRenderMs;
  metrics.final = idle;
  fs.writeFileSync(out + "/metrics.json", JSON.stringify(metrics, null, 2));
}
(async () => {
  let failure;
  try {
    await main();
  } catch (error) {
    failure = error;
    console.error(error);
    if (page && !page.isClosed())
      try {
        fs.writeFileSync(
          out + "/failure-state.json",
          JSON.stringify(
            await page.evaluate(() => ({
              body: document.body.innerText,
              app:
                typeof app !== "undefined"
                  ? {
                      vault: app.vault?.adapter?.basePath,
                      workspace: !!app.workspace,
                      layoutReady: app.workspace?.layoutReady,
                      plugins: app.plugins
                        ? Object.keys(app.plugins.manifests)
                        : null,
                    }
                  : null,
            })),
            null,
            2,
          ),
        );
        await page.screenshot({ path: out + "/failure.png", timeout: 4000 });
      } catch {}
  } finally {
    await shutdown();
    const result = {
      run,
      checks,
      errors,
      guardFailure,
      peakBytes: peak,
      group: groupResult ? { id: groupResult.groupId, phase: groupResult.phase,
        complete: groupResult.complete, counts: groupResult.counts } : null,
      nativePathDialog: nativePathDialogResult ? {
        caseId: nativePathDialogResult.caseId,
        phase: nativePathDialogResult.phase,
        state: nativePathDialogResult.state,
        gap: nativePathDialogResult.gap,
      } : null,
      passed: !failure && !errors.length && !guardFailure,
    };
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(out + "/result.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (!result.passed) process.exitCode = 1;
  }
})();
