// src/app/styles/map-preview.css.ts
// Map container and SVG preview styles

export const mapAndPreviewCss = `
/* === Map-Container & SVG === */
.sm-map-container {
    width: 100%;
    overflow: hidden;
}

.sm-hex-map-svg {
    display: block;
    width: 100%;
    max-width: 700px;
    margin: .5rem 0;
    user-select: none;
    touch-action: none;
}

.sm-hex-map-svg polygon {
    /* Basis: unbemalt transparent — Inline-Styles vom Renderer dürfen das überschreiben */
    fill: transparent;
    stroke: var(--text-muted);
    stroke-width: 2;
    cursor: pointer;
    transition: fill 120ms ease, fill-opacity 120ms ease, stroke 120ms ease;
}

/* Hover: nur den Rahmen highlighten */
.sm-hex-map-svg polygon:hover { stroke: var(--interactive-accent); }

/* Optional: Hover-Füllung nur für unbemalte Tiles */
.sm-hex-map-svg polygon:not([data-painted="1"]):hover { fill-opacity: .15; }

.sm-hex-map-svg text {
    font-size: 12px;
    fill: var(--text-muted);
    pointer-events: none;
    user-select: none;
}

/* Brush-Widget (Kreis) */
.sm-hex-map-svg circle {
    transition: opacity 120ms ease, r 120ms ease, cx 60ms ease, cy 60ms ease;
}

/* === Live-Preview: Interaktion im Codeblock erlauben (optional) === */
.markdown-source-view .cm-preview-code-block .sm-map-container,
.markdown-source-view .cm-preview-code-block .sm-hex-map-svg { pointer-events: auto; }
.markdown-source-view .cm-preview-code-block .edit-block-button { pointer-events: none; }
`;
