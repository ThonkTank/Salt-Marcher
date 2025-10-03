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

// src/apps/encounter/session-store.ts
function publishEncounterEvent(event) {
  latestEvent = event;
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (err) {
      console.error("[encounter] listener failed", err);
    }
  }
}
function subscribeToEncounterEvents(listener) {
  listeners.add(listener);
  if (latestEvent) {
    try {
      listener(latestEvent);
    } catch (err) {
      console.error("[encounter] listener failed", err);
    }
  }
  return () => {
    listeners.delete(listener);
  };
}
function peekLatestEncounterEvent() {
  return latestEvent;
}
var latestEvent, listeners;
var init_session_store = __esm({
  "src/apps/encounter/session-store.ts"() {
    "use strict";
    latestEvent = null;
    listeners = /* @__PURE__ */ new Set();
  }
});

// src/apps/encounter/presenter.ts
var defaultDeps, EncounterPresenter;
var init_presenter = __esm({
  "src/apps/encounter/presenter.ts"() {
    "use strict";
    init_session_store();
    defaultDeps = {
      now: () => (/* @__PURE__ */ new Date()).toISOString()
    };
    EncounterPresenter = class _EncounterPresenter {
      constructor(initial, deps) {
        this.listeners = /* @__PURE__ */ new Set();
        this.deps = { ...defaultDeps, ...deps };
        this.state = _EncounterPresenter.normalise(initial);
        this.unsubscribeStore = subscribeToEncounterEvents((event) => this.applyEvent(event));
      }
      dispose() {
        this.unsubscribeStore?.();
        this.listeners.clear();
      }
      /** Restores persisted state (e.g. when `setViewData` fires before `onOpen`). */
      restore(state) {
        this.state = _EncounterPresenter.normalise(state);
        this.emit();
      }
      getState() {
        return this.state;
      }
      subscribe(listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
          this.listeners.delete(listener);
        };
      }
      setNotes(notes) {
        if (!this.state.session) return;
        if (this.state.session.notes === notes) return;
        this.state = {
          session: {
            ...this.state.session,
            notes
          }
        };
        this.emit();
      }
      markResolved() {
        const session = this.state.session;
        if (!session) return;
        if (session.status === "resolved") return;
        this.state = {
          session: {
            ...session,
            status: "resolved",
            resolvedAt: this.deps.now()
          }
        };
        this.emit();
      }
      reset() {
        if (!this.state.session) return;
        this.state = { session: null };
        this.emit();
      }
      applyEvent(event) {
        const prev = this.state.session;
        if (!prev || prev.event.id !== event.id) {
          this.state = {
            session: {
              event,
              notes: "",
              status: "pending"
            }
          };
        } else {
          this.state = {
            session: {
              ...prev,
              event
            }
          };
        }
        this.emit();
      }
      emit() {
        for (const listener of [...this.listeners]) {
          listener(this.state);
        }
      }
      static normalise(initial) {
        if (!initial || !initial.session || !initial.session.event) {
          return { session: null };
        }
        const { event, notes, status, resolvedAt } = initial.session;
        return {
          session: {
            event,
            notes: notes ?? "",
            status: status === "resolved" ? "resolved" : "pending",
            resolvedAt: resolvedAt ?? null
          }
        };
      }
    };
  }
});

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
    init_presenter();
    VIEW_ENCOUNTER = "salt-encounter";
    EncounterView = class extends import_obsidian.ItemView {
      constructor(leaf) {
        super(leaf);
        this.presenter = null;
        this.pendingState = null;
      }
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
        this.renderShell();
        this.presenter = new EncounterPresenter(this.pendingState);
        this.pendingState = null;
        this.detachPresenter = this.presenter.subscribe((state) => this.render(state));
      }
      async onClose() {
        this.detachPresenter?.();
        this.presenter?.dispose();
        this.detachPresenter = void 0;
        this.presenter = null;
        this.pendingState = null;
        this.contentEl.empty();
        this.contentEl.removeClass("sm-encounter-view");
      }
      getViewData() {
        return this.presenter?.getState() ?? this.pendingState;
      }
      setViewData(data) {
        if (this.presenter) {
          this.presenter.restore(data);
        } else {
          this.pendingState = data;
        }
      }
      renderShell() {
        this.contentEl.empty();
        const header = this.contentEl.createEl("div", { cls: "sm-encounter-header" });
        this.headerEl = header.createEl("h2", { text: "Encounter" });
        this.statusEl = header.createDiv({ cls: "status", text: "Waiting for travel events\u2026" });
        this.summaryListEl = this.contentEl.createEl("ul", { cls: "sm-encounter-summary" });
        this.emptyEl = this.contentEl.createDiv({
          cls: "sm-encounter-empty",
          text: "No active encounter. Travel mode will populate this workspace when an encounter triggers."
        });
        this.emptyEl.style.display = "";
        const notesSection = this.contentEl.createDiv({ cls: "sm-encounter-notes" });
        notesSection.createEl("label", { text: "Notes", attr: { for: "encounter-notes" } });
        this.notesEl = notesSection.createEl("textarea", {
          cls: "notes-input",
          attr: {
            id: "encounter-notes",
            placeholder: "Record tactical notes, initiative order, or follow-up tasks\u2026",
            rows: "6"
          }
        });
        this.notesEl.disabled = true;
        this.notesEl.addEventListener("input", () => {
          if (!this.presenter) return;
          this.presenter.setNotes(this.notesEl.value);
        });
        this.resolveBtn = this.contentEl.createEl("button", { cls: "sm-encounter-resolve", text: "Mark encounter resolved" });
        this.resolveBtn.disabled = true;
        this.resolveBtn.addEventListener("click", () => {
          this.presenter?.markResolved();
        });
      }
      render(state) {
        const session = state.session;
        if (!session) {
          this.headerEl.setText("Encounter");
          this.statusEl.setText("Waiting for travel events\u2026");
          this.summaryListEl.empty();
          this.emptyEl.style.display = "";
          this.notesEl.value = "";
          this.notesEl.disabled = true;
          this.resolveBtn.disabled = true;
          this.resolveBtn.setText("Mark encounter resolved");
          return;
        }
        this.emptyEl.style.display = "none";
        const { event, notes, status, resolvedAt } = session;
        const region = event.regionName ?? "Unknown region";
        this.headerEl.setText(`Encounter \u2013 ${region}`);
        if (status === "resolved") {
          this.statusEl.setText(resolvedAt ? `Resolved ${resolvedAt}` : "Resolved");
        } else {
          this.statusEl.setText("Awaiting resolution");
        }
        this.summaryListEl.empty();
        const summaryEntries = [];
        if (event.coord) {
          summaryEntries.push(["Hex", `${event.coord.r}, ${event.coord.c}`]);
        }
        if (event.mapName) {
          summaryEntries.push(["Map", event.mapName]);
        }
        if (event.mapPath) {
          summaryEntries.push(["Map path", event.mapPath]);
        }
        summaryEntries.push(["Triggered", event.triggeredAt]);
        if (typeof event.travelClockHours === "number") {
          summaryEntries.push(["Travel clock", `${event.travelClockHours.toFixed(2)} h`]);
        }
        if (typeof event.encounterOdds === "number") {
          summaryEntries.push(["Encounter odds", `1 in ${event.encounterOdds}`]);
        }
        for (const [label, value] of summaryEntries) {
          const li = this.summaryListEl.createEl("li");
          li.createSpan({ cls: "label", text: `${label}: ` });
          li.createSpan({ cls: "value", text: value });
        }
        if (this.notesEl.value !== notes) {
          this.notesEl.value = notes;
        }
        this.notesEl.disabled = false;
        if (status === "resolved") {
          this.resolveBtn.disabled = true;
          this.resolveBtn.setText("Encounter resolved");
        } else {
          this.resolveBtn.disabled = false;
          this.resolveBtn.setText("Mark encounter resolved");
        }
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

// src/ui/copy.ts
var SEARCH_DROPDOWN_COPY, MODAL_COPY, MAP_WORKFLOWS_COPY, MAP_HEADER_COPY, CONFIRM_DELETE_COPY;
var init_copy = __esm({
  "src/ui/copy.ts"() {
    "use strict";
    SEARCH_DROPDOWN_COPY = {
      placeholder: "Search\u2026"
    };
    MODAL_COPY = {
      nameInput: {
        placeholder: "New hex map",
        title: "Name the new map",
        cta: "Create"
      },
      mapSelect: {
        placeholder: "Search maps\u2026"
      }
    };
    MAP_WORKFLOWS_COPY = {
      notices: {
        emptyMaps: "No maps available.",
        createSuccess: "Map created.",
        missingHexBlock: "No hex3x3 block found in this file."
      }
    };
    MAP_HEADER_COPY = {
      labels: {
        open: "Open map",
        create: "Create",
        delete: "Delete",
        save: "Save",
        saveAs: "Save as",
        trigger: "Apply"
      },
      notices: {
        missingFile: "Select a map before continuing.",
        saveSuccess: "Map saved.",
        saveError: "Saving the map failed."
      },
      selectPlaceholder: "Choose a save action\u2026"
    };
    CONFIRM_DELETE_COPY = {
      title: "Delete map?",
      body: (name) => `This will delete your map permanently. To continue, enter \u201C${name}\u201D.`,
      inputPlaceholder: (name) => name,
      buttons: {
        cancel: "Cancel",
        confirm: "Delete"
      },
      notices: {
        success: "Map deleted.",
        error: "Deleting map failed."
      }
    };
  }
});

// src/ui/modals.ts
var import_obsidian2, NameInputModal, MapSelectModal;
var init_modals = __esm({
  "src/ui/modals.ts"() {
    "use strict";
    import_obsidian2 = require("obsidian");
    init_copy();
    NameInputModal = class extends import_obsidian2.Modal {
      constructor(app, onSubmit, options) {
        super(app);
        this.onSubmit = onSubmit;
        this.value = "";
        this.placeholder = options?.placeholder ?? MODAL_COPY.nameInput.placeholder;
        this.title = options?.title ?? MODAL_COPY.nameInput.title;
        this.ctaLabel = options?.cta ?? MODAL_COPY.nameInput.cta;
        if (options?.initialValue) {
          this.value = options.initialValue.trim();
        }
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: this.title });
        let inputEl;
        new import_obsidian2.Setting(contentEl).addText((t) => {
          t.setPlaceholder(this.placeholder).onChange((v) => this.value = v.trim());
          inputEl = t.inputEl;
          if (this.value) {
            inputEl.value = this.value;
          }
        }).addButton((b) => b.setButtonText(this.ctaLabel).setCta().onClick(() => this.submit()));
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
    MapSelectModal = class extends import_obsidian2.FuzzySuggestModal {
      constructor(app, files, onChoose) {
        super(app);
        this.files = files;
        this.onChoose = onChoose;
        this.setPlaceholder(MODAL_COPY.mapSelect.placeholder);
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
  }
});

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
var init_map_list = __esm({
  "src/core/map-list.ts"() {
    "use strict";
    init_modals();
  }
});

// src/core/terrain.ts
function validateTerrainSchema(next) {
  const validated = {};
  const issues = [];
  for (const [rawName, rawValue] of Object.entries(next ?? {})) {
    const name = (rawName ?? "").trim();
    const color = (rawValue?.color ?? "").trim();
    if (!name && rawName !== "") {
      issues.push(`Terrain name must not be empty (received: "${rawName}")`);
      continue;
    }
    if (name.length > TERRAIN_NAME_MAX_LENGTH) {
      issues.push(`Terrain name "${name}" exceeds ${TERRAIN_NAME_MAX_LENGTH} characters`);
      continue;
    }
    if (/[:\n\r]/.test(name)) {
      issues.push(`Terrain name "${name}" must not contain colons or line breaks`);
      continue;
    }
    if (!color) {
      issues.push(`Terrain "${name}" requires a color value`);
      continue;
    }
    if (color !== "transparent" && !HEX_COLOR_RE.test(color) && !CSS_VAR_RE.test(color) && !CSS_FUNCTION_RE.test(color)) {
      issues.push(`Terrain "${name}" uses unsupported color "${color}"`);
      continue;
    }
    let numericSpeed;
    if (rawValue?.speed === void 0) {
      numericSpeed = 1;
    } else {
      numericSpeed = Number(rawValue.speed);
    }
    if (!Number.isFinite(numericSpeed)) {
      issues.push(`Terrain "${name}" speed must be a finite number`);
      continue;
    }
    if (numericSpeed < REGION_SPEED_MIN || numericSpeed > REGION_SPEED_MAX) {
      issues.push(
        `Terrain "${name}" speed ${numericSpeed} must be between ${REGION_SPEED_MIN} and ${REGION_SPEED_MAX}`
      );
      continue;
    }
    validated[name] = { color, speed: numericSpeed };
  }
  if (!("" in validated)) {
    validated[""] = { color: "transparent", speed: 1 };
  }
  if (issues.length) {
    throw new TerrainValidationError(issues);
  }
  return validated;
}
function applyTerrainSchema(map) {
  const mergedColors = { ...DEFAULT_TERRAIN_COLORS, ...Object.fromEntries(
    Object.entries(map).map(([name, value]) => [name, value.color])
  ) };
  const mergedSpeeds = { ...DEFAULT_TERRAIN_SPEEDS, ...Object.fromEntries(
    Object.entries(map).map(([name, value]) => [name, value.speed])
  ) };
  mergedColors[""] = map[""]?.color ?? "transparent";
  mergedSpeeds[""] = map[""]?.speed ?? 1;
  for (const key of Object.keys(TERRAIN_COLORS)) {
    if (!(key in mergedColors)) delete TERRAIN_COLORS[key];
  }
  Object.assign(TERRAIN_COLORS, mergedColors);
  for (const key of Object.keys(TERRAIN_SPEEDS)) {
    if (!(key in mergedSpeeds)) delete TERRAIN_SPEEDS[key];
  }
  Object.assign(TERRAIN_SPEEDS, mergedSpeeds);
}
function setTerrains(next) {
  const validated = validateTerrainSchema(next ?? {});
  applyTerrainSchema(validated);
}
var DEFAULT_TERRAIN_COLORS, DEFAULT_TERRAIN_SPEEDS, TERRAIN_COLORS, TERRAIN_SPEEDS, TERRAIN_NAME_MAX_LENGTH, REGION_SPEED_MIN, REGION_SPEED_MAX, HEX_COLOR_RE, CSS_VAR_RE, CSS_FUNCTION_RE, TerrainValidationError;
var init_terrain = __esm({
  "src/core/terrain.ts"() {
    "use strict";
    DEFAULT_TERRAIN_COLORS = Object.freeze({
      "": "transparent",
      Wald: "#2e7d32",
      Meer: "#0288d1",
      Berg: "#6d4c41"
    });
    DEFAULT_TERRAIN_SPEEDS = Object.freeze({
      "": 1,
      // leeres Terrain = neutral
      Wald: 0.6,
      Meer: 0.5,
      Berg: 0.4
    });
    TERRAIN_COLORS = { ...DEFAULT_TERRAIN_COLORS };
    TERRAIN_SPEEDS = { ...DEFAULT_TERRAIN_SPEEDS };
    TERRAIN_NAME_MAX_LENGTH = 64;
    REGION_SPEED_MIN = 0;
    REGION_SPEED_MAX = 10;
    HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    CSS_VAR_RE = /^var\(--[a-z0-9_-]+\)$/i;
    CSS_FUNCTION_RE = /^(?:rgb|rgba|hsl|hsla)\(/i;
    TerrainValidationError = class extends Error {
      constructor(issues) {
        super(`Invalid terrain schema: ${issues.join(", ")}`);
        this.issues = issues;
        this.name = "TerrainValidationError";
      }
    };
  }
});

// src/core/hex-mapper/hex-geom.ts
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
var SQRT3;
var init_hex_geom = __esm({
  "src/core/hex-mapper/hex-geom.ts"() {
    "use strict";
    SQRT3 = Math.sqrt(3);
  }
});

// src/core/hex-mapper/render/scene.ts
function createHexScene(config) {
  const { host, radius, padding, base, initialCoords } = config;
  const hexW = Math.sqrt(3) * radius;
  const hexH = 2 * radius;
  const hStep = hexW;
  const vStep = 0.75 * hexH;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "hex3x3-map");
  svg.setAttribute("width", "100%");
  svg.style.touchAction = "none";
  const overlay = document.createElementNS(SVG_NS, "rect");
  overlay.setAttribute("fill", "transparent");
  overlay.setAttribute("pointer-events", "all");
  overlay.style.touchAction = "none";
  const contentG = document.createElementNS(SVG_NS, "g");
  svg.appendChild(overlay);
  svg.appendChild(contentG);
  host.appendChild(svg);
  const polyByCoord = /* @__PURE__ */ new Map();
  const internals = {
    bounds: null,
    updateViewBox() {
      if (!internals.bounds) return;
      const { minX, minY, maxX, maxY } = internals.bounds;
      const paddedMinX = Math.floor(minX - padding);
      const paddedMinY = Math.floor(minY - padding);
      const paddedMaxX = Math.ceil(maxX + padding);
      const paddedMaxY = Math.ceil(maxY + padding);
      const width = Math.max(1, paddedMaxX - paddedMinX);
      const height = Math.max(1, paddedMaxY - paddedMinY);
      svg.setAttribute("viewBox", `${paddedMinX} ${paddedMinY} ${width} ${height}`);
      overlay.setAttribute("x", String(paddedMinX));
      overlay.setAttribute("y", String(paddedMinY));
      overlay.setAttribute("width", String(width));
      overlay.setAttribute("height", String(height));
    },
    centerOf(coord) {
      const { r, c } = coord;
      const cx = padding + (c - base.c) * hStep + (r % 2 ? hexW / 2 : 0);
      const cy = padding + (r - base.r) * vStep + hexH / 2;
      return { cx, cy };
    },
    bboxOf(coord) {
      const { cx, cy } = internals.centerOf(coord);
      return {
        minX: cx - hexW / 2,
        maxX: cx + hexW / 2,
        minY: cy - radius,
        maxY: cy + radius
      };
    }
  };
  function mergeBounds(next) {
    if (!internals.bounds) {
      internals.bounds = { ...next };
      return;
    }
    const current = internals.bounds;
    current.minX = Math.min(current.minX, next.minX);
    current.minY = Math.min(current.minY, next.minY);
    current.maxX = Math.max(current.maxX, next.maxX);
    current.maxY = Math.max(current.maxY, next.maxY);
  }
  function addHex(coord) {
    if (polyByCoord.has(keyOf(coord))) return;
    const { cx, cy } = internals.centerOf(coord);
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", hexPolygonPoints(cx, cy, radius));
    poly.setAttribute("data-row", String(coord.r));
    poly.setAttribute("data-col", String(coord.c));
    poly.style.fill = "transparent";
    poly.style.stroke = "var(--text-muted)";
    poly.style.strokeWidth = "2";
    poly.style.transition = "fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease";
    contentG.appendChild(poly);
    polyByCoord.set(keyOf(coord), poly);
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(cx));
    label.setAttribute("y", String(cy + 4));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("pointer-events", "none");
    label.setAttribute("fill", "var(--text-muted)");
    label.textContent = `${coord.r},${coord.c}`;
    contentG.appendChild(label);
    mergeBounds(internals.bboxOf(coord));
  }
  function ensurePolys(coords) {
    let added = false;
    for (const coord of coords) {
      const key = keyOf(coord);
      if (polyByCoord.has(key)) continue;
      addHex(coord);
      added = true;
    }
    if (added) internals.updateViewBox();
  }
  function setFill(coord, color) {
    const poly = polyByCoord.get(keyOf(coord));
    if (!poly) return;
    const fill = color ?? "transparent";
    poly.style.fill = fill;
    poly.style.fillOpacity = fill !== "transparent" ? "0.25" : "0";
    if (fill !== "transparent") {
      poly.setAttribute("data-painted", "1");
    } else {
      poly.removeAttribute("data-painted");
    }
  }
  const initial = initialCoords.length ? initialCoords : [];
  if (initial.length) {
    for (const coord of initial) addHex(coord);
    internals.updateViewBox();
  }
  return {
    svg,
    contentG,
    overlay,
    polyByCoord,
    ensurePolys,
    setFill,
    getViewBox: () => {
      if (!internals.bounds) {
        return { minX: 0, minY: 0, width: 0, height: 0 };
      }
      const { minX, minY, maxX, maxY } = internals.bounds;
      return { minX, minY, width: maxX - minX, height: maxY - minY };
    },
    destroy: () => {
      polyByCoord.clear();
      svg.remove();
    }
  };
}
var SVG_NS, keyOf;
var init_scene = __esm({
  "src/core/hex-mapper/render/scene.ts"() {
    "use strict";
    init_hex_geom();
    SVG_NS = "http://www.w3.org/2000/svg";
    keyOf = (coord) => `${coord.r},${coord.c}`;
  }
});

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
var init_camera = __esm({
  "src/core/hex-mapper/camera.ts"() {
    "use strict";
  }
});

// src/core/hex-mapper/render/camera-controller.ts
function createCameraController(svg, contentG, overlay, host, options) {
  const detach = attachCameraControls(svg, contentG, options, [overlay, host]);
  return {
    destroy() {
      try {
        detach?.();
      } catch (err) {
        console.error("[hex-render] camera cleanup failed", err);
      }
    }
  };
}
var init_camera_controller = __esm({
  "src/core/hex-mapper/render/camera-controller.ts"() {
    "use strict";
    init_camera();
  }
});

// src/core/hex-mapper/render/interactions.ts
function createInteractionController(config) {
  const { svg, overlay, toContentPoint, pointToCoord, delegateRef, onDefaultClick } = config;
  let painting = false;
  let visited = null;
  let raf = 0;
  let lastPointer = null;
  const getDelegate = () => delegateRef.current;
  function convert(ev) {
    const pt = toContentPoint(ev);
    if (!pt) return null;
    return pointToCoord(pt.x, pt.y);
  }
  async function executePaintStep(ev) {
    const coord = convert(ev);
    if (!coord) return { outcome: "handled", coord: null };
    if (painting && visited?.has(keyOf2(coord))) {
      return { outcome: "handled", coord };
    }
    const handler = getDelegate().onPaintStep;
    if (!handler) return { outcome: "default", coord };
    const outcome = await handler(coord, ev);
    return { outcome, coord };
  }
  const onClick = async (ev) => {
    ev.preventDefault();
    const coord = convert(ev);
    if (!coord) return;
    const handler = getDelegate().onClick;
    const outcome = handler ? await handler(coord, ev) : "default";
    if (outcome === "default") {
      await onDefaultClick(coord, ev);
    }
  };
  const onPointerDown = (ev) => {
    if (ev.button !== 0) return;
    if (!getDelegate().onPaintStep) return;
    lastPointer = ev;
    void (async () => {
      const { outcome, coord } = await executePaintStep(ev);
      if (outcome === "start-paint" && coord) {
        painting = true;
        visited = /* @__PURE__ */ new Set([keyOf2(coord)]);
        svg.setPointerCapture?.(ev.pointerId);
        ev.preventDefault();
      } else if (outcome !== "default") {
        ev.preventDefault();
      }
    })();
  };
  const runQueuedPaintStep = () => {
    if (!painting || !lastPointer) return;
    const ev = lastPointer;
    void (async () => {
      const { outcome, coord } = await executePaintStep(ev);
      if (!painting) return;
      if (coord && outcome !== "default") {
        visited?.add(keyOf2(coord));
      }
    })();
  };
  const onPointerMove = (ev) => {
    if (!painting) return;
    lastPointer = ev;
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        runQueuedPaintStep();
      });
    }
    ev.preventDefault();
  };
  const endPaint = (ev) => {
    if (!painting) return;
    painting = false;
    visited?.clear();
    visited = null;
    lastPointer = null;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    svg.releasePointerCapture?.(ev.pointerId);
    getDelegate().onPaintEnd?.();
    ev.preventDefault();
  };
  const onPointerCancel = (ev) => {
    if (!painting) return;
    endPaint(ev);
  };
  svg.addEventListener("click", onClick, { passive: false });
  svg.addEventListener("pointerdown", onPointerDown, { capture: true });
  svg.addEventListener("pointermove", onPointerMove, { capture: true });
  svg.addEventListener("pointerup", endPaint, { capture: true });
  svg.addEventListener("pointercancel", onPointerCancel, { capture: true });
  overlay.addEventListener("pointerdown", onPointerDown, { capture: true });
  overlay.addEventListener("pointermove", onPointerMove, { capture: true });
  overlay.addEventListener("pointerup", endPaint, { capture: true });
  overlay.addEventListener("pointercancel", onPointerCancel, { capture: true });
  return {
    destroy() {
      svg.removeEventListener("click", onClick);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", endPaint);
      svg.removeEventListener("pointercancel", onPointerCancel);
      overlay.removeEventListener("pointerdown", onPointerDown);
      overlay.removeEventListener("pointermove", onPointerMove);
      overlay.removeEventListener("pointerup", endPaint);
      overlay.removeEventListener("pointercancel", onPointerCancel);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      painting = false;
      visited?.clear();
      visited = null;
      lastPointer = null;
    }
  };
}
var keyOf2;
var init_interactions = __esm({
  "src/core/hex-mapper/render/interactions.ts"() {
    "use strict";
    keyOf2 = (coord) => `${coord.r},${coord.c}`;
  }
});

