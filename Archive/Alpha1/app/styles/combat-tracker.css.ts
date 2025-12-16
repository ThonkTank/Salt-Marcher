export const combatTrackerCss = `
/* === Combat Tracker === */
/* Styles for the Combat Tracker UI in Session Runner */

/* Main container */
.sm-combat-tracker {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0;
}

.sm-combat-tracker-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-combat-tracker-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
}

.sm-combat-tracker-hint {
    font-style: italic;
    color: var(--text-muted);
    font-size: 0.85rem;
}

.sm-combat-tracker-loading {
    color: var(--interactive-accent);
}

.sm-combat-tracker-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

/* === Combat Participant Cards === */

.sm-combat-participant {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sm-combat-participant:hover {
    border-color: var(--interactive-accent);
}

.sm-combat-participant-active {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover, var(--interactive-accent));
    background-color: var(--background-modifier-hover);
}

.sm-combat-participant-defeated {
    opacity: 0.6;
    background-color: var(--background-secondary);
}

/* === Participant Header Row === */

.sm-combat-header-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
}

.sm-combat-name {
    font-weight: 600;
    font-size: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sm-combat-initiative {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-combat-initiative label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-combat-initiative-input {
    width: 60px;
    text-align: center;
    font-weight: 600;
}

/* === HP Bar Row === */

.sm-combat-hp-bar-row {
    display: flex;
    width: 100%;
    height: 20px;
}

.sm-combat-hp-bar {
    flex: 1;
    height: 100%;
    background-color: var(--background-modifier-border);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
}

.sm-combat-hp-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
    border-radius: 4px;
}

.sm-combat-hp-high {
    background-color: #4caf50;
}

.sm-combat-hp-medium {
    background-color: #ff9800;
}

.sm-combat-hp-low {
    background-color: #f44336;
}

/* === HP Controls Row === */

.sm-combat-hp-controls-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
}

.sm-combat-hp-inputs {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-combat-hp-inputs label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-combat-hp-input {
    width: 50px;
    text-align: center;
    padding: 0.25rem 0.4rem;
}

.sm-combat-hp-change {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 0.15rem;
    background-color: var(--background-secondary);
}

.sm-combat-hp-change-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
}

.sm-combat-hp-change-btn:hover {
    background-color: var(--interactive-hover);
}

.sm-combat-damage-btn {
    color: #f44336;
}

.sm-combat-damage-btn:hover {
    background-color: #ffebee;
}

.sm-combat-heal-btn {
    color: #4caf50;
}

.sm-combat-heal-btn:hover {
    background-color: #e8f5e9;
}

.sm-combat-hp-change-input {
    width: 50px;
    border: none;
    background: transparent;
    text-align: center;
    padding: 0.25rem;
    font-size: 0.85rem;
}

.sm-combat-hp-change-input:focus {
    outline: none;
    background-color: var(--background-primary);
}

/* === Secondary Controls Row === */

.sm-combat-secondary-row {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.75rem;
}

.sm-combat-temp-hp {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-combat-temp-hp label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-combat-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
}

.sm-combat-defeated-checkbox {
    width: 1rem;
    height: 1rem;
    margin: 0;
    cursor: pointer;
}

.sm-combat-defeated-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
}

.sm-combat-active-btn {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
}

.sm-combat-active-btn-selected {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.sm-combat-active-btn-selected:hover:not(:disabled) {
    background-color: var(--interactive-accent-hover, var(--interactive-accent));
}

/* === Creature Preview (before combat starts) === */

.sm-creature-preview-header {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-creature-preview-header h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-muted);
}

.sm-creature-preview-row {
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    background-color: var(--background-primary);
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
}

.sm-creature-preview-row:hover {
    background-color: var(--background-modifier-hover);
}

.sm-creature-count {
    font-weight: 600;
    color: var(--interactive-accent);
}

.sm-creature-name {
    flex: 1;
    font-weight: 500;
}

.sm-creature-cr {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-creature-preview-hint {
    padding: 0.75rem;
    margin-top: 0.5rem;
    border-radius: 6px;
    background-color: var(--background-secondary);
    border: 1px dashed var(--background-modifier-border);
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.85rem;
    text-align: center;
}

/* === Habitat Creature Filter UI === */

.sm-habitat-creature-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-habitat-creature-header h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-muted);
}

.sm-habitat-creature-count {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 600;
}

.sm-habitat-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--background-modifier-border);
}

.sm-habitat-filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1 1 180px;
    min-width: 150px;
}

.sm-habitat-filter-group label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-habitat-filter-select {
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    font-size: 0.85rem;
}

.sm-habitat-filter-select:focus {
    border-color: var(--interactive-accent);
    outline: none;
}

.sm-habitat-type-control-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.sm-habitat-type-select {
    flex: 1;
}

.sm-habitat-selected-types {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.35rem;
}

.sm-habitat-type-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.8rem;
    font-weight: 500;
}

.sm-habitat-type-chip-remove {
    padding: 0;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.2);
    color: var(--text-on-accent);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
}

.sm-habitat-type-chip-remove:hover {
    background-color: rgba(0, 0, 0, 0.3);
}

.sm-habitat-filtered-count {
    padding: 0.5rem 0;
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 600;
}

.sm-habitat-creature-container {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 500px;
    overflow-y: auto;
    padding: 0.5rem 0;
}

.sm-habitat-creature-row {
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    background-color: var(--background-primary);
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.75rem;
    align-items: baseline;
    transition: background-color 0.15s ease;
}

.sm-habitat-creature-row:hover {
    background-color: var(--background-modifier-hover);
    cursor: pointer;
}

.sm-habitat-creature-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sm-habitat-creature-cr {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.sm-habitat-creature-score {
    font-size: 0.8rem;
    color: var(--interactive-accent);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.sm-habitat-load-more-button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease;
    width: 100%;
}

.sm-habitat-load-more-button:hover {
    background-color: var(--interactive-hover);
    border-color: var(--interactive-accent);
}

/* === Responsive Design === */

@media (max-width: 600px) {
    .sm-combat-header-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }

    .sm-combat-initiative {
        justify-content: flex-start;
    }

    .sm-combat-hp-controls-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }

    .sm-combat-secondary-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }

    .sm-combat-controls {
        justify-content: flex-start;
    }

    .sm-habitat-filter-row {
        flex-direction: column;
    }

    .sm-habitat-filter-group {
        flex: 1 1 100%;
    }

    .sm-habitat-creature-row {
        grid-template-columns: 1fr;
        gap: 0.25rem;
    }
}
`;
