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
const root = path.resolve(__dirname, ".."),
  pluginRoot = process.env.DUNGEON_PLUGIN_ROOT || root,
  sourceVault = process.env.DUNGEON_SOURCE_VAULT || path.resolve(root, "../../.."),
  qa = process.env.DUNGEON_QA_ROOT || "/home/aaron/.cache/dungeon-native-qa",
  vault = qa + "/vault",
  debugPort = Number(process.env.DUNGEON_QA_PORT || 9226);
const restart = process.argv.includes("--restart"),
  v2Open = process.argv.includes("--v2-open"),
  patternOutline = process.argv.includes("--pattern-outline"),
  patternAlpha = process.argv.includes("--pattern-alpha") || patternOutline,
  prefabForget = process.argv.includes("--prefab-forget"),
  objectAlpha = process.argv.includes("--object-alpha"),
  phase2Object = process.argv.includes("--phase2-object"),
  phase3Object = process.argv.includes("--phase3-object"),
  phase4Key = process.argv.includes("--phase4-key"),
  phase5Feature = process.argv.includes("--phase5-feature"),
  phase6Migration = process.argv.includes("--phase6-migration"),
  parityPhase1 = process.argv.includes("--parity-phase1"),
  parityPhase1Shapes = process.argv.includes("--parity-phase1-shapes"),
  parityPhase1Repair = process.argv.includes("--parity-phase1-repair"),
  parityPhase2Points = process.argv.includes("--parity-phase2-points"),
  parityPhase3Building = process.argv.includes("--parity-phase3-building"),
  parityPhase3Wear = process.argv.includes("--parity-phase3-wear"),
  parityPhase4Objects = process.argv.includes("--parity-phase4-objects"),
  pathLibrary = process.argv.includes("--path-library"),
  large = process.argv.includes("--large"),
  compactSmoke = process.argv.includes("--compact-smoke"),
  selectionSmoke = process.argv.includes("--selection-smoke"),
  run = Date.now() + (parityPhase4Objects ? "-parity-phase4-objects" : parityPhase3Wear ? "-parity-phase3-wear" : parityPhase3Building ? "-parity-phase3-building" : parityPhase2Points ? "-parity-phase2-points" : parityPhase1Repair ? "-parity-phase1-repair" : parityPhase1Shapes ? "-parity-phase1-shapes" : parityPhase1 ? "-parity-phase1" : phase6Migration ? "-phase6-migration" : phase5Feature ? "-phase5-feature" : phase4Key ? "-phase4-key" : phase3Object ? "-phase3-object" : phase2Object ? "-phase2-object" : v2Open ? "-v2-open" : patternAlpha ? "-pattern-alpha" : prefabForget ? "-prefab-forget" : objectAlpha ? "-object-alpha" : pathLibrary ? "-path-library" : selectionSmoke ? "-selection" : compactSmoke ? "-compact" : large ? "-large" : "") + (restart ? "-reopen" : "-edit"),
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
  guardFailure;
const checks = [],
  errors = [];
