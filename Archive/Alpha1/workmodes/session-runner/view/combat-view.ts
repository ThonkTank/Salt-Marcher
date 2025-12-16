// src/workmodes/session-runner/view/combat-view.ts
// Simplified combat tracker UI for encounter runner - initiative and HP tracking only.

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-combat-view");
import type { CombatStateWithTemp, CombatParticipantWithTemp } from "./combat-presenter";
import type { EncounterCreature } from "@domain/encounter-types";
import type { CreatureEntity } from "@features/encounters/encounter-types";

export interface CombatViewCallbacks {
    onStartCombat: () => void;
    onEndCombat: () => void;
    onUpdateInitiative: (id: string, initiative: number) => void;
    onUpdateHp: (id: string, currentHp: number, maxHp?: number) => void;
    onUpdateTempHp: (id: string, tempHp: number) => void;
    onApplyDamage: (id: string, amount: number) => void;
    onApplyHealing: (id: string, amount: number) => void;
    onToggleDefeated: (id: string) => void;
    onSetActive: (id: string | null) => void;
    onSortByInitiative: () => void;
    // Filter callbacks
    onUpdateCrRange?: (min: number, max: number) => void;
    onAddTypeFilter?: (type: string) => void;
    onRemoveTypeFilter?: (type: string) => void;
}

/**
 * Simplified combat view for encounter runner.
 * Shows only: initiative, HP bars, damage/healing controls, temp HP, defeated toggle.
 * Does NOT show: encounter context, creature selection, XP calculation, party management.
 */
export class CombatView {
    private readonly containerEl: HTMLElement;
    private readonly callbacks: CombatViewCallbacks;

    private headerEl!: HTMLDivElement;
    private listEl!: HTMLDivElement;
    private controlsEl!: HTMLDivElement;
    private nearbyCreaturesEl!: HTMLDivElement;

    constructor(containerEl: HTMLElement, callbacks: CombatViewCallbacks) {
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

        // Add Nearby Creatures section
        this.nearbyCreaturesEl = this.containerEl.createDiv({ cls: "sm-nearby-creatures-section" });
    }

    unmount() {
        this.containerEl.empty();
    }

    render(
        combat: CombatStateWithTemp | null,
        hasCreatures: boolean,
        isGenerating: boolean = false,
        creatures?: EncounterCreature[],
        nearbyCreatures?: Array<{ creature: CreatureEntity; score: number }>,
        filterState?: {
            crMin: number;
            crMax: number;
            selectedTypes: Set<string>;
            availableTypes: string[];
        }
    ) {
        this.renderControls(combat, hasCreatures, isGenerating);
        this.renderParticipants(combat, creatures);
        this.renderNearbyCreatures(nearbyCreatures, filterState);
    }

    private renderControls(combat: CombatStateWithTemp | null, hasCreatures: boolean, isGenerating: boolean) {
        this.controlsEl.empty();

        if (!combat || !combat.isActive) {
            // Show "Start Combat" button
            const startButton = this.controlsEl.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-primary",
                text: "Start Combat",
            });
            startButton.type = "button";
            startButton.disabled = !hasCreatures || isGenerating;
            startButton.setAttribute("title", "Kampf starten und Initiative-Tracking aktivieren");
            startButton.addEventListener("click", () => {
                this.callbacks.onStartCombat();
            });

