"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/app/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SaltMarcherPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian12 = require("obsidian");

// src/apps/map-gallery.ts
var import_obsidian8 = require("obsidian");

// src/core/layout.ts
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

// src/apps/map-editor/index.ts
var import_obsidian6 = require("obsidian");

// src/apps/map-editor/editor-ui.ts
var import_obsidian5 = require("obsidian");

// src/ui/map-workflows.ts
var import_obsidian4 = require("obsidian");

// src/core/hex-mapper/hex-notes.ts
var import_obsidian = require("obsidian");

// src/core/options.ts
function parseOptions(src) {
  const d = { folder: "Hexes", prefix: "hex", radius: 42 };
  const lines = src.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = /^([a-zA-Z]+)\s*:\s*(.+)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === "folder") d.folder = v;
    else if (k === "prefix") d.prefix = v;
    else if (k === "radius") {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 10) d.radius = n;
    }
  }
  return d;
}

// src/core/hex-mapper/hex-notes.ts
var FM_TYPE = "hex";
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
  const path = (0, import_obsidian.normalizePath)(folderPath);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing && existing instanceof import_obsidian.TFolder) return existing;
  if (existing) throw new Error(`Pfad existiert, ist aber kein Ordner: ${path}`);
  await app.vault.createFolder(path);
  const created = app.vault.getAbstractFileByPath(path);
  if (!(created && created instanceof import_obsidian.TFolder)) throw new Error(`Ordner konnte nicht erstellt werden: ${path}`);
  return created;
}
function fm(app, file) {
  return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
}
function buildMarkdown(coord, mapPath, folderPrefix, data) {
  const terrain = data.terrain ?? "";
  const mapName = mapNameFromPath(mapPath);
  const bodyNote = (data.note ?? "Notizen hier \u2026").trim();
  return [
    "---",
    `type: ${FM_TYPE}`,
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
  const folderPath = (0, import_obsidian.normalizePath)(folder);
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
  const folderPath = (0, import_obsidian.normalizePath)(folder);
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
    f.row = coord.r;
    f.col = coord.c;
    f.map_path = mapPath;
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

// src/core/map-maker.ts
async function createHexMapFile(app, rawName, opts = { folder: "Hexes", folderPrefix: "Hex", radius: 42 }) {
  const name = sanitizeFileName(rawName) || "Neue Hex Map";
  const content = buildHexMapMarkdown(name, opts);
  const path = await ensureUniquePath(app, `${name}.md`);
  const file = await app.vault.create(path, content);
  await initTilesForNewMap(app, file);
  return file;
}
function buildHexMapMarkdown(name, opts) {
  const folder = (opts.folder ?? "Hexes").toString();
  const folderPrefix = (opts.folderPrefix ?? opts.prefix ?? "Hex").toString();
  const radius = typeof opts.radius === "number" ? opts.radius : 42;
  return [
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
var import_obsidian3 = require("obsidian");

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
  if (mapFile instanceof import_obsidian3.TFile) {
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
    if (file instanceof import_obsidian3.TFile) {
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

// src/ui/map-workflows.ts
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
    new import_obsidian4.Notice(options?.emptyMessage ?? "Keine Karten gefunden.");
    return;
  }
  new MapSelectModal(app, files, async (file) => {
    await onSelect(file);
  }).open();
}
function promptCreateMap(app, onCreate, options) {
  new NameInputModal(app, async (name) => {
    const file = await createHexMapFile(app, name);
    new import_obsidian4.Notice(options?.successMessage ?? "Karte erstellt.");
    await onCreate(file);
  }).open();
}
async function renderHexMapFromFile(app, host, file, options) {
  const container = host.createDiv({ cls: options?.containerClass ?? "hex3x3-container" });
  Object.assign(container.style, { width: "100%", height: "100%" }, options?.containerStyle ?? {});
  const block = await getFirstHexBlock(app, file);
  if (!block) {
    container.createEl("div", {
      text: options?.missingBlockMessage ?? "Kein hex3x3-Block in dieser Datei."
    });
    return null;
  }
  const parsed = parseOptions(block);
  const handles = await renderHexMap(app, container, parsed, file.path);
  return { host: container, options: parsed, handles };
}

// src/apps/map-editor/brush-circle.ts
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

// src/apps/map-editor/terrain-brush/brush-math.ts
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

// src/apps/map-editor/terrain-brush/brush.ts
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
    await saveTile(app, mapFile, coord, { terrain });
    const color = TERRAIN_COLORS[terrain] ?? "transparent";
    handles.setFill(coord, color);
  }
}

// src/apps/map-editor/terrain-brush/brush-options.ts
function createBrushTool() {
  let state2 = {
    radius: 1,
    // UI zeigt 1 = nur Mitte
    terrain: "Wald",
    mode: "paint"
  };
  const eff = () => Math.max(0, state2.radius - 1);
  let circle = null;
  return {
    id: "brush",
    label: "Brush",
    // Options-Panel (nur UI & State)
    mountPanel(root, ctx) {
      root.createEl("h3", { text: "Terrain-Brush" });
      const radiusRow = root.createDiv({ cls: "sm-row" });
      radiusRow.createEl("label", { text: "Radius:" });
      const radiusInput = radiusRow.createEl("input", {
        attr: { type: "range", min: "1", max: "6", step: "1" }
      });
      radiusInput.value = String(state2.radius);
      const radiusVal = radiusRow.createEl("span", { text: radiusInput.value });
      radiusInput.oninput = () => {
        state2.radius = Number(radiusInput.value);
        radiusVal.textContent = radiusInput.value;
        circle?.updateRadius(eff());
      };
      const terrRow = root.createDiv({ cls: "sm-row" });
      terrRow.createEl("label", { text: "Terrain:" });
      const terrSelect = terrRow.createEl("select");
      const editBtn = terrRow.createEl("button", { text: "Bearbeiten\u2026" });
      editBtn.onclick = () => ctx.app.commands?.executeCommandById?.("salt-marcher:open-terrain-editor");
      const fillOptions = () => {
        terrSelect.empty();
        for (const t of Object.keys(TERRAIN_COLORS)) {
          const opt = terrSelect.createEl("option", { text: t || "(leer)" });
          opt.value = t;
        }
        if (TERRAIN_COLORS[state2.terrain] === void 0) state2.terrain = "";
        terrSelect.value = state2.terrain;
      };
      fillOptions();
      terrSelect.onchange = () => {
        state2.terrain = terrSelect.value;
      };
      const ref = ctx.app.workspace.on?.("salt:terrains-updated", fillOptions);
      const modeRow = root.createDiv({ cls: "sm-row" });
      modeRow.createEl("label", { text: "Modus:" });
      const modeSelect = modeRow.createEl("select");
      modeSelect.createEl("option", { text: "Malen", value: "paint" });
      modeSelect.createEl("option", { text: "L\xF6schen", value: "erase" });
      modeSelect.value = state2.mode;
      modeSelect.onchange = () => {
        state2.mode = modeSelect.value;
      };
      return () => {
        if (ref) ctx.app.workspace.offref?.(ref);
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
        { initialRadius: eff(), hexRadiusPx: ctx.getOpts().radius }
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
        { initialRadius: eff(), hexRadiusPx: ctx.getOpts().radius }
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
      if (state2.mode === "paint") {
        const missing = targets.filter((k) => !handles.polyByCoord.has(`${k.r},${k.c}`));
        if (missing.length) handles.ensurePolys?.(missing);
      }
      await applyBrush(
        ctx.app,
        file,
        rc,
        { radius: eff(), terrain: state2.terrain, mode: state2.mode },
        // Distanz reinschreiben
        handles
      );
      return true;
    }
  };
}

// src/apps/map-editor/inspektor/inspektor-options.ts
function createInspectorTool() {
  let sel = null;
  let ui = {};
  let saveTimer = null;
  function scheduleSave(ctx) {
    if (!sel) return;
    const file = ctx.getFile();
    if (!file) return;
    const handles = ctx.getHandles();
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      const terrain = ui.terr?.value ?? "";
      const note = ui.note?.value ?? "";
      await saveTile(ctx.app, file, sel, { terrain, note });
      const color = TERRAIN_COLORS[terrain] ?? "transparent";
      handles?.setFill(sel, color);
    }, 250);
  }
  async function loadSelection(ctx) {
    if (!sel) return;
    const file = ctx.getFile();
    if (!file) return;
    const data = await loadTile(ctx.app, file, sel);
    if (ui.terr) ui.terr.value = data?.terrain ?? "";
    if (ui.note) ui.note.value = data?.note ?? "";
  }
  return {
    id: "inspektor",
    label: "Inspektor",
    mountPanel(root, ctx) {
      root.createEl("h3", { text: "Inspektor" });
      const terrRow = root.createDiv({ cls: "sm-row" });
      terrRow.createEl("label", { text: "Terrain:" });
      ui.terr = terrRow.createEl("select");
      for (const t of Object.keys(TERRAIN_COLORS)) {
        const opt = ui.terr.createEl("option", { text: t || "(leer)" });
        opt.value = t;
      }
      ui.terr.disabled = true;
      ui.terr.onchange = () => scheduleSave(ctx);
      const noteRow = root.createDiv({ cls: "sm-row" });
      noteRow.createEl("label", { text: "Notiz:" });
      ui.note = noteRow.createEl("textarea", { attr: { rows: "6" } });
      ui.note.disabled = true;
      ui.note.oninput = () => scheduleSave(ctx);
      return () => {
        root.empty();
        ui = {};
        sel = null;
        if (saveTimer) window.clearTimeout(saveTimer);
      };
    },
    onActivate() {
    },
    onDeactivate() {
    },
    onMapRendered() {
    },
    async onHexClick(rc, ctx) {
      sel = rc;
      if (ui.terr) ui.terr.disabled = false;
      if (ui.note) ui.note.disabled = false;
      await loadSelection(ctx);
      return true;
    }
  };
}

// src/core/save.ts
async function saveMap(_app, file) {
  console.warn("[save] saveMap() not implemented. File:", file.path);
}
async function saveMapAs(_app, file) {
  console.warn("[save] saveMapAs() not implemented. File:", file.path);
}

// src/apps/map-editor/editor-ui.ts
function mountMapEditor(app, host, init) {
  host.empty();
  Object.assign(host.style, { display: "flex", flexDirection: "column", height: "100%", gap: ".5rem" });
  const state2 = { file: null, opts: null, handles: null, tool: null, cleanupPanel: null };
  const header = host.createDiv({ cls: "map-editor-header" });
  Object.assign(header.style, { display: "flex", flexDirection: "column", gap: ".4rem" });
  const r1 = header.createDiv();
  Object.assign(r1.style, { display: "flex", alignItems: "center", gap: ".5rem" });
  r1.createEl("h2", { text: "Map Editor" }).style.marginRight = "auto";
  const btnOpen = r1.createEl("button", { text: "Open Map" });
  (0, import_obsidian5.setIcon)(btnOpen, "folder-open");
  applyMapButtonStyle(btnOpen);
  btnOpen.onclick = () => {
    void promptMapSelection(app, async (f) => {
      await setFile(f);
    });
  };
  const btnPlus = r1.createEl("button");
  btnPlus.append(" ", "+");
  (0, import_obsidian5.setIcon)(btnPlus, "plus");
  applyMapButtonStyle(btnPlus);
  btnPlus.onclick = () => {
    promptCreateMap(app, async (file) => {
      await setFile(file);
    });
  };
  const r2 = header.createDiv();
  Object.assign(r2.style, { display: "flex", alignItems: "center", gap: ".5rem" });
  const nameBox = r2.createEl("div", { text: "\u2014" });
  Object.assign(nameBox.style, { marginRight: "auto", opacity: ".85" });
  const saveSelect = r2.createEl("select");
  saveSelect.createEl("option", { text: "Speichern" }).value = "save";
  saveSelect.createEl("option", { text: "Speichern als" }).value = "saveAs";
  const saveBtn = r2.createEl("button", { text: "Los" });
  applyMapButtonStyle(saveBtn);
  saveBtn.onclick = async () => {
    if (!state2.file) return new import_obsidian5.Notice("Keine Karte ausgew\xE4hlt.");
    try {
      if (saveSelect.value === "save") await saveMap(app, state2.file);
      else await saveMapAs(app, state2.file);
      new import_obsidian5.Notice("Gespeichert.");
    } catch (e) {
      console.error(e);
      new import_obsidian5.Notice("Speichern fehlgeschlagen.");
    }
  };
  const body = host.createDiv();
  Object.assign(body.style, { display: "flex", gap: ".5rem", minHeight: "300px", flex: "1 1 auto" });
  const mapPane = body.createDiv();
  Object.assign(mapPane.style, {
    flex: "1 1 auto",
    overflow: "hidden",
    border: "1px solid var(--background-modifier-border)",
    borderRadius: "8px"
  });
  const optionsPane = body.createDiv();
  Object.assign(optionsPane.style, {
    flex: "0 0 auto",
    minWidth: "220px",
    maxWidth: "360px",
    width: "280px",
    border: "1px solid var(--background-modifier-border)",
    borderRadius: "8px",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: ".5rem"
  });
  const optHeader = optionsPane.createDiv();
  Object.assign(optHeader.style, { display: "flex", alignItems: "center", gap: ".5rem" });
  const optName = optHeader.createEl("div", { text: "\u2014" });
  Object.assign(optName.style, { marginRight: "auto", fontWeight: "600" });
  const toolSelect = optHeader.createEl("select");
  const optBody = optionsPane.createDiv();
  const tools = [createBrushTool(), createInspectorTool()];
  for (const t of tools) toolSelect.createEl("option", { text: t.label, value: t.id });
  toolSelect.onchange = () => switchTool(toolSelect.value);
  const ctx = {
    app,
    getFile: () => state2.file,
    getHandles: () => state2.handles,
    getOpts: () => state2.opts ?? { folder: "Hexes", prefix: "Hex", radius: 42 },
    setStatus: (_msg) => {
    },
    refreshMap: async () => {
      await renderMap();
      state2.tool?.onMapRendered?.(ctx);
    }
  };
  async function switchTool(id) {
    if (state2.tool?.onDeactivate) state2.tool.onDeactivate(ctx);
    state2.cleanupPanel?.();
    const next = tools.find((t) => t.id === id) || tools[0];
    state2.tool = next;
    toolSelect.value = next.id;
    optBody.empty();
    state2.cleanupPanel = next.mountPanel(optBody, ctx);
    if (next.onActivate) next.onActivate(ctx);
    if (state2.handles && next.onMapRendered) next.onMapRendered(ctx);
  }
  async function renderMap() {
    mapPane.empty();
    state2.handles?.destroy();
    state2.handles = null;
    if (!state2.file) {
      mapPane.createEl("div", { text: "Keine Karte ge\xF6ffnet." });
      return;
    }
    const result = await renderHexMapFromFile(app, mapPane, state2.file);
    if (!result) return;
    state2.opts = result.options;
    state2.handles = result.handles;
    const hostDiv = result.host;
    hostDiv.addEventListener(
      "hex:click",
      (ev) => {
        const e = ev;
        e.preventDefault();
        void state2.tool?.onHexClick?.(e.detail, ctx);
      },
      { passive: false }
    );
  }
  async function refreshAll() {
    nameBox.textContent = state2.file ? state2.file.basename : "\u2014";
    optName.textContent = state2.file ? state2.file.basename : "\u2014";
    await renderMap();
    if (!state2.tool) await switchTool(tools[0].id);
    else await switchTool(state2.tool.id);
    state2.tool?.onMapRendered?.(ctx);
  }
  async function setFile(f) {
    state2.file = f ?? null;
    await refreshAll();
  }
  function setTool(id) {
    switchTool(id);
  }
  if (init?.mapPath) {
    const af = app.vault.getAbstractFileByPath(init.mapPath);
    if (af instanceof import_obsidian5.TFile) state2.file = af;
  }
  void refreshAll();
  return {
    setFile,
    setTool
  };
}

// src/apps/map-editor/index.ts
var VIEW_TYPE_MAP_EDITOR = "map-editor-view";
var MapEditorView = class extends import_obsidian6.ItemView {
  constructor(leaf) {
    super(leaf);
    this._state = {};
    this._controller = null;
  }
  getViewType() {
    return VIEW_TYPE_MAP_EDITOR;
  }
  getDisplayText() {
    return "Map Editor";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("hex-map-editor-root");
    const vs = this.leaf.getViewState();
    const initial = vs?.state ?? this._state;
    this._controller = mountMapEditor(this.app, container, initial);
    if (this._state?.mapPath && this._state.mapPath !== initial.mapPath) {
      const af = this.app.vault.getAbstractFileByPath(this._state.mapPath);
      if (af instanceof import_obsidian6.TFile) await this._controller.setFile(af);
    }
  }
  onClose() {
    this._controller = null;
  }
  // ---- View State (serialisierbar) ----
  getState() {
    return this._state;
  }
  async setState(state2) {
    this._state = state2 ?? {};
    if (this._controller?.setFile && this._state.mapPath) {
      const af = this.app.vault.getAbstractFileByPath(this._state.mapPath);
      if (af instanceof import_obsidian6.TFile) await this._controller.setFile(af);
    }
  }
};

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

// src/apps/map-gallery.ts
var VIEW_TYPE_HEX_GALLERY = "hex-gallery-view";
var HexGalleryView = class extends import_obsidian8.ItemView {
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return VIEW_TYPE_HEX_GALLERY;
  }
  getDisplayText() {
    return "Map Gallery";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("hex-gallery-root");
    mountMapGallery(this.app, container);
  }
  async onClose() {
  }
};
function renderHeader(app, root, cbs, currentFile) {
  const header = root.createDiv({ cls: "hex-gallery-header" });
  Object.assign(header.style, { display: "flex", flexDirection: "column", gap: "0.4rem" });
  const row1 = header.createDiv({ cls: "hex-gallery-row1" });
  Object.assign(row1.style, { display: "flex", alignItems: "center", gap: "0.5rem" });
  const hTitle = row1.createEl("h2", { text: "Map Gallery" });
  Object.assign(hTitle.style, { marginRight: "auto", fontSize: "1.1rem" });
  const btnOpen = row1.createEl("button", { text: "Open Map" });
  (0, import_obsidian8.setIcon)(btnOpen, "folder-open");
  applyMapButtonStyle(btnOpen);
  btnOpen.addEventListener("click", () => cbs.openMap());
  const btnPlus = row1.createEl("button");
  (0, import_obsidian8.setIcon)(btnPlus, "plus");
  applyMapButtonStyle(btnPlus);
  btnPlus.addEventListener("click", () => cbs.createMap());
  const row2 = header.createDiv({ cls: "hex-gallery-row2" });
  Object.assign(row2.style, { display: "flex", alignItems: "center", gap: "0.5rem" });
  const current = row2.createEl("div", {
    text: currentFile ? currentFile.basename : "\u2014"
  });
  Object.assign(current.style, { marginRight: "auto", opacity: "0.85" });
  const openWrap = row2.createDiv();
  Object.assign(openWrap.style, { display: "flex", alignItems: "center", gap: "0.4rem" });
  openWrap.createEl("span", { text: "\xD6ffnen in:" });
  const select = openWrap.createEl("select");
  select.createEl("option", { text: "Map Editor" }).value = "map-editor";
  select.createEl("option", { text: "Travel Guide" }).value = "travel-guide";
  const btnGo = openWrap.createEl("button", { text: "Los" });
  applyMapButtonStyle(btnGo);
  btnGo.addEventListener("click", () => {
    const target = select.value || "map-editor";
    cbs.onOpenIn(target);
  });
  const btnDelete = row2.createEl("button", { attr: { "aria-label": "Delete map" } });
  (0, import_obsidian8.setIcon)(btnDelete, "trash");
  applyMapButtonStyle(btnDelete);
  toggleButton(btnDelete, !!currentFile);
  btnDelete.addEventListener("click", () => cbs.onDelete());
  return {
    header,
    setCurrentTitle: (f) => {
      currentFile = f;
      current.textContent = f ? f.basename : "\u2014";
      toggleButton(btnDelete, !!f);
    }
  };
}
function mountMapGallery(app, container) {
  container.empty();
  Object.assign(container.style, { display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%" });
  let currentFile;
  const viewer = container.createDiv({ cls: "hex-gallery-viewer" });
  Object.assign(viewer.style, { flex: "1 1 auto", minHeight: "200px", overflow: "hidden" });
  const { setCurrentTitle } = renderHeader(
    app,
    container,
    {
      openMap: async () => {
        await promptMapSelection(app, async (f) => {
          currentFile = f;
          setCurrentTitle(currentFile);
          await refreshViewer();
        });
      },
      createMap: () => {
        promptCreateMap(app, async (file) => {
          currentFile = file;
          setCurrentTitle(currentFile);
          await refreshViewer();
        });
      },
      onOpenIn: (target) => {
        if (!currentFile) return new import_obsidian8.Notice("Keine Karte ausgew\xE4hlt.");
        openIn(app, target, currentFile);
      },
      onDelete: () => {
        if (!currentFile) return;
        new ConfirmDeleteModal(app, currentFile, async () => {
          try {
            await deleteMapAndTiles(app, currentFile);
            new import_obsidian8.Notice("Map gel\xF6scht.");
            currentFile = void 0;
            setCurrentTitle(void 0);
            await refreshViewer();
          } catch (e) {
            console.error(e);
            new import_obsidian8.Notice("L\xF6schen fehlgeschlagen.");
          }
        }).open();
      }
    },
    currentFile
  );
  async function refreshViewer() {
    viewer.empty();
    if (!currentFile) {
      viewer.createEl("div", { text: "Keine Karte ausgew\xE4hlt." });
      return;
    }
    await renderViewer(app, viewer, currentFile);
  }
  return {
    async setFile(f) {
      currentFile = f;
      setCurrentTitle(currentFile);
      await refreshViewer();
    }
  };
}
async function renderViewer(app, root, file) {
  await renderHexMapFromFile(app, root, file);
}
async function openIn(app, target, file) {
  if (target === "map-editor") {
    const leaf2 = getCenterLeaf(app);
    await leaf2.setViewState({
      type: VIEW_TYPE_MAP_EDITOR,
      active: true,
      state: { mapPath: file.path }
    });
    app.workspace.revealLeaf(leaf2);
    return;
  }
  const leaf = getRightLeaf(app);
  await leaf.openFile(file, { state: { mode: "travel-guide" } });
}
function toggleButton(btn, enabled) {
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
  btn.style.pointerEvents = enabled ? "auto" : "none";
}

// src/apps/terrain-editor/view.ts
var import_obsidian10 = require("obsidian");

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

// src/apps/terrain-editor/view.ts
var VIEW_TERRAIN_EDITOR = "salt-terrain-editor";
function normalize(input) {
  const first = Object.values(input)[0];
  if (first && typeof first === "object" && "color" in first) return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) out[k] = { color: v, speed: 1 };
  if (!out[""]) out[""] = { color: "transparent", speed: 1 };
  return out;
}
var TerrainEditorView = class extends import_obsidian10.ItemView {
  constructor() {
    super(...arguments);
    this.state = {};
  }
  getViewType() {
    return VIEW_TERRAIN_EDITOR;
  }
  getDisplayText() {
    return "Terrain Editor";
  }
  getIcon() {
    return "palette";
  }
  async onOpen() {
    this.contentEl.addClass("sm-terrain-editor");
    this.state = normalize(await loadTerrains(this.app));
    setTerrains(this.state);
    this.render();
    this.unwatch = watchTerrains(this.app, () => this.refreshFromDisk());
  }
  async onClose() {
    this.unwatch?.();
  }
  async refreshFromDisk() {
    this.state = normalize(await loadTerrains(this.app));
    setTerrains(this.state);
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: "Terrain Editor" });
    root.createEl("div", { text: `Quelle: ${TERRAIN_FILE}`, cls: "desc" });
    const list = root.createEl("div", { cls: "rows" });
    const addRow = (name, color, speed) => {
      const row = list.createDiv({ cls: "row" });
      const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } });
      nameInp.value = name;
      const colorInp = row.createEl("input", { attr: { type: "color" } });
      colorInp.value = /^#([0-9a-f]{6})$/i.test(color) ? color : "#999999";
      const speedInp = row.createEl("input", { attr: { type: "number", step: "0.1", min: "0" } });
      speedInp.value = String(Number.isFinite(speed) ? speed : 1);
      const delBtn = row.createEl("button", { text: "\u{1F5D1}" });
      nameInp.oninput = () => {
        this.renameKey(name, nameInp.value, colorInp.value, parseFloat(speedInp.value));
        name = nameInp.value;
      };
      colorInp.oninput = () => this.upsert(nameInp.value, colorInp.value, parseFloat(speedInp.value));
      speedInp.oninput = () => this.upsert(nameInp.value, colorInp.value, parseFloat(speedInp.value));
      delBtn.onclick = () => this.remove(nameInp.value);
    };
    const empty = this.state[""] ?? { color: "transparent", speed: 1 };
    addRow("", empty.color, empty.speed);
    for (const [k, v] of Object.entries(this.state).filter(([k2]) => k2 !== "").sort((a, b) => a[0].localeCompare(b[0]))) {
      addRow(k, v.color, v.speed);
    }
    const addBar = root.createDiv({ cls: "addbar" });
    const addName = addBar.createEl("input", { attr: { type: "text", placeholder: "Neues Terrain" } });
    const addColor = addBar.createEl("input", { attr: { type: "color", value: "#00a86b" } });
    const addSpeed = addBar.createEl("input", { attr: { type: "number", step: "0.1", min: "0", value: "1" } });
    const addBtn = addBar.createEl("button", { text: "\u2795 Hinzuf\xFCgen" });
    addBtn.onclick = () => {
      if (!addName.value.trim()) return;
      this.upsert(addName.value.trim(), addColor.value, parseFloat(addSpeed.value) || 1);
      addName.value = "";
    };
  }
  async commit() {
    await saveTerrains(this.app, this.state);
    setTerrains(this.state);
    this.app.workspace.trigger?.("salt:terrains-updated");
  }
  upsert(name, color, speed) {
    if (!Number.isFinite(speed)) speed = 1;
    if (name === "") this.state[""] = { color: "transparent", speed: 1 };
    else this.state[name] = { color, speed };
    this.render();
    void this.commit();
  }
  renameKey(oldName, nextName, color, speed) {
    if (oldName === nextName) return;
    if (!nextName) nextName = "";
    delete this.state[oldName];
    this.state[nextName] = { color, speed: Number.isFinite(speed) ? speed : 1 };
    this.render();
    void this.commit();
  }
  remove(name) {
    if (name === "") return;
    delete this.state[name];
    this.render();
    void this.commit();
  }
};

