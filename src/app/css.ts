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

/* Creature Creator – Basics Section */
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
    align-items: stretch;
    justify-content: stretch;
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: default;
    transition: border-color 120ms ease, box-shadow 120ms ease;
}

.sm-le-box.is-container {
    border-style: dashed;
    border-color: var(--background-modifier-border);
}

.sm-le-box.is-selected {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 0 4px rgba(56, 189, 248, 0.18);
}

.sm-le-box.is-selected.is-container {
    border-color: var(--interactive-accent);
}

.sm-le-box__content {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
}

.sm-le-box__chrome {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
    padding: 0.3rem;
}

.sm-le-box__handle,
.sm-le-box__attrs {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    user-select: none;
    transition: border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}

.sm-le-box__handle {
    cursor: grab;
    font-size: 0.9rem;
}

.sm-le-box__attrs {
    cursor: pointer;
    font-size: 0.85rem;
}

.sm-le-box__attrs.is-empty {
    opacity: 0.7;
}

.sm-le-box.is-selected .sm-le-box__handle,
.sm-le-box.is-selected .sm-le-box__attrs {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    box-shadow: 0 8px 20px rgba(56, 189, 248, 0.25);
}

.sm-le-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.15rem;
}

.sm-le-preview__text-block,
.sm-le-preview__box,
.sm-le-preview__field,
.sm-le-preview__separator,
.sm-le-preview__container-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-le-preview__text {
    font-size: 1rem;
    line-height: 1.4;
}

.sm-le-preview__subtext,
.sm-le-preview__description {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
}

.sm-le-preview__title {
    font-weight: 600;
    font-size: 1rem;
}

.sm-le-preview__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-le-preview__meta {
    font-size: 0.7rem;
    color: var(--text-muted);
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
}

.sm-le-preview__input,
.sm-le-preview__textarea,
.sm-le-preview__select {
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    padding: 0.3rem 0.4rem;
    background: var(--background-primary);
    font: inherit;
    color: inherit;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.sm-le-preview__textarea {
    resize: vertical;
    min-height: 80px;
}

.sm-le-inline-edit {
    display: inline-block;
    padding: 0.05rem 0.15rem;
    border-radius: 4px;
    cursor: text;
    transition: box-shadow 120ms ease, background 120ms ease;
    min-width: 0.6rem;
}

.sm-le-inline-edit--block {
    display: block;
}

.sm-le-inline-edit--multiline {
    min-height: 2.2rem;
    white-space: pre-wrap;
}

.sm-le-inline-edit:focus {
    outline: none;
    box-shadow: 0 0 0 1px var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb), 0.08);
}

.sm-le-inline-edit:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    pointer-events: none;
}

.sm-le-inline-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
    display: block;
}

.sm-le-inline-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.sm-le-inline-options__empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
}

.sm-le-inline-option {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--background-secondary);
    border-radius: 999px;
    padding: 0.15rem 0.35rem;
}

.sm-le-inline-option__label {
    font-size: 0.8rem;
}

.sm-le-inline-option__remove {
    font-size: 0.8rem;
    color: var(--text-muted);
    cursor: pointer;
}

.sm-le-inline-option__remove:hover {
    color: var(--text-normal);
}

.sm-le-inline-add {
    align-self: flex-start;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
}

.sm-le-inline-add--menu {
    align-self: flex-start;
}

.sm-le-preview__divider {
    border: none;
    border-top: 1px solid var(--background-modifier-border);
    margin: 0.25rem 0 0;
}

.sm-le-preview__layout {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.sm-le-inline-control {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.sm-le-inline-number,
.sm-le-inline-select {
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    padding: 0.2rem 0.3rem;
    font: inherit;
    background: var(--background-primary);
    color: inherit;
}

.sm-le-preview__container-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.sm-le-container-chip {
    background: var(--background-secondary);
    border-radius: 999px;
    padding: 0.2rem 0.45rem;
}

.sm-le-box__resize {
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    right: 0.3rem;
    bottom: 0.3rem;
    cursor: se-resize;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.sm-le-box__resize::after {
    content: "";
    width: 10px;
    height: 10px;
    border-right: 2px solid var(--text-muted);
    border-bottom: 2px solid var(--text-muted);
}

.sm-le-box.is-selected .sm-le-box__resize {
    border-color: var(--interactive-accent);
}

.sm-le-inspector {
    flex: 0 0 240px;
    min-width: 220px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-le-inspector h3 {
    margin: 0;
}

.sm-le-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-le-field label {
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.sm-le-hint {
    font-size: 0.7rem;
    color: var(--text-muted);
    line-height: 1.3;
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