// src/core/hex-mapper/render/coordinates.ts
function createCoordinateTranslator(config) {
  const { svg, contentG, base, radius, padding } = config;
  const hexW = Math.sqrt(3) * radius;
  const hexH = 2 * radius;
  const hStep = hexW;
  const vStep = 0.75 * hexH;
  const svgPoint = svg.createSVGPoint();
  const toContentPoint = (ev) => {
    const matrix = contentG.getScreenCTM();
    if (!matrix) return null;
    svgPoint.x = ev.clientX;
    svgPoint.y = ev.clientY;
    return svgPoint.matrixTransform(matrix.inverse());
  };
  const pointToCoord = (px, py) => {
    const rFloat = (py - padding - hexH / 2) / vStep + base.r;
    let r = Math.round(rFloat);
    const isOdd = r % 2 !== 0;
    let c = Math.round((px - padding - (isOdd ? hexW / 2 : 0)) / hStep + base.c);
    let best = { r, c };
    let bestD2 = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      const odd = rr % 2 !== 0;
      const cc = Math.round((px - padding - (odd ? hexW / 2 : 0)) / hStep + base.c);
      const cx = padding + (cc - base.c) * hStep + (rr % 2 ? hexW / 2 : 0);
      const cy = padding + (rr - base.r) * vStep + hexH / 2;
      const dx = px - cx;
      const dy = py - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { r: rr, c: cc };
      }
    }
    return best;
  };
  return {
    toContentPoint,
    pointToCoord
  };
}
var init_coordinates = __esm({
  "src/core/hex-mapper/render/coordinates.ts"() {
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
  TileValidationError: () => TileValidationError,
  deleteTile: () => deleteTile,
  initTilesForNewMap: () => initTilesForNewMap,
  listTilesForMap: () => listTilesForMap,
  loadTile: () => loadTile,
  saveTile: () => saveTile,
  validateTileData: () => validateTileData
});
function validateTileData(data, options = {}) {
  const { allowUnknownTerrain = false } = options;
  const issues = [];
  const terrain = typeof data.terrain === "string" ? data.terrain.trim() : "";
  if (terrain.length > TILE_TERRAIN_MAX_LENGTH) {
    issues.push(`terrain exceeds ${TILE_TERRAIN_MAX_LENGTH} characters`);
  }
  if (!allowUnknownTerrain && terrain && !(terrain in TERRAIN_COLORS)) {
    issues.push(`unknown terrain "${terrain}"`);
  }
  const regionRaw = typeof data.region === "string" ? data.region : "";
  const region = regionRaw.trim();
  if (region.length > TILE_REGION_MAX_LENGTH) {
    issues.push(`region exceeds ${TILE_REGION_MAX_LENGTH} characters`);
  }
  const noteRaw = typeof data.note === "string" ? data.note : void 0;
  const note = noteRaw?.trim();
  if (issues.length) {
    throw new TileValidationError(issues);
  }
  return {
    terrain,
    region,
    note: note || void 0
  };
}
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
function escapeRegex(src) {
  return src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function coordFromFrontmatter(fmc) {
  if (!fmc) return null;
  const r = Number(fmc.row);
  const c = Number(fmc.col);
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  return { r, c };
}
function coordFromLegacyName(file, folderPrefix) {
  const base = file.path.replace(/\\/g, "/").split("/").pop() ?? file.path;
  const prefix = folderPrefix.trim();
  if (!prefix) return null;
  const spaced = new RegExp(`^${escapeRegex(prefix)}s+(-?\\d+),(-?\\d+)\\.md$`, "i");
  const dashed = new RegExp(`^${escapeRegex(prefix)}-r(-?\\d+)-c(-?\\d+)\\.md$`, "i");
  let match = base.match(spaced);
  if (match) return { r: Number(match[1]), c: Number(match[2]) };
  match = base.match(dashed);
  if (match) return { r: Number(match[1]), c: Number(match[2]) };
  return null;
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
  const validated = validateTileData(data, { allowUnknownTerrain: true });
  const terrain = validated.terrain ?? "";
  const region = (validated.region ?? "").trim();
  const mapName = mapNameFromPath(mapPath);
  const bodyNote = (validated.note ?? "Notizen hier \u2026").trim();
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
async function ensureTileSchema(app, mapFile, file, coord, cached) {
  const mapPath = mapFile.path;
  const current = cached ?? await fmFromFile(app, file) ?? {};
  const needsType = current.type !== FM_TYPE;
  const needsMarker = current.smHexTile !== true;
  const needsRow = Number(current.row) !== coord.r;
  const needsCol = Number(current.col) !== coord.c;
  const needsMap = current.map_path !== mapPath;
  if (needsType || needsMarker || needsRow || needsCol || needsMap) {
    await app.fileManager.processFrontMatter(file, (f) => {
      f.type = FM_TYPE;
      f.smHexTile = true;
      f.row = coord.r;
      f.col = coord.c;
      f.map_path = mapPath;
    });
    return await fmFromFile(app, file) ?? { type: FM_TYPE, row: coord.r, col: coord.c, map_path: mapPath };
  }
  return current;
}
async function adoptLegacyTile(app, mapFile, file, folderPath, folderPrefix, cached) {
  if (cached && typeof cached.map_path === "string") return null;
  let coord = coordFromFrontmatter(cached);
  if (!coord) {
    coord = coordFromLegacyName(file, folderPrefix);
  }
  if (!coord) return null;
  const raw = await app.vault.read(file);
  const mapName = mapNameFromPath(mapFile.path);
  const backlinkNeedle = `[[${mapName.toLowerCase()}|`;
  if (!raw.toLowerCase().includes(backlinkNeedle)) return null;
  const desiredPath = (0, import_obsidian3.normalizePath)(`${folderPath}/${fileNameForMap(mapFile, coord)}`);
  if ((0, import_obsidian3.normalizePath)(file.path) !== desiredPath) {
    const existing = app.vault.getAbstractFileByPath(desiredPath);
    if (existing && existing !== file) {
      return null;
    }
    await app.fileManager.renameFile(file, desiredPath);
    const renamed = app.vault.getAbstractFileByPath(desiredPath);
    if (renamed && renamed instanceof import_obsidian3.TFile) {
      file = renamed;
    }
  }
  const ensured = await ensureTileSchema(app, mapFile, file, coord, cached);
  return { file, fmc: ensured, coord };
}
async function listTilesForMap(app, mapFile) {
  const { folder, folderPrefix } = await readOptions(app, mapFile);
  const folderPath = (0, import_obsidian3.normalizePath)(folder);
  const folderPathLower = (folderPath.endsWith("/") ? folderPath : folderPath + "/").toLowerCase();
  const out = [];
  for (const file of app.vault.getFiles()) {
    let tileFile = file;
    const p = tileFile.path.toLowerCase();
    if (!p.startsWith(folderPathLower)) continue;
    if (!p.endsWith(".md")) continue;
    let fmc = fm(app, tileFile);
    if (!fmc || fmc.type !== FM_TYPE) {
      fmc = await fmFromFile(app, tileFile);
    }
    let coord = coordFromFrontmatter(fmc ?? null);
    const mapPath = mapFile.path;
    const hasTargetMap = !!(fmc && fmc.type === FM_TYPE && typeof fmc.map_path === "string" && fmc.map_path === mapPath);
    if (!hasTargetMap) {
      if (fmc && typeof fmc.map_path === "string" && fmc.map_path !== mapPath) {
        continue;
      }
      const adoption = await adoptLegacyTile(app, mapFile, tileFile, folderPath, folderPrefix, fmc ?? null);
      if (!adoption) continue;
      tileFile = adoption.file;
      fmc = adoption.fmc;
      coord = adoption.coord;
    } else if (coord) {
      fmc = await ensureTileSchema(app, mapFile, tileFile, coord, fmc ?? null);
    }
    if (!coord) coord = coordFromFrontmatter(fmc ?? null);
    if (!coord) continue;
    out.push({
      coord,
      file: tileFile,
      data: (() => {
        const terrain = typeof fmc?.terrain === "string" ? fmc.terrain : "";
        const region = typeof fmc?.region === "string" ? fmc.region : "";
        try {
          const validated = validateTileData({ terrain, region }, { allowUnknownTerrain: true });
          return { terrain: validated.terrain, region: validated.region ?? "" };
        } catch (error) {
          console.warn("[salt-marcher] Ignoring invalid tile data", error);
          return { terrain: terrain.trim(), region: region.trim() };
        }
      })()
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
  fmc = await ensureTileSchema(app, mapFile, file, coord, fmc ?? null);
  if (!fmc || fmc.type !== FM_TYPE) return null;
  const raw = await app.vault.read(file);
  const body = raw.replace(/^---[\s\S]*?---\s*/m, "");
  const note = (body.split(/\n{2,}/).map((s) => s.trim()).find(Boolean) ?? "").trim();
  const terrain = typeof fmc.terrain === "string" ? fmc.terrain : "";
  const region = typeof fmc.region === "string" ? fmc.region : "";
  try {
    const validated = validateTileData({ terrain, region, note }, { allowUnknownTerrain: true });
    return validated;
  } catch (error) {
    console.warn("[salt-marcher] Loaded tile contains invalid data", error);
    return { terrain: terrain.trim(), region: region.trim(), note: note || void 0 };
  }
}
async function saveTile(app, mapFile, coord, data) {
  const sanitized = validateTileData(data);
  const mapPath = mapFile.path;
  const { folder, newPath, file } = await resolveTilePath(app, mapFile, coord);
  await ensureFolder(app, folder);
  if (!file) {
    const { folderPrefix } = await readOptions(app, mapFile);
    const md = buildMarkdown(coord, mapPath, folderPrefix, sanitized);
    return await app.vault.create(newPath, md);
  }
  await app.fileManager.processFrontMatter(file, (f) => {
    f.type = FM_TYPE;
    f.smHexTile = true;
    f.row = coord.r;
    f.col = coord.c;
    f.map_path = mapPath;
    if (sanitized.region !== void 0) f.region = sanitized.region ?? "";
    if (sanitized.terrain !== void 0) f.terrain = sanitized.terrain ?? "";
    if (typeof f.terrain !== "string") f.terrain = "";
  });
  if (sanitized.note !== void 0) {
    const raw = await app.vault.read(file);
    const hasFM = /^---[\s\S]*?---/m.test(raw);
    const fmPart = hasFM ? (raw.match(/^---[\s\S]*?---/m) || [""])[0] : "";
    const body = hasFM ? raw.slice(fmPart.length).trimStart() : raw;
    const lines = body.split("\n");
    const keepBacklink = lines.find((l) => /\[\[.*\|\s*↩ Zur Karte\s*\]\]/.test(l));
    const newBody = [keepBacklink ?? "", sanitized.note.trim(), ""].filter(Boolean).join("\n");
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
var import_obsidian3, TILE_TERRAIN_MAX_LENGTH, TILE_REGION_MAX_LENGTH, TileValidationError, FM_TYPE;
var init_hex_notes = __esm({
  "src/core/hex-mapper/hex-notes.ts"() {
    "use strict";
    import_obsidian3 = require("obsidian");
    init_terrain();
    init_options();
    TILE_TERRAIN_MAX_LENGTH = 64;
    TILE_REGION_MAX_LENGTH = 120;
    TileValidationError = class extends Error {
      constructor(issues) {
        super(`Invalid tile data: ${issues.join(", ")}`);
        this.issues = issues;
        this.name = "TileValidationError";
      }
    };
    FM_TYPE = "hex";
  }
});

// src/core/hex-mapper/render/interaction-delegate.ts
function dispatchInteraction(host, coord, phase, nativeEvent) {
  let outcome = null;
  const detail = {
    r: coord.r,
    c: coord.c,
    phase,
    nativeEvent,
    setOutcome(next) {
      outcome = next;
    }
  };
  const evt = new CustomEvent(EVENT_NAME, {
    detail,
    bubbles: true,
    cancelable: true
  });
  host.dispatchEvent(evt);
  if (outcome) return outcome;
  if (evt.defaultPrevented) {
    if (phase === "paint" && nativeEvent instanceof PointerEvent) {
      const pointer = nativeEvent;
      if (pointer.button === 0 || pointer.buttons === 1) {
        return "start-paint";
      }
    }
    return "handled";
  }
  return "default";
}
function createEventBackedInteractionDelegate(host) {
  return {
    onClick(coord, ev) {
      return dispatchInteraction(host, coord, "click", ev);
    },
    onPaintStep(coord, ev) {
      return dispatchInteraction(host, coord, "paint", ev);
    }
  };
}
var EVENT_NAME;
var init_interaction_delegate = __esm({
  "src/core/hex-mapper/render/interaction-delegate.ts"() {
    "use strict";
    EVENT_NAME = "hex:click";
  }
});

// src/core/hex-mapper/render/interaction-adapter.ts
function resolveMapFile(app, mapPath) {
  const abstract = app.vault.getAbstractFileByPath(mapPath);
  return abstract instanceof import_obsidian4.TFile ? abstract : null;
}
function createInteractionAdapter(config) {
  const { app, host, mapPath } = config;
  const defaultDelegate = createEventBackedInteractionDelegate(host);
  const delegateRef = { current: defaultDelegate };
  const handleDefaultClick = async (coord, _ev) => {
    const file = resolveMapFile(app, mapPath);
    if (!file) return;
    const tfile = await saveTile(app, file, coord, { terrain: "" });
    const leaf = getCenterLeaf(app);
    await leaf.openFile(tfile, { active: true });
  };
  const setDelegate = (delegate) => {
    delegateRef.current = delegate ?? defaultDelegate;
  };
  return {
    delegateRef,
    handleDefaultClick,
    setDelegate
  };
}
var import_obsidian4;
var init_interaction_adapter = __esm({
  "src/core/hex-mapper/render/interaction-adapter.ts"() {
    "use strict";
    import_obsidian4 = require("obsidian");
    init_layout();
    init_hex_notes();
    init_interaction_delegate();
  }
});

// src/core/hex-mapper/render/bootstrap.ts
function computeBounds(tiles) {
  if (!tiles.length) return null;
  let minR = Infinity;
  let maxR = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;
  for (const tile of tiles) {
    const { r, c } = tile.coord;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return { minR, maxR, minC, maxC };
}
function buildFallback(bounds) {
  const minR = bounds ? bounds.minR : 0;
  const maxR = bounds ? bounds.maxR : DEFAULT_FALLBACK_SPAN;
  const minC = bounds ? bounds.minC : 0;
  const maxC = bounds ? bounds.maxC : DEFAULT_FALLBACK_SPAN;
  const coords = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      coords.push({ r, c });
    }
  }
  return coords;
}
async function loadTiles(app, mapPath) {
  const file = app.vault.getAbstractFileByPath(mapPath);
  if (!(file instanceof import_obsidian5.TFile)) {
    return [];
  }
  try {
    return await listTilesForMap(app, file);
  } catch {
    return [];
  }
}
async function bootstrapHexTiles(app, mapPath) {
  const tiles = await loadTiles(app, mapPath);
  const bounds = computeBounds(tiles);
  const base = {
    r: bounds ? bounds.minR : 0,
    c: bounds ? bounds.minC : 0
  };
  const initialCoords = tiles.length ? tiles.map((tile) => tile.coord) : buildFallback(bounds);
  return {
    tiles,
    base,
    initialCoords
  };
}
var import_obsidian5, DEFAULT_FALLBACK_SPAN;
var init_bootstrap = __esm({
  "src/core/hex-mapper/render/bootstrap.ts"() {
    "use strict";
    import_obsidian5 = require("obsidian");
    init_hex_notes();
    DEFAULT_FALLBACK_SPAN = 2;
  }
});

// src/core/hex-mapper/hex-render.ts
async function renderHexMap(app, host, opts, mapPath) {
  const radius = opts.radius;
  const padding = DEFAULT_PADDING;
  const { tiles, base, initialCoords } = await bootstrapHexTiles(app, mapPath);
  const scene = createHexScene({
    host,
    radius,
    padding,
    base,
    initialCoords
  });
  const camera = createCameraController(
    scene.svg,
    scene.contentG,
    scene.overlay,
    host,
    { ...CAMERA_OPTIONS }
  );
  const coordinates = createCoordinateTranslator({
    svg: scene.svg,
    contentG: scene.contentG,
    base,
    radius,
    padding
  });
  const interactionAdapter = createInteractionAdapter({ app, host, mapPath });
  const interactions = createInteractionController({
    svg: scene.svg,
    overlay: scene.overlay,
    toContentPoint: coordinates.toContentPoint,
    pointToCoord: coordinates.pointToCoord,
    delegateRef: interactionAdapter.delegateRef,
    onDefaultClick: (coord, ev) => interactionAdapter.handleDefaultClick(coord, ev)
  });
  for (const { coord, data } of tiles) {
    const color = TERRAIN_COLORS[data.terrain] ?? "transparent";
    scene.setFill(coord, color);
  }
  const ensurePolys = (coords) => {
    if (!coords.length) return;
    scene.ensurePolys(coords);
  };
  return {
    svg: scene.svg,
    contentG: scene.contentG,
    overlay: scene.overlay,
    polyByCoord: scene.polyByCoord,
    setFill: (coord, color) => scene.setFill(coord, color),
    ensurePolys,
    setInteractionDelegate: (delegate) => {
      interactionAdapter.setDelegate(delegate);
    },
    destroy: () => {
      interactions.destroy();
      camera.destroy();
      scene.destroy();
    }
  };
}
var DEFAULT_PADDING, CAMERA_OPTIONS;
var init_hex_render = __esm({
  "src/core/hex-mapper/hex-render.ts"() {
    "use strict";
    init_terrain();
    init_scene();
    init_camera_controller();
    init_interactions();
    init_coordinates();
    init_interaction_adapter();
    init_bootstrap();
    init_interaction_delegate();
    DEFAULT_PADDING = 12;
    CAMERA_OPTIONS = { minScale: 0.15, maxScale: 16, zoomSpeed: 1.01 };
  }
});

// src/core/map-maker.ts
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
var init_map_maker = __esm({
  "src/core/map-maker.ts"() {
    "use strict";
    init_hex_notes();
  }
});

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
    new import_obsidian6.Notice(options?.emptyMessage ?? MAP_WORKFLOWS_COPY.notices.emptyMaps);
    return;
  }
  new MapSelectModal(app, files, async (file) => {
    await onSelect(file);
  }).open();
}
function promptCreateMap(app, onCreate, options) {
  new NameInputModal(app, async (name) => {
    const file = await createHexMapFile(app, name);
    new import_obsidian6.Notice(options?.successMessage ?? MAP_WORKFLOWS_COPY.notices.createSuccess);
    await onCreate(file);
  }).open();
}
var import_obsidian6;
var init_map_workflows = __esm({
  "src/ui/map-workflows.ts"() {
    "use strict";
    import_obsidian6 = require("obsidian");
    init_map_maker();
    init_map_list();
    init_options();
    init_hex_render();
    init_modals();
    init_copy();
  }
});

// src/ui/search-dropdown.ts
function enhanceSelectToSearch(select, placeholder = SEARCH_DROPDOWN_COPY.placeholder) {
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
var init_search_dropdown = __esm({
  "src/ui/search-dropdown.ts"() {
    "use strict";
    init_copy();
  }
});

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
var init_brush_circle = __esm({
  "src/apps/cartographer/editor/tools/brush-circle.ts"() {
    "use strict";
  }
});

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
var init_brush_math = __esm({
  "src/apps/cartographer/editor/tools/terrain-brush/brush-math.ts"() {
    "use strict";
  }
});

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
var init_brush = __esm({
  "src/apps/cartographer/editor/tools/terrain-brush/brush.ts"() {
    "use strict";
    init_hex_notes();
    init_brush_math();
    init_terrain();
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
  const p = (0, import_obsidian10.normalizePath)(REGIONS_FILE);
  const existing = app.vault.getAbstractFileByPath(p);
  if (existing instanceof import_obsidian10.TFile) return existing;
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
  const m = md.match(BLOCK_RE);
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
  const replaced = md.match(BLOCK_RE) ? md.replace(BLOCK_RE, block) : md + "\n\n" + block + "\n";
  await app.vault.modify(f, replaced);
}
function watchRegions(app, onChange) {
  const targetPath = (0, import_obsidian10.normalizePath)(REGIONS_FILE);
  const emitUpdate = () => {
    app.workspace.trigger?.("salt:regions-updated");
    onChange?.();
  };
  let notifyTimer = null;
  const scheduleUpdate = () => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      emitUpdate();
    }, 200);
  };
  const handleModify = (file) => {
    if ((0, import_obsidian10.normalizePath)(file.path) !== targetPath) return;
    scheduleUpdate();
  };
  const handleDelete = async (file) => {
    if (!(file instanceof import_obsidian10.TFile) || (0, import_obsidian10.normalizePath)(file.path) !== targetPath) return;
    console.warn(
      "Salt Marcher regions store detected Regions.md deletion; attempting automatic recreation."
    );
    try {
      await ensureRegionsFile(app);
      new import_obsidian10.Notice("Regions.md wurde automatisch neu erstellt.");
    } catch (error) {
      console.error(
        "Salt Marcher regions store failed to recreate Regions.md automatically.",
        error
      );
      new import_obsidian10.Notice("Regions.md konnte nicht automatisch neu erstellt werden. Bitte manuell wiederherstellen.");
    }
    scheduleUpdate();
  };
  app.vault.on("modify", handleModify);
  app.vault.on("delete", handleDelete);
  return () => {
    if (notifyTimer) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
    app.vault.off("modify", handleModify);
    app.vault.off("delete", handleDelete);
  };
}
var import_obsidian10, REGIONS_FILE, BLOCK_RE;
var init_regions_store = __esm({
  "src/core/regions-store.ts"() {
    "use strict";
    import_obsidian10 = require("obsidian");
    REGIONS_FILE = "SaltMarcher/Regions.md";
    BLOCK_RE = /```regions\s*([\s\S]*?)```/i;
  }
});

// src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts
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
      let disposed = false;
      let fillSeq = 0;
      root.createEl("h3", { text: "Region Brush" });
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
      enhanceSelectToSearch(regionSelect, "Search dropdown\u2026");
      const editRegionsBtn = regionRow.createEl("button", { text: "Manage\u2026" });
      editRegionsBtn.onclick = () => ctx.app.commands?.executeCommandById?.("salt-marcher:open-library");
      const fillOptions = async () => {
        const seq = ++fillSeq;
        let regions;
        try {
          regions = await loadRegions(ctx.app);
        } catch (err) {
          console.error("[terrain-brush] failed to load regions", err);
          if (seq === fillSeq) {
            regionSelect.empty();
            state.region = "";
            state.terrain = "";
          }
          return;
        }
        if (disposed || ctx.getAbortSignal()?.aborted || seq !== fillSeq) {
          return;
        }
        regionSelect.empty();
        regionSelect.createEl("option", { text: "(none)", value: "" });
        let matchedTerrain = state.terrain;
        let matchedRegion = state.region;
        for (const r of regions) {
          const value = r.name ?? "";
          const label = r.name || "(unnamed)";
          const opt = regionSelect.createEl("option", { text: label, value });
          if (r.terrain) opt.dataset.terrain = r.terrain;
          if (value === state.region && value) {
            opt.selected = true;
            matchedRegion = value;
            matchedTerrain = opt.dataset.terrain ?? "";
          }
        }
        if (!matchedRegion && state.region) {
          state.region = "";
          state.terrain = "";
          regionSelect.value = "";
        } else {
          state.region = matchedRegion;
          state.terrain = matchedTerrain;
          regionSelect.value = matchedRegion;
        }
      };
      void fillOptions();
      regionSelect.onchange = () => {
        state.region = regionSelect.value;
        const opt = regionSelect.selectedOptions[0];
        state.terrain = opt?.dataset?.terrain ?? "";
      };
      const workspace = ctx.app.workspace;
      const unsubscribe = [];
      const subscribe = (event) => {
        const handler = () => {
          if (!disposed) void fillOptions();
        };
        const token = workspace?.on?.(event, handler);
        if (typeof workspace?.offref === "function" && token) {
          unsubscribe.push(() => workspace.offref(token));
        } else if (typeof token === "function") {
          unsubscribe.push(() => token());
        }
      };
      subscribe("salt:terrains-updated");
      subscribe("salt:regions-updated");
      const modeRow = root.createDiv({ cls: "sm-row" });
      modeRow.createEl("label", { text: "Mode:" });
      const modeSelect = modeRow.createEl("select");
      modeSelect.createEl("option", { text: "Paint", value: "paint" });
      modeSelect.createEl("option", { text: "Erase", value: "erase" });
      modeSelect.value = state.mode;
      modeSelect.onchange = () => {
        state.mode = modeSelect.value;
      };
      enhanceSelectToSearch(modeSelect, "Search dropdown\u2026");
      return () => {
        disposed = true;
        fillSeq += 1;
        unsubscribe.forEach((off) => {
          try {
            off();
          } catch (err) {
            console.error("[terrain-brush] failed to unsubscribe", err);
          }
        });
        radiusInput.oninput = null;
        regionSelect.onchange = null;
        modeSelect.onchange = null;
        editRegionsBtn.onclick = null;
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
        if (missing.length) handles.ensurePolys(missing);
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
var init_brush_options = __esm({
  "src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts"() {
    "use strict";
    init_brush_circle();
    init_brush();
    init_regions_store();
    init_search_dropdown();
    init_brush_math();
  }
});

// src/apps/cartographer/editor/tools/tool-manager.ts
function createToolManager(tools, options) {
  let active = null;
  let switchController = null;
  let destroyed = false;
  const getLifecycleAborted = (localSignal) => {
    if (destroyed) return true;
    if (localSignal?.aborted) return true;
    const lifecycle = options.getLifecycleSignal();
    return lifecycle?.aborted ?? false;
  };
  const teardownActive = (ctx) => {
    if (!active) return;
    if (ctx) {
      try {
        active.module.onDeactivate?.(ctx);
      } catch (err) {
        console.error("[tool-manager] onDeactivate failed", err);
      }
    }
    try {
      (active.cleanup ?? SAFE_CLEANUP)();
    } catch (err) {
      console.error("[tool-manager] cleanup failed", err);
    }
    active = null;
    options.onToolChanged?.(null);
  };
  const switchTo = async (id) => {
    const ctx = options.getContext();
    const host = options.getPanelHost();
    if (!ctx || !host || tools.length === 0) {
      return;
    }
    const next = tools.find((tool) => tool.id === id) ?? tools[0];
    if (active?.module === next && !switchController) {
      return;
    }
    const controller = new AbortController();
    if (switchController) {
      switchController.abort();
    }
    switchController = controller;
    teardownActive(ctx);
    host.empty();
    await yieldMicrotask();
    if (getLifecycleAborted(controller.signal)) {
      switchController = null;
      return;
    }
    let cleanup = null;
    try {
      const result = next.mountPanel(host, ctx);
      cleanup = typeof result === "function" ? result : null;
    } catch (err) {
      console.error("[tool-manager] mountPanel failed", err);
      cleanup = null;
    }
    await yieldMicrotask();
    if (getLifecycleAborted(controller.signal)) {
      try {
        (cleanup ?? SAFE_CLEANUP)();
      } catch (err) {
        console.error("[tool-manager] cleanup failed", err);
      }
      host.empty();
      switchController = null;
      return;
    }
    try {
      next.onActivate?.(ctx);
    } catch (err) {
      console.error("[tool-manager] onActivate failed", err);
    }
    active = { module: next, cleanup };
    options.onToolChanged?.(next);
    if (!getLifecycleAborted(controller.signal) && ctx.getHandles()) {
      try {
        next.onMapRendered?.(ctx);
      } catch (err) {
        console.error("[tool-manager] onMapRendered failed", err);
      }
    }
    if (switchController === controller) {
      switchController = null;
    }
  };
  const notifyMapRendered = () => {
    if (!active) return;
    const ctx = options.getContext();
    if (!ctx || getLifecycleAborted(null) || !ctx.getHandles()) {
      return;
    }
    try {
      active.module.onMapRendered?.(ctx);
    } catch (err) {
      console.error("[tool-manager] onMapRendered failed", err);
    }
  };
  const deactivate = () => {
    const ctx = options.getContext();
    switchController?.abort();
    switchController = null;
    teardownActive(ctx);
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    deactivate();
  };
  const getActive = () => active?.module ?? null;
  return {
    getActive,
    switchTo,
    notifyMapRendered,
    deactivate,
    destroy
  };
}
var yieldMicrotask, SAFE_CLEANUP;
var init_tool_manager = __esm({
  "src/apps/cartographer/editor/tools/tool-manager.ts"() {
    "use strict";
    yieldMicrotask = () => Promise.resolve();
    SAFE_CLEANUP = () => {
    };
  }
});

// src/apps/cartographer/modes/lifecycle.ts
function createModeLifecycle() {
  let signal = null;
  return {
    bind(ctx) {
      signal = ctx.signal;
      return signal;
    },
    get() {
      return signal;
    },
    isAborted() {
      return signal?.aborted ?? false;
    },
    reset() {
      signal = null;
    }
  };
}
var init_lifecycle = __esm({
  "src/apps/cartographer/modes/lifecycle.ts"() {
    "use strict";
  }
});

// src/apps/cartographer/modes/editor.ts
var editor_exports = {};
__export(editor_exports, {
  createEditorMode: () => createEditorMode
});
function createEditorMode() {
  let panel = null;
  let fileLabel = null;
  let toolSelect = null;
  let toolBody = null;
  let statusLabel = null;
  const tools = [createBrushTool()];
  let manager = null;
  let state = {
    file: null,
    handles: null,
    options: null
  };
  let toolCtx = null;
  const setStatus = (msg) => {
    if (!statusLabel) return;
    statusLabel.setText(msg ?? "");
    statusLabel.toggleClass("is-empty", !msg);
  };
  const updateFileLabel = () => {
    if (!fileLabel) return;
    fileLabel.textContent = state.file ? state.file.basename : "No map";
  };
  const updatePanelState = () => {
    const hasHandles = !!state.handles;
    panel?.toggleClass("is-disabled", !hasHandles);
    if (toolSelect) {
      toolSelect.disabled = !hasHandles;
    }
    if (!hasHandles) {
      setStatus(state.file ? "Loading map\u2026" : "No map selected.");
    } else {
      setStatus("");
    }
  };
  const lifecycle = createModeLifecycle();
  const ensureToolCtx = (ctx) => {
    toolCtx = {
      app: ctx.app,
      getFile: () => state.file,
      getHandles: () => state.handles,
      getOptions: () => state.options,
      getAbortSignal: () => lifecycle.get(),
      setStatus
    };
    return toolCtx;
  };
  const isAborted = () => lifecycle.isAborted();
  return {
    id: "editor",
    label: "Editor",
    async onEnter(ctx) {
      lifecycle.bind(ctx);
      state = { ...state };
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
      enhanceSelectToSearch(toolSelect, "Search dropdown\u2026");
      toolSelect.onchange = () => {
        if (isAborted() || !manager) return;
        const target = toolSelect?.value ?? tools[0].id;
        void manager.switchTo(target);
      };
      toolBody = panel.createDiv({ cls: "sm-cartographer__panel-body" });
      statusLabel = panel.createDiv({ cls: "sm-cartographer__panel-status" });
      ensureToolCtx(ctx);
      manager = createToolManager(tools, {
        getContext: () => toolCtx,
        getPanelHost: () => toolBody,
        getLifecycleSignal: () => lifecycle.get(),
        onToolChanged: (tool) => {
          if (!toolSelect) return;
          toolSelect.value = tool?.id ?? "";
        }
      });
      updateFileLabel();
      updatePanelState();
      if (isAborted()) return;
      await manager.switchTo(tools[0].id);
    },
    async onExit(ctx) {
      lifecycle.bind(ctx);
      manager?.destroy();
      manager = null;
      toolCtx = null;
      panel?.remove();
      panel = null;
      fileLabel = null;
      toolSelect = null;
      toolBody = null;
      statusLabel = null;
      lifecycle.reset();
    },
    async onFileChange(file, handles, ctx) {
      lifecycle.bind(ctx);
      state.file = file;
      state.handles = handles;
      state.options = ctx.getOptions();
      updateFileLabel();
      updatePanelState();
      if (!handles) return;
      if (!toolCtx) ensureToolCtx(ctx);
      if (isAborted()) return;
      manager?.notifyMapRendered();
    },
    async onHexClick(coord, _event, ctx) {
      lifecycle.bind(ctx);
      if (isAborted()) return;
      const active = manager?.getActive();
      if (!toolCtx || !active?.onHexClick) return;
      try {
        await active.onHexClick(coord, toolCtx);
      } catch (err) {
        console.error("[editor-mode] onHexClick failed", err);
      }
    }
  };
}
var init_editor = __esm({
  "src/apps/cartographer/modes/editor.ts"() {
    "use strict";
    init_search_dropdown();
    init_brush_options();
    init_tool_manager();
    init_lifecycle();
  }
});

// src/apps/cartographer/modes/inspector.ts
var inspector_exports = {};
__export(inspector_exports, {
  createInspectorMode: () => createInspectorMode
});
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
  const lifecycle = createModeLifecycle();
  const isAborted = () => lifecycle.isAborted();
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
    if (ctx.signal.aborted) return;
    if (!state.selection) return;
    const file = ctx.getFile();
    if (!file) return;
    const handles = ctx.getRenderHandles();
    clearSaveTimer();
    state.saveTimer = window.setTimeout(async () => {
      if (ctx.signal.aborted) return;
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
    if (ctx.signal.aborted) return;
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
      lifecycle.bind(ctx);
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
    async onExit(ctx) {
      lifecycle.bind(ctx);
      clearSaveTimer();
      ui.panel?.remove();
      ui = { panel: null, fileLabel: null, message: null, terrain: null, note: null };
      state = { file: null, handles: null, selection: null, saveTimer: null };
      lifecycle.reset();
    },
    async onFileChange(file, handles, ctx) {
      lifecycle.bind(ctx);
      state.file = file;
      state.handles = handles;
      clearSaveTimer();
      resetInputs();
      updateFileLabel();
      updatePanelState();
      if (state.selection && state.file && state.handles && !isAborted()) {
        await loadSelection(ctx);
      }
    },
    async onHexClick(coord, _event, ctx) {
      lifecycle.bind(ctx);
      if (isAborted()) return;
      if (!state.file || !state.handles) return;
      clearSaveTimer();
      state.selection = coord;
      updateMessage();
      if (isAborted()) return;
      await loadSelection(ctx);
    }
  };
}
var init_inspector = __esm({
  "src/apps/cartographer/modes/inspector.ts"() {
    "use strict";
    init_hex_notes();
    init_terrain();
    init_search_dropdown();
    init_lifecycle();
  }
});

// src/core/terrain-store.ts
async function ensureTerrainFile(app) {
  const p = (0, import_obsidian11.normalizePath)(TERRAIN_FILE);
  const existing = app.vault.getAbstractFileByPath(p);
  if (existing instanceof import_obsidian11.TFile) return existing;
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
  const m = md.match(BLOCK_RE2);
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
  const replaced = md.match(BLOCK_RE2) ? md.replace(BLOCK_RE2, block) : md + "\n\n" + block + "\n";
  await app.vault.modify(f, replaced);
}
function resolveWatcherOptions(maybeCallback) {
  if (typeof maybeCallback === "function") {
    return { onChange: maybeCallback };
  }
  return maybeCallback ?? {};
}
function watchTerrains(app, onChangeOrOptions) {
  const options = resolveWatcherOptions(onChangeOrOptions);
  const handleError = (error, reason) => {
    if (options.onError) {
      try {
        options.onError(error, { reason });
      } catch (loggingError) {
        console.error("[salt-marcher] Terrain watcher error handler threw", loggingError);
      }
    } else {
      console.error(`[salt-marcher] Terrain watcher failed after ${reason} event`, error);
    }
  };
  const update = async (reason) => {
    try {
      if (reason === "delete") {
        await ensureTerrainFile(app);
      }
      const map = await loadTerrains(app);
      setTerrains(map);
      app.workspace.trigger?.("salt:terrains-updated");
      await options.onChange?.();
    } catch (error) {
      handleError(error, reason);
    }
  };
  const maybeUpdate = (reason, file) => {
    if (!(file instanceof import_obsidian11.TFile) || file.path !== TERRAIN_FILE) return;
    void update(reason);
  };
  const refs = ["modify", "delete"].map(
    (event) => app.vault.on(event, (file) => maybeUpdate(event, file))
  );
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const ref of refs) {
      app.vault.offref(ref);
    }
  };
}
var import_obsidian11, TERRAIN_FILE, BLOCK_RE2;
var init_terrain_store = __esm({
  "src/core/terrain-store.ts"() {
    "use strict";
    import_obsidian11 = require("obsidian");
    init_terrain();
    TERRAIN_FILE = "SaltMarcher/Terrains.md";
    BLOCK_RE2 = /```terrain\s*([\s\S]*?)```/i;
  }
});

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
var init_sidebar = __esm({
  "src/apps/cartographer/travel/ui/sidebar.ts"() {
    "use strict";
  }
});

// src/apps/cartographer/travel/render/draw-route.ts
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
var USER_RADIUS, AUTO_RADIUS, HIGHLIGHT_OFFSET, HITBOX_PADDING;
var init_draw_route = __esm({
  "src/apps/cartographer/travel/render/draw-route.ts"() {
    "use strict";
    USER_RADIUS = 7;
    AUTO_RADIUS = 5;
    HIGHLIGHT_OFFSET = 2;
    HITBOX_PADDING = 6;
  }
});

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
var init_route_layer = __esm({
  "src/apps/cartographer/travel/ui/route-layer.ts"() {
    "use strict";
    init_draw_route();
  }
});

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
var init_token_layer = __esm({
  "src/apps/cartographer/travel/ui/token-layer.ts"() {
    "use strict";
  }
});

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
var init_state_store = __esm({
  "src/apps/cartographer/travel/domain/state.store.ts"() {
    "use strict";
  }
});

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
var asUserNode, asAutoNode;
var init_expansion = __esm({
  "src/apps/cartographer/travel/domain/expansion.ts"() {
    "use strict";
    init_hex_geom();
    asUserNode = (rc) => ({ ...rc, kind: "user" });
    asAutoNode = (rc) => ({ ...rc, kind: "auto" });
  }
});

// src/apps/cartographer/travel/domain/terrain.service.ts
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
var init_terrain_service = __esm({
  "src/apps/cartographer/travel/domain/terrain.service.ts"() {
    "use strict";
    init_terrain();
    init_hex_notes();
  }
});

// src/apps/cartographer/travel/domain/persistence.ts
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
var TOKEN_KEY;
var init_persistence = __esm({
  "src/apps/cartographer/travel/domain/persistence.ts"() {
    "use strict";
    init_hex_notes();
    TOKEN_KEY = "token_travel";
  }
});

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
var init_playback = __esm({
  "src/apps/cartographer/travel/domain/playback.ts"() {
    "use strict";
    init_terrain_service();
    init_persistence();
  }
});

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
var init_actions = __esm({
  "src/apps/cartographer/travel/domain/actions.ts"() {
    "use strict";
    init_state_store();
    init_expansion();
    init_playback();
    init_persistence();
  }
});

// src/apps/cartographer/travel/ui/controls.ts
function createPlaybackControls(host, callbacks) {
  const root = host.createDiv({ cls: "sm-cartographer__travel-buttons" });
  const clock = root.createEl("div", { cls: "sm-cartographer__travel-clock", text: "00h" });
  const playBtn = root.createEl("button", {
    cls: "sm-cartographer__travel-button sm-cartographer__travel-button--play",
    text: "Start"
  });
  (0, import_obsidian12.setIcon)(playBtn, "play");
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
  (0, import_obsidian12.setIcon)(stopBtn, "square");
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
  (0, import_obsidian12.setIcon)(resetBtn, "rotate-ccw");
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
var import_obsidian12;
var init_controls = __esm({
  "src/apps/cartographer/travel/ui/controls.ts"() {
    "use strict";
    import_obsidian12 = require("obsidian");
    init_map_workflows();
  }
});

// src/apps/cartographer/modes/travel-guide/playback-controller.ts
var TravelPlaybackController;
var init_playback_controller = __esm({
  "src/apps/cartographer/modes/travel-guide/playback-controller.ts"() {
    "use strict";
    init_controls();
    TravelPlaybackController = class {
      constructor() {
        this.handle = null;
      }
      mount(host, driver) {
        this.dispose();
        this.handle = createPlaybackControls(host.controlsHost, {
          onPlay: () => void driver.play(),
          onStop: () => void driver.pause(),
          onReset: () => void driver.reset(),
          onTempoChange: (value) => driver.setTempo?.(value)
        });
        this.reset();
      }
      sync(state) {
        if (!this.handle) return;
        this.handle.setState({ playing: state.playing, route: state.route });
        this.handle?.setClock?.(state.clockHours ?? 0);
        this.handle?.setTempo?.(state.tempo ?? 1);
      }
      reset() {
        this.handle?.setState({ playing: false, route: [] });
      }
      dispose() {
        this.handle?.destroy();
        this.handle = null;
      }
    };
  }
});

// src/apps/cartographer/travel/ui/drag.controller.ts
function createDragController(deps) {
  const { routeLayerEl, tokenEl, token, adapter, logic, polyToCoord } = deps;
  let isDragging = false;
  let dragKind = null;
  let lastDragRC = null;
  let suppressNextHexClick = false;
  let pointerCaptureOwner = null;
  let activePointerId = null;
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
  function capturePointer(el, pointerId) {
    if (!el || typeof el.setPointerCapture !== "function") {
      pointerCaptureOwner = null;
      activePointerId = null;
      return;
    }
    try {
      el.setPointerCapture(pointerId);
      pointerCaptureOwner = el;
      activePointerId = pointerId;
    } catch {
      pointerCaptureOwner = null;
      activePointerId = null;
    }
  }
  function releasePointerCapture() {
    if (!pointerCaptureOwner || activePointerId == null) {
      pointerCaptureOwner = null;
      activePointerId = null;
      return;
    }
    const el = pointerCaptureOwner;
    try {
      el.releasePointerCapture?.(activePointerId);
    } catch {
    }
    pointerCaptureOwner = null;
    activePointerId = null;
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
    capturePointer(dot ?? t, ev.pointerId);
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
    capturePointer(tokenEl, ev.pointerId);
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
    if (!isDragging) {
      releasePointerCapture();
      return;
    }
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
    releasePointerCapture();
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
    releasePointerCapture();
  }
  function consumeClickSuppression() {
    if (isDragging) return true;
    if (!suppressNextHexClick) return false;
    suppressNextHexClick = false;
    return true;
  }
  return { bind, unbind, consumeClickSuppression };
}
var init_drag_controller = __esm({
  "src/apps/cartographer/travel/ui/drag.controller.ts"() {
    "use strict";
  }
});

// src/apps/cartographer/travel/ui/context-menu.controller.ts
function bindContextMenu(routeLayerEl, logic) {
  const onContextMenu = (ev) => {
    const target = ev.target;
    if (!(target instanceof SVGElement)) return;
    const dot = target.closest(".tg-route-dot, .tg-route-dot-hitbox");
    if (!dot) return;
    const idxAttr = dot.getAttribute("data-idx");
    if (!idxAttr) return;
    const idx = Number(idxAttr);
    if (!Number.isFinite(idx) || idx < 0) return;
    const route = logic.getState().route;
    const node = route[idx];
    if (!node) return;
    const allowDelete = node.kind === "user";
    const canTriggerEncounter = typeof logic.triggerEncounterAt === "function";
    if (!allowDelete && !canTriggerEncounter) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const menu = new import_obsidian13.Menu();
    if (allowDelete) {
      menu.addItem(
        (item) => item.setTitle("Wegpunkt entfernen").setIcon("trash").onClick(() => {
          logic.deleteUserAt(idx);
        })
      );
    }
    if (canTriggerEncounter) {
      menu.addItem(
        (item) => item.setTitle("Encounter hier starten").setIcon("sparkles").onClick(() => {
          void logic.triggerEncounterAt?.(idx);
        })
      );
    }
    menu.showAtMouseEvent(ev);
  };
  routeLayerEl.addEventListener("contextmenu", onContextMenu, { capture: true });
  return () => routeLayerEl.removeEventListener("contextmenu", onContextMenu, { capture: true });
}
var import_obsidian13;
var init_context_menu_controller = __esm({
  "src/apps/cartographer/travel/ui/context-menu.controller.ts"() {
    "use strict";
    import_obsidian13 = require("obsidian");
  }
});

// src/apps/cartographer/travel/ui/contextmenue.ts
var init_contextmenue = __esm({
  "src/apps/cartographer/travel/ui/contextmenue.ts"() {
    "use strict";
    init_context_menu_controller();
  }
});

// src/apps/cartographer/modes/travel-guide/interaction-controller.ts
var TravelInteractionController;
var init_interaction_controller = __esm({
  "src/apps/cartographer/modes/travel-guide/interaction-controller.ts"() {
    "use strict";
    init_drag_controller();
    init_contextmenue();
    TravelInteractionController = class {
      constructor() {
        this.drag = null;
        this.unbindContext = null;
      }
      bind(env, logic) {
        this.dispose();
        this.drag = createDragController({
          routeLayerEl: env.routeLayerEl,
          tokenEl: env.tokenLayerEl,
          token: env.token,
          adapter: env.adapter,
          logic: {
            getState: () => logic.getState(),
            selectDot: (idx) => logic.selectDot(idx),
            moveSelectedTo: (rc) => logic.moveSelectedTo(rc),
            moveTokenTo: (rc) => logic.moveTokenTo(rc)
          },
          polyToCoord: env.polyToCoord
        });
        this.drag.bind();
        this.unbindContext = bindContextMenu(env.routeLayerEl, {
          getState: () => logic.getState(),
          deleteUserAt: (idx) => logic.deleteUserAt(idx),
          triggerEncounterAt: (idx) => logic.triggerEncounterAt?.(idx)
        });
      }
      consumeClickSuppression() {
        return this.drag?.consumeClickSuppression() ?? false;
      }
      dispose() {
        if (this.drag) {
          this.drag.unbind();
          this.drag = null;
        }
        if (this.unbindContext) {
          this.unbindContext();
          this.unbindContext = null;
        }
      }
    };
  }
});

// src/apps/encounter/event-builder.ts
async function createEncounterEventFromTravel(app, ctx, options = {}) {
  const triggeredAt = options.triggeredAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const coord = options.coordOverride ?? ctx?.state?.currentTile ?? ctx?.state?.tokenRC ?? null;
  const mapFile = ctx?.mapFile ?? null;
  let regionName;
  let encounterOdds;
  if (mapFile && coord) {
    try {
      const { loadTile: loadTile2 } = await Promise.resolve().then(() => (init_hex_notes(), hex_notes_exports));
      const tile = await loadTile2(app, mapFile, coord).catch(() => null);
      const tileRegion = typeof tile?.region === "string" ? tile.region : void 0;
      if (tileRegion) {
        regionName = tileRegion;
        try {
          const { loadRegions: loadRegions2 } = await Promise.resolve().then(() => (init_regions_store(), regions_store_exports));
          const regions = await loadRegions2(app);
          const region = regions.find((r) => typeof r?.name === "string" && r.name.toLowerCase() === tileRegion.toLowerCase());
          const odds = region?.encounterOdds;
          if (typeof odds === "number" && Number.isFinite(odds) && odds > 0) {
            encounterOdds = odds;
          }
        } catch (err) {
          console.error("[encounter] failed to resolve region odds", err);
        }
      }
    } catch (err) {
      console.error("[encounter] failed to read tile metadata", err);
    }
  }
  const travelClock = ctx?.state?.clockHours;
  const source = options.source ?? "travel";
  const idPrefix = options.idPrefix ?? source;
  const event = {
    id: `${idPrefix}-${Date.now()}`,
    source,
    triggeredAt,
    coord,
    regionName,
    mapPath: mapFile?.path,
    mapName: mapFile?.basename,
    encounterOdds,
    travelClockHours: typeof travelClock === "number" && Number.isFinite(travelClock) ? travelClock : void 0
  };
  return event;
}
var init_event_builder = __esm({
  "src/apps/encounter/event-builder.ts"() {
    "use strict";
  }
});

// src/apps/cartographer/modes/travel-guide/encounter-gateway.ts
function loadEncounterModule() {
  return Promise.all([
    Promise.resolve().then(() => (init_layout(), layout_exports)),
    Promise.resolve().then(() => (init_view(), view_exports))
  ]).then(([layout, encounter]) => ({
    getRightLeaf: layout.getRightLeaf,
    VIEW_ENCOUNTER: encounter.VIEW_ENCOUNTER
  })).catch((err) => {
    console.error("[travel-mode] failed to load encounter module", err);
    new import_obsidian14.Notice("Encounter-Modul konnte nicht geladen werden.");
    return null;
  });
}
function ensureEncounterModule() {
  if (!encounterModule) {
    encounterModule = loadEncounterModule();
  }
  return encounterModule;
}
function preloadEncounterModule() {
  void ensureEncounterModule();
}
async function openEncounter(app, context) {
  const mod = await ensureEncounterModule();
  if (!mod) return false;
  const issue = describeEncounterContextIssue(context);
  if (issue) {
    console.warn(`[travel-mode] ${issue.log}`, context);
    new import_obsidian14.Notice(issue.message);
  } else if (context) {
    try {
      const event = await createEncounterEventFromTravel(app, context);
      if (event) {
        publishEncounterEvent(event);
      }
    } catch (err) {
      console.error("[travel-mode] failed to publish encounter payload", err);
    }
  }
  const leaf = mod.getRightLeaf(app);
  await leaf.setViewState({ type: mod.VIEW_ENCOUNTER, active: true });
  app.workspace.revealLeaf(leaf);
  return true;
}
function describeEncounterContextIssue(context) {
  if (!context) {
    return {
      message: "Begegnung konnte nicht ge\xF6ffnet werden: Es liegen keine Reisedaten vor.",
      log: "missing travel context for encounter"
    };
  }
  if (!context.mapFile) {
    return {
      message: "Begegnung enth\xE4lt keine Kartendatei. \xD6ffne die Karte erneut und versuche es nochmal.",
      log: "missing map file for encounter context"
    };
  }
  if (!context.state) {
    return {
      message: "Begegnung enth\xE4lt keinen Reisezustand. Aktualisiere den Travel-Guide und versuche es erneut.",
      log: "missing travel state snapshot for encounter context"
    };
  }
  return null;
}
async function publishManualEncounter(app, context, options = {}) {
  try {
    const event = await createEncounterEventFromTravel(app, context, {
      source: "manual",
      idPrefix: options.idPrefix ?? "manual",
      coordOverride: options.coordOverride,
      triggeredAt: options.triggeredAt
    });
    if (event) {
      publishEncounterEvent(event);
    }
  } catch (err) {
    console.error("[travel-mode] failed to publish manual encounter", err);
  }
}
var import_obsidian14, encounterModule;
var init_encounter_gateway = __esm({
  "src/apps/cartographer/modes/travel-guide/encounter-gateway.ts"() {
    "use strict";
    import_obsidian14 = require("obsidian");
    init_session_store();
    init_event_builder();
    encounterModule = null;
  }
});

// src/apps/cartographer/travel/infra/encounter-sync.ts
function createEncounterSync(cfg) {
  let disposed = false;
  let lastHandledId = peekLatestEncounterEvent()?.id ?? null;
  const unsubscribe = subscribeToEncounterEvents((event) => {
    if (disposed) return;
    if (event.id === lastHandledId) return;
    lastHandledId = event.id;
    if (event.source === "travel") {
      return;
    }
    cfg.pausePlayback();
    const shouldOpen = cfg.onExternalEncounter?.(event);
    if (shouldOpen === false) {
      return;
    }
    void cfg.openEncounter();
  });
  return {
    async handleTravelEncounter() {
      cfg.pausePlayback();
      const context = {
        mapFile: cfg.getMapFile(),
        state: cfg.getState()
      };
      const ok = await cfg.openEncounter(context);
      if (!ok) return;
      const latest = peekLatestEncounterEvent();
      if (latest) {
        lastHandledId = latest.id;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    }
  };
}
var init_encounter_sync = __esm({
  "src/apps/cartographer/travel/infra/encounter-sync.ts"() {
    "use strict";
    init_session_store();
  }
});

// src/apps/cartographer/modes/travel-guide.ts
var travel_guide_exports = {};
__export(travel_guide_exports, {
  createTravelGuideMode: () => createTravelGuideMode
});
function createTravelGuideMode() {
  let sidebar = null;
  const playback = new TravelPlaybackController();
  let logic = null;
  const interactions = new TravelInteractionController();
  let routeLayer = null;
  let tokenLayer = null;
  let cleanupFile = null;
  let hostEl = null;
  let terrainEvent = null;
  let lifecycleSignal = null;
  let encounterSync = null;
  const isAborted = () => lifecycleSignal?.aborted ?? false;
  const bailIfAborted = async () => {
    if (!isAborted()) {
      return false;
    }
    await abortLifecycle();
    return true;
  };
  const handleStateChange = (state) => {
    if (routeLayer) {
      routeLayer.draw(state.route, state.editIdx ?? null, state.tokenRC ?? null);
    }
    sidebar?.setTile(state.currentTile ?? state.tokenRC ?? null);
    sidebar?.setSpeed(state.tokenSpeed);
    playback.sync(state);
  };
  const resetUi = () => {
    sidebar?.setTile(null);
    sidebar?.setSpeed(1);
    playback.reset();
  };
  const runCleanupFile = async () => {
    if (!cleanupFile) return;
    const fn = cleanupFile;
    cleanupFile = null;
    try {
      await fn();
    } catch (err) {
      console.error("[travel-mode] cleanupFile failed", err);
    }
  };
  const detachSidebar = () => {
    sidebar?.destroy();
    sidebar = null;
  };
  const releaseTerrainEvent = () => {
    terrainEvent?.off();
    terrainEvent = null;
  };
  const removeTravelClass = () => {
    hostEl?.classList?.remove?.("sm-cartographer--travel");
    hostEl = null;
  };
  const abortLifecycle = async () => {
    await runCleanupFile();
    disposeFile();
    resetUi();
    playback.dispose();
    detachSidebar();
    releaseTerrainEvent();
    removeTravelClass();
  };
  const disposeFile = () => {
    interactions.dispose();
    encounterSync?.dispose();
    encounterSync = null;
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
    if (ctx.signal.aborted) return;
    await setTerrains(await loadTerrains(ctx.app));
  };
  const subscribeToTerrains = (ctx) => {
    if (ctx.signal.aborted) {
      return null;
    }
    const workspace = ctx.app.workspace;
    const ref = workspace.on?.("salt:terrains-updated", () => {
      void ensureTerrains(ctx);
    });
    if (!ref) {
      return null;
    }
    return {
      off: () => {
        workspace.offref?.(ref);
      }
    };
  };
  return {
    id: "travel",
    label: "Travel",
    async onEnter(ctx) {
      lifecycleSignal = ctx.signal;
      if (await bailIfAborted()) {
        return;
      }
      hostEl = ctx.host;
      hostEl.classList.add("sm-cartographer--travel");
      await ensureTerrains(ctx);
      if (await bailIfAborted()) {
        return;
      }
      terrainEvent = subscribeToTerrains(ctx);
      if (await bailIfAborted()) {
        return;
      }
      preloadEncounterModule();
      if (await bailIfAborted()) {
        return;
      }
      ctx.sidebarHost.empty();
      if (await bailIfAborted()) {
        return;
      }
      sidebar = createSidebar(ctx.sidebarHost);
      if (await bailIfAborted()) {
        return;
      }
      sidebar.setTitle?.(ctx.getFile()?.basename ?? "");
      sidebar.onSpeedChange((value) => {
        if (!isAborted()) {
          logic?.setTokenSpeed(value);
        }
      });
      playback.mount(sidebar, {
        play: () => isAborted() ? void 0 : logic?.play() ?? void 0,
        pause: () => isAborted() ? void 0 : logic?.pause(),
        reset: () => isAborted() ? void 0 : logic?.reset(),
        setTempo: (value) => isAborted() ? void 0 : logic?.setTempo?.(value)
      });
      if (await bailIfAborted()) {
        return;
      }
      resetUi();
    },
    async onExit(ctx) {
      lifecycleSignal = ctx.signal;
      await abortLifecycle();
      lifecycleSignal = null;
    },
    async onFileChange(file, handles, ctx) {
      lifecycleSignal = ctx.signal;
      await runCleanupFile();
      disposeFile();
      sidebar?.setTitle?.(file?.basename ?? "");
      resetUi();
      if (await bailIfAborted()) {
        return;
      }
      if (!file || !handles) {
        return;
      }
      const mapLayer = ctx.getMapLayer();
      if (!mapLayer) {
        return;
      }
      routeLayer = createRouteLayer(handles.contentG, (rc) => mapLayer.centerOf(rc));
      tokenLayer = createTokenLayer(handles.contentG);
      const adapter = {
        ensurePolys: (coords) => mapLayer.ensurePolys(coords),
        centerOf: (rc) => mapLayer.centerOf(rc),
        draw: (route, tokenRC) => {
          if (routeLayer) routeLayer.draw(route, null, tokenRC);
        },
        token: tokenLayer
      };
      if (await bailIfAborted()) {
        return;
      }
      const activeLogic = createTravelLogic({
        app: ctx.app,
        minSecondsPerTile: 0.05,
        getMapFile: () => ctx.getFile(),
        adapter,
        onChange: (state) => handleStateChange(state),
        onEncounter: async () => {
          if (isAborted()) {
            return;
          }
          if (encounterSync) {
            await encounterSync.handleTravelEncounter();
          }
        }
      });
      logic = activeLogic;
      encounterSync = createEncounterSync({
        getMapFile: () => ctx.getFile?.() ?? null,
        getState: () => activeLogic.getState(),
        pausePlayback: () => {
          try {
            activeLogic.pause();
          } catch (err) {
            console.error("[travel-mode] pause during encounter sync failed", err);
          }
        },
        openEncounter: (context) => openEncounter(ctx.app, context),
        onExternalEncounter: () => !isAborted()
      });
      const triggerManualEncounterAt = async (idx) => {
        if (!encounterSync || isAborted()) {
          return;
        }
        const state = activeLogic.getState();
        const node = state.route[idx];
        if (!node) {
          return;
        }
        await publishManualEncounter(
          ctx.app,
          {
            mapFile: ctx.getFile?.() ?? null,
            state
          },
          {
            coordOverride: { r: node.r, c: node.c }
          }
        );
      };
      handleStateChange(activeLogic.getState());
      await activeLogic.initTokenFromTiles();
      if (isAborted() || logic !== activeLogic) {
        await runCleanupFile();
        disposeFile();
        return;
      }
      interactions.bind(
        {
          routeLayerEl: routeLayer.el,
          tokenLayerEl: tokenLayer.el,
          token: tokenLayer,
          adapter,
          polyToCoord: mapLayer.polyToCoord
        },
        {
          getState: () => activeLogic.getState(),
          selectDot: (idx) => activeLogic.selectDot(idx),
          moveSelectedTo: (rc) => activeLogic.moveSelectedTo(rc),
          moveTokenTo: (rc) => activeLogic.moveTokenTo(rc),
          deleteUserAt: (idx) => activeLogic.deleteUserAt(idx),
          triggerEncounterAt: (idx) => triggerManualEncounterAt(idx)
        }
      );
      cleanupFile = async () => {
        interactions.dispose();
        encounterSync?.dispose();
        encounterSync = null;
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
      if (await bailIfAborted()) {
        return;
      }
    },
    async onHexClick(coord, event, ctx) {
      lifecycleSignal = ctx.signal;
      if (await bailIfAborted()) {
        return;
      }
      if (interactions.consumeClickSuppression()) {
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
    async onSave(_mode, file, ctx) {
      lifecycleSignal = ctx.signal;
      if (await bailIfAborted()) {
        return false;
      }
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
var init_travel_guide = __esm({
  "src/apps/cartographer/modes/travel-guide.ts"() {
    "use strict";
    init_terrain_store();
    init_terrain();
    init_sidebar();
    init_route_layer();
    init_token_layer();
    init_actions();
    init_playback_controller();
    init_interaction_controller();
    init_encounter_gateway();
    init_encounter_sync();
  }
});

// src/app/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SaltMarcherPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian24 = require("obsidian");
init_view();

// src/apps/cartographer/index.ts
var import_obsidian15 = require("obsidian");

// src/apps/cartographer/presenter.ts
init_options();
init_map_list();

// src/apps/cartographer/travel/ui/map-layer.ts
init_hex_render();
var keyOf3 = (r, c) => `${r},${c}`;
async function createMapLayer(app, host, mapFile, opts) {
  const handles = await renderHexMap(app, host, opts, mapFile.path);
  const polyToCoord = /* @__PURE__ */ new WeakMap();
  for (const [k, poly] of handles.polyByCoord) {
    if (!poly) continue;
    const [r, c] = k.split(",").map(Number);
    polyToCoord.set(poly, { r, c });
  }
  const ensureHandlesPolys = typeof handles.ensurePolys === "function" ? (coords) => handles.ensurePolys(coords) : null;
  function ensurePolys(coords) {
    ensureHandlesPolys?.(coords);
    for (const rc of coords) {
      const poly = handles.polyByCoord.get(keyOf3(rc.r, rc.c));
      if (poly) polyToCoord.set(poly, rc);
    }
  }
  function centerOf(rc) {
    let poly = handles.polyByCoord.get(keyOf3(rc.r, rc.c));
    if (!poly) {
      ensurePolys([rc]);
      poly = handles.polyByCoord.get(keyOf3(rc.r, rc.c));
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

// src/ui/map-manager.ts
var import_obsidian8 = require("obsidian");
init_map_workflows();

// src/ui/confirm-delete.ts
var import_obsidian7 = require("obsidian");
init_copy();
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
    contentEl.createEl("h3", { text: CONFIRM_DELETE_COPY.title });
    const message = contentEl.createEl("p");
    message.textContent = CONFIRM_DELETE_COPY.body(name);
    const input = contentEl.createEl("input", {
      attr: {
        type: "text",
        placeholder: CONFIRM_DELETE_COPY.inputPlaceholder(name),
        style: "width:100%;"
      }
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = btnRow.createEl("button", { text: CONFIRM_DELETE_COPY.buttons.cancel });
    const confirmBtn = btnRow.createEl("button", { text: CONFIRM_DELETE_COPY.buttons.confirm });
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
        new import_obsidian7.Notice(CONFIRM_DELETE_COPY.notices.success);
      } catch (e) {
        console.error(e);
        new import_obsidian7.Notice(CONFIRM_DELETE_COPY.notices.error);
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
var MAP_MANAGER_COPY = {
  notices: {
    missingSelection: "Select a map before deleting.",
    deleteFailed: "Unable to delete the map. Check the developer console for details."
  },
  logs: {
    deleteFailed: "Map deletion failed"
  }
};
function createMapManager(app, options = {}) {
  const notices = {
    missingSelection: options.notices?.missingSelection ?? MAP_MANAGER_COPY.notices.missingSelection,
    deleteFailed: MAP_MANAGER_COPY.notices.deleteFailed
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
      try {
        await deleteMapAndTiles(app, target);
        if (current && current.path === target.path) {
          await applyChange(null);
        }
      } catch (error) {
        console.error(MAP_MANAGER_COPY.logs.deleteFailed, error);
        new import_obsidian8.Notice(notices.deleteFailed);
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

// src/ui/map-header.ts
var import_obsidian9 = require("obsidian");
init_map_workflows();
init_search_dropdown();

// src/core/save.ts
async function saveMap(_app, file) {
  console.warn("[save] saveMap() not implemented. File:", file.path);
}
async function saveMapAs(_app, file) {
  console.warn("[save] saveMapAs() not implemented. File:", file.path);
}

// src/ui/map-header.ts
init_copy();
function createMapHeader(app, host, options) {
  const labels = {
    open: options.labels?.open ?? MAP_HEADER_COPY.labels.open,
    create: options.labels?.create ?? MAP_HEADER_COPY.labels.create,
    delete: options.labels?.delete ?? MAP_HEADER_COPY.labels.delete,
    save: options.labels?.save ?? MAP_HEADER_COPY.labels.save,
    saveAs: options.labels?.saveAs ?? MAP_HEADER_COPY.labels.saveAs,
    trigger: options.labels?.trigger ?? MAP_HEADER_COPY.labels.trigger
  };
  const notices = {
    missingFile: options.notices?.missingFile ?? MAP_HEADER_COPY.notices.missingFile,
    saveSuccess: options.notices?.saveSuccess ?? MAP_HEADER_COPY.notices.saveSuccess,
    saveError: options.notices?.saveError ?? MAP_HEADER_COPY.notices.saveError
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
  (0, import_obsidian9.setIcon)(openBtn, "folder-open");
  applyMapButtonStyle(openBtn);
  openBtn.onclick = () => {
    if (destroyed) return;
    void promptMapSelection(app, async (file) => {
      if (destroyed) return;
      setFileLabel(file);
      await options.onOpen?.(file);
    });
  };
  const createBtn = row1.createEl("button", { text: labels.create });
  (0, import_obsidian9.setIcon)(createBtn, "plus");
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
    (0, import_obsidian9.setIcon)(deleteBtn, "trash");
    applyMapButtonStyle(deleteBtn);
    deleteBtn.onclick = () => {
      if (destroyed) return;
      if (!currentFile) {
        new import_obsidian9.Notice(notices.missingFile);
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
  enhanceSelectToSearch(select, MAP_HEADER_COPY.selectPlaceholder);
  const triggerBtn = row2.createEl("button", { text: labels.trigger });
  applyMapButtonStyle(triggerBtn);
  triggerBtn.onclick = async () => {
    if (destroyed) return;
    const mode = select.value ?? "save";
    const file = currentFile;
    if (!file) {
      await options.onSave?.(mode, null);
      new import_obsidian9.Notice(notices.missingFile);
      return;
    }
    try {
      const handled = await options.onSave?.(mode, file) === true;
      if (!handled) {
        if (mode === "save") await saveMap(app, file);
        else await saveMapAs(app, file);
      }
      new import_obsidian9.Notice(notices.saveSuccess);
    } catch (err) {
      console.error("[map-header] save failed", err);
      new import_obsidian9.Notice(notices.saveError);
    }
  };
  function setFileLabel(file) {
    currentFile = file;
    const label = file?.basename ?? options.emptyLabel ?? "\u2014";
    if (nameBox) {
      nameBox.textContent = label;
    }
    secondaryLeftSlot.dataset.fileLabel = label;
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

// src/apps/cartographer/view-shell/layout.ts
function createCartographerLayout(host) {
  host.empty();
  host.addClass("sm-cartographer");
  const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
  const bodyHost = host.createDiv({ cls: "sm-cartographer__body" });
  const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__map" });
  const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar" });
  return {
    host,
    headerHost,
    bodyHost,
    mapWrapper,
    sidebarHost,
    destroy: () => {
      host.empty();
      host.removeClass("sm-cartographer");
    }
  };
}

// src/ui/view-container.ts
var DEFAULT_CAMERA = {
  minScale: 0.25,
  maxScale: 4,
  zoomSpeed: 1.1
};
function createViewContainer(parent, options = {}) {
  const root = parent.createDiv({ cls: "sm-view-container" });
  if (options.className) root.addClass(options.className);
  const viewport = root.createDiv({ cls: "sm-view-container__viewport" });
  const stage = viewport.createDiv({ cls: "sm-view-container__stage" });
  const overlay = root.createDiv({ cls: "sm-view-container__overlay" });
  overlay.toggleClass("is-visible", false);
  let overlayMessageEl = null;
  const ensureOverlayMessage = () => {
    if (overlayMessageEl && overlayMessageEl.isConnected) return overlayMessageEl;
    overlay.empty();
    overlayMessageEl = overlay.createDiv({ cls: "sm-view-container__overlay-message" });
    return overlayMessageEl;
  };
  let cameraEnabled = options.camera !== false;
  const cameraConfig = {
    ...DEFAULT_CAMERA,
    ...typeof options.camera === "object" ? options.camera : {}
  };
  let camera = { x: 0, y: 0, scale: options.initialScale ?? 1 };
  const applyCamera = () => {
    stage.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  };
  applyCamera();
  let panPointer = null;
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;
  const handlePointerDown = (ev) => {
    if (!cameraEnabled || ev.button !== 1) return;
    ev.preventDefault();
    ev.stopPropagation();
    panPointer = ev.pointerId;
    panStartX = ev.clientX;
    panStartY = ev.clientY;
    panOriginX = camera.x;
    panOriginY = camera.y;
    viewport.setPointerCapture(ev.pointerId);
    viewport.addClass("is-panning");
  };
  const handlePointerMove = (ev) => {
    if (panPointer === null || ev.pointerId !== panPointer) return;
    ev.preventDefault();
    ev.stopPropagation();
    const dx = ev.clientX - panStartX;
    const dy = ev.clientY - panStartY;
    camera = { ...camera, x: panOriginX + dx, y: panOriginY + dy };
    applyCamera();
  };
  const stopPan = (ev) => {
    if (panPointer === null) return;
    if (ev && ev.pointerId !== panPointer) return;
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      viewport.releasePointerCapture(ev.pointerId);
    }
    panPointer = null;
    viewport.removeClass("is-panning");
  };
  const handleWheel = (ev) => {
    if (!cameraEnabled) return;
    ev.preventDefault();
    ev.stopPropagation();
    const delta = ev.deltaY;
    const factor = Math.exp(-delta * 15e-4 * (cameraConfig.zoomSpeed ?? 1));
    const nextScale = Math.min(cameraConfig.maxScale, Math.max(cameraConfig.minScale, camera.scale * factor));
    if (Math.abs(nextScale - camera.scale) < 1e-4) return;
    const rect = viewport.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const worldX = (px - camera.x) / camera.scale;
    const worldY = (py - camera.y) / camera.scale;
    camera = {
      scale: nextScale,
      x: px - worldX * nextScale,
      y: py - worldY * nextScale
    };
    applyCamera();
  };
  if (cameraEnabled) {
    viewport.style.touchAction = "none";
    viewport.addEventListener("pointerdown", handlePointerDown);
    viewport.addEventListener("pointermove", handlePointerMove);
    viewport.addEventListener("pointerup", stopPan);
    viewport.addEventListener("pointercancel", stopPan);
    viewport.addEventListener("pointerleave", stopPan);
    viewport.addEventListener("wheel", handleWheel, { passive: false });
  }
  const setOverlay = (message) => {
    if (!message) {
      overlay.toggleClass("is-visible", false);
      overlay.empty();
      overlayMessageEl = null;
      return;
    }
    const target = ensureOverlayMessage();
    target.setText(message);
    overlay.toggleClass("is-visible", true);
  };
  return {
    rootEl: root,
    viewportEl: viewport,
    stageEl: stage,
    overlayEl: overlay,
    setOverlay,
    clearOverlay() {
      setOverlay(null);
    },
    resetCamera() {
      camera = { x: 0, y: 0, scale: options.initialScale ?? 1 };
      applyCamera();
    },
    destroy() {
      stopPan();
      if (cameraEnabled) {
        viewport.removeEventListener("pointerdown", handlePointerDown);
        viewport.removeEventListener("pointermove", handlePointerMove);
        viewport.removeEventListener("pointerup", stopPan);
        viewport.removeEventListener("pointercancel", stopPan);
        viewport.removeEventListener("pointerleave", stopPan);
        viewport.removeEventListener("wheel", handleWheel);
      }
      root.remove();
    }
  };
}

// src/apps/cartographer/view-shell/map-surface.ts
function createMapSurface(container) {
  const view = createViewContainer(container, { camera: false });
  const mapHost = view.stageEl;
  return {
    containerEl: container,
    view,
    mapHost,
    setOverlay: (content) => {
      view.setOverlay(content);
    },
    clear: () => {
      mapHost.empty();
    },
    destroy: () => {
      view.destroy();
      container.empty();
    }
  };
}

// src/apps/cartographer/view-shell/mode-controller.ts
function createModeController(options) {
  const { onSwitch } = options;
  let currentController = null;
  let destroyed = false;
  let sequence = 0;
  const abortActive = () => {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  };
  const requestMode = async (modeId) => {
    if (destroyed) return;
    sequence += 1;
    const token = sequence;
    if (currentController) {
      currentController.abort();
    }
    const controller = new AbortController();
    currentController = controller;
    try {
      await onSwitch(modeId, { signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) {
        throw error;
      }
    } finally {
      if (currentController === controller && token === sequence) {
        currentController = null;
      }
    }
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    abortActive();
  };
  return {
    requestMode,
    abortActive,
    destroy
  };
}

// src/apps/cartographer/view-shell/mode-registry.ts
function createModeRegistry(options) {
  const { host, onSelect } = options;
  host.addClass("sm-cartographer__mode-switch");
  const dropdown = host.createDiv({ cls: "sm-mode-dropdown" });
  const trigger = dropdown.createEl("button", {
    text: options.initialLabel ?? "Mode",
    attr: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" }
  });
  trigger.addClass("sm-mode-dropdown__trigger");
  const menu = dropdown.createDiv({ cls: "sm-mode-dropdown__menu", attr: { role: "listbox" } });
  const entries = /* @__PURE__ */ new Map();
  let activeId = null;
  let unbindOutsideClick = null;
  let destroyed = false;
  const closeMenu = () => {
    dropdown.removeClass("is-open");
    trigger.setAttr("aria-expanded", "false");
    if (unbindOutsideClick) {
      unbindOutsideClick();
      unbindOutsideClick = null;
    }
  };
  const openMenu = () => {
    dropdown.addClass("is-open");
    trigger.setAttr("aria-expanded", "true");
    const onDocClick = (event) => {
      if (!dropdown.contains(event.target)) closeMenu();
    };
    document.addEventListener("mousedown", onDocClick);
    unbindOutsideClick = () => document.removeEventListener("mousedown", onDocClick);
  };
  trigger.onclick = () => {
    const isOpen = dropdown.classList.contains("is-open");
    if (isOpen) closeMenu();
    else openMenu();
  };
  const updateActive = () => {
    for (const entry of entries.values()) {
      const isActive = entry.mode.id === activeId;
      entry.button.classList.toggle("is-active", isActive);
      entry.button.ariaSelected = isActive ? "true" : "false";
    }
  };
  const ensureEntry = (mode) => {
    const button = menu.createEl("button", {
      text: mode.label,
      attr: { role: "option", type: "button", "data-id": mode.id }
    });
    button.addClass("sm-mode-dropdown__item");
    button.onclick = () => {
      closeMenu();
      onSelect(mode.id);
    };
    const entry = { mode, button };
    entries.set(mode.id, entry);
    return entry;
  };
  const removeEntry = (id) => {
    const entry = entries.get(id);
    if (!entry) return;
    entry.button.remove();
    entries.delete(id);
    if (activeId === id) {
      activeId = null;
    }
  };
  const setModes = (modes) => {
    const incoming = /* @__PURE__ */ new Set();
    for (const mode of modes) {
      incoming.add(mode.id);
      const existing = entries.get(mode.id);
      if (existing) {
        existing.mode = mode;
        existing.button.setText(mode.label);
      } else {
        ensureEntry(mode);
      }
    }
    for (const id of Array.from(entries.keys())) {
      if (!incoming.has(id)) {
        removeEntry(id);
      }
    }
    updateActive();
  };
  const registerMode = (mode) => {
    if (entries.has(mode.id)) {
      setModes([mode]);
      return;
    }
    ensureEntry(mode);
    updateActive();
  };
  const deregisterMode = (id) => {
    removeEntry(id);
    updateActive();
  };
  const setActiveMode = (id) => {
    activeId = id;
    updateActive();
    if (activeId) {
      const entry = entries.get(activeId);
      if (entry) {
        trigger.setText(entry.mode.label);
      }
    }
  };
  const setTriggerLabel = (label) => {
    trigger.setText(label);
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    closeMenu();
    trigger.onclick = null;
    for (const entry of entries.values()) {
      entry.button.onclick = null;
      entry.button.remove();
    }
    entries.clear();
    dropdown.remove();
  };
  return {
    setModes,
    registerMode,
    deregisterMode,
    setActiveMode,
    setTriggerLabel,
    destroy
  };
}

// src/apps/cartographer/view-shell.ts
var DEFAULT_MODE_LABEL = "Mode";
function createCartographerShell(options) {
  const { app, host, initialFile, modes, callbacks } = options;
  const layout = createCartographerLayout(host);
  const mapSurface = createMapSurface(layout.mapWrapper);
  const state = {
    modes: [...modes],
    activeId: modes[0]?.id ?? null,
    label: modes[0]?.label ?? DEFAULT_MODE_LABEL
  };
  let modeRegistry = null;
  let modeController = null;
  const ensureModeRegistry = (slot) => {
    modeRegistry?.destroy();
    modeRegistry = createModeRegistry({
      host: slot,
      initialLabel: state.label,
      onSelect: (modeId) => {
        if (!modeController) return;
        void modeController.requestMode(modeId).catch((error) => {
          console.error("[cartographer] failed to request mode", error);
        });
      }
    });
    modeRegistry.setModes(state.modes);
    modeRegistry.setActiveMode(state.activeId);
  };
  modeController = createModeController({
    onSwitch: async (modeId, ctx) => {
      await callbacks.onModeSelect(modeId, ctx);
    }
  });
  const headerHandle = createMapHeader(app, layout.headerHost, {
    title: "Cartographer",
    initialFile,
    onOpen: async (file) => {
      await callbacks.onOpen(file);
    },
    onCreate: async (file) => {
      await callbacks.onCreate(file);
    },
    onDelete: async (file) => {
      await callbacks.onDelete(file);
    },
    onSave: async (mode, file) => {
      return await callbacks.onSave(mode, file);
    },
    titleRightSlot: (slot) => {
      ensureModeRegistry(slot);
    }
  });
  const onHexClick = async (event) => {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    await callbacks.onHexClick(event.detail, event);
  };
  mapSurface.mapHost.addEventListener("hex:click", onHexClick, { passive: false });
  const setModeActive = (id) => {
    state.activeId = id;
    const activeMode = state.modes.find((mode) => mode.id === id);
    if (activeMode) {
      state.label = activeMode.label;
    }
    modeRegistry?.setActiveMode(id);
  };
  const setModeLabel = (label) => {
    state.label = label;
    modeRegistry?.setTriggerLabel(label);
  };
  const setModes = (nextModes) => {
    state.modes = [...nextModes];
    modeRegistry?.setModes(state.modes);
    const activeMode = state.activeId ? state.modes.find((mode) => mode.id === state.activeId) : null;
    if (!activeMode) {
      state.activeId = null;
      modeRegistry?.setActiveMode(null);
      const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
      setModeLabel(fallbackLabel);
    } else {
      setModeLabel(activeMode.label);
    }
  };
  const registerMode = (mode) => {
    const existingIndex = state.modes.findIndex((entry) => entry.id === mode.id);
    if (existingIndex >= 0) {
      state.modes[existingIndex] = mode;
    } else {
      state.modes.push(mode);
    }
    modeRegistry?.registerMode(mode);
    if (state.activeId === mode.id) {
      setModeLabel(mode.label);
    } else if (!state.activeId) {
      const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
      setModeLabel(fallbackLabel);
    }
  };
  const deregisterMode = (id) => {
    state.modes = state.modes.filter((mode) => mode.id !== id);
    modeRegistry?.deregisterMode(id);
    if (state.activeId === id) {
      state.activeId = null;
      modeRegistry?.setActiveMode(null);
      const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
      setModeLabel(fallbackLabel);
    }
  };
  const destroy = () => {
    mapSurface.mapHost.removeEventListener("hex:click", onHexClick);
    modeController?.destroy();
    modeController = null;
    modeRegistry?.destroy();
    modeRegistry = null;
    headerHandle.destroy();
    mapSurface.destroy();
    layout.destroy();
  };
  const handle = {
    host,
    mapHost: mapSurface.mapHost,
    sidebarHost: layout.sidebarHost,
    setFileLabel: (file) => {
      headerHandle.setFileLabel(file);
    },
    setModeActive,
    setModeLabel,
    setModes,
    registerMode,
    deregisterMode,
    setOverlay: (content) => {
      mapSurface.setOverlay(content);
    },
    clearMap: () => {
      mapSurface.clear();
    },
    destroy
  };
  return handle;
}

// src/apps/cartographer/mode-registry/registry.ts
var defineCartographerModeProvider = (provider) => provider;
var providers = /* @__PURE__ */ new Map();
var listeners2 = /* @__PURE__ */ new Set();
var MAP_INTERACTIONS = ["none", "hex-click"];
var PERSISTENCE_MODES = ["read-only", "manual-save"];
var SIDEBAR_USAGES = ["required", "optional", "hidden"];
var normalizeCapabilities = (providerId, capabilities) => {
  if (!capabilities) {
    throw new Error(
      `[cartographer:mode-registry] provider '${providerId}' must declare capabilities metadata`
    );
  }
  const { mapInteraction, persistence, sidebar } = capabilities;
  if (!MAP_INTERACTIONS.includes(mapInteraction)) {
    throw new Error(
      `[cartographer:mode-registry] provider '${providerId}' declared invalid mapInteraction capability '${mapInteraction}'`
    );
  }
  if (!PERSISTENCE_MODES.includes(persistence)) {
    throw new Error(
      `[cartographer:mode-registry] provider '${providerId}' declared invalid persistence capability '${persistence}'`
    );
  }
  if (!SIDEBAR_USAGES.includes(sidebar)) {
    throw new Error(
      `[cartographer:mode-registry] provider '${providerId}' declared invalid sidebar capability '${sidebar}'`
    );
  }
  return Object.freeze({
    mapInteraction,
    persistence,
    sidebar
  });
};
var cloneMetadata = (metadata) => {
  const keywords = metadata.keywords ? Object.freeze([...metadata.keywords]) : void 0;
  const normalized = Object.freeze({
    ...metadata,
    keywords,
    capabilities: normalizeCapabilities(metadata.id, metadata.capabilities)
  });
  return normalized;
};
var normalizeProvider = (provider) => {
  if (!provider?.metadata?.id) {
    throw new Error("[cartographer:mode-registry] provider metadata requires an id");
  }
  if (!provider.metadata.label) {
    throw new Error(`[cartographer:mode-registry] provider '${provider.metadata.id}' requires a label`);
  }
  if (!provider.metadata.summary) {
    throw new Error(`[cartographer:mode-registry] provider '${provider.metadata.id}' requires a summary`);
  }
  if (!provider.metadata.source) {
    throw new Error(
      `[cartographer:mode-registry] provider '${provider.metadata.id}' requires a source identifier`
    );
  }
  const metadata = cloneMetadata(provider.metadata);
  return {
    provider: {
      ...provider,
      metadata
    },
    metadata
  };
};
var validateModeCapabilities = (mode, metadata) => {
  const { capabilities, id } = metadata;
  if (capabilities.mapInteraction === "hex-click" && typeof mode.onHexClick !== "function") {
    throw new Error(
      `[cartographer:mode-registry] mode '${id}' declares mapInteraction 'hex-click' but does not implement onHexClick()`
    );
  }
  if (capabilities.persistence === "manual-save" && typeof mode.onSave !== "function") {
    throw new Error(
      `[cartographer:mode-registry] mode '${id}' declares persistence 'manual-save' but does not implement onSave()`
    );
  }
  if (capabilities.mapInteraction === "none" && typeof mode.onHexClick === "function") {
    console.warn(
      `[cartographer:mode-registry] mode '${id}' provides onHexClick(), but its capabilities declare mapInteraction 'none'`
    );
  }
};
var createLazyModeWrapper = (entry) => {
  const { metadata, provider } = entry;
  let cached = null;
  let loading = null;
  const load = async () => {
    if (cached) return cached;
    if (!loading) {
      loading = provider.load().then((mode) => {
        if (!mode) {
          throw new Error(
            `[cartographer:mode-registry] provider '${metadata.id}' returned an invalid mode instance`
          );
        }
        if (mode.id && mode.id !== metadata.id) {
          console.warn(
            `[cartographer:mode-registry] mode id '${mode.id}' does not match provider id '${metadata.id}'`
          );
        }
        validateModeCapabilities(mode, metadata);
        cached = mode;
        return mode;
      }).catch((error) => {
        console.error(
          `[cartographer:mode-registry] failed to load mode '${metadata.id}' from '${metadata.source}'`,
          error
        );
        loading = null;
        throw error;
      });
    }
    return loading;
  };
  const invoke = async (key, ...args) => {
    const mode = await load();
    const method = mode[key];
    return await method.apply(mode, args);
  };
  const invokeIfLoaded = async (key, ...args) => {
    if (!cached && !loading) {
      await load();
    }
    const mode = cached;
    if (!mode) return void 0;
    const method = mode[key];
    if (typeof method !== "function") {
      return void 0;
    }
    return await method.apply(mode, args);
  };
  return {
    id: metadata.id,
    label: metadata.label,
    async onEnter(ctx) {
      return await invoke("onEnter", ctx);
    },
    async onExit(ctx) {
      await invokeIfLoaded("onExit", ctx);
    },
    async onFileChange(file, handles, ctx) {
      return await invoke("onFileChange", file, handles, ctx);
    },
    async onHexClick(coord, event, ctx) {
      if (metadata.capabilities.mapInteraction !== "hex-click") {
        return;
      }
      return await invokeIfLoaded("onHexClick", coord, event, ctx);
    },
    async onSave(mode, file, ctx) {
      if (metadata.capabilities.persistence !== "manual-save") {
        return void 0;
      }
      return await invokeIfLoaded("onSave", mode, file, ctx);
    }
  };
};
var createRegisteredProvider = (provider) => {
  const entry = normalizeProvider(provider);
  return {
    ...entry,
    mode: createLazyModeWrapper(entry)
  };
};
var toRegistryEntry = (provider) => ({
  metadata: provider.metadata,
  mode: provider.mode
});
var notifyListeners = (event) => {
  const snapshot = Array.from(listeners2);
  for (const listener of snapshot) {
    try {
      listener(event);
    } catch (error) {
      console.error("[cartographer:mode-registry] listener failed", error);
    }
  }
};
var orderValue = (metadata) => {
  if (metadata.order === void 0 || Number.isNaN(metadata.order)) return Number.POSITIVE_INFINITY;
  return metadata.order;
};
var getSortedProviders = () => {
  return Array.from(providers.values()).sort((a, b) => {
    const orderDiff = orderValue(a.metadata) - orderValue(b.metadata);
    if (orderDiff !== 0) return orderDiff;
    return a.metadata.label.localeCompare(b.metadata.label, void 0, { sensitivity: "base" });
  });
};
var getRegistryEntries = () => {
  return getSortedProviders().map(toRegistryEntry);
};
var registerCartographerModeProvider = (provider) => {
  const entry = createRegisteredProvider(provider);
  const existing = providers.get(entry.metadata.id);
  if (existing) {
    throw new Error(
      `[cartographer:mode-registry] provider with id '${entry.metadata.id}' is already registered by '${existing.metadata.source}'`
    );
  }
  providers.set(entry.metadata.id, entry);
  const entries = getRegistryEntries();
  const index = entries.findIndex((candidate) => candidate.metadata.id === entry.metadata.id);
  if (index >= 0) {
    notifyListeners({
      type: "registered",
      entry: entries[index],
      index,
      entries
    });
  }
  return () => {
    const current = providers.get(entry.metadata.id);
    if (current === entry) {
      providers.delete(entry.metadata.id);
      const remaining = getRegistryEntries();
      notifyListeners({
        type: "deregistered",
        id: entry.metadata.id,
        entries: remaining
      });
    }
  };
};
var createCartographerModesSnapshot = () => {
  return getSortedProviders().map((entry) => entry.mode);
};
var subscribeToCartographerModeRegistry = (listener) => {
  listeners2.add(listener);
  listener({ type: "initial", entries: getRegistryEntries() });
  return () => {
    listeners2.delete(listener);
  };
};

// src/apps/cartographer/mode-registry/providers/editor.ts
var createEditorModeProvider = () => defineCartographerModeProvider({
  metadata: {
    id: "editor",
    label: "Editor",
    summary: "Interaktiver Hex-Map Editor mit Werkzeugpalette und Live-Vorschau.",
    keywords: ["map", "edit", "hex"],
    order: 200,
    source: "core/cartographer/editor",
    version: "1.0.0",
    capabilities: {
      mapInteraction: "hex-click",
      persistence: "read-only",
      sidebar: "required"
    }
  },
  async load() {
    const { createEditorMode: createEditorMode2 } = await Promise.resolve().then(() => (init_editor(), editor_exports));
    return createEditorMode2();
  }
});

// src/apps/cartographer/mode-registry/providers/inspector.ts
var createInspectorModeProvider = () => defineCartographerModeProvider({
  metadata: {
    id: "inspector",
    label: "Inspector",
    summary: "Liest bestehende Karten und stellt Metadaten sowie Hex-Details dar.",
    keywords: ["inspect", "metadata", "analyze"],
    order: 300,
    source: "core/cartographer/inspector",
    version: "1.0.0",
    capabilities: {
      mapInteraction: "hex-click",
      persistence: "read-only",
      sidebar: "required"
    }
  },
  async load() {
    const { createInspectorMode: createInspectorMode2 } = await Promise.resolve().then(() => (init_inspector(), inspector_exports));
    return createInspectorMode2();
  }
});

// src/apps/cartographer/mode-registry/providers/travel-guide.ts
var createTravelGuideModeProvider = () => defineCartographerModeProvider({
  metadata: {
    id: "travel",
    label: "Travel",
    summary: "Pr\xE4sentiert Kurzinformationen und Kartenabschnitte f\xFCr Reisende.",
    keywords: ["travel", "guide", "summary"],
    order: 100,
    source: "core/cartographer/travel-guide",
    version: "1.0.0",
    capabilities: {
      mapInteraction: "hex-click",
      persistence: "manual-save",
      sidebar: "required"
    }
  },
  async load() {
    const { createTravelGuideMode: createTravelGuideMode2 } = await Promise.resolve().then(() => (init_travel_guide(), travel_guide_exports));
    return createTravelGuideMode2();
  }
});

// src/apps/cartographer/mode-registry/index.ts
var coreProvidersRegistered = false;
var ensureCoreProviders = () => {
  if (coreProvidersRegistered) return;
  registerCartographerModeProvider(createTravelGuideModeProvider());
  registerCartographerModeProvider(createEditorModeProvider());
  registerCartographerModeProvider(createInspectorModeProvider());
  coreProvidersRegistered = true;
};
var provideCartographerModes = () => {
  ensureCoreProviders();
  return createCartographerModesSnapshot();
};
var subscribeToModeRegistry = (listener) => {
  ensureCoreProviders();
  return subscribeToCartographerModeRegistry(listener);
};

// src/apps/cartographer/presenter.ts
var createDefaultDeps = (app) => ({
  createShell: (options) => createCartographerShell(options),
  createMapManager: (appInstance, options) => createMapManager(appInstance, options),
  createMapLayer: (appInstance, host, file, opts) => createMapLayer(appInstance, host, file, opts),
  loadHexOptions: async (appInstance, file) => {
    const block = await getFirstHexBlock(appInstance, file);
    if (!block) return null;
    return parseOptions(block);
  },
  provideModes: () => provideCartographerModes(),
  subscribeToModeRegistry: (listener) => subscribeToModeRegistry(listener)
});
var _CartographerPresenter = class _CartographerPresenter {
  constructor(app, deps) {
    this.shell = null;
    this.mapManager = null;
    this.currentFile = null;
    this.currentOptions = null;
    this.mapLayer = null;
    this.activeMode = null;
    this.hostEl = null;
    this.modeChange = Promise.resolve();
    this.transitionTasks = /* @__PURE__ */ new Set();
    this.loadToken = 0;
    this.isMounted = false;
    this.requestedFile = void 0;
    this.modeTransitionSeq = 0;
    this.transition = null;
    this.activeLifecycleController = null;
    this.activeLifecycleContext = null;
    this.unsubscribeModeRegistry = null;
    this.app = app;
    const defaults = createDefaultDeps(app);
    this.deps = { ...defaults, ...deps };
    this.modes = this.deps.provideModes();
    try {
      this.unsubscribeModeRegistry = this.deps.subscribeToModeRegistry((event) => {
        this.handleModeRegistryEvent(event);
      });
    } catch (error) {
      console.error("[cartographer] failed to subscribe to mode registry", error);
    }
  }
  /** Öffnet den Presenter auf dem übergebenen Host. */
  async onOpen(host, fallbackFile) {
    await this.onClose();
    this.hostEl = host;
    const initialFile = this.requestedFile ?? fallbackFile ?? null;
    this.currentFile = initialFile;
    const shellModes = this.modes.map((mode) => ({ id: mode.id, label: mode.label }));
    this.shell = this.deps.createShell({
      app: this.app,
      host,
      initialFile,
      modes: shellModes,
      callbacks: {
        onModeSelect: (id, context) => {
          void this.setMode(id, context);
        },
        onOpen: async (file) => {
          await this.mapManager?.setFile(file);
        },
        onCreate: async (file) => {
          await this.mapManager?.setFile(file);
        },
        onDelete: async () => {
          this.mapManager?.deleteCurrent();
        },
        onSave: async (mode, file) => {
          return await this.handleSave(mode, file);
        },
        onHexClick: async (coord, event) => {
          await this.handleHexClick(coord, event);
        }
      }
    });
    this.mapManager = this.deps.createMapManager(this.app, {
      initialFile,
      onChange: async (file) => {
        await this.handleFileChange(file);
      }
    });
    this.shell.setModeLabel(shellModes[0]?.label ?? "Mode");
    this.shell.setModeActive(shellModes[0]?.id ?? "");
    this.shell.setFileLabel(initialFile);
    this.isMounted = true;
    this.requestedFile = initialFile;
    await this.setMode(shellModes[0]?.id ?? "");
    await this.mapManager.setFile(initialFile);
  }
  /** Schließt den Presenter und räumt Ressourcen auf. */
  async onClose() {
    if (!this.isMounted) {
      this.shell?.destroy();
      this.shell = null;
      this.hostEl = null;
      return;
    }
    this.isMounted = false;
    this.transition?.controller.abort();
    await this.modeChange;
    try {
      const controller = this.activeLifecycleController ?? new AbortController();
      if (!controller.signal.aborted) {
        controller.abort();
      }
      const ctx = this.activeLifecycleContext && this.activeLifecycleContext.signal === controller.signal ? this.activeLifecycleContext : this.createLifecycleContext(controller.signal);
      await this.activeMode?.onExit(ctx);
    } catch (err) {
      console.error("[cartographer] mode exit failed", err);
    }
    this.activeMode = null;
    this.activeLifecycleController = null;
    this.activeLifecycleContext = null;
    await this.teardownLayer();
    this.shell?.destroy();
    this.shell = null;
    this.hostEl = null;
    this.mapManager = null;
  }
  /** Setzt (oder merkt) die gewünschte Karte. */
  async setFile(file) {
    this.requestedFile = file;
    if (!this.isMounted || !this.mapManager) return;
    await this.mapManager.setFile(file);
  }
  get baseModeCtx() {
    if (!this.shell || !this.hostEl) {
      throw new Error("CartographerPresenter is not mounted.");
    }
    return {
      app: this.app,
      host: this.hostEl,
      mapHost: this.shell.mapHost,
      sidebarHost: this.shell.sidebarHost,
      getFile: () => this.currentFile,
      getMapLayer: () => this.mapLayer,
      getRenderHandles: () => this.mapLayer?.handles ?? null,
      getOptions: () => this.currentOptions
    };
  }
  createLifecycleContext(signal) {
    const base = this.baseModeCtx;
    return { ...base, signal };
  }
  ensureActiveLifecycleContext(signal) {
    const current = this.activeLifecycleContext;
    if (current && current.signal === signal) {
      return current;
    }
    const context = this.createLifecycleContext(signal);
    if (this.activeLifecycleController?.signal === signal) {
      this.activeLifecycleContext = context;
    }
    return context;
  }
  getActiveLifecycleSignal() {
    return this.activeLifecycleController?.signal ?? _CartographerPresenter.neverAbortSignal;
  }
  async handleFileChange(file) {
    this.currentFile = file;
    this.shell?.setFileLabel(file);
    await this.refresh();
  }
  async handleSave(mode, file) {
    if (!this.activeMode?.onSave) return false;
    try {
      const ctx = this.ensureActiveLifecycleContext(this.getActiveLifecycleSignal());
      const handled = await this.activeMode.onSave(mode, file, ctx);
      return handled === true;
    } catch (err) {
      console.error("[cartographer] mode onSave failed", err);
      return false;
    }
  }
  async handleHexClick(coord, event) {
    if (!this.activeMode?.onHexClick) return;
    try {
      const ctx = this.ensureActiveLifecycleContext(this.getActiveLifecycleSignal());
      await this.activeMode.onHexClick(coord, event, ctx);
    } catch (err) {
      console.error("[cartographer] mode onHexClick failed", err);
    }
  }
  handleModeRegistryEvent(event) {
    if (!event?.entries) return;
    const previousActiveId = this.activeMode?.id ?? null;
    const nextModes = event.entries.map((entry) => entry.mode);
    this.modes = nextModes;
    const activeMode = previousActiveId ? nextModes.find((mode) => mode.id === previousActiveId) ?? null : null;
    if (!this.shell) {
      if (!activeMode) {
        this.activeMode = null;
      }
      return;
    }
    const shellModes = nextModes.map((mode) => ({ id: mode.id, label: mode.label }));
    if (event.type === "registered") {
      this.shell.registerMode({ id: event.entry.mode.id, label: event.entry.mode.label });
    } else if (event.type === "deregistered") {
      this.shell.deregisterMode(event.id);
    }
    this.shell.setModes(shellModes);
    if (activeMode) {
      this.activeMode = activeMode;
      this.shell.setModeActive(activeMode.id);
      this.shell.setModeLabel(activeMode.label);
      return;
    }
    this.activeMode = null;
    if (!this.isMounted) {
      return;
    }
    const fallbackId = shellModes[0]?.id ?? null;
    if (fallbackId) {
      void this.setMode(fallbackId);
    }
  }
  async setMode(id, ctx) {
    const next = this.modes.find((mode) => mode.id === id) ?? this.modes[0];
    if (!next) return;
    const promise = this.executeModeTransition(next, ctx?.signal ?? null);
    this.trackTransition(promise);
    try {
      await promise;
    } catch (err) {
      console.error("[cartographer] mode transition crashed", err);
    }
  }
  recalcModeChangePromise() {
    if (this.transitionTasks.size === 0) {
      this.modeChange = Promise.resolve();
      return;
    }
    this.modeChange = Promise.allSettled(Array.from(this.transitionTasks)).then(() => void 0);
  }
  trackTransition(promise) {
    this.transitionTasks.add(promise);
    this.recalcModeChangePromise();
    promise.finally(() => {
      this.transitionTasks.delete(promise);
      this.recalcModeChangePromise();
    }).catch(() => {
    });
  }
  bindExternalAbort(transition) {
    const { externalSignal, controller } = transition;
    if (!externalSignal) return () => {
    };
    const abort = () => {
      controller.abort();
    };
    if (externalSignal.aborted) {
      abort();
      return () => {
      };
    }
    externalSignal.addEventListener("abort", abort, { once: true });
    return () => {
      externalSignal.removeEventListener("abort", abort);
    };
  }
  isTransitionAborted(transition) {
    if (transition.controller.signal.aborted) return true;
    if (transition.externalSignal?.aborted) return true;
    if (this.transition && this.transition.id !== transition.id) return true;
    return false;
  }
  async runTransitionStep(transition, phase, action, errorMessage) {
    if (this.isTransitionAborted(transition)) {
      return "aborted";
    }
    transition.phase = phase;
    try {
      await action();
    } catch (err) {
      if (!this.isTransitionAborted(transition)) {
        console.error(errorMessage, err);
      }
    }
    if (this.isTransitionAborted(transition)) {
      return "aborted";
    }
    return "completed";
  }
  async executeModeTransition(next, externalSignal) {
    const previousTransition = this.transition;
    if (previousTransition) {
      previousTransition.controller.abort();
    }
    if (this.activeMode?.id === next.id) {
      if (!(externalSignal?.aborted ?? false)) {
        this.shell?.setModeActive(next.id);
        this.shell?.setModeLabel(next.label);
      }
      return;
    }
    const previousLifecycleContext = this.activeLifecycleContext;
    const previousLifecycleController = this.activeLifecycleController;
    const controller = new AbortController();
    const transition = {
      id: ++this.modeTransitionSeq,
      next,
      previous: this.activeMode,
      controller,
      externalSignal,
      phase: "idle"
    };
    this.transition = transition;
    const detachAbort = this.bindExternalAbort(transition);
    try {
      if (this.isTransitionAborted(transition)) {
        return;
      }
      const previous = transition.previous;
      if (previous) {
        const exitOutcome = await this.runTransitionStep(
          transition,
          "exiting",
          () => {
            if (previousLifecycleController && !previousLifecycleController.signal.aborted) {
              try {
                previousLifecycleController.abort();
              } catch (err) {
                console.error(
                  "[cartographer] failed to abort lifecycle controller",
                  err
                );
              }
            }
            const exitSignal = previousLifecycleContext?.signal ?? previousLifecycleController?.signal ?? _CartographerPresenter.neverAbortSignal;
            const exitCtx = previousLifecycleContext && previousLifecycleContext.signal === exitSignal ? previousLifecycleContext : this.createLifecycleContext(exitSignal);
            return previous.onExit(exitCtx);
          },
          "[cartographer] mode exit failed"
        );
        if (exitOutcome === "aborted") {
          return;
        }
        this.activeMode = null;
        this.activeLifecycleContext = null;
      }
      if (this.isTransitionAborted(transition)) {
        return;
      }
      this.activeLifecycleController = controller;
      const modeCtx = this.ensureActiveLifecycleContext(transition.controller.signal);
      this.activeMode = transition.next;
      if (this.isTransitionAborted(transition)) {
        this.activeMode = null;
        this.activeLifecycleController = null;
        this.activeLifecycleContext = null;
        return;
      }
      const enterOutcome = await this.runTransitionStep(
        transition,
        "entering",
        () => transition.next.onEnter(modeCtx),
        "[cartographer] mode enter failed"
      );
      if (enterOutcome === "aborted") {
        this.activeMode = null;
        this.activeLifecycleController = null;
        this.activeLifecycleContext = null;
        return;
      }
      if (this.isTransitionAborted(transition)) {
        this.activeMode = null;
        this.activeLifecycleController = null;
        this.activeLifecycleContext = null;
        return;
      }
      const fileChangeOutcome = await this.runTransitionStep(
        transition,
        "entering",
        () => transition.next.onFileChange(
          this.currentFile,
          this.mapLayer?.handles ?? null,
          modeCtx
        ),
        "[cartographer] mode file change failed"
      );
      if (fileChangeOutcome === "aborted" && this.activeMode?.id === transition.next.id) {
        this.activeMode = null;
        this.activeLifecycleController = null;
        this.activeLifecycleContext = null;
        return;
      }
      this.shell?.setModeActive(transition.next.id);
      this.shell?.setModeLabel(transition.next.label);
      transition.phase = "idle";
    } catch (err) {
      if (!this.isTransitionAborted(transition)) {
        console.error("[cartographer] mode transition failed", err);
      }
    } finally {
      detachAbort();
      if (this.transition?.id === transition.id) {
        this.transition = null;
      }
      if (!this.activeMode) {
        this.activeLifecycleController = null;
        this.activeLifecycleContext = null;
      }
    }
  }
  async refresh() {
    const token = ++this.loadToken;
    await this.renderMap(token);
  }
  async renderMap(token) {
    await this.teardownLayer();
    if (!this.shell) return;
    const transition = this.transition;
    const signal = transition?.controller.signal ?? this.getActiveLifecycleSignal();
    const ctx = this.ensureActiveLifecycleContext(signal);
    const isTransitionAborted = () => transition ? this.isTransitionAborted(transition) : false;
    if (!this.currentFile) {
      this.shell.clearMap();
      this.shell.setOverlay("Keine Karte ausgew\xE4hlt.");
      this.currentOptions = null;
      if (!isTransitionAborted()) {
        await this.activeMode?.onFileChange(null, null, ctx);
      }
      return;
    }
    let options = null;
    try {
      options = await this.deps.loadHexOptions(this.app, this.currentFile);
    } catch (err) {
      console.error("[cartographer] failed to parse map options", err);
    }
    if (!options) {
      this.shell.clearMap();
      this.shell.setOverlay("Kein hex3x3-Block in dieser Datei.");
      this.currentOptions = null;
      if (!isTransitionAborted()) {
        await this.activeMode?.onFileChange(this.currentFile, null, ctx);
      }
      return;
    }
    try {
      const layer = await this.deps.createMapLayer(this.app, this.shell.mapHost, this.currentFile, options);
      if (token !== this.loadToken || !this.shell) {
        layer.destroy();
        return;
      }
      if (isTransitionAborted()) {
        layer.destroy();
        return;
      }
      this.mapLayer = layer;
      this.currentOptions = options;
      this.shell.setOverlay(null);
      if (!isTransitionAborted()) {
        await this.activeMode?.onFileChange(this.currentFile, this.mapLayer.handles, ctx);
      }
    } catch (err) {
      console.error("[cartographer] failed to render map", err);
      this.shell.clearMap();
      this.shell.setOverlay("Karte konnte nicht geladen werden.");
      this.currentOptions = null;
      if (!isTransitionAborted()) {
        await this.activeMode?.onFileChange(this.currentFile, null, ctx);
      }
    }
  }
  async teardownLayer() {
    if (this.mapLayer) {
      try {
        this.mapLayer.destroy();
      } catch (err) {
        console.error("[cartographer] failed to destroy map layer", err);
      }
      this.mapLayer = null;
    }
    this.shell?.clearMap();
    this.currentOptions = null;
  }
};
_CartographerPresenter.neverAbortSignal = new AbortController().signal;
var CartographerPresenter = _CartographerPresenter;

// src/apps/cartographer/index.ts
var VIEW_TYPE_CARTOGRAPHER = "cartographer-view";
var VIEW_CARTOGRAPHER = VIEW_TYPE_CARTOGRAPHER;
var createProvideModes = () => {
  return () => {
    try {
      return provideCartographerModes();
    } catch (error) {
      console.error("[cartographer] Failed to resolve mode registry", error);
      return [];
    }
  };
};
var CartographerView = class extends import_obsidian15.ItemView {
  constructor(leaf) {
    super(leaf);
    this.hostEl = null;
    this.pendingFile = null;
    this.presenter = new CartographerPresenter(this.app, {
      provideModes: createProvideModes()
    });
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
    this.pendingFile = file;
    void this.presenter.setFile(file ?? null);
  }
  async onOpen() {
    const container = this.containerEl;
    const content = container.children[1];
    content.empty();
    this.hostEl = content.createDiv({ cls: "cartographer-host" });
    const fallbackFile = this.pendingFile ?? this.app.workspace.getActiveFile() ?? null;
    await this.presenter.onOpen(this.hostEl, fallbackFile);
  }
  async onClose() {
    await this.presenter.onClose();
    this.hostEl = null;
  }
};
function getExistingCartographerLeaves(app) {
  return app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
}
function getOrCreateCartographerLeaf(app) {
  const existing = getExistingCartographerLeaves(app);
  if (existing.length > 0) return existing[0];
  return app.workspace.getLeaf(false) ?? app.workspace.getLeaf(true);
}
async function openCartographer(app, file) {
  const leaf = getOrCreateCartographerLeaf(app);
  await leaf.setViewState({ type: VIEW_TYPE_CARTOGRAPHER, active: true });
  app.workspace.revealLeaf(leaf);
  if (file) {
    const view = leaf.view instanceof CartographerView ? leaf.view : null;
    view?.setFile(file);
  }
}
async function detachCartographerLeaves(app) {
  const leaves = getExistingCartographerLeaves(app);
  for (const leaf of leaves) {
    await leaf.detach();
  }
}

// src/apps/library/view.ts
var import_obsidian23 = require("obsidian");

// src/apps/library/view/mode.ts
function scoreName(name, q) {
  if (!q) return 1e-4;
  if (name === q) return 1e3;
  if (name.startsWith(q)) return 900 - (name.length - q.length);
  const idx = name.indexOf(q);
  if (idx >= 0) return 700 - idx;
  const tokenIdx = name.split(/\s+|[-_]/).findIndex((t) => t.startsWith(q));
  if (tokenIdx >= 0) return 600 - tokenIdx * 5;
  return -Infinity;
}
var BaseModeRenderer = class {
  constructor(app, container) {
    this.app = app;
    this.container = container;
    this.query = "";
    this.cleanups = [];
    this.disposed = false;
  }
  async init() {
  }
  setQuery(query) {
    this.query = (query || "").toLowerCase();
    this.render();
  }
  async handleCreate(_name) {
  }
  async destroy() {
    if (this.disposed) return;
    this.disposed = true;
    for (const fn of this.cleanups.splice(0)) {
      try {
        fn();
      } catch {
      }
    }
    this.container.empty();
  }
  isDisposed() {
    return this.disposed;
  }
  registerCleanup(fn) {
    this.cleanups.push(fn);
  }
};

// src/apps/library/core/file-pipeline.ts
var import_obsidian16 = require("obsidian");
function sanitizeVaultFileName(name, fallback) {
  const trimmed = (name ?? "").trim();
  const safeFallback = fallback && fallback.trim() ? fallback.trim() : "Entry";
  if (!trimmed) return safeFallback;
  return trimmed.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/^\.+$/, safeFallback).slice(0, 120);
}
function createVaultFilePipeline(options) {
  const normalizedDir = (0, import_obsidian16.normalizePath)(options.dir);
  const extension = (options.extension || "md").replace(/^\.+/, "");
  const sanitize = options.sanitizeName ? options.sanitizeName : (name) => sanitizeVaultFileName(name, options.defaultBaseName);
  async function ensure(app) {
    let file = app.vault.getAbstractFileByPath(normalizedDir);
    if (file instanceof import_obsidian16.TFolder) return file;
    await app.vault.createFolder(normalizedDir).catch(() => {
    });
    file = app.vault.getAbstractFileByPath(normalizedDir);
    if (file instanceof import_obsidian16.TFolder) return file;
    throw new Error(`Could not create directory ${normalizedDir}`);
  }
  async function list(app) {
    const dir = await ensure(app);
    const out = [];
    const walk = (folder) => {
      for (const child of folder.children) {
        if (child instanceof import_obsidian16.TFolder) walk(child);
        else if (child instanceof import_obsidian16.TFile && child.extension === extension) out.push(child);
      }
    };
    walk(dir);
    return out;
  }
  function watch(app, onChange) {
    const base = `${normalizedDir}/`;
    const isRelevant = (file) => {
      if (!(file instanceof import_obsidian16.TFile || file instanceof import_obsidian16.TFolder)) return false;
      const path = file.path.endsWith("/") ? file.path : `${file.path}/`;
      return path.startsWith(base);
    };
    const handler = (file) => {
      if (isRelevant(file)) onChange?.();
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
  async function create(app, data) {
    const dir = await ensure(app);
    const baseName = sanitize(options.getBaseName(data) ?? options.defaultBaseName);
    let fileName = `${baseName}.${extension}`;
    let path = (0, import_obsidian16.normalizePath)(`${dir.path}/${fileName}`);
    let i = 2;
    while (app.vault.getAbstractFileByPath(path)) {
      fileName = `${baseName} (${i}).${extension}`;
      path = (0, import_obsidian16.normalizePath)(`${dir.path}/${fileName}`);
      i += 1;
    }
    const content = options.toContent(data);
    const file = await app.vault.create(path, content);
    return file;
  }
  return { ensure, list, watch, create };
}

// src/apps/library/core/creature-files.ts
var CREATURES_DIR = "SaltMarcher/Creatures";
var CREATURE_PIPELINE = createVaultFilePipeline({
  dir: CREATURES_DIR,
  defaultBaseName: "Creature",
  getBaseName: (data) => data.name,
  toContent: statblockToMarkdown,
  sanitizeName: (name) => sanitizeVaultFileName(name, "Creature")
});
var ensureCreatureDir = CREATURE_PIPELINE.ensure;
var listCreatureFiles = CREATURE_PIPELINE.list;
var watchCreatureDir = CREATURE_PIPELINE.watch;
function yamlList(items) {
  if (!items || items.length === 0) return void 0;
  const safe = items.map((s) => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", ");
  return `[${safe}]`;
}
function formatSpeedExtra(entry) {
  const parts = [entry.label];
  if (entry.distance) parts.push(entry.distance);
  if (entry.note) parts.push(entry.note);
  if (entry.hover) parts.push("(hover)");
  return parts.map((p) => p?.trim()).filter((p) => Boolean(p && p.length)).join(" ");
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
  const speeds = d.speeds;
  const walkSpeed = speeds?.walk?.distance;
  const swimSpeed = speeds?.swim?.distance;
  const flySpeed = speeds?.fly?.distance;
  const flyHover = speeds?.fly?.hover;
  const burrowSpeed = speeds?.burrow?.distance;
  const climbSpeed = speeds?.climb?.distance;
  if (walkSpeed) lines.push(`speed_walk: "${walkSpeed}"`);
  if (swimSpeed) lines.push(`speed_swim: "${swimSpeed}"`);
  if (flySpeed) lines.push(`speed_fly: "${flySpeed}"`);
  if (flyHover) lines.push(`speed_fly_hover: true`);
  if (burrowSpeed) lines.push(`speed_burrow: "${burrowSpeed}"`);
  if (climbSpeed) lines.push(`speed_climb: "${climbSpeed}"`);
  const extraSpeedStrings = speeds?.extras?.map(formatSpeedExtra) ?? [];
  const speedsYaml = yamlList(extraSpeedStrings);
  if (speedsYaml) lines.push(`speeds: ${speedsYaml}`);
  if (speeds) {
    const json = JSON.stringify(speeds).replace(/"/g, '\\"');
    lines.push(`speeds_json: "${json}"`);
  }
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
  if (extraSpeedStrings.length) speedsLine = extraSpeedStrings.slice();
  else {
    if (walkSpeed) speedsLine.push(`${walkSpeed}`);
    if (climbSpeed) speedsLine.push(`climb ${climbSpeed}`);
    if (swimSpeed) speedsLine.push(`swim ${swimSpeed}`);
    if (flySpeed) speedsLine.push(`fly ${flySpeed}${flyHover ? " (hover)" : ""}`.trim());
    if (burrowSpeed) speedsLine.push(`burrow ${burrowSpeed}`);
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
  return CREATURE_PIPELINE.create(app, d);
}

// src/apps/library/create/creature/modal.ts
var import_obsidian21 = require("obsidian");

// src/apps/library/core/spell-files.ts
var SPELLS_DIR = "SaltMarcher/Spells";
var SPELL_PIPELINE = createVaultFilePipeline({
  dir: SPELLS_DIR,
  defaultBaseName: "Spell",
  getBaseName: (data) => data.name,
  toContent: spellToMarkdown,
  sanitizeName: (name) => sanitizeVaultFileName(name, "Spell")
});
var ensureSpellDir = SPELL_PIPELINE.ensure;
var listSpellFiles = SPELL_PIPELINE.list;
var watchSpellDir = SPELL_PIPELINE.watch;
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
  return SPELL_PIPELINE.create(app, d);
}

// src/apps/library/create/creature/section-basics.ts
init_search_dropdown();

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

// src/apps/library/create/shared/layouts.ts
var import_obsidian18 = require("obsidian");
function createFormCard(parent, options) {
  const { title, subtitle, registerValidator } = options;
  const card = parent.createDiv({ cls: "sm-cc-card" });
  const head = card.createDiv({ cls: "sm-cc-card__head" });
  head.createEl("h3", { text: title, cls: "sm-cc-card__title" });
  if (subtitle) head.createEl("p", { text: subtitle, cls: "sm-cc-card__subtitle" });
  const validation = card.createDiv({ cls: "sm-cc-card__validation", attr: { hidden: "" } });
  const validationList = validation.createEl("ul", { cls: "sm-cc-card__validation-list" });
  const applyValidation = (issues) => {
    const hasIssues = issues.length > 0;
    card.toggleClass("is-invalid", hasIssues);
    if (!hasIssues) {
      validation.setAttribute("hidden", "");
      validation.classList.remove("is-visible");
      validationList.empty();
      return;
    }
    validation.removeAttribute("hidden");
    validation.classList.add("is-visible");
    validationList.empty();
    for (const message of issues) {
      validationList.createEl("li", { text: message });
    }
  };
  const body = card.createDiv({ cls: "sm-cc-card__body" });
  const registerValidation = (compute) => {
    const runner = () => {
      const issues = compute();
      applyValidation(issues);
      return issues;
    };
    return registerValidator ? registerValidator(runner) : runner;
  };
  return { card, body, registerValidation };
}
function createFieldGrid(parent, options) {
  const classes = ["sm-cc-field-grid"];
  if (options?.variant) classes.push(`sm-cc-field-grid--${options.variant}`);
  if (options?.className) {
    const extras = Array.isArray(options.className) ? options.className : [options.className];
    classes.push(...extras);
  }
  const grid = parent.createDiv({ cls: classes.join(" ") });
  const createSetting = (label, settingOptions) => {
    const setting = new import_obsidian18.Setting(grid).setName(label);
    setting.settingEl.addClass("sm-cc-setting");
    const additional = settingOptions?.className;
    if (additional) {
      const extras = Array.isArray(additional) ? additional : [additional];
      setting.settingEl.classList.add(...extras);
    }
    return setting;
  };
  return { grid, createSetting };
}

// src/apps/library/create/creature/section-basics.ts
var SPEED_FIELD_DEFS = [
  { key: "walk", label: "Gehen", placeholder: "30 ft." },
  { key: "climb", label: "Klettern", placeholder: "30 ft." },
  { key: "fly", label: "Fliegen", placeholder: "60 ft.", hoverToggle: true },
  { key: "swim", label: "Schwimmen", placeholder: "40 ft." },
  { key: "burrow", label: "Graben", placeholder: "20 ft." }
];
function ensureSpeeds(data) {
  const speeds = data.speeds ?? (data.speeds = {});
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds;
}
function ensureSpeedExtras(data) {
  const speeds = ensureSpeeds(data);
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds.extras;
}
function applySpeedValue(data, key, patch) {
  const speeds = ensureSpeeds(data);
  const prev = speeds[key] ?? {};
  const next = { ...prev, ...patch };
  const hasContent = Boolean(next.distance?.trim()) || next.hover || Boolean(next.note?.trim());
  if (hasContent) speeds[key] = next;
  else delete speeds[key];
}
function parseExtraInput(raw) {
  let text = raw.trim();
  if (!text) return null;
  let hover = false;
  const hoverMatch = text.match(/\(hover\)$/i);
  if (hoverMatch?.index != null) {
    hover = true;
    text = text.slice(0, hoverMatch.index).trim();
  }
  const distanceMatch = text.match(/(\d.*)$/);
  let label = text;
  let distance;
  if (distanceMatch?.index != null) {
    label = text.slice(0, distanceMatch.index).trim() || text;
    distance = distanceMatch[0].trim();
  }
  return { label, distance, hover };
}
function formatExtra(extra) {
  const parts = [extra.label];
  if (extra.distance) parts.push(extra.distance);
  if (extra.note) parts.push(extra.note);
  if (extra.hover) parts.push("(hover)");
  return parts.map((part) => part?.trim()).filter((part) => Boolean(part && part.length)).join(" ");
}
function mountCreatureBasicsSection(parent, data) {
  const root = parent.createDiv({ cls: "sm-cc-basics" });
  const identity = root.createDiv({ cls: "sm-cc-basics__group" });
  identity.createEl("h5", { text: "Identit\xE4t", cls: "sm-cc-basics__subtitle" });
  const identityGrid = createFieldGrid(identity, { variant: "identity" });
  const nameSetting = identityGrid.createSetting("Name");
  nameSetting.addText((t) => {
    t.setPlaceholder("Aboleth").setValue(data.name || "").onChange((v) => data.name = v.trim());
    t.inputEl.classList.add("sm-cc-input");
  });
  const typeSetting = identityGrid.createSetting("Typ");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.setValue(data.type ?? "");
    dd.onChange((v) => data.type = v);
    dd.selectEl.classList.add("sm-cc-select");
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
    } catch {
    }
  });
  const sizeSetting = identityGrid.createSetting("Gr\xF6\xDFe");
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.setValue(data.size ?? "");
    dd.onChange((v) => data.size = v);
    dd.selectEl.classList.add("sm-cc-select");
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
    } catch {
    }
  });
  const alignmentSetting = identityGrid.createSetting("Gesinnung", {
    className: "sm-cc-setting--inline"
  });
  alignmentSetting.controlEl.addClass("sm-cc-alignment");
  alignmentSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_LAW_CHAOS) dd.addOption(option, option);
    dd.setValue(data.alignmentLawChaos ?? "");
    dd.onChange((v) => data.alignmentLawChaos = v);
    dd.selectEl.classList.add("sm-cc-select");
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown\u2026");
    } catch {
    }
  });
  alignmentSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_GOOD_EVIL) dd.addOption(option, option);
    dd.setValue(data.alignmentGoodEvil ?? "");
    dd.onChange((v) => data.alignmentGoodEvil = v);
    dd.selectEl.classList.add("sm-cc-select");
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown\u2026");
    } catch {
    }
  });
  const stats = root.createDiv({ cls: "sm-cc-basics__group" });
  stats.createEl("h5", { text: "Kernwerte", cls: "sm-cc-basics__subtitle" });
  const statsGrid = createFieldGrid(stats, { variant: "summary" });
  const createStatField = (label, placeholder, key) => {
    const setting = statsGrid.createSetting(label);
    setting.addText((t) => {
      t.setPlaceholder(placeholder).setValue(data[key] ?? "").onChange((v) => data[key] = v.trim());
      t.inputEl.classList.add("sm-cc-input");
    });
  };
  createStatField("HP", "150", "hp");
  createStatField("AC", "17", "ac");
  createStatField("Init", "+7", "initiative");
  createStatField("PB", "+4", "pb");
  createStatField("HD", "20d10 + 40", "hitDice");
  createStatField("CR", "10", "cr");
  createStatField("XP", "5900", "xp");
  const movement = root.createDiv({ cls: "sm-cc-basics__group" });
  movement.createEl("h5", { text: "Bewegung", cls: "sm-cc-basics__subtitle" });
  const speedGrid = createFieldGrid(movement, { variant: "speeds" });
  SPEED_FIELD_DEFS.forEach((def) => {
    const setting = speedGrid.createSetting(def.label, {
      className: "sm-cc-setting--speed"
    });
    const current = ensureSpeeds(data)[def.key];
    const text = setting.addText((t) => {
      t.setPlaceholder(def.placeholder).setValue(current?.distance ?? "").onChange((v) => {
        const trimmed = v.trim();
        applySpeedValue(data, def.key, { distance: trimmed || void 0 });
      });
      t.inputEl.classList.add("sm-cc-input");
    });
    if (def.hoverToggle) {
      let toggle = null;
      toggle = setting.addToggle((tg) => {
        tg.setValue(Boolean(current?.hover));
        tg.onChange((checked) => {
          applySpeedValue(data, def.key, { hover: checked });
        });
      });
      const hoverWrap = setting.controlEl.createDiv({ cls: "sm-cc-hover-wrap" });
      hoverWrap.appendChild(toggle.toggleEl);
      toggle.toggleEl.addClass("sm-cc-hover-toggle");
      toggle.toggleEl.setAttr("aria-label", "Hover markieren");
      hoverWrap.createSpan({ text: "Hover", cls: "sm-cc-hover-label" });
      text.inputEl.addEventListener("blur", () => {
        const speeds = ensureSpeeds(data);
        const target = speeds[def.key];
        text.setValue(target?.distance ?? "");
        toggle?.setValue(Boolean(target?.hover));
      });
    }
  });
  const extras = ensureSpeedExtras(data);
  const extrasEditor = mountTokenEditor(
    movement,
    "Weitere Bewegungen",
    {
      getItems: () => extras.map(formatExtra),
      add: (value) => {
        const parsed = parseExtraInput(value);
        if (!parsed) return;
        const exists = extras.some(
          (entry) => entry.label.toLowerCase() === parsed.label.toLowerCase() && (entry.distance ?? "") === (parsed.distance ?? "") && Boolean(entry.hover) === Boolean(parsed.hover)
        );
        if (!exists) extras.push(parsed);
        extrasEditor.refresh();
      },
      remove: (index) => {
        extras.splice(index, 1);
        extrasEditor.refresh();
      }
    },
    {
      placeholder: "z. B. teleport 30 ft.",
      addButtonLabel: "+ Hinzuf\xFCgen"
    }
  );
  extrasEditor.setting.settingEl.addClass("sm-cc-setting");
}

// src/apps/library/create/creature/section-stats-and-skills.ts
var import_obsidian19 = require("obsidian");
init_search_dropdown();

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
function collectStatsAndSkillsIssues(data) {
  const issues = [];
  const profs = new Set(data.skillsProf ?? []);
  for (const name of data.skillsExpertise ?? []) {
    if (!profs.has(name)) {
      issues.push(`Expertise f\xFCr "${name}" setzt eine Profizient voraus.`);
    }
  }
  return issues;
}
function mountCreatureStatsAndSkillsSection(parent, data, registerValidation) {
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
  const skillsSetting = new import_obsidian19.Setting(root).setName("Fertigkeiten");
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
  const revalidate = registerValidation?.(() => collectStatsAndSkillsIssues(data)) ?? (() => []);
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
        revalidate();
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
    revalidate();
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
    revalidate();
  };
  renderSkillChips();
}

// src/apps/library/create/creature/section-utils.ts
var import_obsidian20 = require("obsidian");
init_search_dropdown();
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
  const setting = new import_obsidian20.Setting(parent).setName(title);
  setting.settingEl.addClass("sm-cc-setting");
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
  const setting = new import_obsidian20.Setting(parent).setName("Schadenstyp-Reaktionen");
  setting.settingEl.addClass("sm-cc-setting");
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
init_search_dropdown();
function collectEntryDependencyIssues(data) {
  const issues = [];
  const entries = data.entries ?? [];
  entries.forEach((entry, index) => {
    const label = entry.name?.trim() || `Eintrag ${index + 1}`;
    if (entry.save_ability && (entry.save_dc == null || Number.isNaN(entry.save_dc))) {
      issues.push(`${label}: Save-DC angeben, wenn ein Attribut gew\xE4hlt wurde.`);
    }
    if (entry.save_dc != null && !Number.isNaN(entry.save_dc) && !entry.save_ability) {
      issues.push(`${label}: Ein Save-DC ben\xF6tigt ein Attribut.`);
    }
    if (entry.save_effect && !entry.save_ability) {
      issues.push(`${label}: Save-Effekt ohne Attribut ist unklar.`);
    }
    if (entry.to_hit_from && !entry.to_hit_from.ability) {
      issues.push(`${label}: Automatische Attacke ben\xF6tigt ein Attribut.`);
    }
    if (entry.damage_from && !entry.damage_from.dice?.trim()) {
      issues.push(`${label}: Automatischer Schaden ben\xF6tigt W\xFCrfelangaben.`);
    }
  });
  return issues;
}
function mountEntriesSection(parent, data, registerValidation) {
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
  const revalidate = registerValidation?.(() => collectEntryDependencyIssues(data)) ?? (() => []);
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
      hit.addEventListener("input", () => {
        e.to_hit = hit.value.trim() || void 0;
        revalidate();
      });
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
      dmg.addEventListener("input", () => {
        e.damage = dmg.value.trim() || void 0;
        revalidate();
      });
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
        revalidate();
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
      saveAb.onchange = () => {
        e.save_ability = saveAb.value || void 0;
        revalidate();
      };
      misc.createEl("label", { text: "DC" });
      const saveDc = misc.createEl("input", { attr: { type: "number", placeholder: "DC", "aria-label": "DC" } });
      saveDc.value = e.save_dc ? String(e.save_dc) : "";
      saveDc.oninput = () => {
        e.save_dc = saveDc.value ? parseInt(saveDc.value, 10) : void 0;
        revalidate();
      };
      saveDc.style.width = "4ch";
      misc.createEl("label", { text: "Save-Effekt" });
      const saveFx = misc.createEl("input", { attr: { type: "text", placeholder: "half on save \u2026", "aria-label": "Save-Effekt" } });
      saveFx.value = e.save_effect || "";
      saveFx.oninput = () => {
        e.save_effect = saveFx.value.trim() || void 0;
        revalidate();
      };
      saveFx.style.width = "18ch";
      misc.createEl("label", { text: "Recharge" });
      const rech = misc.createEl("input", { attr: { type: "text", placeholder: "Recharge 5\u20136 / 1/day" } });
      rech.value = e.recharge || "";
      rech.oninput = () => {
        e.recharge = rech.value.trim() || void 0;
        revalidate();
      };
      box.createEl("label", { text: "Details" });
      const ta = box.createEl("textarea", { cls: "sm-cc-entry-text", attr: { placeholder: "Details (Markdown)" } });
      ta.value = e.text || "";
      ta.addEventListener("input", () => {
        e.text = ta.value;
        revalidate();
      });
    });
    revalidate();
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
var CreateCreatureModal = class extends import_obsidian21.Modal {
  constructor(app, presetName, onSubmit) {
    super(app);
    this.availableSpells = [];
    this.validators = [];
    this.onSubmit = onSubmit;
    this.data = { name: presetName?.trim() || "Neue Kreatur" };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-cc-create-modal");
    this.validators = [];
    const bg = document.querySelector(".modal-bg");
    if (bg) {
      this._bgEl = bg;
      this._bgPrevPointer = bg.style.pointerEvents;
      bg.style.pointerEvents = "none";
    }
    const header = contentEl.createDiv({ cls: "sm-cc-modal-header" });
    header.createEl("h2", { text: "Neuen Statblock erstellen" });
    header.createEl("p", {
      cls: "sm-cc-modal-subtitle",
      text: "Pflege zuerst Grundlagen und Attribute, anschlie\xDFend Sinne, Verteidigungen und Aktionen."
    });
    const layout = contentEl.createDiv({ cls: "sm-cc-layout" });
    const mainColumn = layout.createDiv({ cls: "sm-cc-layout__col sm-cc-layout__col--main" });
    const sideColumn = layout.createDiv({ cls: "sm-cc-layout__col sm-cc-layout__col--side" });
    const fullColumn = layout.createDiv({ cls: "sm-cc-layout__col sm-cc-layout__col--full" });
    const createCard = (column, title, subtitle) => createFormCard(column, {
      title,
      subtitle,
      registerValidator: (runner) => this.addValidator(runner)
    });
    let spellsSectionControls = null;
    void (async () => {
      try {
        const spells = (await listSpellFiles(this.app)).map((f) => f.basename).sort((a, b) => a.localeCompare(b));
        this.availableSpells.splice(0, this.availableSpells.length, ...spells);
        spellsSectionControls?.refreshSpellMatches();
      } catch {
      }
    })();
    const basicsCard = createCard(mainColumn, "Grunddaten", "Name, Typ, Gesinnung und Basiswerte");
    mountCreatureBasicsSection(basicsCard.body, this.data);
    const statsCard = createCard(mainColumn, "Attribute & Fertigkeiten");
    mountCreatureStatsAndSkillsSection(statsCard.body, this.data, statsCard.registerValidation);
    const defensesCard = createCard(sideColumn, "Sinne & Verteidigungen");
    mountCreatureSensesAndDefensesSection(defensesCard.body, this.data);
    const spellsCard = createCard(sideColumn, "Zauber & F\xE4higkeiten");
    spellsSectionControls = mountSpellsKnownSection(spellsCard.body, this.data, () => this.availableSpells);
    const entriesCard = createCard(fullColumn, "Eintr\xE4ge", "Traits, Aktionen, Bonusaktionen, Reaktionen und Legend\xE4res");
    mountEntriesSection(entriesCard.body, this.data, entriesCard.registerValidation);
    const footer = contentEl.createDiv({ cls: "sm-cc-modal-footer" });
    new import_obsidian21.Setting(footer).addButton((b) => b.setButtonText("Abbrechen").onClick(() => this.close())).addButton((b) => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));
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
    const issues = this.runValidators();
    if (issues.length) {
      const firstInvalid = this.contentEl.querySelector(".sm-cc-card.is-invalid");
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!this.data.name || !this.data.name.trim()) return;
    this.close();
    this.onSubmit(this.data);
  }
  addValidator(run) {
    this.validators.push(run);
    return run;
  }
  runValidators() {
    const collected = [];
    for (const validator of this.validators) {
      collected.push(...validator());
    }
    return collected;
  }
};

// src/apps/library/create/spell/modal.ts
var import_obsidian22 = require("obsidian");
init_search_dropdown();

// src/apps/library/create/spell/validation.ts
var SCALING_REQUIRES_LEVEL_MESSAGE = "Skalierende Effekte ben\xF6tigen einen Zaubergrad zwischen 1 und 9.";
var SCALING_DISALLOWS_CANTRIPS_MESSAGE = "Zaubertricks verwenden keine h\xF6heren Zauberstufen \u2013 entferne den Abschnitt oder w\xE4hle Grad 1\u20139.";
function collectSpellScalingIssues(data) {
  const issues = [];
  const scalingText = data.higher_levels?.trim();
  if (!scalingText) return issues;
  const level = data.level;
  if (!Number.isFinite(level)) {
    issues.push(SCALING_REQUIRES_LEVEL_MESSAGE);
    return issues;
  }
  if ((level ?? 0) <= 0) {
    issues.push(SCALING_DISALLOWS_CANTRIPS_MESSAGE);
  }
  return issues;
}

// src/apps/library/create/spell/modal.ts
var CreateSpellModal = class extends import_obsidian22.Modal {
  constructor(app, presetName, onSubmit) {
    super(app);
    this.scalingIssues = [];
    this.runScalingValidation = null;
    this.onSubmit = onSubmit;
    this.data = { name: presetName?.trim() || "Neuer Zauber" };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-cc-create-modal");
    this.scalingIssues = [];
    this.runScalingValidation = null;
    contentEl.createEl("h3", { text: "Neuen Zauber erstellen" });
    new import_obsidian22.Setting(contentEl).setName("Name").addText((t) => {
      t.setPlaceholder("Fireball").setValue(this.data.name).onChange((v) => this.data.name = v.trim());
      t.inputEl.style.width = "28ch";
    });
    new import_obsidian22.Setting(contentEl).setName("Grad").setDesc("0 = Zaubertrick").addDropdown((dd) => {
      for (let i = 0; i <= 9; i++) dd.addOption(String(i), String(i));
      dd.onChange((v) => {
        this.data.level = parseInt(v, 10);
        this.runScalingValidation?.();
      });
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    new import_obsidian22.Setting(contentEl).setName("Schule").addDropdown((dd) => {
      const schools = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
      for (const s of schools) dd.addOption(s, s);
      dd.onChange((v) => this.data.school = v);
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    new import_obsidian22.Setting(contentEl).setName("Wirkzeit").addText((t) => {
      t.setPlaceholder("1 Aktion").onChange((v) => this.data.casting_time = v.trim());
      t.inputEl.style.width = "12ch";
    });
    new import_obsidian22.Setting(contentEl).setName("Reichweite").addText((t) => {
      t.setPlaceholder("60 Fu\xDF").onChange((v) => this.data.range = v.trim());
      t.inputEl.style.width = "12ch";
    });
    const comps = new import_obsidian22.Setting(contentEl).setName("Komponenten");
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
    new import_obsidian22.Setting(contentEl).setName("Materialien").addText((t) => {
      t.setPlaceholder("winzige Kugel aus Guano und Schwefel").onChange((v) => this.data.materials = v.trim());
      t.inputEl.style.width = "34ch";
    });
    new import_obsidian22.Setting(contentEl).setName("Dauer").addText((t) => {
      t.setPlaceholder("Augenblicklich / Konzentration, bis zu 1 Minute").onChange((v) => this.data.duration = v.trim());
      t.inputEl.style.width = "34ch";
    });
    const flags = new import_obsidian22.Setting(contentEl).setName("Flags");
    const cbConc = flags.controlEl.createEl("input", { attr: { type: "checkbox" } });
    flags.controlEl.createEl("label", { text: "Konzentration" });
    const cbRit = flags.controlEl.createEl("input", { attr: { type: "checkbox" } });
    flags.controlEl.createEl("label", { text: "Ritual" });
    cbConc.addEventListener("change", () => this.data.concentration = cbConc.checked);
    cbRit.addEventListener("change", () => this.data.ritual = cbRit.checked);
    new import_obsidian22.Setting(contentEl).setName("Angriff").addDropdown((dd) => {
      const opts = ["", "Melee Spell Attack", "Ranged Spell Attack", "Melee Weapon Attack", "Ranged Weapon Attack"];
      for (const s of opts) dd.addOption(s, s || "(kein)");
      dd.onChange((v) => this.data.attack = v || void 0);
      try {
        enhanceSelectToSearch(dd.selectEl, "Such-dropdown\u2026");
      } catch {
      }
    });
    const save = new import_obsidian22.Setting(contentEl).setName("Rettungswurf");
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
    const dmg = new import_obsidian22.Setting(contentEl).setName("Schaden");
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
    this.addTextArea(
      contentEl,
      "Beschreibung",
      "Beschreibung (Markdown)",
      (v) => this.data.description = v,
      this.data.description
    );
    const higherLevelsField = this.addTextArea(
      contentEl,
      "H\xF6here Grade",
      "Bei h\xF6heren Graden (Markdown)",
      (v) => {
        const trimmed = v.trim();
        this.data.higher_levels = trimmed ? trimmed : void 0;
        this.runScalingValidation?.();
      },
      this.data.higher_levels
    );
    const scalingValidation = higherLevelsField.controlEl.createDiv({ cls: "sm-setting-validation", attr: { hidden: "" } });
    const applyScalingValidation = (issues) => {
      const hasIssues = issues.length > 0;
      higherLevelsField.wrapper.toggleClass("is-invalid", hasIssues);
      if (!hasIssues) {
        scalingValidation.setAttribute("hidden", "");
        scalingValidation.classList.remove("is-visible");
        scalingValidation.empty();
        return;
      }
      scalingValidation.removeAttribute("hidden");
      scalingValidation.classList.add("is-visible");
      scalingValidation.empty();
      const list = scalingValidation.createEl("ul");
      for (const issue of issues) list.createEl("li", { text: issue });
    };
    this.runScalingValidation = () => {
      this.scalingIssues = collectSpellScalingIssues(this.data);
      applyScalingValidation(this.scalingIssues);
    };
    this.runScalingValidation();
    new import_obsidian22.Setting(contentEl).addButton((b) => b.setButtonText("Abbrechen").onClick(() => this.close())).addButton((b) => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));
    this.scope.register([], "Enter", () => this.submit());
  }
  onClose() {
    this.contentEl.empty();
  }
  addTextArea(parent, label, placeholder, onChange, initialValue) {
    const wrap = parent.createDiv({ cls: "setting-item" });
    wrap.createDiv({ cls: "setting-item-info", text: label });
    const ctl = wrap.createDiv({ cls: "setting-item-control" });
    const ta = ctl.createEl("textarea", { attr: { placeholder } });
    if (initialValue != null) ta.value = initialValue;
    ta.addEventListener("input", () => onChange(ta.value));
    return { wrapper: wrap, controlEl: ctl, textarea: ta };
  }
  submit() {
    this.runScalingValidation?.();
    if (this.scalingIssues.length) return;
    if (!this.data.name || !this.data.name.trim()) return;
    this.close();
    this.onSubmit(this.data);
  }
};

// src/apps/library/view/creatures.ts
var CreaturesRenderer = class extends BaseModeRenderer {
  constructor() {
    super(...arguments);
    this.mode = "creatures";
    this.files = [];
  }
  async init() {
    this.files = await listCreatureFiles(this.app);
    const stop = watchCreatureDir(this.app, async () => {
      this.files = await listCreatureFiles(this.app);
      if (!this.isDisposed()) this.render();
    });
    this.registerCleanup(stop);
  }
  render() {
    if (this.isDisposed()) return;
    const list = this.container;
    list.empty();
    const q = this.query;
    const items = this.files.map((f) => ({ name: f.basename, file: f, score: scoreName(f.basename.toLowerCase(), q) })).filter((x) => q ? x.score > -Infinity : true).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    for (const it of items) {
      const row = list.createDiv({ cls: "sm-cc-item" });
      row.createDiv({ cls: "sm-cc-item__name", text: it.name });
      const openBtn = row.createEl("button", { text: "Open" });
      openBtn.onclick = async () => {
        await this.app.workspace.openLinkText(it.file.path, it.file.path, true);
      };
    }
  }
  async handleCreate(name) {
    new CreateCreatureModal(this.app, name, async (data) => {
      const file = await createCreatureFile(this.app, data);
      this.files = await listCreatureFiles(this.app);
      if (!this.isDisposed()) {
        this.render();
        await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
      }
    }).open();
  }
};

// src/apps/library/view/spells.ts
var SpellsRenderer = class extends BaseModeRenderer {
  constructor() {
    super(...arguments);
    this.mode = "spells";
    this.files = [];
  }
  async init() {
    this.files = await listSpellFiles(this.app);
    const stop = watchSpellDir(this.app, async () => {
      this.files = await listSpellFiles(this.app);
      if (!this.isDisposed()) this.render();
    });
    this.registerCleanup(stop);
  }
  render() {
    if (this.isDisposed()) return;
    const list = this.container;
    list.empty();
    const q = this.query;
    const items = this.files.map((f) => ({ name: f.basename, file: f, score: scoreName(f.basename.toLowerCase(), q) })).filter((x) => q ? x.score > -Infinity : true).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    for (const it of items) {
      const row = list.createDiv({ cls: "sm-cc-item" });
      row.createDiv({ cls: "sm-cc-item__name", text: it.name });
      const openBtn = row.createEl("button", { text: "Open" });
      openBtn.onclick = async () => {
        await this.app.workspace.openLinkText(it.file.path, it.file.path, true);
      };
    }
  }
  async handleCreate(name) {
    new CreateSpellModal(this.app, name, async (data) => {
      const file = await createSpellFile(this.app, data);
      this.files = await listSpellFiles(this.app);
      if (!this.isDisposed()) {
        this.render();
        await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
      }
    }).open();
  }
};

// src/apps/library/view/terrains.ts
init_terrain_store();
var SAVE_DEBOUNCE_MS = 500;
var TerrainsRenderer = class extends BaseModeRenderer {
  constructor() {
    super(...arguments);
    this.mode = "terrains";
    this.terrains = {};
    this.saveTimer = null;
    this.dirty = false;
  }
  async init() {
    await ensureTerrainFile(this.app);
    this.terrains = await loadTerrains(this.app);
    this.ensureEmptyKey();
    const stop = watchTerrains(this.app, async () => {
      if (this.isDisposed()) return;
      this.terrains = await loadTerrains(this.app);
      this.ensureEmptyKey();
      this.render();
    });
    this.registerCleanup(stop);
  }
  render() {
    if (this.isDisposed()) return;
    const list = this.container;
    list.empty();
    const q = this.query;
    const names = Object.keys(this.terrains);
    const order = ["", ...names.filter((n) => n !== "")];
    const entries = order.map((name) => ({
      name,
      displayName: name || "",
      score: scoreName(name.toLowerCase(), q)
    })).filter((x) => x.name === "" || (q ? x.score > -Infinity : true)).sort((a, b) => a.name === "" ? -1 : b.name === "" ? 1 : b.score - a.score || a.name.localeCompare(b.name));
    for (const entry of entries) {
      let currentKey = entry.name;
      const row = list.createDiv({ cls: "sm-cc-item" });
      const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } });
      nameInp.value = currentKey;
      const colorInp = row.createEl("input", { attr: { type: "color" } });
      const speedInp = row.createEl("input", { attr: { type: "number", step: "0.1", min: "0" } });
      const delBtn = row.createEl("button", { text: "\u{1F5D1}" });
      const base = this.terrains[currentKey] ?? { color: "transparent", speed: 1 };
      colorInp.value = /^#([0-9a-f]{6})$/i.test(base.color) ? base.color : "#999999";
      speedInp.value = String(Number.isFinite(base.speed) ? base.speed : 1);
      const updateFromInputs = () => {
        const nextKey = nameInp.value.trim();
        const color = colorInp.value || "#999999";
        const speed = parseFloat(speedInp.value);
        const normalizedNext = nextKey || "";
        const normalizedCurrent = currentKey || "";
        this.writeTerrain(currentKey, nextKey, {
          color,
          speed: Number.isFinite(speed) ? speed : 1
        });
        currentKey = normalizedNext;
        if (normalizedNext !== normalizedCurrent) {
          this.render();
        }
      };
      nameInp.addEventListener("change", updateFromInputs);
      nameInp.addEventListener("blur", updateFromInputs);
      nameInp.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          updateFromInputs();
        }
      });
      colorInp.addEventListener("input", () => {
        const speed = parseFloat(speedInp.value);
        const nextKey = nameInp.value.trim();
        this.writeTerrain(currentKey, nextKey, {
          color: colorInp.value || "#999999",
          speed: Number.isFinite(speed) ? speed : 1
        });
        currentKey = nextKey || "";
      });
      speedInp.addEventListener("change", updateFromInputs);
      speedInp.addEventListener("blur", updateFromInputs);
      delBtn.onclick = () => {
        this.deleteTerrain(currentKey);
        this.render();
      };
    }
    if (!entries.length) {
      list.createDiv({ cls: "sm-cc-item" }).setText("No terrains available.");
    }
  }
  async handleCreate(name) {
    const key = name.trim();
    if (!key) return;
    if (!this.terrains[key]) {
      this.terrains[key] = { color: "#888888", speed: 1 };
      this.ensureEmptyKey();
      this.render();
      this.scheduleSave();
    }
  }
  async destroy() {
    await this.flushSave();
    await super.destroy();
  }
  ensureEmptyKey() {
    if (!this.terrains[""]) {
      this.terrains[""] = { color: "transparent", speed: 1 };
    }
  }
  writeTerrain(oldKey, newKey, payload) {
    const next = { ...this.terrains };
    const normalizedOld = oldKey || "";
    const normalizedNew = newKey || "";
    delete next[normalizedOld];
    next[normalizedNew] = payload;
    this.terrains = next;
    this.ensureEmptyKey();
    this.scheduleSave();
  }
  deleteTerrain(key) {
    const normalized = key || "";
    if (normalized === "") return;
    const next = { ...this.terrains };
    delete next[normalized];
    this.terrains = next;
    this.ensureEmptyKey();
    this.scheduleSave();
  }
  scheduleSave() {
    if (this.isDisposed()) return;
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flushSave();
    }, SAVE_DEBOUNCE_MS);
  }
  async flushSave() {
    if (!this.dirty) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      return;
    }
    this.dirty = false;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await saveTerrains(this.app, this.terrains);
    this.terrains = await loadTerrains(this.app);
    this.ensureEmptyKey();
    if (!this.isDisposed()) this.render();
  }
};

// src/apps/library/view/regions.ts
init_search_dropdown();
init_regions_store();
init_terrain_store();
var SAVE_DEBOUNCE_MS2 = 500;
var RegionsRenderer = class extends BaseModeRenderer {
  constructor() {
    super(...arguments);
    this.mode = "regions";
    this.regions = [];
    this.terrainNames = [];
    this.saveTimer = null;
    this.dirty = false;
  }
  async init() {
    await ensureRegionsFile(this.app);
    [this.regions, this.terrainNames] = await Promise.all([
      loadRegions(this.app),
      this.loadTerrainNames()
    ]);
    const stopRegions = watchRegions(this.app, async () => {
      if (this.isDisposed()) return;
      this.regions = await loadRegions(this.app);
      this.render();
    });
    const stopTerrains = watchTerrains(this.app, async () => {
      if (this.isDisposed()) return;
      this.terrainNames = await this.loadTerrainNames();
      this.render();
    });
    this.registerCleanup(stopRegions);
    this.registerCleanup(stopTerrains);
  }
  render() {
    if (this.isDisposed()) return;
    const list = this.container;
    list.empty();
    const q = this.query;
    const entries = this.regions.map((region, index) => ({ region, index, score: scoreName((region.name || "").toLowerCase(), q) })).filter((item) => (item.region.name || "").trim()).filter((item) => q ? item.score > -Infinity : true).sort((a, b) => b.score - a.score || (a.region.name || "").localeCompare(b.region.name || ""));
    for (const entry of entries) {
      const region = entry.region;
      const row = list.createDiv({ cls: "sm-cc-item" });
      const nameInp = row.createEl("input", { attr: { type: "text", placeholder: "(Name)" } });
      nameInp.value = region.name || "";
      nameInp.addEventListener("input", () => {
        region.name = nameInp.value;
        this.scheduleSave();
      });
      const terrSel = row.createEl("select");
      enhanceSelectToSearch(terrSel, "Search options\u2026");
      this.populateTerrainOptions(terrSel, region.terrain || "");
      terrSel.addEventListener("change", () => {
        region.terrain = terrSel.value;
        this.scheduleSave();
      });
      const encInp = row.createEl("input", { attr: { type: "number", min: "1", step: "1", placeholder: "Encounter 1/n" } });
      encInp.value = region.encounterOdds && region.encounterOdds > 0 ? String(region.encounterOdds) : "";
      encInp.addEventListener("input", () => {
        const val = parseInt(encInp.value, 10);
        region.encounterOdds = Number.isFinite(val) && val > 0 ? val : void 0;
        this.scheduleSave();
      });
      const delBtn = row.createEl("button", { text: "\u{1F5D1}" });
      delBtn.onclick = () => {
        this.removeRegion(entry.index);
      };
    }
    if (!entries.length) {
      list.createDiv({ cls: "sm-cc-item" }).setText("No regions available.");
    }
  }
  async handleCreate(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = this.regions.some((r) => (r.name || "").toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    this.regions.push({ name: trimmed, terrain: "" });
    this.render();
    this.scheduleSave();
  }
  async destroy() {
    await this.flushSave();
    await super.destroy();
  }
  populateTerrainOptions(select, selected) {
    select.empty();
    const options = Array.from(/* @__PURE__ */ new Set(["", ...this.terrainNames]));
    for (const name of options) {
      const option = select.createEl("option", { text: name || "(empty)", value: name });
      option.selected = name === selected;
    }
  }
  async loadTerrainNames() {
    const terrains = await loadTerrains(this.app);
    return Object.keys(terrains || {});
  }
  removeRegion(index) {
    if (!this.regions[index]) return;
    this.regions.splice(index, 1);
    this.render();
    this.scheduleSave();
  }
  scheduleSave() {
    if (this.isDisposed()) return;
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flushSave();
    }, SAVE_DEBOUNCE_MS2);
  }
  async flushSave() {
    if (!this.dirty) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      return;
    }
    this.dirty = false;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await saveRegions(this.app, this.regions);
    this.regions = await loadRegions(this.app);
    if (!this.isDisposed()) this.render();
  }
};

// src/apps/library/core/sources.ts
init_terrain_store();
init_regions_store();
var SOURCE_MAP = Object.freeze({
  creatures: {
    ensure: ensureCreatureDir,
    description: `${CREATURES_DIR}/`
  },
  spells: {
    ensure: ensureSpellDir,
    description: `${SPELLS_DIR}/`
  },
  terrains: {
    ensure: ensureTerrainFile,
    description: TERRAIN_FILE
  },
  regions: {
    ensure: ensureRegionsFile,
    description: REGIONS_FILE
  }
});
var LIBRARY_SOURCE_IDS = Object.freeze(Object.keys(SOURCE_MAP));
async function ensureLibrarySource(app, source) {
  const spec = SOURCE_MAP[source];
  if (!spec) throw new Error(`Unknown library source: ${source}`);
  await spec.ensure(app);
}
async function ensureLibrarySources(app, sources) {
  const requested = sources ? Array.from(new Set(sources)) : LIBRARY_SOURCE_IDS;
  await Promise.all(requested.map((source) => ensureLibrarySource(app, source)));
}
function describeLibrarySource(source) {
  const spec = SOURCE_MAP[source];
  if (!spec) throw new Error(`Unknown library source: ${source}`);
  return spec.description;
}

// src/apps/library/view.ts
var LIBRARY_COPY = {
  title: "Library",
  searchPlaceholder: "Search the library or enter a name\u2026",
  createButton: "Create entry",
  modes: {
    creatures: "Creatures",
    spells: "Spells",
    terrains: "Terrains",
    regions: "Regions"
  },
  sources: {
    prefix: "Source: "
  }
};
var VIEW_LIBRARY = "salt-library";
var LibraryView = class extends import_obsidian23.ItemView {
  constructor() {
    super(...arguments);
    this.mode = "creatures";
    this.query = "";
    this.headerButtons = /* @__PURE__ */ new Map();
  }
  getViewType() {
    return VIEW_LIBRARY;
  }
  getDisplayText() {
    return LIBRARY_COPY.title;
  }
  getIcon() {
    return "library";
  }
  async onOpen() {
    this.contentEl.addClass("sm-library");
    await ensureLibrarySources(this.app);
    this.renderShell();
    await this.activateMode(this.mode);
  }
  async onClose() {
    await this.activeRenderer?.destroy();
    this.activeRenderer = void 0;
    this.contentEl.removeClass("sm-library");
  }
  renderShell() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: LIBRARY_COPY.title });
    const header = root.createDiv({ cls: "sm-lib-header" });
    const mkBtn = (label, m) => {
      const b = header.createEl("button", { text: label });
      this.headerButtons.set(m, b);
      b.onclick = () => {
        void this.activateMode(m);
      };
      return b;
    };
    mkBtn(LIBRARY_COPY.modes.creatures, "creatures");
    mkBtn(LIBRARY_COPY.modes.spells, "spells");
    mkBtn(LIBRARY_COPY.modes.terrains, "terrains");
    mkBtn(LIBRARY_COPY.modes.regions, "regions");
    const bar = root.createDiv({ cls: "sm-cc-searchbar" });
    const search = bar.createEl("input", { attr: { type: "text", placeholder: LIBRARY_COPY.searchPlaceholder } });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.activeRenderer?.setQuery(this.query);
    };
    this.searchInput = search;
    const createBtn = bar.createEl("button", { text: LIBRARY_COPY.createButton });
    createBtn.onclick = () => {
      void this.onCreate(search.value.trim());
    };
    this.descEl = root.createDiv({ cls: "desc" });
    this.listEl = root.createDiv({ cls: "sm-cc-list" });
  }
  async activateMode(mode) {
    if (this.activeRenderer?.mode === mode) {
      this.mode = mode;
      this.updateHeaderButtons();
      this.updateSourceDescription();
      this.activeRenderer.setQuery(this.query);
      this.activeRenderer.render();
      return;
    }
    if (this.activeRenderer) {
      await this.activeRenderer.destroy();
      this.activeRenderer = void 0;
    }
    this.mode = mode;
    this.updateHeaderButtons();
    this.updateSourceDescription();
    if (!this.listEl) return;
    const renderer = this.createRenderer(mode, this.listEl);
    this.activeRenderer = renderer;
    await renderer.init();
    renderer.setQuery(this.query);
    renderer.render();
  }
  createRenderer(mode, container) {
    switch (mode) {
      case "creatures":
        return new CreaturesRenderer(this.app, container);
      case "spells":
        return new SpellsRenderer(this.app, container);
      case "terrains":
        return new TerrainsRenderer(this.app, container);
      case "regions":
        return new RegionsRenderer(this.app, container);
      default:
        throw new Error(`Unsupported mode: ${mode}`);
    }
  }
  updateHeaderButtons() {
    for (const [mode, btn] of this.headerButtons.entries()) {
      btn.classList.toggle("is-active", this.mode === mode);
    }
  }
  updateSourceDescription() {
    if (!this.descEl) return;
    const text = `${LIBRARY_COPY.sources.prefix}${describeLibrarySource(this.mode)}`;
    this.descEl.setText(text);
  }
  async onCreate(name) {
    if (!name && this.mode !== "creatures" && this.mode !== "spells") return;
    if (!this.activeRenderer) return;
    await this.activeRenderer.handleCreate(name);
    this.searchInput?.focus();
  }
};

