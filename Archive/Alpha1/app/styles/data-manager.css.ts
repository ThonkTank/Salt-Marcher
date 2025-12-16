export const dataManagerCss = `
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
