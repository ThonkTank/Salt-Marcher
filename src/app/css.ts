// src/app/css.ts
// Bündelt globale Styles für Plugin-Views inkl. Bibliotheks-Editoren.
// Abschnitte getrennt halten, damit einzelne Bereiche gezielt ergänzt werden können.
const viewContainerCss = `
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
const mapAndPreviewCss = `
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
`;
/**
 * Terrain Editor CSS
 * Simple form layout for editing terrain types
 */
const terrainEditorCss = `
/* === Terrain Editor === */
.sm-terrain-editor { padding:.5rem 0; }
.sm-terrain-editor .desc { color: var(--text-muted); margin-bottom:.25rem; }
.sm-terrain-editor .rows { margin-top:.5rem; }
.sm-terrain-editor .row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.sm-terrain-editor .row input[type="text"] { flex:1; min-width:0; }
.sm-terrain-editor .addbar { display:flex; gap:.5rem; margin-top:.5rem; }
.sm-terrain-editor .addbar input[type="text"] { flex:1; min-width:0; }
`;

/**
 * Library View CSS
 * Creature compendium, search bars, filters, and item lists
 */
const libraryViewCss = `
/* Creature Compendium – nutzt die gleichen Layout-Hilfsklassen */
.sm-creature-compendium { padding:.5rem 0; }
.sm-creature-compendium .desc { color: var(--text-muted); margin-bottom:.25rem; }
.sm-creature-compendium .rows { margin-top:.5rem; }
.sm-creature-compendium .row { display:flex; gap:.5rem; align-items:center; margin:.25rem 0; }
.sm-creature-compendium .row input[type="text"] { flex:1; min-width:0; }
.sm-creature-compendium .addbar { display:flex; gap:.5rem; margin-top:.5rem; }
.sm-creature-compendium .addbar input[type="text"] { flex:1; min-width:0; }

/* Creature Compendium – Search, Lists & Filters */
.sm-cc-searchbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .5rem;
    margin: .5rem 0;
}
.sm-cc-searchbar > * {
    flex: 1 1 200px;
    min-width: 160px;
}
.sm-cc-searchbar button {
    flex: 0 0 auto;
}

.sm-cc-entry-filter {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .35rem;
    padding: .35rem;
    margin: .35rem 0 .65rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--background-secondary) 85%, transparent);
}
.sm-cc-entry-filter button {
    border: none;
    background: transparent;
    padding: .25rem .75rem;
    border-radius: 999px;
    font-size: .85em;
    letter-spacing: .04em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
.sm-cc-entry-filter button:hover {
    color: var(--text-normal);
}
.sm-cc-entry-filter button.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 55%, transparent);
}

