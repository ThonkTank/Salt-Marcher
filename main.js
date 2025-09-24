"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/apps/encounter/view.ts
var view_exports = {};
__export(view_exports, {
  EncounterView: () => EncounterView,
  VIEW_ENCOUNTER: () => VIEW_ENCOUNTER
});
var import_obsidian, VIEW_ENCOUNTER, EncounterView;
var init_view = __esm({
  "src/apps/encounter/view.ts"() {
    "use strict";
    import_obsidian = require("obsidian");
    VIEW_ENCOUNTER = "salt-encounter";
    EncounterView = class extends import_obsidian.ItemView {
      getViewType() {
        return VIEW_ENCOUNTER;
      }
      getDisplayText() {
        return "Encounter";
      }
      getIcon() {
        return "swords";
      }
      async onOpen() {
        this.contentEl.addClass("sm-encounter-view");
        this.contentEl.empty();
        this.contentEl.createEl("h2", { text: "Encounter" });
        this.contentEl.createDiv({ text: "", cls: "desc" });
      }
      async onClose() {
        this.contentEl.empty();
        this.contentEl.removeClass("sm-encounter-view");
      }
    };
  }
});

// src/core/options.ts
function parseOptions(src) {
  const blockMatch = src.match(/```[\t ]*hex3x3\b[\s\S]*?\n([\s\S]*?)\n```/i);
  const body = blockMatch ? blockMatch[1] : src;
  const d = { folder: "Hexes", folderPrefix: "Hex", prefix: "hex", radius: 42 };
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = /^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === "folder") d.folder = v;
    else if (k === "folderprefix") d.folderPrefix = v;
    else if (k === "prefix") d.prefix = v;
    else if (k === "radius") {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 10) d.radius = n;
    }
  }
  if (!d.folderPrefix && d.prefix) d.folderPrefix = d.prefix;
  if (!(d.radius > 0)) d.radius = 42;
  if (d.radius < 12) d.radius = 12;
  return d;
}
var init_options = __esm({
  "src/core/options.ts"() {
    "use strict";
  }
});

// src/core/layout.ts
var layout_exports = {};
__export(layout_exports, {
  getCenterLeaf: () => getCenterLeaf,
  getRightLeaf: () => getRightLeaf
});
function getRightLeaf(app) {
  console.log("[Layout] Requesting right leaf...");
  const leaf = app.workspace.getRightLeaf(false) ?? app.workspace.getRightLeaf(true) ?? app.workspace.getLeaf(true);
  console.log("[Layout] Right leaf resolved:", leaf);
  return leaf;
}
function getCenterLeaf(app) {
  const leaf = app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf(false) ?? app.workspace.getLeaf(true);
  console.log("[Layout] Center leaf resolved:", leaf);
  return leaf;
}
var init_layout = __esm({
  "src/core/layout.ts"() {
    "use strict";
  }
});

// src/core/hex-mapper/hex-notes.ts
var hex_notes_exports = {};
__export(hex_notes_exports, {
  deleteTile: () => deleteTile,
  initTilesForNewMap: () => initTilesForNewMap,
  listTilesForMap: () => listTilesForMap,
  loadTile: () => loadTile,
  saveTile: () => saveTile
});
function mapNameFromPath(mapPath) {
  const base = mapPath.replace(/\\/g, "/").split("/").pop() || "Map";
  return base.replace(/\.md$/i, "");
}
function safeBaseName(name) {
  return name.trim().replace(/[\\\/:*?"<>|]/g, "_").replace(/\s+/g, " ");
}
function fileNameForMap(mapFile, coord) {
  const base = safeBaseName(mapNameFromPath(mapFile.path));
  return `${base}-${coord.r},${coord.c}.md`;
}
function legacyFilenames(folderPrefix, coord) {
  return [
    `${folderPrefix} ${coord.r},${coord.c}.md`,
    // z.B. "Hex 1,2.md"
    `${folderPrefix}-r${coord.r}-c${coord.c}.md`
    // z.B. "Hex-r1-c2.md"
  ];
}
async function readOptions(app, mapFile) {
  const raw = await app.vault.read(mapFile);
  const opts = parseOptions(raw);
  const folder = (opts.folder ?? "Hexes").toString().trim();
  const folderPrefix = (opts.folderPrefix ?? "Hex").toString().trim();
  return { folder, folderPrefix };
}
async function ensureFolder(app, folderPath) {
  const path = (0, import_obsidian3.normalizePath)(folderPath);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing && existing instanceof import_obsidian3.TFolder) return existing;
  if (existing) throw new Error(`Pfad existiert, ist aber kein Ordner: ${path}`);
  await app.vault.createFolder(path);
  const created = app.vault.getAbstractFileByPath(path);
  if (!(created && created instanceof import_obsidian3.TFolder)) throw new Error(`Ordner konnte nicht erstellt werden: ${path}`);
  return created;
}
function fm(app, file) {
  return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
}
function buildMarkdown(coord, mapPath, folderPrefix, data) {
  const terrain = data.terrain ?? "";
  const region = (data.region ?? "").trim();
  const mapName = mapNameFromPath(mapPath);
  const bodyNote = (data.note ?? "Notizen hier \u2026").trim();
  return [
    "---",
    `type: ${FM_TYPE}`,
    `smHexTile: true`,
    `region: "${region}"`,
    `row: ${coord.r}`,
    `col: ${coord.c}`,
    `map_path: "${mapPath}"`,
    `terrain: "${terrain}"`,
    "---",
    `[[${mapName}|\u21A9 Zur Karte]]`,
    `# ${folderPrefix} r${coord.r} c${coord.c}`,
    "",
    bodyNote,
    ""
  ].join("\n");
}
async function resolveTilePath(app, mapFile, coord) {
  const { folder, folderPrefix } = await readOptions(app, mapFile);
  const folderPath = (0, import_obsidian3.normalizePath)(folder);
  const newName = fileNameForMap(mapFile, coord);
  const newPath = `${folderPath}/${newName}`;
  const legacy = legacyFilenames(folderPrefix, coord).map((n) => `${folderPath}/${n}`);
  let file = app.vault.getAbstractFileByPath(newPath);
  if (!file) {
    for (const oldPath of legacy) {
      const oldFile = app.vault.getAbstractFileByPath(oldPath);
      if (oldFile) {
        await app.fileManager.renameFile(oldFile, newPath);
        break;
      }
    }
    file = app.vault.getAbstractFileByPath(newPath);
  }
  return { folder: folderPath, newPath, file };
}
function parseFrontmatterBlock(src) {
  const m = src.match(/^---\s*([\s\S]*?)\s*---/m);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*)\s*$/);
    if (!mm) continue;
    let val = mm[2].trim();
    if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    if (/^-?\d+$/.test(val)) obj[mm[1]] = Number(val);
    else obj[mm[1]] = val;
  }
  return obj;
}
async function fmFromFile(app, file) {
  const raw = await app.vault.read(file);
  return parseFrontmatterBlock(raw);
}
async function listTilesForMap(app, mapFile) {
  const { folder } = await readOptions(app, mapFile);
  const folderPath = (0, import_obsidian3.normalizePath)(folder);
  const folderPrefix = (folderPath.endsWith("/") ? folderPath : folderPath + "/").toLowerCase();
  const out = [];
  for (const child of app.vault.getFiles()) {
    const p = child.path.toLowerCase();
    if (!p.startsWith(folderPrefix)) continue;
    if (!p.endsWith(".md")) continue;
    let fmc = fm(app, child);
    if (!fmc || fmc.type !== FM_TYPE) {
      fmc = await fmFromFile(app, child);
    }
    if (!fmc || fmc.type !== FM_TYPE) continue;
    if (typeof fmc.map_path !== "string" || fmc.map_path !== mapFile.path) continue;
    const r = Number(fmc.row), c = Number(fmc.col);
    if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
    out.push({
      coord: { r, c },
      file: child,
      data: { terrain: (typeof fmc.terrain === "string" ? fmc.terrain : "") ?? "" }
    });
  }
  return out;
}
async function loadTile(app, mapFile, coord) {
  const { file } = await resolveTilePath(app, mapFile, coord);
  if (!file) return null;
  let fmc = fm(app, file);
  if (!fmc || fmc.type !== FM_TYPE) {
    fmc = await fmFromFile(app, file);
  }
  if (!fmc || fmc.type !== FM_TYPE) return null;
  const raw = await app.vault.read(file);
  const body = raw.replace(/^---[\s\S]*?---\s*/m, "");
  const note = (body.split(/\n{2,}/).map((s) => s.trim()).find(Boolean) ?? "").trim();
  return {
    terrain: (typeof fmc.terrain === "string" ? fmc.terrain : "") ?? "",
    region: (typeof fmc.region === "string" ? fmc.region : "") ?? "",
    note: note || void 0
  };
}
async function saveTile(app, mapFile, coord, data) {
  const mapPath = mapFile.path;
  const { folder, newPath, file } = await resolveTilePath(app, mapFile, coord);
  await ensureFolder(app, folder);
  if (!file) {
    const { folderPrefix } = await readOptions(app, mapFile);
    const md = buildMarkdown(coord, mapPath, folderPrefix, data);
    return await app.vault.create(newPath, md);
  }
  await app.fileManager.processFrontMatter(file, (f) => {
    f.type = FM_TYPE;
    f.smHexTile = true;
    f.row = coord.r;
    f.col = coord.c;
    f.map_path = mapPath;
    if (data.region !== void 0) f.region = data.region ?? "";
    if (data.terrain !== void 0) f.terrain = data.terrain ?? "";
    if (typeof f.terrain !== "string") f.terrain = "";
  });
  if (data.note !== void 0) {
    const raw = await app.vault.read(file);
    const hasFM = /^---[\s\S]*?---/m.test(raw);
    const fmPart = hasFM ? (raw.match(/^---[\s\S]*?---/m) || [""])[0] : "";
    const body = hasFM ? raw.slice(fmPart.length).trimStart() : raw;
    const lines = body.split("\n");
    const keepBacklink = lines.find((l) => /\[\[.*\|\s*↩ Zur Karte\s*\]\]/.test(l));
    const newBody = [keepBacklink ?? "", data.note.trim(), ""].filter(Boolean).join("\n");
    await app.vault.modify(file, `${fmPart}
${newBody}`.trim() + "\n");
  }
  return file;
}
async function deleteTile(app, mapFile, coord) {
  const { file } = await resolveTilePath(app, mapFile, coord);
  if (!file) return;
  await app.vault.delete(file);
}
async function initTilesForNewMap(app, mapFile) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      await saveTile(app, mapFile, { r, c }, { terrain: "" });
    }
  }
}
var import_obsidian3, FM_TYPE;
var init_hex_notes = __esm({
  "src/core/hex-mapper/hex-notes.ts"() {
    "use strict";
    import_obsidian3 = require("obsidian");
    init_options();
    FM_TYPE = "hex";
  }
});

// src/core/regions-store.ts
var regions_store_exports = {};
__export(regions_store_exports, {
  REGIONS_FILE: () => REGIONS_FILE,
  ensureRegionsFile: () => ensureRegionsFile,
  loadRegions: () => loadRegions,
  parseRegionsBlock: () => parseRegionsBlock,
  saveRegions: () => saveRegions,
  stringifyRegionsBlock: () => stringifyRegionsBlock,
  watchRegions: () => watchRegions
});
async function ensureRegionsFile(app) {
  const p = (0, import_obsidian11.normalizePath)(REGIONS_FILE);
  const existing = app.vault.getAbstractFileByPath(p);
  if (existing instanceof import_obsidian11.TFile) return existing;
  await app.vault.createFolder(p.split("/").slice(0, -1).join("/")).catch(() => {
  });
  const body = [
    "---",
    "smList: true",
    "---",
    "# Regions",
    "",
    "```regions",
    "# Name: Terrain",
    "# Beispiel:",
    "# Saltmarsh: K\xFCste",
    "```",
    ""
  ].join("\n");
  return await app.vault.create(p, body);
}
function parseRegionsBlock(md) {
  const m = md.match(BLOCK_RE2);
  if (!m) return [];
  const out = [];
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const mm = line.match(/^("?)(.*?)\1\s*:\s*(.*)$/);
    if (!mm) continue;
    const name = (mm[2] || "").trim();
    const rest = (mm[3] || "").trim();
    let terrain = rest;
    let encounterOdds = void 0;
    const em = rest.match(/,\s*encounter\s*:\s*([^,]+)\s*$/i);
    if (em) {
      terrain = rest.slice(0, em.index).trim();
      const spec = em[1].trim();
      const frac = spec.match(/^1\s*\/\s*(\d+)$/);
      if (frac) encounterOdds = parseInt(frac[1], 10) || void 0;
      else {
        const n = parseInt(spec, 10);
        if (Number.isFinite(n) && n > 0) encounterOdds = n;
      }
    }
    out.push({ name, terrain, encounterOdds });
  }
  return out;
}
function stringifyRegionsBlock(list) {
  const lines = list.map((r) => {
    const base = `${r.name}: ${r.terrain || ""}`;
    const n = r.encounterOdds;
    return n && n > 0 ? `${base}, encounter: 1/${n}` : base;
  });
  return ["```regions", ...lines, "```"].join("\n");
}
async function loadRegions(app) {
  const f = await ensureRegionsFile(app);
  const md = await app.vault.read(f);
  return parseRegionsBlock(md);
}
async function saveRegions(app, list) {
  const f = await ensureRegionsFile(app);
  const md = await app.vault.read(f);
  const block = stringifyRegionsBlock(list);
  const replaced = md.match(BLOCK_RE2) ? md.replace(BLOCK_RE2, block) : md + "\n\n" + block + "\n";
  await app.vault.modify(f, replaced);
}
function watchRegions(app, onChange) {
  const handler = async (file) => {
    if (file.path !== REGIONS_FILE) return;
    app.workspace.trigger?.("salt:regions-updated");
    onChange?.();
  };
  app.vault.on("modify", handler);
  app.vault.on("delete", handler);
  return () => {
    app.vault.off("modify", handler);
    app.vault.off("delete", handler);
  };
}
var import_obsidian11, REGIONS_FILE, BLOCK_RE2;
var init_regions_store = __esm({
  "src/core/regions-store.ts"() {
    "use strict";
    import_obsidian11 = require("obsidian");
    REGIONS_FILE = "SaltMarcher/Regions.md";
    BLOCK_RE2 = /```regions\s*([\s\S]*?)```/i;
  }
});

// src/app/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SaltMarcherPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian23 = require("obsidian");
init_view();

// src/apps/cartographer/index.ts
var import_obsidian12 = require("obsidian");

// src/apps/cartographer/view-shell.ts
init_options();

// src/ui/modals.ts
var import_obsidian2 = require("obsidian");
var NameInputModal = class extends import_obsidian2.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.value = "";
    this.placeholder = "Neue Hex Map";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Name der neuen Karte" });
    let inputEl;
    new import_obsidian2.Setting(contentEl).addText((t) => {
      t.setPlaceholder(this.placeholder).onChange((v) => this.value = v.trim());
      inputEl = t.inputEl;
    }).addButton(
      (b) => b.setButtonText("Erstellen").setCta().onClick(() => this.submit())
    );
    this.scope.register([], "Enter", () => this.submit());
    queueMicrotask(() => inputEl?.focus());
  }
  onClose() {
    this.contentEl.empty();
  }
  submit() {
    const name = this.value || this.placeholder;
    this.close();
    this.onSubmit(name);
  }
};
var MapSelectModal = class extends import_obsidian2.FuzzySuggestModal {
  constructor(app, files, onChoose) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
    this.setPlaceholder("Karte suchen\u2026");
  }
  getItems() {
    return this.files;
  }
  getItemText(f) {
    return f.basename;
  }
  onChooseItem(f) {
    this.onChoose(f);
  }
};

// src/core/map-list.ts
async function getAllMapFiles(app) {
  const mdFiles = app.vault.getMarkdownFiles();
  const results = [];
  const rx = /```[\t ]*hex3x3\b[\s\S]*?```/i;
  for (const f of mdFiles) {
    const content = await app.vault.cachedRead(f);
    if (rx.test(content)) results.push(f);
  }
  return results.sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0));
}
async function getFirstHexBlock(app, file) {
  const content = await app.vault.cachedRead(file);
  const m = content.match(/```[\t ]*hex3x3\b\s*\n([\s\S]*?)\n```/i);
  return m ? m[1].trim() : null;
}

// src/core/hex-mapper/hex-render.ts
var import_obsidian4 = require("obsidian");
init_layout();

// src/core/hex-mapper/hex-geom.ts
var SQRT3 = Math.sqrt(3);
function oddrToAxial(rc) {
  const parity = rc.r & 1;
  const q = rc.c - (rc.r - parity) / 2;
  return { q, r: rc.r };
}
function axialToOddr(ax) {
  const parity = ax.r & 1;
  const c = ax.q + (ax.r - parity) / 2;
  return { r: ax.r, c: Math.round(c) };
}
function axialToCube(ax) {
  return { q: ax.q, r: ax.r, s: -ax.q - ax.r };
}
function cubeToAxial(cu) {
  return { q: cu.q, r: cu.r };
}
function cubeDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}
function cubeLerp(a, b, t) {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t
  };
}
function cubeRound(fr) {
  let q = Math.round(fr.q), r = Math.round(fr.r), s = Math.round(fr.s);
  const qd = Math.abs(q - fr.q), rd = Math.abs(r - fr.r), sd = Math.abs(s - fr.s);
  if (qd > rd && qd > sd) q = -r - s;
  else if (rd > sd) r = -q - s;
  else s = -q - r;
  return { q, r, s };
}
function lineOddR(a, b) {
  const A = axialToCube(oddrToAxial(a));
  const B = axialToCube(oddrToAxial(b));
  const N = cubeDistance(A, B);
  const out = [];
  for (let i = 0; i <= N; i++) {
    const t = N === 0 ? 0 : i / N;
    const p = cubeRound(cubeLerp(A, B, t));
    out.push(axialToOddr(cubeToAxial(p)));
  }
  return out;
}
function hexPolygonPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = (60 * i - 90) * Math.PI / 180;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}

// src/core/hex-mapper/hex-render.ts
init_hex_notes();

// src/core/hex-mapper/camera.ts
function attachCameraControls(svg, contentG, opts, extraTargets = []) {
  let scale = 1;
  let tx = 0, ty = 0;
  let panning = false;
  let lastX = 0, lastY = 0;
  svg.style.touchAction = "none";
  const apply = () => {
    contentG.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
  };
  apply();
  const svgPoint = (clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const normalizeDelta = (ev) => ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * 360 : ev.deltaY;
  const onWheel = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const dy = normalizeDelta(ev);
    const factor = Math.exp(-dy * 1e-3 * (opts.zoomSpeed || 1));
    const newScale = Math.max(opts.minScale, Math.min(opts.maxScale, scale * factor));
    if (newScale === scale) return;
    const { x: sx, y: sy } = svgPoint(ev.clientX, ev.clientY);
    const wx = (sx - tx) / scale, wy = (sy - ty) / scale;
    scale = newScale;
    tx = sx - wx * scale;
    ty = sy - wy * scale;
    apply();
  };
  const onPointerDown = (ev) => {
    if (ev.button !== 1) return;
    ev.preventDefault();
    ev.stopPropagation();
    panning = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    ev.target.setPointerCapture?.(ev.pointerId);
    svg.style.cursor = "grabbing";
  };
  const onPointerMove = (ev) => {
    if (!panning) return;
    ev.preventDefault();
    ev.stopPropagation();
    const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    tx += dx;
    ty += dy;
    apply();
  };
  const endPan = (ev) => {
    if (!panning) return;
    if (ev instanceof PointerEvent) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.target.releasePointerCapture?.(ev.pointerId);
    }
    panning = false;
    svg.style.cursor = "";
  };
  const targets = [svg, ...extraTargets];
  for (const t of targets) {
    t.addEventListener("wheel", onWheel, { passive: false });
    t.addEventListener("pointerdown", onPointerDown);
    t.addEventListener("pointermove", onPointerMove);
    t.addEventListener("pointerup", endPan);
    t.addEventListener("pointercancel", endPan);
    t.addEventListener("pointerleave", endPan);
    t.style.touchAction = "none";
  }
  window.addEventListener("blur", endPan);
  return () => {
    for (const t of targets) {
      t.removeEventListener("wheel", onWheel);
      t.removeEventListener("pointerdown", onPointerDown);
      t.removeEventListener("pointermove", onPointerMove);
      t.removeEventListener("pointerup", endPan);
      t.removeEventListener("pointercancel", endPan);
      t.removeEventListener("pointerleave", endPan);
    }
    window.removeEventListener("blur", endPan);
  };
}

// src/core/terrain.ts
var DEFAULT_TERRAIN_COLORS = Object.freeze({
  "": "transparent",
  Wald: "#2e7d32",
  Meer: "#0288d1",
  Berg: "#6d4c41"
});
var DEFAULT_TERRAIN_SPEEDS = Object.freeze({
  "": 1,
  // leeres Terrain = neutral
  Wald: 0.6,
  Meer: 0.5,
  Berg: 0.4
});
var TERRAIN_COLORS = { ...DEFAULT_TERRAIN_COLORS };
var TERRAIN_SPEEDS = { ...DEFAULT_TERRAIN_SPEEDS };
function setTerrains(next) {
  const colors = {};
  const speeds = {};
  for (const [name, val] of Object.entries(next)) {
    const n = (name ?? "").trim();
    const color = (val?.color ?? "").trim() || "transparent";
    const sp = Number.isFinite(val?.speed) ? val.speed : 1;
    colors[n] = color;
    speeds[n] = sp;
  }
  const mergedColors = { ...DEFAULT_TERRAIN_COLORS, ...colors, "": "transparent" };
  const mergedSpeeds = { ...DEFAULT_TERRAIN_SPEEDS, ...speeds, "": 1 };
  for (const k of Object.keys(TERRAIN_COLORS)) if (!(k in mergedColors)) delete TERRAIN_COLORS[k];
  Object.assign(TERRAIN_COLORS, mergedColors);
  for (const k of Object.keys(TERRAIN_SPEEDS)) if (!(k in mergedSpeeds)) delete TERRAIN_SPEEDS[k];
  Object.assign(TERRAIN_SPEEDS, mergedSpeeds);
}

// src/core/hex-mapper/hex-render.ts
var keyOf = (r, c) => `${r},${c}`;
function computeBounds(tiles) {
  if (!tiles.length) return null;
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const t of tiles) {
    const { r, c } = t.coord;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return { minR, maxR, minC, maxC };
}
async function renderHexMap(app, host, opts, mapPath) {
  const R = opts.radius;
  const hexW = Math.sqrt(3) * R;
  const hexH = 2 * R;
  const hStep = hexW;
  const vStep = 0.75 * hexH;
  const pad = 12;
  const mapFile = app.vault.getAbstractFileByPath(mapPath);
  let tiles = [];
  let bounds = null;
  if (mapFile instanceof import_obsidian4.TFile) {
    try {
      tiles = await listTilesForMap(app, mapFile);
      bounds = computeBounds(tiles);
    } catch {
    }
  }
  const minR0 = bounds ? bounds.minR : 0;
  const maxR0 = bounds ? bounds.maxR : 2;
  const minC0 = bounds ? bounds.minC : 0;
  const maxC0 = bounds ? bounds.maxC : 2;
  const baseR = minR0;
  const baseC = minC0;
  const rows0 = maxR0 - minR0 + 1;
  const cols0 = maxC0 - minC0 + 1;
  const initW = pad * 2 + hexW * cols0 + hexW * 0.5;
  const initH = pad * 2 + hexH + vStep * (rows0 - 1);
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "hex3x3-map");
  svg.setAttribute("viewBox", `0 0 ${initW} ${initH}`);
  svg.setAttribute("width", "100%");
  svg.style.touchAction = "none";
  const overlay = document.createElementNS(svgNS, "rect");
  overlay.setAttribute("x", "0");
  overlay.setAttribute("y", "0");
  overlay.setAttribute("width", String(initW));
  overlay.setAttribute("height", String(initH));
  overlay.setAttribute("fill", "transparent");
  overlay.setAttribute("pointer-events", "all");
  overlay.style.touchAction = "none";
  const contentG = document.createElementNS(svgNS, "g");
  svg.appendChild(overlay);
  svg.appendChild(contentG);
  host.appendChild(svg);
  attachCameraControls(
    svg,
    contentG,
    { minScale: 0.15, maxScale: 16, zoomSpeed: 1.01 },
    [overlay, host]
  );
  const polyByCoord = /* @__PURE__ */ new Map();
  let vb = { minX: 0, minY: 0, width: initW, height: initH };
  const centerOf = (r, c) => {
    const cx = pad + (c - baseC) * hStep + (r % 2 ? hexW / 2 : 0);
    const cy = pad + (r - baseR) * vStep + hexH / 2;
    return { cx, cy };
  };
  const bboxOf = (r, c) => {
    const { cx, cy } = centerOf(r, c);
    return {
      minX: cx - hexW / 2,
      maxX: cx + hexW / 2,
      minY: cy - R,
      maxY: cy + R
    };
  };
  const setViewBox = (minX, minY, width, height) => {
    vb = { minX, minY, width, height };
    svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
    overlay.setAttribute("x", String(minX));
    overlay.setAttribute("y", String(minY));
    overlay.setAttribute("width", String(width));
    overlay.setAttribute("height", String(height));
  };
  const svgPt = svg.createSVGPoint();
  function toContentPoint(ev) {
    const m = contentG.getScreenCTM();
    if (!m) return null;
    svgPt.x = ev.clientX;
    svgPt.y = ev.clientY;
    return svgPt.matrixTransform(m.inverse());
  }
  function pointToCoord(px, py) {
    const rFloat = (py - pad - hexH / 2) / vStep + baseR;
    let r = Math.round(rFloat);
    const isOdd = r % 2 !== 0;
    let c = Math.round((px - pad - (isOdd ? hexW / 2 : 0)) / hStep + baseC);
    let best = { r, c }, bestD2 = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      const odd = rr % 2 !== 0;
      const cc = Math.round((px - pad - (odd ? hexW / 2 : 0)) / hStep + baseC);
      const { cx, cy } = centerOf(rr, cc);
      const dx = px - cx, dy = py - cy, d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { r: rr, c: cc };
      }
    }
    return best;
  }
  function dispatchHexClick(r, c) {
    const evt = new CustomEvent("hex:click", {
      detail: { r, c },
      bubbles: true,
      cancelable: true
    });
    return host.dispatchEvent(evt);
  }
  const setFill = (coord, color) => {
    const poly = polyByCoord.get(keyOf(coord.r, coord.c));
    if (!poly) return;
    const c = color ?? "transparent";
    poly.style.fill = c;
    poly.style.fillOpacity = c !== "transparent" ? "0.25" : "0";
    if (c !== "transparent") {
      poly.setAttribute("data-painted", "1");
    } else {
      poly.removeAttribute("data-painted");
    }
  };
  const addHex = (r, c) => {
    const k = keyOf(r, c);
    if (polyByCoord.has(k)) return;
    const { cx, cy } = centerOf(r, c);
    const poly = document.createElementNS(svgNS, "polygon");
    poly.setAttribute("points", hexPolygonPoints(cx, cy, R));
    poly.setAttribute("data-row", String(r));
    poly.setAttribute("data-col", String(c));
    poly.style.fill = "transparent";
    poly.style.stroke = "var(--text-muted)";
    poly.style.strokeWidth = "2";
    poly.style.transition = "fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease";
    contentG.appendChild(poly);
    polyByCoord.set(k, poly);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", String(cx));
    label.setAttribute("y", String(cy + 4));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("pointer-events", "none");
    label.setAttribute("fill", "var(--text-muted)");
    label.textContent = `${r},${c}`;
    contentG.appendChild(label);
  };
  if (!tiles.length) {
    const fallback = [];
    for (let r = 0; r <= 2; r++) for (let c = 0; c <= 2; c++) fallback.push({ r, c });
    for (const { r, c } of fallback) addHex(r, c);
  } else {
    const coords = tiles.map((t) => t.coord);
    for (const { r, c } of coords) addHex(r, c);
  }
  for (const { coord, data } of tiles) {
    const color = TERRAIN_COLORS[data.terrain] ?? "transparent";
    setFill(coord, color);
  }
  const ensurePolys = (coords) => {
    const missing = [];
    for (const { r, c } of coords) if (!polyByCoord.has(`${r},${c}`)) missing.push({ r, c });
    if (!missing.length) return;
    for (const { r, c } of missing) addHex(r, c);
  };
  svg.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const pt = toContentPoint(ev);
    if (!pt) return;
    const { r, c } = pointToCoord(pt.x, pt.y);
    if (dispatchHexClick(r, c) === false) return;
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (file instanceof import_obsidian4.TFile) {
      const tfile = await saveTile(app, file, { r, c }, { terrain: "" });
      const leaf = getCenterLeaf(app);
      await leaf.openFile(tfile, { active: true });
    }
  }, { passive: false });
  let painting = false;
  let visited = null;
  let raf = 0;
  let lastEvt = null;
  const keyRC = (r, c) => `${r},${c}`;
  function paintStep(ev) {
    const pt = toContentPoint(ev);
    if (!pt) return false;
    const { r, c } = pointToCoord(pt.x, pt.y);
    const k = keyRC(r, c);
    if (visited && visited.has(k)) return true;
    const notCanceled = dispatchHexClick(r, c);
    if (notCanceled === false) visited?.add(k);
    return notCanceled === false;
  }
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    lastEvt = ev;
    const willPaint = paintStep(ev);
    if (!willPaint) return;
    painting = true;
    visited = /* @__PURE__ */ new Set();
    svg.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }, { capture: true });
  svg.addEventListener("pointermove", (ev) => {
    if (!painting) return;
    lastEvt = ev;
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (lastEvt) paintStep(lastEvt);
      });
    }
    ev.preventDefault();
  }, { capture: true });
  function endPaint(ev) {
    if (!painting) return;
    painting = false;
    visited?.clear();
    visited = null;
    lastEvt = null;
    svg.releasePointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }
  svg.addEventListener("pointerup", endPaint, { capture: true });
  svg.addEventListener("pointercancel", endPaint, { capture: true });
  return {
    svg,
    contentG,
    overlay,
    polyByCoord,
    setFill,
    ensurePolys,
    destroy: () => {
      svg.remove();
      polyByCoord.clear();
    }
  };
}

// src/apps/cartographer/travel/ui/map-layer.ts
var keyOf2 = (r, c) => `${r},${c}`;
async function createMapLayer(app, host, mapFile, opts) {
  const handles = await renderHexMap(app, host, opts, mapFile.path);
  const polyToCoord = /* @__PURE__ */ new WeakMap();
  for (const [k, poly] of handles.polyByCoord) {
    if (!poly) continue;
    const [r, c] = k.split(",").map(Number);
    polyToCoord.set(poly, { r, c });
  }
  function ensurePolys(coords) {
    handles.ensurePolys?.(coords);
    for (const rc of coords) {
      const poly = handles.polyByCoord.get(keyOf2(rc.r, rc.c));
      if (poly) polyToCoord.set(poly, rc);
    }
  }
  function centerOf(rc) {
    let poly = handles.polyByCoord.get(keyOf2(rc.r, rc.c));
    if (!poly) {
      ensurePolys([rc]);
      poly = handles.polyByCoord.get(keyOf2(rc.r, rc.c));
      if (!poly) return null;
    }
    const bb = poly.getBBox();
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  }
  function destroy() {
    try {
      handles.destroy?.();
    } catch {
    }
  }
  return { handles, polyToCoord, ensurePolys, centerOf, destroy };
}

// src/ui/map-header.ts
var import_obsidian6 = require("obsidian");

// src/ui/map-workflows.ts
var import_obsidian5 = require("obsidian");