let peak = 0;
const unit = "dungeon-native-" + process.pid;
const toolNavigation = {
  Auswahl: ["Auswahl", "Auswahl"],
  Punkte: ["Bauwerk", "Punkte bearbeiten"],
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
    if (patternAlpha || prefabForget || objectAlpha || pathLibrary)
      fs.rmSync(vault + "/.obsidian/plugins/dungeon-editor/data.json", { force: true });
    if (pathLibrary)
      fs.rmSync(vault + "/.obsidian/dungeon-editor-assets", { recursive: true, force: true });
    if (parityPhase4Objects)
      fs.rmSync(vault + "/.obsidian/dungeon-editor-assets/object-tags.json", { force: true });
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
    JSON.stringify(phase6Migration ? ["dungeon-editor", "dungeon-auswertung", "dnd-ot-spielansicht"] : ["dungeon-editor"]),
  );
  fs.writeFileSync(vault + "/.obsidian/app.json", "{}");
  fs.writeFileSync(
    vault + "/.obsidian/core-plugins.json",
    JSON.stringify({ "file-explorer": true, "command-palette": true, ...(phase6Migration ? { outline: true } : {}) }),
  );
  fs.writeFileSync(
    qa + "/config/obsidian/obsidian.json",
    JSON.stringify({
      vaults: { fedcba9876543210: { path: vault, ts: Date.now(), open: true } },
    }),
  );
  if (large && !restart) prepareLarge(vault);
  if (phase6Migration) {
    const stage = process.env.DUNGEON_PHASE6_STAGE;
    assert(stage && fs.existsSync(stage + "/migration.json"), "Phase-6-Ablage fehlt");
    if (!restart) {
      for (const dir of ["Dungeons/Drachenhöhle", "Dungeons/_System"])
        fs.cpSync(path.join(sourceVault, dir), path.join(vault, dir), { recursive: true });
      const manifest = JSON.parse(fs.readFileSync(stage + "/migration.json", "utf8"));
      for (const item of manifest.stagedFiles) {
        const destination = path.join(vault, item.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(stage, item.path), destination);
      }
      for (const room of manifest.rooms) fs.rmSync(path.join(vault, room.path));
    }
    for (const plugin of ["dungeon-auswertung", "dnd-ot-spielansicht"])
      fs.mkdirSync(path.join(vault, ".obsidian/plugins", plugin), { recursive: true });
    const sourcePlugins = path.join(sourceVault, ".obsidian/plugins");
    for (const plugin of ["dungeon-auswertung", "dnd-ot-spielansicht"])
      fs.copyFileSync(path.join(sourcePlugins, plugin, "manifest.json"), path.join(vault, ".obsidian/plugins", plugin, "manifest.json"));
    fs.copyFileSync(path.join(stage, "dungeon-auswertung-main.js"), path.join(vault, ".obsidian/plugins/dungeon-auswertung/main.js"));
    fs.copyFileSync(path.join(sourcePlugins, "dungeon-auswertung/styles.css"), path.join(vault, ".obsidian/plugins/dungeon-auswertung/styles.css"));
    for (const name of ["core.js", "format2.js", "fast.js", "sections.js", "worker.js"])
      fs.copyFileSync(path.join(sourcePlugins, "dungeon-auswertung", name), path.join(vault, ".obsidian/plugins/dungeon-auswertung", name));
    fs.copyFileSync(path.join(root, "tools/spielansicht/main.js"), path.join(vault, ".obsidian/plugins/dnd-ot-spielansicht/main.js"));
    fs.copyFileSync(path.join(root, "tools/spielansicht/styles.css"), path.join(vault, ".obsidian/plugins/dnd-ot-spielansicht/styles.css"));
  }
  if (compactSmoke) {
    const dungeon = "Dungeons/Drachenhöhle/Karte.dungeon";
    fs.mkdirSync(path.dirname(vault + "/" + dungeon), { recursive: true });
    fs.copyFileSync(path.resolve(sourceVault, dungeon), vault + "/" + dungeon);
  }
  if ((phase2Object || phase3Object) && !restart) {
    const source = path.join(sourceVault, "Dungeons/Drachenhöhle");
    assert(fs.existsSync(path.join(source, "Karte.dungeon")), "Phase-1-Kopie fehlt");
    fs.cpSync(source, path.join(vault, "Dungeons/Drachenhöhle"), { recursive: true });
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
      format: "dungeon-map", version: 3, id: "selection-smoke",
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
  if ((parityPhase1 || parityPhase1Shapes) && !restart) {
    const dungeon = "Dungeons/Parity/Karte.dungeon";
    fs.mkdirSync(path.dirname(vault + "/" + dungeon), { recursive: true });
    fs.writeFileSync(vault + "/" + dungeon, JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase1",
      settings: { name: "Parity", width: 24, height: 18, feetPerField: 5,
        wallShadows: false, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2));
    fs.writeFileSync(vault + "/Dungeons/Parity/Portal.dungeon", JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase1-portal",
      settings: { name: "Portalradierung", width: 8, height: 8, feetPerField: 5,
        wallShadows: false, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [
        { id: "building-1", kind: "building", floorId: "floor-1",
          polygons: [{ outer: [{ x: 2, y: 2 }, { x: 6, y: 2 },
            { x: 6, y: 6 }, { x: 2, y: 6 }], holes: [] }],
          layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2 },
        { id: "door-1", kind: "door", floorId: "floor-1",
          anchor: { boundaryId: "building-1", contour: 0, at: 0.125 },
          width: 1, variant: "door" },
      ],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2));
    fs.writeFileSync(vault + "/Dungeons/Parity/Kurve.dungeon", JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase1-curve",
      settings: { name: "Diagonal-Kurve", width: 8, height: 8, feetPerField: 5,
        wallShadows: false, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2));
    fs.writeFileSync(vault + "/Dungeons/Parity/Mehrkurve.dungeon", JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase1-multi-curve",
      settings: { name: "Mehrkurve", width: 8, height: 8, feetPerField: 5,
        wallShadows: false, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2));
    for (const name of ["Form-Rechteck", "Form-Ellipse", "Form-Gang", "Form-Kreuzung", "Form-Snap"]) {
      fs.writeFileSync(vault + "/Dungeons/Parity/" + name + ".dungeon", JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase1-" + name,
        settings: { name, width: 8, height: 8, feetPerField: 5,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }
  }
  if (parityPhase1Repair && !restart) {
    fs.mkdirSync(vault + "/Dungeons/Parity", { recursive: true });
    for (const name of ["Repair-Preview", "Repair-Room", "Repair-Snap"]) {
      fs.writeFileSync(vault + "/Dungeons/Parity/" + name + ".dungeon", JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase1-" + name,
        settings: { name, width: 8, height: 8, feetPerField: 5,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }
  }
  if (parityPhase2Points && !restart) {
    const destination = vault + "/Dungeons/Parity/Punkte.dungeon";
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const ellipse = Array.from({ length: 32 }, (_, index) => {
      const angle = index * Math.PI * 2 / 32;
      return { x: 12 + 2 * Math.cos(angle), y: 4 + 2 * Math.sin(angle) };
    });
    fs.writeFileSync(destination, JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase2-points",
      settings: { name: "Punktgesten", width: 20, height: 16,
        feetPerField: 5, wallShadows: true, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [
        { id: "rect", kind: "building", floorId: "floor-1", number: "1",
          name: "Punktraum", note: { path: "Dungeons/Parity/Räume/01 Punktraum.md" },
          polygons: [{ outer: [{ x: 2, y: 2 }, { x: 6, y: 2 },
            { x: 6, y: 6 }, { x: 2, y: 6 }], holes: [] }],
          layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2 },
        { id: "ellipse", kind: "building", floorId: "floor-1",
          polygons: [{ outer: ellipse, holes: [] }],
          layer: 200, fill: 0xaba08c, wall: 0x403e39, wallWidth: 0.2 },
        { id: "triangle", kind: "building", floorId: "floor-1",
          polygons: [{ outer: [{ x: 2, y: 10 }, { x: 6, y: 10 },
            { x: 6, y: 14 }], holes: [] }],
          layer: 200, fill: 0xc4b397, wall: 0x403e39, wallWidth: 0.2 },
        { id: "triangle-door", kind: "door", floorId: "floor-1",
          anchor: { boundaryId: "triangle", contour: 0, at: 0.15 },
          width: 0.7, variant: "door" },
        { id: "triangle-door-2", kind: "door", floorId: "floor-1",
          anchor: { boundaryId: "triangle", contour: 0, at: 0.6 },
          width: 0.7, variant: "door" },
      ],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2));
    fs.writeFileSync(vault + "/Dungeons/Parity/Punkte-Konturen.dungeon", JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase2-outlines",
      settings: { name: "Mehrteil und Innenloch", width: 20, height: 12,
        feetPerField: 5, wallShadows: true, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [
        { id: "multipart", kind: "building", floorId: "floor-1",
          polygons: [
            { outer: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 4 }], holes: [] },
            { outer: [{ x: 6, y: 2 }, { x: 8, y: 2 }, { x: 7, y: 4 }], holes: [] },
          ], layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2 },
        { id: "hole", kind: "building", floorId: "floor-1",
          polygons: [{ outer: [{ x: 11, y: 2 }, { x: 17, y: 2 },
            { x: 17, y: 8 }, { x: 11, y: 8 }],
            holes: [[{ x: 13, y: 4 }, { x: 15, y: 4 }, { x: 14, y: 6 }]] }],
          layer: 200, fill: 0xaba08c, wall: 0x403e39, wallWidth: 0.2 },
      ],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2));
    const note = vault + "/Dungeons/Parity/Räume/01 Punktraum.md";
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, "# 01 Punktraum\r\n\r\nUnveränderter QA-Text.\r\n");
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
      mode: (parityPhase4Objects ? "parity-phase4-objects-" : parityPhase3Wear ? "parity-phase3-wear-" : parityPhase3Building ? "parity-phase3-building-" : parityPhase2Points ? "parity-phase2-points-" : parityPhase1Repair ? "parity-phase1-repair-" : parityPhase1Shapes ? "parity-phase1-shapes-" : parityPhase1 ? "parity-phase1-" : phase5Feature ? "phase5-feature-" : phase4Key ? "phase4-key-" : phase3Object ? "phase3-object-" : phase2Object ? "phase2-object-" : v2Open ? "v2-open-" : patternAlpha ? "pattern-alpha-" : prefabForget ? "prefab-forget-" : objectAlpha ? "object-alpha-" : pathLibrary ? "path-library-" : selectionSmoke ? "selection-" : compactSmoke ? "compact-" : large ? "large-" : "") + (restart ? "restart" : "edit"),
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
      ...(process.argv.includes("--force-srgb")
        ? ["--force-color-profile=srgb"] : []),
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
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  page.on("console", (e) => {
    if (e.type() === "error")
      fs.appendFileSync(out + "/console.log", e.text() + "\n");
  });
  if (parityPhase3Building) {
    let ready = false, observed;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        observed = await page.evaluate(() => typeof app === "undefined" ? null : ({
          vault: app.vault?.adapter?.basePath,
          layoutReady: app.workspace?.layoutReady,
        }));
        if (observed?.vault === vault && observed.layoutReady) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(500);
    }
    assert(ready, `Obsidian startup: ${JSON.stringify({ expected: vault, observed })}`);
  } else await page.waitForFunction(
    (expected) => typeof app !== "undefined" &&
      app.vault?.adapter?.basePath === expected && app.workspace?.layoutReady,
    vault, { timeout: parityPhase3Wear || parityPhase4Objects ? 90000 : 30000 },
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
  const scenarioContext = { page, fs, path, assert, crypto, PNG, root, qa, vault, sourceVault, restart, out, checks, chooseTool, editorAction, waitForFileAbsent, sleep };
  if (parityPhase4Objects) {
    const scenario = require("./host/parity-phase4-objects.cjs")(scenarioContext);
    if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  if (parityPhase3Wear) {
    const scenario = require("./host/parity-phase3-wear.cjs")(scenarioContext);
    if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  const selectionScenarios = require("./host/selection.cjs")(scenarioContext);
  const assetScenarios = require("./host/assets.cjs")(scenarioContext);
  const phaseScenarios = require("./host/phases.cjs")(scenarioContext);
  const appearanceScenarios = require("./host/appearance.cjs")(scenarioContext);
  const layoutScenarios = require("./host/layout.cjs")(scenarioContext);
  if (parityPhase1) {
    const scenario = require("./host/parity-phase1.cjs")(scenarioContext);
    if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  if (parityPhase1Shapes) {
    const scenario = require("./host/parity-phase1-shapes.cjs")(scenarioContext);
    if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  if (parityPhase1Repair) {
    const scenario = require("./host/parity-phase1-repair.cjs")(scenarioContext);
    if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  if (parityPhase2Points) {
    const scenario = require("./host/parity-phase2-points.cjs")(scenarioContext);
    if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  if (parityPhase3Building) {
    if (process.argv.includes("--cleanup-preview-benchmark")) {
      await require("./host/parity-phase3-cleanup-benchmark.cjs")(scenarioContext).edit();
      return;
    }
    if (process.argv.includes("--contour-extensions")) {
      const scenario = require("./host/parity-phase3-contour-extensions.cjs")(scenarioContext);
      if (restart) await scenario.reopen();
      else await scenario.edit();
      return;
    }
    if (process.argv.includes("--bevel-matrix")) {
      const scenario = require("./host/parity-phase3-bevel-matrix.cjs")(scenarioContext);
      if (restart) await scenario.reopen();
      else await scenario.edit();
      return;
    }
    if (process.argv.includes("--point-style")) {
      const scenario = require("./host/parity-phase3-point-style.cjs")(scenarioContext);
      if (restart) await scenario.reopen();
      else await scenario.edit();
      return;
    }
    const scenario = require("./host/parity-phase3-building.cjs")(scenarioContext);
    if (process.argv.includes("--same-card")) await scenario.sameCard(restart);
    else if (process.argv.includes("--field-known-start")) await scenario.fieldKnownStart(restart);
    else if (process.argv.includes("--field-matrix")) await scenario.fieldMatrix(restart);
    else if (process.argv.includes("--shared-picker-contexts")) await scenario.sharedPickerContexts(restart);
    else if (process.argv.includes("--gallery-pipette")) await scenario.galleryPipette();
    else if (process.argv.includes("--floor-gallery-24")) await scenario.floorGallery24(restart);
    else if (process.argv.includes("--floor-gallery-pair")) await scenario.floorGallery24(restart, true);
    else if (process.argv.includes("--wall-gallery-10")) await scenario.wallGallery10(restart);
    else if (process.argv.includes("--wall-tint-matrix")) await scenario.wallTintMatrix(restart);
    else if (process.argv.includes("--floor-tint-matrix")) await scenario.floorTintMatrix(restart);
    else if (process.argv.includes("--custom-floor-matrix")) await scenario.customFloorMatrix(restart);
    else if (process.argv.includes("--normal-floor-matrix")) await scenario.customFloorMatrix(restart, true);
    else if (process.argv.includes("--picker-pair")) await scenario.pickerPair(restart);
    else if (process.argv.includes("--floor-mosaic"))
      await scenario.floorMosaic(restart, process.argv.includes("--default-tint"));
    else if (process.argv.includes("--floor-variant")) await scenario.floorVariant(restart);
    else if (process.argv.includes("--portal-visual"))
      await scenario.portalVisual(process.argv.includes("--portal-two-doors"),
        process.argv.includes("--portal-layer-probe"),
        process.argv.includes("--portal-bevel-off"));
    else if (process.argv.includes("--visual-match"))
      await scenario.visualMatch(process.argv.includes("--wall-tint-pair"),
        process.argv.includes("--wall-zero-alpha"),
        process.argv.includes("--wall-no-shadow"),
        process.argv.includes("--wall-blend-probe"),
        process.argv.includes("--bevel-mask-probe"),
        process.argv.includes("--wall-gl-probe"));
    else if (process.argv.includes("--verify-combined")) await scenario.verifyCombined();
    else if (process.argv.includes("--combined")) await scenario.combined();
    else if (restart) await scenario.reopen();
    else await scenario.edit();
    return;
  }
  if (phase5Feature) {
    await phaseScenarios.phase5FeatureWorkflow();
    return;
  }
  if (phase6Migration) {
    await phaseScenarios.phase6MigrationWorkflow();
    return;
  }
  if (phase4Key) {
    await phaseScenarios.phase4KeyWorkflow();
    return;
  }
  if (phase3Object) {
    await phaseScenarios.phase3ObjectWorkflow(view);
    return;
  }
  if (phase2Object) {
    await phaseScenarios.phase2ObjectWorkflow(view);
    return;
  }
  if (v2Open) {
    await appearanceScenarios.v2OpenWorkflow(view);
    return;
  }
  if (patternAlpha) {
    await appearanceScenarios.patternAlphaWorkflow(view);
    return;
  }
  if (prefabForget) {
    await assetScenarios.prefabForgetWorkflow(view);
    return;
  }
  if (objectAlpha) {
    await appearanceScenarios.objectAlphaWorkflow(view);
    return;
  }
  if (pathLibrary) {
    await assetScenarios.pathLibraryWorkflow(view);
    return;
  }
  if (compactSmoke) {
    await layoutScenarios.compactWorkflow();
    return;
  }
  if (selectionSmoke) {
    if (restart) await selectionScenarios.selectionReopenWorkflow();
    else await selectionScenarios.selectionWorkflow();
    return;
  }
  if (large) {
    await layoutScenarios.largeWorkflow();
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
      passed: !failure && !errors.length && !guardFailure,
    };
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(out + "/result.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (!result.passed) process.exitCode = 1;
  }
})();
