export const libraryViewCss = `
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