// src/core/map-maker.ts
init_hex_notes();
async function createHexMapFile(app, rawName, opts = { folder: "Hexes", folderPrefix: "Hex", radius: 42 }) {
  const name = sanitizeFileName(rawName) || "Neue Hex Map";
  const content = buildHexMapMarkdown(name, opts);
  const mapsFolder = "SaltMarcher/Maps";
  await app.vault.createFolder(mapsFolder).catch(() => {
  });
  const path = await ensureUniquePath(app, `${mapsFolder}/${name}.md`);
  const file = await app.vault.create(path, content);
  await initTilesForNewMap(app, file);
  return file;
}
function buildHexMapMarkdown(name, opts) {
  const folder = (opts.folder ?? "Hexes").toString();
  const folderPrefix = (opts.folderPrefix ?? opts.prefix ?? "Hex").toString();
  const radius = typeof opts.radius === "number" ? opts.radius : 42;
  return [
    "---",
    "smMap: true",
    "---",
    `# ${name}`,
    "",
    "```hex3x3",
    `folder: ${folder}`,
    `folderPrefix: ${folderPrefix}`,
    // neu: von hex-notes ausgewertet
    `prefix: ${folderPrefix}`,
    // legacy: mitschreiben für ältere Parser
    `radius: ${radius}`,
    "```",
    ""
  ].join("\n");
}
function sanitizeFileName(input) {
  return input.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120);
}
async function ensureUniquePath(app, basePath) {
  if (!app.vault.getAbstractFileByPath(basePath)) return basePath;
  const dot = basePath.lastIndexOf(".");
  const stem = dot === -1 ? basePath : basePath.slice(0, dot);
  const ext = dot === -1 ? "" : basePath.slice(dot);
  for (let i = 2; i < 9999; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

// src/ui/map-workflows.ts
init_options();
function applyMapButtonStyle(button) {
  Object.assign(button.style, {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "6px 10px",
    cursor: "pointer"
  });
}
async function promptMapSelection(app, onSelect, options) {
  const files = await getAllMapFiles(app);
  if (!files.length) {
    new import_obsidian5.Notice(options?.emptyMessage ?? "Keine Karten gefunden.");
    return;
  }
  new MapSelectModal(app, files, async (file) => {
    await onSelect(file);
  }).open();
}
function promptCreateMap(app, onCreate, options) {
  new NameInputModal(app, async (name) => {
    const file = await createHexMapFile(app, name);
    new import_obsidian5.Notice(options?.successMessage ?? "Karte erstellt.");
    await onCreate(file);
  }).open();
}

// src/ui/search-dropdown.ts
function enhanceSelectToSearch(select, placeholder = "Suchen\u2026") {
  if (!select || select._smEnhanced) return;
  const wrap = document.createElement("div");
  wrap.className = "sm-sd";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.className = "sm-sd__input";
  const menu = document.createElement("div");
  menu.className = "sm-sd__menu";
  const parent = select.parentElement;
  parent.insertBefore(wrap, select);
  wrap.appendChild(input);
  wrap.appendChild(menu);
  select.style.display = "none";
  try {
    const rect = select.getBoundingClientRect();
    if (rect && rect.width) wrap.style.width = rect.width + "px";
  } catch {
  }
  let items;
  let active = -1;
  const readOptions2 = () => {
    items = Array.from(select.options).map((opt) => ({ label: opt.text, value: opt.value }));
  };
  const openMenu = () => {
    wrap.classList.add("is-open");
  };
  const closeMenu = () => {
    wrap.classList.remove("is-open");
    active = -1;
  };
  const render = (q = "") => {
    readOptions2();
    if (q === "__NOOPEN__") {
      menu.innerHTML = "";
      closeMenu();
      return;
    }
    const qq = q.toLowerCase();
    const matches = items.filter((it) => !qq || it.label.toLowerCase().includes(qq)).slice(0, 50);
    menu.innerHTML = "";
    matches.forEach((it, idx) => {
      const el = document.createElement("div");
      el.className = "sm-sd__item";
      el.textContent = it.label;
      it.el = el;
      el.onclick = () => {
        select.value = it.value;
        select.dispatchEvent(new Event("change"));
        input.value = it.label;
        closeMenu();
      };
      menu.appendChild(el);
    });
    if (matches.length) openMenu();
    else closeMenu();
  };
  input.addEventListener("focus", () => {
    input.select();
    render("");
  });
  input.addEventListener("input", () => render(input.value));
  input.addEventListener("keydown", (ev) => {
    if (!wrap.classList.contains("is-open")) return;
    const options = Array.from(menu.children);
    if (ev.key === "ArrowDown") {
      active = Math.min(options.length - 1, active + 1);
      highlight(options);
      ev.preventDefault();
    } else if (ev.key === "ArrowUp") {
      active = Math.max(0, active - 1);
      highlight(options);
      ev.preventDefault();
    } else if (ev.key === "Enter") {
      if (options[active]) {
        options[active].click();
        ev.preventDefault();
      }
    } else if (ev.key === "Escape") {
      closeMenu();
    }
  });
  const highlight = (options) => {
    options.forEach((el2, i) => el2.classList.toggle("is-active", i === active));
    const el = options[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  };
  input.addEventListener("blur", () => {
    setTimeout(closeMenu, 120);
  });
  select._smEnhanced = true;
  select._smSearchInput = input;
}

// src/core/save.ts
async function saveMap(_app, file) {
  console.warn("[save] saveMap() not implemented. File:", file.path);
}
async function saveMapAs(_app, file) {
  console.warn("[save] saveMapAs() not implemented. File:", file.path);
}

// src/ui/map-header.ts
function createMapHeader(app, host, options) {
  const labels = {
    open: options.labels?.open ?? "Open Map",
    create: options.labels?.create ?? "Create",
    delete: options.labels?.delete ?? "Delete",
    save: options.labels?.save ?? "Speichern",
    saveAs: options.labels?.saveAs ?? "Speichern als",
    trigger: options.labels?.trigger ?? "Los"
  };
  const notices = {
    missingFile: options.notices?.missingFile ?? "Keine Karte ausgew\xE4hlt.",
    saveSuccess: options.notices?.saveSuccess ?? "Gespeichert.",
    saveError: options.notices?.saveError ?? "Speichern fehlgeschlagen."
  };
  let currentFile = options.initialFile ?? null;
  let destroyed = false;
  const root = host.createDiv({ cls: "sm-map-header" });
  root.classList.add("map-editor-header");
  Object.assign(root.style, { display: "flex", flexDirection: "column", gap: ".4rem" });
  const row1 = root.createDiv();
  Object.assign(row1.style, { display: "flex", alignItems: "center", gap: ".5rem" });
  const titleGroup = row1.createDiv({ cls: "sm-map-header__title-group" });
  Object.assign(titleGroup.style, {
    display: "flex",
    alignItems: "center",
    gap: ".5rem",
    marginRight: "auto"
  });
  const titleEl = titleGroup.createEl("h2", { text: options.title });
  Object.assign(titleEl.style, { margin: 0 });
  const titleRightSlot = titleGroup.createDiv({ cls: "sm-map-header__title-slot" });
  Object.assign(titleRightSlot.style, {
    display: "flex",
    alignItems: "center",
    gap: ".5rem"
  });
  if (options.titleRightSlot) {
    options.titleRightSlot(titleRightSlot);
  } else {
    titleRightSlot.style.display = "none";
  }
  const openBtn = row1.createEl("button", { text: labels.open });
  (0, import_obsidian6.setIcon)(openBtn, "folder-open");
  applyMapButtonStyle(openBtn);
  openBtn.onclick = () => {
    if (destroyed) return;
    void promptMapSelection(app, async (file) => {
      if (destroyed) return;
      setFileLabel(file);
      await options.onOpen?.(file);
    });
  };
  const createBtn = row1.createEl("button");
  createBtn.append(" ", "+");
  (0, import_obsidian6.setIcon)(createBtn, "plus");
  applyMapButtonStyle(createBtn);
  createBtn.onclick = () => {
    if (destroyed) return;
    promptCreateMap(app, async (file) => {
      if (destroyed) return;
      setFileLabel(file);
      await options.onCreate?.(file);
    });
  };
  const deleteBtn = options.onDelete ? row1.createEl("button", { text: labels.delete, attr: { "aria-label": labels.delete } }) : null;
  if (deleteBtn) {
    (0, import_obsidian6.setIcon)(deleteBtn, "trash");
    applyMapButtonStyle(deleteBtn);
    deleteBtn.onclick = () => {
      if (destroyed) return;
      if (!currentFile) {
        new import_obsidian6.Notice(notices.missingFile);
        return;
      }
      void options.onDelete?.(currentFile);
    };
  }
  const row2 = root.createDiv();
  Object.assign(row2.style, { display: "flex", alignItems: "center", gap: ".5rem" });
  const secondaryLeftSlot = row2.createDiv({ cls: "sm-map-header__secondary-left" });
  Object.assign(secondaryLeftSlot.style, {
    marginRight: "auto",
    display: "flex",
    alignItems: "center",
    gap: ".5rem"
  });
  let nameBox = null;
  if (options.secondaryLeftSlot) {
    options.secondaryLeftSlot(secondaryLeftSlot);
  } else {
    nameBox = secondaryLeftSlot.createEl("div", {
      text: options.initialFile?.basename ?? options.emptyLabel ?? "\u2014"
    });
    nameBox.style.opacity = ".85";
  }
  const select = row2.createEl("select");
  select.createEl("option", { text: labels.save }).value = "save";
  select.createEl("option", { text: labels.saveAs }).value = "saveAs";
  enhanceSelectToSearch(select, "Such-dropdown\u2026");
  const triggerBtn = row2.createEl("button", { text: labels.trigger });
  applyMapButtonStyle(triggerBtn);
  triggerBtn.onclick = async () => {
    if (destroyed) return;
    const mode = select.value ?? "save";
    const file = currentFile;
    if (!file) {
      await options.onSave?.(mode, null);
      new import_obsidian6.Notice(notices.missingFile);
      return;
    }
    try {
      const handled = await options.onSave?.(mode, file) === true;
      if (!handled) {
        if (mode === "save") await saveMap(app, file);
        else await saveMapAs(app, file);
      }
      new import_obsidian6.Notice(notices.saveSuccess);
    } catch (err) {
      console.error("[map-header] save failed", err);
      new import_obsidian6.Notice(notices.saveError);
    }
  };
  function setFileLabel(file) {
    currentFile = file;
    if (nameBox) {
      nameBox.textContent = file?.basename ?? options.emptyLabel ?? "\u2014";
    }
    secondaryLeftSlot.dataset.fileLabel = file?.basename ?? options.emptyLabel ?? "\u2014";
    if (deleteBtn) {
      deleteBtn.disabled = !file;
      deleteBtn.style.opacity = file ? "1" : "0.5";
    }
  }
  function setTitle(title) {
    titleEl.textContent = title;
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    openBtn.onclick = null;
    createBtn.onclick = null;
    triggerBtn.onclick = null;
    root.remove();
  }
  setFileLabel(currentFile);
  return { root, secondaryLeftSlot, titleRightSlot, setFileLabel, setTitle, destroy };
}

// src/ui/map-manager.ts
var import_obsidian8 = require("obsidian");

// src/ui/confirm-delete.ts
var import_obsidian7 = require("obsidian");
var ConfirmDeleteModal = class extends import_obsidian7.Modal {
  constructor(app, mapFile, onConfirm) {
    super(app);
    this.mapFile = mapFile;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const name = this.mapFile.basename;
    contentEl.createEl("h3", { text: "Delete map?" });
    const p = contentEl.createEl("p");
    p.textContent = `This will delete your map permanently. If you want to proceed anyways, enter \u201C${name}\u201D.`;
    const input = contentEl.createEl("input", {
      attr: { type: "text", placeholder: name, style: "width:100%;" }
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    const confirmBtn = btnRow.createEl("button", { text: "Delete" });
    (0, import_obsidian7.setIcon)(confirmBtn, "trash");
    confirmBtn.classList.add("mod-warning");
    confirmBtn.disabled = true;
    input.addEventListener("input", () => {
      confirmBtn.disabled = input.value.trim() !== name;
    });
    cancelBtn.onclick = () => this.close();
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try {
        await this.onConfirm();
        new import_obsidian7.Notice("Map deleted.");
      } catch (e) {
        console.error(e);
        new import_obsidian7.Notice("Deleting map failed.");
      } finally {
        this.close();
      }
    };
    setTimeout(() => input.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/core/map-delete.ts
init_hex_notes();
async function deleteMapAndTiles(app, mapFile) {
  const tiles = await listTilesForMap(app, mapFile);
  for (const t of tiles) {
    try {
      await app.vault.delete(t.file);
    } catch (e) {
      console.warn("Delete tile failed:", t.file.path, e);
    }
  }
  try {
    await app.vault.delete(mapFile);
  } catch (e) {
    console.warn("Delete map failed:", mapFile.path, e);
  }
}

// src/ui/map-manager.ts
function createMapManager(app, options = {}) {
  const notices = {
    missingSelection: options.notices?.missingSelection ?? "Keine Karte ausgew\xE4hlt."
  };
  let current = options.initialFile ?? null;
  const applyChange = async (file) => {
    current = file;
    await options.onChange?.(file);
  };
  const setFile = async (file) => {
    await applyChange(file);
  };
  const open = async () => {
    await promptMapSelection(
      app,
      async (file) => {
        await applyChange(file);
      },
      options.selectOptions
    );
  };
  const create = () => {
    promptCreateMap(
      app,
      async (file) => {
        await applyChange(file);
      },
      options.createOptions
    );
  };
  const deleteCurrent = () => {
    const target = current;
    if (!target) {
      new import_obsidian8.Notice(notices.missingSelection);
      return;
    }
    new ConfirmDeleteModal(app, target, async () => {
      await deleteMapAndTiles(app, target);
      if (current && current.path === target.path) {
        await applyChange(null);
      }
    }).open();
  };
  return {
    getFile: () => current,
    setFile,
    open,
    create,
    deleteCurrent
  };
}

// src/core/terrain-store.ts
var import_obsidian9 = require("obsidian");
var TERRAIN_FILE = "SaltMarcher/Terrains.md";
var BLOCK_RE = /```terrain\s*([\s\S]*?)```/i;
async function ensureTerrainFile(app) {
  const p = (0, import_obsidian9.normalizePath)(TERRAIN_FILE);
  const existing = app.vault.getAbstractFileByPath(p);
  if (existing instanceof import_obsidian9.TFile) return existing;
  await app.vault.createFolder(p.split("/").slice(0, -1).join("/")).catch(() => {
  });
  const body = [
    "---",
    "smList: true",
    "---",
    "# Terrains",
    "",
    "```terrain",
    ": transparent, speed: 1",
    "Wald: #2e7d32, speed: 0.6",
    "Meer: #0288d1, speed: 0.5",
    "Berg: #6d4c41, speed: 0.4",
    "```",
    ""
  ].join("\n");
  return await app.vault.create(p, body);
}
function parseTerrainBlock(md) {
  const m = md.match(BLOCK_RE);
  if (!m) return {};
  const out = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const mm = line.match(/^("?)(.*?)(\1)\s*:\s*([^,]+?)(?:\s*,\s*speed\s*:\s*([-+]?\d*\.?\d+))?\s*$/i);
    if (!mm) continue;
    const name = mm[2].trim();
    const color = mm[4].trim();
    const speed = mm[5] !== void 0 ? parseFloat(mm[5]) : 1;
    out[name] = { color, speed: Number.isFinite(speed) ? speed : 1 };
  }
  if (!out[""]) out[""] = { color: "transparent", speed: 1 };
  return out;
}
function stringifyTerrainBlock(map) {
  const entries = Object.entries(map);
  entries.sort(([a], [b]) => a === "" ? -1 : b === "" ? 1 : a.localeCompare(b));
  const lines = entries.map(([k, v]) => `${k || ":"}: ${v.color}, speed: ${v.speed}`);
  return ["```terrain", ...lines, "```"].join("\n");
}
async function loadTerrains(app) {
  const f = await ensureTerrainFile(app);
  const md = await app.vault.read(f);
  return parseTerrainBlock(md);
}
async function saveTerrains(app, next) {
  const f = await ensureTerrainFile(app);
  const md = await app.vault.read(f);
  const block = stringifyTerrainBlock(next);
  const replaced = md.match(BLOCK_RE) ? md.replace(BLOCK_RE, block) : md + "\n\n" + block + "\n";
  await app.vault.modify(f, replaced);
}
function watchTerrains(app, onChange) {
  const handler = async (file) => {
    if (file.path !== TERRAIN_FILE) return;
    const map = await loadTerrains(app);
    setTerrains(map);
    app.workspace.trigger?.("salt:terrains-updated");
    onChange?.();
  };
  app.vault.on("modify", handler);
  app.vault.on("delete", handler);
  return () => {
    app.vault.off("modify", handler);
    app.vault.off("delete", handler);
  };
}

// src/apps/cartographer/travel/ui/sidebar.ts
function createSidebar(host) {
  host.empty();
  host.classList.add("sm-cartographer__sidebar--travel");
  const root = host.createDiv({ cls: "sm-cartographer__travel" });
  const controlsHost = root.createDiv({ cls: "sm-cartographer__travel-controls" });
  const tileRow = root.createDiv({ cls: "sm-cartographer__travel-row" });
  tileRow.createSpan({ cls: "sm-cartographer__travel-label", text: "Aktuelles Hex" });
  const tileValue = tileRow.createSpan({
    cls: "sm-cartographer__travel-value",
    text: "\u2014"
  });
  const speedRow = root.createDiv({ cls: "sm-cartographer__travel-row" });
  speedRow.createSpan({ cls: "sm-cartographer__travel-label", text: "Party Speed (mph)" });
  const speedInput = speedRow.createEl("input", {
    type: "number",
    cls: "sm-cartographer__travel-input",
    attr: { step: "0.1", min: "0.1", value: "1" }
  });
  let onChange = () => {
  };
  speedInput.onchange = () => {
    const v = parseFloat(speedInput.value);
    const val = Number.isFinite(v) && v > 0 ? v : 1;
    speedInput.value = String(val);
    onChange(val);
  };
  const setTile = (rc) => {
    tileValue.textContent = rc ? `${rc.r},${rc.c}` : "\u2014";
  };
  const setSpeed = (v) => {
    const next = String(v);
    if (speedInput.value !== next) speedInput.value = next;
  };
  const setTitle = (title) => {
    if (title && title.trim().length > 0) {
      host.dataset.mapTitle = title;
    } else {
      delete host.dataset.mapTitle;
    }
  };
  return {
    root,
    setTitle,
    controlsHost,
    setTile,
    setSpeed,
    onSpeedChange: (fn) => onChange = fn,
    destroy: () => {
      host.empty();
      host.classList.remove("sm-cartographer__sidebar--travel");
      delete host.dataset.mapTitle;
    }
  };
}

// src/apps/cartographer/travel/ui/controls.ts
var import_obsidian10 = require("obsidian");
function createPlaybackControls(host, callbacks) {
  const root = host.createDiv({ cls: "sm-cartographer__travel-buttons" });
  const clock = root.createEl("div", { cls: "sm-cartographer__travel-clock", text: "00h" });
  const playBtn = root.createEl("button", {
    cls: "sm-cartographer__travel-button sm-cartographer__travel-button--play",
    text: "Start"
  });
  (0, import_obsidian10.setIcon)(playBtn, "play");
  applyMapButtonStyle(playBtn);
  playBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (playBtn.disabled) return;
    void callbacks.onPlay?.();
  });
  const stopBtn = root.createEl("button", {
    cls: "sm-cartographer__travel-button sm-cartographer__travel-button--stop",
    text: "Stopp"
  });
  (0, import_obsidian10.setIcon)(stopBtn, "square");
  applyMapButtonStyle(stopBtn);
  stopBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (stopBtn.disabled) return;
    void callbacks.onStop?.();
  });
  const resetBtn = root.createEl("button", {
    cls: "sm-cartographer__travel-button sm-cartographer__travel-button--reset",
    text: "Reset"
  });
  (0, import_obsidian10.setIcon)(resetBtn, "rotate-ccw");
  applyMapButtonStyle(resetBtn);
  resetBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (resetBtn.disabled) return;
    void callbacks.onReset?.();
  });
  const tempoWrap = root.createDiv({ cls: "sm-cartographer__travel-tempo" });
  const tempoLabel = tempoWrap.createSpan({ text: "x1.0" });
  const tempoInput = tempoWrap.createEl("input", {
    type: "range",
    attr: { min: "0.1", max: "10", step: "0.1" }
  });
  tempoInput.value = "1";
  tempoInput.oninput = () => {
    const v = Math.max(0.1, Math.min(10, parseFloat(tempoInput.value) || 1));
    tempoLabel.setText(`x${v.toFixed(1)}`);
    callbacks.onTempoChange?.(v);
  };
  const setState = (state) => {
    const hasRoute = state.route.length > 0;
    playBtn.disabled = state.playing || !hasRoute;
    stopBtn.disabled = !state.playing;
    resetBtn.disabled = !hasRoute && !state.playing;
  };
  setState({ playing: false, route: [] });
  const setClock = (hours) => {
    const h = Math.floor(hours);
    clock.setText(`${h}h`);
  };
  const setTempo = (tempo) => {
    const v = Math.max(0.1, Math.min(10, tempo));
    tempoInput.value = String(v);
    tempoLabel.setText(`x${v.toFixed(1)}`);
  };
  const destroy = () => {
    playBtn.replaceWith();
    stopBtn.replaceWith();
    resetBtn.replaceWith();
    root.remove();
  };
  return {
    root,
    setState,
    destroy,
    setClock,
    setTempo
  };
}

// src/apps/cartographer/travel/render/draw-route.ts
var USER_RADIUS = 7;
var AUTO_RADIUS = 5;
var HIGHLIGHT_OFFSET = 2;
var HITBOX_PADDING = 6;
function drawRoute(args) {
  const { layer, route, centerOf, highlightIndex = null, start = null } = args;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  const pts = [];
  const startCtr = start ? centerOf(start) : null;
  if (startCtr) pts.push(`${startCtr.x},${startCtr.y}`);
  const centers = route.map((n) => centerOf(n));
  for (const p of centers) if (p) pts.push(`${p.x},${p.y}`);
  if (pts.length >= 2) {
    const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    pl.setAttribute("points", pts.join(" "));
    pl.setAttribute("fill", "none");
    pl.setAttribute("stroke", "var(--interactive-accent)");
    pl.setAttribute("stroke-width", "3");
    pl.setAttribute("stroke-linejoin", "round");
    pl.setAttribute("stroke-linecap", "round");
    pl.style.pointerEvents = "none";
    layer.appendChild(pl);
  }
  route.forEach((node, i) => {
    const ctr = centers[i];
    if (!ctr) return;
    const baseRadius = node.kind === "user" ? USER_RADIUS : AUTO_RADIUS;
    const hitRadius = baseRadius + HITBOX_PADDING;
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hit.setAttribute("cx", String(ctr.x));
    hit.setAttribute("cy", String(ctr.y));
    hit.setAttribute("r", String(hitRadius));
    hit.setAttribute("data-idx", String(i));
    hit.classList.add("tg-route-dot-hitbox");
    hit.style.fill = "transparent";
    hit.setAttribute("stroke", "transparent");
    hit.style.pointerEvents = "all";
    hit.style.cursor = "grab";
    layer.appendChild(hit);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(ctr.x));
    dot.setAttribute("cy", String(ctr.y));
    dot.setAttribute("r", String(baseRadius));
    dot.setAttribute("data-radius", String(baseRadius));
    dot.setAttribute("data-kind", node.kind);
    dot.setAttribute("data-idx", String(i));
    dot.classList.add("tg-route-dot");
    dot.classList.add(node.kind === "user" ? "tg-route-dot--user" : "tg-route-dot--auto");
    dot.style.pointerEvents = "auto";
    dot.style.cursor = "grab";
    layer.appendChild(dot);
  });
  updateHighlight(layer, highlightIndex);
}
function updateHighlight(layer, highlightIndex) {
  const dots = Array.from(layer.querySelectorAll(".tg-route-dot"));
  dots.forEach((el, idx) => {
    const isHi = highlightIndex != null && idx === highlightIndex;
    const baseRadius = Number(el.dataset.radius || el.getAttribute("r") || (el.dataset.kind === "user" ? USER_RADIUS : AUTO_RADIUS));
    el.classList.toggle("is-highlighted", isHi);
    el.setAttribute("stroke", isHi ? "var(--background-modifier-border)" : "none");
    el.setAttribute("stroke-width", isHi ? "2" : "0");
    el.setAttribute("r", String(isHi ? baseRadius + HIGHLIGHT_OFFSET : baseRadius));
    el.style.removeProperty("opacity");
    el.style.cursor = "grab";
  });
}

// src/apps/cartographer/travel/ui/route-layer.ts
function createRouteLayer(contentRoot, centerOf) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.classList.add("tg-route-layer");
  contentRoot.appendChild(el);
  function draw(route, highlightIndex = null, start) {
    drawRoute({ layer: el, route, centerOf, highlightIndex, start });
  }
  function highlight(i) {
    updateHighlight(el, i);
  }
  function destroy() {
    el.remove();
  }
  return { el, draw, highlight, destroy };
}

// src/apps/cartographer/travel/ui/token-layer.ts
function createTokenLayer(contentG) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.classList.add("tg-token");
  el.style.pointerEvents = "auto";
  el.style.cursor = "grab";
  contentG.appendChild(el);
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("r", "14");
  circle.classList.add("tg-token__circle");
  el.appendChild(circle);
  let vx = 0, vy = 0;
  let rafId = null;
  let pendingReject = null;
  const makeCancelError = () => {
    const err = new Error("token-move-cancelled");
    err.name = "TokenMoveCancelled";
    return err;
  };
  const cancelActiveAnimation = (reason = makeCancelError()) => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pendingReject) {
      const reject = pendingReject;
      pendingReject = null;
      reject(reason);
    }
  };
  function setPos(x, y) {
    vx = x;
    vy = y;
    el.setAttribute("transform", `translate(${x},${y})`);
  }
  function moveTo(x, y, durMs) {
    cancelActiveAnimation();
    if (durMs <= 0) {
      setPos(x, y);
      return Promise.resolve();
    }
    const x0 = vx;
    const y0 = vy;
    const dx = x - x0;
    const dy = y - y0;
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      pendingReject = reject;
      const step = () => {
        const t = (performance.now() - t0) / durMs;
        if (t >= 1) {
          setPos(x, y);
          rafId = null;
          pendingReject = null;
          resolve();
          return;
        }
        const k = t < 0 ? 0 : t;
        setPos(x0 + dx * k, y0 + dy * k);
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    });
  }
  function show() {
    el.style.display = "";
  }
  function hide() {
    el.style.display = "none";
  }
  function stop() {
    cancelActiveAnimation();
  }
  function destroy() {
    cancelActiveAnimation();
    el.remove();
  }
  hide();
  return { el, setPos, moveTo, stop, show, hide, destroy };
}

// src/apps/cartographer/travel/ui/drag.controller.ts
function createDragController(deps) {
  const { routeLayerEl, tokenEl, token, adapter, logic, polyToCoord } = deps;
  let isDragging = false;
  let dragKind = null;
  let lastDragRC = null;
  let suppressNextHexClick = false;
  function disableLayerHit(on) {
    routeLayerEl.style.pointerEvents = on ? "none" : "";
  }
  function findPolygonAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const poly1 = el.closest?.("polygon");
    if (poly1) return poly1;
    let cur = el;
    while (cur) {
      if (cur instanceof SVGPolygonElement) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  function getDotElements(idx) {
    const dot = routeLayerEl.querySelector(`.tg-route-dot[data-idx="${idx}"]`);
    const hit = routeLayerEl.querySelector(`.tg-route-dot-hitbox[data-idx="${idx}"]`);
    return { dot, hit };
  }
  function ghostMoveSelectedDot(rc) {
    const s = logic.getState();
    const idx = s.editIdx;
    if (idx == null) return;
    const { dot, hit } = getDotElements(idx);
    if (!dot) return;
    const ctr = adapter.centerOf(rc);
    if (!ctr) return;
    dot.setAttribute("cx", String(ctr.x));
    dot.setAttribute("cy", String(ctr.y));
    if (hit) {
      hit.setAttribute("cx", String(ctr.x));
      hit.setAttribute("cy", String(ctr.y));
    }
  }
  function ghostMoveToken(rc) {
    const ctr = adapter.centerOf(rc);
    if (!ctr) return;
    token.setPos(ctr.x, ctr.y);
    token.show();
  }
  const onGlobalPointerDownCapture = (ev) => {
    if (ev.button !== 0) return;
    const check = (el) => {
      if (!(el instanceof Element)) return false;
      if (el === tokenEl || tokenEl.contains(el)) return true;
      if (el instanceof SVGCircleElement && routeLayerEl.contains(el)) return true;
      return false;
    };
    const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
    if (Array.isArray(path) && path.length > 0) {
      for (const el of path) {
        if (check(el)) {
          suppressNextHexClick = true;
          return;
        }
      }
    } else if (check(ev.target)) {
      suppressNextHexClick = true;
    }
  };
  const onDotPointerDown = (ev) => {
    if (ev.button !== 0) return;
    const t = ev.target;
    if (!(t instanceof SVGCircleElement)) return;
    if (!t.classList.contains("tg-route-dot") && !t.classList.contains("tg-route-dot-hitbox")) return;
    const idxAttr = t.getAttribute("data-idx");
    const idx = idxAttr ? Number(idxAttr) : NaN;
    if (!Number.isFinite(idx) || idx < 0) return;
    logic.selectDot(idx);
    dragKind = "dot";
    isDragging = true;
    lastDragRC = null;
    suppressNextHexClick = true;
    disableLayerHit(true);
    const { dot } = getDotElements(idx);
    (dot ?? t).setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
    ev.stopImmediatePropagation?.();
    ev.stopPropagation();
  };
  const onTokenPointerDown = (ev) => {
    if (ev.button !== 0) return;
    dragKind = "token";
    isDragging = true;
    lastDragRC = null;
    suppressNextHexClick = true;
    disableLayerHit(true);
    tokenEl.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
    ev.stopImmediatePropagation?.();
    ev.stopPropagation();
  };
  const onPointerMove = (ev) => {
    if (!isDragging) return;
    if ((ev.buttons & 1) === 0) {
      endDrag();
      return;
    }
    const poly = findPolygonAt(ev.clientX, ev.clientY);
    if (!poly) return;
    const rc = polyToCoord.get(poly);
    if (!rc) return;
    if (lastDragRC && rc.r === lastDragRC.r && rc.c === lastDragRC.c) return;
    lastDragRC = rc;
    if (dragKind === "dot") ghostMoveSelectedDot(rc);
    else if (dragKind === "token") ghostMoveToken(rc);
  };
  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    if (lastDragRC) {
      adapter.ensurePolys([lastDragRC]);
      if (dragKind === "dot") logic.moveSelectedTo(lastDragRC);
      else if (dragKind === "token") logic.moveTokenTo(lastDragRC);
      suppressNextHexClick = true;
    }
    lastDragRC = null;
    dragKind = null;
    disableLayerHit(false);
  }
  const onPointerUp = () => endDrag();
  const onPointerCancel = () => endDrag();
  function bind() {
    window.addEventListener("pointerdown", onGlobalPointerDownCapture, { capture: true });
    routeLayerEl.addEventListener("pointerdown", onDotPointerDown, { capture: true });
    tokenEl.addEventListener("pointerdown", onTokenPointerDown, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });
  }
  function unbind() {
    window.removeEventListener("pointerdown", onGlobalPointerDownCapture, { capture: true });
    routeLayerEl.removeEventListener("pointerdown", onDotPointerDown, { capture: true });
    tokenEl.removeEventListener("pointerdown", onTokenPointerDown, { capture: true });
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  }
  function consumeClickSuppression() {
    if (isDragging) return true;
    if (!suppressNextHexClick) return false;
    suppressNextHexClick = false;
    return true;
  }
  return { bind, unbind, consumeClickSuppression };
}

// src/apps/cartographer/travel/ui/contextmenue.ts
function bindContextMenu(routeLayerEl, logic) {
  const onContextMenu = (ev) => {
    const t = ev.target;
    if (!(t instanceof SVGCircleElement)) return;
    const idxAttr = t.getAttribute("data-idx");
    if (!idxAttr) return;
    const idx = Number(idxAttr);
    if (!Number.isFinite(idx) || idx < 0) return;
    const route = logic.getState().route;
    const node = route[idx];
    if (!node) return;
    if (node.kind !== "user") {
      ev.preventDefault();
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    logic.deleteUserAt(idx);
  };
  routeLayerEl.addEventListener("contextmenu", onContextMenu, { capture: true });
  return () => routeLayerEl.removeEventListener("contextmenu", onContextMenu, { capture: true });
}

// src/apps/cartographer/travel/domain/state.store.ts
function createStore() {
  let state = {
    tokenRC: { r: 0, c: 0 },
    route: [],
    editIdx: null,
    tokenSpeed: 3,
    // mph default party speed
    currentTile: null,
    playing: false,
    tempo: 1,
    clockHours: 0
  };
  const subs = /* @__PURE__ */ new Set();
  const get = () => state;
  const set = (patch) => {
    state = { ...state, ...patch };
    emit();
  };
  const replace = (next) => {
    state = next;
    emit();
  };
  const subscribe = (fn) => {
    subs.add(fn);
    fn(state);
    return () => subs.delete(fn);
  };
  const emit = () => {
    for (const fn of subs) fn(state);
  };
  return { get, set, replace, subscribe, emit };
}

// src/apps/cartographer/travel/domain/expansion.ts
function expandCoords(a, b) {
  const seg = lineOddR(a, b);
  if (seg.length <= 1) return [];
  seg.shift();
  return seg;
}
function rebuildFromAnchors(tokenRC, anchors) {
  const route = [];
  let cur = tokenRC;
  for (let i = 0; i < anchors.length; i++) {
    const next = anchors[i];
    const seg = expandCoords(cur, next);
    const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
    route.push(...autos);
    route.push(asUserNode(next));
    cur = next;
  }
  return route;
}
var asUserNode = (rc) => ({ ...rc, kind: "user" });
var asAutoNode = (rc) => ({ ...rc, kind: "auto" });

// src/apps/cartographer/travel/domain/terrain.service.ts
init_hex_notes();
async function loadTerrainSpeed(app, mapFile, rc) {
  try {
    const data = await loadTile(app, mapFile, rc);
    const t = data?.terrain ?? "";
    const s = TERRAIN_SPEEDS[t];
    return Number.isFinite(s) ? s : 1;
  } catch {
    return 1;
  }
}

// src/apps/cartographer/travel/domain/persistence.ts
init_hex_notes();
var TOKEN_KEY = "token_travel";
async function loadTokenCoordFromMap(app, mapFile) {
  const tiles = await listTilesForMap(app, mapFile);
  for (const rc of tiles) {
    const data = await loadTile(app, mapFile, rc).catch(() => null);
    if (data && data[TOKEN_KEY] === true) return rc;
  }
  return null;
}
async function writeTokenToTiles(app, mapFile, rc) {
  const tiles = await listTilesForMap(app, mapFile);
  for (const t of tiles) {
    const data = await loadTile(app, mapFile, t).catch(() => null);
    if (data && data[TOKEN_KEY] === true && (t.r !== rc.r || t.c !== rc.c)) {
      await saveTile(app, mapFile, t, { ...data, [TOKEN_KEY]: false });
    }
  }
  const exists = tiles.some((t) => t.r === rc.r && t.c === rc.c);
  if (!exists) return;
  const cur = await loadTile(app, mapFile, rc).catch(() => ({}));
  await saveTile(app, mapFile, rc, { ...cur, [TOKEN_KEY]: true });
}

// src/apps/cartographer/travel/domain/playback.ts
function createPlayback(cfg) {
  const { app, getMapFile, adapter, store, minSecondsPerTile, onEncounter } = cfg;
  let playing = false;
  let currentRun = null;
  let clockTimer = null;
  let hourAcc = 0;
  function trimRoutePassed(token) {
    const cur = store.get();
    let i = 0;
    while (i < cur.route.length && cur.route[i].r === token.r && cur.route[i].c === token.c) i++;
    if (i > 0) store.set({ route: cur.route.slice(i) });
  }
  async function play() {
    if (playing) return;
    if (currentRun) {
      try {
        await currentRun;
      } catch {
      }
    }
    const mapFile = getMapFile();
    if (!mapFile) return;
    const s0 = store.get();
    if (s0.route.length === 0) return;
    const run = (async () => {
      playing = true;
      store.set({ playing: true });
      if (clockTimer == null) {
        clockTimer = window.setInterval(() => {
          const s = store.get();
          const tempo = Math.max(0.1, Math.min(10, s.tempo || 1));
          const nextHours = (s.clockHours || 0) + tempo;
          hourAcc += tempo;
          while (hourAcc >= 1) {
            hourAcc -= 1;
            void checkEncounter();
          }
          store.set({ clockHours: nextHours });
        }, 1e3);
      }
      try {
        while (playing) {
          const s = store.get();
          if (s.route.length === 0) break;
          const next = s.route[0];
          adapter.ensurePolys([{ r: next.r, c: next.c }]);
          const terr = await loadTerrainSpeed(app, mapFile, next);
          const mph = Math.max(0.1, s.tokenSpeed);
          const hoursPerTile = 3 / mph * terr;
          const tempo = Math.max(0.1, Math.min(10, s.tempo || 1));
          const seconds = Math.max(minSecondsPerTile, hoursPerTile / tempo);
          const dur = seconds * 1e3;
          const ctr = adapter.centerOf(next);
          let cancelled = false;
          if (ctr) {
            try {
              await adapter.token.moveTo(ctr.x, ctr.y, dur);
            } catch (err) {
              if (err instanceof Error && err.name === "TokenMoveCancelled") {
                cancelled = true;
              } else {
                throw err;
              }
            }
          }
          if (cancelled) break;
          const tokenRC = { r: next.r, c: next.c };
          store.set({ tokenRC, currentTile: tokenRC });
          await writeTokenToTiles(app, mapFile, tokenRC);
          trimRoutePassed(tokenRC);
          if (!playing) break;
        }
      } finally {
        playing = false;
        store.set({ playing: false });
        if (clockTimer != null) {
          clearInterval(clockTimer);
          clockTimer = null;
        }
      }
    })();
    currentRun = run;
    try {
      await run;
    } finally {
      if (currentRun === run) currentRun = null;
    }
  }
  function pause() {
    if (!playing && !currentRun) {
      adapter.token.stop?.();
      return;
    }
    playing = false;
    store.set({ playing: false });
    adapter.token.stop?.();
    if (clockTimer != null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }
  async function checkEncounter() {
    try {
      const mapFile = getMapFile();
      if (!mapFile) return;
      const s = store.get();
      const cur = s.currentTile || s.tokenRC;
      if (!cur) return;
      const { loadTile: loadTile2 } = await Promise.resolve().then(() => (init_hex_notes(), hex_notes_exports));
      const tile = await loadTile2(app, mapFile, cur).catch(() => null);
      const regionName = tile?.region;
      if (!regionName) return;
      const { loadRegions: loadRegions2 } = await Promise.resolve().then(() => (init_regions_store(), regions_store_exports));
      const regions = await loadRegions2(app);
      const region = regions.find((r) => (r.name || "").toLowerCase() === regionName.toLowerCase());
      const odds = region?.encounterOdds;
      const n = Number.isFinite(odds) && odds > 0 ? odds : void 0;
      if (!n) return;
      const roll = Math.floor(Math.random() * n) + 1;
      if (roll === 1) {
        onEncounter && await onEncounter();
      }
    } catch (err) {
      console.error("[travel] encounter check failed", err);
    }
  }
  return { play, pause };
}

// src/apps/cartographer/travel/domain/actions.ts
function createTravelLogic(cfg) {
  const store = createStore();
  let adapter = cfg.adapter;
  const unsub = store.subscribe((s) => {
    cfg.onChange?.(s);
    adapter.draw(s.route, s.tokenRC);
  });
  const playback = createPlayback({
    app: cfg.app,
    getMapFile: cfg.getMapFile,
    store,
    adapter,
    minSecondsPerTile: cfg.minSecondsPerTile,
    onEncounter: cfg.onEncounter
  });
  const getState = () => store.get();
  const bindAdapter = (a) => {
    adapter = a;
  };
  const selectDot = (idx) => {
    const len = store.get().route.length;
    const safe = idx == null ? null : Math.max(0, Math.min(idx, len - 1));
    store.set({ editIdx: safe });
  };
  const lastUserAnchor = () => {
    const r = store.get().route;
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i].kind === "user") return r[i];
    }
    return null;
  };
  const userIndices = () => {
    const out = [];
    store.get().route.forEach((n, i) => {
      if (n.kind === "user") out.push(i);
    });
    return out;
  };
  const ensurePolys = (coords) => adapter.ensurePolys(coords);
  const handleHexClick = (rc) => {
    const s = store.get();
    const source = lastUserAnchor() ?? s.tokenRC;
    if (source.r === rc.r && source.c === rc.c) return;
    const seg = expandCoords(source, rc);
    ensurePolys(seg);
    const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
    const user = asUserNode(rc);
    const route = [...s.route, ...autos, user];
    store.set({ route });
  };
  const moveSelectedTo = (rc) => {
    const s = store.get();
    const i = s.editIdx;
    if (i == null || i < 0 || i >= s.route.length) return;
    const users = userIndices();
    const prevUserIdx = [...users].reverse().find((u) => u < i) ?? -1;
    const nextUserIdx = users.find((u) => u > i) ?? -1;
    const prevAnchor = prevUserIdx >= 0 ? s.route[prevUserIdx] : s.tokenRC;
    const head = prevUserIdx >= 0 ? s.route.slice(0, prevUserIdx + 1) : [];
    const leftSeg = expandCoords(prevAnchor, rc);
    const leftAutos = leftSeg.slice(0, Math.max(0, leftSeg.length - 1)).map(asAutoNode);
    const moved = asUserNode(rc);
    let rightAutos = [];
    let tail = [];
    if (nextUserIdx >= 0) {
      const nextAnchor = s.route[nextUserIdx];
      const rightSeg = expandCoords(rc, nextAnchor);
      rightAutos = rightSeg.slice(0, Math.max(0, rightSeg.length - 1)).map(asAutoNode);
      tail = s.route.slice(nextUserIdx);
    }
    const newRoute = [...head, ...leftAutos, moved, ...rightAutos, ...tail];
    ensurePolys([rc, ...leftSeg, ...rightAutos.map(({ r, c }) => ({ r, c }))]);
    const newIdx = newRoute.findIndex((n) => n.kind === "user" && n.r === rc.r && n.c === rc.c);
    store.set({ route: newRoute, editIdx: newIdx >= 0 ? newIdx : null });
  };
  async function moveTokenTo(rc) {
    if (!adapter) return;
    const prev = store.get();
    const anchors = prev.route.filter((n) => n.kind === "user").map(({ r, c }) => ({ r, c }));
    const route = rebuildFromAnchors(rc, anchors);
    const routeCoords = route.map(({ r, c }) => ({ r, c }));
    adapter.ensurePolys([rc, ...routeCoords]);
    const ctr = adapter.centerOf(rc);
    if (ctr) {
      adapter.token.setPos(ctr.x, ctr.y);
      adapter.token.show();
    }
    let editIdx = prev.editIdx;
    if (editIdx != null) {
      const prevNode = prev.route[editIdx];
      if (!prevNode) {
        editIdx = null;
      } else {
        const matchIdx = route.findIndex(
          (n) => n.kind === prevNode.kind && n.r === prevNode.r && n.c === prevNode.c
        );
        editIdx = matchIdx >= 0 ? matchIdx : null;
      }
    }
    store.set({ tokenRC: rc, route, editIdx });
    const mapFile = cfg.getMapFile();
    if (mapFile) await writeTokenToTiles(cfg.app, mapFile, rc);
  }
  const deleteUserAt = (idx) => {
    const s = store.get();
    if (idx < 0 || idx >= s.route.length) return;
    if (s.route[idx].kind !== "user") return;
    const users = userIndices();
    const myUserPos = users.indexOf(idx);
    const prevUserIdx = myUserPos > 0 ? users[myUserPos - 1] : -1;
    const nextUserIdx = myUserPos < users.length - 1 ? users[myUserPos + 1] : -1;
    const prevAnchor = prevUserIdx >= 0 ? s.route[prevUserIdx] : s.tokenRC;
    const nextAnchor = nextUserIdx >= 0 ? s.route[nextUserIdx] : null;
    const head = prevUserIdx >= 0 ? s.route.slice(0, prevUserIdx + 1) : [];
    const tail = nextUserIdx >= 0 ? s.route.slice(nextUserIdx) : [];
    let bridge = [];
    if (nextAnchor) {
      const seg = expandCoords(prevAnchor, nextAnchor);
      const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
      bridge = [...autos];
      ensurePolys(seg);
    }
    const newRoute = [...head, ...bridge, ...tail];
    const newEdit = null;
    store.set({ route: newRoute, editIdx: newEdit });
  };
  const setTokenSpeed = (v) => {
    const val = Number.isFinite(v) && v > 0 ? v : 1;
    store.set({ tokenSpeed: val });
  };
  const setTempo = (v) => {
    const val = Number.isFinite(v) ? Math.max(0.1, Math.min(10, v)) : 1;
    store.set({ tempo: val });
  };
  const play = async () => playback.play();
  const pause = () => playback.pause();
  const reset = async () => {
    playback.pause();
    store.set({
      route: [],
      editIdx: null,
      currentTile: null,
      playing: false
    });
    await initTokenFromTiles();
  };
  async function initTokenFromTiles() {
    const mapFile = cfg.getMapFile();
    if (!mapFile || !adapter) return;
    const prev = store.get();
    const found = await loadTokenCoordFromMap(cfg.app, mapFile);
    const tokenRC = found ?? prev.tokenRC ?? { r: 0, c: 0 };
    const anchors = prev.route.filter((n) => n.kind === "user").map(({ r, c }) => ({ r, c }));
    const route = rebuildFromAnchors(tokenRC, anchors);
    const routeCoords = route.map(({ r, c }) => ({ r, c }));
    adapter.ensurePolys([tokenRC, ...routeCoords]);
    const ctr = adapter.centerOf(tokenRC);
    if (ctr) {
      adapter.token.setPos(ctr.x, ctr.y);
      adapter.token.show();
    }
    let editIdx = prev.editIdx;
    if (editIdx != null) {
      const prevNode = prev.route[editIdx];
      if (!prevNode) {
        editIdx = null;
      } else {
        const matchIdx = route.findIndex(
          (n) => n.kind === prevNode.kind && n.r === prevNode.r && n.c === prevNode.c
        );
        editIdx = matchIdx >= 0 ? matchIdx : null;
      }
    }
    store.set({ tokenRC, route, editIdx });
    if (!found) await writeTokenToTiles(cfg.app, mapFile, tokenRC);
  }
  const persistTokenToTiles = async () => {
    const mf = cfg.getMapFile();
    if (!mf) return;
    await writeTokenToTiles(cfg.app, mf, store.get().tokenRC);
  };
  return {
    getState: () => store.get(),
    selectDot,
    handleHexClick,
    moveSelectedTo,
    moveTokenTo,
    deleteUserAt,
    play,
    pause,
    reset,
    setTokenSpeed,
    setTempo,
    bindAdapter,
    initTokenFromTiles,
    persistTokenToTiles
  };
}

