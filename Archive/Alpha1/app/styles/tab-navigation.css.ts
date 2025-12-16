export const tabNavigationCss = `
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