// src/app/main.ts
init_terrain_store();
init_terrain();

// src/app/css.ts
var viewContainerCss = `
/* === View Container === */
.sm-view-container {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    overflow: hidden;
}

.sm-view-container__viewport {
    position: relative;
    flex: 1;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    background: color-mix(in srgb, var(--background-secondary) 90%, transparent);
}

.sm-view-container__viewport.is-panning {
    cursor: grabbing;
}

.sm-view-container__stage {
    position: relative;
    width: 100%;
    height: 100%;
    transform-origin: top left;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
}

.sm-view-container__stage > * {
    flex: 1 1 auto;
}

.sm-view-container__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1.25rem;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.65));
    color: #fff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
}

.sm-view-container__overlay.is-visible {
    opacity: 1;
    pointer-events: auto;
}

.sm-view-container__overlay-message {
    max-width: 480px;
    font-size: 0.95rem;
    line-height: 1.4;
}
`;
var mapAndPreviewCss = `
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
`;
var editorLayoutsCss = `
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

/* Creature Creator \u2013 Modal Layout */
.sm-cc-modal-header { display:flex; flex-direction:column; gap:.35rem; margin-bottom:1rem; }
.sm-cc-modal-header h2 { margin:0; font-size:1.35rem; }
.sm-cc-modal-subtitle { margin:0; color: var(--text-muted); font-size:.95em; }
.sm-cc-layout { display:grid; grid-template-columns:minmax(0, 3fr) minmax(0, 2fr); gap:1rem; align-items:flex-start; }
.sm-cc-layout__col { display:flex; flex-direction:column; gap:1rem; min-width:0; }
.sm-cc-layout__col--full { grid-column:1 / -1; }
@media (max-width: 1100px) {
    .sm-cc-layout { grid-template-columns:minmax(0, 1fr); }
    .sm-cc-layout__col--side { order:2; }
    .sm-cc-layout__col--main { order:1; }
    .sm-cc-layout__col--full { order:3; }
}
.sm-cc-card {
    border:1px solid var(--background-modifier-border);
    border-radius:12px;
    background:var(--background-primary);
    box-shadow:0 6px 18px rgba(0,0,0,.06);
    display:flex;
    flex-direction:column;
    overflow:hidden;
}
.sm-cc-card__head { padding:.85rem .95rem .6rem; border-bottom:1px solid var(--background-modifier-border); display:flex; flex-direction:column; gap:.3rem; }
.sm-cc-card__title { margin:0; font-size:1.05rem; }
.sm-cc-card__subtitle { margin:0; font-size:.9em; color: var(--text-muted); }
.sm-cc-card__validation { display:none; padding:.6rem .95rem; border-top:1px solid color-mix(in srgb, var(--color-red, #e11d48) 30%, transparent); background:color-mix(in srgb, var(--color-red, #e11d48) 12%, var(--background-secondary)); color: var(--color-red, #e11d48); font-size:.9em; }
.sm-cc-card__validation.is-visible { display:block; }
.sm-cc-card__validation-list { margin:0; padding-left:1.2rem; display:flex; flex-direction:column; gap:.25rem; }
.sm-cc-card__body { padding:.95rem; display:flex; flex-direction:column; gap:1.1rem; }
.sm-cc-card.is-invalid { border-color: color-mix(in srgb, var(--color-red, #e11d48) 35%, transparent); box-shadow:0 0 0 1px color-mix(in srgb, var(--color-red, #e11d48) 22%, transparent) inset; }
.sm-cc-modal-footer { margin-top:1.25rem; display:flex; justify-content:flex-end; }
.sm-cc-modal-footer .setting-item { margin:0; padding:0; border:none; background:none; }
.sm-cc-modal-footer .setting-item-control { margin-left:0; display:flex; gap:.6rem; }
.sm-cc-modal-footer button { min-width:120px; }

/* Creature Creator \u2013 Basics Section */
.sm-cc-basics { display:flex; flex-direction:column; gap:1rem; }
.sm-cc-basics__group { display:flex; flex-direction:column; gap:.65rem; }
.sm-cc-basics__subtitle { margin:0; font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; color: var(--text-muted); }
.sm-cc-field-grid { display:grid; gap:.75rem; }
.sm-cc-field-grid--identity { grid-template-columns:repeat(2, minmax(0, 1fr)); }
.sm-cc-field-grid--summary { grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); }
.sm-cc-field-grid--speeds { grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); }
@media (max-width: 900px) {
    .sm-cc-field-grid--identity { grid-template-columns:minmax(0, 1fr); }
}
@media (max-width: 720px) {
    .sm-cc-field-grid--speeds { grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); }
}
.sm-cc-setting.setting-item { border:none; padding:0; margin:0; background:none; }
.sm-cc-setting .setting-item-info { display:none; }
.sm-cc-setting .setting-item-name { font-weight:600; font-size:.9em; color: var(--text-muted); }
.sm-cc-setting .setting-item-control { margin-left:0; width:100%; display:flex; flex-direction:column; gap:.4rem; }
.sm-cc-setting--inline .setting-item-control { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:.5rem; }
.sm-cc-setting--speed .setting-item-control { flex-direction:row; align-items:center; gap:.45rem; }
@media (max-width: 680px) {
    .sm-cc-setting--inline .setting-item-control { grid-template-columns:minmax(0, 1fr); }
}
@media (max-width: 520px) {
    .sm-cc-setting--speed .setting-item-control { flex-direction:column; align-items:flex-start; }
    .sm-cc-setting--speed .sm-cc-hover-wrap { margin-left:0; }
}
.sm-cc-input { width:100%; min-height:32px; box-sizing:border-box; border-radius:6px; }
.sm-cc-select { width:100%; min-height:32px; box-sizing:border-box; border-radius:6px; }
.sm-cc-alignment select { min-width:0; }
.sm-cc-hover-wrap { display:flex; align-items:center; gap:.35rem; margin-left:auto; }
.sm-cc-hover-toggle { margin:0; }
.sm-cc-hover-label { font-size:.8em; color: var(--text-muted); }

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
.sm-cc-damage-chip--res {
    border-color: rgba(37,99,235,.45);
    background-color: rgba(37,99,235,.08);
    border-color: color-mix(in srgb, var(--interactive-accent) 45%, transparent);
    background-color: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-secondary));
}
.sm-cc-damage-chip--res .sm-cc-damage-chip__badge {
    background-color: rgba(37,99,235,.18);
    color:#2563eb;
    background-color: color-mix(in srgb, var(--interactive-accent) 22%, transparent);
    color: var(--interactive-accent);
}
.sm-cc-damage-chip--imm {
    border-color: rgba(124,58,237,.45);
    background-color: rgba(124,58,237,.08);
    border-color: color-mix(in srgb, var(--color-purple, #7c3aed) 45%, transparent);
    background-color: color-mix(in srgb, var(--color-purple, #7c3aed) 12%, var(--background-secondary));
}
.sm-cc-damage-chip--imm .sm-cc-damage-chip__badge {
    background-color: rgba(124,58,237,.18);
    color:#7c3aed;
    background-color: color-mix(in srgb, var(--color-purple, #7c3aed) 22%, transparent);
    color: var(--color-purple, #7c3aed);
}
.sm-cc-damage-chip--vuln {
    border-color: rgba(234,88,12,.45);
    background-color: rgba(234,88,12,.08);
    border-color: color-mix(in srgb, var(--color-orange, #ea580c) 45%, transparent);
    background-color: color-mix(in srgb, var(--color-orange, #ea580c) 12%, var(--background-secondary));
}
.sm-cc-damage-chip--vuln .sm-cc-damage-chip__badge {
    background-color: rgba(234,88,12,.18);
    color:#ea580c;
    background-color: color-mix(in srgb, var(--color-orange, #ea580c) 22%, transparent);
    color: var(--color-orange, #ea580c);
}
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

/* Spell Creator \u2013 Validierung f\xFCr h\xF6here Grade */
.sm-cc-create-modal .setting-item.is-invalid textarea {
    border-color: color-mix(in srgb, var(--color-red, #e11d48) 35%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-red, #e11d48) 25%, transparent) inset;
}
.sm-setting-validation {
    display: none;
    margin-top: .35rem;
    padding: .45rem .6rem;
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-red, #e11d48) 12%, var(--background-secondary));
    color: var(--color-red, #e11d48);
    font-size: .85em;
}
.sm-setting-validation.is-visible { display: block; }
.sm-setting-validation ul {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: .25rem;
}

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
`;
var cartographerShellCss = `
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

.sm-cartographer__map .sm-view-container {
    width: 100%;
    height: 100%;
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
`;
var cartographerPanelsCss = `
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
`;
var travelModeCss = `
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
`;
var HEX_PLUGIN_CSS_SECTIONS = {
  viewContainer: viewContainerCss,
  mapAndPreview: mapAndPreviewCss,
  editorLayouts: editorLayoutsCss,
  cartographerShell: cartographerShellCss,
  cartographerPanels: cartographerPanelsCss,
  travelMode: travelModeCss
};
var HEX_PLUGIN_CSS = Object.values(HEX_PLUGIN_CSS_SECTIONS).join("\n\n");

// src/app/main.ts
var SaltMarcherPlugin = class extends import_obsidian24.Plugin {
  async onload() {
    this.registerView(VIEW_CARTOGRAPHER, (leaf) => new CartographerView(leaf));
    this.registerView(VIEW_ENCOUNTER, (leaf) => new EncounterView(leaf));
    this.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf));
    await ensureTerrainFile(this.app);
    setTerrains(await loadTerrains(this.app));
    this.unwatchTerrains = watchTerrains(this.app, () => {
    });
    this.addRibbonIcon("compass", "Open Cartographer", async () => {
      await openCartographer(this.app);
    });
    this.addRibbonIcon("book", "Open Library", async () => {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
    this.addCommand({
      id: "open-cartographer",
      name: "Open Cartographer",
      callback: async () => {
        await openCartographer(this.app);
      }
    });
    this.addCommand({
      id: "open-library",
      name: "Open Library",
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });
    this.injectCss();
  }
  async onunload() {
    this.unwatchTerrains?.();
    await detachCartographerLeaves(this.app);
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