// src/apps/cartographer/modes/travel-guide.ts
function createTravelGuideMode() {
  let sidebar = null;
  let playback = null;
  let logic = null;
  let drag = null;
  let unbindContext = null;
  let routeLayer = null;
  let tokenLayer = null;
  let cleanupFile = null;
  let terrainsReady = false;
  let hostEl = null;
  const handleStateChange = (state) => {
    if (routeLayer) {
      routeLayer.draw(state.route, state.editIdx ?? null, state.tokenRC ?? null);
    }
    sidebar?.setTile(state.currentTile ?? state.tokenRC ?? null);
    sidebar?.setSpeed(state.tokenSpeed);
    playback?.setState({ playing: state.playing, route: state.route });
    playback?.setClock?.(state.clockHours ?? 0);
    playback?.setTempo?.(state.tempo ?? 1);
  };
  const resetUi = () => {
    sidebar?.setTile(null);
    sidebar?.setSpeed(1);
    playback?.setState({ playing: false, route: [] });
  };
  const disposeInteractions = () => {
    if (drag) {
      drag.unbind();
      drag = null;
    }
    if (unbindContext) {
      unbindContext();
      unbindContext = null;
    }
  };
  const disposeFile = () => {
    disposeInteractions();
    if (tokenLayer) {
      tokenLayer.destroy?.();
      tokenLayer = null;
    }
    if (routeLayer) {
      routeLayer.destroy();
      routeLayer = null;
    }
    if (logic) {
      try {
        logic.pause();
      } catch (err) {
        console.error("[travel-mode] pause failed", err);
      }
      logic = null;
    }
  };
  const ensureTerrains = async (ctx) => {
    if (terrainsReady) return;
    await setTerrains(await loadTerrains(ctx.app));
    terrainsReady = true;
  };
  return {
    id: "travel",
    label: "Travel",
    async onEnter(ctx) {
      hostEl = ctx.host;
      hostEl.classList.add("sm-cartographer--travel");
      await ensureTerrains(ctx);
      ctx.sidebarHost.empty();
      sidebar = createSidebar(ctx.sidebarHost);
      sidebar.setTitle?.(ctx.getFile()?.basename ?? "");
      sidebar.onSpeedChange((value) => {
        logic?.setTokenSpeed(value);
      });
      playback = createPlaybackControls(sidebar.controlsHost, {
        onPlay: () => {
          void logic?.play();
        },
        onStop: () => {
          logic?.pause();
        },
        onReset: () => {
          void logic?.reset();
        },
        onTempoChange: (v) => {
          logic?.setTempo?.(v);
        }
      });
      resetUi();
    },
    async onExit() {
      await cleanupFile?.();
      cleanupFile = null;
      disposeFile();
      playback?.destroy();
      playback = null;
      sidebar?.destroy();
      sidebar = null;
      hostEl?.classList?.remove?.("sm-cartographer--travel");
      hostEl = null;
    },
    async onFileChange(file, handles, ctx) {
      await cleanupFile?.();
      cleanupFile = null;
      disposeFile();
      sidebar?.setTitle?.(file?.basename ?? "");
      resetUi();
      if (!file || !handles) {
        return;
      }
      const mapLayer = ctx.getMapLayer();
      if (!mapLayer) {
        return;
      }
      routeLayer = createRouteLayer(
        handles.contentG,
        (rc) => mapLayer.centerOf(rc)
      );
      tokenLayer = createTokenLayer(handles.contentG);
      const adapter = {
        ensurePolys: (coords) => mapLayer.ensurePolys(coords),
        centerOf: (rc) => mapLayer.centerOf(rc),
        draw: (route, tokenRC) => {
          if (routeLayer) routeLayer.draw(route, null, tokenRC);
        },
        token: tokenLayer
      };
      const activeLogic = createTravelLogic({
        app: ctx.app,
        minSecondsPerTile: 0.05,
        getMapFile: () => ctx.getFile(),
        adapter,
        onChange: (state) => handleStateChange(state),
        onEncounter: async () => {
          try {
            activeLogic.pause();
          } catch {
          }
          const { getRightLeaf: getRightLeaf2 } = await Promise.resolve().then(() => (init_layout(), layout_exports));
          const { VIEW_ENCOUNTER: VIEW_ENCOUNTER2 } = await Promise.resolve().then(() => (init_view(), view_exports));
          const leaf = getRightLeaf2(ctx.app);
          await leaf.setViewState({ type: VIEW_ENCOUNTER2, active: true });
          ctx.app.workspace.revealLeaf(leaf);
        }
      });
      logic = activeLogic;
      handleStateChange(activeLogic.getState());
      await activeLogic.initTokenFromTiles();
      if (logic !== activeLogic) return;
      drag = createDragController({
        routeLayerEl: routeLayer.el,
        tokenEl: tokenLayer.el,
        token: tokenLayer,
        adapter,
        logic: {
          getState: () => activeLogic.getState(),
          selectDot: (idx) => activeLogic.selectDot(idx),
          moveSelectedTo: (rc) => activeLogic.moveSelectedTo(rc),
          moveTokenTo: (rc) => activeLogic.moveTokenTo(rc)
        },
        polyToCoord: mapLayer.polyToCoord
      });
      drag.bind();
      unbindContext = bindContextMenu(routeLayer.el, {
        getState: () => activeLogic.getState(),
        deleteUserAt: (idx) => activeLogic.deleteUserAt(idx)
      });
      cleanupFile = async () => {
        disposeInteractions();
        if (logic === activeLogic) {
          logic = null;
        }
        try {
          activeLogic.pause();
        } catch (err) {
          console.error("[travel-mode] pause during cleanup failed", err);
        }
        tokenLayer?.destroy?.();
        tokenLayer = null;
        routeLayer?.destroy();
        routeLayer = null;
      };
    },
    async onHexClick(coord, event, ctx) {
      if (drag?.consumeClickSuppression()) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        return;
      }
      const handles = ctx?.getRenderHandles?.();
      if (handles && !handles.polyByCoord?.has?.(`${coord.r},${coord.c}`)) {
        return;
      }
      if (!logic) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      logic.handleHexClick(coord);
    },
    async onSave(_mode, file, _ctx) {
      if (!logic || !file) return false;
      try {
        await logic.persistTokenToTiles();
      } catch (err) {
        console.error("[travel-mode] persistTokenToTiles failed", err);
      }
      return false;
    }
  };
}

// src/apps/cartographer/editor/tools/brush-circle.ts
function attachBrushCircle(handles, opts) {
  const { svg, contentG, overlay } = handles;
  const R = opts.hexRadiusPx;
  const vStep = 1.5 * R;
  const toPx = (d) => R + Math.max(0, d) * vStep;
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "0");
  circle.setAttribute("cy", "0");
  circle.setAttribute("r", String(toPx(opts.initialRadius)));
  circle.setAttribute("fill", "none");
  circle.setAttribute("stroke", "var(--interactive-accent)");
  circle.setAttribute("stroke-width", "2");
  circle.setAttribute("pointer-events", "none");
  circle.style.opacity = "0.6";
  contentG.appendChild(circle);
  const svgPt = svg.createSVGPoint();
  let lastEvt = null;
  let raf = 0;
  function toContent() {
    const m = contentG.getScreenCTM();
    if (!m) return null;
    return svgPt.matrixTransform(m.inverse());
  }
  function bringToFront() {
    contentG.appendChild(circle);
  }
  function tick() {
    raf = 0;
    if (!lastEvt) return;
    svgPt.x = lastEvt.clientX;
    svgPt.y = lastEvt.clientY;
    const pt = toContent();
    if (!pt) return;
    circle.setAttribute("cx", String(pt.x));
    circle.setAttribute("cy", String(pt.y));
    bringToFront();
  }
  function onPointerMove(ev) {
    lastEvt = ev;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function onPointerEnter() {
    circle.style.opacity = "0.6";
  }
  function onPointerLeave() {
    circle.style.opacity = "0";
  }
  svg.addEventListener("pointermove", onPointerMove, { passive: true });
  svg.addEventListener("pointerenter", onPointerEnter, { passive: true });
  svg.addEventListener("pointerleave", onPointerLeave, { passive: true });
  function updateRadius(hexDist) {
    circle.setAttribute("r", String(toPx(hexDist)));
    bringToFront();
  }
  function show() {
    circle.style.display = "";
    circle.style.opacity = "0.6";
    bringToFront();
  }
  function hide() {
    circle.style.opacity = "0";
  }
  function destroy() {
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerenter", onPointerEnter);
    svg.removeEventListener("pointerleave", onPointerLeave);
    if (raf) cancelAnimationFrame(raf);
    circle.remove();
  }
  return { updateRadius, show, hide, destroy };
}

// src/apps/cartographer/editor/tools/terrain-brush/brush.ts
init_hex_notes();

// src/apps/cartographer/editor/tools/terrain-brush/brush-math.ts
function oddR_toAxial(rc) {
  const q = rc.c - (rc.r - (rc.r & 1) >> 1);
  return { q, r: rc.r };
}
function axialDistance(a, b) {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(-a.q - a.r - (-b.q - b.r));
  return Math.max(dq, dr, ds);
}
function hexDistanceOddR(a, b) {
  const A = oddR_toAxial(a);
  const B = oddR_toAxial(b);
  return axialDistance(A, B);
}
function coordsInRadius(center, radius) {
  const out = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const r = center.r + dr;
      const c = center.c + dc + (center.r & 1 ? Math.floor((dr + 1) / 2) : Math.floor(dr / 2));
      if (hexDistanceOddR(center, { r, c }) <= radius) {
        out.push({ r, c });
      }
    }
  }
  out.sort((A, B) => {
    const da = hexDistanceOddR(center, A);
    const db = hexDistanceOddR(center, B);
    if (da !== db) return da - db;
    if (A.r !== B.r) return A.r - B.r;
    return A.c - B.c;
  });
  return out;
}

