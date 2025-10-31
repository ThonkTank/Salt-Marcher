/**
 * Initiative Tracker Component for Session Runner
 *
 * Displays combatants in initiative order with HP/AC tracking and condition markers.
 *
 * Features:
 * - Initiative-sorted combatant list
 * - HP tracking (current/max with visual indicator)
 * - AC display
 * - Manual HP adjustment (click to edit)
 * - Highlight active turn
 * - Remove defeated combatants
 */

import { setIcon } from "obsidian";
import type { EncounterCombatant } from "../../../features/encounters/types";

export type InitiativeTrackerCallbacks = {
    onHpChange: (combatantId: string, newHp: number) => void;
    onRemoveCombatant: (combatantId: string) => void;
    onAdvanceTurn: () => void;
};

export type InitiativeTrackerHandle = {
    readonly root: HTMLElement;
    setCombatants(combatants: EncounterCombatant[]): void;
    setActiveTurn(combatantId: string | null): void;
    destroy(): void;
};

export function createInitiativeTracker(
    host: HTMLElement,
    callbacks: InitiativeTrackerCallbacks,
): InitiativeTrackerHandle {
    const root = host.createDiv({ cls: "sm-initiative-tracker" });

    // Header
    const header = root.createDiv({ cls: "sm-initiative-tracker__header" });
    header.createEl("h3", { text: "Initiative", cls: "sm-initiative-tracker__title" });

    const nextTurnBtn = header.createEl("button", {
        cls: "sm-initiative-tracker__next-turn",
        text: "Next Turn",
    });
    nextTurnBtn.addEventListener("click", () => callbacks.onAdvanceTurn());

    // Combatant list container
    const listContainer = root.createDiv({ cls: "sm-initiative-tracker__list" });

    let combatants: EncounterCombatant[] = [];
    let activeTurnId: string | null = null;

    const setCombatants = (newCombatants: EncounterCombatant[]) => {
        combatants = [...newCombatants];
        renderCombatants();
    };

    const setActiveTurn = (combatantId: string | null) => {
        activeTurnId = combatantId;
        renderCombatants();
    };

    const renderCombatants = () => {
        listContainer.empty();

        if (combatants.length === 0) {
            listContainer.createDiv({
                cls: "sm-initiative-tracker__empty",
                text: "No combatants",
            });
            return;
        }

        for (const combatant of combatants) {
            const item = listContainer.createDiv({
                cls: [
                    "sm-initiative-tracker__item",
                    activeTurnId === combatant.id ? "sm-initiative-tracker__item--active" : "",
                    combatant.currentHp <= 0 ? "sm-initiative-tracker__item--defeated" : "",
                ].join(" "),
            });

            // Initiative badge
            item.createDiv({
                cls: "sm-initiative-tracker__initiative",
                text: combatant.initiative.toString(),
            });

            // Name and stats
            const info = item.createDiv({ cls: "sm-initiative-tracker__info" });
            info.createDiv({
                cls: "sm-initiative-tracker__name",
                text: combatant.name,
            });

            const stats = info.createDiv({ cls: "sm-initiative-tracker__stats" });

            // HP bar and display
            const hpContainer = stats.createDiv({ cls: "sm-initiative-tracker__hp-container" });

            const hpBar = hpContainer.createDiv({ cls: "sm-initiative-tracker__hp-bar" });
            const hpFill = hpBar.createDiv({ cls: "sm-initiative-tracker__hp-fill" });
            const hpPercent = combatant.maxHp > 0 ? (combatant.currentHp / combatant.maxHp) * 100 : 0;
            hpFill.style.width = `${Math.max(0, Math.min(100, hpPercent))}%`;

            const hpText = hpContainer.createDiv({
                cls: "sm-initiative-tracker__hp-text",
                text: `${combatant.currentHp}/${combatant.maxHp} HP`,
            });

            // Click to edit HP
            hpText.addEventListener("click", () => {
                const newHp = prompt(`Enter new HP for ${combatant.name}:`, combatant.currentHp.toString());
                if (newHp !== null) {
                    const parsed = parseInt(newHp, 10);
                    if (!isNaN(parsed)) {
                        callbacks.onHpChange(combatant.id, parsed);
                    }
                }
            });

            // AC badge
            stats.createDiv({
                cls: "sm-initiative-tracker__ac",
                text: `AC ${combatant.ac}`,
            });

            // Remove button
            const removeBtn = item.createDiv({ cls: "sm-initiative-tracker__remove" });
            setIcon(removeBtn, "x");
            removeBtn.addEventListener("click", () => {
                if (confirm(`Remove ${combatant.name} from encounter?`)) {
                    callbacks.onRemoveCombatant(combatant.id);
                }
            });
        }
    };

    const destroy = () => {
        root.remove();
    };

    return {
        root,
        setCombatants,
        setActiveTurn,
        destroy,
    };
}
