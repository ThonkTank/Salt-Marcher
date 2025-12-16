// src/workmodes/almanac/mode/travel/travel-calendar-leaf.ts
// Kompakte Leaf-Shell für den Cartographer-Travel-Modus.

import { formatTimestamp, type CalendarTimestamp } from "../../helpers";
import { TravelCalendarToolbar } from "./travel-calendar-toolbar";
import { TravelQuickStepGroup, type TravelAdvancePayload } from "./travel-quick-step-group";
import type { TravelPanelSnapshot } from "../cartographer-gateway";
import type { TravelCalendarMode } from "../contracts";
import type { TravelCalendarToolbarOptions } from "./travel-calendar-toolbar";

export interface TravelCalendarLeafOptions {
    readonly host: HTMLElement;
    readonly mode: TravelCalendarMode;
    readonly visible: boolean;
    readonly minuteStep: number;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly isLoading: boolean;
    readonly onModeChange: (mode: TravelCalendarMode) => void;
    readonly onAdvance: (payload: TravelAdvancePayload) => void;
    readonly onJump: () => void;
    readonly onClose: () => void;
    readonly onFollowUp: (eventId: string) => void;
}

export interface TravelCalendarLeafHandle {
    readonly root: HTMLElement;
    setPanel(snapshot: TravelPanelSnapshot | null): void;
    setMode(mode: TravelCalendarMode): void;
    setLoading(loading: boolean): void;
    setError(message?: string): void;
    setQuickStep(step?: { readonly label?: string; readonly delta: TravelAdvancePayload }): void;
    setMinuteStep(step: number): void;
    setVisible(visible: boolean): void;
    destroy(): void;
}

function formatAdvanceStep(step: TravelPanelSnapshot["lastAdvanceStep"]): string {
    if (!step) {
        return "—";
    }
    const sign = step.amount >= 0 ? "+" : "";
    const unit = step.unit === "day" ? "Tag" : step.unit === "hour" ? "Std" : "Min";
    return `${sign}${step.amount} ${unit}`;
}

export class TravelCalendarLeaf implements TravelCalendarLeafHandle {
    static displayName = "TravelCalendarLeaf";

    readonly root: HTMLElement;
    private readonly toolbar: TravelCalendarToolbar;
    private readonly quickSteps: TravelQuickStepGroup;
    private readonly timestampEl: HTMLElement;
    private readonly messageEl: HTMLElement;
    private readonly logList: HTMLUListElement;
    private readonly summaryEl: HTMLElement;
    private readonly onFollowUp: (eventId: string) => void;
    private currentMode: TravelCalendarMode;

    constructor(options: TravelCalendarLeafOptions) {
        this.currentMode = options.mode;
        this.onFollowUp = options.onFollowUp;
        this.root = document.createElement("div");
        this.root.classList.add("sm-almanac-travel__leaf");
        if (!options.visible) {
            this.root.classList.add("is-hidden");
        }
        options.host.appendChild(this.root);

        const toolbarOptions: TravelCalendarToolbarOptions = {
            mode: options.mode,
            canStepBackward: true,
            canStepForward: true,
            onChangeMode: options.onModeChange,
            onStepDay: direction => {
                const amount = direction === "forward" ? 1 : -1;
                options.onAdvance({ amount, unit: "day" });
            },
            onStepHour: direction => {
                const amount = direction === "forward" ? 1 : -1;
                options.onAdvance({ amount, unit: "hour" });
            },
            onStepMinute: direction => {
                const amount = direction === "forward" ? options.minuteStep : -options.minuteStep;
                options.onAdvance({ amount, unit: "minute" });
            },
            onJump: options.onJump,
            onClose: options.onClose,
        };
        this.toolbar = new TravelCalendarToolbar(toolbarOptions);
        this.root.appendChild(this.toolbar.root);

        this.quickSteps = new TravelQuickStepGroup({
            minuteStep: options.minuteStep,
            onAdvance: options.onAdvance,
            lastStep: undefined,
        });
        this.root.appendChild(this.quickSteps.root);

        const infoSection = document.createElement("div");
        infoSection.classList.add("sm-almanac-travel__leaf-info");
        this.root.appendChild(infoSection);

        this.timestampEl = document.createElement("div");
        this.timestampEl.classList.add("sm-almanac-travel__leaf-timestamp");
        this.timestampEl.textContent = options.currentTimestamp ? formatTimestamp(options.currentTimestamp) : "—";
        infoSection.appendChild(this.timestampEl);

        this.messageEl = document.createElement("div");
        this.messageEl.classList.add("sm-almanac-travel__leaf-message");
        infoSection.appendChild(this.messageEl);

        this.summaryEl = document.createElement("div");
        this.summaryEl.classList.add("sm-almanac-travel__leaf-last-step");
        infoSection.appendChild(this.summaryEl);

        const listWrapper = document.createElement("div");
        listWrapper.classList.add("sm-almanac-travel__leaf-log");
        this.root.appendChild(listWrapper);

        this.logList = document.createElement("ul");
        this.logList.classList.add("sm-almanac-travel__leaf-log-list");
        listWrapper.appendChild(this.logList);

        if (options.isLoading) {
            this.root.classList.add("is-loading");
        }
    }

