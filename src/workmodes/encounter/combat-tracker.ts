// src/workmodes/encounter/combat-tracker.ts
// UI component for combat tracking: initiative order, HP management, and turn tracking.

import type { CombatParticipant, CombatState } from "./session-store";

export interface CombatTrackerCallbacks {
    onStartCombat: () => void;
    onEndCombat: () => void;
    onUpdateInitiative: (id: string, initiative: number) => void;
    onUpdateHp: (id: string, currentHp: number, maxHp?: number) => void;
    onApplyDamage: (id: string, amount: number) => void;
    onApplyHealing: (id: string, amount: number) => void;
    onToggleDefeated: (id: string) => void;
    onSetActive: (id: string | null) => void;
    onSortByInitiative: () => void;
}

export class CombatTrackerView {
    private readonly containerEl: HTMLElement;
    private readonly callbacks: CombatTrackerCallbacks;

    private headerEl!: HTMLDivElement;
    private listEl!: HTMLDivElement;
    private controlsEl!: HTMLDivElement;

    constructor(containerEl: HTMLElement, callbacks: CombatTrackerCallbacks) {
        this.containerEl = containerEl;
        this.callbacks = callbacks;
    }

    mount() {
        this.containerEl.empty();
        this.containerEl.addClass("sm-combat-tracker");

        this.headerEl = this.containerEl.createDiv({ cls: "sm-combat-tracker-header" });
        this.headerEl.createEl("h3", { text: "Combat Tracker", cls: "sm-encounter-section-title" });

        this.controlsEl = this.containerEl.createDiv({ cls: "sm-combat-tracker-controls" });

        this.listEl = this.containerEl.createDiv({ cls: "sm-combat-tracker-list" });
    }

    unmount() {
        this.containerEl.empty();
    }

    render(combat: CombatState | null, hasCreatures: boolean) {
        this.renderControls(combat, hasCreatures);
        this.renderParticipants(combat);
    }

    private renderControls(combat: CombatState | null, hasCreatures: boolean) {
        this.controlsEl.empty();

        if (!combat || !combat.isActive) {
            // Show "Start Combat" button
            const startButton = this.controlsEl.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-primary",
                text: "Start Combat",
            });
            startButton.type = "button";
            startButton.disabled = !hasCreatures;
            startButton.addEventListener("click", () => {
                this.callbacks.onStartCombat();
            });

