// src/workmodes/session-runner/calendar/timestamp-display.ts
// Compact timestamp display component for Session Runner calendar panel

import { formatTimestamp } from "@services/orchestration";
import type { CalendarTimestamp } from "@domain";

export interface TimestampDisplayOptions {
    readonly host: HTMLElement;
}

export interface TimestampDisplayHandle {
    readonly root: HTMLElement;
    setTimestamp(timestamp: CalendarTimestamp | null): void;
    setLoading(loading: boolean): void;
    setError(message: string | null): void;
    destroy(): void;
}

/**
 * Creates a compact timestamp display component.
 *
 * Layout:
 * ```
 * 📅 Year 1489, Day 15 of Flamerule
 *    14:30 (afternoon)
 * ```
 *
 * States:
 * - Normal: Shows formatted timestamp
 * - Loading: Pulsing animation
 * - Error: Red text with error message
 * - Null: "No active calendar"
 */
export function createTimestampDisplay(options: TimestampDisplayOptions): TimestampDisplayHandle {
    const { host } = options;

    // Root container
    const root = host.createDiv({ cls: "sm-calendar-timestamp" });

    // Date line (Year, Day, Month)
    const dateLine = root.createDiv({ cls: "sm-calendar-timestamp__date" });

    // Time line (Hour:Minute + period)
    const timeLine = root.createDiv({ cls: "sm-calendar-timestamp__time" });

    // Internal state
    let currentTimestamp: CalendarTimestamp | null = null;
    let isLoading = false;
    let errorMessage: string | null = null;

    /**
     * Updates the display based on current state.
     */
    function updateDisplay(): void {
        // Clear previous state classes
        root.classList.remove("is-loading", "has-error", "is-empty");

        // Handle loading state
        if (isLoading) {
            root.classList.add("is-loading");
            dateLine.textContent = "Loading calendar data...";
            timeLine.textContent = "";
            return;
        }

        // Handle error state
        if (errorMessage) {
            root.classList.add("has-error");
            dateLine.textContent = errorMessage;
            timeLine.textContent = "";
            return;
        }

        // Handle null timestamp (no active calendar)
        if (!currentTimestamp) {
            root.classList.add("is-empty");
            dateLine.textContent = "No active calendar";
            timeLine.textContent = "";
            return;
        }

        // Format timestamp - Compact & Unified style
        const formatted = formatTimestamp(currentTimestamp);

        // Extract date and time parts
        // Format: "Year 1489, Day 15 of Flamerule, 14:30"
        // New layout (centered, large):
        // Line 1: "📅 Year 1489, Day 15 of Flamerule"
        // Line 2: "14:30 • afternoon"

        const parts = formatted.split(", ");

        if (currentTimestamp.precision === "day") {
            // Day precision: Only show date
            dateLine.innerHTML = `📅 ${formatted}`;
            timeLine.textContent = "";
        } else {
            // Hour or minute precision: Split date and time
            // Remove time part from formatted string (it's always the last part after comma)
            const partsWithoutTime = parts.slice(0, -1);
            const timePart = parts[parts.length - 1];

            dateLine.innerHTML = `📅 ${partsWithoutTime.join(", ")}`;

            // Add time period indicator with bullet separator
            const hour = currentTimestamp.hour ?? 0;
            let period = "";
            if (hour >= 0 && hour < 6) {
                period = "night";
            } else if (hour >= 6 && hour < 12) {
                period = "morning";
            } else if (hour >= 12 && hour < 18) {
                period = "afternoon";
            } else {
                period = "evening";
            }

            timeLine.textContent = `${timePart} • ${period}`;
        }
    }

    // Public API
    return {
        root,
        setTimestamp(timestamp: CalendarTimestamp | null): void {
            currentTimestamp = timestamp;
            errorMessage = null;
            updateDisplay();
        },
        setLoading(loading: boolean): void {
            isLoading = loading;
            updateDisplay();
        },
        setError(message: string | null): void {
            errorMessage = message;
            isLoading = false;
            updateDisplay();
        },
        destroy(): void {
            root.empty();
        },
    };
}
