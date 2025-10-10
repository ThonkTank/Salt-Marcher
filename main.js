    lines.push(`*${summaryParts.join(", ")}*`);
      "AGENTS.md": `# Ziele
- Enth\xE4lt Monster-Presets als Input f\xFCr Parser und Library-Creator.
- Sicherstellt, dass verschiedene CR-Stufen und Traits abgedeckt sind.

# Aktueller Stand
- Markdown-Statblocks mit Frontmatter bilden die Basis.
- Daten stammen aus Regelwerken oder Homebrew.

# ToDo
- [P3] Legendary/Lair Actions in Preset-Schema integrieren.
- [P3] Quellenangaben pro Monster erg\xE4nzen.

# Standards
- Frontmatter-Schl\xFCssel den Parser-Vorgaben anpassen.
- \xC4nderungen mit Golden-Tests vergleichen (\`tests/golden/library/creatures\`).
`,
      "AGENTS.md": `# Ziele
- Archiviert Zauber-Presets als Ausgangsmaterial f\xFCr Library-Imports.
- Sicherstellt, dass Parser und Golden-Tests reale Daten verarbeiten.

# Aktueller Stand
- Enth\xE4lt Markdown-Snippets f\xFCr exemplarische Zauber.
- Wird manuell gepflegt, keine automatische Synchronisation.

# ToDo
- [P2] Einheitliche Kopfzeilen (Name, Schule, Quelle) etablieren.
- [P3] Kennzeichnen, welche Presets bereits getestet/exportiert wurden.

# Standards
- Format beibehalten, das Parser erwarten (siehe \`tools/parsers\`).
- \xC4nderungen mit \`npm test\` (Library) validieren.
`,
`,
      "AGENTS.md": `# Ziele
- H\xE4lt Item-Presets (Consumables, Loot, Utility) f\xFCr Tests und Exporte bereit.
- Dient als manuelles Repository f\xFCr neue Inhalte aus Regelquellen.

# Aktueller Stand
- Markdown-Dateien enthalten strukturierte Frontmatter.
- Parser ziehen diese Daten in den Library-Import.

# ToDo
- [P2] Mehr Beispiele f\xFCr unterschiedliche Rarity-Level erg\xE4nzen.
- [P3] Automatisierte Konsistenzpr\xFCfung (z.\u202FB. fehlende Felder) hinzuf\xFCgen.

