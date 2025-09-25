// plugins/layout-editor/src/css.ts
export const LAYOUT_EDITOR_CSS = `
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
    align-items: stretch;
    gap: 0.75rem;
    min-height: 520px;
}

.sm-le-panel {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    box-sizing: border-box;
    min-width: 200px;
}

.sm-le-panel h3 {
    margin: 0;
    font-size: 0.95rem;
}

.sm-le-panel--structure {
    flex-basis: 260px;
}

.sm-le-panel--inspector {
    flex-basis: 320px;
}

.sm-le-structure {
    flex: 1;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-structure__list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.sm-le-structure__item {
    display: block;
}

.sm-le-structure__item > .sm-le-structure__list {
    margin-left: 0.85rem;
    padding-left: 0.75rem;
    border-left: 1px dashed var(--background-modifier-border);
    margin-top: 0.35rem;
}

.sm-le-structure__entry {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
}

.sm-le-structure__entry:hover {
    background: var(--background-modifier-hover);
}

.sm-le-structure__entry.is-selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
}

.sm-le-structure__entry.is-selected .sm-le-structure__meta {
    color: inherit;
    opacity: 0.85;
}

.sm-le-structure__entry.is-drop-target {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
}

.sm-le-structure__entry.is-drop-target .sm-le-structure__title,
.sm-le-structure__entry.is-drop-target .sm-le-structure__meta {
    color: inherit;
}

.sm-le-structure__entry.is-drop-target .sm-le-structure__meta {
    opacity: 0.85;
}

.sm-le-structure__title {
    font-weight: 600;
    line-height: 1.2;
}

.sm-le-structure__meta {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.2;
}

.sm-le-structure__entry.is-draggable {
    cursor: grab;
}

.sm-le-structure__entry.is-draggable:active {
    cursor: grabbing;
}

.sm-le-structure__root-drop {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.35rem 0.5rem;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 8px;
    margin-bottom: 0.75rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.02);
    transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.sm-le-structure__root-drop.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
    border-color: var(--interactive-accent);
}

.sm-le-resizer {
    flex: 0 0 6px;
    border-radius: 999px;
    background: var(--background-modifier-border);
    cursor: col-resize;
    align-self: stretch;
    transition: background-color 120ms ease;
}

.sm-le-resizer:hover,
.sm-le-resizer.is-active {
    background: var(--interactive-accent);
}

.sm-le-stage {
    flex: 1 1 auto;
    min-width: 320px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
}

.sm-le-stage__viewport {
    position: relative;
    flex: 1;
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-secondary);
    min-height: 520px;
    cursor: grab;
}

.sm-le-stage__viewport::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.035) 1px,
            transparent 1px
        ),
        linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.035) 1px,
            transparent 1px
        );
    background-size: 40px 40px;
}

.sm-le-stage__viewport.is-panning {
    cursor: grabbing;
}

.sm-le-stage__camera {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
}

.sm-le-stage__zoom {
    transform-origin: top left;
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

.sm-le-box:hover {
    border-color: var(--background-modifier-border);
}

.sm-le-box.is-container {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--background-modifier-border) 70%, transparent);
}

.sm-le-box.is-selected {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 0 4px rgba(56, 189, 248, 0.18);
}

.sm-le-box.is-selected.is-container {
    border-color: var(--interactive-accent);
}

.sm-le-box.is-interacting {
    cursor: grabbing;
}

.sm-le-box__content {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
}

.sm-le-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.15rem;
}

.sm-le-preview__headline {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
}

.sm-le-preview__headline-inner {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0.4rem;
    width: 100%;
    height: 100%;
}

.sm-le-preview__headline-text {
    width: 100%;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.1;
    font-weight: 600;
    word-break: break-word;
}

.sm-le-preview__headline-text.sm-le-inline-edit:empty::before {
    width: 100%;
    text-align: center;
}

.sm-le-preview__text-block,
.sm-le-preview__field,
.sm-le-preview__separator,
.sm-le-preview__container-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-le-preview__container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.35rem;
    border-radius: 8px;
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--background-modifier-border) 65%, transparent);
}

.sm-le-preview__container-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.25rem;
    border-radius: 6px;
    min-height: 48px;
}

.sm-le-preview__container-placeholder {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.25rem 0;
}

.sm-le-preview__text {
    font-size: 1rem;
    line-height: 1.4;
}

.sm-le-preview__subtext {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
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

.sm-le-preview__input-only {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: stretch;
    padding: 0.2rem;
}

.sm-le-preview__input-only .sm-le-preview__input {
    height: 100%;
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
    flex-direction: column;
    gap: 0.35rem;
}

.sm-le-inline-options__empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
}

.sm-le-inline-option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 0.35rem 0.5rem;
}

.sm-le-inline-option__input {
    flex: 1;
    min-width: 0;
    border: 1px solid transparent;
    background: transparent;
    padding: 0.15rem 0.25rem;
    font: inherit;
    color: inherit;
}

.sm-le-inline-option__input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    background: var(--background-primary);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.18);
}

.sm-le-inline-option__remove {
    border: none;
    background: transparent;
    padding: 0.1rem 0.35rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
    transition: color 120ms ease, background 120ms ease;
}

.sm-le-inline-option__remove:hover {
    color: var(--text-normal);
    background: rgba(56, 189, 248, 0.12);
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

.sm-le-inspector {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    padding-right: 0.25rem;
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

@media (max-width: 960px) {
    .sm-le-body {
        grid-template-columns: 1fr;
    }

    .sm-le-inspector {
        min-width: 0;
    }
}

.sm-sd {
    position: relative;
    display: inline-block;
    width: auto;
    min-width: 0;
}

.sm-sd__input {
    width: 100%;
}

.sm-sd__menu {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0.25rem;
    display: none;
    max-height: 240px;
    overflow: auto;
    z-index: 1000;
}

.sm-sd.is-open .sm-sd__menu {
    display: block;
}

.sm-sd__item {
    padding: 0.25rem 0.35rem;
    border-radius: 6px;
    cursor: pointer;
}

.sm-sd__item.is-active,
.sm-sd__item:hover {
    background: var(--background-secondary);
}
`;