// src/apps/cartographer/editor/tools/terrain-brush/brush.ts
async function applyBrush(app, mapFile, center, opts, handles) {
  const mode = opts.mode ?? "paint";
  const radius = Math.max(0, opts.radius | 0);
  const raw = coordsInRadius(center, radius);
  const seen = /* @__PURE__ */ new Set();
  for (const coord of raw) {
    const key = `${coord.r},${coord.c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (mode === "erase") {
      await deleteTile(app, mapFile, coord);
      handles.setFill(coord, "transparent");
      continue;
    }
    const terrain = opts.terrain ?? "";
    await saveTile(app, mapFile, coord, { terrain, region: opts.region ?? "" });
    const color = TERRAIN_COLORS[terrain] ?? "transparent";
    handles.setFill(coord, color);
  }
}

// src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts
init_regions_store();
function createBrushTool() {
  let state = {
    radius: 1,
    // UI zeigt 1 = nur Mitte
    region: "",
    terrain: "",
    mode: "paint"
  };
  const eff = () => Math.max(0, state.radius - 1);
  let circle = null;
  return {
    id: "brush",
    label: "Brush",
    // Options-Panel (nur UI & State)
    mountPanel(root, ctx) {
      root.createEl("h3", { text: "Region-Brush" });
      const radiusRow = root.createDiv({ cls: "sm-row" });
      radiusRow.createEl("label", { text: "Radius:" });
      const radiusInput = radiusRow.createEl("input", {
        attr: { type: "range", min: "1", max: "6", step: "1" }
      });
      radiusInput.value = String(state.radius);
      const radiusVal = radiusRow.createEl("span", { text: radiusInput.value });
      radiusInput.oninput = () => {
        state.radius = Number(radiusInput.value);
        radiusVal.textContent = radiusInput.value;
        circle?.updateRadius(eff());
      };
      const regionRow = root.createDiv({ cls: "sm-row" });
      regionRow.createEl("label", { text: "Region:" });
      const regionSelect = regionRow.createEl("select");
      enhanceSelectToSearch(regionSelect, "Such-dropdown\u2026");
      const editRegionsBtn = regionRow.createEl("button", { text: "Bearbeiten\u2026" });
      editRegionsBtn.onclick = () => ctx.app.commands?.executeCommandById?.("salt-marcher:open-library");
      const fillOptions = async () => {
        regionSelect.empty();
        const regions = await loadRegions(ctx.app);
        for (const r of regions) {
          const opt = regionSelect.createEl("option", { text: r.name || "(leer)", value: r.name });
          opt._terrain = r.terrain || "";
          if (r.name === state.region) opt.selected = true;
        }
        const cur = Array.from(regionSelect.options).find((o) => o.value === state.region);
        state.terrain = cur && cur._terrain || "";
        regionSelect.value = state.region;
      };
      void fillOptions();
      regionSelect.onchange = () => {
        state.region = regionSelect.value;
        const opt = regionSelect.selectedOptions[0];
        state.terrain = opt && opt._terrain || "";
      };
      const refTerr = ctx.app.workspace.on?.("salt:terrains-updated", () => void fillOptions());
      const refReg = ctx.app.workspace.on?.("salt:regions-updated", () => void fillOptions());
      const modeRow = root.createDiv({ cls: "sm-row" });
      modeRow.createEl("label", { text: "Modus:" });
      const modeSelect = modeRow.createEl("select");
      modeSelect.createEl("option", { text: "Malen", value: "paint" });
      modeSelect.createEl("option", { text: "L\xF6schen", value: "erase" });
      modeSelect.value = state.mode;
      modeSelect.onchange = () => {
        state.mode = modeSelect.value;
      };
      enhanceSelectToSearch(modeSelect, "Such-dropdown\u2026");
      return () => {
        if (refTerr) ctx.app.workspace.offref?.(refTerr);
        if (refReg) ctx.app.workspace.offref?.(refReg);
        root.empty();
      };
    },
    // Aktivierung/Deaktivierung → Kreis steuern
    onActivate(ctx) {
      const handles = ctx.getHandles();
      if (!handles) return;
      circle?.destroy();
      circle = attachBrushCircle(
        { svg: handles.svg, contentG: handles.contentG, overlay: handles.overlay },
        { initialRadius: eff(), hexRadiusPx: ctx.getOptions()?.radius ?? 42 }
      );
      circle.show();
    },
    onDeactivate() {
      circle?.destroy();
      circle = null;
    },
    onMapRendered(ctx) {
      const handles = ctx.getHandles();
      if (!handles) return;
      circle?.destroy();
      circle = attachBrushCircle(
        { svg: handles.svg, contentG: handles.contentG, overlay: handles.overlay },
        { initialRadius: eff(), hexRadiusPx: ctx.getOptions()?.radius ?? 42 }
      );
      circle.show();
    },
    // Hex-Klick: schreiben + live färben; neue Polys nur gezielt ergänzen
    async onHexClick(rc, ctx) {
      const file = ctx.getFile();
      const handles = ctx.getHandles();
      if (!file || !handles) return false;
      const raw = coordsInRadius(rc, eff());
      const targets = [...new Map(raw.map((k) => [`${k.r},${k.c}`, k])).values()];
      if (state.mode === "paint") {
        const missing = targets.filter((k) => !handles.polyByCoord.has(`${k.r},${k.c}`));
        if (missing.length) handles.ensurePolys?.(missing);
      }
      await applyBrush(
        ctx.app,
        file,
        rc,
        { radius: eff(), terrain: state.terrain, region: state.region, mode: state.mode },
        // Distanz reinschreiben
        handles
      );
      return true;
    }
  };
}

// src/apps/cartographer/modes/editor.ts
function createEditorMode() {
  let panel = null;
  let fileLabel = null;
  let toolSelect = null;
  let toolBody = null;
  let statusLabel = null;
  const tools = [createBrushTool()];
  let state = {
    file: null,
    handles: null,
    options: null,
    tool: null,
    cleanupPanel: null
  };
  let toolCtx = null;
  const setStatus = (msg) => {
    if (!statusLabel) return;
    statusLabel.setText(msg ?? "");
    statusLabel.toggleClass("is-empty", !msg);
  };
  const updateFileLabel = () => {
    if (!fileLabel) return;
    fileLabel.textContent = state.file ? state.file.basename : "Keine Karte";
  };
  const updatePanelState = () => {
    const hasHandles = !!state.handles;
    panel?.toggleClass("is-disabled", !hasHandles);
    if (toolSelect) {
      toolSelect.disabled = !hasHandles;
    }
    if (!hasHandles) {
      setStatus(state.file ? "Karte wird geladen \u2026" : "Keine Karte ausgew\xE4hlt.");
    } else {
      setStatus("");
    }
  };
  const ensureToolCtx = (ctx) => {
    toolCtx = {
      app: ctx.app,
      getFile: () => state.file,
      getHandles: () => state.handles,
      getOptions: () => state.options,
      setStatus
    };
    return toolCtx;
  };
  const switchTool = async (id) => {
    if (!toolCtx || !toolBody || !toolSelect) return;
    if (state.tool?.onDeactivate) {
      try {
        state.tool.onDeactivate(toolCtx);
      } catch (err) {
        console.error("[editor-mode] tool onDeactivate failed", err);
      }
    }
    state.cleanupPanel?.();
    state.cleanupPanel = null;
    const next = tools.find((tool) => tool.id === id) ?? tools[0];
    state.tool = next;
    toolSelect.value = next.id;
    toolBody.empty();
    try {
      state.cleanupPanel = next.mountPanel(toolBody, toolCtx);
    } catch (err) {
      console.error("[editor-mode] mountPanel failed", err);
      state.cleanupPanel = null;
    }
    try {
      next.onActivate?.(toolCtx);
    } catch (err) {
      console.error("[editor-mode] onActivate failed", err);
    }
    if (state.handles) {
      try {
        next.onMapRendered?.(toolCtx);
      } catch (err) {
        console.error("[editor-mode] onMapRendered failed", err);
      }
    }
  };
  return {
    id: "editor",
    label: "Editor",
    async onEnter(ctx) {
      state = { ...state, tool: null };
      ctx.sidebarHost.empty();
      panel = ctx.sidebarHost.createDiv({ cls: "sm-cartographer__panel sm-cartographer__panel--editor" });
      panel.createEl("h3", { text: "Map Editor" });
      fileLabel = panel.createEl("div", { cls: "sm-cartographer__panel-file" });
      const toolsRow = panel.createDiv({ cls: "sm-cartographer__panel-tools" });
      toolsRow.createEl("label", { text: "Tool:" });
      toolSelect = toolsRow.createEl("select");
      for (const tool of tools) {
        toolSelect.createEl("option", { value: tool.id, text: tool.label });
      }
      enhanceSelectToSearch(toolSelect, "Such-dropdown\u2026");
      toolSelect.onchange = () => {
        void switchTool(toolSelect?.value ?? tools[0].id);
      };
      toolBody = panel.createDiv({ cls: "sm-cartographer__panel-body" });
      statusLabel = panel.createDiv({ cls: "sm-cartographer__panel-status" });
      ensureToolCtx(ctx);
      updateFileLabel();
      updatePanelState();
      await switchTool(tools[0].id);
    },
    async onExit() {
      if (state.tool && toolCtx) {
        try {
          state.tool.onDeactivate?.(toolCtx);
        } catch (err) {
          console.error("[editor-mode] onDeactivate failed", err);
        }
      }
      state.cleanupPanel?.();
      state.cleanupPanel = null;
      state.tool = null;
      toolCtx = null;
      panel?.remove();
      panel = null;
      fileLabel = null;
      toolSelect = null;
      toolBody = null;
      statusLabel = null;
    },
    async onFileChange(file, handles, ctx) {
      state.file = file;
      state.handles = handles;
      state.options = ctx.getOptions();
      updateFileLabel();
      updatePanelState();
      if (!handles) return;
      if (!toolCtx) ensureToolCtx(ctx);
      try {
        state.tool?.onMapRendered?.(toolCtx);
      } catch (err) {
        console.error("[editor-mode] onMapRendered failed", err);
      }
    },
    async onHexClick(coord) {
      if (!toolCtx || !state.tool?.onHexClick) return;
      try {
        await state.tool.onHexClick(coord, toolCtx);
      } catch (err) {
        console.error("[editor-mode] onHexClick failed", err);
      }
    }
  };
}

// src/apps/cartographer/modes/inspector.ts
init_hex_notes();
function createInspectorMode() {
  let ui = {
    panel: null,
    fileLabel: null,
    message: null,
    terrain: null,
    note: null
  };
  let state = {
    file: null,
    handles: null,
    selection: null,
    saveTimer: null
  };
  const clearSaveTimer = () => {
    if (state.saveTimer !== null) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
  };
  const resetInputs = () => {
    if (ui.terrain) {
      ui.terrain.value = "";
      ui.terrain.disabled = true;
    }
    if (ui.note) {
      ui.note.value = "";
      ui.note.disabled = true;
    }
  };
  const updateMessage = () => {
    if (!ui.message) return;
    if (!state.file || !state.handles) {
      ui.message.setText(state.file ? "Karte wird geladen \u2026" : "Keine Karte ausgew\xE4hlt.");
    } else if (!state.selection) {
      ui.message.setText("Hex anklicken, um Terrain & Notiz zu bearbeiten.");
    } else {
      ui.message.setText(`Hex r${state.selection.r}, c${state.selection.c}`);
    }
  };
  const updateFileLabel = () => {
    if (!ui.fileLabel) return;
    ui.fileLabel.textContent = state.file ? state.file.basename : "Keine Karte";
  };
  const updatePanelState = () => {
    const hasMap = !!state.file && !!state.handles;
    ui.panel?.toggleClass("is-disabled", !hasMap);
    if (!hasMap) {
      state.selection = null;
      resetInputs();
    }
    updateMessage();
  };
  const scheduleSave = (ctx) => {
    if (!state.selection) return;
    const file = ctx.getFile();
    if (!file) return;
    const handles = ctx.getRenderHandles();
    clearSaveTimer();
    state.saveTimer = window.setTimeout(async () => {
      const terrain = ui.terrain?.value ?? "";
      const note = ui.note?.value ?? "";
      try {
        await saveTile(ctx.app, file, state.selection, { terrain, note });
      } catch (err) {
        console.error("[inspector-mode] saveTile failed", err);
      }
      const color = TERRAIN_COLORS[terrain] ?? "transparent";
      try {
        handles?.setFill(state.selection, color);
      } catch (err) {
        console.error("[inspector-mode] setFill failed", err);
      }
    }, 250);
  };
  const loadSelection = async (ctx) => {
    if (!state.selection) return;
    const file = ctx.getFile();
    if (!file) return;
    let data = null;
    try {
      data = await loadTile(ctx.app, file, state.selection);
    } catch (err) {
      console.error("[inspector-mode] loadTile failed", err);
      data = null;
    }
    if (ui.terrain) {
      ui.terrain.value = data?.terrain ?? "";
      ui.terrain.disabled = false;
    }
    if (ui.note) {
      ui.note.value = data?.note ?? "";
      ui.note.disabled = false;
    }
    updateMessage();
  };
  return {
    id: "inspector",
    label: "Inspector",
    async onEnter(ctx) {
      ui = { panel: null, fileLabel: null, message: null, terrain: null, note: null };
      state = { ...state, selection: null };
      ctx.sidebarHost.empty();
      ui.panel = ctx.sidebarHost.createDiv({ cls: "sm-cartographer__panel sm-cartographer__panel--inspector" });
      ui.panel.createEl("h3", { text: "Inspektor" });
      ui.fileLabel = ui.panel.createEl("div", { cls: "sm-cartographer__panel-file" });
      const messageRow = ui.panel.createEl("div", { cls: "sm-cartographer__panel-info" });
      ui.message = messageRow;
      const terrRow = ui.panel.createDiv({ cls: "sm-cartographer__panel-row" });
      terrRow.createEl("label", { text: "Terrain:" });
      ui.terrain = terrRow.createEl("select");
      for (const key of Object.keys(TERRAIN_COLORS)) {
        const opt = ui.terrain.createEl("option", { text: key || "(leer)" });
        opt.value = key;
      }
      enhanceSelectToSearch(ui.terrain, "Such-dropdown\u2026");
      ui.terrain.disabled = true;
      ui.terrain.onchange = () => scheduleSave(ctx);
      const noteRow = ui.panel.createDiv({ cls: "sm-cartographer__panel-row" });
      noteRow.createEl("label", { text: "Notiz:" });
      ui.note = noteRow.createEl("textarea", { attr: { rows: "6" } });
      ui.note.disabled = true;
      ui.note.oninput = () => scheduleSave(ctx);
      updateFileLabel();
      updatePanelState();
    },
    async onExit() {
      clearSaveTimer();
      ui.panel?.remove();
      ui = { panel: null, fileLabel: null, message: null, terrain: null, note: null };
      state = { file: null, handles: null, selection: null, saveTimer: null };
    },
    async onFileChange(file, handles, ctx) {
      state.file = file;
      state.handles = handles;
      clearSaveTimer();
      resetInputs();
      updateFileLabel();
      updatePanelState();
      if (state.selection && state.file && state.handles) {
        await loadSelection(ctx);
      }
    },
    async onHexClick(coord, _event, ctx) {
      if (!state.file || !state.handles) return;
      clearSaveTimer();
      state.selection = coord;
      updateMessage();
      await loadSelection(ctx);
    }
  };
}

// src/apps/cartographer/view-shell.ts
async function mountCartographer(app, host, initialFile) {
  host.empty();
  host.classList.add("sm-cartographer");
  const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
  const body = host.createDiv({ cls: "sm-cartographer__body" });
  const mapHost = body.createDiv({ cls: "sm-cartographer__map" });
  const sidebarHost = body.createDiv({ cls: "sm-cartographer__sidebar" });
  let currentFile = initialFile ?? null;
  let headerHandle = null;
  let mapLayer = null;
  let destroyed = false;
  let loadToken = 0;
  let activeMode = null;
  let modeChange = Promise.resolve();
  const modeMenuItems = [];
  let modeTriggerBtn = null;
  let modeMenuEl = null;
  let modeDropdownEl = null;
  let unbindOutsideClick = null;
  let currentOptions = null;
  const modeCtx = {
    app,
    host,
    mapHost,
    sidebarHost,
    getFile: () => currentFile,
    getMapLayer: () => mapLayer,
    getRenderHandles: () => mapLayer?.handles ?? null,
    getOptions: () => currentOptions
  };
  const modes = [
    createTravelGuideMode(),
    createEditorMode(),
    createInspectorMode()
  ];
  const onHexClick = async (event) => {
    const ev = event;
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
    if (!activeMode?.onHexClick) return;
    await activeMode.onHexClick(ev.detail, ev, modeCtx);
  };
  mapHost.addEventListener("hex:click", onHexClick, { passive: false });
  async function teardownLayer() {
    if (mapLayer) {
      try {
        mapLayer.destroy();
      } catch (err) {
        console.error("[cartographer] failed to destroy map layer", err);
      }
      mapLayer = null;
    }
    mapHost.empty();
    currentOptions = null;
  }
  async function switchMode(id) {
    const next = modes.find((m) => m.id === id) ?? modes[0];
    if (activeMode?.id === next.id) return;
    modeChange = modeChange.then(async () => {
      if (destroyed) return;
      try {
        await activeMode?.onExit();
      } catch (err) {
        console.error("[cartographer] mode exit failed", err);
      }
      activeMode = next;
      if (modeTriggerBtn) modeTriggerBtn.textContent = next.label;
      for (const { mode, item } of modeMenuItems) {
        const isActive = mode.id === next.id;
        item.classList.toggle("is-active", isActive);
        item.ariaSelected = isActive ? "true" : "false";
      }
      try {
        await next.onEnter(modeCtx);
        await next.onFileChange(currentFile, mapLayer?.handles ?? null, modeCtx);
      } catch (err) {
        console.error("[cartographer] mode enter failed", err);
      }
    });
    await modeChange;
  }
  async function loadHexOptions(file) {
    const block = await getFirstHexBlock(app, file);
    if (!block) return null;
    return parseOptions(block);
  }
  async function renderMap(token) {
    await teardownLayer();
    if (!currentFile) {
      mapHost.createDiv({ cls: "sm-cartographer__empty", text: "Keine Karte ausgew\xE4hlt." });
      currentOptions = null;
      await activeMode?.onFileChange(null, null, modeCtx);
      return;
    }
    let opts = null;
    try {
      opts = await loadHexOptions(currentFile);
    } catch (err) {
      console.error("[cartographer] failed to parse map options", err);
    }
    if (!opts) {
      mapHost.createDiv({
        cls: "sm-cartographer__empty",
        text: "Kein hex3x3-Block in dieser Datei."
      });
      currentOptions = null;
      await activeMode?.onFileChange(currentFile, null, modeCtx);
      return;
    }
    try {
      const layer = await createMapLayer(app, mapHost, currentFile, opts);
      if (destroyed || token !== loadToken) {
        layer.destroy();
        return;
      }
      mapLayer = layer;
      currentOptions = opts;
      await activeMode?.onFileChange(currentFile, mapLayer.handles, modeCtx);
    } catch (err) {
      console.error("[cartographer] failed to render map", err);
      mapHost.createDiv({
        cls: "sm-cartographer__empty",
        text: "Karte konnte nicht geladen werden."
      });
      currentOptions = null;
      await activeMode?.onFileChange(currentFile, null, modeCtx);
    }
  }
  async function refresh() {
    const token = ++loadToken;
    await renderMap(token);
  }
  const onManagerChange = async (file) => {
    currentFile = file;
    headerHandle?.setFileLabel(file);
    await refresh();
  };
  const mapManager = createMapManager(app, {
    initialFile: currentFile,
    onChange: onManagerChange
  });
  async function setFile(file) {
    await mapManager.setFile(file);
  }
  headerHandle = createMapHeader(app, headerHost, {
    title: "Cartographer",
    initialFile,
    onOpen: async (file) => {
      await mapManager.setFile(file);
    },
    onCreate: async (file) => {
      await mapManager.setFile(file);
    },
    onDelete: async () => {
      mapManager.deleteCurrent();
    },
    onSave: async (mode, file) => {
      if (!activeMode?.onSave) return false;
      try {
        const handled = await activeMode.onSave(mode, file, modeCtx);
        return handled === true;
      } catch (err) {
        console.error("[cartographer] mode onSave failed", err);
        return false;
      }
    },
    titleRightSlot: (slot) => {
      slot.classList.add("sm-cartographer__mode-switch");
      const dropdown = slot.createDiv({ cls: "sm-mode-dropdown" });
      modeDropdownEl = dropdown;
      modeTriggerBtn = dropdown.createEl("button", {
        text: modes[0]?.label ?? "Mode",
        attr: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" }
      });
      modeTriggerBtn.classList.add("sm-mode-dropdown__trigger");
      modeMenuEl = dropdown.createDiv({ cls: "sm-mode-dropdown__menu", attr: { role: "listbox" } });
      const closeMenu = () => {
        if (!modeMenuEl || !modeTriggerBtn) return;
        modeDropdownEl?.classList.remove("is-open");
        modeTriggerBtn.setAttr("aria-expanded", "false");
        if (unbindOutsideClick) {
          unbindOutsideClick();
          unbindOutsideClick = null;
        }
      };
      const openMenu = () => {
        if (!modeMenuEl || !modeTriggerBtn) return;
        modeDropdownEl?.classList.add("is-open");
        modeTriggerBtn.setAttr("aria-expanded", "true");
        const onDocClick = (ev) => {
          if (!dropdown.contains(ev.target)) closeMenu();
        };
        document.addEventListener("mousedown", onDocClick);
        unbindOutsideClick = () => document.removeEventListener("mousedown", onDocClick);
      };
      modeTriggerBtn.onclick = () => {
        if (!modeMenuEl) return;
        const isOpen = modeDropdownEl?.classList.contains("is-open");
        if (isOpen) closeMenu();
        else openMenu();
      };
      for (const mode of modes) {
        const item = modeMenuEl.createEl("button", {
          text: mode.label,
          attr: { role: "option", type: "button", "data-id": mode.id }
        });
        item.classList.add("sm-mode-dropdown__item");
        item.onclick = () => {
          closeMenu();
          void switchMode(mode.id);
        };
        modeMenuItems.push({ mode, item });
      }
    }
  });
  headerHandle.setFileLabel(currentFile);
  await switchMode(modes[0].id);
  await mapManager.setFile(currentFile);
  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    mapHost.removeEventListener("hex:click", onHexClick);
    await modeChange;
    try {
      await activeMode?.onExit();
    } catch (err) {
      console.error("[cartographer] mode exit during destroy failed", err);
    }
    activeMode = null;
    await teardownLayer();
    headerHandle?.destroy();
    headerHandle = null;
    if (unbindOutsideClick) {
      unbindOutsideClick();
      unbindOutsideClick = null;
    }
    host.empty();
    host.removeClass("sm-cartographer");
  }
  return {
    destroy,
    setFile,
    setMode: async (id) => {
      await switchMode(id);
    }
  };
}

// src/apps/cartographer/index.ts
var VIEW_TYPE_CARTOGRAPHER = "cartographer-view";
var VIEW_CARTOGRAPHER = VIEW_TYPE_CARTOGRAPHER;
var CartographerView = class extends import_obsidian12.ItemView {
  constructor(leaf) {
    super(leaf);
    this.controller = null;
    this.hostEl = null;
    this.initialFile = null;
  }
  getViewType() {
    return VIEW_TYPE_CARTOGRAPHER;
  }
  getDisplayText() {
    return "Cartographer";
  }
  getIcon() {
    return "compass";
  }
  setFile(file) {
    this.initialFile = file;
    void this.controller?.setFile(file ?? null);
  }
  async onOpen() {
    const container = this.containerEl;
    const content = container.children[1];
    content.empty();
    this.hostEl = content.createDiv({ cls: "cartographer-host" });
    const file = this.initialFile ?? this.app.workspace.getActiveFile() ?? null;
    this.controller = await mountCartographer(this.app, this.hostEl, file);
  }
  async onClose() {
    await this.controller?.destroy();
    this.controller = null;
    this.hostEl = null;
  }
};

// src/apps/library/view.ts
var import_obsidian21 = require("obsidian");

// src/apps/library/core/creature-files.ts
var import_obsidian13 = require("obsidian");
var CREATURES_DIR = "SaltMarcher/Creatures";
async function ensureCreatureDir(app) {
  const p = (0, import_obsidian13.normalizePath)(CREATURES_DIR);
  let f = app.vault.getAbstractFileByPath(p);
  if (f instanceof import_obsidian13.TFolder) return f;
  await app.vault.createFolder(p).catch(() => {
  });
  f = app.vault.getAbstractFileByPath(p);
  if (f instanceof import_obsidian13.TFolder) return f;
  throw new Error("Could not create creatures directory");
}
function sanitizeFileName2(name) {
  const trimmed = (name || "Creature").trim();
  return trimmed.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/^\.+$/, "Creature").slice(0, 120);
}
async function listCreatureFiles(app) {
  const dir = await ensureCreatureDir(app);
  const out = [];
  const walk = (folder) => {
    for (const child of folder.children) {
      if (child instanceof import_obsidian13.TFolder) walk(child);
      else if (child instanceof import_obsidian13.TFile && child.extension === "md") out.push(child);
    }
  };
  walk(dir);
  return out;
}
function watchCreatureDir(app, onChange) {
  const base = (0, import_obsidian13.normalizePath)(CREATURES_DIR) + "/";
  const isInDir = (f) => (f instanceof import_obsidian13.TFile || f instanceof import_obsidian13.TFolder) && (f.path + "/").startsWith(base);
  const handler = (f) => {
    if (isInDir(f)) onChange?.();
  };
  app.vault.on("create", handler);
  app.vault.on("delete", handler);
  app.vault.on("rename", handler);
  app.vault.on("modify", handler);
  return () => {
    app.vault.off("create", handler);
    app.vault.off("delete", handler);
    app.vault.off("rename", handler);
    app.vault.off("modify", handler);
  };
}
function yamlList(items) {
  if (!items || items.length === 0) return void 0;
  const safe = items.map((s) => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", ");
  return `[${safe}]`;
}
function parseNum(v) {
  if (!v) return null;
  const m = String(v).match(/-?\d+/);
  if (!m) return null;
  return Number(m[0]);
}
function abilityMod(score) {
  const n = parseNum(score);
  if (n == null || Number.isNaN(n)) return null;
  return Math.floor((n - 10) / 2);
}
function fmtSigned(n) {
  return (n >= 0 ? "+" : "") + n;
}
var SKILL_TO_ABILITY = { Athletics: "str", Acrobatics: "dex", "Sleight of Hand": "dex", Stealth: "dex", Arcana: "int", History: "int", Investigation: "int", Nature: "int", Religion: "int", "Animal Handling": "wis", Insight: "wis", Medicine: "wis", Perception: "wis", Survival: "wis", Deception: "cha", Intimidation: "cha", Performance: "cha", Persuasion: "cha" };
function composeAlignment(d) {
  const a = d.alignmentLawChaos?.trim();
  const b = d.alignmentGoodEvil?.trim();
  if (!a && !b) return void 0;
  if (a?.toLowerCase() === "neutral" && b?.toLowerCase() === "neutral") return "Neutral";
  return [a, b].filter(Boolean).join(" ");
}
function statblockToMarkdown(d) {
  var _a;
  const hdr = [d.size || "", d.type || "", composeAlignment(d) || ""].filter(Boolean).join(", ");
  const name = d.name || "Unnamed Creature";
  const lines = [];
  lines.push("---");
  lines.push("smType: creature");
  lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
  if (d.size) lines.push(`size: "${d.size}"`);
  if (d.type) lines.push(`type: "${d.type}"`);
  const align = composeAlignment(d);
  if (align) lines.push(`alignment: "${align}"`);
  if (d.ac) lines.push(`ac: "${d.ac}"`);
  if (d.initiative) lines.push(`initiative: "${d.initiative}"`);
  if (d.hp) lines.push(`hp: "${d.hp}"`);
  if (d.hitDice) lines.push(`hit_dice: "${d.hitDice}"`);
  if (d.speedWalk) lines.push(`speed_walk: "${d.speedWalk}"`);
  if (d.speedSwim) lines.push(`speed_swim: "${d.speedSwim}"`);
  if (d.speedFly) lines.push(`speed_fly: "${d.speedFly}"`);
  if (d.speedBurrow) lines.push(`speed_burrow: "${d.speedBurrow}"`);
  const speedsYaml = yamlList(d.speedList);
  if (speedsYaml) lines.push(`speeds: ${speedsYaml}`);
  if (d.str) lines.push(`str: "${d.str}"`);
  if (d.dex) lines.push(`dex: "${d.dex}"`);
  if (d.con) lines.push(`con: "${d.con}"`);
  if (d.int) lines.push(`int: "${d.int}"`);
  if (d.wis) lines.push(`wis: "${d.wis}"`);
  if (d.cha) lines.push(`cha: "${d.cha}"`);
  if (d.pb) lines.push(`pb: "${d.pb}"`);
  if (d.saveProf) {
    const profs = Object.entries(d.saveProf).filter(([, v]) => !!v).map(([k]) => k.toUpperCase());
    if (profs.length) lines.push(`saves_prof: ${yamlList(profs)}`);
  }
  if (d.skillsProf && d.skillsProf.length) lines.push(`skills_prof: ${yamlList(d.skillsProf)}`);
  if (d.skillsExpertise && d.skillsExpertise.length) lines.push(`skills_expertise: ${yamlList(d.skillsExpertise)}`);
  const sensesYaml = yamlList(d.sensesList);
  if (sensesYaml) lines.push(`senses: ${sensesYaml}`);
  const langsYaml = yamlList(d.languagesList);
  if (langsYaml) lines.push(`languages: ${langsYaml}`);
  const passivesYaml = yamlList(d.passivesList);
  if (passivesYaml) lines.push(`passives: ${passivesYaml}`);
  const vulnerabilitiesYaml = yamlList(d.damageVulnerabilitiesList);
  if (vulnerabilitiesYaml) lines.push(`damage_vulnerabilities: ${vulnerabilitiesYaml}`);
  const resistancesYaml = yamlList(d.damageResistancesList);
  if (resistancesYaml) lines.push(`damage_resistances: ${resistancesYaml}`);
  const immunitiesYaml = yamlList(d.damageImmunitiesList);
  if (immunitiesYaml) lines.push(`damage_immunities: ${immunitiesYaml}`);
  const conditionYaml = yamlList(d.conditionImmunitiesList);
  if (conditionYaml) lines.push(`condition_immunities: ${conditionYaml}`);
  const gearYaml = yamlList(d.gearList);
  if (gearYaml) lines.push(`gear: ${gearYaml}`);
  if (d.cr) lines.push(`cr: "${d.cr}"`);
  if (d.xp) lines.push(`xp: "${d.xp}"`);
  const entries = d.entries && d.entries.length ? d.entries : d.actionsList && d.actionsList.length ? d.actionsList.map((a) => ({ category: "action", ...a })) : void 0;
  if (entries && entries.length) {
    const json = JSON.stringify(entries).replace(/"/g, '\\"');
    lines.push(`entries_structured_json: "${json}"`);
  }
  if (d.spellsKnown && d.spellsKnown.length) {
    const json = JSON.stringify(d.spellsKnown).replace(/"/g, '\\"');
    lines.push(`spells_known_json: "${json}"`);
  }
  lines.push("---\n");
  lines.push(`# ${name}`);
  if (hdr) lines.push(hdr);
  lines.push("");
  if (d.ac || d.initiative) lines.push(`AC ${d.ac ?? "-"}    Initiative ${d.initiative ?? "-"}`);
  if (d.hp || d.hitDice) lines.push(`HP ${d.hp ?? "-"}${d.hitDice ? ` (${d.hitDice})` : ""}`);
  let speedsLine = [];
  if (d.speedList && d.speedList.length) speedsLine = d.speedList.slice();
  else {
    if (d.speedWalk) speedsLine.push(`${d.speedWalk}`);
    if (d.speedSwim) speedsLine.push(`swim ${d.speedSwim}`);
    if (d.speedFly) speedsLine.push(`fly ${d.speedFly}`);
    if (d.speedBurrow) speedsLine.push(`burrow ${d.speedBurrow}`);
  }
  if (speedsLine.length) lines.push(`Speed ${speedsLine.join(", ")}`);
  lines.push("");
  const abilities = [["STR", d.str], ["DEX", d.dex], ["CON", d.con], ["INT", d.int], ["WIS", d.wis], ["CHA", d.cha]];
  if (abilities.some(([_, v]) => !!v)) {
    lines.push("| Ability | Score |");
    lines.push("| ------: | :---- |");
    for (const [k, v] of abilities) if (v) lines.push(`| ${k} | ${v} |`);
    lines.push("");
  }
  const pbNum = parseNum(d.pb) ?? 0;
  if (d.saveProf) {
    const parts = [];
    const map = [["str", "Str", d.str], ["dex", "Dex", d.dex], ["con", "Con", d.con], ["int", "Int", d.int], ["wis", "Wis", d.wis], ["cha", "Cha", d.cha]];
    for (const [key, label, score] of map) {
      if (d.saveProf[key]) {
        const mod = abilityMod(score) ?? 0;
        parts.push(`${label} ${fmtSigned(mod + pbNum)}`);
      }
    }
    if (parts.length) lines.push(`Saves ${parts.join(", ")}`);
  }
  const getSet = (arr) => new Set((arr || []).map((s) => s.trim()).filter(Boolean));
  const profSet = getSet(d.skillsProf);
  const expSet = getSet(d.skillsExpertise);
  if (profSet.size || expSet.size) {
    const parts = [];
    const allSkills = Array.from(/* @__PURE__ */ new Set([...Object.keys(SKILL_TO_ABILITY)]));
    for (const sk of allSkills) {
      const hasProf = profSet.has(sk) || expSet.has(sk);
      if (!hasProf) continue;
      const abilKey = SKILL_TO_ABILITY[sk];
      const mod = abilityMod(d[abilKey]) ?? 0;
      const bonus = expSet.has(sk) ? pbNum * 2 : pbNum;
      parts.push(`${sk} ${fmtSigned(mod + bonus)}`);
    }
    if (parts.length) lines.push(`Skills ${parts.join(", ")}`);
  }
  const sensesParts = [];
  if (d.sensesList && d.sensesList.length) sensesParts.push(d.sensesList.join(", "));
  const passiveChunk = d.passivesList && d.passivesList.length ? d.passivesList.join("; ") : "";
  if (sensesParts.length || passiveChunk) {
    const tail = passiveChunk ? sensesParts.length ? `; ${passiveChunk}` : passiveChunk : "";
    lines.push(`Senses ${[sensesParts.join(", "), tail].filter(Boolean).join("")}`);
  }
  if (d.damageVulnerabilitiesList && d.damageVulnerabilitiesList.length) lines.push(`Vulnerabilities ${d.damageVulnerabilitiesList.join(", ")}`);
  if (d.damageResistancesList && d.damageResistancesList.length) lines.push(`Resistances ${d.damageResistancesList.join(", ")}`);
  if (d.damageImmunitiesList && d.damageImmunitiesList.length) lines.push(`Immunities ${d.damageImmunitiesList.join(", ")}`);
  if (d.conditionImmunitiesList && d.conditionImmunitiesList.length) lines.push(`Condition Immunities ${d.conditionImmunitiesList.join(", ")}`);
  if (d.languagesList && d.languagesList.length) lines.push(`Languages ${d.languagesList.join(", ")}`);
  if (d.gearList && d.gearList.length) lines.push(`Gear ${d.gearList.join(", ")}`);
  if (d.cr || d.pb || d.xp) {
    const bits = [];
    if (d.cr) bits.push(`CR ${d.cr}`);
    if (pbNum) bits.push(`PB ${fmtSigned(pbNum)}`);
    if (d.xp) bits.push(`XP ${d.xp}`);
    if (bits.length) lines.push(bits.join("; "));
  }
  lines.push("");
  if (entries && entries.length) {
    const groups = { trait: [], action: [], bonus: [], reaction: [], legendary: [] };
    for (const e of entries) {
      (groups[_a = e.category] || (groups[_a] = [])).push(e);
    }
    const renderGroup = (title, arr) => {
      if (!arr || arr.length === 0) return;
      lines.push(`## ${title}
`);
      for (const a of arr) {
        const headParts = [a.name, a.recharge].filter(Boolean).join(" ");
        lines.push(`- **${headParts}**`);
        const sub = [];
        if (a.kind) sub.push(a.kind);
        if (a.to_hit) sub.push(`to hit ${a.to_hit}`);
        else if (a.to_hit_from) {
          const abil = a.to_hit_from.ability;
          const abilMod = abil === "best_of_str_dex" ? Math.max(abilityMod(d.str) ?? 0, abilityMod(d.dex) ?? 0) : abilityMod(d[abil]) ?? 0;
          const pb = parseNum(d.pb) ?? 0;
          const total = abilMod + (a.to_hit_from.proficient ? pb : 0);
          sub.push(`to hit ${fmtSigned(total)}`);
        }
        if (a.range) sub.push(a.range);
        if (a.target) sub.push(a.target);
        if (a.damage) sub.push(a.damage);
        else if (a.damage_from) {
          const abilKey = a.damage_from.ability;
          const abilMod = abilKey ? abilKey === "best_of_str_dex" ? Math.max(abilityMod(d.str) ?? 0, abilityMod(d.dex) ?? 0) : abilityMod(d[abilKey]) ?? 0 : 0;
          const bonus = a.damage_from.bonus ? ` ${a.damage_from.bonus}` : "";
          const modTxt = abilMod ? ` ${fmtSigned(abilMod)}` : "";
          sub.push(`${a.damage_from.dice}${modTxt}${bonus}`.trim());
        }
        if (a.save_ability) sub.push(`Save ${a.save_ability}${a.save_dc ? ` DC ${a.save_dc}` : ""}${a.save_effect ? ` (${a.save_effect})` : ""}`);
        if (sub.length) lines.push(`  - ${sub.join(", ")}`);
        if (a.text && a.text.trim()) lines.push(`  ${a.text.trim()}`);
      }
      lines.push("");
    };
    renderGroup("Traits", groups.trait);
    renderGroup("Actions", groups.action);
    renderGroup("Bonus Actions", groups.bonus);
    renderGroup("Reactions", groups.reaction);
    renderGroup("Legendary Actions", groups.legendary);
  } else {
    if (d.traits) {
      lines.push("## Traits\n");
      lines.push(d.traits.trim());
      lines.push("");
    }
    if (d.actions) {
      lines.push("## Actions\n");
      lines.push(d.actions.trim());
      lines.push("");
    }
    if (d.legendary) {
      lines.push("## Legendary Actions\n");
      lines.push(d.legendary.trim());
      lines.push("");
    }
  }
  if (d.spellsKnown && d.spellsKnown.length) {
    lines.push("## Spellcasting\n");
    const byLevel = {};
    for (const s of d.spellsKnown) {
      const key = s.level == null ? "unknown" : String(s.level);
      (byLevel[key] || (byLevel[key] = [])).push({ name: s.name, uses: s.uses, notes: s.notes });
    }
    const order = Object.keys(byLevel).map((k) => k === "unknown" ? Infinity : parseInt(k, 10)).sort((a, b) => a - b).map((n) => n === Infinity ? "unknown" : String(n));
    for (const k of order) {
      const lvl = k === "unknown" ? "Spells" : k === "0" ? "Cantrips" : `Level ${k}`;
      lines.push(`- ${lvl}:`);
      for (const s of byLevel[k]) {
        const extra = [s.uses, s.notes].filter(Boolean).join("; ");
        lines.push(`  - ${s.name}${extra ? ` (${extra})` : ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
async function createCreatureFile(app, d) {
  const folder = await ensureCreatureDir(app);
  const baseName = sanitizeFileName2(d.name || "Creature");
  let fileName = `${baseName}.md`;
  let path = (0, import_obsidian13.normalizePath)(`${folder.path}/${fileName}`);
  let i = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    fileName = `${baseName} (${i}).md`;
    path = (0, import_obsidian13.normalizePath)(`${folder.path}/${fileName}`);
    i++;
  }
  const content = statblockToMarkdown(d);
  const file = await app.vault.create(path, content);
  return file;
}

// src/apps/library/view.ts
init_regions_store();

// src/apps/library/core/spell-files.ts
var import_obsidian14 = require("obsidian");
var SPELLS_DIR = "SaltMarcher/Spells";
async function ensureSpellDir(app) {
  const p = (0, import_obsidian14.normalizePath)(SPELLS_DIR);
  let f = app.vault.getAbstractFileByPath(p);
  if (f instanceof import_obsidian14.TFolder) return f;
  await app.vault.createFolder(p).catch(() => {
  });
  f = app.vault.getAbstractFileByPath(p);
  if (f instanceof import_obsidian14.TFolder) return f;
  throw new Error("Could not create spells directory");
}
async function listSpellFiles(app) {
  const dir = await ensureSpellDir(app);
  const out = [];
  const walk = (folder) => {
    for (const child of folder.children) {
      if (child instanceof import_obsidian14.TFolder) walk(child);
      else if (child instanceof import_obsidian14.TFile && child.extension === "md") out.push(child);
    }
  };
  walk(dir);
  return out;
}
function watchSpellDir(app, onChange) {
  const base = (0, import_obsidian14.normalizePath)(SPELLS_DIR) + "/";
  const isInDir = (f) => (f instanceof import_obsidian14.TFile || f instanceof import_obsidian14.TFolder) && (f.path + "/").startsWith(base);
  const handler = (f) => {
    if (isInDir(f)) onChange?.();
  };
  app.vault.on("create", handler);
  app.vault.on("delete", handler);
  app.vault.on("rename", handler);
  app.vault.on("modify", handler);
  return () => {
    app.vault.off("create", handler);
    app.vault.off("delete", handler);
    app.vault.off("rename", handler);
    app.vault.off("modify", handler);
  };
}
function yamlList2(items) {
  if (!items || items.length === 0) return void 0;
  const safe = items.map((s) => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", ");
  return `[${safe}]`;
}
function spellToMarkdown(d) {
  const lines = [];
  const name = d.name || "Unnamed Spell";
  lines.push("---");
  lines.push("smType: spell");
  lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
  if (Number.isFinite(d.level)) lines.push(`level: ${d.level}`);
  if (d.school) lines.push(`school: "${d.school}"`);
  if (d.casting_time) lines.push(`casting_time: "${d.casting_time}"`);
  if (d.range) lines.push(`range: "${d.range}"`);
  const comps = yamlList2(d.components);
  if (comps) lines.push(`components: ${comps}`);
  if (d.materials) lines.push(`materials: "${d.materials.replace(/"/g, '\\"')}"`);
  if (d.duration) lines.push(`duration: "${d.duration}"`);
  if (d.concentration != null) lines.push(`concentration: ${!!d.concentration}`);
  if (d.ritual != null) lines.push(`ritual: ${!!d.ritual}`);
  const classes = yamlList2(d.classes);
  if (classes) lines.push(`classes: ${classes}`);
  if (d.save_ability) lines.push(`save_ability: "${d.save_ability}"`);
  if (d.save_effect) lines.push(`save_effect: "${d.save_effect.replace(/"/g, '\\"')}"`);
  if (d.attack) lines.push(`attack: "${d.attack}"`);
  if (d.damage) lines.push(`damage: "${d.damage}"`);
  if (d.damage_type) lines.push(`damage_type: "${d.damage_type}"`);
  lines.push("---\n");
  lines.push(`# ${name}`);
  const levelStr = d.level == null ? "" : d.level === 0 ? "Cantrip" : `Level ${d.level}`;
  const parts = [levelStr, d.school].filter(Boolean);
  if (parts.length) lines.push(parts.join(" "));
  lines.push("");
  const stat = (label, val) => {
    if (val) lines.push(`- ${label}: ${val}`);
  };
  stat("Casting Time", d.casting_time);
  stat("Range", d.range);
  const compLine = (d.components || []).join(", ") + (d.materials ? ` (${d.materials})` : "");
  if (d.components && d.components.length) stat("Components", compLine);
  stat("Duration", d.duration);
  if (d.concentration) lines.push("- Concentration: yes");
  if (d.ritual) lines.push("- Ritual: yes");
  if (d.classes && d.classes.length) stat("Classes", (d.classes || []).join(", "));
  if (d.attack) stat("Attack", d.attack);
  if (d.save_ability) stat("Save", `${d.save_ability}${d.save_effect ? ` (${d.save_effect})` : ""}`);
  if (d.damage) stat("Damage", `${d.damage}${d.damage_type ? ` ${d.damage_type}` : ""}`);
  lines.push("");
  if (d.description) {
    lines.push(d.description.trim());
    lines.push("");
  }
  if (d.higher_levels) {
    lines.push("## At Higher Levels\n");
    lines.push(d.higher_levels.trim());
    lines.push("");
  }
  return lines.join("\n");
}
async function createSpellFile(app, d) {
  const folder = await ensureSpellDir(app);
  const baseName = sanitizeFileName2(d.name || "Spell");
  let fileName = `${baseName}.md`;
  let path = (0, import_obsidian14.normalizePath)(`${folder.path}/${fileName}`);
  let i = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    fileName = `${baseName} (${i}).md`;
    path = (0, import_obsidian14.normalizePath)(`${folder.path}/${fileName}`);
    i++;
  }
  const content = spellToMarkdown(d);
  const file = await app.vault.create(path, content);
  return file;
}

// src/apps/library/create/creature/modal.ts
var import_obsidian19 = require("obsidian");

// src/apps/library/create/creature/section-basics.ts
var import_obsidian15 = require("obsidian");

// src/apps/library/create/creature/presets.ts
var CREATURE_SIZES = [
  "Tiny",
  "Small",
  "Medium",
  "Large",
  "Huge",
  "Gargantuan"
];
var CREATURE_TYPES = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead"
];
var CREATURE_ALIGNMENT_LAW_CHAOS = [
  "Lawful",
  "Neutral",
  "Chaotic"
];
var CREATURE_ALIGNMENT_GOOD_EVIL = [
  "Good",
  "Neutral",
  "Evil"
];
var CREATURE_ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
var CREATURE_ABILITY_LABELS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
var CREATURE_ABILITIES = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" }
];
var CREATURE_SKILLS = [
  ["Athletics", "str"],
  ["Acrobatics", "dex"],
  ["Sleight of Hand", "dex"],
  ["Stealth", "dex"],
  ["Arcana", "int"],
  ["History", "int"],
  ["Investigation", "int"],
  ["Nature", "int"],
  ["Religion", "int"],
  ["Animal Handling", "wis"],
  ["Insight", "wis"],
  ["Medicine", "wis"],
  ["Perception", "wis"],
  ["Survival", "wis"],
  ["Deception", "cha"],
  ["Intimidation", "cha"],
  ["Performance", "cha"],
  ["Persuasion", "cha"]
];
var CREATURE_ENTRY_CATEGORIES = [
  ["trait", "Eigenschaft"],
  ["action", "Aktion"],
  ["bonus", "Bonusaktion"],
  ["reaction", "Reaktion"],
  ["legendary", "Legend\xE4re Aktion"]
];
var CREATURE_ABILITY_SELECTIONS = [
  "",
  "best_of_str_dex",
  ...CREATURE_ABILITY_KEYS
];
var CREATURE_SAVE_OPTIONS = [
  "",
  ...CREATURE_ABILITY_LABELS
];
var CREATURE_MOVEMENT_TYPES = [
  ["walk", "Gehen"],
  ["climb", "Klettern"],
  ["fly", "Fliegen"],
  ["swim", "Schwimmen"],
  ["burrow", "Graben"]
];
var CREATURE_DAMAGE_PRESETS = [
  "Acid",
  "Bludgeoning",
  "Bludgeoning (magisch)",
  "Bludgeoning (nichtmagisch)",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Piercing (magisch)",
  "Piercing (nichtmagisch)",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Slashing (magisch)",
  "Slashing (nichtmagisch)",
  "Thunder",
  "Alle au\xDFer Force",
  "Alle au\xDFer Psychic",
  "Nichtmagische Angriffe",
  "Magische Angriffe",
  "Nichtmagische Waffen",
  "Nichtmagische Angriffe (nicht versilbert)",
  "Nichtmagische Angriffe (nicht aus Adamantit)"
];
var CREATURE_CONDITION_PRESETS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious"
];
var CREATURE_SENSE_PRESETS = [
  "Blindsight",
  "Darkvision",
  "Tremorsense",
  "Truesight",
  "Passive Perception",
  "Telepathy"
];
var CREATURE_PASSIVE_PRESETS = [
  "Passive Perception",
  "Passive Insight",
  "Passive Investigation"
];
var CREATURE_LANGUAGE_PRESETS = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Aquan",
  "Auran",
  "Ignan",
  "Terran",
  "Sylvan",
  "Undercommon",
  "Druidic",
  "Thieves' Cant"
];

// src/apps/library/create/creature/section-basics.ts
function ensureSpeedList(data) {
  if (!Array.isArray(data.speedList)) data.speedList = [];
  return data.speedList;
}
function mountCreatureBasicsSection(parent, data) {
  const root = parent.createDiv({ cls: "sm-cc-basics" });
  const grid = root.createDiv({ cls: "sm-cc-basics__grid" });
  const registerGridItem = (setting, span = 1) => {
    setting.settingEl.classList.add("sm-cc-basics__grid-item");
    if (span === 2) setting.settingEl.classList.add("sm-cc-basics__grid-item--span-2");
    if (span === 3) setting.settingEl.classList.add("sm-cc-basics__grid-item--span-3");
    if (span === 4) setting.settingEl.classList.add("sm-cc-basics__grid-item--span-4");
  };
  const idSetting = new import_obsidian15.Setting(grid).setName("Name");
  registerGridItem(idSetting, 2);
  idSetting.addText((t) => {
    t.setPlaceholder("Aboleth").setValue(data.name || "").onChange((v) => data.name = v.trim());
    t.inputEl.classList.add("sm-cc-basics__text-input");
    t.inputEl.style.width = "100%";
  });
  const typeSetting = new import_obsidian15.Setting(grid).setName("Typ");
  registerGridItem(typeSetting, 2);
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.setValue(data.type ?? "");
    dd.onChange((v) => data.type = v);
    dd.selectEl.classList.add("sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
    } catch {
    }
  });
  const sizeSetting = new import_obsidian15.Setting(grid).setName("Gr\xF6\xDFe");
  registerGridItem(sizeSetting, 2);
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.setValue(data.size ?? "");
    dd.onChange((v) => data.size = v);
    dd.selectEl.classList.add("sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
    } catch {
    }
  });
  const alignSetting = new import_obsidian15.Setting(grid).setName("Gesinnung");
  registerGridItem(alignSetting, 2);
  alignSetting.settingEl.classList.add("sm-cc-basics__alignment");
  alignSetting.controlEl.classList.add("sm-cc-basics__alignment-controls");
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_LAW_CHAOS) dd.addOption(option, option);
    dd.setValue(data.alignmentLawChaos ?? "");
    dd.onChange((v) => data.alignmentLawChaos = v);
    dd.selectEl.classList.add("sm-cc-basics__alignment-select", "sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown\u2026");
    } catch {
    }
  });
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_GOOD_EVIL) dd.addOption(option, option);
    dd.setValue(data.alignmentGoodEvil ?? "");
    dd.onChange((v) => data.alignmentGoodEvil = v);
    dd.selectEl.classList.add("sm-cc-basics__alignment-select", "sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown\u2026");
    } catch {
    }
  });
  const speedSetting = new import_obsidian15.Setting(grid).setName("Bewegung");
  registerGridItem(speedSetting, 4);
  const speedControl = speedSetting.controlEl.createDiv({ cls: "sm-cc-move-ctl" });
  const addRow = speedControl.createDiv({ cls: "sm-cc-searchbar sm-cc-move-row" });
  const typeSelect = addRow.createEl("select", { cls: "sm-sd" });
  for (const [value, label] of CREATURE_MOVEMENT_TYPES) {
    const option = typeSelect.createEl("option", { text: label });
    option.value = value;
  }
  typeSelect.classList.add("sm-cc-basics__select");
  try {
    enhanceSelectToSearch(typeSelect, "Such-dropdown\u2026");
  } catch {
  }
  const hoverWrap = addRow.createDiv({ cls: "sm-cc-move-hover" });
  const hoverId = `sm-cc-hover-${Math.random().toString(36).slice(2)}`;
  const hoverCb = hoverWrap.createEl("input", {
    attr: { type: "checkbox", id: hoverId }
  });
  hoverWrap.createEl("label", { text: "Hover", attr: { for: hoverId } });
  const updateHover = () => {
    const cur = typeSelect.value;
    const isFly = cur === "fly";
    hoverWrap.style.display = isFly ? "" : "none";
    if (!isFly) hoverCb.checked = false;
  };
  updateHover();
  typeSelect.addEventListener("change", updateHover);
  const numWrap = addRow.createDiv({ cls: "sm-inline-number" });
  const valInput = numWrap.createEl("input", {
    attr: { type: "number", min: "0", step: "5", placeholder: "30" }
  });
  valInput.classList.add("sm-cc-basics__text-input");
  const decBtn = numWrap.createEl("button", { text: "\u2212", cls: "btn-compact" });
  const incBtn = numWrap.createEl("button", { text: "+", cls: "btn-compact" });
  const step = (dir) => {
    const cur = parseInt(valInput.value, 10) || 0;
    const next = Math.max(0, cur + 5 * dir);
    valInput.value = String(next);
  };
  decBtn.onclick = () => step(-1);
  incBtn.onclick = () => step(1);
  const addSpeedBtn = addRow.createEl("button", {
    text: "+",
    cls: "sm-cc-move-add",
    attr: { "aria-label": "Geschwindigkeitswert hinzuf\xFCgen" }
  });
  const speedChips = speedControl.createDiv({ cls: "sm-cc-chips" });
  const speeds = ensureSpeedList(data);
  const renderSpeeds = () => {
    speedChips.empty();
    speeds.forEach((txt, i) => {
      const chip = speedChips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", {
        text: "\xD7",
        cls: "sm-cc-chip__remove",
        attr: { "aria-label": `${txt} entfernen` }
      });
      removeBtn.onclick = () => {
        speeds.splice(i, 1);
        renderSpeeds();
      };
    });
  };
  renderSpeeds();
  addSpeedBtn.onclick = () => {
    const n = parseInt(valInput.value, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    const kind = typeSelect.value;
    const unit = "ft.";
    const label = kind === "walk" ? `${n} ${unit}` : kind === "fly" && hoverCb.checked ? `fly ${n} ${unit} (hover)` : `${kind} ${n} ${unit}`;
    speeds.push(label);
    valInput.value = "";
    hoverCb.checked = false;
    renderSpeeds();
  };
  const mkStatSetting = (label, placeholder, key, span = 1) => {
    const setting = new import_obsidian15.Setting(grid).setName(label);
    registerGridItem(setting, span);
    setting.addText((t) => {
      t.setPlaceholder(placeholder).setValue(data[key] ?? "").onChange((v) => data[key] = v.trim());
      t.inputEl.classList.add("sm-cc-basics__text-input");
      t.inputEl.style.width = "100%";
    });
  };
  mkStatSetting("HP", "150", "hp");
  mkStatSetting("AC", "17", "ac");
  mkStatSetting("Init", "+7", "initiative");
  mkStatSetting("PB", "+4", "pb");
  mkStatSetting("HD", "20d10 + 40", "hitDice", 2);
  mkStatSetting("CR", "10", "cr");
  mkStatSetting("XP", "5900", "xp");
}

