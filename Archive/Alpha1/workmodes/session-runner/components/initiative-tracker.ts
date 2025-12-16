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
import type { Combatant } from "@features/encounters/encounter-types";

export type InitiativeTrackerCallbacks = {
    onHpChange: (combatantId: string, newHp: number) => void;
    onRemoveCombatant: (combatantId: string) => void;
    onAdvanceTurn: () => void;
};

export type InitiativeTrackerHandle = {
    setCombatants(combatants: Combatant[]): void;
    setActiveTurn(combatantId: string | null): void;
    destroy(): void;
};

/**
 * Create initiative tracker component
 * Creates content directly in the provided host element (no wrapper div)
 * Header with Next Turn button is retained as functional control
 */
export function createInitiativeTracker(
    host: HTMLElement,
    callbacks: InitiativeTrackerCallbacks,
): InitiativeTrackerHandle {
    // Next Turn button (no redundant title - panel card provides it)
    const header = host.createDiv({ cls: "sm-initiative-tracker__header" });
    const nextTurnBtn = header.createEl("button", {
        cls: "sm-initiative-tracker__next-turn",
        text: "Next Turn",
    });
    nextTurnBtn.addEventListener("click", () => callbacks.onAdvanceTurn());

    // Combatant list container
    const listContainer = host.createDiv({ cls: "sm-initiative-tracker__list" });

    let combatants: Combatant[] = [];
    let activeTurnId: string | null = null;

    const setCombatants = (newCombatants: Combatant[]) => {
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

            // Name with optional character class badge
            const nameContainer = info.createDiv({ cls: "sm-initiative-tracker__name-container" });
            nameContainer.createDiv({
                cls: "sm-initiative-tracker__name",
                text: combatant.name,
            });

            // Show character class badge if available
            if (combatant.characterClass) {
                nameContainer.createDiv({
                    cls: "sm-initiative-tracker__class-badge",
                    text: combatant.characterClass,
                });
            }

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
        host.empty();
    };

    return {
        setCombatants,
        setActiveTurn,
        destroy,
    };
}