    setPanel(snapshot: TravelPanelSnapshot | null): void {
        this.timestampEl.textContent = snapshot?.timestampLabel ?? "—";
        this.messageEl.textContent = snapshot?.message ?? "";
        if (snapshot?.lastAdvanceStep) {
            this.quickSteps.update({
                lastStep: {
                    delta: {
                        amount: snapshot.lastAdvanceStep.amount,
                        unit: snapshot.lastAdvanceStep.unit,
                    },
                },
            });
        } else {
            this.quickSteps.update({ lastStep: undefined });
        }
        this.summaryEl.textContent = formatAdvanceStep(snapshot?.lastAdvanceStep);
        this.logList.replaceChildren();
        const entries = snapshot?.logEntries ?? [];
        if (entries.length === 0) {
            const item = document.createElement("li");
            item.classList.add("sm-almanac-travel__leaf-log-item", "sm-almanac-travel__leaf-log-item--empty");
            item.textContent = snapshot?.reason === "jump" ? "Keine übersprungenen Ereignisse" : "Keine neuen Hooks";
            this.logList.appendChild(item);
            return;
        }
        for (const entry of entries) {
            const item = document.createElement("li");
            item.classList.add("sm-almanac-travel__leaf-log-item");
            if (entry.skipped) {
                item.classList.add("sm-almanac-travel__leaf-log-item--skipped");
            }
            const kind = entry.kind === "event" ? "Ereignis" : "Phänomen";
            item.textContent = `${kind}: ${entry.title} • ${entry.occurrenceLabel}${entry.skipped ? " • übersprungen" : ""}`;
            item.addEventListener("click", () => {
                if (entry.kind === "event") {
                    this.onFollowUp(entry.id);
                }
            });
            this.logList.appendChild(item);
        }
    }

    setMode(mode: TravelCalendarMode): void {
        this.currentMode = mode;
        this.toolbar.setMode(mode);
    }

    setLoading(loading: boolean): void {
        this.root.classList.toggle("is-loading", loading);
        this.toolbar.setDisabled(loading);
        this.quickSteps.update({ disabled: loading });
    }

    setError(message?: string): void {
        this.root.classList.toggle("has-error", Boolean(message));
        this.messageEl.textContent = message ?? "";
    }

    setQuickStep(step?: { readonly label?: string; readonly delta: TravelAdvancePayload }): void {
        this.quickSteps.update({ lastStep: step ? { label: step.label ?? undefined, delta: step.delta } : undefined });
        this.summaryEl.textContent = step ? formatAdvanceStep({ amount: step.delta.amount, unit: step.delta.unit }) : "—";
    }

    setMinuteStep(step: number): void {
        this.quickSteps.update({ minuteStep: step });
    }

    setVisible(visible: boolean): void {
        this.root.classList.toggle("is-hidden", !visible);
    }

    destroy(): void {
        this.toolbar.destroy();
        this.quickSteps.destroy();
        this.root.replaceChildren();
        this.root.remove();
    }
}