// src/apps/travel-guide/index.ts
var import_obsidian11 = require("obsidian");

// src/apps/travel-guide/ui/map-layer.ts
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

// src/apps/travel-guide/render/draw-route.ts
function drawRoute(args) {
  const { layer, route, centerOf, highlightIndex = null } = args;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  const pts = [];
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
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(ctr.x));
    dot.setAttribute("cy", String(ctr.y));
    dot.setAttribute("r", node.kind === "user" ? "5" : "4");
    dot.setAttribute("fill", "var(--interactive-accent)");
    dot.setAttribute("opacity", node.kind === "user" ? "1" : "0.55");
    dot.setAttribute("data-kind", node.kind);
    dot.style.pointerEvents = "auto";
    layer.appendChild(dot);
  });
  updateHighlight(layer, highlightIndex);
}
function updateHighlight(layer, highlightIndex) {
  const dots = Array.from(layer.querySelectorAll("circle"));
  dots.forEach((el, idx) => {
    const isHi = highlightIndex != null && idx === highlightIndex;
    el.setAttribute("stroke", isHi ? "var(--background-modifier-border)" : "none");
    el.setAttribute("stroke-width", isHi ? "2" : "0");
    el.setAttribute("r", isHi ? String(Number(el.getAttribute("r") || "4") + 2) : el.dataset.kind === "user" ? "5" : "4");
    el.style.opacity = el.getAttribute("data-kind") === "user" ? isHi ? "1" : "1" : isHi ? "0.9" : "0.55";
    el.style.cursor = "pointer";
  });
}

