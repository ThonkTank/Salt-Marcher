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

/* === Gallery-Layout (Header + Toolbar) === */
.hex-gallery-header {
    display: flex;
    align-items: center;
    gap: .75rem;
    margin-bottom: .5rem;
}

/* Titel kürzen, falls der Dateiname zu lang ist */
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