# Standards
- Frontmatter-Schl\xFCssel folgen Parser-Spezifikation.
- \xC4nderungen mit Golden-Tests abgleichen (\`tests/golden/library/items\`).
      "AGENTS.md": `# Ziele
- Beinhaltet Waffen-Presets als Referenz f\xFCr Parser und Creator.
- Sichert unterschiedliche Kategorien (Nahkampf, Fernkampf, exotisch) ab.

# Aktueller Stand
- Markdown-Dateien mit Frontmatter beschreiben Stats und Eigenschaften.
- Wird manuell aktualisiert.

# ToDo
- [P3] Weitere Waffen aus Alternativquellen aufnehmen.
- [P3] Damage-Typen mit Library-Konstanten abgleichen.

# Standards
- Frontmatter-Schl\xFCssel (damage, properties, cost) strikt nach Parser-Konvention.
- \xC4nderungen stets mit Golden-Dateien (\`tests/golden/library/equipment\`) synchronisieren.
`,
      const targetPath = (0, import_obsidian32.normalizePath)(`${dir}/${fileName}`);
      new import_obsidian32.Notice(`Imported ${importedCount} ${typeName} presets`);
      new import_obsidian32.Notice(`Failed to import ${typeName} presets. Check console for details.`);
      new import_obsidian32.Notice(`Failed to import ${typeName} presets. Check console for details.`);
var import_obsidian32, PRESET_FILES;
    import_obsidian32 = require("obsidian");
  if (!(folder instanceof import_obsidian33.TFolder)) {
      if (child instanceof import_obsidian33.TFile && child.extension === "md") {
      } else if (child instanceof import_obsidian33.TFolder) {
  if (existingFile instanceof import_obsidian33.TFile) {
  if (existingFile instanceof import_obsidian33.TFile) {
var import_obsidian33, SALTMARCHER_DIR, CREATURES_DIR2, EQUIPMENT_DIR2, SPELLS_DIR2, ITEMS_DIR2;
    import_obsidian33 = require("obsidian");
    new import_obsidian34.Notice("Keine Reference Statbl\xF6cke gefunden");
  new import_obsidian34.Notice(`Konvertiere ${filesToProcess.length} Statbl\xF6cke${dryRun ? " (Dry Run)" : ""}...`);
  new import_obsidian34.Notice(summary);
    new import_obsidian34.Notice("Spells Reference Datei nicht gefunden");
    new import_obsidian34.Notice("Keine Spells in Reference Datei gefunden");
  new import_obsidian34.Notice(`Konvertiere ${sectionsToProcess.length} Spells${dryRun ? " (Dry Run)" : ""}...`);
  new import_obsidian34.Notice(summary);
var import_obsidian34, CREATURES_REFERENCES_DIR, CREATURES_PRESETS_DIR, SPELLS_REFERENCES_FILE, SPELLS_PRESETS_DIR;
    import_obsidian34 = require("obsidian");
var import_obsidian35 = require("obsidian");
function appendElement(parent, tag, options = {}) {
  const maybeCreateEl = parent.createEl;
  if (typeof maybeCreateEl === "function") {
    return maybeCreateEl.call(parent, tag, options);
  }
  const doc = parent.ownerDocument ?? document;
  const el = doc.createElement(tag);
  if (options.cls) {
    el.className = options.cls;
  }
  if (options.text !== void 0) {
    el.textContent = options.text;
  }
  parent.appendChild(el);
  return el;
}
      const icon = appendElement(button, "span", { cls: "sm-tab-nav__icon" });
    appendElement(button, "span", { cls: "sm-tab-nav__label", text: tab.label });
      badge = appendElement(button, "span", { cls: "sm-tab-nav__badge", text: String(tab.badgeCount) });
        entry.badge = appendElement(entry.button, "span", { cls: "sm-tab-nav__badge", text: String(count) });
var import_obsidian30 = require("obsidian");
var VIEW_TYPE_ALMANAC = "almanac-view";
var VIEW_ALMANAC = VIEW_TYPE_ALMANAC;
var AlmanacView = class extends import_obsidian30.ItemView {
  constructor(leaf) {
    super(leaf);
  getViewType() {
    return VIEW_TYPE_ALMANAC;
  getDisplayText() {
    return "Almanac";
  getIcon() {
    return "calendar";
  async onOpen() {
    const container = this.containerEl;
    const content = container.children[1];
    content.empty();
    const placeholder = content.createDiv({ cls: "almanac-placeholder" });
    placeholder.createEl("h2", { text: "Almanac front-end removed" });
    placeholder.createEl("p", {
      text: "The Almanac's interactive interface has been removed. Existing calendar data remains available for other modules."
  async onClose() {
async function openAlmanac(app) {
  const { workspace } = app;
  const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_ALMANAC);
  if (existingLeaves.length > 0) {
    workspace.revealLeaf(existingLeaves[0]);
    return;
  const leaf = workspace.getLeaf(true);
  await leaf.setViewState({ type: VIEW_TYPE_ALMANAC, active: true });
  workspace.revealLeaf(leaf);
}

// src/apps/view-manifest.ts
var VIEW_MANIFEST = [
  {
    viewType: VIEW_CARTOGRAPHER,
    integrationId: "obsidian:cartographer-view",
    displayName: "Cartographer",
    viewIcon: "compass",
    createView: (leaf) => new CartographerView(leaf),
    activation: {
      open: (app) => openCartographer(app),
      ribbon: {
        icon: "compass",
        title: "Open Cartographer"
      },
      commands: [
        {
          id: "open-cartographer",
          name: "Open Cartographer"
        }
      ]
  },
  {
    viewType: VIEW_ENCOUNTER,
    integrationId: "obsidian:encounter-view",
    displayName: "Encounter",
    viewIcon: "swords",
    createView: (leaf) => new EncounterView(leaf)
  },
  {
    viewType: VIEW_LIBRARY,
    integrationId: "obsidian:library-view",
    displayName: "Library",
    viewIcon: "library",
    createView: (leaf) => new LibraryView(leaf),
    activation: {
      open: (app) => openLibrary(app),
      ribbon: {
        icon: "book",
        title: "Open Library"
      },
      commands: [
        {
          id: "open-library",
          name: "Open Library"
        }
      ]
  },
  {
    viewType: VIEW_ALMANAC,
    integrationId: "obsidian:almanac-view",
    displayName: "Almanac",
    viewIcon: "calendar",
    createView: (leaf) => new AlmanacView(leaf),
    activation: {
      open: (app) => openAlmanac(app),
      ribbon: {
        icon: "calendar",
        title: "Open Almanac (MVP)"
      },
      commands: [
        {
          id: "open-almanac",
          name: "Open Almanac"
        }
      ]
];

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

.sm-view-container__viewport {
    position: relative;
    flex: 1;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    background: color-mix(in srgb, var(--background-secondary) 90%, transparent);

.sm-view-container__viewport.is-panning {
    cursor: grabbing;
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

.sm-view-container__overlay.is-visible {
    opacity: 1;
    pointer-events: auto;

.sm-view-container__overlay-message {
    max-width: 480px;
    font-size: 0.95rem;
    line-height: 1.4;
`;
var mapAndPreviewCss = `
/* === Map-Container & SVG === */
.hex3x3-container {
    width: 100%;
    overflow: hidden;
.hex3x3-map {
    display: block;
    width: 100%;
    max-width: 700px;
    margin: .5rem 0;
    user-select: none;
    touch-action: none;

.hex3x3-map polygon {
    /* Basis: unbemalt transparent \u2014 Inline-Styles vom Renderer d\xFCrfen das \xFCberschreiben */
    fill: transparent;
    stroke: var(--text-muted);
    stroke-width: 2;
    cursor: pointer;
    transition: fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease;
/* Hover: nur den Rahmen highlighten */
.hex3x3-map polygon:hover { stroke: var(--interactive-accent); }
/* Optional: Hover-F\xFCllung nur f\xFCr unbemalte Tiles */
.hex3x3-map polygon:not([data-painted="1"]):hover { fill-opacity: .15; }
// src/app/integration-telemetry.ts
var import_obsidian31 = require("obsidian");
var notifiedOperations = /* @__PURE__ */ new Set();
function reportIntegrationIssue(payload) {
  const { integrationId, operation, error, userMessage } = payload;
  const logPrefix = `[salt-marcher] integration(${integrationId}) ${operation} failed`;
  console.error(logPrefix, error);
  const dedupeKey = `${integrationId}:${operation}`;
  if (notifiedOperations.has(dedupeKey)) return;
  notifiedOperations.add(dedupeKey);
  new import_obsidian31.Notice(userMessage);
}

var SaltMarcherPlugin = class extends import_obsidian35.Plugin {