.sm-cc-list {
    display: flex;
    flex-direction: column;
    gap: .45rem;
    margin-top: .35rem;
}
.sm-cc-item {
    display: flex;
    gap: .5rem;
    align-items: center;
    justify-content: space-between;
    padding: .45rem .65rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    box-shadow: 0 3px 10px rgba(15, 23, 42, .04);
}
.sm-cc-item__name { font-weight: 600; }
`;

/**
 * Create Modal CSS
 * Complete styling for creature/item/spell creation modal
 */
const createModalCss = `
/* Creature Creator – Modal Layout */
.modal.sm-cc-create-modal-host {
    width: min(1120px, calc(100vw - 32px));
    max-width: min(1120px, calc(100vw - 32px));
    min-width: min(880px, calc(100vw - 32px));
}
.modal.sm-cc-create-modal-host .modal-content { max-height: calc(100vh - 96px); }
.sm-cc-modal-header { display:flex; flex-direction:column; gap:.35rem; margin-bottom:1rem; }
.sm-cc-modal-header h2 { margin:0; font-size:1.35rem; }
.sm-cc-modal-subtitle { margin:0; color: var(--text-muted); font-size:.95em; }
.sm-cc-shell { display:grid; grid-template-columns:minmax(0, 260px) minmax(0, 1fr); gap:1.5rem; align-items:flex-start; }
.sm-cc-shell__nav { position:sticky; top:0; align-self:start; display:flex; flex-direction:column; gap:.75rem; padding:1rem; border:1px solid var(--background-modifier-border); border-radius:16px; background:color-mix(in srgb, var(--background-secondary) 88%, transparent); box-shadow:0 12px 28px rgba(15,23,42,.08); }
.sm-cc-shell__nav-label { margin:0; font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); }
.sm-cc-shell__nav-list { display:flex; flex-direction:column; gap:.4rem; }
.sm-cc-shell__nav-button { display:flex; align-items:center; gap:.45rem; width:100%; padding:.45rem .75rem; border-radius:999px; border:1px solid transparent; background:transparent; color:var(--text-muted); font-size:.82rem; letter-spacing:.06em; text-transform:uppercase; font-weight:600; cursor:pointer; transition:background 160ms ease, color 160ms ease, border 160ms ease, box-shadow 160ms ease; }
.sm-cc-shell__nav-button:hover { color:var(--text-normal); }
.sm-cc-shell__nav-button:focus-visible { outline:2px solid var(--interactive-accent); outline-offset:2px; }
.sm-cc-shell__nav-button.is-active { background:var(--interactive-accent); color:var(--text-on-accent, #fff); box-shadow:0 8px 20px color-mix(in srgb, var(--interactive-accent) 35%, transparent); }
.sm-cc-shell__content { display:flex; flex-direction:column; gap:1.5rem; min-width:0; }
.sm-cc-card {
    border:1px solid var(--background-modifier-border);
    border-radius:12px;
    background:var(--background-primary);
    box-shadow:0 6px 18px rgba(0,0,0,.06);
    display:flex;
    flex-direction:column;
    overflow:hidden;
}
.sm-cc-card__head { padding:.9rem 1rem .65rem; border-bottom:1px solid var(--background-modifier-border); display:flex; flex-direction:column; gap:.35rem; }
.sm-cc-card__heading { display:flex; align-items:flex-start; gap:.65rem; justify-content:space-between; }
.sm-cc-card__title { margin:0; font-size:1.05rem; }
.sm-cc-card__subtitle { margin:0; font-size:.9em; color: var(--text-muted); }
.sm-cc-card__status {
    display: inline-flex;
    align-items: center;
    gap: .35rem;
    padding: .25rem .65rem;
    border-radius: 999px;
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    background: color-mix(in srgb, var(--color-red, #e11d48) 12%, var(--background-secondary));
    color: color-mix(in srgb, var(--color-red, #e11d48) 85%, var(--text-normal));
    border: 1px solid color-mix(in srgb, var(--color-red, #e11d48) 45%, transparent);
    white-space: nowrap;
    transition: background 120ms ease, color 120ms ease, border 120ms ease, box-shadow 120ms ease;
}
.sm-cc-card__status::before {
    content: "!";
    font-weight: 700;
    font-size: .85em;
    line-height: 1;
}
.sm-cc-card__status[hidden] { display:none; }
.sm-cc-card__status.is-active { box-shadow:0 0 0 1px color-mix(in srgb, var(--color-red, #e11d48) 35%, transparent); }
.sm-cc-card__validation { display:none; padding:.6rem .95rem; border-top:1px solid color-mix(in srgb, var(--color-red, #e11d48) 30%, transparent); background:color-mix(in srgb, var(--color-red, #e11d48) 12%, var(--background-secondary)); color: var(--color-red, #e11d48); font-size:.9em; }
.sm-cc-card__validation.is-visible { display:block; }
.sm-cc-card__validation-list { margin:0; padding-left:1.2rem; display:flex; flex-direction:column; gap:.25rem; }
.sm-cc-card__body {
    padding: .95rem;
    display: grid;
    /* Shared grid for label alignment across all fields */
    grid-template-columns: max-content 1fr;
    column-gap: 0.8rem;
    row-gap: 0.3rem;
    align-items: start;
}

/* Multi-column layout for composite/special fields */
.sm-cc-card__body--multi-column {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem 1.5rem;
}
.sm-cc-card.is-invalid { border-color: color-mix(in srgb, var(--color-red, #e11d48) 35%, transparent); box-shadow:0 0 0 1px color-mix(in srgb, var(--color-red, #e11d48) 22%, transparent) inset; }
.sm-cc-modal-footer { margin-top:1.25rem; display:flex; justify-content:flex-end; }
.sm-cc-modal-footer .setting-item { margin:0; padding:0; border:none; background:none; }
.sm-cc-modal-footer .setting-item-control { margin-left:0; display:flex; gap:.6rem; }
.sm-cc-modal-footer button { min-width:120px; }
/* Keyboard Shortcut Flash Effect */
.sm-cc-shortcut-flash {
    animation: sm-cc-flash 300ms ease-out;
}

@keyframes sm-cc-flash {
    0% {
        box-shadow: 0 0 0 0 var(--interactive-accent);
        background: var(--background-primary);
    }
    50% {
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--interactive-accent) 35%, transparent);
        background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-primary));
    }
    100% {
        box-shadow: 0 0 0 0 transparent;
        background: var(--background-primary);
    }
}


/* Creature Creator – Basics Section */
.sm-cc-card--basics {
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--background-secondary) 78%, transparent);
    box-shadow: 0 6px 18px rgba(15, 23, 42, .05);
}
.sm-cc-card--basics + .sm-cc-card--basics {
    margin-top: 1.1rem;
}
.sm-cc-card--basics .sm-cc-card__head {
    padding: .85rem .95rem .4rem;
}
.sm-cc-card--basics .sm-cc-card__title {
    font-size: .95rem;
    letter-spacing: .02em;
}
.sm-cc-card--basics .sm-cc-card__subtitle {
    margin-top: .35rem;
    font-size: .78rem;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--text-muted);
}
.sm-cc-card__body--basics {
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
    padding: .85rem .95rem 1.15rem;
}
.sm-cc-card__section--basics {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.sm-cc-field-grid {
    display: grid;
    gap: .75rem;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.sm-cc-field-grid--basics {
    gap: 1rem;
}
.sm-cc-field-grid--summary { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.sm-cc-field-grid--classification { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.sm-cc-field-grid--vitals { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.sm-cc-field-grid--speeds { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.sm-cc-field-grid--irregular { grid-template-columns: initial; }
.sm-cc-repeating-grid { display: grid; gap: .75rem; align-items: stretch; }
/* Settings within card__body become part of the shared grid */
.sm-cc-card__body > .sm-cc-setting.setting-item {
    border: none;
    padding: 0;
    margin: 0;
    background: none;
    /* Use display: contents to make children part of parent grid */
    display: contents;
}

/* Label - auto-placed by grid */
.sm-cc-card__body > .sm-cc-setting .setting-item-info {
    display: block;
    min-width: fit-content;
    max-width: max-content;
    align-self: center;
}

/* Control - auto-placed by grid */
.sm-cc-card__body > .sm-cc-setting .setting-item-control {
    margin-left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: .45rem;
}

/* Error messages span both columns */
.sm-cc-card__body > .sm-cc-setting .sm-cc-field__errors {
    grid-column: 1 / -1;
}

/* Ensure all input elements have consistent width */
.sm-cc-card__body > .sm-cc-setting .setting-item-control select,
.sm-cc-card__body > .sm-cc-setting .setting-item-control input:not([type="checkbox"]):not([type="radio"]),
.sm-cc-card__body > .sm-cc-setting .setting-item-control textarea {
    width: 100%;
    box-sizing: border-box;
}

/* Fallback for settings not in card__body */
.sm-cc-setting.setting-item {
    border: none;
    padding: 0;
    margin: 0;
    background: none;
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 0.8rem;
    row-gap: 0.3rem;
    align-items: center;
}

.sm-cc-setting .setting-item-info {
    display: block;
    min-width: fit-content;
    max-width: max-content;
}

.sm-cc-setting .setting-item-control {
    margin-left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: .45rem;
}

.sm-cc-setting .sm-cc-field__errors {
    grid-column: 1 / -1;
}

.sm-cc-field__errors-list {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-cc-setting--hide-label .setting-item-info { display: none; }

.sm-cc-setting .setting-item-name {
    font-weight: 600;
    font-size: .88rem;
    color: var(--text-muted);
    white-space: nowrap;
}

/* Wide fields (textarea, tags, repeating, composite) span full width */
.sm-cc-card__body > .sm-cc-setting--wide.setting-item {
    /* Override display: contents for wide fields */
    /* Increased specificity to (0,3,0) to override .sm-cc-setting.setting-item */
    display: grid;
    grid-template-columns: 1fr;
    grid-column: 1 / -1;
    gap: 0.3rem;
}

.sm-cc-card__body > .sm-cc-setting--wide.setting-item .setting-item-info {
    grid-column: 1;
    margin-bottom: 0.3rem;
}

.sm-cc-card__body > .sm-cc-setting--wide.setting-item .setting-item-control {
    grid-column: 1;
    margin-left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: .45rem;
}

/* Special layout for tags fields - horizontal with label on left */
.sm-cc-card__body > .sm-cc-setting--tags.setting-item {
    grid-template-columns: max-content 1fr;
    align-items: start;
    gap: 0.8rem;
}

.sm-cc-card__body > .sm-cc-setting--tags.setting-item .setting-item-info {
    align-self: center;
    margin-bottom: 0;
}

.sm-cc-card__body > .sm-cc-setting--tags.setting-item .setting-item-control {
    grid-column: 2;
}

/* Special layout for structured-tags fields - horizontal with label on left */
.sm-cc-card__body > .sm-cc-setting--structured-tags.setting-item {
    grid-template-columns: max-content 1fr;
    align-items: start;
    gap: 0.8rem;
}

.sm-cc-card__body > .sm-cc-setting--structured-tags.setting-item .setting-item-info {
    align-self: center;
    margin-bottom: 0;
}

.sm-cc-card__body > .sm-cc-setting--structured-tags.setting-item .setting-item-control {
    grid-column: 2;
}

/* Fallback for wide fields not in card__body */
.sm-cc-setting--wide {
    grid-template-columns: 1fr;
    gap: 0.3rem;
}

.sm-cc-setting--wide .setting-item-info {
    margin-bottom: 0.3rem;
}

.sm-cc-setting--wide .setting-item-control {
    margin-left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: .45rem;
}
.sm-cc-setting--textarea .setting-item-control { align-items: stretch; }
.sm-cc-setting--textarea .sm-cc-textarea { min-height: 120px; }
.sm-cc-setting--show-name .setting-item-info {
    display: block;
    min-width: max-content;
}
.sm-cc-setting--show-name .setting-item-name {
    font-size: .75rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: visible;
    text-overflow: clip;
    line-height: 1.25;
    max-width: none;
    width: max-content;
}
.sm-cc-setting--span-2 { grid-column: 1 / -1; }
.sm-cc-setting--stack .setting-item-control {
    gap: .6rem;
}

/* Token editor 2x2 grid layout (both simple and structured) */
/* Higher specificity to override .sm-cc-setting--wide rules */
.sm-cc-card__body > .sm-cc-setting--token-editor.setting-item,
.sm-cc-card__body > .sm-cc-setting--structured-token-editor.setting-item {
    display: grid !important;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 0.5rem 1rem;
    align-items: start;
}

.sm-cc-card__body > .sm-cc-setting--token-editor.setting-item .setting-item-info,
.sm-cc-card__body > .sm-cc-setting--structured-token-editor.setting-item .setting-item-info {
    grid-row: 1;
    grid-column: 1;
}

.sm-cc-card__body > .sm-cc-setting--token-editor.setting-item .setting-item-control,
.sm-cc-card__body > .sm-cc-setting--structured-token-editor.setting-item .setting-item-control {
    grid-row: 1;
    grid-column: 2;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap;
    gap: 0.5rem;
}

.sm-cc-card__body > .sm-cc-setting--token-editor.setting-item .setting-item-control input,
.sm-cc-card__body > .sm-cc-setting--structured-token-editor.setting-item .setting-item-control input {
    flex: 1 1 auto;
    min-width: 0;
    width: 100% !important;
}

.sm-cc-card__body > .sm-cc-setting--token-editor.setting-item .setting-item-control button,
.sm-cc-card__body > .sm-cc-setting--structured-token-editor.setting-item .setting-item-control button {
    flex-shrink: 0;
    align-self: flex-start;
}

.sm-cc-card__body > .sm-cc-setting--token-editor.setting-item .sm-cc-chips,
.sm-cc-card__body > .sm-cc-setting--structured-token-editor.setting-item .sm-cc-chips {
    grid-row: 2;
    grid-column: 2;
    margin: 0;
}

/* Fallback for token editors not in card__body */
.sm-cc-setting--token-editor,
.sm-cc-setting--structured-token-editor {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 0.5rem 1rem;
    align-items: start;
}

.sm-cc-setting--token-editor .setting-item-info,
.sm-cc-setting--structured-token-editor .setting-item-info {
    grid-row: 1;
    grid-column: 1;
}

.sm-cc-setting--token-editor .setting-item-control,
.sm-cc-setting--structured-token-editor .setting-item-control {
    grid-row: 1;
    grid-column: 2;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 0.5rem;
}

.sm-cc-setting--token-editor .sm-cc-chips,
.sm-cc-setting--structured-token-editor .sm-cc-chips {
    grid-row: 2;
    grid-column: 2;
    margin: 0;
}

.sm-cc-input {
    width: 100%;
    min-height: 34px;
    padding: .3rem .55rem;
    box-sizing: border-box;
    border-radius: 8px;
}
.sm-cc-input--small { max-width: 120px; }
.sm-cc-select {
    width: 100%;
    min-height: 34px;
    box-sizing: border-box;
    border-radius: 8px;
}
.sm-cc-textarea {
    width: 100%;
    min-height: 140px;
    resize: vertical;
    padding: .45rem .6rem;
    border-radius: 8px;
}

/* Display field (computed/read-only values) */
.sm-cc-display-field {
    width: 100%;
    min-height: 34px;
    padding: .3rem .55rem;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--background-secondary);
    color: var(--text-muted);
    text-align: center;
    font-family: var(--font-monospace);
    font-weight: 500;
    cursor: default;
    opacity: 0.9;
}

/* Conditional visibility */
.sm-cc-composite-item.is-hidden,
.sm-cc-setting.is-hidden {
    display: none !important;
}

.sm-cc-setting--alignment-override {
    border-radius: 10px;
    border: 1px dashed var(--background-modifier-border);
    background: color-mix(in srgb, var(--background-secondary) 65%, transparent);
    padding: .5rem .65rem;
}
.sm-cc-setting--alignment-override .setting-item-info { margin-bottom: .35rem; }
.sm-cc-setting--alignment-override .setting-item-control {
    width: 100%;
}
.sm-cc-input--alignment-override {
    background: transparent;
}

/* Composite field grid (for abilities, speeds, etc.) */
.sm-cc-composite-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem 1rem;
    align-items: start;
}

/* Composite field grouped layout (keeps groups of fields together) */
.sm-cc-composite-grouped {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}

.sm-cc-composite-group {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--background-secondary) 40%, transparent);
}

.sm-cc-composite-item {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    align-items: center;
}

.sm-cc-composite-item .sm-cc-field-label {
    min-width: fit-content;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
}

.sm-cc-composite-item .sm-cc-field-control {
    flex: 1;
    min-width: 0;
}

/* Repeating field template-based rendering */
.sm-cc-repeating-list {
    /* Wide setting to span full width */
}

.sm-cc-repeating-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-cc-repeating-item {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    background: color-mix(in srgb, var(--background-secondary) 40%, transparent);
}

.sm-cc-repeating-field {
    display: flex;
    flex-direction: row;
    gap: 0.35rem;
    align-items: center;
    min-width: fit-content;
}

.sm-cc-repeating-field.is-hidden {
    display: none !important;
}

.sm-cc-repeating-field .sm-cc-field-label {
    min-width: fit-content;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
}

.sm-cc-repeating-field .sm-cc-field-control {
    display: flex;
    align-items: center;
    min-width: 0;
}

.sm-cc-field-heading {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-normal);
    white-space: nowrap;
}

/* Display field (read-only computed values) */
.sm-cc-display-field {
    font-weight: 500;
    color: var(--text-normal);
    text-align: center;
    min-width: 2.5ch;
}

/* Clickable icon field (e.g., star for expertise/proficiency) */
.sm-cc-clickable-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
    transition: color 0.15s ease, transform 0.1s ease;
    min-width: 1.5ch;
    text-align: center;
}

.sm-cc-clickable-icon:hover {
    color: var(--text-normal);
    transform: scale(1.15);
}

.sm-cc-clickable-icon:active {
    transform: scale(0.95);
}

.sm-cc-clickable-icon:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 4px;
}

.sm-cc-clickable-icon--active {
    color: var(--color-yellow, #facc15);
}

.sm-cc-speeds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}
@media (max-width: 680px) {
    .sm-cc-speeds-grid { grid-template-columns: minmax(0, 1fr); }
}
.sm-cc-speed {
    display: flex;
    flex-direction: column;
    gap: .45rem;
    padding: .55rem .6rem;
    border-radius: 10px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    box-shadow: 0 4px 12px rgba(15, 23, 42, .04);
}
.sm-cc-speed__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .5rem;
}
.sm-cc-speed__label {
    font-size: .8rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--text-muted);
}
.sm-cc-speed__badge {
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    padding: .1rem .6rem;
    font-size: .7rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border 120ms ease, box-shadow 120ms ease;
}
.sm-cc-speed__badge.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #fff);
    border-color: color-mix(in srgb, var(--interactive-accent) 55%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--interactive-accent) 35%, transparent);
}
.sm-cc-speed__input { width: 100%; }

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
.sm-cc-component-grid { display: grid; grid-template-columns: repeat(6, max-content); gap: .35rem .5rem; align-items: center; }

.sm-cc-skills { margin-top: .5rem; }
.sm-cc-skill-group { border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: .5rem; margin: .35rem 0; }
.sm-cc-skill-group__title { font-weight: 600; margin-bottom: .25rem; }
.sm-cc-skill { display: grid; grid-template-columns: 1fr max-content max-content; gap: .5rem; align-items: center; margin: .15rem 0; }

.sm-cc-chips { display:flex; gap:.4rem; flex-wrap:wrap; margin:.35rem 0 .6rem; }
.sm-cc-chip {
    display:inline-flex;
    align-items:center;
    gap:.3rem;
    border:1px solid var(--background-modifier-border);
    border-radius:999px;
    padding:.2rem .6rem;
    background: color-mix(in srgb, var(--background-secondary) 80%, transparent);
    font-size:.85em;
    color: var(--text-muted);
    box-shadow:0 3px 8px rgba(15,23,42,.04);
}

/* Modular Token System - Segmented Chips with Inline Editing */
.sm-cc-chip__segment {
    display: inline-flex;
    align-items: center;
    gap: .15rem;
}

.sm-cc-chip__segment--editable {
    cursor: pointer;
    padding: .1rem .3rem;
    margin: -.1rem -.3rem;
    border-radius: 4px;
    transition: background-color 0.15s ease;
}

.sm-cc-chip__segment--editable:hover {
    background: var(--background-modifier-hover);
}

.sm-cc-chip__label {
    font-weight: 500;
    color: var(--text-normal);
    font-size: .9em;
}

.sm-cc-chip__value {
    font-weight: 400;
    color: var(--text-muted);
}

/* Inline editor inputs within chips */
.sm-cc-inline-editor {
    min-width: 40px;
    padding: .15rem .35rem;
    border: 1px solid var(--interactive-accent);
    border-radius: 3px;
    background: var(--background-primary);
    font-size: .85em;
    color: var(--text-normal);
    box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.15);
}

.sm-cc-inline-editor:focus {
    outline: none;
    border-color: var(--interactive-accent);
}

.sm-cc-inline-editor--text {
    min-width: 60px;
}

.sm-cc-inline-editor--number {
    min-width: 50px;
    max-width: 80px;
}

.sm-cc-inline-editor--select {
    min-width: 80px;
    cursor: pointer;
}

.sm-cc-tag-actions {
    display: flex;
    margin-top: .5rem;
}
.sm-cc-tag-actions button {
    border: 1px dashed var(--background-modifier-border);
    border-radius: 8px;
    background: transparent;
    padding: .35rem .75rem;
    cursor: pointer;
    font-weight: 600;
}
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
.sm-cc-defense-summary {
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:.4rem;
    margin:.35rem 0 .75rem;
}
.sm-cc-defense-pill {
    display:inline-flex;
    align-items:center;
    gap:.35rem;
    border:1px solid var(--background-modifier-border);
    border-radius:999px;
    padding:.2rem .7rem;
    background: color-mix(in srgb, var(--background-secondary) 80%, transparent);
    font-size:.85em;
    color: var(--text-muted);
    box-shadow:0 3px 8px rgba(15,23,42,.05);
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
.sm-cc-defense-pill__label {
    font-weight:600;
    color: var(--text-normal);
}
.sm-cc-defense-pill__count {
    font-weight:700;
    font-variant-numeric: tabular-nums;
}
.sm-cc-defense-pill.is-empty {
    opacity:.65;
}
.sm-cc-defense-pill--res {
    border-color: color-mix(in srgb, var(--interactive-accent) 45%, transparent);
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-secondary));
}
.sm-cc-defense-pill--res .sm-cc-defense-pill__label,
.sm-cc-defense-pill--res .sm-cc-defense-pill__count {
    color: var(--interactive-accent);
}
.sm-cc-defense-pill--imm {
    border-color: color-mix(in srgb, var(--color-purple, #7c3aed) 45%, transparent);
    background: color-mix(in srgb, var(--color-purple, #7c3aed) 12%, var(--background-secondary));
}
.sm-cc-defense-pill--imm .sm-cc-defense-pill__label,
.sm-cc-defense-pill--imm .sm-cc-defense-pill__count {
    color: var(--color-purple, #7c3aed);
}
.sm-cc-defense-pill--vuln {
    border-color: color-mix(in srgb, var(--color-orange, #ea580c) 45%, transparent);
    background: color-mix(in srgb, var(--color-orange, #ea580c) 12%, var(--background-secondary));
}
.sm-cc-defense-pill--vuln .sm-cc-defense-pill__label,
.sm-cc-defense-pill--vuln .sm-cc-defense-pill__count {
    color: var(--color-orange, #ea580c);
}
.sm-cc-defense-pill--cond {
    border-color: color-mix(in srgb, var(--color-green, #10b981) 45%, transparent);
    background: color-mix(in srgb, var(--color-green, #10b981) 12%, var(--background-secondary));
}
.sm-cc-defense-pill--cond .sm-cc-defense-pill__label,
.sm-cc-defense-pill--cond .sm-cc-defense-pill__count {
    color: var(--color-green, #10b981);
}
.sm-cc-defense-pill__empty {
    font-size:.85em;
    color: var(--text-muted);
    font-style: italic;
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
.sm-cc-chip__remove { background:none; border:none; cursor:pointer; font-size:.85rem; line-height:1; padding:0; color: var(--text-muted); }
.sm-cc-chip__remove:hover { color: var(--text-normal); }

/* Movement Editor */
.sm-cc-movement-row { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
.sm-cc-movement-select { flex:1 1 220px; min-width:200px; }
.sm-cc-movement-distance { flex:0 0 120px; min-width:100px; }
.sm-cc-movement-hover { display:inline-flex; align-items:center; gap:.35rem; flex:0 0 auto; }
.sm-cc-movement-hover input { margin:0; }
.sm-cc-movement-add { flex:0 0 auto; margin-left:auto; }
.sm-cc-movement-chips { gap:.45rem; }
.sm-cc-movement-chip { align-items:center; gap:.4rem; padding-right:.5rem; }
.sm-cc-movement-chip__label { font-weight:600; color: var(--text-normal); }
.sm-cc-movement-chip__distance { font-weight:500; }
.sm-cc-movement-chip__badge { font-size:.75em; font-weight:600; border-radius:999px; padding:.1rem .45rem; text-transform:uppercase; letter-spacing:.03em; background-color: color-mix(in srgb, var(--interactive-accent) 18%, transparent); color: var(--interactive-accent); }

/* Creature Spellcasting – Layout & Preview */
.sm-cc-spellcasting {
    display: grid;
    gap: 1.25rem;
}
@media (min-width: 1080px) {
    .sm-cc-spellcasting {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        align-items: start;
    }
}
.sm-cc-spellcasting__ability .setting-item-control {
    gap: .65rem;
    align-items: flex-start;
}
.sm-cc-spellcasting__computed {
    display: inline-flex;
    flex-wrap: wrap;
    gap: .35rem;
    align-items: center;
    margin-top: .25rem;
}
.sm-cc-spellcasting__computed-save,
.sm-cc-spellcasting__computed-attack {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    padding: .2rem .6rem;
    border-radius: 999px;
    font-size: .75rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    font-weight: 600;
    background: color-mix(in srgb, var(--background-secondary) 85%, transparent);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-muted);
}
.sm-cc-spellcasting__overrides {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    margin-top: .35rem;
}
.sm-cc-spellcasting__overrides .sm-cc-input--small {
    flex: 0 0 120px;
}

.sm-cc-spellcasting__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    align-items: center;
    margin: .75rem 0 .5rem;
}
.sm-cc-button {
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    padding: .35rem .9rem;
    background: var(--background-primary);
    font-weight: 600;
    font-size: .85em;
    letter-spacing: .04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border 120ms ease, box-shadow 120ms ease;
}
.sm-cc-button:hover { color: var(--text-normal); }
.sm-cc-button:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 1px; }

.sm-cc-spellcasting__groups {
    display: flex;
    flex-direction: column;
    gap: .85rem;
}
.sm-cc-spellcasting__groups-empty {
    border: 1px dashed var(--background-modifier-border);
    border-radius: 10px;
    padding: .75rem;
    text-align: center;
    font-size: .9em;
    color: var(--text-muted);
    background: color-mix(in srgb, var(--background-secondary) 70%, transparent);
}
.sm-cc-spellcasting__preview {
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 1rem;
    background: color-mix(in srgb, var(--background-secondary) 80%, transparent);
    display: flex;
    flex-direction: column;
    gap: .75rem;
}
.sm-cc-spellcasting-preview__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
}
.sm-cc-spellcasting-preview__header h4 { margin: 0; }
.sm-cc-spellcasting-preview__notes {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: .25rem;
}
.sm-cc-spellcasting-preview__groups {
    display: flex;
    flex-direction: column;
    gap: .65rem;
}
.sm-cc-spellcasting-preview__group {
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: .6rem .75rem;
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
    gap: .35rem;
}
.sm-cc-spellcasting-preview__group h5 { margin: 0; }
.sm-cc-spellcasting-preview__group ul {
    margin: 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: .25rem;
}
.sm-cc-spellcasting-preview__note {
    font-size: .85em;
    color: var(--text-muted);
}
.sm-cc-spellcasting-preview__empty {
    font-size: .9em;
    font-style: italic;
    color: var(--text-muted);
}

/* === Spell Groups - Improved UI === */
.sm-cc-spell-group {
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--background-secondary) 75%, transparent);
    box-shadow: 0 6px 14px rgba(15, 23, 42, .05);
    padding: .95rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
    margin-bottom: .75rem;
}

.sm-cc-spell-group--at-will {
    background: color-mix(in srgb, var(--color-green, #10b981) 8%, var(--background-secondary));
    border-color: color-mix(in srgb, var(--color-green, #10b981) 25%, transparent);
}

.sm-cc-spell-group--per-day {
    background: color-mix(in srgb, var(--color-yellow, #f59e0b) 8%, var(--background-secondary));
    border-color: color-mix(in srgb, var(--color-yellow, #f59e0b) 25%, transparent);
}

.sm-cc-spell-group--level {
    background: color-mix(in srgb, var(--interactive-accent) 8%, var(--background-secondary));
    border-color: color-mix(in srgb, var(--interactive-accent) 25%, transparent);
}

.sm-cc-spell-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
    margin-bottom: .65rem;
    padding-bottom: .65rem;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-cc-spell-group-header-left {
    display: flex;
    align-items: center;
    gap: .5rem;
    flex: 1;
    min-width: 0;
}

.sm-cc-spell-group-header-right {
    display: flex;
    align-items: center;
    gap: .65rem;
}

.sm-cc-spell-group-separator {
    color: var(--text-muted);
    font-weight: 400;
}

.sm-cc-spell-group-suffix {
    color: var(--text-muted);
    font-size: .9em;
}

.sm-cc-spell-count {
    opacity: 0.7;
    font-size: .85em;
    font-weight: 600;
    color: var(--text-muted);
    padding: .2rem .6rem;
    border-radius: 999px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
}

/* Spell List Styles */
.sm-cc-spellcasting-spells-list {
    display: flex;
    flex-direction: column;
    gap: .45rem;
}

.sm-cc-spell-item {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .5rem;
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    transition: background 120ms ease, box-shadow 120ms ease;
}

.sm-cc-spell-item:nth-child(even) {
    background: color-mix(in srgb, var(--background-secondary) 95%, transparent);
}

.sm-cc-spell-item:hover {
    background: color-mix(in srgb, var(--background-secondary) 100%, transparent);
    box-shadow: 0 2px 8px rgba(15, 23, 42, .08);
}

.sm-cc-spellcasting-spell-input {
    flex: 1;
    min-width: 0;
    padding: .35rem .5rem;
    border-radius: 6px;
    background: transparent;
    border: 1px solid transparent;
    transition: border-color 120ms ease, background 120ms ease;
}

.sm-cc-spellcasting-spell-input:focus {
    border-color: var(--interactive-accent);
    background: var(--background-primary);
}

.sm-cc-spellcasting-spell-input::placeholder {
    color: var(--text-muted);
    opacity: 0.6;
}

.sm-cc-spell-delete {
    flex: 0 0 auto;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.1rem;
    padding: .25rem .35rem;
    border-radius: 6px;
    color: var(--text-muted);
    transition: background 120ms ease, color 120ms ease;
}

.sm-cc-spell-delete:hover {
    background: color-mix(in srgb, var(--color-red, #e11d48) 15%, var(--background-secondary));
    color: var(--color-red, #e11d48);
}

/* Inline Add Spell Button */
.sm-cc-spell-add-inline {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px dashed var(--background-modifier-border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: .25rem;
    transition: all 120ms ease;
}

.sm-cc-spell-add-inline:hover {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    color: var(--interactive-accent);
    border-style: solid;
    transform: scale(1.05);
}

.sm-cc-spell-add-inline:active {
    transform: scale(0.95);
}

/* Add Group Buttons */
.sm-cc-spellcasting-add-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    margin-top: .5rem;
    padding-top: .75rem;
    border-top: 1px dashed var(--background-modifier-border);
}

.sm-cc-spellcasting-groups {
    display: flex;
    flex-direction: column;
    gap: 0;
}

/* Button Small Styles */
.sm-cc-button-small {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: .25rem .5rem;
    background: var(--background-secondary);
    font-size: .85em;
    cursor: pointer;
    transition: all 120ms ease;
}

.sm-cc-button-small:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #fff);
    border-color: var(--interactive-accent);
}


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
.sm-cc-create-modal .sm-cc-entries { display: block; }
.sm-cc-create-modal .sm-cc-entries .setting-item-info { display: block; width: 100%; margin-bottom: .35rem; }
.sm-cc-create-modal .sm-cc-entries .setting-item-control { display: flex; flex-direction: column; align-items: stretch; gap: .5rem; width: 100%; }
.sm-cc-create-modal .sm-cc-entries .sm-cc-searchbar { width: 100%; }
.sm-cc-create-modal .setting-item-control > * { max-width: 100%; }

/* Spell Creator – Validierung für höhere Grade */
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
.sm-cc-create-modal .sm-cc-stats-col { display: flex; flex-direction: column; gap: .12rem; min-width: 0; }
.sm-cc-create-modal .sm-cc-stats-col__header { display: flex; align-items: end; justify-content: flex-end; gap: .25rem; padding: 0 0 .15rem 0; margin: 0 0 .15rem 0; font-size: .85em; color: var(--text-muted); }
.sm-cc-create-modal .sm-cc-stats-col__header-cell { display: flex; align-items: center; justify-content: flex-end; gap: .2rem; font-weight: 600; }
.sm-cc-create-modal .sm-cc-stats-col__header-cell--save { gap: .25rem; }
.sm-cc-create-modal .sm-cc-stats-col__header-save-mod { font-size: .78em; letter-spacing: .06em; text-transform: uppercase; min-width: 3ch; text-align: right; }
.sm-cc-create-modal .sm-cc-stats-col__header-save-label { font-weight: 600; }
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
}

/* Compact inline number controls */
.sm-inline-number {
    display: inline-flex;
    align-items: stretch;
    gap: 0;
}
.sm-inline-number input[type="number"] {
    width: 84px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
}
.sm-cc-create-modal .sm-cc-stat-row .sm-inline-number { gap: 0; }
.sm-cc-create-modal .sm-cc-stat-row .sm-inline-number input[type="number"].sm-cc-stat-row__score-input {
    width: calc(2.2ch + 10px);
    min-width: calc(2.2ch + 10px);
    text-align: center;
    padding-inline: 0;
}

/* Vertical button group for number stepper */
.sm-number-stepper-buttons {
    display: flex;
    flex-direction: column;
    align-self: stretch;
}

.sm-number-stepper-buttons button {
    flex: 1;
    min-height: 0;
    padding: 0;
    min-width: 1.5rem;
    line-height: 1;
    border-radius: 0;
    font-size: 0.85rem;
    border-left: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

.sm-number-stepper-buttons button:first-child {
    border-top-right-radius: var(--radius-s);
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-number-stepper-buttons button:last-child {
    border-bottom-right-radius: var(--radius-s);
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
.sm-sd__input {
    width: 100%;
    min-height: 34px;  /* Match .sm-cc-input for consistent row heights */
}
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

/* Einträge-Abschnitt: Verbesserte Button-Gruppe zum Hinzufügen */
.sm-cc-entry-add-bar {
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .75rem;
    margin: .5rem 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--background-secondary) 85%, transparent);
}
.sm-cc-entry-add-label {
    font-size: .85rem;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--text-muted);
}
.sm-cc-entry-add-group {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
}
.sm-cc-entry-host {
    display: flex;
    flex-direction: column;
}
.sm-cc-entry-add-btn {
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    padding: .35rem .85rem;
    background: var(--background-primary);
    font-weight: 600;
    font-size: .85em;
    letter-spacing: .04em;
    cursor: pointer;
    transition: all 120ms ease;
}
.sm-cc-entry-add-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(15, 23, 42, .12);
}

/* Farbcodierung für Kategorien */
.sm-cc-entry-add-btn--trait {
    background: color-mix(in srgb, var(--color-green, #10b981) 12%, var(--background-primary));
    border-color: color-mix(in srgb, var(--color-green, #10b981) 35%, transparent);
    color: var(--color-green, #10b981);
}
.sm-cc-entry-add-btn--trait:hover {
    background: color-mix(in srgb, var(--color-green, #10b981) 18%, var(--background-primary));
}
.sm-cc-entry-add-btn--action {
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-primary));
    border-color: color-mix(in srgb, var(--interactive-accent) 35%, transparent);
    color: var(--interactive-accent);
}
.sm-cc-entry-add-btn--action:hover {
    background: color-mix(in srgb, var(--interactive-accent) 18%, var(--background-primary));
}
.sm-cc-entry-add-btn--bonus {
    background: color-mix(in srgb, var(--color-yellow, #f59e0b) 12%, var(--background-primary));
    border-color: color-mix(in srgb, var(--color-yellow, #f59e0b) 35%, transparent);
    color: var(--color-yellow, #f59e0b);
}
.sm-cc-entry-add-btn--bonus:hover {
    background: color-mix(in srgb, var(--color-yellow, #f59e0b) 18%, var(--background-primary));
}
.sm-cc-entry-add-btn--reaction {
    background: color-mix(in srgb, var(--color-orange, #ea580c) 12%, var(--background-primary));
    border-color: color-mix(in srgb, var(--color-orange, #ea580c) 35%, transparent);
    color: var(--color-orange, #ea580c);
}
.sm-cc-entry-add-btn--reaction:hover {
    background: color-mix(in srgb, var(--color-orange, #ea580c) 18%, var(--background-primary));
}
.sm-cc-entry-add-btn--legendary {
    background: color-mix(in srgb, var(--color-purple, #7c3aed) 12%, var(--background-primary));
    border-color: color-mix(in srgb, var(--color-purple, #7c3aed) 35%, transparent);
    color: var(--color-purple, #7c3aed);
}
.sm-cc-entry-add-btn--legendary:hover {
    background: color-mix(in srgb, var(--color-purple, #7c3aed) 18%, var(--background-primary));
}

/* Entry-Karten: Verbesserte Struktur */
.sm-cc-entry-card {
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    background: var(--background-primary);
    box-shadow: 0 4px 12px rgba(15, 23, 42, .06);
    padding: .85rem;
    margin: .65rem 0;
    display: flex;
    flex-direction: column;
    gap: .75rem;
}

.sm-cc-entry-card.sm-cc-entry-hidden {
    display: none;
}

.sm-cc-entry-head {
    display: grid;
    grid-template-columns: max-content 1fr max-content;
    gap: .65rem;
    align-items: center;
}
.sm-cc-entry-badge {
    display: inline-flex;
    align-items: center;
    padding: .25rem .75rem;
    border-radius: 999px;
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    border: 1px solid;
}
.sm-cc-entry-badge--trait {
    background: color-mix(in srgb, var(--color-green, #10b981) 12%, var(--background-secondary));
    color: var(--color-green, #10b981);
    border-color: color-mix(in srgb, var(--color-green, #10b981) 35%, transparent);
}
.sm-cc-entry-badge--action {
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-secondary));
    color: var(--interactive-accent);
    border-color: color-mix(in srgb, var(--interactive-accent) 35%, transparent);
}
.sm-cc-entry-badge--bonus {
    background: color-mix(in srgb, var(--color-yellow, #f59e0b) 12%, var(--background-secondary));
    color: var(--color-yellow, #f59e0b);
    border-color: color-mix(in srgb, var(--color-yellow, #f59e0b) 35%, transparent);
}
.sm-cc-entry-badge--reaction {
    background: color-mix(in srgb, var(--color-orange, #ea580c) 12%, var(--background-secondary));
    color: var(--color-orange, #ea580c);
    border-color: color-mix(in srgb, var(--color-orange, #ea580c) 35%, transparent);
}
.sm-cc-entry-badge--legendary {
    background: color-mix(in srgb, var(--color-purple, #7c3aed) 12%, var(--background-secondary));
    color: var(--color-purple, #7c3aed);
    border-color: color-mix(in srgb, var(--color-purple, #7c3aed) 35%, transparent);
}
.sm-cc-entry-name-box {
    position: relative;
    flex: 1;
    min-width: 0;
}
.sm-cc-entry-name {
    width: 100%;
    min-width: 0;
    padding: .35rem .55rem;
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    font-weight: 600;
}
.sm-cc-entry-name-box .sm-preset-menu {
    min-width: 320px;
}
.sm-cc-entry-delete {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.1rem;
    padding: .25rem .35rem;
    border-radius: 6px;
    transition: background 120ms ease;
}
.sm-cc-entry-delete:hover {
    background: color-mix(in srgb, var(--color-red, #e11d48) 12%, var(--background-secondary));
}
.sm-cc-entry-section {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    padding: .5rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--background-secondary) 65%, transparent);
}
.sm-cc-entry-section--details {
    background: transparent;
    padding: 0;
}
.sm-cc-entry-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: .75rem;
    row-gap: .45rem;
    align-items: center;
}
.sm-cc-entry-grid label {
    font-size: .85em;
    color: var(--text-muted);
    font-weight: 600;
}
.sm-cc-entry-input {
    width: 100%;
    padding: .3rem .5rem;
    border-radius: 6px;
}
.sm-cc-entry-label {
    font-size: .85em;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: .25rem;
}
.sm-cc-entry-text {
    width: 100%;
    min-height: 140px;
    resize: vertical;
    padding: .45rem .55rem;
    border-radius: 8px;
}

/* === Entry Section Collapsible Functionality === */
/* Entry Section Headers for Collapsible functionality */
.sm-cc-entry-section-header {
    font-size: .85em;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: .5rem;
    padding: .35rem .5rem;
    border-radius: 6px;
    background: color-mix(in srgb, var(--background-secondary) 85%, transparent);
    transition: background 120ms ease;
}

/* Collapsible section styles */
.sm-cc-section--collapsible .sm-cc-entry-section-header {
    cursor: pointer;
    user-select: none;
}

.sm-cc-section--collapsible .sm-cc-entry-section-header:hover {
    background: color-mix(in srgb, var(--background-secondary) 95%, transparent);
}

.sm-cc-section--collapsible .section-header {
    display: flex;
    align-items: center;
    gap: .5rem;
}

.sm-cc-section--collapsed .section-content {
    display: none;
}

.sm-cc-section--collapsible .section-chevron {
    transition: transform 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
}

.sm-cc-section--collapsed .section-chevron {
    transform: rotate(-90deg);
}

.sm-cc-section--collapsible .section-header-text {
    flex: 1;
}


/* === Entry Type Color Coding === */
/* Entry type row styling */
.sm-cc-entry-type-row {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .5rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--background-secondary) 75%, transparent);
    margin-bottom: .35rem;
}

.sm-cc-entry-type-label {
    font-size: .85em;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-cc-entry-type-select {
    flex: 1;
    min-width: 180px;
}

/* Entry type badges */
.sm-cc-entry-type-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: .2rem .6rem;
    border-radius: 999px;
    font-size: .7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    margin-left: auto;
    opacity: 0.85;
    transition: opacity 120ms ease, transform 120ms ease;
}

.sm-cc-entry-type-badge:hover {
    opacity: 1;
    transform: scale(1.05);
}

/* Entry type: Passive */
.sm-cc-entry-card--type-passive {
    border-left: 3px solid color-mix(in srgb, var(--text-muted) 75%, transparent);
}

.sm-cc-entry-type-badge--passive {
    background: color-mix(in srgb, var(--text-muted) 18%, var(--background-secondary));
    color: var(--text-muted);
}

/* Entry type: Attack */
.sm-cc-entry-card--type-attack {
    border-left: 3px solid color-mix(in srgb, var(--color-red, #dc3545) 85%, transparent);
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-red, #dc3545) 4%, transparent) 0%, transparent 100%);
}

.sm-cc-entry-type-badge--attack {
    background: color-mix(in srgb, var(--color-red, #dc3545) 18%, var(--background-secondary));
    color: var(--color-red, #dc3545);
}

/* Entry type: Save Action */
.sm-cc-entry-card--type-save-action {
    border-left: 3px solid color-mix(in srgb, var(--color-orange, #fd7e14) 85%, transparent);
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-orange, #fd7e14) 4%, transparent) 0%, transparent 100%);
}

.sm-cc-entry-type-badge--save-action {
    background: color-mix(in srgb, var(--color-orange, #fd7e14) 18%, var(--background-secondary));
    color: var(--color-orange, #fd7e14);
}

/* Entry type: Multiattack */
.sm-cc-entry-card--type-multiattack {
    border-left: 3px solid color-mix(in srgb, var(--color-purple, #6f42c1) 85%, transparent);
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-purple, #6f42c1) 4%, transparent) 0%, transparent 100%);
}

.sm-cc-entry-type-badge--multiattack {
    background: color-mix(in srgb, var(--color-purple, #6f42c1) 18%, var(--background-secondary));
    color: var(--color-purple, #6f42c1);
}

/* Entry type: Spellcasting */
.sm-cc-entry-card--type-spellcasting {
    border-left: 3px solid color-mix(in srgb, var(--interactive-accent, #0d6efd) 85%, transparent);
    background: linear-gradient(90deg, color-mix(in srgb, var(--interactive-accent, #0d6efd) 4%, transparent) 0%, transparent 100%);
}

.sm-cc-entry-type-badge--spellcasting {
    background: color-mix(in srgb, var(--interactive-accent, #0d6efd) 18%, var(--background-secondary));
    color: var(--interactive-accent, #0d6efd);
}

/* Dark theme adjustments */
.theme-dark .sm-cc-entry-card--type-attack,
.theme-dark .sm-cc-entry-card--type-save-action,
.theme-dark .sm-cc-entry-card--type-multiattack,
.theme-dark .sm-cc-entry-card--type-spellcasting {
    background: linear-gradient(90deg, color-mix(in srgb, currentColor 6%, transparent) 0%, transparent 100%);
}

/* Ensure text readability on colored cards */
.sm-cc-entry-card--type-attack .sm-cc-entry-name,
.sm-cc-entry-card--type-save-action .sm-cc-entry-name,
.sm-cc-entry-card--type-multiattack .sm-cc-entry-name,
.sm-cc-entry-card--type-spellcasting .sm-cc-entry-name {
    background: var(--background-primary);
}

/* Entry card action buttons */
.sm-cc-entry-actions {
    display: flex;
    align-items: center;
    gap: .35rem;
}

.sm-cc-entry-move-btn {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    cursor: pointer;
    font-size: .9rem;
    padding: .25rem .35rem;
    border-radius: 6px;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.8rem;
    min-height: 1.8rem;
}

.sm-cc-entry-move-btn:hover:not(:disabled) {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #fff);
    border-color: var(--interactive-accent);
}

.sm-cc-entry-move-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.sm-cc-entry-move-btn svg {
    width: 14px;
    height: 14px;
}


`;
const cartographerShellCss = `
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
const cartographerPanelsCss = `
/* === Cartographer Panels (Editor & Inspector) === */

/* Library header */
.sm-library .sm-lib-header,
.sm-atlas .sm-lib-header,
.sm-almanac .sm-lib-header { display:flex; gap:.4rem; margin:.25rem 0 .25rem; }
.sm-library .sm-lib-header button,
.sm-atlas .sm-lib-header button,
.sm-almanac .sm-lib-header button { border: 1px solid var(--background-modifier-border); background: var(--background-secondary); padding:.25rem .75rem; border-radius:6px; cursor:pointer; }
.sm-library .sm-lib-header button.is-active,
.sm-atlas .sm-lib-header button.is-active,
.sm-almanac .sm-lib-header button.is-active { background: var(--interactive-accent); color: var(--text-on-accent,#fff); }
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
const travelModeCss = `
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

const presetsCss = `
/* === Presets & Autocomplete === */

/* Library separator */
.sm-cc-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1.5rem 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Preset items in library */
.sm-cc-item--preset {
  opacity: 0.9;
  background: color-mix(in srgb, var(--interactive-accent) 5%, transparent);
  border-left: 3px solid var(--interactive-accent);
}

.sm-cc-item--preset:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
}

/* Autocomplete dropdown */
.sm-cc-autocomplete {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  margin-top: 0.25rem;
  max-height: 300px;
  overflow-y: auto;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.sm-cc-autocomplete__item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 100ms ease;
  border-bottom: 1px solid var(--background-modifier-border);
}

.sm-cc-autocomplete__item:last-child {
  border-bottom: none;
}

.sm-cc-autocomplete__item:hover,
.sm-cc-autocomplete__item.is-selected {
  background: var(--background-modifier-hover);
}

.sm-cc-autocomplete__name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.sm-cc-autocomplete__meta {
  font-size: 0.85rem;
  color: var(--text-muted);
}
`;

/**
 * Data Manager (Library) CSS
 * Filter/sort controls and list items for browsable entity collections
 */
const dataManagerCss = `
/* === Data Manager Controls === */
/* Filter/Sort Controls Container */
.sm-cc-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

/* Filter and Sorting Sections */
.sm-cc-filters,
.sm-cc-sorting {
    background-color: var(--background-secondary);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
}

/* Section Headers */
.sm-cc-section-header {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Filter and Sort Content Containers */
.sm-cc-filter-content,
.sm-cc-sort-content {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
}

/* Individual Filter and Sort Items */
.sm-cc-filter,
.sm-cc-sort {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sm-cc-filter label,
.sm-cc-sort label {
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
}

.sm-cc-filter select,
.sm-cc-sort select {
    min-width: 120px;
    padding: 0.35rem 0.75rem;
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
}

.sm-cc-filter select:hover,
.sm-cc-sort select:hover {
    border-color: var(--interactive-accent);
    background-color: var(--background-modifier-hover);
}

.sm-cc-filter select:focus,
.sm-cc-sort select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
}

/* Sort Direction Button */
.sm-cc-sort-direction {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.sm-cc-sort-direction:hover {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    transform: translateY(-1px);
}

.sm-cc-sort-direction:active {
    transform: translateY(0);
}

/* Clear Filters Button */
.sm-cc-clear-filters {
    margin-left: auto;
    padding: 0.35rem 0.75rem;
    background-color: var(--interactive-normal);
    border: none;
    border-radius: 4px;
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 500;
    transition: all 0.2s ease;
}

.sm-cc-clear-filters:hover {
    background-color: var(--interactive-hover);
}

.sm-cc-clear-filters:active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}

/* Responsive Design for Controls */
@media (max-width: 768px) {
    .sm-cc-controls {
        grid-template-columns: 1fr;
    }

    .sm-cc-filter-content,
    .sm-cc-sort-content {
        flex-direction: column;
        align-items: stretch;
    }

    .sm-cc-filter,
    .sm-cc-sort {
        width: 100%;
    }

    .sm-cc-filter select,
    .sm-cc-sort select {
        width: 100%;
    }
}

/* === List Items === */
.sm-cc-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    background-color: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    transition: all 0.2s ease;
}

.sm-cc-item:hover {
    background-color: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
}

.sm-cc-item__name-container {
    flex: 1;
    min-width: 0;
}

.sm-cc-item__name {
    font-weight: 500;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sm-cc-item__badge {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.125rem 0.375rem;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.sm-cc-item__info {
    display: flex;
    gap: 0.75rem;
    align-items: center;
}

.sm-cc-item__type,
.sm-cc-item__cr {
    padding: 0.25rem 0.5rem;
    background-color: var(--background-primary);
    border-radius: 3px;
    font-size: 0.875rem;
    color: var(--text-muted);
}

.sm-cc-item__actions {
    display: flex;
    gap: 0.5rem;
}

.sm-cc-item__action {
    padding: 0.35rem 0.75rem;
    background-color: var(--interactive-normal);
    border: none;
    border-radius: 4px;
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.sm-cc-item__action:hover {
    background-color: var(--interactive-hover);
}

.sm-cc-item__action--edit {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-cc-item__action--edit:hover {
    background-color: var(--interactive-accent-hover, var(--interactive-accent));
}

/* List Container */
.sm-cc-list {
    display: flex;
    flex-direction: column;
}

/* === Suggestion Menu === */
.sm-cc-suggestion-menu {
    position: absolute;
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    margin-top: 4px;
    min-width: 200px;
}

.sm-cc-suggestion-item {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.sm-cc-suggestion-item:hover {
    background-color: var(--background-modifier-hover);
}

.sm-cc-suggestion-item.is-active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}
`;

/**
 * Encounter Workmode CSS
 * Complete styles for encounter calculator workspace
 */
const encounterCss = `
/* === Encounter Workspace === */
.sm-encounter-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0;
}

.sm-encounter-section {
    background-color: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-encounter-columns {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
}

.sm-encounter-column {
    display: flex;
    flex-direction: column;
    flex: 1 1 320px;
    gap: 1.5rem;
}

.sm-encounter-header {
    gap: 0.5rem;
}

.sm-encounter-heading {
    margin: 0;
    font-size: 1.4rem;
}

.sm-encounter-status {
    color: var(--text-muted);
    font-size: 0.95rem;
}

.sm-encounter-summary {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
}

.sm-encounter-summary .label {
    font-weight: 600;
}

.sm-encounter-summary .value {
    color: var(--text-muted);
}

.sm-encounter-empty {
    font-style: italic;
    color: var(--text-muted);
}

.sm-encounter-section-title {
    margin: 0;
    font-size: 1.1rem;
}

.sm-encounter-subheading {
    margin: 0;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
}

.sm-encounter-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-encounter-form-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    align-items: end;
}

.sm-encounter-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-encounter-field-inline {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
}

.sm-encounter-field-toggle {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
}

.sm-encounter-field label {
    font-size: 0.85rem;
    font-weight: 600;
}

.sm-encounter-field-inline label {
    margin-bottom: 0;
}

.sm-encounter-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
}

.sm-encounter-input:focus {
    border-color: var(--interactive-accent);
    outline: none;
    box-shadow: 0 0 0 2px var(--interactive-accent-hover, var(--interactive-accent));
}

.sm-encounter-field-inline .sm-encounter-input {
    width: auto;
    min-width: 8rem;
}

.sm-encounter-field-base-xp .sm-encounter-input {
    min-width: 6rem;
}

.sm-encounter-field-actions {
    display: flex;
    align-items: flex-end;
}

.sm-encounter-error {
    color: var(--text-error);
    font-size: 0.85rem;
}

.sm-encounter-inline-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: nowrap;
    align-items: center;
}

.sm-encounter-inline-actions-left {
    justify-content: flex-start;
}

.sm-encounter-inline-actions-right {
    justify-content: flex-end;
}

.sm-encounter-preset-select {
    min-width: 10rem;
}

.sm-encounter-button {
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.sm-encounter-button:hover:not(:disabled) {
    background-color: var(--interactive-hover);
    border-color: var(--interactive-accent);
}

.sm-encounter-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.sm-encounter-button-primary {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.sm-encounter-button-primary:hover:not(:disabled) {
    background-color: var(--interactive-accent-hover, var(--interactive-accent));
}

.sm-encounter-button-secondary {
    background-color: var(--background-primary);
}

.sm-encounter-button-danger {
    background-color: var(--background-modifier-error);
    border-color: var(--background-modifier-error);
    color: var(--text-on-accent);
}

.sm-encounter-button-danger:hover:not(:disabled) {
    background-color: var(--background-modifier-error-hover, var(--background-modifier-error));
}

.sm-encounter-xp-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 1rem;
    align-items: center;
}

.sm-encounter-xp-group {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.75rem;
    align-items: center;
}

.sm-encounter-xp-group-right {
    margin-left: auto;
    justify-content: flex-end;
    align-items: center;
}

@media (max-width: 900px) {
    .sm-encounter-xp-row {
        flex-wrap: wrap;
        align-items: flex-start;
    }

    .sm-encounter-xp-group {
        flex-wrap: wrap;
    }

    .sm-encounter-inline-actions {
        flex-wrap: wrap;
    }
}

.sm-encounter-party-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-encounter-rule-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.75rem;
    align-items: stretch;
}

.sm-encounter-party-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(120px, max-content) auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
}

.sm-encounter-party-field {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
}

.sm-encounter-party-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-encounter-party-remove {
    justify-self: end;
}

.sm-encounter-inline-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-encounter-rule {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    min-width: 0;
    height: 100%;
}

.sm-encounter-rule.is-disabled {
    opacity: 0.6;
}

.sm-encounter-rule-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: stretch;
}

.sm-encounter-rule-title {
    flex: 1 1 180px;
    min-width: 140px;
}

.sm-encounter-rule-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-modifier-hover);
    flex: 0 0 auto;
    align-self: stretch;
}

.sm-encounter-rule-toggle-input {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0;
}

.sm-encounter-rule-scope {
    flex: 0 1 120px;
    min-width: 110px;
}

.sm-encounter-rule-range {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 0 1 210px;
    min-width: 160px;
}

.sm-encounter-rule-range-input {
    flex: 1 1 0;
    min-width: 60px;
}

.sm-encounter-rule-range-separator {
    color: var(--text-muted);
}

.sm-encounter-rule-range-result {
    font-size: 0.85rem;
    color: var(--text-muted);
    white-space: nowrap;
}

.sm-encounter-rule-type {
    flex: 0 1 160px;
    min-width: 140px;
}

.sm-encounter-rule-notes {
    flex: 1 1 100%;
}

.sm-encounter-rule-notes textarea {
    min-height: 0;
    resize: vertical;
}

.sm-encounter-rule-effect {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-encounter-rule-total {
    font-weight: 600;
}

.sm-encounter-rule-deltas {
    margin: 0;
    padding-left: 1.25rem;
}

.sm-encounter-callout {
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-modifier-hover);
    padding: 0.75rem;
    font-size: 0.9rem;
}

.sm-encounter-callout p {
    margin: 0.25rem 0 0 0;
}

.sm-encounter-callout p:first-child {
    margin-top: 0;
}

.sm-encounter-result-totals {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.sm-encounter-result-total {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
    font-weight: 600;
}

.sm-encounter-result-total .label {
    color: var(--text-muted);
    font-weight: 600;
}

.sm-encounter-breakdowns {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.sm-encounter-result-party {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-encounter-result-summary {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-encounter-result-summary-item {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: baseline;
}

.sm-encounter-result-summary-item .label {
    font-weight: 600;
    color: var(--text-muted);
}

.sm-encounter-result-summary-item .value {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
}

.sm-encounter-result-summary-item--modifiers {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
}

.sm-encounter-result-summary-item--modifiers .label {
    margin-bottom: 0.25rem;
}

.sm-encounter-result-summary-item--modifiers .value {
    text-align: left;
}

.sm-encounter-result-modifier-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-encounter-result-modifier {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-variant-numeric: tabular-nums;
}

.sm-encounter-result-modifier .name {
    font-weight: 600;
}

.sm-encounter-result-modifier .delta {
    font-weight: 600;
}

.sm-encounter-result-modifier-empty {
    font-weight: 600;
    color: var(--text-muted);
}

.sm-encounter-debug-details {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background-color: var(--background-primary);
    padding: 0.75rem 1rem 1rem 1rem;
}

.sm-encounter-debug-summary {
    font-weight: 600;
    cursor: pointer;
    list-style: none;
    margin: -0.75rem -1rem 0 -1rem;
    padding: 0.75rem 1rem;
}

.sm-encounter-debug-summary::-webkit-details-marker {
    display: none;
}

.sm-encounter-debug-details[open] .sm-encounter-debug-summary {
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 0.75rem;
}

.sm-encounter-debug-rule-effects {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-encounter-result-party-member,
.sm-encounter-result-rule {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background-color: var(--background-primary);
    padding: 0.75rem;
}

.sm-encounter-result-party-member--xp-only {
    gap: 0.5rem;
}

.sm-encounter-result-party-member-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
}

.sm-encounter-result-party-member-row .name {
    font-weight: 600;
}

.sm-encounter-result-party-member-row .xp {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
}

.sm-encounter-result-party-summary {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
}

.sm-encounter-result-party-summary .label {
    color: var(--text-muted);
    font-weight: 600;
}

.sm-encounter-result-party-summary .value {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
}

.sm-encounter-result-party-header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
}

.sm-encounter-result-stats {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.25rem;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.sm-encounter-result-stats .label {
    font-weight: 600;
}

.sm-encounter-result-rule-title {
    font-weight: 600;
}

.sm-encounter-result-rule-title.is-disabled {
    opacity: 0.6;
}

.sm-encounter-result-rule-total {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
    font-weight: 600;
}

.sm-encounter-rule-final-xp {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-encounter-rule-final-xp-item {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
}

.sm-encounter-rule-final-xp-item .name {
    font-weight: 600;
}

.sm-encounter-rule-final-xp-item .xp {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
}

.sm-encounter-notes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-encounter-notes-label {
    font-weight: 600;
}

.sm-encounter-notes-input {
    width: 100%;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    padding: 0.6rem;
    background-color: var(--background-primary);
}

.sm-encounter-notes-input:focus {
    border-color: var(--interactive-accent);
    outline: none;
    box-shadow: 0 0 0 2px var(--interactive-accent-hover, var(--interactive-accent));
}

.sm-encounter-actions {
    display: flex;
    justify-content: flex-end;
}

.sm-encounter-empty-row {
    padding: 0.75rem;
    border-radius: 6px;
    background-color: var(--background-primary);
    border: 1px dashed var(--background-modifier-border);
    color: var(--text-muted);
    font-style: italic;
}

.sm-encounter-result-warnings {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-encounter-hidden {
    display: none !important;
}

@media (max-width: 720px) {
    .sm-encounter-column {
        flex-basis: 100%;
    }

    .sm-encounter-breakdowns {
        grid-template-columns: 1fr;
    }

    .sm-encounter-result-totals {
        flex-direction: column;
        align-items: flex-start;
    }
}
`;

/**
 * Tab Navigation CSS
 * Shared tab navigation styles for multi-mode views
 */
const tabNavigationCss = `
/* ==================== Tab Navigation ==================== */

.sm-tab-nav {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
}

.sm-tab-nav__button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: none;
    position: relative;
}

.sm-tab-nav__button:hover:not(.is-disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.sm-tab-nav__button.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-tab-nav__button.is-active:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.sm-tab-nav__button.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.sm-tab-nav__button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

.sm-tab-nav__icon {
    display: flex;
    align-items: center;
    font-size: 16px;
}

.sm-tab-nav__label {
    white-space: nowrap;
}

.sm-tab-nav__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 9px;
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
}

.sm-tab-nav__button.is-active .sm-tab-nav__badge {
    background: var(--text-on-accent);
    color: var(--interactive-accent);
}

/* Responsive: Icon-only on narrow screens */
@media (max-width: 520px) {
    .sm-tab-nav {
        gap: 2px;
        padding: 4px;
    }

    .sm-tab-nav__button {
        padding: 8px;
    }

    .sm-tab-nav__label {
        display: none;
    }

    .sm-tab-nav__icon {
        font-size: 18px;
    }
}
`;

// Exportiert alle Module einzeln, um gezielt überschrieben oder getestet zu werden.
export const HEX_PLUGIN_CSS_SECTIONS = {
    viewContainer: viewContainerCss,
    mapAndPreview: mapAndPreviewCss,
    terrainEditor: terrainEditorCss,
    libraryView: libraryViewCss,
    createModal: createModalCss,
    cartographerShell: cartographerShellCss,
    cartographerPanels: cartographerPanelsCss,
    travelMode: travelModeCss,
    presets: presetsCss,
    dataManager: dataManagerCss,
    encounter: encounterCss,
    tabNavigation: tabNavigationCss
} as const;

export const HEX_PLUGIN_CSS = Object.values(HEX_PLUGIN_CSS_SECTIONS).join("\n\n");
