// src/app/css.ts
export const HEX_PLUGIN_CSS = `
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
    /* Basis: unbemalt transparent — Inline-Styles vom Renderer dürfen das überschreiben */
    fill: transparent;
    stroke: var(--text-muted);
    stroke-width: 2;
    cursor: pointer;
    transition: fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease;
}

/* Hover: nur den Rahmen highlighten */
.hex3x3-map polygon:hover { stroke: var(--interactive-accent); }

/* Optional: Hover-Füllung nur für unbemalte Tiles */
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

/* Creature Compendium – nutzt die gleichen Layout-Hilfsklassen */
.sm-creature-compendium { padding:.5rem 0; }
.sm-creature-compendium .desc { color: var(--text-muted); margin-bottom:.25rem; }
.sm-creature-compendium .rows { margin-top:.5rem; }
.sm-creature-compendium .row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.sm-creature-compendium .row input[type="text"] { flex:1; min-width:0; }
.sm-creature-compendium .addbar { display:flex; gap:.5rem; margin-top:.5rem; }
.sm-creature-compendium .addbar input[type="text"] { flex:1; min-width:0; }

/* Creature Compendium – Search + list */
.sm-cc-searchbar { display:flex; gap:.5rem; margin:.5rem 0; }
.sm-cc-searchbar input[type="text"] { flex:1; min-width:0; }
.sm-cc-list { display:flex; flex-direction:column; gap:.25rem; margin-top:.25rem; }
.sm-cc-item { display:flex; gap:.5rem; align-items:center; justify-content:space-between; padding:.35rem .5rem; border:1px solid var(--background-modifier-border); border-radius:8px; background: var(--background-primary); }
.sm-cc-item__name { font-weight: 500; }

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
.sm-cc-skill-search,
.sm-cc-senses-search {
    align-items:center;
    justify-content:flex-end;
    margin-left:auto;
    width:100%;
    max-width:420px;
}
.sm-cc-skill-search select,
.sm-cc-senses-search select,
.sm-cc-skill-search .sm-sd,
.sm-cc-senses-search .sm-sd {
    flex:1 1 260px;
    min-width:220px;
}
.sm-cc-skill-search button,
.sm-cc-senses-search button {
    flex:0 0 auto;
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
.sm-cc-create-modal .sm-cc-stats-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; margin-top: .35rem; }
.sm-cc-create-modal .sm-cc-stat { border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: .5rem; background: var(--background-primary); display: flex; flex-direction: column; gap: .35rem; }
.sm-cc-create-modal .sm-cc-stat__header { display: flex; align-items: center; justify-content: space-between; gap: .5rem; font-weight: 600; }
.sm-cc-create-modal .sm-cc-stat__header span:first-child { color: var(--text-normal); }
.sm-cc-create-modal .sm-cc-stat__mod { display: flex; align-items: center; justify-content: space-between; gap: .5rem; font-size: .95em; color: var(--text-muted); }
.sm-cc-create-modal .sm-cc-stat__mod-value { font-weight: 600; color: var(--text-normal); }
.sm-cc-create-modal .sm-cc-stat__save { display: flex; flex-direction: column; gap: .25rem; }
.sm-cc-create-modal .sm-cc-stat__save-label { font-size: .85em; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; color: var(--text-muted); }
.sm-cc-create-modal .sm-cc-stat__save-controls { display: flex; align-items: center; gap: .35rem; }
.sm-cc-create-modal .sm-cc-stat__save-controls input[type="checkbox"] { margin: 0; }
.sm-cc-create-modal .sm-cc-stat__save-value { font-weight: 600; }
@media (max-width: 700px) {
    .sm-cc-create-modal .sm-cc-stats-grid { grid-template-columns: minmax(0, 1fr); }
}

/* Compact inline number controls */
.sm-inline-number { display: inline-flex; align-items: center; gap: .25rem; }
.sm-inline-number input[type="number"] { width: 84px; }
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

/* Inline compact row for grouped fields */
.sm-cc-inline-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .35rem .6rem;
}
.sm-cc-inline-row label { font-size: 0.9em; color: var(--text-muted); }

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
`;
