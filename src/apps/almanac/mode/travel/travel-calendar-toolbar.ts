// src/apps/almanac/mode/travel/travel-calendar-toolbar.ts
// Toolbar-Komponente für Moduswechsel und Zeitschritte im Travel-Leaf.

import type { TravelCalendarMode } from "../contracts";

export interface TravelCalendarToolbarOptions {
    readonly mode: TravelCalendarMode;
    readonly canStepBackward: boolean;
    readonly canStepForward: boolean;
    readonly onChangeMode: (mode: TravelCalendarMode) => void;
    readonly onStepDay: (direction: "backward" | "forward") => void;
    readonly onStepHour: (direction: "backward" | "forward") => void;
    readonly onStepMinute: (direction: "backward" | "forward", amount?: number) => void;
    readonly onJump: () => void;
    readonly onClose: () => void;
}

export interface TravelCalendarToolbarHandle {
    readonly root: HTMLElement;
    setMode(mode: TravelCalendarMode): void;
    setDisabled(disabled: boolean): void;
    destroy(): void;
}

const MODE_ORDER: ReadonlyArray<TravelCalendarMode> = ["upcoming", "day", "week", "month"];

function createModeLabel(mode: TravelCalendarMode): string {
    switch (mode) {
        case "day":
            return "Tag";
        case "week":
            return "Woche";
        case "month":
            return "Monat";
        default:
            return "Nächste";
    }
}

export class TravelCalendarToolbar implements TravelCalendarToolbarHandle {
    static displayName = "TravelCalendarToolbar";

    readonly root: HTMLElement;
    private readonly options: TravelCalendarToolbarOptions;
    private readonly modeButtons = new Map<TravelCalendarMode, HTMLButtonElement>();
    private disabled = false;
    private mode: TravelCalendarMode;

    constructor(options: TravelCalendarToolbarOptions) {
        this.options = options;
        this.mode = options.mode;
        this.root = document.createElement("div");
        this.root.classList.add("sm-almanac-travel__toolbar");

        const modeGroup = document.createElement("div");
        modeGroup.classList.add("sm-almanac-travel__toolbar-modes");
        this.root.appendChild(modeGroup);

        for (const mode of MODE_ORDER) {
            const button = document.createElement("button");
            button.type = "button";
            button.classList.add("sm-almanac-travel__toolbar-mode");
            button.dataset.mode = mode;
            button.textContent = createModeLabel(mode);
            button.addEventListener("click", () => {
                if (this.disabled || this.mode === mode) {
                    return;
                }
                this.options.onChangeMode(mode);
            });
            modeGroup.appendChild(button);
            this.modeButtons.set(mode, button);
        }

        const actions = document.createElement("div");
        actions.classList.add("sm-almanac-travel__toolbar-actions");
        this.root.appendChild(actions);

        const createStepButton = (
            label: string,
            onClick: () => void,
            shortcut: string | undefined,
            direction: "backward" | "forward",
        ): HTMLButtonElement => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.classList.add("sm-almanac-travel__toolbar-step");
            btn.dataset.direction = direction;
            btn.textContent = label;
            if (shortcut) {
                btn.setAttribute("aria-keyshortcuts", shortcut);
            }
            btn.addEventListener("click", () => {
                if (!this.disabled && this.canUseDirection(direction)) {
                    onClick();
                }
            });
            actions.appendChild(btn);
            return btn;
        };

        createStepButton("−Tag", () => this.options.onStepDay("backward"), "Ctrl+Alt+,", "backward");
        createStepButton("+Tag", () => this.options.onStepDay("forward"), "Ctrl+Alt+.", "forward");
        createStepButton("−Std", () => this.options.onStepHour("backward"), "Ctrl+Alt+'", "backward");
        createStepButton("+Std", () => this.options.onStepHour("forward"), "Ctrl+Alt+;", "forward");
        createStepButton("−Min", () => this.options.onStepMinute("backward"), "Ctrl+Alt+[", "backward");
        createStepButton("+Min", () => this.options.onStepMinute("forward"), "Ctrl+Alt+]", "forward");

        const jumpButton = createStepButton("Sprung", () => this.options.onJump(), undefined, "forward");
        jumpButton.classList.add("sm-almanac-travel__toolbar-jump");

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.classList.add("sm-almanac-travel__toolbar-close");
        closeButton.textContent = "Schließen";
        closeButton.addEventListener("click", () => {
            if (!this.disabled) {
                this.options.onClose();
            }
        });
        this.root.appendChild(closeButton);

        this.setMode(options.mode);
        this.updateStepAvailability();
    }

    setMode(mode: TravelCalendarMode): void {
        this.mode = mode;
        for (const [value, button] of this.modeButtons.entries()) {
            const active = value === mode;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        }
    }

    setDisabled(disabled: boolean): void {
        this.disabled = disabled;
        this.root.classList.toggle("is-disabled", disabled);
        for (const button of this.modeButtons.values()) {
            button.toggleAttribute("disabled", disabled);
        }
        this.updateStepAvailability();
        const closeButton = this.root.querySelector<HTMLButtonElement>(".sm-almanac-travel__toolbar-close");
        closeButton?.toggleAttribute("disabled", disabled);
    }

    destroy(): void {
        for (const button of this.modeButtons.values()) {
            button.replaceWith();
        }
        this.modeButtons.clear();
        this.root.replaceChildren();
    }

    private updateStepAvailability(): void {
        for (const btn of this.root.querySelectorAll<HTMLButtonElement>(".sm-almanac-travel__toolbar-step")) {
            const direction = (btn.dataset.direction as "backward" | "forward" | undefined) ?? "forward";
            const usable = !this.disabled && this.canUseDirection(direction);
            btn.toggleAttribute("disabled", !usable);
        }
    }

    private canUseDirection(direction: "backward" | "forward"): boolean {
        if (direction === "backward") {
            return this.options.canStepBackward;
        }
        return this.options.canStepForward;
    }
}
