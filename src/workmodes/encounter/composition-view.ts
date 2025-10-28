// src/workmodes/encounter/composition-view.ts
// UI component for displaying and managing creatures added to the encounter.

import type { EncounterCreature } from "./session-store";

export interface CompositionViewCallbacks {
    onUpdateCount: (id: string, count: number) => void;
    onRemove: (id: string) => void;
}

export class EncounterCompositionView {
    private readonly containerEl: HTMLElement;
    private readonly callbacks: CompositionViewCallbacks;

    private listEl!: HTMLDivElement;

    constructor(containerEl: HTMLElement, callbacks: CompositionViewCallbacks) {
        this.containerEl = containerEl;
        this.callbacks = callbacks;
    }

    mount() {
        this.containerEl.empty();
        this.containerEl.addClass("sm-encounter-composition");

        const header = this.containerEl.createDiv({ cls: "sm-encounter-composition-header" });
        header.createEl("h3", { text: "Encounter Composition", cls: "sm-encounter-section-title" });

        this.listEl = this.containerEl.createDiv({ cls: "sm-encounter-composition-list" });
    }

    unmount() {
        this.containerEl.empty();
    }

    render(creatures: readonly EncounterCreature[]) {
        this.listEl.empty();

        if (!creatures.length) {
            this.listEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No creatures added yet. Use the list above to add creatures.",
            });
            return;
        }

        for (const creature of creatures) {
            const row = this.listEl.createDiv({ cls: "sm-encounter-composition-item" });

            const nameEl = row.createDiv({ cls: "sm-encounter-composition-name" });
            nameEl.setText(creature.name);

            const metaEl = row.createDiv({ cls: "sm-encounter-composition-meta" });
            metaEl.createSpan({ cls: "sm-encounter-composition-cr", text: `CR ${formatCR(creature.cr)}` });

            const countField = row.createDiv({ cls: "sm-encounter-composition-count" });
            countField.createEl("label", {
                attr: { for: `creature-count-${creature.id}` },
                text: "Count:",
            });
            const countInput = countField.createEl("input", {
                cls: "sm-encounter-input",
                attr: {
                    id: `creature-count-${creature.id}`,
                    type: "number",
                    min: "1",
                    max: "99",
                    value: String(creature.count),
                },
            }) as HTMLInputElement;
            countInput.addEventListener("change", () => {
                const value = Number(countInput.value);
                if (!Number.isFinite(value) || value < 1) {
                    countInput.value = String(creature.count);
                    return;
                }
                const clamped = Math.max(1, Math.min(99, Math.floor(value)));
                if (clamped !== value) {
                    countInput.value = String(clamped);
                }
                this.callbacks.onUpdateCount(creature.id, clamped);
            });

            const removeButton = row.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-danger",
                text: "Remove",
            });
            removeButton.type = "button";
            removeButton.addEventListener("click", () => {
                this.callbacks.onRemove(creature.id);
            });
        }
    }
}

function formatCR(cr: number): string {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return String(cr);
}