// src/apps/library/create/creature/section-stats-and-skills.ts
var import_obsidian16 = require("obsidian");

// src/apps/library/create/shared/stat-utils.ts
function parseIntSafe(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : NaN;
  }
  const match = String(value ?? "").match(/-?\d+/);
  return match ? parseInt(match[0], 10) : NaN;
}
function abilityMod2(score) {
  const numeric = typeof score === "number" ? score : parseIntSafe(score);
  if (Number.isNaN(numeric)) return 0;
  return Math.floor((numeric - 10) / 2);
}
function formatSigned(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

// src/apps/library/create/creature/section-stats-and-skills.ts
function mountCreatureStatsAndSkillsSection(parent, data) {
  const root = parent.createDiv({ cls: "sm-cc-stats" });
  const abilityElems = /* @__PURE__ */ new Map();
  const ensureSets = () => {
    if (!data.saveProf) data.saveProf = {};
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
  };
  const statsSection = root.createDiv({ cls: "sm-cc-stats-section" });
  statsSection.createEl("h4", { cls: "sm-cc-stats-section__title", text: "Stats" });
  const statsGrid = statsSection.createDiv({ cls: "sm-cc-stats-grid" });
  const statsGridHeader = statsGrid.createDiv({
    cls: "sm-cc-stats-grid__header"
  });
  statsGridHeader.createSpan({
    cls: "sm-cc-stats-grid__header-cell sm-cc-stats-grid__header-cell--mod",
    text: "Mod"
  });
  const statsGridSaveHead = statsGridHeader.createDiv({
    cls: "sm-cc-stats-grid__header-cell sm-cc-stats-grid__header-cell--save"
  });
  statsGridSaveHead.createSpan({
    cls: "sm-cc-stats-grid__header-save-label",
    text: "Save"
  });
  statsGridSaveHead.createSpan({
    cls: "sm-cc-stats-grid__header-save-mod",
    text: "Mod"
  });
  const abilityByKey = new Map(
    CREATURE_ABILITIES.map((def) => [def.key, def])
  );
  const statColumns = [
    ["str", "dex", "con"],
    ["int", "wis", "cha"]
  ];
  for (const keys of statColumns) {
    const columnEl = statsGrid.createDiv({ cls: "sm-cc-stats-col" });
    for (const key of keys) {
      const ability = abilityByKey.get(key);
      if (!ability) continue;
      const row = columnEl.createDiv({ cls: "sm-cc-stat-row" });
      row.createSpan({ cls: "sm-cc-stat-row__label", text: ability.label });
      const scoreWrap = row.createDiv({ cls: "sm-inline-number sm-cc-stat-row__score" });
      const score = scoreWrap.createEl("input", {
        attr: { type: "number", placeholder: "10", min: "0", step: "1" }
      });
      score.addClass("sm-cc-stat-row__score-input");
      const dec = scoreWrap.createEl("button", { text: "\u2212", cls: "btn-compact" });
      const inc = scoreWrap.createEl("button", { text: "+", cls: "btn-compact" });
      score.value = data[ability.key] || "";
      const step = (d) => {
        const cur = parseInt(score.value, 10) || 0;
        const next = Math.max(0, cur + d);
        score.value = String(next);
        data[ability.key] = score.value.trim();
        updateMods();
      };
      dec.onclick = () => step(-1);
      inc.onclick = () => step(1);
      score.addEventListener("input", () => {
        data[ability.key] = score.value.trim();
        updateMods();
      });
      const modOut = row.createSpan({
        cls: "sm-cc-stat-row__mod-value",
        text: "+0"
      });
      const saveWrap = row.createDiv({ cls: "sm-cc-stat-row__save" });
      const saveLabel = saveWrap.createEl("label", { cls: "sm-cc-stat-row__save-prof" });
      const saveCb = saveLabel.createEl("input", {
        attr: { type: "checkbox", "aria-label": `${ability.label} Save Proficiency` }
      });
      const saveOut = saveWrap.createSpan({
        cls: "sm-cc-stat-row__save-mod",
        text: "+0"
      });
      ensureSets();
      saveCb.checked = !!data.saveProf[ability.key];
      saveCb.addEventListener("change", () => {
        data.saveProf[ability.key] = saveCb.checked;
        updateMods();
      });
      abilityElems.set(ability.key, { score, mod: modOut, save: saveCb, saveMod: saveOut });
    }
  }
  const skillAbilityMap = new Map(CREATURE_SKILLS);
  const skillsSetting = new import_obsidian16.Setting(root).setName("Fertigkeiten");
  skillsSetting.settingEl.addClass("sm-cc-skills");
  const skillsControl = skillsSetting.controlEl;
  skillsControl.addClass("sm-cc-skill-editor");
  const skillsRow = skillsControl.createDiv({ cls: "sm-cc-searchbar sm-cc-skill-search" });
  const skillsSelectId = "sm-cc-skill-select";
  const skillsSelect = skillsRow.createEl("select", {
    attr: { id: skillsSelectId, "aria-label": "Fertigkeit ausw\xE4hlen" }
  });
  const blankSkill = skillsSelect.createEl("option", {
    text: "Fertigkeit w\xE4hlen\u2026"
  });
  blankSkill.value = "";
  for (const [name] of CREATURE_SKILLS) {
    const opt = skillsSelect.createEl("option", { text: name });
    opt.value = name;
  }
  try {
    enhanceSelectToSearch(skillsSelect, "Fertigkeit suchen\u2026");
  } catch {
  }
  const skillsSearchInput = skillsSelect._smSearchInput;
  if (skillsSearchInput) {
    skillsSearchInput.placeholder = "Fertigkeit suchen\u2026";
    if (!skillsSearchInput.id) skillsSearchInput.id = `${skillsSelectId}-search`;
    skillsSearchInput.setAttribute("aria-label", "Fertigkeit suchen");
  }
  const addSkillBtn = skillsRow.createEl("button", {
    text: "+",
    attr: { type: "button", "aria-label": "Fertigkeit hinzuf\xFCgen" }
  });
  const skillChips = skillsControl.createDiv({ cls: "sm-cc-chips sm-cc-skill-chips" });
  const skillRefs = /* @__PURE__ */ new Map();
  const addSkillByName = (rawName) => {
    const name = rawName.trim();
    if (!name) return;
    if (!skillAbilityMap.has(name)) return;
    ensureSets();
    if (!data.skillsProf.includes(name)) data.skillsProf.push(name);
    renderSkillChips();
  };
  addSkillBtn.onclick = () => {
    const selected = skillsSelect.value.trim();
    const typed = skillsSearchInput?.value.trim() ?? "";
    let value = selected;
    if (!value && typed) {
      const match = Array.from(skillsSelect.options).find(
        (opt) => opt.text.trim().toLowerCase() === typed.toLowerCase()
      );
      if (match) value = match.value.trim();
    }
    if (skillsSearchInput) skillsSearchInput.value = "";
    skillsSelect.value = "";
    addSkillByName(value);
  };
  function renderSkillChips() {
    ensureSets();
    skillChips.empty();
    skillRefs.clear();
    const profs = data.skillsProf ?? [];
    for (const name of profs) {
      const chip = skillChips.createDiv({ cls: "sm-cc-chip sm-cc-skill-chip" });
      chip.createSpan({ cls: "sm-cc-skill-chip__name", text: name });
      const modOut = chip.createSpan({ cls: "sm-cc-skill-chip__mod", text: "+0" });
      const expertiseWrap = chip.createEl("label", { cls: "sm-cc-skill-chip__exp" });
      const expertiseCb = expertiseWrap.createEl("input", { attr: { type: "checkbox" } });
      expertiseWrap.createSpan({ text: "Expertise" });
      expertiseCb.checked = !!data.skillsExpertise?.includes(name);
      expertiseCb.addEventListener("change", () => {
        ensureSets();
        if (expertiseCb.checked) {
          if (!data.skillsExpertise.includes(name)) data.skillsExpertise.push(name);
        } else {
          data.skillsExpertise = data.skillsExpertise.filter((s) => s !== name);
        }
        updateMods();
      });
      const removeBtn = chip.createEl("button", {
        cls: "sm-cc-chip__remove",
        text: "\xD7",
        attr: { "aria-label": `${name} entfernen` }
      });
      removeBtn.onclick = () => {
        ensureSets();
        data.skillsProf = data.skillsProf.filter((s) => s !== name);
        data.skillsExpertise = data.skillsExpertise.filter((s) => s !== name);
        renderSkillChips();
      };
      skillRefs.set(name, { mod: modOut, expertise: expertiseCb });
    }
    updateMods();
  }
  const updateMods = () => {
    const pb = parseIntSafe(data.pb) || 0;
    for (const [key, refs] of abilityElems) {
      const mod = abilityMod2(data[key]);
      refs.mod.textContent = formatSigned(mod);
      const saveBonus = data.saveProf?.[key] ? pb : 0;
      refs.saveMod.textContent = formatSigned(mod + saveBonus);
    }
    ensureSets();
    const profs = new Set(data.skillsProf ?? []);
    data.skillsExpertise = (data.skillsExpertise ?? []).filter((name) => profs.has(name));
    for (const [name, refs] of skillRefs) {
      const ability = skillAbilityMap.get(name);
      const mod = ability ? abilityMod2(data[ability]) : 0;
      const hasExpertise = data.skillsExpertise?.includes(name) ?? false;
      const bonus = hasExpertise ? pb * 2 : pb;
      refs.mod.textContent = formatSigned(mod + bonus);
      if (refs.expertise.checked !== hasExpertise) refs.expertise.checked = hasExpertise;
    }
  };
  renderSkillChips();
}

// src/apps/library/create/shared/token-editor.ts
var import_obsidian17 = require("obsidian");
function mountTokenEditor(parent, title, model, options = {}) {
  const placeholder = options.placeholder ?? "Begriff eingeben\u2026";
  const addLabel = options.addButtonLabel ?? "+";
  const setting = new import_obsidian17.Setting(parent).setName(title);
  let inputEl;
  let renderChips = () => {
  };
  const commitValue = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    model.add(trimmed);
    options.onAdd?.(trimmed);
    renderChips();
  };
  setting.addText((t) => {
    t.setPlaceholder(placeholder);
    inputEl = t.inputEl;
    t.inputEl.style.minWidth = "260px";
    t.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        commitValue((inputEl?.value ?? "").trim());
        if (inputEl) inputEl.value = "";
      }
    });
  });
  setting.addButton(
    (b) => b.setButtonText(addLabel).onClick(() => {
      commitValue((inputEl?.value ?? "").trim());
      if (inputEl) inputEl.value = "";
    })
  );
  const chips = parent.createDiv({ cls: "sm-cc-chips" });
  renderChips = () => {
    chips.empty();
    const items = model.getItems();
    items.forEach((txt, index) => {
      const chip = chips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", { text: "\xD7" });
      removeBtn.onclick = () => {
        model.remove(index);
        options.onRemove?.(txt, index);
        renderChips();
      };
    });
  };
  renderChips();
  return { setting, chipsEl: chips, refresh: renderChips };
}

// src/apps/library/create/creature/section-utils.ts
var import_obsidian18 = require("obsidian");
function mountPresetSelectEditor(parent, title, options, model, config) {
  const resolved = typeof config === "string" ? { placeholder: config } : config ?? {};
  const {
    placeholder,
    inlineLabel,
    rowClass,
    defaultAddButtonLabel,
    addButtonLabel,
    settingClass
  } = resolved;
  const setting = new import_obsidian18.Setting(parent).setName(title);
  if (settingClass) {
    const classes = Array.isArray(settingClass) ? settingClass : [settingClass];
    setting.settingEl.classList.add(...classes);
  }
  const rowClasses = ["sm-cc-searchbar"];
  if (rowClass) rowClasses.push(rowClass);
  const row = setting.controlEl.createDiv({ cls: rowClasses.join(" ") });
  let labelEl;
  let controlId;
  if (inlineLabel) {
    controlId = `sm-cc-select-${Math.random().toString(36).slice(2)}`;
    labelEl = row.createEl("label", { text: inlineLabel, attr: { for: controlId } });
  }
  const selectAttrs = {};
  if (controlId) selectAttrs.id = controlId;
  else selectAttrs["aria-label"] = `${title} ausw\xE4hlen`;
  const select = row.createEl(
    "select",
    Object.keys(selectAttrs).length ? { attr: selectAttrs } : void 0
  );
  const blank = select.createEl("option", { text: "Auswahl\u2026" });
  blank.value = "";
  for (const option of options) {
    const opt = select.createEl("option", { text: option });
    opt.value = option;
  }
  try {
    enhanceSelectToSearch(select, placeholder ?? "Such-dropdown\u2026");
  } catch {
  }
  const searchInput = select._smSearchInput;
  if (searchInput) {
    if (placeholder) searchInput.placeholder = placeholder;
    if (!searchInput.id) {
      searchInput.id = controlId ?? `sm-cc-input-${Math.random().toString(36).slice(2)}`;
    }
    if (labelEl) labelEl.htmlFor = searchInput.id;
    else searchInput.setAttribute("aria-label", placeholder ?? title);
  }
  const fallbackAddLabel = defaultAddButtonLabel ?? "+";
  const effectiveAddLabel = addButtonLabel ?? fallbackAddLabel;
  const addBtn = row.createEl("button", {
    text: effectiveAddLabel,
    attr: { type: "button", "aria-label": `${title} hinzuf\xFCgen` }
  });
  const chips = setting.controlEl.createDiv({ cls: "sm-cc-chips" });
  const renderChips = () => {
    chips.empty();
    model.get().forEach((txt, index) => {
      const chip = chips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", {
        cls: "sm-cc-chip__remove",
        text: "\xD7",
        attr: { type: "button", "aria-label": `${txt} entfernen` }
      });
      removeBtn.onclick = () => {
        model.remove(index);
        renderChips();
      };
    });
  };
  const addEntry = () => {
    const selectedValue = select.value.trim();
    const typedValue = searchInput?.value.trim() ?? "";
    let value = selectedValue;
    if (!value && typedValue) {
      const match = Array.from(select.options).find(
        (opt) => opt.text.trim().toLowerCase() === typedValue.toLowerCase()
      );
      value = match ? match.value.trim() : typedValue;
    }
    if (!value) {
      select.value = "";
      if (searchInput) searchInput.value = "";
      return;
    }
    model.add(value);
    select.value = "";
    if (searchInput) searchInput.value = "";
    renderChips();
  };
  addBtn.onclick = addEntry;
  if (searchInput) {
    searchInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        addEntry();
      }
    });
  }
  renderChips();
}
function mountDamageResponseEditor(parent, damageLists) {
  const configs = [
    {
      kind: "res",
      label: "Resistenz",
      list: damageLists.resistances,
      chipClass: "sm-cc-damage-chip--res"
    },
    {
      kind: "imm",
      label: "Immunit\xE4t",
      list: damageLists.immunities,
      chipClass: "sm-cc-damage-chip--imm"
    },
    {
      kind: "vuln",
      label: "Verwundbarkeit",
      list: damageLists.vulnerabilities,
      chipClass: "sm-cc-damage-chip--vuln"
    }
  ];
  const setting = new import_obsidian18.Setting(parent).setName("Schadenstyp-Reaktionen");
  const row = setting.controlEl.createDiv({ cls: "sm-cc-searchbar sm-cc-damage-row" });
  row.createEl("label", { cls: "sm-cc-damage-label", text: "Schadenstyp" });
  const select = row.createEl("select", { cls: "sm-cc-damage-select" });
  const blank = select.createEl("option", { text: "Auswahl\u2026" });
  blank.value = "";
  for (const option of CREATURE_DAMAGE_PRESETS) {
    const opt = select.createEl("option", { text: option });
    opt.value = option;
  }
  try {
    enhanceSelectToSearch(select, "Schadenstyp suchen\u2026");
  } catch {
  }
  const searchInput = select._smSearchInput;
  const typeWrap = row.createDiv({ cls: "sm-cc-damage-type" });
  typeWrap.createSpan({ cls: "sm-cc-damage-type__label", text: "Status" });
  const btnWrap = typeWrap.createDiv({ cls: "sm-cc-damage-type__buttons" });
  let activeConfig = configs[0];
  const buttons = /* @__PURE__ */ new Map();
  for (const config of configs) {
    const btn = btnWrap.createEl("button", {
      cls: "sm-cc-damage-type__btn",
      text: config.label,
      attr: { type: "button" }
    });
    buttons.set(config.kind, btn);
    btn.onclick = () => {
      activeConfig = config;
      for (const [kind, button] of buttons) {
        if (kind === config.kind) button.addClass("is-active");
        else button.removeClass("is-active");
      }
    };
  }
  buttons.get(activeConfig.kind)?.addClass("is-active");
  const addBtn = row.createEl("button", {
    cls: "sm-cc-damage-add",
    text: "+ Hinzuf\xFCgen",
    attr: { type: "button" }
  });
  const chips = setting.controlEl.createDiv({ cls: "sm-cc-chips sm-cc-damage-chips" });
  const normalize = (value) => value.trim().toLowerCase();
  const renderChips = () => {
    chips.empty();
    for (const config of configs) {
      config.list.forEach((entry, index) => {
        const chip = chips.createDiv({ cls: `sm-cc-chip sm-cc-damage-chip ${config.chipClass}` });
        chip.createSpan({ cls: "sm-cc-damage-chip__name", text: entry });
        chip.createSpan({ cls: "sm-cc-damage-chip__badge", text: config.label });
        const removeBtn = chip.createEl("button", {
          cls: "sm-cc-chip__remove",
          text: "\xD7",
          attr: { type: "button", "aria-label": `${config.label} entfernen` }
        });
        removeBtn.onclick = () => {
          config.list.splice(index, 1);
          renderChips();
        };
      });
    }
  };
  const addEntry = () => {
    const selectedValue = select.value.trim();
    const typedValue = searchInput?.value.trim() ?? "";
    let value = selectedValue;
    if (!value && typedValue) {
      const match = Array.from(select.options).find(
        (opt) => opt.text.trim().toLowerCase() === typedValue.toLowerCase()
      );
      value = match ? match.value.trim() : typedValue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      select.value = "";
      if (searchInput) searchInput.value = "";
      return;
    }
    const list = activeConfig.list;
    if (list.some((entry) => normalize(entry) === normalize(trimmed))) {
      return;
    }
    list.push(trimmed);
    select.value = "";
    if (searchInput) searchInput.value = "";
    renderChips();
  };
  addBtn.addEventListener("click", addEntry);
  if (searchInput) {
    searchInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        addEntry();
      }
    });
  }
  renderChips();
}

// src/apps/library/create/creature/section-senses-and-defenses.ts
function ensureStringList(data, key) {
  const current = data[key];
  if (Array.isArray(current)) return current;
  const arr = [];
  data[key] = arr;
  return arr;
}
var makeModel = (list) => ({
  get: () => list,
  add: (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!list.includes(trimmed)) list.push(trimmed);
  },
  remove: (index) => {
    list.splice(index, 1);
  }
});
function mountCreatureSensesAndDefensesSection(parent, data) {
  const root = parent.createDiv({ cls: "sm-cc-defenses" });
  const sensesLanguages = root.createDiv({ cls: "sm-cc-senses-block" });
  const senses = ensureStringList(data, "sensesList");
  mountPresetSelectEditor(
    sensesLanguages,
    "Sinne",
    CREATURE_SENSE_PRESETS,
    makeModel(senses),
    {
      placeholder: "Sinn suchen oder eingeben\u2026",
      rowClass: "sm-cc-senses-search",
      defaultAddButtonLabel: "+",
      settingClass: "sm-cc-senses-setting"
    }
  );
  const languages = ensureStringList(data, "languagesList");
  mountPresetSelectEditor(
    sensesLanguages,
    "Sprachen",
    CREATURE_LANGUAGE_PRESETS,
    makeModel(languages),
    {
      placeholder: "Sprache suchen oder eingeben\u2026",
      rowClass: "sm-cc-senses-search",
      defaultAddButtonLabel: "+",
      settingClass: "sm-cc-senses-setting"
    }
  );
  const passives = ensureStringList(data, "passivesList");
  mountPresetSelectEditor(
    root,
    "Passive Werte",
    CREATURE_PASSIVE_PRESETS,
    makeModel(passives),
    "Passiven Wert suchen oder eingeben\u2026"
  );
  const vulnerabilities = ensureStringList(data, "damageVulnerabilitiesList");
  const resistances = ensureStringList(data, "damageResistancesList");
  const immunities = ensureStringList(data, "damageImmunitiesList");
  mountDamageResponseEditor(root, {
    vulnerabilities,
    resistances,
    immunities
  });
  const conditionImmunities = ensureStringList(data, "conditionImmunitiesList");
  mountPresetSelectEditor(
    root,
    "Zustandsimmunit\xE4ten",
    CREATURE_CONDITION_PRESETS,
    makeModel(conditionImmunities),
    "Zustandsimmunit\xE4t suchen oder eingeben\u2026"
  );
  const gear = ensureStringList(data, "gearList");
  mountTokenEditor(
    root,
    "Ausr\xFCstung/Gear",
    {
      getItems: () => gear,
      add: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (!gear.includes(trimmed)) gear.push(trimmed);
      },
      remove: (index) => gear.splice(index, 1)
    },
    { placeholder: "Gegenstand oder Hinweis\u2026", addButtonLabel: "+ Hinzuf\xFCgen" }
  );
}

// src/apps/library/create/creature/section-entries.ts
function mountEntriesSection(parent, data) {
  if (!data.entries) data.entries = [];
  const wrap = parent.createDiv({ cls: "setting-item sm-cc-entries" });
  wrap.createDiv({ cls: "setting-item-info", text: "Eintr\xE4ge (Traits, Aktionen, \u2026)" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });
  const addBar = ctl.createDiv({ cls: "sm-cc-searchbar" });
  const catSel = addBar.createEl("select");
  for (const [value, label] of CREATURE_ENTRY_CATEGORIES) {
    const option = catSel.createEl("option", { text: label });
    option.value = value;
  }
  try {
    enhanceSelectToSearch(catSel, "Such-dropdown\u2026");
  } catch {
  }
  const addEntryBtn = addBar.createEl("button", { text: "+ Eintrag" });
  const host = ctl.createDiv();
  let focusIdx = null;
  const render = () => {
    host.empty();
    data.entries.forEach((e, i) => {
      const box = host.createDiv({ cls: "sm-cc-skill-group" });
      const head = box.createDiv({ cls: "sm-cc-skill sm-cc-entry-head" });
      const c = head.createEl("select");
      for (const [value, label] of CREATURE_ENTRY_CATEGORIES) {
        const option = c.createEl("option", { text: label });
        option.value = value;
        if (value === e.category) option.selected = true;
      }
      c.onchange = () => e.category = c.value;
      try {
        enhanceSelectToSearch(c, "Such-dropdown\u2026");
      } catch {
      }
      head.createEl("label", { text: "Name" });
      const name = head.createEl("input", { cls: "sm-cc-entry-name", attr: { type: "text", placeholder: "Name (z. B. Multiattack)", "aria-label": "Name" } });
      name.value = e.name || "";
      name.oninput = () => e.name = name.value.trim();
      name.style.width = "26ch";
      if (focusIdx === i) {
        setTimeout(() => name.focus(), 0);
        focusIdx = null;
      }
      const del = head.createEl("button", { text: "\u{1F5D1}" });
      del.onclick = () => {
        data.entries.splice(i, 1);
        render();
      };
      const grid = box.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
      grid.createEl("label", { text: "Art" });
      const kind = grid.createEl("input", { attr: { type: "text", placeholder: "Melee/Ranged \u2026", "aria-label": "Art" } });
      kind.value = e.kind || "";
      kind.oninput = () => e.kind = kind.value.trim() || void 0;
      kind.style.width = "24ch";
      grid.createEl("label", { text: "Reichweite" });
      const rng = grid.createEl("input", { attr: { type: "text", placeholder: "reach 5 ft. / range 30 ft.", "aria-label": "Reichweite" } });
      rng.value = e.range || "";
      rng.oninput = () => e.range = rng.value.trim() || void 0;
      rng.style.width = "30ch";
      grid.createEl("label", { text: "Ziel" });
      const tgt = grid.createEl("input", { attr: { type: "text", placeholder: "one target", "aria-label": "Ziel" } });
      tgt.value = e.target || "";
      tgt.oninput = () => e.target = tgt.value.trim() || void 0;
      tgt.style.width = "16ch";
      const autoRow = box.createDiv({ cls: "sm-cc-auto" });
      const hitGroup = autoRow.createDiv({ cls: "sm-auto-group" });
      hitGroup.createSpan({ text: "To hit:" });
      const toHitAbil = hitGroup.createEl("select");
      for (const value of CREATURE_ABILITY_SELECTIONS) {
        const option = toHitAbil.createEl("option", { text: value || "(von)" });
        option.value = value;
      }
      try {
        enhanceSelectToSearch(toHitAbil, "Such-dropdown\u2026");
      } catch {
      }
      const toHitProf = hitGroup.createEl("input", { attr: { type: "checkbox", id: `hit-prof-${i}` } });
      hitGroup.createEl("label", { text: "Prof", attr: { for: `hit-prof-${i}` } });
      const hit = hitGroup.createEl("input", { cls: "sm-auto-tohit", attr: { type: "text", placeholder: "+7", "aria-label": "To hit" } });
      hit.style.width = "6ch";
      hit.value = e.to_hit || "";
      hit.addEventListener("input", () => e.to_hit = hit.value.trim() || void 0);
      const dmgGroup = autoRow.createDiv({ cls: "sm-auto-group" });
      dmgGroup.createSpan({ text: "Damage:" });
      const dmgDice = dmgGroup.createEl("input", { attr: { type: "text", placeholder: "1d8", "aria-label": "W\xFCrfel" } });
      dmgDice.style.width = "10ch";
      const dmgAbil = dmgGroup.createEl("select");
      for (const value of CREATURE_ABILITY_SELECTIONS) {
        const option = dmgAbil.createEl("option", { text: value || "(von)" });
        option.value = value;
      }
      try {
        enhanceSelectToSearch(dmgAbil, "Such-dropdown\u2026");
      } catch {
      }
      const dmgBonus = dmgGroup.createEl("input", { attr: { type: "text", placeholder: "piercing / slashing \u2026", "aria-label": "Art" } });
      dmgBonus.style.width = "12ch";
      const dmg = dmgGroup.createEl("input", { cls: "sm-auto-dmg", attr: { type: "text", placeholder: "1d8 +3 piercing", "aria-label": "Schaden" } });
      dmg.style.width = "20ch";
      dmg.value = e.damage || "";
      dmg.addEventListener("input", () => e.damage = dmg.value.trim() || void 0);
      const applyAuto = () => {
        const pb = parseIntSafe(data.pb) || 0;
        if (e.to_hit_from) {
          const abil = e.to_hit_from.ability;
          const abilMod = abil === "best_of_str_dex" ? Math.max(abilityMod2(data.str), abilityMod2(data.dex)) : abilityMod2(data[abil]);
          const total = abilMod + (e.to_hit_from.proficient ? pb : 0);
          e.to_hit = formatSigned(total);
          hit.value = e.to_hit;
        }
        if (e.damage_from) {
          const abil = e.damage_from.ability;
          const abilMod = abil ? abil === "best_of_str_dex" ? Math.max(abilityMod2(data.str), abilityMod2(data.dex)) : abilityMod2(data[abil]) : 0;
          const base = e.damage_from.dice;
          const tail = (abilMod ? ` ${formatSigned(abilMod)}` : "") + (e.damage_from.bonus ? ` ${e.damage_from.bonus}` : "");
          e.damage = `${base}${tail}`.trim();
          dmg.value = e.damage;
        }
      };
      if (e.to_hit_from) {
        toHitAbil.value = e.to_hit_from.ability;
        toHitProf.checked = !!e.to_hit_from.proficient;
      }
      if (e.damage_from) {
        dmgDice.value = e.damage_from.dice;
        dmgAbil.value = e.damage_from.ability || "";
        dmgBonus.value = e.damage_from.bonus || "";
      }
      toHitAbil.onchange = () => {
        e.to_hit_from = { ability: toHitAbil.value, proficient: toHitProf.checked };
        applyAuto();
      };
      toHitProf.onchange = () => {
        e.to_hit_from = { ability: toHitAbil.value, proficient: toHitProf.checked };
        applyAuto();
      };
      dmgDice.oninput = () => {
        e.damage_from = { dice: dmgDice.value.trim(), ability: dmgAbil.value || void 0, bonus: dmgBonus.value.trim() || void 0 };
        applyAuto();
      };
      dmgAbil.onchange = () => {
        e.damage_from = { dice: dmgDice.value.trim(), ability: dmgAbil.value || void 0, bonus: dmgBonus.value.trim() || void 0 };
        applyAuto();
      };
      dmgBonus.oninput = () => {
        e.damage_from = { dice: dmgDice.value.trim(), ability: dmgAbil.value || void 0, bonus: dmgBonus.value.trim() || void 0 };
        applyAuto();
      };
      const misc = box.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
      misc.createEl("label", { text: "Save" });
      const saveAb = misc.createEl("select");
      for (const value of CREATURE_SAVE_OPTIONS) {
        const option = saveAb.createEl("option", { text: value || "(kein)" });
        option.value = value;
        if (value === (e.save_ability || "")) option.selected = true;
      }
      saveAb.onchange = () => e.save_ability = saveAb.value || void 0;
      misc.createEl("label", { text: "DC" });
      const saveDc = misc.createEl("input", { attr: { type: "number", placeholder: "DC", "aria-label": "DC" } });
      saveDc.value = e.save_dc ? String(e.save_dc) : "";
      saveDc.oninput = () => e.save_dc = saveDc.value ? parseInt(saveDc.value, 10) : void 0;
      saveDc.style.width = "4ch";
      misc.createEl("label", { text: "Save-Effekt" });
      const saveFx = misc.createEl("input", { attr: { type: "text", placeholder: "half on save \u2026", "aria-label": "Save-Effekt" } });
      saveFx.value = e.save_effect || "";
      saveFx.oninput = () => e.save_effect = saveFx.value.trim() || void 0;
      saveFx.style.width = "18ch";
      misc.createEl("label", { text: "Recharge" });
      const rech = misc.createEl("input", { attr: { type: "text", placeholder: "Recharge 5\u20136 / 1/day" } });
      rech.value = e.recharge || "";
      rech.oninput = () => e.recharge = rech.value.trim() || void 0;
      box.createEl("label", { text: "Details" });
      const ta = box.createEl("textarea", { cls: "sm-cc-entry-text", attr: { placeholder: "Details (Markdown)" } });
      ta.value = e.text || "";
      ta.addEventListener("input", () => e.text = ta.value);
    });
  };
  addEntryBtn.onclick = () => {
    data.entries.unshift({ category: catSel.value, name: "" });
    focusIdx = 0;
    render();
  };
  render();
}

// src/apps/library/create/creature/section-spells-known.ts
function mountSpellsKnownSection(parent, data, getAvailableSpells) {
  if (!data.spellsKnown) data.spellsKnown = [];
  const wrap = parent.createDiv({ cls: "setting-item sm-cc-spells" });
  wrap.createDiv({ cls: "setting-item-info", text: "Bekannte Zauber" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });
  const row1 = ctl.createDiv({ cls: "sm-cc-searchbar" });
  row1.createEl("label", { text: "Zauber" });
  const spellBox = row1.createDiv({ cls: "sm-preset-box", attr: { style: "flex:1 1 auto; min-width: 180px;" } });
  const spellInput = spellBox.createEl("input", { cls: "sm-preset-input", attr: { type: "text", placeholder: "Zauber suchen\u2026" } });
  const spellMenu = spellBox.createDiv({ cls: "sm-preset-menu" });
  let chosenSpell = "";
  const renderSpellMenu = () => {
    const q = (spellInput.value || "").toLowerCase();
    spellMenu.empty();
    const matches = (getAvailableSpells()?.slice() || []).filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 24);
    if (matches.length === 0) {
      spellBox.removeClass("is-open");
      return;
    }
    for (const name of matches) {
      const it = spellMenu.createDiv({ cls: "sm-preset-item", text: name });
      it.onclick = () => {
        chosenSpell = name;
        spellInput.value = name;
        spellBox.removeClass("is-open");
      };
    }
    spellBox.addClass("is-open");
  };
  spellInput.addEventListener("focus", renderSpellMenu);
  spellInput.addEventListener("input", renderSpellMenu);
  spellInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      spellInput.value = "";
      chosenSpell = "";
      spellBox.removeClass("is-open");
    }
  });
  spellInput.addEventListener("blur", () => {
    setTimeout(() => spellBox.removeClass("is-open"), 120);
  });
  row1.createEl("label", { text: "Grad" });
  const lvl = row1.createEl("input", { attr: { type: "number", min: "0", max: "9", placeholder: "Grad", "aria-label": "Grad" } });
  lvl.style.width = "4ch";
  const row2 = ctl.createDiv({ cls: "sm-cc-searchbar" });
  row2.createEl("label", { text: "Nutzung" });
  const uses = row2.createEl("input", { attr: { type: "text", placeholder: "at will / 3/day / slots", "aria-label": "Nutzung" } });
  uses.style.width = "14ch";
  row2.createEl("label", { text: "Notizen" });
  const notes = row2.createEl("input", { attr: { type: "text", placeholder: "Notizen", "aria-label": "Notizen" } });
  notes.style.width = "16ch";
  const addSpell = row2.createEl("button", { text: "+ Hinzuf\xFCgen" });
  addSpell.onclick = () => {
    let name = chosenSpell?.trim();
    if (!name) name = (spellInput.value || "").trim();
    if (!name) return;
    data.spellsKnown.push({ name, level: lvl.value ? parseInt(lvl.value, 10) : void 0, uses: uses.value.trim() || void 0, notes: notes.value.trim() || void 0 });
    spellInput.value = "";
    chosenSpell = "";
    lvl.value = uses.value = notes.value = "";
    renderList();
  };
  const list = ctl.createDiv({ cls: "sm-cc-list" });
  const renderList = () => {
    list.empty();
    data.spellsKnown.forEach((s, i) => {
      const item = list.createDiv({ cls: "sm-cc-item" });
      item.createDiv({ cls: "sm-cc-item__name", text: `${s.name}${s.level != null ? ` (Lvl ${s.level})` : ""}${s.uses ? ` \u2013 ${s.uses}` : ""}` });
      const rm = item.createEl("button", { text: "\xD7" });
      rm.onclick = () => {
        data.spellsKnown.splice(i, 1);
        renderList();
      };
    });
  };
  renderList();
  const refreshSpellMatches = () => {
    if (document.activeElement === spellInput || spellBox.hasClass("is-open")) {
      renderSpellMenu();
    }
  };
  return { refreshSpellMatches };
}

