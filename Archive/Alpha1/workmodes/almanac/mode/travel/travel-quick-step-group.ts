// src/workmodes/almanac/mode/travel/travel-quick-step-group.ts
// Button-Gruppe für schnelle Zeitfortschritt-Aktionen im Travel-Leaf.

import type { TimeUnit } from "../../helpers";

export type TravelAdvancePayload = { readonly amount: number; readonly unit: TimeUnit };

export interface TravelQuickStepGroupOptions {
    readonly minuteStep: number;
    readonly disabled?: boolean;
    readonly onAdvance: (payload: TravelAdvancePayload) => void;
    readonly lastStep?: { readonly label?: string; readonly delta: TravelAdvancePayload };
}

export interface TravelQuickStepGroupHandle {
    readonly root: HTMLElement;
    update(options: Partial<Omit<TravelQuickStepGroupOptions, "onAdvance">>): void;
    destroy(): void;
}

const BUTTON_PRESETS: ReadonlyArray<{
    readonly label: string;
    readonly amount: number;
    readonly unit: TimeUnit;
}> = [
    { label: "−1 Tag", amount: -1, unit: "day" },
    { label: "−1 Std", amount: -1, unit: "hour" },
    { label: "−", amount: -1, unit: "minute" },
    { label: "+", amount: 1, unit: "minute" },
    { label: "+1 Std", amount: 1, unit: "hour" },
    { label: "+1 Tag", amount: 1, unit: "day" },
];

function formatStepLabel(step: TravelQuickStepGroupOptions["lastStep"]): string {
    if (!step) {
        return "—";
    }
    const sign = step.delta.amount >= 0 ? "+" : "";
    const base = `${sign}${step.delta.amount}`;
    const unit =
        step.delta.unit === "day" ? "Tag" : step.delta.unit === "hour" ? "Std" : "Min";
    return step.label ? `${step.label} (${base} ${unit})` : `${base} ${unit}`;
}

export class TravelQuickStepGroup implements TravelQuickStepGroupHandle {
    static displayName = "TravelQuickStepGroup";

    readonly root: HTMLElement;
    private minuteStep: number;
    private disabled: boolean;
    private readonly onAdvance: (payload: TravelAdvancePayload) => void;
    private readonly buttons: HTMLButtonElement[] = [];
    private readonly lastStepLabel: HTMLElement;

    constructor(options: TravelQuickStepGroupOptions) {
        this.minuteStep = Math.max(1, Math.floor(options.minuteStep) || 1);
        this.disabled = Boolean(options.disabled);
        this.onAdvance = options.onAdvance;

        this.root = document.createElement("div");
        this.root.classList.add("sm-almanac-travel__quick-steps");

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("sm-almanac-travel__quick-steps-group");
        this.root.appendChild(buttonGroup);

        for (const preset of BUTTON_PRESETS) {
            const button = document.createElement("button");
            button.type = "button";
            button.classList.add("sm-almanac-travel__quick-steps-button");
            button.textContent = preset.label;
            button.addEventListener("click", () => {
                if (this.disabled) {
                    return;
                }
                const amount = preset.unit === "minute" ? preset.amount * this.minuteStep : preset.amount;
                this.onAdvance({ amount, unit: preset.unit });
            });
            buttonGroup.appendChild(button);
            this.buttons.push(button);
        }

        this.lastStepLabel = document.createElement("div");
        this.lastStepLabel.classList.add("sm-almanac-travel__quick-steps-last");
        this.root.appendChild(this.lastStepLabel);
        this.lastStepLabel.textContent = formatStepLabel(options.lastStep);

        this.updateDisabledState();
    }

    update(options: Partial<Omit<TravelQuickStepGroupOptions, "onAdvance">>): void {
        if (typeof options.minuteStep === "number" && options.minuteStep > 0) {
            this.minuteStep = Math.max(1, Math.floor(options.minuteStep));
        }
        if (typeof options.disabled === "boolean") {
            this.disabled = options.disabled;
            this.updateDisabledState();
        }
        if (options.lastStep !== undefined) {
            this.lastStepLabel.textContent = formatStepLabel(options.lastStep);
        }
    }

    destroy(): void {
        for (const button of this.buttons) {
            button.replaceWith();
        }
        this.lastStepLabel.replaceWith();
        this.root.replaceChildren();
    }

    private updateDisabledState(): void {
        for (const button of this.buttons) {
            button.toggleAttribute("disabled", this.disabled);
            button.setAttribute("aria-disabled", this.disabled ? "true" : "false");
        }
        if (this.disabled) {
            this.root.classList.add("sm-almanac-travel__quick-steps--disabled");
        } else {
            this.root.classList.remove("sm-almanac-travel__quick-steps--disabled");
        }
    }
}