// src/apps/travel-guide/ui/route-layer.ts
function createRouteLayer(svgRoot, centerOf) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.classList.add("tg-route-layer");
  svgRoot.appendChild(el);
  function draw(route, highlightIndex = null) {
    drawRoute({ layer: el, route, centerOf, highlightIndex });
  }
  function highlight(i) {
    updateHighlight(el, i);
  }
  function destroy() {
    el.remove();
  }
  return { el, draw, highlight, destroy };
}

// src/apps/travel-guide/ui/token-layer.ts
function createTokenLayer(svgRoot) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.classList.add("tg-token");
  el.style.pointerEvents = "auto";
  el.style.cursor = "grab";
  svgRoot.appendChild(el);
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("r", "9");
  circle.setAttribute("fill", "var(--color-accent)");
  circle.setAttribute("opacity", "0.95");
  circle.setAttribute("stroke", "var(--background-modifier-border)");
  circle.setAttribute("stroke-width", "2");
  el.appendChild(circle);
  let vx = 0, vy = 0;
  let rafId = null;
  function setPos(x, y) {
    vx = x;
    vy = y;
    el.setAttribute("transform", `translate(${x},${y})`);
  }
  function moveTo(x, y, durMs) {
    if (durMs <= 0) {
      setPos(x, y);
      return Promise.resolve();
    }
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const x0 = vx, y0 = vy;
    const dx = x - x0, dy = y - y0;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        const t = (performance.now() - t0) / durMs;
        if (t >= 1) {
          setPos(x, y);
          rafId = null;
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
  function destroy() {
    if (rafId != null) cancelAnimationFrame(rafId);
    el.remove();
  }
  hide();
  return { el, setPos, moveTo, show, hide, destroy };
}

// src/apps/travel-guide/ui/drag.controller.ts
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
  function ghostMoveSelectedDot(rc) {
    const s = logic.getState();
    const idx = s.editIdx;
    if (idx == null) return;
    const dots = Array.from(routeLayerEl.querySelectorAll("circle"));
    const dot = dots[idx];
    if (!dot) return;
    const ctr = adapter.centerOf(rc);
    if (!ctr) return;
    dot.setAttribute("cx", String(ctr.x));
    dot.setAttribute("cy", String(ctr.y));
  }
  function ghostMoveToken(rc) {
    const ctr = adapter.centerOf(rc);
    if (!ctr) return;
    token.setPos(ctr.x, ctr.y);
    token.show();
  }
  const onDotPointerDown = (ev) => {
    if (ev.button !== 0) return;
    const t = ev.target;
    if (!(t instanceof SVGCircleElement)) return;
    const nodes = Array.from(routeLayerEl.querySelectorAll("circle"));
    const idx = nodes.indexOf(t);
    if (idx < 0) return;
    logic.selectDot(idx);
    dragKind = "dot";
    isDragging = true;
    lastDragRC = null;
    suppressNextHexClick = true;
    disableLayerHit(true);
    t.setPointerCapture?.(ev.pointerId);
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
    routeLayerEl.addEventListener("pointerdown", onDotPointerDown, { capture: true });
    tokenEl.addEventListener("pointerdown", onTokenPointerDown, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });
  }
  function unbind() {
    routeLayerEl.removeEventListener("pointerdown", onDotPointerDown, { capture: true });
    tokenEl.removeEventListener("pointerdown", onTokenPointerDown, { capture: true });
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  }
  function consumeClickSuppression() {
    const r = suppressNextHexClick;
    suppressNextHexClick = false;
    return r;
  }
  return { bind, unbind, consumeClickSuppression };
}

