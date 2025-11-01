// src/workmodes/almanac/view/almanac-time-display.ts
// Time display component for Almanac MVP - shows current calendar time and provides time advance controls

import type { CalendarSchema, CalendarTimestamp } from "../domain";
import { formatTimestamp } from "../domain";

export interface AlmanacTimeDisplayOptions {
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly schema: CalendarSchema | null;
    readonly onAdvanceDay: (amount: number) => void;
    readonly onAdvanceHour: (amount: number) => void;
    readonly onAdvanceMinute: (amount: number) => void;
}

export interface AlmanacTimeDisplayHandle {
    readonly root: HTMLElement;
    update(timestamp: CalendarTimestamp | null, schema: CalendarSchema | null): void;
    destroy(): void;
}

/**
 * Almanac Time Display
 *
 * Displays current calendar time and provides controls to advance/rewind time.
 * Used in Almanac MVP to provide basic time management functionality.
 */
export function createAlmanacTimeDisplay(
    options: AlmanacTimeDisplayOptions,
): AlmanacTimeDisplayHandle {
    const root = document.createElement("div");
    root.classList.add("sm-almanac-time-display");

    // Current time display
    const timeDisplay = document.createElement("div");
    timeDisplay.classList.add("sm-almanac-time-display__current");

    const timeLabel = document.createElement("div");
    timeLabel.classList.add("sm-almanac-time-display__label");
    timeLabel.textContent = "Current Time";
    timeDisplay.appendChild(timeLabel);

    const timeValue = document.createElement("div");
    timeValue.classList.add("sm-almanac-time-display__value");
    updateTimeValue(timeValue, options.currentTimestamp, options.schema);
    timeDisplay.appendChild(timeValue);

    root.appendChild(timeDisplay);

    // Time controls
    const controls = document.createElement("div");
    controls.classList.add("sm-almanac-time-display__controls");

    const createControl = (
        label: string,
        onClickForward: () => void,
        onClickBackward: () => void,
    ): void => {
        const group = document.createElement("div");
        group.classList.add("sm-almanac-time-display__control-group");

        const controlLabel = document.createElement("span");
        controlLabel.classList.add("sm-almanac-time-display__control-label");
        controlLabel.textContent = label;
        group.appendChild(controlLabel);

        const backwardBtn = document.createElement("button");
        backwardBtn.type = "button";
        backwardBtn.classList.add("sm-almanac-time-display__control-btn");
        backwardBtn.textContent = "−";
        backwardBtn.addEventListener("click", onClickBackward);
        group.appendChild(backwardBtn);

        const forwardBtn = document.createElement("button");
        forwardBtn.type = "button";
        forwardBtn.classList.add("sm-almanac-time-display__control-btn");
        forwardBtn.textContent = "+";
        forwardBtn.addEventListener("click", onClickForward);
        group.appendChild(forwardBtn);

        controls.appendChild(group);
    };

    createControl(
        "Day",
        () => options.onAdvanceDay(1),
        () => options.onAdvanceDay(-1),
    );
    createControl(
        "Hour",
        () => options.onAdvanceHour(1),
        () => options.onAdvanceHour(-1),
    );
    createControl(
        "Minute",
        () => options.onAdvanceMinute(10),
        () => options.onAdvanceMinute(-10),
    );

    root.appendChild(controls);

    function updateTimeValue(
        element: HTMLElement,
        timestamp: CalendarTimestamp | null,
        schema: CalendarSchema | null,
    ): void {
        if (!timestamp || !schema) {
            element.textContent = "No active calendar";
            element.classList.add("is-empty");
            return;
        }

        element.classList.remove("is-empty");
        const monthName = schema.months.find(m => m.id === timestamp.monthId)?.name;
        element.textContent = formatTimestamp(timestamp, monthName);
    }

    return {
        root,
        update(timestamp, schema) {
            updateTimeValue(timeValue, timestamp, schema);
        },
        destroy() {
            root.replaceChildren();
        },
    };
}
