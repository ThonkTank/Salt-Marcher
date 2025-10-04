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
const editorLayoutsCss = `
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

/* Creature Creator – Modal Layout */
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
.sm-cc-card__body { padding:.95rem; display:flex; flex-direction:column; gap:1.1rem; }
.sm-cc-card.is-invalid { border-color: color-mix(in srgb, var(--color-red, #e11d48) 35%, transparent); box-shadow:0 0 0 1px color-mix(in srgb, var(--color-red, #e11d48) 22%, transparent) inset; }
.sm-cc-modal-footer { margin-top:1.25rem; display:flex; justify-content:flex-end; }
.sm-cc-modal-footer .setting-item { margin:0; padding:0; border:none; background:none; }
.sm-cc-modal-footer .setting-item-control { margin-left:0; display:flex; gap:.6rem; }
.sm-cc-modal-footer button { min-width:120px; }

/* Creature Creator – Basics Section */
.sm-cc-basics {
    display: grid;
    gap: 1rem;
}
.sm-cc-basics--classification,
.sm-cc-basics--vitals {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    align-items: stretch;
}
.sm-cc-basics__group {
    display: flex;
    flex-direction: column;
    gap: .75rem;
    padding: .85rem .95rem 1rem;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: color-mix(in srgb, var(--background-secondary) 78%, transparent);
    box-shadow: 0 4px 14px rgba(15, 23, 42, .05);
}
.sm-cc-basics__subtitle {
    margin: 0;
    font-size: .78rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--text-muted);
}
.sm-cc-field-grid {
    display: grid;
    gap: .75rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.sm-cc-field-grid--identity { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.sm-cc-field-grid--summary { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.sm-cc-field-grid--classification { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.sm-cc-field-grid--vitals { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.sm-cc-field-grid--speeds { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
@media (max-width: 860px) {
    .sm-cc-basics--classification,
    .sm-cc-basics--vitals { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 720px) {
    .sm-cc-field-grid { grid-template-columns: minmax(0, 1fr); }
}
.sm-cc-setting.setting-item {
    border: none;
    padding: 0;
    margin: 0;
    background: none;
}
.sm-cc-setting .setting-item-info { display: none; }
.sm-cc-setting .setting-item-name {
    font-weight: 600;
    font-size: .9em;
    color: var(--text-muted);
}
.sm-cc-setting .setting-item-control {
    margin-left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: .45rem;
}
.sm-cc-setting--textarea .setting-item-control { align-items: stretch; }
.sm-cc-setting--textarea .sm-cc-textarea { min-height: 120px; }
.sm-cc-setting--show-name .setting-item-info { display: block; }
.sm-cc-setting--show-name .setting-item-name {
    font-size: .75rem;
    letter-spacing: .06em;
    text-transform: uppercase;
}
.sm-cc-setting--span-2 { grid-column: 1 / -1; }

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

.sm-cc-alignment-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: .45rem;
}
.sm-cc-alignment-button {
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: .45rem .65rem;
    background: var(--background-primary);
    font-size: .85em;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border 120ms ease, box-shadow 120ms ease;
}
.sm-cc-alignment-button:hover { color: var(--text-normal); }
.sm-cc-alignment-button.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #fff);
    border-color: color-mix(in srgb, var(--interactive-accent) 55%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--interactive-accent) 35%, transparent);
}
.sm-cc-alignment-button[disabled] {
    opacity: .55;
    cursor: not-allowed;
}
.sm-cc-alignment-override {
    display: flex;
    align-items: center;
    gap: .5rem;
    margin-top: .4rem;
    padding: .45rem .65rem;
    font-size: .8em;
    color: var(--text-muted);
    border-radius: 10px;
    border: 1px dashed var(--background-modifier-border);
    background: color-mix(in srgb, var(--background-secondary) 65%, transparent);
}
.sm-cc-alignment-override__toggle .checkbox-container { margin: 0; }
.sm-cc-alignment-override__label { text-transform: uppercase; letter-spacing: .06em; }

.sm-cc-speeds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: .85rem;
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

.sm-cc-spell-group {
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    background: var(--background-primary);
    box-shadow: 0 6px 14px rgba(15, 23, 42, .05);
    padding: .85rem .95rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
}
.sm-cc-spell-group__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: .6rem;
}
.sm-cc-spell-group__title {
    flex: 1 1 240px;
    min-width: 200px;
    font-weight: 600;
}
.sm-cc-spell-group__controls {
    display: inline-flex;
    gap: .35rem;
}
.sm-cc-spell-group__meta {
    display: grid;
    gap: .5rem;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.sm-cc-spell-group__meta textarea {
    min-height: 96px;
}
.sm-cc-spell-group__spells {
    display: flex;
    flex-direction: column;
    gap: .5rem;
}
.sm-cc-spell-row {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) max-content;
    gap: .5rem;
    align-items: center;
    padding: .45rem .55rem;
    border-radius: 10px;
    border: 1px solid var(--background-modifier-border);
    background: color-mix(in srgb, var(--background-secondary) 85%, transparent);
}
.sm-cc-spell-row__name,
.sm-cc-spell-row__notes { min-width: 0; }
.sm-cc-spell-row__name .sm-preset-box,
.sm-cc-spell-row__notes .sm-cc-input { width: 100%; }
.sm-cc-spell-row > button { justify-self: end; }
.sm-cc-spell-row--add {
    border-style: dashed;
    background: color-mix(in srgb, var(--background-secondary) 65%, transparent);
}
.sm-cc-spell-row--add > button { border-radius: 999px; }
@media (max-width: 900px) {
    .sm-cc-spell-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .sm-cc-spell-row > button {
        grid-column: 1 / -1;
        justify-self: flex-end;
    }
}
@media (max-width: 640px) {
    .sm-cc-spell-row {
        grid-template-columns: minmax(0, 1fr);
    }
    .sm-cc-spell-row > button {
        justify-self: flex-start;
    }
}

.sm-cc-spellcasting__input { width: 100%; }
.sm-cc-spellcasting__input .sm-preset-input { width: 100%; }
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

// Exportiert alle Module einzeln, um gezielt überschrieben oder getestet zu werden.
export const HEX_PLUGIN_CSS_SECTIONS = {
    viewContainer: viewContainerCss,
    mapAndPreview: mapAndPreviewCss,
    editorLayouts: editorLayoutsCss,
    cartographerShell: cartographerShellCss,
    cartographerPanels: cartographerPanelsCss,
    travelMode: travelModeCss
} as const;

export const HEX_PLUGIN_CSS = Object.values(HEX_PLUGIN_CSS_SECTIONS).join("\n\n");
