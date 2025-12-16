export const presetsCss = `
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