// src/apps/library/create/creature/modal.ts
var CreateCreatureModal = class extends import_obsidian19.Modal {
  constructor(app, presetName, onSubmit) {
    super(app);
    this.availableSpells = [];
    this.onSubmit = onSubmit;
    this.data = { name: presetName?.trim() || "Neue Kreatur" };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-cc-create-modal");
    const bg = document.querySelector(".modal-bg");
    if (bg) {
      this._bgEl = bg;
      this._bgPrevPointer = bg.style.pointerEvents;
      bg.style.pointerEvents = "none";
    }
    contentEl.createEl("h3", { text: "Neuen Statblock erstellen" });
    let spellsSectionControls = null;
    void (async () => {
      try {
        const spells = (await listSpellFiles(this.app)).map((f) => f.basename).sort((a, b) => a.localeCompare(b));
        this.availableSpells.splice(0, this.availableSpells.length, ...spells);
        spellsSectionControls?.refreshSpellMatches();
      } catch {
      }
    })();
    mountCreatureBasicsSection(contentEl, this.data);
    mountCreatureStatsAndSkillsSection(contentEl, this.data);
    mountCreatureSensesAndDefensesSection(contentEl, this.data);
    mountEntriesSection(contentEl, this.data);
    spellsSectionControls = mountSpellsKnownSection(contentEl, this.data, () => this.availableSpells);
    new import_obsidian19.Setting(contentEl).addButton((b) => b.setButtonText("Abbrechen").onClick(() => this.close())).addButton((b) => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));
  }
  onClose() {
    this.contentEl.empty();
    if (this._bgEl) {
      this._bgEl.style.pointerEvents = this._bgPrevPointer ?? "";
      this._bgEl = void 0;
    }
  }
  onunload() {
    if (this._bgEl) {
      this._bgEl.style.pointerEvents = this._bgPrevPointer ?? "";
      this._bgEl = void 0;
    }
  }
  submit() {
    if (!this.data.name || !this.data.name.trim()) return;
    this.close();
    this.onSubmit(this.data);
  }
};

// src/apps/library/create/spell/modal.ts
var import_obsidian20 = require("obsidian");
var CreateSpellModal = class extends import_obsidian20.Modal {
  constructor(app, presetName, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.data = { name: presetName?.trim() || "Neuer Zauber" };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-cc-create-modal");
    contentEl.createEl("h3", { text: "Neuen Zauber erstellen" });
    new import_obsidian20.Setting(contentEl).setName("Name").addText((t) => {
      t.setPlaceholder("Fireball").setValue(this.data.name).onChange((v) => this.data.name = v.trim());
      t.inputEl.style.width = "28ch";
    });
    new import_obsidian20.Setting(contentEl).setName("Grad").setDesc("0 = Zaubertrick").addDropdown((dd) => {
      for (let i = 0; i <= 9; i++) dd.addOption(String(i), String(i));
      dd.onChange((v) => this.data.level = parseInt(v, 10));
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    new import_obsidian20.Setting(contentEl).setName("Schule").addDropdown((dd) => {
      const schools = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
      for (const s of schools) dd.addOption(s, s);
      dd.onChange((v) => this.data.school = v);
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    new import_obsidian20.Setting(contentEl).setName("Wirkzeit").addText((t) => {
      t.setPlaceholder("1 Aktion").onChange((v) => this.data.casting_time = v.trim());
      t.inputEl.style.width = "12ch";
    });
    new import_obsidian20.Setting(contentEl).setName("Reichweite").addText((t) => {
      t.setPlaceholder("60 Fu\xDF").onChange((v) => this.data.range = v.trim());
      t.inputEl.style.width = "12ch";
    });
    const comps = new import_obsidian20.Setting(contentEl).setName("Komponenten");
    let cV = false, cS = false, cM = false;
    const updateComps = () => {
      const arr = [];
      if (cV) arr.push("V");
      if (cS) arr.push("S");
      if (cM) arr.push("M");
      this.data.components = arr;
    };
    comps.controlEl.style.display = "grid";
    comps.controlEl.style.gridTemplateColumns = "repeat(6, max-content)";
    const mkCb = (label, on) => {
      const wrap = comps.controlEl.createDiv({ cls: "sm-cc-grid__save" });
      const cb = wrap.createEl("input", { attr: { type: "checkbox" } });
      wrap.createEl("label", { text: label });
      cb.addEventListener("change", () => {
        on(cb.checked);
        updateComps();
      });
    };
    mkCb("V", (v) => cV = v);
    mkCb("S", (v) => cS = v);
    mkCb("M", (v) => {
      cM = v;
      updateComps();
    });
    new import_obsidian20.Setting(contentEl).setName("Materialien").addText((t) => {
      t.setPlaceholder("winzige Kugel aus Guano und Schwefel").onChange((v) => this.data.materials = v.trim());
      t.inputEl.style.width = "34ch";
    });
    new import_obsidian20.Setting(contentEl).setName("Dauer").addText((t) => {
      t.setPlaceholder("Augenblicklich / Konzentration, bis zu 1 Minute").onChange((v) => this.data.duration = v.trim());
      t.inputEl.style.width = "34ch";
    });
    const flags = new import_obsidian20.Setting(contentEl).setName("Flags");
    const cbConc = flags.controlEl.createEl("input", { attr: { type: "checkbox" } });
    flags.controlEl.createEl("label", { text: "Konzentration" });
    const cbRit = flags.controlEl.createEl("input", { attr: { type: "checkbox" } });
    flags.controlEl.createEl("label", { text: "Ritual" });
    cbConc.addEventListener("change", () => this.data.concentration = cbConc.checked);
    cbRit.addEventListener("change", () => this.data.ritual = cbRit.checked);
    new import_obsidian20.Setting(contentEl).setName("Angriff").addDropdown((dd) => {
      const opts = ["", "Melee Spell Attack", "Ranged Spell Attack", "Melee Weapon Attack", "Ranged Weapon Attack"];
      for (const s of opts) dd.addOption(s, s || "(kein)");
      dd.onChange((v) => this.data.attack = v || void 0);
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    const save = new import_obsidian20.Setting(contentEl).setName("Rettungswurf");
    save.addDropdown((dd) => {
      const abil = ["", "STR", "DEX", "CON", "INT", "WIS", "CHA"];
      for (const a of abil) dd.addOption(a, a || "(kein)");
      dd.onChange((v) => this.data.save_ability = v || void 0);
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    save.controlEl.createEl("label", { text: "Effekt" });
    save.addText((t) => {
      t.setPlaceholder("Half on save / Negates \u2026").onChange((v) => this.data.save_effect = v.trim() || void 0);
      t.inputEl.style.width = "18ch";
    });
    const dmg = new import_obsidian20.Setting(contentEl).setName("Schaden");
    dmg.controlEl.createEl("label", { text: "W\xFCrfel" });
    dmg.addText((t) => {
      t.setPlaceholder("8d6").onChange((v) => this.data.damage = v.trim() || void 0);
      t.inputEl.style.width = "10ch";
    });
    dmg.controlEl.createEl("label", { text: "Typ" });
    dmg.addText((t) => {
      t.setPlaceholder("fire / radiant \u2026").onChange((v) => this.data.damage_type = v.trim() || void 0);
      t.inputEl.style.width = "12ch";
    });
    if (!this.data.classes) this.data.classes = [];
    mountTokenEditor(contentEl, "Klassen", {
      getItems: () => this.data.classes,
      add: (value) => this.data.classes.push(value),
      remove: (index) => this.data.classes.splice(index, 1)
    });
    this.addTextArea(contentEl, "Beschreibung", "Beschreibung (Markdown)", (v) => this.data.description = v);
    this.addTextArea(contentEl, "H\xF6here Grade", "Bei h\xF6heren Graden (Markdown)", (v) => this.data.higher_levels = v);
    new import_obsidian20.Setting(contentEl).addButton((b) => b.setButtonText("Abbrechen").onClick(() => this.close())).addButton((b) => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));
    this.scope.register([], "Enter", () => this.submit());
  }
  onClose() {
    this.contentEl.empty();
  }
  addTextArea(parent, label, placeholder, onChange) {
    const wrap = parent.createDiv({ cls: "setting-item" });
    wrap.createDiv({ cls: "setting-item-info", text: label });
    const ctl = wrap.createDiv({ cls: "setting-item-control" });
    const ta = ctl.createEl("textarea", { attr: { placeholder } });
    ta.addEventListener("input", () => onChange(ta.value));
  }
  submit() {
    if (!this.data.name || !this.data.name.trim()) return;
    this.close();
    this.onSubmit(this.data);
  }
};

// src/apps/library/view.ts
var VIEW_LIBRARY = "salt-library";
var LibraryView = class extends import_obsidian21.ItemView {
  constructor() {
    super(...arguments);
    this.mode = "creatures";
    this.cleanups = [];
    this.query = "";
    // data per mode
    this.creatureFiles = [];
    this.terrains = {};
    this.spellFiles = [];
    this.regions = [];
  }
  getViewType() {
    return VIEW_LIBRARY;
  }
  getDisplayText() {
    return "Library";
  }
  getIcon() {
    return "library";
  }
  async onOpen() {
    this.contentEl.addClass("sm-library");
    await ensureCreatureDir(this.app);
    await ensureTerrainFile(this.app);
    await ensureSpellDir(this.app);
    await ensureRegionsFile(this.app);
    await this.reloadAll();
    this.render();
    this.attachWatcher();
  }
  async onClose() {
    this.unwatch?.();
    this.cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
      }
    });
    this.cleanups = [];
    this.contentEl.removeClass("sm-library");
  }
  attachWatcher() {
    this.unwatch?.();
    const off = [];
    off.push(watchCreatureDir(this.app, () => this.onSourceChanged("creatures")));
    off.push(watchSpellDir(this.app, () => this.onSourceChanged("spells")));
    off.push(watchTerrains(this.app, () => this.onSourceChanged("terrains")));
    off.push(watchRegions(this.app, () => this.onSourceChanged("regions")));
    this.unwatch = () => off.forEach((fn) => fn());
  }
  async onSourceChanged(which) {
    if (which === "creatures") this.creatureFiles = await listCreatureFiles(this.app);
    if (which === "spells") this.spellFiles = await listSpellFiles(this.app);
    if (which === "terrains") this.terrains = await loadTerrains(this.app);
    if (which === "regions") this.regions = await loadRegions(this.app);
    this.renderList();
  }
  async reloadAll() {
    [this.creatureFiles, this.spellFiles, this.terrains, this.regions] = await Promise.all([
      listCreatureFiles(this.app),
      listSpellFiles(this.app),
      loadTerrains(this.app),
      loadRegions(this.app)
    ]);
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: "Library" });
    const header = root.createDiv({ cls: "sm-lib-header" });
    const mkBtn = (label, m) => {
      const b = header.createEl("button", { text: label });
      const update = () => b.classList.toggle("is-active", this.mode === m);
      update();
      b.onclick = () => {
        this.mode = m;
        updateAll();
      };
      return b;
    };
    mkBtn("Creatures", "creatures");
    mkBtn("Spells", "spells");
    mkBtn("Terrains", "terrains");
    mkBtn("Regions", "regions");
    const bar = root.createDiv({ cls: "sm-cc-searchbar" });
    const search = bar.createEl("input", { attr: { type: "text", placeholder: "Suche oder Name eingeben\u2026" } });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.renderList();
    };
    const createBtn = bar.createEl("button", { text: "Erstellen" });
    createBtn.onclick = () => this.onCreate(search.value.trim());
    const desc = root.createDiv({ cls: "desc" });
    const updateDesc = () => {
      desc.setText(
        this.mode === "creatures" ? "Quelle: SaltMarcher/Creatures/" : this.mode === "spells" ? "Quelle: SaltMarcher/Spells/" : this.mode === "terrains" ? `Quelle: ${TERRAIN_FILE}` : `Quelle: ${REGIONS_FILE}`
      );
    };
    updateDesc();
    root.createDiv({ cls: "sm-cc-list" });
    const updateAll = () => {
      updateDesc();
      this.renderList();
      header.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.innerText.toLowerCase().startsWith(this.mode.slice(0, 3))));
    };
    this.renderList();
  }
  renderList() {
    const root = this.contentEl;
    const list = root.querySelector(".sm-cc-list");
    if (!list) return;
    list.empty();
    const q = (this.query || "").toLowerCase();
    const score = (name) => this.scoreName(name.toLowerCase(), q);
    if (this.mode === "creatures") {
      const items = this.creatureFiles.map((f) => ({ name: f.basename, f, s: score(f.basename) })).filter((x) => q ? x.s > -Infinity : true).sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
      for (const it of items) {
        const row = list.createDiv({ cls: "sm-cc-item" });
        row.createDiv({ cls: "sm-cc-item__name", text: it.name });
        const openBtn = row.createEl("button", { text: "\xD6ffnen" });
        openBtn.onclick = async () => this.app.workspace.openLinkText(it.f.path, it.f.path, true);
      }
      return;
    }
    if (this.mode === "spells") {
      const items = this.spellFiles.map((f) => ({ name: f.basename, f, s: score(f.basename) })).filter((x) => q ? x.s > -Infinity : true).sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
      for (const it of items) {
        const row = list.createDiv({ cls: "sm-cc-item" });
        row.createDiv({ cls: "sm-cc-item__name", text: it.name });
        const openBtn = row.createEl("button", { text: "\xD6ffnen" });
        openBtn.onclick = async () => this.app.workspace.openLinkText(it.f.path, it.f.path, true);
      }
      return;
    }
    if (this.mode === "terrains") {
      const names = Object.keys(this.terrains || {});
      const order = ["", ...names.filter((n) => n !== "")];
      const items = order.map((name) => ({ name, s: score(name || "") })).filter((x) => x.name === "" || (q ? x.s > -Infinity : true)).sort((a, b) => a.name === "" ? -1 : b.name === "" ? 1 : b.s - a.s || a.name.localeCompare(b.name));
      for (const it of items) {
        const row = list.createDiv({ cls: "sm-cc-item" });
        const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } });
        nameInp.value = it.name;
        const colorInp = row.createEl("input", { attr: { type: "color" } });
        const speedInp = row.createEl("input", { attr: { type: "number", step: "0.1", min: "0" } });
        const delBtn = row.createEl("button", { text: "\u{1F5D1}" });
        const v = this.terrains[it.name] || { color: "transparent", speed: 1 };
        colorInp.value = /^#([0-9a-f]{6})$/i.test(v.color) ? v.color : "#999999";
        speedInp.value = String(Number.isFinite(v.speed) ? v.speed : 1);
        const commit = () => this.commitTerrains();
        const upsert = () => {
          const k = nameInp.value;
          const color = colorInp.value;
          const speed = parseFloat(speedInp.value) || 1;
          this.upsertTerrain(it.name, k, color, speed);
        };
        nameInp.oninput = upsert;
        colorInp.oninput = upsert;
        speedInp.oninput = upsert;
        delBtn.onclick = () => this.removeTerrain(nameInp.value);
      }
      return;
    }
    const entries = this.regions.map((r, i) => ({ ...r, _i: i })).filter((r) => (r.name || "").trim()).map((r) => ({ r, s: score(r.name) })).filter((x) => q ? x.s > -Infinity : true).sort((a, b) => b.s - a.s || a.r.name.localeCompare(b.r.name));
    for (const it of entries) {
      const row = list.createDiv({ cls: "sm-cc-item" });
      const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } });
      nameInp.value = it.r.name;
      const terrSel = row.createEl("select");
      enhanceSelectToSearch(terrSel, "Such-dropdown\u2026");
      const terrNames = Object.keys(this.terrains || {});
      for (const t of terrNames) {
        const opt = terrSel.createEl("option", { text: t || "(leer)", value: t });
        if (t === it.r.terrain) opt.selected = true;
      }
      const encInp = row.createEl("input", { attr: { type: "number", min: "1", step: "1", placeholder: "Encounter 1/n" } });
      encInp.value = it.r.encounterOdds && it.r.encounterOdds > 0 ? String(it.r.encounterOdds) : "";
      const delBtn = row.createEl("button", { text: "\u{1F5D1}" });
      const update = () => {
        const n = parseInt(encInp.value, 10);
        const odds = Number.isFinite(n) && n > 0 ? n : void 0;
        this.upsertRegion(it.r._i, nameInp.value, terrSel.value, odds);
      };
      nameInp.oninput = update;
      terrSel.onchange = update;
      encInp.oninput = update;
      delBtn.onclick = () => this.removeRegion(it.r._i);
    }
  }
  async onCreate(name) {
    if (this.mode === "creatures") {
      new CreateCreatureModal(this.app, name, async (data) => {
        const f = await createCreatureFile(this.app, data);
        await this.onSourceChanged("creatures");
        await this.app.workspace.openLinkText(f.path, f.path, true, { state: { mode: "source" } });
      }).open();
      return;
    }
    if (this.mode === "spells") {
      new CreateSpellModal(this.app, name, async (data) => {
        const f = await createSpellFile(this.app, data);
        await this.onSourceChanged("spells");
        await this.app.workspace.openLinkText(f.path, f.path, true, { state: { mode: "source" } });
      }).open();
      return;
    }
    if (!name) return;
    if (this.mode === "terrains") {
      const map = { ...this.terrains };
      if (!map[name]) map[name] = { color: "#888888", speed: 1 };
      await saveTerrains(this.app, map);
      this.terrains = await loadTerrains(this.app);
      this.renderList();
      return;
    }
    const exists = this.regions.some((r) => (r.name || "").toLowerCase() === name.toLowerCase());
    if (!exists) {
      const next = [...this.regions, { name, terrain: "" }];
      await saveRegions(this.app, next);
      this.regions = await loadRegions(this.app);
      this.renderList();
    }
  }
  scoreName(name, q) {
    if (!q) return 1e-4;
    if (name === q) return 1e3;
    if (name.startsWith(q)) return 900 - (name.length - q.length);
    const idx = name.indexOf(q);
    if (idx >= 0) return 700 - idx;
    const tokenIdx = name.split(/\s+|[-_]/).findIndex((t) => t.startsWith(q));
    if (tokenIdx >= 0) return 600 - tokenIdx * 5;
    return -Infinity;
  }
  // --- Terrains helpers ---
  async commitTerrains() {
    await saveTerrains(this.app, this.terrains);
    this.terrains = await loadTerrains(this.app);
  }
  upsertTerrain(oldKey, newKey, color, speed) {
    if (!Number.isFinite(speed)) speed = 1;
    const next = { ...this.terrains };
    if (oldKey !== newKey) delete next[oldKey];
    if (newKey === "") next[""] = { color: "transparent", speed: 1 };
    else next[newKey] = { color, speed };
    this.terrains = next;
    void this.commitTerrains();
  }
  removeTerrain(key) {
    if (key === "") return;
    const next = { ...this.terrains };
    delete next[key];
    this.terrains = next;
    void this.commitTerrains();
    this.renderList();
  }
  // --- Regions helpers ---
  async commitRegions() {
    await saveRegions(this.app, this.regions);
  }
  upsertRegion(idx, name, terrain, encounterOdds) {
    if (!this.regions[idx]) return;
    this.regions[idx] = { name, terrain, encounterOdds };
    void this.commitRegions();
  }
  removeRegion(idx) {
    if (!this.regions[idx]) return;
    this.regions.splice(idx, 1);
    void this.commitRegions();
    this.renderList();
  }
};