// src/apps/travel-guide/ui/contextmenue.ts
function bindContextMenu(routeLayerEl, logic) {
  const onContextMenu = (ev) => {
    const t = ev.target;
    if (!(t instanceof SVGCircleElement)) return;
    const circles = Array.from(routeLayerEl.querySelectorAll("circle"));
    const idx = circles.indexOf(t);
    if (idx < 0) return;
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

// src/apps/travel-guide/ui/sidebar.ts
function createSidebar(host, initialTitle) {
  host.empty();
  host.classList.add("sm-tg-sidebar");
  const root = host.createDiv({ cls: "sm-tg-sidebar__inner" });
  const titleEl = root.createEl("div", {
    cls: "sm-tg-sidebar__title",
    text: initialTitle ?? "\u2014"
  });
  const statusSection = root.createDiv({
    cls: "sm-tg-sidebar__section sm-tg-sidebar__section--status"
  });
  statusSection.createEl("h3", {
    cls: "sm-tg-sidebar__section-title",
    text: "Status"
  });
  const tileRow = statusSection.createDiv({ cls: "sm-tg-sidebar__row" });
  tileRow.createSpan({ cls: "sm-tg-sidebar__label", text: "Aktuelles Hex" });
  const tileValue = tileRow.createSpan({ cls: "sm-tg-sidebar__value", text: "\u2014" });
  const speedSection = root.createDiv({
    cls: "sm-tg-sidebar__section sm-tg-sidebar__section--speed"
  });
  speedSection.createEl("h3", {
    cls: "sm-tg-sidebar__section-title",
    text: "Geschwindigkeit"
  });
  const speedRow = speedSection.createDiv({ cls: "sm-tg-sidebar__row" });
  speedRow.createSpan({ cls: "sm-tg-sidebar__label", text: "Token-Speed" });
  const speedInput = speedRow.createEl("input", {
    type: "number",
    cls: "sm-tg-sidebar__speed-input",
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
    titleEl.textContent = title && title.trim().length > 0 ? title : "\u2014";
  };
  return {
    root,
    setTitle,
    setTile,
    setSpeed,
    onSpeedChange: (fn) => onChange = fn,
    destroy: () => host.empty()
  };
}

// src/apps/travel-guide/domain/state.store.ts
function createStore() {
  let state2 = {
    tokenRC: { r: 0, c: 0 },
    route: [],
    editIdx: null,
    tokenSpeed: 1,
    currentTile: null,
    playing: false
  };
  const subs = /* @__PURE__ */ new Set();
  const get = () => state2;
  const set = (patch) => {
    state2 = { ...state2, ...patch };
    emit2();
  };
  const replace = (next) => {
    state2 = next;
    emit2();
  };
  const subscribe = (fn) => {
    subs.add(fn);
    fn(state2);
    return () => subs.delete(fn);
  };
  const emit2 = () => {
    for (const fn of subs) fn(state2);
  };
  return { get, set, replace, subscribe, emit: emit2 };
}

// src/apps/travel-guide/domain/expansion.ts
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

// src/apps/travel-guide/domain/terrain.service.ts
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

// src/apps/travel-guide/domain/persistence.ts
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
  const cur = await loadTile(app, mapFile, rc).catch(() => ({}));
  await saveTile(app, mapFile, rc, { ...cur, [TOKEN_KEY]: true });
}

// src/apps/travel-guide/domain/playback.ts
function createPlayback(cfg) {
  const { app, getMapFile, adapter, store, baseMs, onChange } = cfg;
  let playing = false;
  function trimRoutePassed(token) {
    const cur = store.get();
    let i = 0;
    while (i < cur.route.length && cur.route[i].r === token.r && cur.route[i].c === token.c) i++;
    if (i > 0) store.set({ route: cur.route.slice(i) });
  }
  async function play() {
    const mapFile = getMapFile();
    if (!mapFile) return;
    const s0 = store.get();
    if (s0.route.length === 0) return;
    playing = true;
    store.set({ playing: true });
    onChange();
    while (playing) {
      const s = store.get();
      if (s.route.length === 0) break;
      const next = s.route[0];
      adapter.ensurePolys([{ r: next.r, c: next.c }]);
      const terr = await loadTerrainSpeed(app, mapFile, next);
      const eff = Math.max(0.05, terr * s.tokenSpeed);
      const dur = baseMs / eff;
      const ctr = adapter.centerOf(next);
      if (ctr) {
        await adapter.token.moveTo(ctr.x, ctr.y, dur);
      }
      const tokenRC = { r: next.r, c: next.c };
      store.set({ tokenRC, currentTile: tokenRC });
      await writeTokenToTiles(app, mapFile, tokenRC);
      trimRoutePassed(tokenRC);
      onChange();
      if (!playing) break;
    }
    playing = false;
    store.set({ playing: false });
    onChange();
  }
  function pause() {
    playing = false;
    store.set({ playing: false });
    onChange();
  }
  return { play, pause };
}

// src/apps/travel-guide/domain/actions.ts
function createTravelLogic(cfg) {
  const store = createStore();
  let adapter = cfg.adapter;
  const unsub = store.subscribe((s) => {
    cfg.onChange?.(s);
    adapter.draw(s.route);
  });
  const playback = createPlayback({
    app: cfg.app,
    getMapFile: cfg.getMapFile,
    baseMs: cfg.baseMs,
    store,
    adapter
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
    state.tokenRC = rc;
    adapter.ensurePolys([rc]);
    const ctr = adapter.centerOf(rc);
    if (ctr) {
      adapter.token.setPos(ctr.x, ctr.y);
      adapter.token.show();
    }
    const anchors = state.route.filter((n) => n.kind === "user").map(({ r, c }) => ({ r, c }));
    state.route = rebuildFromAnchors(state.tokenRC, anchors);
    const mapFile = cfg.getMapFile();
    if (mapFile) await writeTokenToTiles(cfg.app, mapFile, state.tokenRC);
    adapter.draw(state.route);
    emit();
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
  const play = async () => playback.play();
  const pause = () => playback.pause();
  async function initTokenFromTiles() {
    const mapFile = cfg.getMapFile();
    if (!mapFile || !adapter) return;
    const found = await loadTokenCoordFromMap(cfg.app, mapFile);
    state.tokenRC = found ?? { r: 0, c: 0 };
    adapter.ensurePolys([state.tokenRC]);
    const ctr = adapter.centerOf(state.tokenRC);
    if (ctr) {
      adapter.token.setPos(ctr.x, ctr.y);
      adapter.token.show();
    }
    if (!found) await writeTokenToTiles(cfg.app, mapFile, state.tokenRC);
    emit();
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
    setTokenSpeed,
    bindAdapter,
    initTokenFromTiles,
    persistTokenToTiles
  };
}

// src/apps/travel-guide/ui/view-shell.ts
async function mountTravelGuide(app, host, file) {
  host.empty();
  host.classList.add("sm-travel-guide");
  const mapHost = host.createDiv({ cls: "sm-tg-map" });
  const sidebarHost = host.createDiv({ cls: "sm-tg-sidebar" });
  const sidebar = createSidebar(sidebarHost, file?.basename ?? "\u2014");
  await setTerrains(await loadTerrains(app));
  const opts = parseOptions("radius: 42");
  let currentFile = null;
  let mapLayer = null;
  let routeLayer = null;
  let tokenLayer = null;
  let drag = null;
  let unbindContext = () => {
  };
  let logic = null;
  let isDestroyed = false;
  let loadChain = Promise.resolve();
  const handleStateChange = (s) => {
    if (routeLayer) routeLayer.draw(s.route, s.editIdx ?? null);
    sidebar.setTile(s.currentTile ?? s.tokenRC ?? null);
    sidebar.setSpeed(s.tokenSpeed);
  };
  const cleanupInteractions = () => {
    unbindContext();
    unbindContext = () => {
    };
    if (drag) {
      drag.unbind();
      drag = null;
    }
  };
  const cleanupLayers = () => {
    cleanupInteractions();
    if (tokenLayer) {
      tokenLayer.destroy?.();
      tokenLayer = null;
    }
    if (routeLayer) {
      routeLayer.destroy();
      routeLayer = null;
    }
    if (mapLayer) {
      mapLayer.destroy();
      mapLayer = null;
    }
    mapHost.empty();
  };
  const onHexClick = (ev) => {
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
    if (!logic) return;
    if (drag?.consumeClickSuppression()) return;
    const { r, c } = ev.detail;
    logic.handleHexClick({ r, c });
  };
  mapHost.addEventListener("hex:click", onHexClick, { passive: false });
  const loadFile = async (nextFile) => {
    if (isDestroyed) return;
    const same = nextFile?.path === currentFile?.path;
    if (same) return;
    currentFile = nextFile;
    sidebar.setTitle(nextFile?.basename ?? "\u2014");
    sidebar.setTile(null);
    logic?.pause?.();
    logic = null;
    cleanupLayers();
    if (!nextFile) {
      sidebar.setSpeed(1);
      return;
    }
    mapLayer = await createMapLayer(app, mapHost, nextFile, opts);
    if (isDestroyed) {
      mapLayer.destroy();
      mapLayer = null;
      return;
    }
    routeLayer = createRouteLayer(mapLayer.handles.svg, (rc) => mapLayer.centerOf(rc));
    tokenLayer = createTokenLayer(mapLayer.handles.svg);
    const adapter = {
      ensurePolys: (coords) => mapLayer.ensurePolys(coords),
      centerOf: (rc) => mapLayer.centerOf(rc),
      draw: (route) => routeLayer.draw(route),
      token: tokenLayer
    };
    logic = createTravelLogic({
      app,
      baseMs: 900,
      getMapFile: () => currentFile,
      adapter,
      onChange: (state2) => handleStateChange(state2)
    });
    handleStateChange(logic.getState());
    await logic.initTokenFromTiles();
    if (isDestroyed) return;
    drag = createDragController({
      routeLayerEl: routeLayer.el,
      tokenEl: tokenLayer.el,
      token: tokenLayer,
      adapter,
      logic: {
        getState: () => logic.getState(),
        selectDot: (i) => logic.selectDot(i),
        moveSelectedTo: (rc) => logic.moveSelectedTo(rc),
        moveTokenTo: (rc) => logic.moveTokenTo(rc)
      },
      polyToCoord: mapLayer.polyToCoord
    });
    drag.bind();
    unbindContext = bindContextMenu(routeLayer.el, {
      getState: () => logic.getState(),
      deleteUserAt: (idx) => logic.deleteUserAt(idx)
    });
  };
  sidebar.onSpeedChange((v) => {
    logic?.setTokenSpeed(v);
  });
  await loadFile(file);
  const enqueueLoad = (next) => {
    loadChain = loadChain.then(() => loadFile(next)).catch((err) => {
      console.error("[travel-guide] setFile failed", err);
    });
    return loadChain;
  };
  const controller = {
    setFile(next) {
      return enqueueLoad(next ?? null);
    },
    destroy() {
      isDestroyed = true;
      mapHost.removeEventListener("hex:click", onHexClick);
      cleanupLayers();
      logic?.pause?.();
      logic = null;
      sidebar.destroy();
      host.classList.remove("sm-travel-guide");
      host.empty();
    }
  };
  return controller;
}

// src/apps/travel-guide/index.ts
var VIEW_TYPE_TRAVEL_GUIDE = "travel-guide-view";
var VIEW_TRAVEL_GUIDE = VIEW_TYPE_TRAVEL_GUIDE;
var TravelGuideView = class extends import_obsidian11.ItemView {
  constructor(leaf) {
    super(leaf);
    this.controller = null;
    this.hostEl = null;
    this.initialFile = null;
  }
  getViewType() {
    return VIEW_TYPE_TRAVEL_GUIDE;
  }
  getDisplayText() {
    return "Travel Guide";
  }
  getIcon() {
    return "map";
  }
  /** Optional: open view with a preselected file */
  setFile(file) {
    this.initialFile = file;
    void this.controller?.setFile(file ?? null);
  }
  async onOpen() {
    const container = this.containerEl;
    const content = container.children[1];
    content.empty();
    this.hostEl = content.createDiv({ cls: "travel-guide-host" });
    const file = this.initialFile ?? this.app.workspace.getActiveFile() ?? null;
    this.controller = await mountTravelGuide(this.app, this.hostEl, file);
  }
  async onClose() {
    this.controller?.destroy();
    this.controller = null;
    this.hostEl = null;
  }
};

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

/* === Gallery-Layout (Header + Toolbar) === */
.hex-gallery-header {
    display: flex;
    align-items: center;
    gap: .75rem;
    margin-bottom: .5rem;
}

/* Titel k\xFCrzen, falls der Dateiname zu lang ist */
.hex-gallery-header h2 {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
}

.hex-gallery-card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}

.hex-gallery-card-row a {
    font-weight: 600;
    cursor: pointer;
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

/* === Travel Guide === */
.sm-travel-guide {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
    height: 100%;
    min-height: 100%;
    gap: 1.5rem;
    padding: 1rem;
    box-sizing: border-box;
}

.sm-travel-guide .sm-tg-map {
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

.sm-travel-guide .sm-tg-map .hex3x3-map {
    max-width: none;
    height: 100%;
}

.sm-travel-guide .sm-tg-sidebar {
    flex: 0 0 280px;
    max-width: 340px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 1rem;
    box-sizing: border-box;
    display: flex;
}

.sm-tg-sidebar__inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
}

.sm-tg-sidebar__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal);
}

.sm-tg-sidebar__section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-tg-sidebar__section-title {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
    color: var(--text-muted);
}

.sm-tg-sidebar__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.sm-tg-sidebar__label {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-tg-sidebar__value {
    font-size: 1rem;
    font-weight: 600;
}

.sm-tg-sidebar__speed-input {
    width: 100%;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
}

.sm-travel-guide .hex3x3-map circle[data-token] { opacity: .95; }
.sm-travel-guide .hex3x3-map polyline { pointer-events: none; }
`;

// src/app/main.ts
var SaltMarcherPlugin = class extends import_obsidian12.Plugin {
  async onload() {
    this.registerView(VIEW_TYPE_HEX_GALLERY, (leaf) => new HexGalleryView(leaf));
    this.registerView(VIEW_TYPE_MAP_EDITOR, (leaf) => new MapEditorView(leaf));
    this.registerView(VIEW_TERRAIN_EDITOR, (leaf) => new TerrainEditorView(leaf));
    this.registerView(VIEW_TRAVEL_GUIDE, (leaf) => new TravelGuideView(leaf));
    await ensureTerrainFile(this.app);
    setTerrains(await loadTerrains(this.app));
    this.unwatchTerrains = watchTerrains(this.app, () => {
    });
    this.addRibbonIcon("images", "Open Map Gallery", async () => {
      const leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_HEX_GALLERY, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    const terrainRibbon = this.addRibbonIcon("palette", "Open Terrain Editor", async () => {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TERRAIN_EDITOR, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    terrainRibbon.addClass("salt-terrain-ribbon");
    this.addRibbonIcon("rocket", "Open Travel Guide", async () => {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TRAVEL_GUIDE, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    this.addCommand({
      id: "open-map-editor",
      name: "Open Map Editor (empty)",
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TYPE_MAP_EDITOR, active: true });
      }
    });
    this.addCommand({
      id: "open-terrain-editor",
      name: "Terrain Editor \xF6ffnen",
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TERRAIN_EDITOR, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });
    this.addCommand({
      id: "open-travel-guide",
      name: "Travel Guide \xF6ffnen",
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({ type: VIEW_TRAVEL_GUIDE, active: true });
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
