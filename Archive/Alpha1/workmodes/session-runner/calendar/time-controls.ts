// src/workmodes/session-runner/calendar/time-controls-new.ts
// Enhanced time controls with custom amount input and unit dropdown

import type { TimeUnit } from "@services/orchestration";

export interface TimeControlsOptions {
    readonly host: HTMLElement;
    readonly onAdvance: (amount: number, unit: TimeUnit) => void | Promise<void>;
    readonly onJumpToDate: () => void;
}

export interface TimeControlsHandle {
    readonly root: HTMLElement;
    setDisabled(disabled: boolean): void;
    destroy(): void;
}

type ExtendedTimeUnit = TimeUnit | "week";

/**
 * Creates enhanced time controls with custom amount input and unit dropdown.
 *
 * Layout:
 * ```
 * Row 1: [Input: 5] [Unit Dropdown: Days ▾] [Advance Button]
 * Row 2: [Jump to Date Button] (full width)
 * ```
 *
 * Features:
 * - Custom amount input (1-999)
 * - Unit selection (minutes, hours, days, weeks)
 * - Input validation
 * - Jump to date button
 */
export function createTimeControls(options: TimeControlsOptions): TimeControlsHandle {
    const { host, onAdvance, onJumpToDate } = options;

    // Root container
    const root = host.createDiv({ cls: "sm-calendar-time-controls" });

    // Row 1: Amount input + unit dropdown + advance button
    const advanceRow = root.createDiv({ cls: "sm-calendar-time-controls__advance-row" });

    // Amount input (smaller for compact layout)
    const amountInput = advanceRow.createEl("input", {
        cls: "sm-calendar-time-controls__amount-input",
        type: "number",
        attr: {
            min: "1",
            max: "999",
            value: "1",
            placeholder: "#",
            title: "Amount to advance",
        },
    });

    // Unit dropdown
    const unitSelect = advanceRow.createEl("select", {
        cls: "sm-calendar-time-controls__unit-select",
    });

    const units: Array<{ value: ExtendedTimeUnit; label: string }> = [
        { value: "minute", label: "Minutes" },
        { value: "hour", label: "Hours" },
        { value: "day", label: "Days" },
        { value: "week", label: "Weeks" },
    ];

    for (const unit of units) {
        const option = unitSelect.createEl("option", {
            value: unit.value,
            text: unit.label,
        });
        // Default to "Days"
        if (unit.value === "day") {
            option.selected = true;
        }
    }

    // Advance button (icon-only)
    const advanceButton = advanceRow.createEl("button", {
        cls: "sm-calendar-time-controls__advance-btn",
        text: "▶",
        attr: {
            title: "Advance time",
            "aria-label": "Advance time",
        },
    });

    // Jump button (icon-only, inline with advance button)
    const jumpButton = advanceRow.createEl("button", {
        cls: "sm-calendar-time-controls__jump-btn",
        text: "📅",
        attr: {
            title: "Jump to date",
            "aria-label": "Jump to date",
        },
    });

    /**
     * Validates and returns the input amount, or null if invalid.
     */
    function getValidAmount(): number | null {
        const value = parseInt(amountInput.value, 10);
        if (isNaN(value) || value < 1 || value > 999) {
            return null;
        }
        return value;
    }

    /**
     * Gets the selected unit from the dropdown.
     */
    function getSelectedUnit(): ExtendedTimeUnit {
        return unitSelect.value as ExtendedTimeUnit;
    }

    /**
     * Converts weeks to days for the onAdvance callback.
     */
    function normalizeUnit(amount: number, unit: ExtendedTimeUnit): { amount: number; unit: TimeUnit } {
        if (unit === "week") {
            return { amount: amount * 7, unit: "day" };
        }
        return { amount, unit: unit as TimeUnit };
    }

    // Advance button click handler
    advanceButton.addEventListener("click", async () => {
        const amount = getValidAmount();
        if (amount === null) {
            // Invalid input - highlight the input field
            amountInput.classList.add("has-error");
            setTimeout(() => {
                amountInput.classList.remove("has-error");
            }, 500);
            return;
        }

        const unit = getSelectedUnit();
        const { amount: normalizedAmount, unit: normalizedUnit } = normalizeUnit(amount, unit);

        // Disable controls during advancement
        advanceButton.disabled = true;
        amountInput.disabled = true;
        unitSelect.disabled = true;

        try {
            await onAdvance(normalizedAmount, normalizedUnit);
        } finally {
            // Re-enable controls
            advanceButton.disabled = false;
            amountInput.disabled = false;
            unitSelect.disabled = false;
        }
    });

    // Jump button click handler
    jumpButton.addEventListener("click", () => {
        onJumpToDate();
    });

    // Enter key in amount input triggers advance
    amountInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            advanceButton.click();
        }
    });

    // Public API
    return {
        root,
        setDisabled(disabled: boolean): void {
            amountInput.disabled = disabled;
            unitSelect.disabled = disabled;
            advanceButton.disabled = disabled;
            jumpButton.disabled = disabled;
        },
        destroy(): void {
            root.empty();
        },
    };
}