            if (!hasCreatures) {
                this.controlsEl.createDiv({
                    cls: "sm-combat-tracker-hint",
                    text: "Add creatures to start combat",
                });
            }
        } else {
            // Show "Sort by Initiative" and "End Combat" buttons
            const sortButton = this.controlsEl.createEl("button", {
                cls: "sm-encounter-button",
                text: "Sort by Initiative",
            });
            sortButton.type = "button";
            sortButton.addEventListener("click", () => {
                this.callbacks.onSortByInitiative();
            });

            const endButton = this.controlsEl.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-danger",
                text: "End Combat",
            });
            endButton.type = "button";
            endButton.addEventListener("click", () => {
                this.callbacks.onEndCombat();
            });
        }
    }

    private renderParticipants(combat: CombatState | null) {
        this.listEl.empty();

        if (!combat || !combat.isActive) {
            this.listEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "Combat not started. Click 'Start Combat' to begin tracking initiative and HP.",
            });
            return;
        }

        if (!combat.participants.length) {
            this.listEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No participants in combat.",
            });
            return;
        }

        for (const participant of combat.participants) {
            const row = this.listEl.createDiv({ cls: "sm-combat-participant" });

            if (participant.id === combat.activeParticipantId) {
                row.addClass("sm-combat-participant-active");
            }

            if (participant.defeated) {
                row.addClass("sm-combat-participant-defeated");
            }

            // Initiative column
            const initiativeCol = row.createDiv({ cls: "sm-combat-initiative" });
            initiativeCol.createEl("label", {
                attr: { for: `initiative-${participant.id}` },
                text: "Init:",
            });
            const initiativeInput = initiativeCol.createEl("input", {
                cls: "sm-encounter-input sm-combat-initiative-input",
                attr: {
                    id: `initiative-${participant.id}`,
                    type: "number",
                    value: String(participant.initiative),
                },
            }) as HTMLInputElement;
            initiativeInput.addEventListener("change", () => {
                const value = Number(initiativeInput.value);
                if (Number.isFinite(value)) {
                    this.callbacks.onUpdateInitiative(participant.id, value);
                } else {
                    initiativeInput.value = String(participant.initiative);
                }
            });

            // Name column
            const nameCol = row.createDiv({ cls: "sm-combat-name" });
            nameCol.setText(participant.name);

            // HP bar column
            const hpCol = row.createDiv({ cls: "sm-combat-hp" });

            const hpBar = hpCol.createDiv({ cls: "sm-combat-hp-bar" });
            const hpFill = hpBar.createDiv({ cls: "sm-combat-hp-fill" });
            const hpPercent = participant.maxHp > 0 ? (participant.currentHp / participant.maxHp) * 100 : 0;
            hpFill.style.width = `${hpPercent}%`;

            if (hpPercent > 66) {
                hpFill.addClass("sm-combat-hp-high");
            } else if (hpPercent > 33) {
                hpFill.addClass("sm-combat-hp-medium");
            } else {
                hpFill.addClass("sm-combat-hp-low");
            }

            const hpInputs = hpCol.createDiv({ cls: "sm-combat-hp-inputs" });

            hpInputs.createEl("label", {
                attr: { for: `current-hp-${participant.id}` },
                text: "HP:",
            });
            const currentHpInput = hpInputs.createEl("input", {
                cls: "sm-encounter-input sm-combat-hp-input",
                attr: {
                    id: `current-hp-${participant.id}`,
                    type: "number",
                    min: "0",
                    value: String(participant.currentHp),
                },
            }) as HTMLInputElement;

            hpInputs.createSpan({ text: "/" });

            const maxHpInput = hpInputs.createEl("input", {
                cls: "sm-encounter-input sm-combat-hp-input",
                attr: {
                    id: `max-hp-${participant.id}`,
                    type: "number",
                    min: "0",
                    value: String(participant.maxHp),
                },
            }) as HTMLInputElement;

            currentHpInput.addEventListener("change", () => {
                const current = Number(currentHpInput.value);
                const max = Number(maxHpInput.value);
                if (Number.isFinite(current)) {
                    this.callbacks.onUpdateHp(participant.id, current, max);
                } else {
                    currentHpInput.value = String(participant.currentHp);
                }
            });

            maxHpInput.addEventListener("change", () => {
                const current = Number(currentHpInput.value);
                const max = Number(maxHpInput.value);
                if (Number.isFinite(max)) {
                    this.callbacks.onUpdateHp(participant.id, current, max);
                } else {
                    maxHpInput.value = String(participant.maxHp);
                }
            });

            // Quick damage/heal buttons
            const quickActions = row.createDiv({ cls: "sm-combat-quick-actions" });

            const damageButton = quickActions.createEl("button", {
                cls: "sm-encounter-button sm-combat-damage-btn",
                text: "−",
                attr: { title: "Apply 1 damage" },
            });
            damageButton.type = "button";
            damageButton.addEventListener("click", () => {
                this.callbacks.onApplyDamage(participant.id, 1);
            });

            const healButton = quickActions.createEl("button", {
                cls: "sm-encounter-button sm-combat-heal-btn",
                text: "+",
                attr: { title: "Apply 1 healing" },
            });
            healButton.type = "button";
            healButton.addEventListener("click", () => {
                this.callbacks.onApplyHealing(participant.id, 1);
            });

            // Defeated toggle
            const defeatedCheckbox = row.createEl("input", {
                cls: "sm-combat-defeated-checkbox",
                attr: {
                    type: "checkbox",
                    id: `defeated-${participant.id}`,
                },
            }) as HTMLInputElement;
            defeatedCheckbox.checked = participant.defeated;
            defeatedCheckbox.addEventListener("change", () => {
                this.callbacks.onToggleDefeated(participant.id);
            });

            const defeatedLabel = row.createEl("label", {
                cls: "sm-combat-defeated-label",
                attr: { for: `defeated-${participant.id}` },
                text: "Defeated",
            });

            // Active participant button
            const activeButton = row.createEl("button", {
                cls: "sm-encounter-button sm-combat-active-btn",
                text: participant.id === combat.activeParticipantId ? "Active" : "Set Active",
            });
            activeButton.type = "button";
            if (participant.id === combat.activeParticipantId) {
                activeButton.addClass("sm-combat-active-btn-selected");
            }
            activeButton.addEventListener("click", () => {
                if (participant.id === combat.activeParticipantId) {
                    this.callbacks.onSetActive(null);
                } else {
                    this.callbacks.onSetActive(participant.id);
                }
            });
        }
    }
}