            if (isGenerating) {
                this.controlsEl.createDiv({
                    cls: "sm-combat-tracker-hint sm-combat-tracker-loading",
                    text: "⏳ Generating encounter...",
                });
            } else if (!hasCreatures) {
                this.controlsEl.createDiv({
                    cls: "sm-combat-tracker-hint",
                    text: "No creatures in encounter",
                });
            }
        } else {
            // Show "Sort by Initiative" and "End Combat" buttons
            const sortButton = this.controlsEl.createEl("button", {
                cls: "sm-encounter-button",
                text: "Sort by Initiative",
            });
            sortButton.type = "button";
            sortButton.setAttribute("title", "Teilnehmer nach Initiative-Wert sortieren");
            sortButton.addEventListener("click", () => {
                this.callbacks.onSortByInitiative();
            });

            const endButton = this.controlsEl.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-danger",
                text: "End Combat",
            });
            endButton.type = "button";
            endButton.setAttribute("title", "Kampf beenden und zum Encounter-Modus zurückkehren");
            endButton.addEventListener("click", () => {
                this.callbacks.onEndCombat();
            });
        }
    }

    private renderParticipants(combat: CombatStateWithTemp | null, creatures?: EncounterCreature[]) {
        this.listEl.empty();

        if (!combat || !combat.isActive) {
            // Show creature preview if creatures were generated
            if (creatures && creatures.length > 0) {
                logger.info("[CombatView] Rendering creature preview");
                this.renderCreaturePreview(creatures);
            }
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
            this.renderParticipant(participant, combat);
        }
    }

    private renderParticipant(participant: CombatParticipantWithTemp, combat: CombatStateWithTemp) {
        const card = this.listEl.createDiv({ cls: "sm-combat-participant" });

        if (participant.id === combat.activeParticipantId) {
            card.addClass("sm-combat-participant-active");
        }

        if (participant.defeated) {
            card.addClass("sm-combat-participant-defeated");
        }

        // Row 1: Header (Name + Initiative)
        const headerRow = card.createDiv({ cls: "sm-combat-header-row" });

        const nameEl = headerRow.createDiv({ cls: "sm-combat-name" });
        nameEl.setText(participant.name);

        const initiativeSection = headerRow.createDiv({ cls: "sm-combat-initiative" });
        initiativeSection.createEl("label", {
            attr: { for: `initiative-${participant.id}` },
            text: "Init:",
        });
        const initiativeInput = initiativeSection.createEl("input", {
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

        // Row 2: HP Bar
        const hpBarRow = card.createDiv({ cls: "sm-combat-hp-bar-row" });
        const hpBar = hpBarRow.createDiv({ cls: "sm-combat-hp-bar" });
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

        // Row 3: HP Controls (HP Inputs + Damage/Heal Buttons)
        const hpControlsRow = card.createDiv({ cls: "sm-combat-hp-controls-row" });

        // HP inputs (current/max)
        const hpInputs = hpControlsRow.createDiv({ cls: "sm-combat-hp-inputs" });
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

        // HP change controls (damage/heal)
        const hpChangeControl = hpControlsRow.createDiv({ cls: "sm-combat-hp-change" });

        // Minus button (apply damage)
        const minusBtn = hpChangeControl.createEl("button", {
            cls: "sm-combat-hp-change-btn sm-combat-damage-btn",
            text: "−",
            attr: { title: "Schaden anwenden" },
        });
        minusBtn.type = "button";

        // Input field
        const hpInput = hpChangeControl.createEl("input", {
            cls: "sm-combat-hp-change-input",
            attr: {
                type: "number",
                min: "1",
                value: "",
                placeholder: "0",
                id: `hp-change-${participant.id}`,
            },
        });

        // Plus button (apply healing)
        const plusBtn = hpChangeControl.createEl("button", {
            cls: "sm-combat-hp-change-btn sm-combat-heal-btn",
            text: "+",
            attr: { title: "Heilung anwenden" },
        });
        plusBtn.type = "button";

        // Track last action for Enter key behavior
        let lastAction: "damage" | "heal" = "damage";

        // Event handlers
        minusBtn.addEventListener("click", () => {
            lastAction = "damage";
            const amount = Number(hpInput.value);
            if (amount > 0) {
                this.callbacks.onApplyDamage(participant.id, amount);
                hpInput.value = ""; // Reset after applying
            }
        });

        plusBtn.addEventListener("click", () => {
            lastAction = "heal";
            const amount = Number(hpInput.value);
            if (amount > 0) {
                this.callbacks.onApplyHealing(participant.id, amount);
                hpInput.value = ""; // Reset after applying
            }
        });

        // Allow Enter key to repeat last action
        hpInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const amount = Number(hpInput.value);
                if (amount > 0) {
                    if (lastAction === "damage") {
                        this.callbacks.onApplyDamage(participant.id, amount);
                    } else {
                        this.callbacks.onApplyHealing(participant.id, amount);
                    }
                    hpInput.value = "";
                }
            }
        });

        // Row 4: Secondary Controls (Temp HP + Defeated + Active)
        const secondaryRow = card.createDiv({ cls: "sm-combat-secondary-row" });

        // Temp HP
        const tempHpContainer = secondaryRow.createDiv({ cls: "sm-combat-temp-hp" });
        tempHpContainer.createEl("label", {
            attr: { for: `temp-hp-${participant.id}` },
            text: "Temp:",
        });
        const tempHpInput = tempHpContainer.createEl("input", {
            cls: "sm-encounter-input sm-combat-hp-input",
            attr: {
                id: `temp-hp-${participant.id}`,
                type: "number",
                min: "0",
                value: String(participant.tempHp),
            },
        }) as HTMLInputElement;

        tempHpInput.addEventListener("change", () => {
            const temp = Number(tempHpInput.value);
            if (Number.isFinite(temp)) {
                this.callbacks.onUpdateTempHp(participant.id, temp);
            } else {
                tempHpInput.value = String(participant.tempHp);
            }
        });

        // Controls container
        const controlsContainer = secondaryRow.createDiv({ cls: "sm-combat-controls" });

        // Defeated toggle
        const defeatedCheckbox = controlsContainer.createEl("input", {
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

        const defeatedLabel = controlsContainer.createEl("label", {
            cls: "sm-combat-defeated-label",
            attr: { for: `defeated-${participant.id}` },
            text: "Defeated",
        });

        // Active participant button
        const activeButton = controlsContainer.createEl("button", {
            cls: "sm-encounter-button sm-combat-active-btn",
            text: participant.id === combat.activeParticipantId ? "Active" : "Set Active",
        });
        activeButton.type = "button";
        activeButton.setAttribute("title", participant.id === combat.activeParticipantId
            ? "Aktiven Teilnehmer deaktivieren"
            : "Als aktiven Teilnehmer markieren");
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


    /**
     * Renders a preview of generated creatures before combat starts.
     * Shows count, name, and CR for each creature type.
     */
    private renderCreaturePreview(creatures: EncounterCreature[]) {
        // Header
        const previewHeader = this.listEl.createDiv({ cls: "sm-creature-preview-header" });
        previewHeader.createEl("h4", { text: "Generated Creatures:" });

        // Creature list
        for (const creature of creatures) {
            const row = this.listEl.createDiv({ cls: "sm-creature-preview-row" });

            // Count (e.g., "3x")
            if (creature.count > 1) {
                row.createSpan({ text: `${creature.count}× `, cls: "sm-creature-count" });
            }

            // Name
            row.createSpan({ text: creature.name, cls: "sm-creature-name" });

            // CR (e.g., " (CR 1/2)")
            row.createSpan({ text: ` (CR ${creature.cr})`, cls: "sm-creature-cr" });
        }

        // Hint message
        this.listEl.createDiv({
            cls: "sm-creature-preview-hint",
            text: "Click 'Start Combat' to begin tracking initiative and HP.",
        });
    }

    /**
     * Renders the nearby creatures by habitat list with filter controls.
     * Shows creatures that match the current hex's habitat and filter criteria.
     */
    private renderNearbyCreatures(
        nearbyCreatures?: Array<{ creature: CreatureEntity; score: number }>,
        filterState?: {
            crMin: number;
            crMax: number;
            selectedTypes: Set<string>;
            availableTypes: string[];
        }
    ) {
        this.nearbyCreaturesEl.empty();

        // Header
        const headerEl = this.nearbyCreaturesEl.createDiv({ cls: "sm-nearby-header" });
        headerEl.createEl("h3", { text: "Nearby Creatures by Habitat", cls: "sm-encounter-section-title" });

        // Filter controls (if filterState provided)
        if (filterState && this.callbacks.onUpdateCrRange) {
            this.renderFilterControls(headerEl, filterState);
        }

        // Create list container
        const listEl = this.nearbyCreaturesEl.createDiv({ cls: "sm-nearby-list" });

        if (!nearbyCreatures || nearbyCreatures.length === 0) {
            listEl.createDiv({
                cls: "sm-nearby-empty",
                text: "No creatures match current habitat",
            });
            return;
        }

        // Render each creature
        for (const { creature, score } of nearbyCreatures) {
            const itemEl = listEl.createDiv({ cls: "sm-nearby-item" });

            // Left side: Name and type
            const infoEl = itemEl.createDiv({ cls: "sm-nearby-info" });
            infoEl.createSpan({ text: creature.name, cls: "sm-nearby-name" });
            infoEl.createSpan({ text: ` (${creature.type})`, cls: "sm-nearby-type" });

            // Right side: CR and habitat score
            const statsEl = itemEl.createDiv({ cls: "sm-nearby-stats" });
            statsEl.createSpan({ text: `CR ${creature.cr}`, cls: "sm-nearby-cr" });
            statsEl.createSpan({ text: ` • `, cls: "sm-nearby-separator" });
            statsEl.createSpan({
                text: `${Math.round(score)}%`,
                cls: "sm-nearby-score",
                attr: { title: "Habitat compatibility score" }
            });
        }
    }

    /**
     * Renders the filter controls for nearby creatures
     */
    private renderFilterControls(
        containerEl: HTMLElement,
        filterState: {
            crMin: number;
            crMax: number;
            selectedTypes: Set<string>;
            availableTypes: string[];
        }
    ) {
        const filtersEl = containerEl.createDiv({ cls: "sm-nearby-filters" });

        // CR Range Filter
        const crRangeEl = filtersEl.createDiv({ cls: "sm-filter-cr-range" });
        crRangeEl.createEl("label", { text: "CR: ", cls: "sm-filter-label" });

        const crMinInput = crRangeEl.createEl("input", {
            cls: "sm-filter-cr-input",
            attr: {
                type: "number",
                min: "0",
                max: "30",
                value: String(filterState.crMin)
            }
        }) as HTMLInputElement;

        crRangeEl.createSpan({ text: " - ", cls: "sm-filter-separator" });

        const crMaxInput = crRangeEl.createEl("input", {
            cls: "sm-filter-cr-input",
            attr: {
                type: "number",
                min: "0",
                max: "30",
                value: String(filterState.crMax)
            }
        }) as HTMLInputElement;

        // Update CR range on change
        const updateCrRange = () => {
            const min = Number(crMinInput.value) || 0;
            const max = Number(crMaxInput.value) || 30;
            if (this.callbacks.onUpdateCrRange) {
                this.callbacks.onUpdateCrRange(min, max);
            }
        };
        crMinInput.addEventListener("change", updateCrRange);
        crMaxInput.addEventListener("change", updateCrRange);

        // Type Filter
        const typeFilterEl = filtersEl.createDiv({ cls: "sm-filter-types" });
        typeFilterEl.createEl("label", { text: "Type: ", cls: "sm-filter-label" });

        // Type dropdown
        const typeDropdownEl = typeFilterEl.createDiv({ cls: "sm-filter-type-dropdown" });
        const typeSelect = typeDropdownEl.createEl("select", {
            cls: "sm-filter-type-select"
        }) as HTMLSelectElement;

        // Add placeholder option
        const placeholderOption = typeSelect.createEl("option");
        placeholderOption.value = "";
        placeholderOption.text = "Add type...";
        placeholderOption.disabled = true;
        placeholderOption.selected = true;

        // Add available types
        for (const type of filterState.availableTypes) {
            if (!filterState.selectedTypes.has(type)) {
                const option = typeSelect.createEl("option");
                option.value = type;
                option.text = type;
            }
        }

        // Handle type selection
        typeSelect.addEventListener("change", () => {
            const selectedType = typeSelect.value;
            if (selectedType && this.callbacks.onAddTypeFilter) {
                this.callbacks.onAddTypeFilter(selectedType);
                typeSelect.value = ""; // Reset dropdown
            }
        });

        // Type chips container
        const chipsEl = filtersEl.createDiv({ cls: "sm-filter-chips" });

        // Render type chips
        for (const type of filterState.selectedTypes) {
            const chipEl = chipsEl.createDiv({ cls: "sm-filter-chip" });
            chipEl.createSpan({ text: type, cls: "sm-filter-chip-text" });

            const removeBtn = chipEl.createEl("button", {
                cls: "sm-filter-chip-remove",
                text: "×"
            });
            removeBtn.type = "button";
            removeBtn.addEventListener("click", () => {
                if (this.callbacks.onRemoveTypeFilter) {
                    this.callbacks.onRemoveTypeFilter(type);
                }
            });
        }
    }

}
