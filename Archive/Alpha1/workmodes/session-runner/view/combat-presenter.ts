// src/workmodes/session-runner/view/combat-presenter.ts
// Minimal combat presenter for encounter runner - focuses on initiative and HP tracking only.
// Does NOT include: XP calculation, party management, creature selection, or rule presets.

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-combat-presenter");
import {
    CombatParticipantWithTemp,
    updateParticipantInitiative,
    updateParticipantHp,
    applyDamageToParticipant,
    applyHealingToParticipant,
    updateParticipantTempHp,
    toggleParticipantDefeated,
    sortParticipantsByInitiative,
    findParticipantById,
    updateParticipantInArray,
} from "../combat-logic";

// Re-export interface for backward compatibility
export type { CombatParticipantWithTemp } from "../combat-logic";

/**
 * Combat state with temp HP support
 */
export interface CombatStateWithTemp {
    readonly isActive: boolean;
    readonly participants: ReadonlyArray<CombatParticipantWithTemp>;
    readonly activeParticipantId: string | null;
}

export type CombatStateListener = (state: CombatStateWithTemp) => void;

/**
 * Simple combat presenter for encounter runner.
 * Manages combat state (initiative, HP, temp HP, defeated status) without XP/party/rules complexity.
 */
export class CombatPresenter {
    private state: CombatStateWithTemp;
    private readonly listeners = new Set<CombatStateListener>();

    constructor(initialState?: CombatStateWithTemp | null) {
        this.state = initialState || {
            isActive: false,
            participants: [],
            activeParticipantId: null,
        };
    }

    dispose() {
        this.listeners.clear();
    }

    getState(): CombatStateWithTemp {
        return this.state;
    }

    subscribe(listener: CombatStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state); // Immediate call with current state
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    /**
     * Start combat with given participants (from encounter creatures)
     */
    startCombat(participants: ReadonlyArray<CombatParticipantWithTemp>) {
        if (this.state.isActive) {
            logger.warn("[CombatPresenter] Combat already active");
            return;
        }

        this.state = {
            isActive: true,
            participants: Object.freeze([...participants]) as ReadonlyArray<CombatParticipantWithTemp>,
            activeParticipantId: null,
        };
        this.emit();
        logger.info("[CombatPresenter] Combat started", { participantCount: participants.length });
    }

    /**
     * End combat and clear all participants
     */
    endCombat() {
        if (!this.state.isActive) {
            logger.warn("[CombatPresenter] Combat not active");
            return;
        }

        this.state = {
            isActive: false,
            participants: [],
            activeParticipantId: null,
        };
        this.emit();
        logger.info("[CombatPresenter] Combat ended");
    }

    /**
     * Update participant initiative
     */
    updateInitiative(id: string, initiative: number) {
        if (!this.state.isActive) return;

        const found = findParticipantById(this.state.participants, id);
        if (!found) return;

        const updated = updateParticipantInitiative(found.participant, initiative);
        this.state = {
            ...this.state,
            participants: updateParticipantInArray(this.state.participants, found.index, updated),
        };
        this.emit();
    }

    /**
     * Update participant HP (current and/or max)
     */
    updateHp(id: string, currentHp: number, maxHp?: number) {
        if (!this.state.isActive) return;

        const found = findParticipantById(this.state.participants, id);
        if (!found) return;

        const updated = updateParticipantHp(found.participant, currentHp, maxHp);
        this.state = {
            ...this.state,
            participants: updateParticipantInArray(this.state.participants, found.index, updated),
        };
        this.emit();
    }

    /**
     * Apply damage to participant
     */
    applyDamage(id: string, amount: number) {
        if (!this.state.isActive) return;

        const found = findParticipantById(this.state.participants, id);
        if (!found) return;

        const updated = applyDamageToParticipant(found.participant, amount);
        this.state = {
            ...this.state,
            participants: updateParticipantInArray(this.state.participants, found.index, updated),
        };
        this.emit();
    }

    /**
     * Apply healing to participant (cannot exceed max HP)
     */
    applyHealing(id: string, amount: number) {
        if (!this.state.isActive) return;

        const found = findParticipantById(this.state.participants, id);
        if (!found) return;

        const updated = applyHealingToParticipant(found.participant, amount);
        this.state = {
            ...this.state,
            participants: updateParticipantInArray(this.state.participants, found.index, updated),
        };
        this.emit();
    }

    /**
     * Update temporary HP (replaces existing temp HP, does not stack per 5e rules)
     */
    updateTempHp(id: string, tempHp: number) {
        if (!this.state.isActive) return;

        const found = findParticipantById(this.state.participants, id);
        if (!found) return;

        const updated = updateParticipantTempHp(found.participant, tempHp);
        this.state = {
            ...this.state,
            participants: updateParticipantInArray(this.state.participants, found.index, updated),
        };
        this.emit();
    }

    /**
     * Toggle defeated status
     */
    toggleDefeated(id: string) {
        if (!this.state.isActive) return;

        const found = findParticipantById(this.state.participants, id);
        if (!found) return;

        const updated = toggleParticipantDefeated(found.participant);
        this.state = {
            ...this.state,
            participants: updateParticipantInArray(this.state.participants, found.index, updated),
        };
        this.emit();
    }

    /**
     * Set active participant (for turn tracking)
     */
    setActiveParticipant(id: string | null) {
        if (!this.state.isActive) return;
        if (this.state.activeParticipantId === id) return;

        this.state = {
            ...this.state,
            activeParticipantId: id,
        };
        this.emit();
    }

    /**
     * Sort participants by initiative (descending)
     */
    sortByInitiative() {
        if (!this.state.isActive) return;

        this.state = {
            ...this.state,
            participants: sortParticipantsByInitiative(this.state.participants),
        };
        this.emit();
        logger.info("[CombatPresenter] Participants sorted by initiative");
    }
}