// src/apps/layout/view.ts
var import_obsidian22 = require("obsidian");
var VIEW_LAYOUT_EDITOR = "salt-layout-editor";
var MIN_ELEMENT_SIZE = 60;
var ELEMENT_DEFINITIONS = [
  {
    type: "label",
    buttonLabel: "Label",
    defaultLabel: "Label",
    defaultDescription: "Beschreibender Text f\xFCr den Dialog.",
    width: 220,
    height: 120
  },
  {
    type: "text-input",
    buttonLabel: "Textfeld",
    defaultLabel: "Label",
    defaultPlaceholder: "Wert eingeben\u2026",
    width: 260,
    height: 140
  },
  {
    type: "textarea",
    buttonLabel: "Mehrzeiliges Feld",
    defaultLabel: "Beschreibung",
    defaultPlaceholder: "Text erfassen\u2026",
    width: 320,
    height: 180
  },
  {
    type: "box",
    buttonLabel: "Box",
    defaultLabel: "Abschnitt",
    defaultDescription: "Container f\xFCr zusammengeh\xF6rige Felder.",
    width: 360,
    height: 200
  },
  {
    type: "separator",
    buttonLabel: "Trennstrich",
    defaultLabel: "Trennlinie",
    width: 320,
    height: 80
  },
  {
    type: "dropdown",
    buttonLabel: "Dropdown",
    defaultLabel: "Auswahl",
    defaultPlaceholder: "Option w\xE4hlen\u2026",
    options: ["Option A", "Option B"],
    width: 260,
    height: 150
  },
  {
    type: "search-dropdown",
    buttonLabel: "Such-Dropdown",
    defaultLabel: "Suchfeld",
    defaultPlaceholder: "Suchen\u2026",
    options: ["Erster Eintrag", "Zweiter Eintrag"],
    width: 280,
    height: 160
  },
  {
    type: "vbox",
    buttonLabel: "VBox-Container",
    defaultLabel: "VBox",
    defaultDescription: "Ordnet verkn\xFCpfte Elemente automatisch untereinander an.",
    width: 340,
    height: 260,
    defaultLayout: { gap: 16, padding: 16, align: "stretch" }
  },
  {
    type: "hbox",
    buttonLabel: "HBox-Container",
    defaultLabel: "HBox",
    defaultDescription: "Ordnet verkn\xFCpfte Elemente automatisch nebeneinander an.",
    width: 360,
    height: 220,
    defaultLayout: { gap: 16, padding: 16, align: "center" }
  }
];
var ELEMENT_DEFINITION_LOOKUP = new Map(
  ELEMENT_DEFINITIONS.map((def) => [def.type, def])
);
var ATTRIBUTE_GROUPS = [
  {
    label: "Allgemein",
    options: [
      { value: "name", label: "Name" },
      { value: "type", label: "Typ" },
      { value: "size", label: "Gr\xF6\xDFe" },
      { value: "alignmentLawChaos", label: "Gesinnung (Gesetz/Chaos)" },
      { value: "alignmentGoodEvil", label: "Gesinnung (Gut/B\xF6se)" },
      { value: "cr", label: "Herausforderungsgrad" },
      { value: "xp", label: "Erfahrungspunkte" }
    ]
  },
  {
    label: "Kampfwerte",
    options: [
      { value: "ac", label: "R\xFCstungsklasse" },
      { value: "initiative", label: "Initiative" },
      { value: "hp", label: "Trefferpunkte" },
      { value: "hitDice", label: "Trefferw\xFCrfel" },
      { value: "pb", label: "Proficiency Bonus" }
    ]
  },
  {
    label: "Bewegung",
    options: [
      { value: "speedWalk", label: "Geschwindigkeit (Laufen)" },
      { value: "speedFly", label: "Geschwindigkeit (Fliegen)" },
      { value: "speedSwim", label: "Geschwindigkeit (Schwimmen)" },
      { value: "speedBurrow", label: "Geschwindigkeit (Graben)" },
      { value: "speedList", label: "Geschwindigkeiten (Liste)" }
    ]
  },
  {
    label: "Attribute",
    options: [
      { value: "str", label: "St\xE4rke" },
      { value: "dex", label: "Geschicklichkeit" },
      { value: "con", label: "Konstitution" },
      { value: "int", label: "Intelligenz" },
      { value: "wis", label: "Weisheit" },
      { value: "cha", label: "Charisma" }
    ]
  },
  {
    label: "Rettungsw\xFCrfe & Fertigkeiten",
    options: [
      { value: "saveProf.str", label: "Rettungswurf: St\xE4rke" },
      { value: "saveProf.dex", label: "Rettungswurf: Geschicklichkeit" },
      { value: "saveProf.con", label: "Rettungswurf: Konstitution" },
      { value: "saveProf.int", label: "Rettungswurf: Intelligenz" },
      { value: "saveProf.wis", label: "Rettungswurf: Weisheit" },
      { value: "saveProf.cha", label: "Rettungswurf: Charisma" },
      { value: "skillsProf", label: "Fertigkeiten (Proficiencies)" },
      { value: "skillsExpertise", label: "Fertigkeiten (Expertise)" }
    ]
  },
  {
    label: "Sinne & Sprache",
    options: [
      { value: "sensesList", label: "Sinne" },
      { value: "languagesList", label: "Sprachen" }
    ]
  },
  {
    label: "Resistenzen & Immunit\xE4ten",
    options: [
      { value: "damageVulnerabilitiesList", label: "Verwundbarkeiten" },
      { value: "damageResistancesList", label: "Resistenzen" },
      { value: "damageImmunitiesList", label: "Schadensimmunit\xE4ten" },
      { value: "conditionImmunitiesList", label: "Zustandsimmunit\xE4ten" }
    ]
  },
  {
    label: "Ausr\xFCstung & Ressourcen",
    options: [
      { value: "gearList", label: "Ausr\xFCstung" },
      { value: "passivesList", label: "Passive Werte" }
    ]
  },
  {
    label: "Texte & Abschnitte",
    options: [
      { value: "traits", label: "Traits (Text)" },
      { value: "actions", label: "Actions (Text)" },
      { value: "legendary", label: "Legendary Actions (Text)" },
      { value: "entries", label: "Strukturierte Eintr\xE4ge" },
      { value: "actionsList", label: "Strukturierte Actions" },
      { value: "spellsKnown", label: "Bekannte Zauber" }
    ]
  }
];
var ATTRIBUTE_LABEL_LOOKUP = new Map(
  ATTRIBUTE_GROUPS.flatMap((group) => group.options.map((opt) => [opt.value, opt.label]))
);
var LayoutEditorView = class extends import_obsidian22.ItemView {
  constructor() {
    super(...arguments);
    this.elements = [];
    this.selectedElementId = null;
    this.canvasWidth = 800;
    this.canvasHeight = 600;
    this.isImporting = false;
    this.elementElements = /* @__PURE__ */ new Map();
    this.activeAttributePopover = null;
  }
  getViewType() {
    return VIEW_LAYOUT_EDITOR;
  }
  getDisplayText() {
    return "Layout Editor";
  }
  getIcon() {
    return "layout-grid";
  }
  async onOpen() {
    this.contentEl.addClass("sm-layout-editor");
    this.render();
    if (this.elements.length === 0) {
      await this.importCreatureCreatorLayout({ silent: true });
    }
    if (this.elements.length === 0) {
      this.createElement("label");
    }
    this.refreshExport();
    this.updateStatus();
  }
  async onClose() {
    this.elementElements.clear();
    this.contentEl.empty();
    this.contentEl.removeClass("sm-layout-editor");
  }
  render() {
    const root = this.contentEl;
    root.empty();
    const header = root.createDiv({ cls: "sm-le-header" });
    header.createEl("h2", { text: "Layout Editor" });
    const controls = header.createDiv({ cls: "sm-le-controls" });
    const addGroup = controls.createDiv({ cls: "sm-le-control sm-le-control--stack" });
    addGroup.createEl("label", { text: "Element hinzuf\xFCgen" });
    const addWrap = addGroup.createDiv({ cls: "sm-le-add" });
    for (const def of ELEMENT_DEFINITIONS) {
      const btn = addWrap.createEl("button", { text: def.buttonLabel });
      btn.onclick = () => this.createElement(def.type);
    }
    this.importBtn = controls.createEl("button", { text: "Creature-Layout importieren" });
    this.importBtn.onclick = () => {
      void this.importCreatureCreatorLayout();
    };
    const sizeGroup = controls.createDiv({ cls: "sm-le-control" });
    sizeGroup.createEl("label", { text: "Arbeitsfl\xE4che" });
    const sizeWrapper = sizeGroup.createDiv({ cls: "sm-le-size" });
    this.widthInput = sizeWrapper.createEl("input", { attr: { type: "number", min: "200", max: "2000" } });
    this.widthInput.value = String(this.canvasWidth);
    this.widthInput.onchange = () => {
      const next = clamp(parseInt(this.widthInput.value, 10) || this.canvasWidth, 200, 2e3);
      this.canvasWidth = next;
      this.widthInput.value = String(next);
      this.applyCanvasSize();
      this.refreshExport();
    };
    sizeWrapper.createSpan({ text: "\xD7" });
    this.heightInput = sizeWrapper.createEl("input", { attr: { type: "number", min: "200", max: "2000" } });
    this.heightInput.value = String(this.canvasHeight);
    this.heightInput.onchange = () => {
      const next = clamp(parseInt(this.heightInput.value, 10) || this.canvasHeight, 200, 2e3);
      this.canvasHeight = next;
      this.heightInput.value = String(next);
      this.applyCanvasSize();
      this.refreshExport();
    };
    sizeWrapper.createSpan({ text: "px" });
    this.statusEl = header.createDiv({ cls: "sm-le-status" });
    const body = root.createDiv({ cls: "sm-le-body" });
    const stage = body.createDiv({ cls: "sm-le-stage" });
    this.canvasEl = stage.createDiv({ cls: "sm-le-canvas" });
    this.canvasEl.style.width = `${this.canvasWidth}px`;
    this.canvasEl.style.height = `${this.canvasHeight}px`;
    this.registerDomEvent(this.canvasEl, "pointerdown", (ev) => {
      if (ev.target === this.canvasEl) {
        this.selectElement(null);
      }
    });
    this.inspectorHost = body.createDiv({ cls: "sm-le-inspector" });
    this.renderInspector();
    const exportWrap = root.createDiv({ cls: "sm-le-export" });
    exportWrap.createEl("h3", { text: "Layout-Daten" });
    const exportControls = exportWrap.createDiv({ cls: "sm-le-export__controls" });
    const copyBtn = exportControls.createEl("button", { text: "JSON kopieren" });
    copyBtn.onclick = async () => {
      if (!this.exportEl.value) return;
      try {
        const clip = navigator.clipboard;
        if (!clip || typeof clip.writeText !== "function") {
          throw new Error("Clipboard API nicht verf\xFCgbar");
        }
        await clip.writeText(this.exportEl.value);
        new import_obsidian22.Notice("Layout kopiert");
      } catch (error) {
        console.error("Clipboard write failed", error);
        new import_obsidian22.Notice("Konnte nicht in die Zwischenablage kopieren");
      }
    };
    this.exportEl = exportWrap.createEl("textarea", { cls: "sm-le-export__textarea", attr: { rows: "10", readonly: "readonly" } });
    this.renderElements();
    this.sandboxEl = root.createDiv({ cls: "sm-le-sandbox" });
    this.sandboxEl.style.position = "absolute";
    this.sandboxEl.style.top = "-10000px";
    this.sandboxEl.style.left = "-10000px";
    this.sandboxEl.style.visibility = "hidden";
    this.sandboxEl.style.pointerEvents = "none";
    this.sandboxEl.style.width = "960px";
    this.sandboxEl.style.padding = "24px";
    this.sandboxEl.style.boxSizing = "border-box";
  }
  applyCanvasSize() {
    if (!this.canvasEl) return;
    this.canvasEl.style.width = `${this.canvasWidth}px`;
    this.canvasEl.style.height = `${this.canvasHeight}px`;
    for (const element of this.elements) {
      const maxX = Math.max(0, this.canvasWidth - element.width);
      const maxY = Math.max(0, this.canvasHeight - element.height);
      element.x = clamp(element.x, 0, maxX);
      element.y = clamp(element.y, 0, maxY);
      const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
      const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
      element.width = clamp(element.width, MIN_ELEMENT_SIZE, maxWidth);
      element.height = clamp(element.height, MIN_ELEMENT_SIZE, maxHeight);
      this.syncElementElement(element);
    }
    for (const element of this.elements) {
      if (isContainerType(element.type)) {
        this.applyContainerLayout(element, { silent: true });
      }
    }
  }
  createElement(type) {
    const def = ELEMENT_DEFINITION_LOOKUP.get(type);
    const width = def ? def.width : Math.min(240, Math.max(160, Math.round(this.canvasWidth * 0.25)));
    const height = def ? def.height : Math.min(160, Math.max(120, Math.round(this.canvasHeight * 0.25)));
    const id = `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const element = {
      id,
      type,
      x: Math.max(0, Math.round((this.canvasWidth - width) / 2)),
      y: Math.max(0, Math.round((this.canvasHeight - height) / 2)),
      width,
      height,
      label: def?.defaultLabel ?? type,
      description: def?.defaultDescription,
      placeholder: def?.defaultPlaceholder,
      defaultValue: def?.defaultValue,
      options: def?.options ? [...def.options] : void 0,
      attributes: []
    };
    if (def?.defaultLayout) {
      element.layout = { ...def.defaultLayout };
      element.children = [];
    }
    const selected = this.selectedElementId ? this.elements.find((el) => el.id === this.selectedElementId) : null;
    const parentContainer = selected && isContainerElement(selected) && !isContainerType(type) ? selected : null;
    if (parentContainer) {
      element.parentId = parentContainer.id;
      const padding = parentContainer.layout.padding;
      element.x = parentContainer.x + padding;
      element.y = parentContainer.y + padding;
      element.width = Math.min(parentContainer.width - padding * 2, element.width);
      element.height = Math.min(parentContainer.height - padding * 2, element.height);
    }
    this.elements.push(element);
    if (parentContainer) {
      this.addChildToContainer(parentContainer, element.id);
      this.applyContainerLayout(parentContainer);
    }
    this.renderElements();
    this.selectElement(element.id);
    this.refreshExport();
  }
  renderElements() {
    if (!this.canvasEl) return;
    const seen = /* @__PURE__ */ new Set();
    for (const element of this.elements) {
      if (isContainerType(element.type)) {
        this.ensureContainerDefaults(element);
      }
      seen.add(element.id);
      let el = this.elementElements.get(element.id);
      if (!el) {
        el = this.createElementNode(element);
        this.elementElements.set(element.id, el);
      }
      this.syncElementElement(element);
    }
    for (const [id, el] of Array.from(this.elementElements.entries())) {
      if (!seen.has(id)) {
        el.remove();
        this.elementElements.delete(id);
      }
    }
    this.updateSelectionStyles();
    this.updateStatus();
  }
  ensureContainerDefaults(element) {
    if (!isContainerType(element.type)) return;
    if (!element.layout) {
      const def = ELEMENT_DEFINITION_LOOKUP.get(element.type);
      element.layout = def?.defaultLayout ? { ...def.defaultLayout } : { gap: 16, padding: 16, align: "stretch" };
    }
    if (!Array.isArray(element.children)) {
      element.children = [];
    }
  }
  addChildToContainer(container, childId) {
    if (!isContainerType(container.type)) return;
    this.ensureContainerDefaults(container);
    if (!container.children.includes(childId)) {
      container.children.push(childId);
    }
  }
  removeChildFromContainer(container, childId) {
    if (!isContainerType(container.type) || !Array.isArray(container.children)) return;
    container.children = container.children.filter((id) => id !== childId);
  }
  moveChildInContainer(container, childId, delta) {
    if (!isContainerType(container.type) || !Array.isArray(container.children)) return;
    const index = container.children.indexOf(childId);
    if (index === -1) return;
    const nextIndex = clamp(index + delta, 0, container.children.length - 1);
    if (nextIndex === index) return;
    const [id] = container.children.splice(index, 1);
    container.children.splice(nextIndex, 0, id);
    this.applyContainerLayout(container);
  }
  assignElementToContainer(elementId, containerId) {
    const element = this.elements.find((el) => el.id === elementId);
    if (!element) return;
    const previousParent = element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    if (previousParent) {
      this.removeChildFromContainer(previousParent, element.id);
    }
    element.parentId = void 0;
    const nextParent = containerId ? this.elements.find((el) => el.id === containerId) : null;
    if (nextParent) {
      this.addChildToContainer(nextParent, element.id);
      element.parentId = nextParent.id;
    }
    if (previousParent) {
      this.applyContainerLayout(previousParent);
    }
    if (nextParent) {
      this.applyContainerLayout(nextParent);
    }
    this.syncElementElement(element);
    this.refreshExport();
    this.renderInspector();
  }
  applyContainerLayout(container, options) {
    if (!isContainerType(container.type)) return;
    this.ensureContainerDefaults(container);
    const layout = container.layout;
    const gap = Math.max(0, layout.gap);
    const padding = Math.max(0, layout.padding);
    const align = layout.align;
    const childIds = Array.isArray(container.children) ? container.children.slice() : [];
    const children = [];
    const validIds = [];
    for (const id of childIds) {
      if (id === container.id) continue;
      const child = this.elements.find((el) => el.id === id);
      if (child) {
        children.push(child);
        validIds.push(id);
      }
    }
    container.children = validIds;
    if (!children.length) {
      if (!options?.silent) {
        this.refreshExport();
        this.renderInspector();
      }
      return;
    }
    const innerWidth = Math.max(MIN_ELEMENT_SIZE, container.width - padding * 2);
    const innerHeight = Math.max(MIN_ELEMENT_SIZE, container.height - padding * 2);
    const gapCount = Math.max(0, children.length - 1);
    if (container.type === "vbox") {
      const availableHeight = innerHeight - gap * gapCount;
      const slotHeight = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableHeight / children.length));
      let y = container.y + padding;
      for (const child of children) {
        child.parentId = container.id;
        child.height = slotHeight;
        child.y = y;
        let width = innerWidth;
        if (align === "stretch") {
          child.x = container.x + padding;
        } else {
          width = Math.min(child.width, innerWidth);
          if (align === "center") {
            child.x = container.x + padding + Math.round((innerWidth - width) / 2);
          } else if (align === "end") {
            child.x = container.x + padding + (innerWidth - width);
          } else {
            child.x = container.x + padding;
          }
        }
        child.width = width;
        y += slotHeight + gap;
        this.syncElementElement(child);
      }
    } else {
      const availableWidth = innerWidth - gap * gapCount;
      const slotWidth = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableWidth / children.length));
      let x = container.x + padding;
      for (const child of children) {
        child.parentId = container.id;
        child.width = slotWidth;
        child.x = x;
        let height = innerHeight;
        if (align === "stretch") {
          child.y = container.y + padding;
        } else {
          height = Math.min(child.height, innerHeight);
          if (align === "center") {
            child.y = container.y + padding + Math.round((innerHeight - height) / 2);
          } else if (align === "end") {
            child.y = container.y + padding + (innerHeight - height);
          } else {
            child.y = container.y + padding;
          }
        }
        child.height = height;
        x += slotWidth + gap;
        this.syncElementElement(child);
      }
    }
    this.syncElementElement(container);
    if (!options?.silent) {
      this.refreshExport();
      this.renderInspector();
    }
    this.refreshAttributePopover();
  }
  openAttributePopover(element, anchor) {
    this.closeAttributePopover();
    const container = document.createElement("div");
    container.className = "sm-le-attr-popover";
    container.style.position = "absolute";
    container.style.zIndex = "1000";
    container.style.visibility = "hidden";
    container.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    const heading = document.createElement("div");
    heading.className = "sm-le-attr-popover__heading";
    heading.textContent = "Attribute";
    container.appendChild(heading);
    const hint = document.createElement("div");
    hint.className = "sm-le-attr-popover__hint";
    hint.textContent = "Mehrfachauswahl m\xF6glich.";
    container.appendChild(hint);
    const scroll = document.createElement("div");
    scroll.className = "sm-le-attr-popover__scroll";
    container.appendChild(scroll);
    const clearBtn = document.createElement("button");
    clearBtn.className = "sm-le-attr-popover__clear";
    clearBtn.textContent = "Alle entfernen";
    clearBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (element.attributes.length === 0) return;
      element.attributes = [];
      this.syncElementElement(element);
      this.refreshExport();
      this.renderInspector();
      this.refreshAttributePopover();
    });
    container.appendChild(clearBtn);
    for (const group of ATTRIBUTE_GROUPS) {
      const groupEl = document.createElement("div");
      groupEl.className = "sm-le-attr-popover__group";
      const title = document.createElement("div");
      title.className = "sm-le-attr-popover__group-title";
      title.textContent = group.label;
      groupEl.appendChild(title);
      for (const option of group.options) {
        const optionLabel = document.createElement("label");
        optionLabel.className = "sm-le-attr-popover__option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.attr = option.value;
        checkbox.checked = element.attributes.includes(option.value);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            if (!element.attributes.includes(option.value)) {
              element.attributes = [...element.attributes, option.value];
            }
          } else {
            element.attributes = element.attributes.filter((v) => v !== option.value);
          }
          this.syncElementElement(element);
          this.refreshExport();
          this.renderInspector();
          this.refreshAttributePopover();
        });
        const labelText = document.createElement("span");
        labelText.textContent = option.label;
        optionLabel.appendChild(checkbox);
        optionLabel.appendChild(labelText);
        groupEl.appendChild(optionLabel);
      }
      scroll.appendChild(groupEl);
    }
    const onPointerDown = (ev) => {
      if (!(ev.target instanceof Node)) return;
      if (!container.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) {
        this.closeAttributePopover();
      }
    };
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        this.closeAttributePopover();
      }
    };
    document.body.appendChild(container);
    const state = {
      elementId: element.id,
      container,
      anchor,
      dispose: () => {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
        container.remove();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    this.activeAttributePopover = state;
    this.positionAttributePopover(state);
    container.style.visibility = "visible";
  }
  closeAttributePopover() {
    if (!this.activeAttributePopover) return;
    this.activeAttributePopover.dispose();
    this.activeAttributePopover = null;
  }
  refreshAttributePopover() {
    if (!this.activeAttributePopover) return;
    const element = this.elements.find((el) => el.id === this.activeAttributePopover.elementId);
    if (!element) {
      this.closeAttributePopover();
      return;
    }
    const checkboxes = this.activeAttributePopover.container.querySelectorAll("input[type='checkbox'][data-attr]");
    checkboxes.forEach((checkbox) => {
      const attr = checkbox.dataset.attr;
      if (!attr) return;
      checkbox.checked = element.attributes.includes(attr);
    });
  }
  positionAttributePopover(state) {
    const anchorRect = state.anchor.getBoundingClientRect();
    const popRect = state.container.getBoundingClientRect();
    const margin = 8;
    let left = anchorRect.left + window.scrollX;
    let top = anchorRect.bottom + window.scrollY + margin;
    const viewportWidth = window.innerWidth + window.scrollX;
    const viewportHeight = window.innerHeight + window.scrollY;
    if (left + popRect.width > viewportWidth - margin) {
      left = viewportWidth - popRect.width - margin;
    }
    if (left < margin) left = margin;
    if (top + popRect.height > viewportHeight - margin) {
      top = anchorRect.top + window.scrollY - popRect.height - margin;
    }
    if (top < margin) top = margin;
    state.container.style.left = `${Math.round(left)}px`;
    state.container.style.top = `${Math.round(top)}px`;
  }
  createElementNode(element) {
    const el = this.canvasEl.createDiv({ cls: "sm-le-box" });
    el.dataset.id = element.id;
    const header = el.createDiv({ cls: "sm-le-box__header" });
    const handle = header.createSpan({ cls: "sm-le-box__handle", text: "\u283F" });
    handle.dataset.role = "move";
    const dims = header.createSpan({ cls: "sm-le-box__dims", text: "" });
    dims.dataset.role = "dims";
    const body = el.createDiv({ cls: "sm-le-box__body" });
    body.createDiv({ cls: "sm-le-box__type", text: "" }).dataset.role = "type";
    body.createDiv({ cls: "sm-le-box__label", text: "(Label)" }).dataset.role = "label";
    body.createDiv({ cls: "sm-le-box__details", text: "" }).dataset.role = "details";
    const footer = el.createDiv({ cls: "sm-le-box__footer" });
    const attrs = footer.createSpan({ cls: "sm-le-box__attrs", text: "" });
    attrs.dataset.role = "attrs";
    attrs.addClass("is-editable");
    attrs.onclick = (ev) => {
      ev.stopPropagation();
      this.selectElement(element.id);
      this.openAttributePopover(element, attrs);
    };
    const resize = el.createDiv({ cls: "sm-le-box__resize" });
    resize.dataset.role = "resize";
    el.onclick = (ev) => {
      if (ev.target instanceof HTMLElement && ev.target.dataset.role === "resize") return;
      this.selectElement(element.id);
    };
    handle.onpointerdown = (ev) => {
      ev.preventDefault();
      this.selectElement(element.id);
      this.beginDrag(element, ev);
    };
    resize.onpointerdown = (ev) => {
      ev.preventDefault();
      this.selectElement(element.id);
      this.beginResize(element, ev);
    };
    return el;
  }
  syncElementElement(element) {
    const el = this.elementElements.get(element.id);
    if (!el) return;
    el.style.left = `${element.x}px`;
    el.style.top = `${element.y}px`;
    el.style.width = `${element.width}px`;
    el.style.height = `${element.height}px`;
    el.classList.toggle("sm-le-box--container", isContainerType(element.type));
    const typeEl = el.querySelector('[data-role="type"]');
    const labelEl = el.querySelector('[data-role="label"]');
    const detailsEl = el.querySelector('[data-role="details"]');
    const dimsEl = el.querySelector('[data-role="dims"]');
    const attrsEl = el.querySelector('[data-role="attrs"]');
    typeEl?.setText(getElementTypeLabel(element.type));
    labelEl?.setText(element.label || "(Label)");
    detailsEl?.setText(this.getElementDetails(element));
    if (dimsEl) {
      dimsEl.setText(`${Math.round(element.width)} \xD7 ${Math.round(element.height)} px`);
    }
    if (attrsEl) {
      attrsEl.setText(this.getAttributeSummary(element.attributes));
      attrsEl.classList.toggle("is-empty", element.attributes.length === 0);
    }
    if (this.activeAttributePopover?.elementId === element.id) {
      this.refreshAttributePopover();
      this.positionAttributePopover(this.activeAttributePopover);
    }
  }
  beginDrag(element, event) {
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = element.x;
    const originY = element.y;
    const isContainer = isContainerType(element.type);
    const parent = element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    const childOrigins = [];
    if (isContainer && Array.isArray(element.children)) {
      for (const childId of element.children) {
        const child = this.elements.find((el) => el.id === childId);
        if (child) {
          childOrigins.push({ child, x: child.x, y: child.y });
        }
      }
    }
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nextX = originX + dx;
      const nextY = originY + dy;
      const maxX = Math.max(0, this.canvasWidth - element.width);
      const maxY = Math.max(0, this.canvasHeight - element.height);
      element.x = clamp(nextX, 0, maxX);
      element.y = clamp(nextY, 0, maxY);
      this.syncElementElement(element);
      if (isContainer) {
        for (const entry of childOrigins) {
          const childMaxX = Math.max(0, this.canvasWidth - entry.child.width);
          const childMaxY = Math.max(0, this.canvasHeight - entry.child.height);
          entry.child.x = clamp(entry.x + dx, 0, childMaxX);
          entry.child.y = clamp(entry.y + dy, 0, childMaxY);
          this.syncElementElement(entry.child);
        }
      }
      this.refreshExport();
      this.renderInspector();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parent && isContainerType(parent.type)) {
        this.applyContainerLayout(parent);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  beginResize(element, event) {
    const startX = event.clientX;
    const startY = event.clientY;
    const originW = element.width;
    const originH = element.height;
    const isContainer = isContainerType(element.type);
    const parent = element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
      const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
      const nextW = clamp(originW + dx, MIN_ELEMENT_SIZE, maxWidth);
      const nextH = clamp(originH + dy, MIN_ELEMENT_SIZE, maxHeight);
      element.width = nextW;
      element.height = nextH;
      this.syncElementElement(element);
      if (isContainer) {
        this.applyContainerLayout(element, { silent: true });
      }
      this.refreshExport();
      this.renderInspector();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parent && isContainerType(parent.type)) {
        this.applyContainerLayout(parent);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  selectElement(id) {
    this.closeAttributePopover();
    this.selectedElementId = id;
    this.updateSelectionStyles();
    this.renderInspector();
  }
  updateSelectionStyles() {
    for (const [id, el] of this.elementElements) {
      el.classList.toggle("is-selected", id === this.selectedElementId);
    }
  }
  renderInspector() {
    if (!this.inspectorHost) return;
    const host = this.inspectorHost;
    host.empty();
    host.createEl("h3", { text: "Eigenschaften" });
    const element = this.selectedElementId ? this.elements.find((b) => b.id === this.selectedElementId) : null;
    if (!element) {
      host.createDiv({ cls: "sm-le-empty", text: "W\xE4hle ein Element, um Details anzupassen." });
      return;
    }
    const isContainer = isContainerType(element.type);
    if (isContainer) {
      this.ensureContainerDefaults(element);
    }
    const parentContainer = !isContainer && element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    host.createDiv({ cls: "sm-le-meta", text: `Typ: ${getElementTypeLabel(element.type)}` });
    const labelField = host.createDiv({ cls: "sm-le-field" });
    labelField.createEl("label", { text: element.type === "label" ? "Text" : "Label" });
    const labelInput = labelField.createEl("textarea");
    labelInput.value = element.label;
    labelInput.rows = element.type === "textarea" ? 3 : 2;
    labelInput.oninput = () => {
      element.label = labelInput.value;
      this.syncElementElement(element);
      this.refreshExport();
    };
    if (!isContainer) {
      const containers = this.elements.filter((el) => isContainerType(el.type));
      if (containers.length) {
        const containerField = host.createDiv({ cls: "sm-le-field" });
        containerField.createEl("label", { text: "Container" });
        const parentSelect = containerField.createEl("select");
        parentSelect.createEl("option", { value: "", text: "Kein Container" });
        for (const container of containers) {
          const label = container.label || getElementTypeLabel(container.type);
          const option = parentSelect.createEl("option", { value: container.id, text: label });
          if (element.parentId === container.id) option.selected = true;
        }
        parentSelect.onchange = () => {
          const value = parentSelect.value || null;
          this.assignElementToContainer(element.id, value);
        };
      }
    }
    if (element.type === "label" || element.type === "box") {
      const descField = host.createDiv({ cls: "sm-le-field" });
      descField.createEl("label", { text: element.type === "box" ? "Beschreibung" : "Zusatztext" });
      const descInput = descField.createEl("textarea");
      descInput.value = element.description || "";
      descInput.rows = 3;
      descInput.oninput = () => {
        element.description = descInput.value || void 0;
        this.syncElementElement(element);
        this.refreshExport();
      };
    }
    if (element.type === "text-input" || element.type === "textarea" || element.type === "dropdown" || element.type === "search-dropdown") {
      const placeholderField = host.createDiv({ cls: "sm-le-field" });
      placeholderField.createEl("label", { text: "Platzhalter" });
      const placeholderInput = placeholderField.createEl("input", { attr: { type: "text" } });
      placeholderInput.value = element.placeholder || "";
      placeholderInput.oninput = () => {
        element.placeholder = placeholderInput.value || void 0;
        this.syncElementElement(element);
        this.refreshExport();
      };
      const defaultField = host.createDiv({ cls: "sm-le-field" });
      defaultField.createEl("label", { text: "Default-Wert" });
      if (element.type === "textarea") {
        const defaultTextarea = defaultField.createEl("textarea");
        defaultTextarea.rows = 3;
        defaultTextarea.value = element.defaultValue || "";
        defaultTextarea.oninput = () => {
          element.defaultValue = defaultTextarea.value || void 0;
          this.syncElementElement(element);
          this.refreshExport();
        };
      } else {
        const defaultInput = defaultField.createEl("input", { attr: { type: "text" } });
        defaultInput.value = element.defaultValue || "";
        defaultInput.oninput = () => {
          element.defaultValue = defaultInput.value || void 0;
          this.syncElementElement(element);
          this.refreshExport();
        };
      }
    }
    if (element.type === "dropdown" || element.type === "search-dropdown") {
      const optionsField = host.createDiv({ cls: "sm-le-field" });
      optionsField.createEl("label", { text: "Optionen (eine pro Zeile)" });
      const optionsInput = optionsField.createEl("textarea");
      optionsInput.rows = 4;
      optionsInput.value = (element.options || []).join("\n");
      optionsInput.oninput = () => {
        const lines = optionsInput.value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
        element.options = lines.length ? lines : void 0;
        this.syncElementElement(element);
        this.refreshExport();
      };
    }
    const attributesField = host.createDiv({ cls: "sm-le-field sm-le-field--attributes" });
    attributesField.createEl("label", { text: "Verkn\xFCpfte Attribute" });
    const attributesList = attributesField.createDiv({ cls: "sm-le-attributes" });
    for (const group of ATTRIBUTE_GROUPS) {
      const groupEl = attributesList.createDiv({ cls: "sm-le-attributes__group" });
      groupEl.createEl("div", { cls: "sm-le-attributes__group-title", text: group.label });
      for (const option of group.options) {
        const optionId = `${element.id}-${option.value}`;
        const row = groupEl.createDiv({ cls: "sm-le-attributes__option" });
        const checkbox = row.createEl("input", { attr: { type: "checkbox", id: optionId } });
        checkbox.checked = element.attributes.includes(option.value);
        checkbox.onchange = () => {
          if (checkbox.checked) {
            if (!element.attributes.includes(option.value)) {
              element.attributes.push(option.value);
            }
          } else {
            element.attributes = element.attributes.filter((v) => v !== option.value);
          }
          this.syncElementElement(element);
          this.refreshExport();
          this.refreshAttributePopover();
        };
        row.createEl("label", { text: option.label, attr: { for: optionId } });
      }
    }
    if (isContainerElement(element)) {
      const layoutField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
      layoutField.createEl("label", { text: "Abstand (px)" });
      const gapInput = layoutField.createEl("input", { attr: { type: "number", min: "0" } });
      gapInput.value = String(Math.round(element.layout.gap));
      gapInput.onchange = () => {
        const next = Math.max(0, parseInt(gapInput.value, 10) || 0);
        element.layout.gap = next;
        gapInput.value = String(next);
        this.applyContainerLayout(element);
      };
      layoutField.createEl("label", { text: "Innenabstand (px)" });
      const paddingInput = layoutField.createEl("input", { attr: { type: "number", min: "0" } });
      paddingInput.value = String(Math.round(element.layout.padding));
      paddingInput.onchange = () => {
        const next = Math.max(0, parseInt(paddingInput.value, 10) || 0);
        element.layout.padding = next;
        paddingInput.value = String(next);
        this.applyContainerLayout(element);
      };
      const alignField = host.createDiv({ cls: "sm-le-field" });
      alignField.createEl("label", { text: element.type === "vbox" ? "Horizontale Ausrichtung" : "Vertikale Ausrichtung" });
      const alignSelect = alignField.createEl("select");
      const alignOptions = element.type === "vbox" ? [
        ["start", "Links"],
        ["center", "Zentriert"],
        ["end", "Rechts"],
        ["stretch", "Breite strecken"]
      ] : [
        ["start", "Oben"],
        ["center", "Zentriert"],
        ["end", "Unten"],
        ["stretch", "H\xF6he strecken"]
      ];
      for (const [value, label] of alignOptions) {
        const option = alignSelect.createEl("option", { value, text: label });
        if (element.layout.align === value) option.selected = true;
      }
      alignSelect.onchange = () => {
        const next = alignSelect.value ?? element.layout.align;
        element.layout.align = next;
        this.applyContainerLayout(element);
      };
      const childField = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
      childField.createEl("label", { text: "Zugeordnete Elemente" });
      const addRow = childField.createDiv({ cls: "sm-le-container-add" });
      const addSelect = addRow.createEl("select");
      addSelect.createEl("option", { value: "", text: "Element ausw\xE4hlen\u2026" });
      const candidates = this.elements.filter((el) => el.id !== element.id && !isContainerType(el.type));
      for (const candidate of candidates) {
        const textBase = candidate.label || getElementTypeLabel(candidate.type);
        let optionText = textBase;
        if (candidate.parentId && candidate.parentId !== element.id) {
          const parentElement = this.elements.find((el) => el.id === candidate.parentId);
          if (parentElement) {
            const parentName = parentElement.label || getElementTypeLabel(parentElement.type);
            optionText = `${textBase} (in ${parentName})`;
          }
        }
        addSelect.createEl("option", { value: candidate.id, text: optionText });
      }
      const addButton = addRow.createEl("button", { text: "Hinzuf\xFCgen" });
      addButton.onclick = (ev) => {
        ev.preventDefault();
        const target = addSelect.value;
        if (target) {
          this.assignElementToContainer(target, element.id);
        }
      };
      const childList = childField.createDiv({ cls: "sm-le-container-children" });
      const children = Array.isArray(element.children) ? element.children.map((childId) => this.elements.find((el) => el.id === childId)).filter((child) => !!child) : [];
      if (!children.length) {
        childList.createDiv({ cls: "sm-le-empty", text: "Keine Elemente verkn\xFCpft." });
      } else {
        for (const [idx, child] of children.entries()) {
          const row = childList.createDiv({ cls: "sm-le-container-child" });
          row.createSpan({ cls: "sm-le-container-child__label", text: child.label || getElementTypeLabel(child.type) });
          const controls = row.createDiv({ cls: "sm-le-container-child__actions" });
          const upBtn = controls.createEl("button", { text: "\u2191", attr: { title: "Nach oben" } });
          upBtn.disabled = idx === 0;
          upBtn.onclick = (ev) => {
            ev.preventDefault();
            this.moveChildInContainer(element, child.id, -1);
          };
          const downBtn = controls.createEl("button", { text: "\u2193", attr: { title: "Nach unten" } });
          downBtn.disabled = idx === children.length - 1;
          downBtn.onclick = (ev) => {
            ev.preventDefault();
            this.moveChildInContainer(element, child.id, 1);
          };
          const removeBtn = controls.createEl("button", { text: "\u2715", attr: { title: "Entfernen" } });
          removeBtn.onclick = (ev) => {
            ev.preventDefault();
            this.assignElementToContainer(child.id, null);
          };
        }
      }
    }
    const actions = host.createDiv({ cls: "sm-le-actions" });
    const deleteBtn = actions.createEl("button", { text: "Element l\xF6schen" });
    deleteBtn.classList.add("mod-warning");
    deleteBtn.onclick = () => this.deleteElement(element.id);
    const dimsField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
    dimsField.createEl("label", { text: "Breite (px)" });
    const widthInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_ELEMENT_SIZE) } });
    widthInput.value = String(Math.round(element.width));
    widthInput.onchange = () => {
      const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
      const next = clamp(parseInt(widthInput.value, 10) || element.width, MIN_ELEMENT_SIZE, maxWidth);
      element.width = next;
      widthInput.value = String(next);
      this.syncElementElement(element);
      this.refreshExport();
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parentContainer && isContainerType(parentContainer.type)) {
        this.applyContainerLayout(parentContainer);
      }
    };
    dimsField.createEl("label", { text: "H\xF6he (px)" });
    const heightInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_ELEMENT_SIZE) } });
    heightInput.value = String(Math.round(element.height));
    heightInput.onchange = () => {
      const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
      const next = clamp(parseInt(heightInput.value, 10) || element.height, MIN_ELEMENT_SIZE, maxHeight);
      element.height = next;
      heightInput.value = String(next);
      this.syncElementElement(element);
      this.refreshExport();
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parentContainer && isContainerType(parentContainer.type)) {
        this.applyContainerLayout(parentContainer);
      }
    };
    const posField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
    posField.createEl("label", { text: "X-Position" });
    const posXInput = posField.createEl("input", { attr: { type: "number", min: "0" } });
    posXInput.value = String(Math.round(element.x));
    posXInput.onchange = () => {
      const maxX = Math.max(0, this.canvasWidth - element.width);
      const next = clamp(parseInt(posXInput.value, 10) || element.x, 0, maxX);
      element.x = next;
      posXInput.value = String(next);
      this.syncElementElement(element);
      this.refreshExport();
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parentContainer && isContainerType(parentContainer.type)) {
        this.applyContainerLayout(parentContainer);
      }
    };
    posField.createEl("label", { text: "Y-Position" });
    const posYInput = posField.createEl("input", { attr: { type: "number", min: "0" } });
    posYInput.value = String(Math.round(element.y));
    posYInput.onchange = () => {
      const maxY = Math.max(0, this.canvasHeight - element.height);
      const next = clamp(parseInt(posYInput.value, 10) || element.y, 0, maxY);
      element.y = next;
      posYInput.value = String(next);
      this.syncElementElement(element);
      this.refreshExport();
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parentContainer && isContainerType(parentContainer.type)) {
        this.applyContainerLayout(parentContainer);
      }
    };
    const meta = host.createDiv({ cls: "sm-le-meta" });
    meta.setText(`Fl\xE4che: ${Math.round(element.width * element.height)} px\xB2`);
  }
  deleteElement(id) {
    const index = this.elements.findIndex((b) => b.id === id);
    if (index === -1) return;
    const element = this.elements[index];
    this.elements.splice(index, 1);
    if (isContainerType(element.type) && Array.isArray(element.children)) {
      for (const childId of element.children) {
        const child = this.elements.find((el2) => el2.id === childId);
        if (child) {
          child.parentId = void 0;
          this.syncElementElement(child);
        }
      }
    }
    if (element.parentId) {
      const parent = this.elements.find((el2) => el2.id === element.parentId);
      if (parent) {
        this.removeChildFromContainer(parent, element.id);
        this.applyContainerLayout(parent);
      }
    }
    const el = this.elementElements.get(id);
    el?.remove();
    this.elementElements.delete(id);
    if (this.activeAttributePopover?.elementId === id) {
      this.closeAttributePopover();
    }
    if (this.selectedElementId === id) {
      this.selectedElementId = null;
    }
    this.renderInspector();
    this.refreshExport();
    this.updateStatus();
  }
  getElementDetails(element) {
    const parts = [];
    if (isContainerType(element.type)) {
      const layout = element.layout;
      const gap = layout ? Math.round(layout.gap) : 0;
      const alignLabel = layout ? getContainerAlignLabel(element.type, layout.align) : null;
      const count = element.children?.length ?? 0;
      parts.push(element.type === "vbox" ? "Vertikale Verteilung" : "Horizontale Verteilung");
      parts.push(`Abstand ${gap}px`);
      if (alignLabel) parts.push(alignLabel);
      parts.push(`${count} Elemente`);
    }
    if ((element.type === "label" || element.type === "box") && element.description) {
      parts.push(element.description);
    }
    if (element.type === "text-input" || element.type === "textarea") {
      if (element.placeholder) parts.push(`Platzhalter: ${element.placeholder}`);
      if (element.defaultValue) parts.push(`Default: ${element.defaultValue}`);
    }
    if (element.type === "dropdown" || element.type === "search-dropdown") {
      if (element.placeholder) parts.push(`Platzhalter: ${element.placeholder}`);
      if (element.defaultValue) parts.push(`Default: ${element.defaultValue}`);
      if (element.options && element.options.length) {
        const preview = element.options.slice(0, 3).join(", ");
        const suffix = element.options.length > 3 ? "\u2026" : "";
        parts.push(`Optionen: ${preview}${suffix}`);
      }
    }
    if (element.type === "separator") {
      parts.push("Trennlinie");
    }
    return parts.join(" \xB7 ");
  }
  getAttributeSummary(attributes) {
    if (!attributes.length) return "Attribute w\xE4hlen\u2026";
    return attributes.map((attr) => ATTRIBUTE_LABEL_LOOKUP.get(attr) ?? attr).join(", ");
  }
  detectElementTypeFromDom(node) {
    if (node.querySelector("hr")) return "separator";
    const select = node.querySelector("select");
    if (select instanceof HTMLSelectElement) {
      if (select.classList.contains("sm-sd") || select.dataset.sdOpenAll != null) {
        return "search-dropdown";
      }
      return "dropdown";
    }
    const textarea = node.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) return "textarea";
    const input = node.querySelector("input[type='text'], input[type='number'], input[type='search'], input[type='email'], input[type='url']");
    if (input instanceof HTMLInputElement) return "text-input";
    return "box";
  }
  extractElementDefaults(node, type) {
    const defaults = {};
    const desc = node.querySelector(".setting-item-description");
    if (desc?.textContent?.trim()) {
      defaults.description = desc.textContent.trim();
    }
    if (type === "text-input") {
      const input = node.querySelector("input[type='text'], input[type='number'], input[type='search'], input[type='email'], input[type='url']");
      if (input) {
        if (input.placeholder) defaults.placeholder = input.placeholder;
        if (input.value) defaults.defaultValue = input.value;
      }
    } else if (type === "textarea") {
      const textarea = node.querySelector("textarea");
      if (textarea) {
        if (textarea.placeholder) defaults.placeholder = textarea.placeholder;
        if (textarea.value) defaults.defaultValue = textarea.value;
      }
    } else if (type === "dropdown" || type === "search-dropdown") {
      const select = node.querySelector("select");
      if (select) {
        const options = Array.from(select.options).map((opt) => opt.textContent?.trim() || "").filter(Boolean);
        if (options.length) defaults.options = options;
        const selected = select.selectedOptions[0]?.textContent?.trim();
        if (selected) defaults.defaultValue = selected;
      }
    }
    return defaults;
  }
  refreshExport() {
    if (!this.exportEl) return;
    const payload = {
      canvas: { width: Math.round(this.canvasWidth), height: Math.round(this.canvasHeight) },
      elements: this.elements.map((element) => {
        const node = {
          id: element.id,
          type: element.type,
          label: element.label,
          x: Math.round(element.x),
          y: Math.round(element.y),
          width: Math.round(element.width),
          height: Math.round(element.height),
          attributes: [...element.attributes]
        };
        if (element.description) node.description = element.description;
        if (element.placeholder) node.placeholder = element.placeholder;
        if (element.defaultValue) node.defaultValue = element.defaultValue;
        if (element.options && element.options.length) node.options = [...element.options];
        if (element.parentId) node.parentId = element.parentId;
        if (isContainerType(element.type)) {
          if (element.layout) {
            node.layout = {
              gap: Math.round(element.layout.gap),
              padding: Math.round(element.layout.padding),
              align: element.layout.align
            };
          }
          if (element.children && element.children.length) {
            node.children = [...element.children];
          }
        }
        return node;
      })
    };
    this.exportEl.value = JSON.stringify(payload, null, 2);
  }
  updateStatus() {
    if (!this.statusEl) return;
    const info = `${this.elements.length} Elemente \xB7 ${Math.round(this.canvasWidth)} \xD7 ${Math.round(this.canvasHeight)} px`;
    this.statusEl.setText(info);
  }
  async importCreatureCreatorLayout(options) {
    if (this.isImporting) return;
    if (!this.sandboxEl) return;
    this.isImporting = true;
    this.importBtn?.addClass("is-loading");
    this.importBtn.disabled = true;
    try {
      const sandbox = this.sandboxEl;
      sandbox.empty();
      sandbox.addClass("sm-cc-create-modal");
      sandbox.createEl("h3", { text: "Neuen Statblock erstellen" });
      const data = { name: "Neue Kreatur" };
      mountCreatureBasicsSection(sandbox, data);
      mountCreatureStatsAndSkillsSection(sandbox, data);
      mountCreatureSensesAndDefensesSection(sandbox, data);
      mountEntriesSection(sandbox, data);
      mountSpellsKnownSection(sandbox, data, () => []);
      const actions = sandbox.createDiv({ cls: "setting-item sm-cc-actions" });
      actions.dataset.layoutLabel = "Aktionen";
      const actionsCtl = actions.createDiv({ cls: "setting-item-control" });
      actionsCtl.createEl("button", { text: "Abbrechen" });
      const createBtn = actionsCtl.createEl("button", { text: "Erstellen" });
      createBtn.addClass("mod-cta");
      await this.nextFrame();
      await this.nextFrame();
      const containerRect = sandbox.getBoundingClientRect();
      const margin = 48;
      const elements = [];
      const used = /* @__PURE__ */ new Set();
      let counter = 0;
      const pushElement = (element, label) => {
        if (!(element instanceof HTMLElement)) return;
        if (used.has(element)) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const x = rect.left - containerRect.left + margin;
        const y = rect.top - containerRect.top + margin;
        const width = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.width));
        const height = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.height));
        const type = this.detectElementTypeFromDom(element);
        const defaults = this.extractElementDefaults(element, type);
        elements.push({
          id: `creature-${String(++counter).padStart(2, "0")}`,
          type,
          x: Math.round(x),
          y: Math.round(y),
          width,
          height,
          label,
          description: defaults.description,
          placeholder: defaults.placeholder,
          defaultValue: defaults.defaultValue,
          options: defaults.options,
          attributes: []
        });
        used.add(element);
      };
      pushElement(sandbox.querySelector("h3"), "Titel");
      const basicsItems = Array.from(sandbox.querySelectorAll(".sm-cc-basics__grid .setting-item"));
      for (const el of basicsItems) {
        const name = el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
        pushElement(el, `Basics \xB7 ${name}`);
      }
      const statRows = Array.from(sandbox.querySelectorAll(".sm-cc-stat-row"));
      for (const row of statRows) {
        const label = row.querySelector(".sm-cc-stat-row__label")?.textContent?.trim() || "Stat";
        pushElement(row, `Stat \xB7 ${label}`);
      }
      const statsSettings = Array.from(sandbox.querySelectorAll(".sm-cc-stats > .setting-item"));
      for (const el of statsSettings) {
        const name = el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
        pushElement(el, `Stats \xB7 ${name}`);
      }
      const defenseSettings = Array.from(sandbox.querySelectorAll(".sm-cc-defenses .setting-item"));
      for (const el of defenseSettings) {
        const custom = el.dataset.layoutLabel;
        const name = custom || el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
        pushElement(el, `Defenses \xB7 ${name}`);
      }
      pushElement(sandbox.querySelector(".sm-cc-entries.setting-item"), "Eintr\xE4ge");
      pushElement(sandbox.querySelector(".sm-cc-spells.setting-item"), "Zauber");
      pushElement(actions, actions.dataset.layoutLabel || "Aktionen");
      elements.sort((a, b) => a.y - b.y || a.x - b.x);
      if (!elements.length) {
        throw new Error("Keine Layout-Elemente gefunden");
      }
      this.canvasWidth = Math.max(200, Math.round(containerRect.width) + margin * 2);
      this.canvasHeight = Math.max(200, Math.round(containerRect.height) + margin * 2);
      this.widthInput && (this.widthInput.value = String(this.canvasWidth));
      this.heightInput && (this.heightInput.value = String(this.canvasHeight));
      this.elements = elements;
      this.selectedElementId = null;
      this.applyCanvasSize();
      this.renderElements();
      this.renderInspector();
      this.refreshExport();
      this.updateStatus();
      if (!options?.silent) new import_obsidian22.Notice("Creature-Layout importiert");
    } catch (error) {
      console.error("importCreatureCreatorLayout", error);
      if (!options?.silent) new import_obsidian22.Notice("Konnte Creature-Layout nicht importieren");
    } finally {
      this.sandboxEl?.empty();
      this.importBtn?.removeClass("is-loading");
      if (this.importBtn) this.importBtn.disabled = false;
      this.isImporting = false;
    }
  }
  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
};
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function getElementTypeLabel(type) {
  return ELEMENT_DEFINITION_LOOKUP.get(type)?.buttonLabel ?? type;
}
function isContainerType(type) {
  return type === "vbox" || type === "hbox";
}
function isContainerElement(element) {
  return isContainerType(element.type) && !!element.layout && Array.isArray(element.children);
}
function getContainerAlignLabel(type, align) {
  if (type === "vbox") {
    switch (align) {
      case "start":
        return "Links ausgerichtet";
      case "center":
        return "Zentriert";
      case "end":
        return "Rechts ausgerichtet";
      case "stretch":
        return "Breite gestreckt";
    }
  } else {
    switch (align) {
      case "start":
        return "Oben ausgerichtet";
      case "center":
        return "Vertikal zentriert";
      case "end":
        return "Unten ausgerichtet";
      case "stretch":
        return "H\xF6he gestreckt";
    }
  }
  return "";
}

// src/app/main.ts
init_layout();

// src/app/css.ts
var HEX_PLUGIN_CSS = `
/* === Map-Container & SVG === */
.hex3x3-container {
    width: 100%;
    overflow: hidden;
}

.hex3x3-map {
    display: block;
    width: 100%;
    max-width: 700px;
    margin: .5rem 0;
    user-select: none;
    touch-action: none;
}

.hex3x3-map polygon {
    /* Basis: unbemalt transparent \u2014 Inline-Styles vom Renderer d\xFCrfen das \xFCberschreiben */
    fill: transparent;
    stroke: var(--text-muted);
    stroke-width: 2;
    cursor: pointer;
    transition: fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease;
}

/* Hover: nur den Rahmen highlighten */
.hex3x3-map polygon:hover { stroke: var(--interactive-accent); }

/* Optional: Hover-F\xFCllung nur f\xFCr unbemalte Tiles */
.hex3x3-map polygon:not([data-painted="1"]):hover { fill-opacity: .15; }

.hex3x3-map text {
    font-size: 12px;
    fill: var(--text-muted);
    pointer-events: none;
    user-select: none;
}

/* Brush-Widget (Kreis) */
.hex3x3-map circle {
    transition: opacity 120ms ease, r 120ms ease, cx 60ms ease, cy 60ms ease;
}

/* === Live-Preview: Interaktion im Codeblock erlauben (optional) === */
.markdown-source-view .cm-preview-code-block .hex3x3-container,
.markdown-source-view .cm-preview-code-block .hex3x3-map { pointer-events: auto; }
.markdown-source-view .cm-preview-code-block .edit-block-button { pointer-events: none; }

/* === Terrain Editor === */
.sm-terrain-editor { padding:.5rem 0; }
.sm-terrain-editor .desc { color: var(--text-muted); margin-bottom:.25rem; }
.sm-terrain-editor .rows { margin-top:.5rem; }
.sm-terrain-editor .row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.sm-terrain-editor .row input[type="text"] { flex:1; min-width:0; }
.sm-terrain-editor .addbar { display:flex; gap:.5rem; margin-top:.5rem; }
.sm-terrain-editor .addbar input[type="text"] { flex:1; min-width:0; }

/* Creature Compendium \u2013 nutzt die gleichen Layout-Hilfsklassen */
.sm-creature-compendium { padding:.5rem 0; }
.sm-creature-compendium .desc { color: var(--text-muted); margin-bottom:.25rem; }
.sm-creature-compendium .rows { margin-top:.5rem; }
.sm-creature-compendium .row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.sm-creature-compendium .row input[type="text"] { flex:1; min-width:0; }
.sm-creature-compendium .addbar { display:flex; gap:.5rem; margin-top:.5rem; }
.sm-creature-compendium .addbar input[type="text"] { flex:1; min-width:0; }

/* Creature Compendium \u2013 Search + list */
.sm-cc-searchbar { display:flex; gap:.5rem; margin:.5rem 0; }
.sm-cc-searchbar input[type="text"] { flex:1; min-width:0; }
.sm-cc-list { display:flex; flex-direction:column; gap:.25rem; margin-top:.25rem; }
.sm-cc-item { display:flex; gap:.5rem; align-items:center; justify-content:space-between; padding:.35rem .5rem; border:1px solid var(--background-modifier-border); border-radius:8px; background: var(--background-primary); }
.sm-cc-item__name { font-weight: 500; }

/* Creature Creator \u2013 Basics Section */
.sm-cc-basics { display:flex; flex-direction:column; gap:.75rem; }
.sm-cc-basics__grid { display:grid; gap:.75rem; grid-template-columns:repeat(4, minmax(0, 1fr)); align-items:stretch; }
.sm-cc-basics__grid-item { margin:0; height:100%; }
.sm-cc-basics__grid-item.setting-item { border:1px solid var(--background-modifier-border); border-radius:8px; background: var(--background-primary); padding:.6rem .65rem; display:flex; flex-direction:column; gap:.4rem; box-sizing:border-box; border-top:none; }
.sm-cc-basics__grid-item .setting-item-info { align-self:stretch; margin-right:0; }
.sm-cc-basics__grid-item .setting-item-name { font-weight:600; }
.sm-cc-basics__grid-item .setting-item-control { width:100%; margin-left:0; display:flex; flex-direction:column; gap:.35rem; }
.sm-cc-basics__grid-item select,
.sm-cc-basics__grid-item input[type="text"],
.sm-cc-basics__grid-item input[type="number"] { width:100%; box-sizing:border-box; }
.sm-cc-basics__grid-item--span-2 { grid-column:span 2; }
.sm-cc-basics__grid-item--span-3 { grid-column:span 3; }
.sm-cc-basics__grid-item--span-4 { grid-column:1 / -1; }
.sm-cc-basics__alignment-controls { display:grid; gap:.5rem; grid-template-columns:repeat(2, minmax(0, 1fr)); }
.sm-cc-basics__alignment-select { min-width:0; }
.sm-cc-basics__select { min-height:32px; }
.sm-cc-basics__text-input { min-height:32px; box-sizing:border-box; }
@media (max-width: 1080px) {
    .sm-cc-basics__grid { grid-template-columns:repeat(3, minmax(0, 1fr)); }
    .sm-cc-basics__grid-item--span-3,
    .sm-cc-basics__grid-item--span-4 { grid-column:1 / -1; }
}
@media (max-width: 860px) {
    .sm-cc-basics__grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
    .sm-cc-basics__grid-item--span-2 { grid-column:1 / -1; }
}
@media (max-width: 620px) {
    .sm-cc-basics__grid { grid-template-columns:minmax(0, 1fr); }
    .sm-cc-basics__alignment-controls { grid-template-columns:minmax(0, 1fr); }
}

/* Create Creature Modal helpers */
.sm-cc-create-modal .sm-cc-grid {
    display: grid;
    grid-template-columns: max-content 140px max-content;
    gap: .35rem .75rem;
    align-items: center;
    margin: .25rem 0 .5rem;
}
.sm-cc-grid__row { display: contents; }
.sm-cc-grid__save { display: flex; align-items: center; gap: .35rem; }

.sm-cc-skills { margin-top: .5rem; }
.sm-cc-skill-group { border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: .5rem; margin: .35rem 0; }
.sm-cc-skill-group__title { font-weight: 600; margin-bottom: .25rem; }
.sm-cc-skill { display: grid; grid-template-columns: 1fr max-content max-content; gap: .5rem; align-items: center; margin: .15rem 0; }

.sm-cc-chips { display:flex; gap:.35rem; flex-wrap:wrap; margin:.25rem 0 .5rem; }
.sm-cc-chip { display:inline-flex; align-items:center; gap:.25rem; border:1px solid var(--background-modifier-border); border-radius:999px; padding:.1rem .4rem; background: var(--background-secondary); }
.sm-cc-damage-row { align-items:center; }
.sm-cc-damage-type { display:inline-flex; align-items:center; gap:.35rem; flex-wrap:wrap; justify-content:flex-start; }
.sm-cc-damage-type__label { font-size:.85em; color: var(--text-muted); }
.sm-cc-damage-type__buttons { display:inline-flex; border:1px solid var(--background-modifier-border); border-radius:999px; overflow:hidden; background: var(--background-primary); }
.sm-cc-damage-type__btn { border:none; background:transparent; padding:.2rem .75rem; font-size:.85em; color: var(--text-muted); cursor:pointer; transition: background 120ms ease, color 120ms ease; }
.sm-cc-damage-type__btn:hover { color: var(--text-normal); }
.sm-cc-damage-type__btn.is-active { background: var(--interactive-accent); color: var(--text-on-accent, #fff); }
.sm-cc-damage-type__btn.is-active:hover { color: var(--text-on-accent, #fff); }
.sm-cc-damage-chips { margin-top:.25rem; }
.sm-cc-damage-chip { align-items:center; gap:.4rem; padding-right:.5rem; }
.sm-cc-damage-chip__name { font-weight:500; }
.sm-cc-damage-chip__badge { font-size:.75em; font-weight:600; border-radius:999px; padding:.1rem .45rem; text-transform:uppercase; letter-spacing:.03em; }
.sm-cc-damage-chip--res { border-color: rgba(37,99,235,.45); background-color: rgba(37,99,235,.08); }
.sm-cc-damage-chip--res { border-color: color-mix(in srgb, var(--interactive-accent) 45%, transparent); background-color: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-secondary)); }
.sm-cc-damage-chip--res .sm-cc-damage-chip__badge { background-color: rgba(37,99,235,.18); color:#2563eb; }
.sm-cc-damage-chip--res .sm-cc-damage-chip__badge { background-color: color-mix(in srgb, var(--interactive-accent) 22%, transparent); color: var(--interactive-accent); }
.sm-cc-damage-chip--imm { border-color: rgba(124,58,237,.45); background-color: rgba(124,58,237,.08); }
.sm-cc-damage-chip--imm { border-color: color-mix(in srgb, var(--color-purple, #7c3aed) 45%, transparent); background-color: color-mix(in srgb, var(--color-purple, #7c3aed) 12%, var(--background-secondary)); }
.sm-cc-damage-chip--imm .sm-cc-damage-chip__badge { background-color: rgba(124,58,237,.18); color:#7c3aed; }
.sm-cc-damage-chip--imm .sm-cc-damage-chip__badge { background-color: color-mix(in srgb, var(--color-purple, #7c3aed) 22%, transparent); color: var(--color-purple, #7c3aed); }
.sm-cc-damage-chip--vuln { border-color: rgba(234,88,12,.45); background-color: rgba(234,88,12,.08); }
.sm-cc-damage-chip--vuln { border-color: color-mix(in srgb, var(--color-orange, #ea580c) 45%, transparent); background-color: color-mix(in srgb, var(--color-orange, #ea580c) 12%, var(--background-secondary)); }
.sm-cc-damage-chip--vuln .sm-cc-damage-chip__badge { background-color: rgba(234,88,12,.18); color:#ea580c; }
.sm-cc-damage-chip--vuln .sm-cc-damage-chip__badge { background-color: color-mix(in srgb, var(--color-orange, #ea580c) 22%, transparent); color: var(--color-orange, #ea580c); }
.sm-cc-skill-editor { display:flex; flex-direction:column; gap:.35rem; }
.sm-cc-skill-search {
    display:flex;
    align-items:center;
    justify-content:flex-end;
    margin-left:auto;
    width:100%;
    max-width:420px;
}
.sm-cc-skill-search select,
.sm-cc-skill-search .sm-sd {
    flex:1 1 260px;
    min-width:220px;
}
.sm-cc-skill-search button {
    flex:0 0 auto;
}

.sm-cc-defenses .sm-cc-senses-block {
    border-top: 1px solid var(--background-modifier-border);
    margin-top: .65rem;
    padding-top: .65rem;
}
.sm-cc-defenses .sm-cc-senses-setting .setting-item-control {
    display: flex;
    justify-content: flex-end;
}
.sm-cc-defenses .sm-cc-senses-search {
    display: flex;
    align-items: center;
    gap: .35rem;
    justify-content: flex-end;
    margin-left: 0;
    width: auto;
}
.sm-cc-defenses .sm-cc-senses-search select,
.sm-cc-defenses .sm-cc-senses-search .sm-sd {
    flex: 0 0 280px;
    min-width: 280px;
    max-width: 280px;
}
.sm-cc-defenses .sm-cc-senses-search button {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: .2rem .45rem;
    min-width: 1.9rem;
    height: 1.9rem;
    border-radius: 4px;
    font-size: .85em;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
}
.sm-cc-skill-chips { gap:.45rem; }
.sm-cc-skill-chip { align-items:center; gap:.4rem; padding-right:.5rem; }
.sm-cc-skill-chip__name { font-weight:500; }
.sm-cc-skill-chip__mod { font-weight:600; color: var(--text-normal); }
.sm-cc-skill-chip__exp { display:inline-flex; align-items:center; gap:.25rem; font-size:.85em; color: var(--text-muted); }
.sm-cc-skill-chip__exp input { margin:0; }
.sm-cc-chip__remove { background:none; border:none; cursor:pointer; font-size:1rem; line-height:1; padding:0; color: var(--text-muted); }
.sm-cc-chip__remove:hover { color: var(--text-normal); }

/* Creature modal layout improvements */
.sm-cc-create-modal .setting-item-control { flex: 1 1 auto; min-width: 0; }
.sm-cc-create-modal textarea { width: 100%; min-height: 140px; }
.sm-cc-create-modal .sm-cc-entry-text { min-height: 180px; }
.sm-cc-create-modal .sm-cc-skill-group { width: 100%; box-sizing: border-box; }
.sm-cc-create-modal .sm-cc-searchbar { flex-wrap: wrap; }
.sm-cc-create-modal .sm-cc-searchbar > * { flex: 1 1 160px; min-width: 140px; }
.sm-cc-create-modal .sm-cc-damage-row > label,
.sm-cc-create-modal .sm-cc-damage-row .sm-cc-damage-type,
.sm-cc-create-modal .sm-cc-damage-row .sm-cc-damage-add { flex:0 0 auto; min-width:auto; }
.sm-cc-create-modal .sm-cc-damage-row .sm-cc-damage-select { flex:1 1 240px; min-width:200px; }
.sm-cc-create-modal .sm-cc-entry-grid { grid-template-columns: max-content 1fr max-content 1fr; column-gap: .75rem; row-gap: .35rem; align-items: center; }
.sm-cc-create-modal .sm-cc-entry-grid input, .sm-cc-create-modal .sm-cc-entry-grid select { width: 100%; max-width: 220px; box-sizing: border-box; }
.sm-cc-create-modal .sm-cc-entry-grid input[type="number"] { max-width: 100px; }
.sm-cc-create-modal .sm-cc-entry-grid input.sm-auto-tohit { max-width: 72px; }

/* Inline labels kept compact */
.sm-cc-create-modal label { font-size: 0.9em; color: var(--text-muted); margin-right: .25rem; }
.sm-cc-entry-head label { margin-right: .35rem; }
.sm-cc-create-modal .sm-cc-searchbar label { align-self: center; }

/* Ensure entry and spell controls stack vertically */
.sm-cc-create-modal .sm-cc-entries,
.sm-cc-create-modal .sm-cc-spells { display: block; }
.sm-cc-create-modal .sm-cc-entries .setting-item-info,
.sm-cc-create-modal .sm-cc-spells .setting-item-info { display: block; width: 100%; margin-bottom: .35rem; }
.sm-cc-create-modal .sm-cc-entries .setting-item-control,
.sm-cc-create-modal .sm-cc-spells .setting-item-control { display: flex; flex-direction: column; align-items: stretch; gap: .5rem; width: 100%; }
.sm-cc-create-modal .sm-cc-entries .sm-cc-searchbar,
.sm-cc-create-modal .sm-cc-spells .sm-cc-searchbar { width: 100%; }
.sm-cc-create-modal .setting-item-control > * { max-width: 100%; }

/* Entry header layout: [category | name (flex) | delete] */
.sm-cc-create-modal .sm-cc-entry-head {
    display: grid;
    grid-template-columns: max-content 1fr max-content;
    gap: .5rem;
    align-items: center;
}
.sm-cc-create-modal .sm-cc-entry-head select { width: auto; }
.sm-cc-create-modal .sm-cc-entry-name { width: 100%; min-width: 0; }

/* Table-like layout for Skills */
.sm-cc-create-modal .sm-cc-table { display: grid; gap: .35rem .5rem; align-items: center; }
.sm-cc-create-modal .sm-cc-row { display: contents; }
.sm-cc-create-modal .sm-cc-cell { align-self: center; }
.sm-cc-create-modal .sm-cc-header .sm-cc-cell { font-weight: 600; color: var(--text-muted); }

/* Ability score cards */
.sm-cc-create-modal .sm-cc-stats { display: flex; flex-direction: column; width: 100%; min-width: 0; }
.sm-cc-create-modal .sm-cc-stats-section { display: flex; flex-direction: column; gap: .05rem; width: 100%; box-sizing: border-box; }
.sm-cc-create-modal .sm-cc-stats-section__title { margin: 0; line-height: 1.3; }
.sm-cc-create-modal .sm-cc-stats-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, auto); align-items: stretch; gap: .12rem .4rem; margin: 0; width: 100%; box-sizing: border-box; }
.sm-cc-create-modal .sm-cc-stats-grid__header { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: .4rem; row-gap: .05rem; align-items: end; padding: 0; margin: 0; font-size: .85em; color: var(--text-muted); }
.sm-cc-create-modal .sm-cc-stats-grid__header-cell { display: flex; align-items: center; justify-content: flex-end; gap: .2rem; font-weight: 600; }
.sm-cc-create-modal .sm-cc-stats-grid__header-cell--save { gap: .25rem; }
.sm-cc-create-modal .sm-cc-stats-grid__header-save-mod { font-size: .78em; letter-spacing: .06em; text-transform: uppercase; min-width: 3ch; text-align: right; }
.sm-cc-create-modal .sm-cc-stats-grid__header-save-label { font-weight: 600; }
.sm-cc-create-modal .sm-cc-stats-col { display: flex; flex-direction: column; gap: .12rem; min-width: 0; }
.sm-cc-create-modal .sm-cc-stat-row { display: flex; align-items: center; gap: .15rem; padding: .18rem .28rem; border-radius: 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); width: 100%; box-sizing: border-box; }
.sm-cc-create-modal .sm-cc-stat-row__label { flex: 0 0 2.5rem; font-weight: 600; color: var(--text-normal); }
.sm-cc-create-modal .sm-cc-stat-row__score { flex: 0 0 auto; }
.sm-cc-create-modal .sm-cc-stat-row__mod-value { font-weight: 600; color: var(--text-normal); min-width: 3ch; text-align: right; margin-left: .08rem; }
.sm-cc-create-modal .sm-cc-stat-row__save { margin-left: .08rem; display: grid; grid-auto-flow: column; grid-auto-columns: max-content; align-items: center; gap: .1rem; }
.sm-cc-create-modal .sm-cc-stat-row__save-prof { display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; font-size: .85em; color: var(--text-muted); cursor: pointer; }
.sm-cc-create-modal .sm-cc-stat-row__save-prof input[type="checkbox"] { margin: 0; }
.sm-cc-create-modal .sm-cc-stat-row__save-mod { font-weight: 600; color: var(--text-normal); min-width: 3ch; text-align: right; }
@media (max-width: 700px) {
    .sm-cc-create-modal .sm-cc-stats-grid { grid-template-columns: minmax(0, 1fr); }
    .sm-cc-create-modal .sm-cc-stats-grid__header { grid-template-columns: minmax(0, 1fr); justify-items: flex-end; row-gap: .1rem; }
}

/* Compact inline number controls */
.sm-inline-number { display: inline-flex; align-items: center; gap: .2rem; }
.sm-inline-number input[type="number"] { width: 84px; }
.sm-cc-create-modal .sm-cc-stat-row .sm-inline-number { gap: .12rem; }
.sm-cc-create-modal .sm-cc-stat-row .sm-inline-number input[type="number"].sm-cc-stat-row__score-input {
    width: calc(2.2ch + 10px);
    min-width: calc(2.2ch + 10px);
    text-align: center;
    padding-inline: 0;
}
.btn-compact { padding: 0 .4rem; min-width: 1.5rem; height: 1.6rem; line-height: 1.2; }

/* Movement row should not overflow; children stay compact */
.sm-cc-create-modal .sm-cc-move-ctl { display: flex; flex-direction: column; align-items: stretch; gap: .35rem; }
.sm-cc-create-modal .sm-cc-move-row { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
.sm-cc-create-modal .sm-cc-move-row .sm-sd { flex:1 1 220px; min-width:200px; }
.sm-cc-create-modal .sm-cc-move-row select { max-width: 220px; }
.sm-cc-create-modal .sm-cc-move-hover { display:inline-flex; align-items:center; gap:.35rem; flex:0 0 auto; }
.sm-cc-create-modal .sm-cc-move-hover input { margin:0; }
.sm-cc-create-modal .sm-cc-move-row .sm-inline-number { flex:0 0 auto; }
.sm-cc-create-modal .sm-cc-move-add { margin-left:auto; flex:0 0 auto; }

/* Entry auto compute groups */
.sm-cc-create-modal .sm-cc-auto { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; }
.sm-cc-create-modal .sm-auto-group { display: inline-flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
.sm-cc-create-modal .sm-auto-tohit { width: 72px; }
.sm-cc-create-modal .sm-auto-dmg { width: 220px; }

/* Select with search */
.sm-cc-create-modal .sm-select-wrap { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
.sm-cc-create-modal .sm-select-search { width: 100%; }

/* Preset typeahead menu */
.sm-cc-create-modal .sm-preset-box { position: relative; }
.sm-cc-create-modal .sm-preset-input { width: 100%; }
.sm-cc-create-modal .sm-preset-menu {
    position: absolute; left: 0; right: 0; top: calc(100% + 4px);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: .25rem;
    display: none;
    max-height: 240px; overflow: auto; z-index: 1000;
}
.sm-cc-create-modal .sm-preset-box.is-open .sm-preset-menu { display: block; }
.sm-cc-create-modal .sm-preset-item { padding: .25rem .35rem; border-radius: 6px; cursor: pointer; }
.sm-cc-create-modal .sm-preset-item:hover { background: var(--background-secondary); }

/* Such-dropdown (SearchDropdown) */
.sm-sd { position: relative; display: inline-block; width: auto; min-width: 0; }
.sm-sd__input { width: 100%; }
.sm-sd__menu { position: absolute; left: 0; right: 0; top: calc(100% + 4px); background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: .25rem; display: none; max-height: 240px; overflow: auto; z-index: 1000; }
.sm-sd.is-open .sm-sd__menu { display: block; }
.sm-sd__item { padding: .25rem .35rem; border-radius: 6px; cursor: pointer; }
.sm-sd__item.is-active, .sm-sd__item:hover { background: var(--background-secondary); }

/* Creature terrain picker */
.sm-cc-create-modal .sm-cc-auto { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.sm-cc-create-modal .sm-cc-auto select { min-width: 160px; }
.sm-cc-create-modal .sm-cc-auto input[type="text"] { min-width: 160px; }

/* Creature terrain picker */
.sm-cc-terrains { position: relative; }
.sm-cc-terrains__trigger {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
}
.sm-cc-terrains__menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0.35rem 0.5rem;
    display: none;
    min-width: 220px;
    max-height: 220px;
    overflow: auto;
    z-index: 1000;
}
.sm-cc-terrains.is-open .sm-cc-terrains__menu { display: block; }
.sm-cc-terrains__item { display: flex; align-items: center; gap: .5rem; padding: .15rem 0; }

/* Region Compendium */
.sm-region-compendium { padding:.5rem 0; }
.sm-region-compendium .desc { color: var(--text-muted); margin-bottom:.25rem; }
.sm-region-compendium .rows { margin-top:.5rem; }
.sm-region-compendium .row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.sm-region-compendium .row input[type="text"] { flex:1; min-width:0; }
.sm-region-compendium .addbar { display:flex; gap:.5rem; margin-top:.5rem; }
.sm-region-compendium .addbar input[type="text"] { flex:1; min-width:0; }

/* === Cartographer Shell === */
.cartographer-host {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.sm-cartographer {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    height: 100%;
    min-height: 100%;
    gap: 1rem;
    padding: 1rem;
    box-sizing: border-box;
}

.sm-cartographer__header {
    padding-bottom: 0.25rem;
}

.sm-cartographer__header .sm-map-header {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 0.75rem;
    gap: 0.5rem;
}

.sm-cartographer__header .sm-map-header h2 {
    margin: 0;
}

.sm-cartographer__header .sm-map-header .sm-map-header__secondary-left {
    margin-left: auto;
    margin-right: 0;
}

.sm-cartographer__body {
    display: flex;
    flex: 1 1 auto;
    gap: 1.25rem;
    align-items: stretch;
    width: 100%;
    min-height: 0;
}

.sm-cartographer__map {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    position: relative;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    padding: 0.75rem;
    box-sizing: border-box;
}

.sm-cartographer__map .hex3x3-map {
    height: 100%;
    max-width: none;
}

.sm-cartographer__sidebar {
    flex: 0 0 280px;
    max-width: 320px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 1rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-cartographer__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
}

.sm-cartographer__mode-switch {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
}

.sm-cartographer__mode-switch button {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
}

.sm-cartographer__mode-switch button.is-active {
    background: var(--interactive-accent, var(--color-accent));
    color: var(--text-on-accent, #fff);
}

/* Mode Dropdown */
.sm-mode-dropdown {
    position: relative;
}

.sm-mode-dropdown__trigger {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
}

.sm-mode-dropdown__menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0.25rem;
    min-width: 160px;
    display: none;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 1000;
}

.sm-mode-dropdown.is-open .sm-mode-dropdown__menu {
    display: flex;
}

.sm-mode-dropdown__item {
    border: none;
    background: transparent;
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
}

.sm-mode-dropdown__item:hover {
    background: var(--background-modifier-hover);
}

.sm-mode-dropdown__item.is-active {
    background: var(--interactive-accent, var(--color-accent));
    color: var(--text-on-accent, #fff);
}

/* === Cartographer Panels (Editor & Inspector) === */

/* Library header */
.sm-library .sm-lib-header { display:flex; gap:.4rem; margin:.25rem 0 .25rem; }
.sm-library .sm-lib-header button { border: 1px solid var(--background-modifier-border); background: var(--background-secondary); padding:.25rem .75rem; border-radius:6px; cursor:pointer; }
.sm-library .sm-lib-header button.is-active { background: var(--interactive-accent); color: var(--text-on-accent,#fff); }
.sm-cartographer__panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-cartographer__panel h3 {
    margin: 0;
}

.sm-cartographer__panel.is-disabled {
    opacity: 0.6;
    pointer-events: none;
}

.sm-cartographer__panel-info {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-cartographer__panel-file {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-cartographer__panel-tools {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sm-cartographer__panel-tools label {
    font-weight: 600;
}

.sm-cartographer__panel-tools select {
    flex: 1 1 auto;
}

.sm-cartographer__panel-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-cartographer__panel-status {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-cartographer__panel-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-cartographer__panel-row label {
    font-weight: 600;
}

.sm-cartographer__panel-row select,
.sm-cartographer__panel-row textarea {
    width: 100%;
    border-radius: 6px;
}

.sm-cartographer__panel-row textarea {
    resize: vertical;
}

/* === Travel Mode (Cartographer & Legacy Shell) === */
.sm-cartographer--travel {
    --tg-color-token: var(--color-purple, #9c6dfb);
    --tg-color-user-anchor: var(--color-orange, #f59e0b);
    --tg-color-auto-point: var(--color-blue, #3b82f6);
}

.sm-cartographer__sidebar--travel {
    gap: 1rem;
}

.sm-cartographer__travel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
}

.sm-cartographer__travel-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
}

.sm-cartographer__travel-buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

.sm-cartographer__travel-clock {
    font-weight: 600;
    margin-right: .5rem;
}

.sm-cartographer__travel-tempo {
    display: flex;
    align-items: center;
    gap: .35rem;
    margin-left: auto;
}

.sm-cartographer__travel-button {
    font-weight: 600;
}

.sm-cartographer__travel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.sm-cartographer__travel-label {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-cartographer__travel-value {
    font-size: 1rem;
    font-weight: 600;
}

.sm-cartographer__travel-input {
    width: 100%;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
}

.sm-cartographer--travel .tg-token__circle {
    fill: var(--tg-color-token);
    opacity: 0.95;
    stroke: var(--background-modifier-border);
    stroke-width: 3;
    transition: opacity 120ms ease;
}

.sm-cartographer--travel .tg-route-dot {
    transition: opacity 120ms ease, r 120ms ease, stroke 120ms ease;
}

.sm-cartographer--travel .tg-route-dot--user {
    fill: var(--tg-color-user-anchor);
    opacity: 0.95;
}

.sm-cartographer--travel .tg-route-dot--auto {
    fill: var(--tg-color-auto-point);
    opacity: 0.55;
}

.sm-cartographer--travel .tg-route-dot-hitbox {
    fill: transparent;
    stroke: transparent;
}

.sm-cartographer--travel .tg-route-dot--user.is-highlighted {
    opacity: 1;
}

.sm-cartographer--travel .tg-route-dot--auto.is-highlighted {
    opacity: 0.9;
}

.sm-cartographer--travel .hex3x3-map circle[data-token] { opacity: .95; }
.sm-cartographer--travel .hex3x3-map polyline { pointer-events: none; }

/* === Layout Editor === */
.sm-layout-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem 1rem 1.5rem;
}

.sm-le-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
}

.sm-le-header h2 {
    margin: 0;
}

.sm-le-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
}

.sm-le-control {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 120px;
}

.sm-le-control--stack {
    min-width: 220px;
}

.sm-le-control label {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.sm-le-size {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-le-add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.sm-le-status {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-le-body {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-start;
}

.sm-le-stage {
    flex: 1 1 520px;
    display: flex;
    justify-content: center;
}

.sm-le-canvas {
    position: relative;
    border: 1px dashed var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

.sm-le-box {
    position: absolute;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
    border: 2px solid transparent;
    cursor: default;
    transition: box-shadow 120ms ease, border-color 120ms ease;
}

.sm-le-box--container {
    border-style: dashed;
    border-color: var(--interactive-accent);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.05)), var(--background-primary);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
}

.sm-le-box--container .sm-le-box__type {
    color: var(--interactive-accent);
}

.sm-le-box--container .sm-le-box__footer {
    color: var(--text-muted);
}

.sm-le-box.is-selected {
    border-color: var(--interactive-accent);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.25);
}

.sm-le-box__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.5rem;
    gap: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    cursor: grab;
    user-select: none;
}

.sm-le-box__handle {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-le-box__dims {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.sm-le-box__body {
    flex: 1;
    padding: 0.5rem 0.6rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-le-box__type {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
}

.sm-le-box__label {
    font-weight: 600;
}

.sm-le-box__details {
    font-size: 0.9rem;
    color: var(--text-muted);
    white-space: pre-wrap;
}

.sm-le-box__footer {
    padding: 0 0.6rem 0.5rem;
    font-size: 0.75rem;
    color: var(--text-faint);
    display: flex;
    justify-content: flex-start;
}

.sm-le-box__attrs {
    display: block;
    white-space: normal;
    width: 100%;
}

.sm-le-box__attrs.is-editable {
    cursor: pointer;
    transition: color 120ms ease;
}

.sm-le-box__attrs.is-editable:hover,
.sm-le-box__attrs.is-editable:focus-visible {
    color: var(--interactive-accent);
}

.sm-le-box__attrs.is-empty {
    font-style: italic;
    color: var(--text-muted);
}

.sm-le-box__resize {
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    right: 0.25rem;
    bottom: 0.25rem;
    cursor: se-resize;
    background: rgba(0, 0, 0, 0.08);
    display: grid;
    place-items: center;
}

.sm-le-box__resize::after {
    content: "";
    width: 10px;
    height: 10px;
    border-right: 2px solid var(--text-muted);
    border-bottom: 2px solid var(--text-muted);
}

.sm-le-inspector {
    flex: 0 0 280px;
    min-width: 260px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-le-inspector h3 {
    margin: 0;
}

.sm-le-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-le-field label {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.sm-le-field textarea,
.sm-le-field input {
    width: 100%;
    box-sizing: border-box;
}

.sm-le-field--attributes {
    gap: 0.5rem;
}

.sm-le-field--stack {
    gap: 0.6rem;
}

.sm-le-attributes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-attributes__group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.35rem 0.4rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}

.sm-le-attributes__group-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
}

.sm-le-attributes__option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-le-attributes__option input {
    margin: 0;
}

.sm-le-container-add {
    display: flex;
    gap: 0.35rem;
    align-items: center;
}

.sm-le-container-add select {
    flex: 1;
}

.sm-le-container-add button {
    white-space: nowrap;
}

.sm-le-container-children {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-container-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
}

.sm-le-container-child__label {
    font-size: 0.85rem;
    font-weight: 500;
}

.sm-le-container-child__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.sm-le-container-child__actions button {
    padding: 0.1rem 0.4rem;
    font-size: 0.75rem;
}

.sm-le-field--grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    align-items: end;
}

.sm-le-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.sm-le-empty {
    color: var(--text-muted);
    font-size: 0.9rem;
}

.sm-le-meta {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-le-attr-popover {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 240px;
}

.sm-le-attr-popover__heading {
    font-weight: 600;
    font-size: 0.9rem;
}

.sm-le-attr-popover__hint {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.sm-le-attr-popover__clear {
    align-self: flex-end;
    font-size: 0.75rem;
}

.sm-le-attr-popover__scroll {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-attr-popover__group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}

.sm-le-attr-popover__group-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
}

.sm-le-attr-popover__option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
}

.sm-le-export {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-le-export__controls {
    display: flex;
    justify-content: flex-end;
}

.sm-le-export__textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-monospace);
    min-height: 160px;
}

.sm-le-sandbox {
    position: absolute;
    top: -10000px;
    left: -10000px;
    visibility: hidden;
    pointer-events: none;
}

@media (max-width: 860px) {
    .sm-le-inspector {
        flex: 1 1 100%;
    }

    .sm-le-stage {
        flex: 1 1 100%;
    }
}

`;

// src/app/main.ts
var SaltMarcherPlugin = class extends import_obsidian23.Plugin {
  async onload() {
    this.registerView(VIEW_CARTOGRAPHER, (leaf) => new CartographerView(leaf));
    this.registerView(VIEW_ENCOUNTER, (leaf) => new EncounterView(leaf));
    this.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf));
    this.registerView(VIEW_LAYOUT_EDITOR, (leaf) => new LayoutEditorView(leaf));
    await ensureTerrainFile(this.app);
    setTerrains(await loadTerrains(this.app));
    this.unwatchTerrains = watchTerrains(this.app, () => {
    });
    this.addRibbonIcon("compass", "Open Cartographer", async () => {
      const leaf = getCenterLeaf(this.app);
      await leaf.setViewState({ type: VIEW_CARTOGRAPHER, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    this.addRibbonIcon("book", "Open Library", async () => {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    this.addRibbonIcon("layout-grid", "Open Layout Editor", async () => {
      const leaf = getCenterLeaf(this.app);
      await leaf.setViewState({ type: VIEW_LAYOUT_EDITOR, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    this.addCommand({
      id: "open-cartographer",
      name: "Cartographer \xF6ffnen",
      callback: async () => {
        const leaf = getCenterLeaf(this.app);
        await leaf.setViewState({ type: VIEW_CARTOGRAPHER, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });
    this.addCommand({
      id: "open-library",
      name: "Library \xF6ffnen",
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });
    this.addCommand({
      id: "open-layout-editor",
      name: "Layout Editor \xF6ffnen",
      callback: async () => {
        const leaf = getCenterLeaf(this.app);
        await leaf.setViewState({ type: VIEW_LAYOUT_EDITOR, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });
    this.injectCss();
  }
  onunload() {
    this.unwatchTerrains?.();
    this.removeCss();
  }
  injectCss() {
    const style = document.createElement("style");
    style.id = "hex-css";
    style.textContent = HEX_PLUGIN_CSS;
    document.head.appendChild(style);
  }
  removeCss() {
    document.getElementById("hex-css")?.remove();
  }
};
