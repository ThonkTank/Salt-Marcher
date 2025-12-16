// src/services/state/encounter-session-store.ts
// Lightweight pub/sub store bridging travel events and the encounter workspace.
// Keeps the most recent encounter payload so that freshly mounted presenters can
// render the last travel hand-off without waiting for another event.

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('state-encounter-session');
import {
    getPartyState,
    subscribePartyState,
    addPartyMember as addPartyMemberToStore,
    updatePartyMember as updatePartyMemberInStore,
    removePartyMember as removePartyMemberFromStore,
} from "./party-store";
import type { PartyMember } from "./party-store";
import type {
    EncounterEvent,
    EncounterEventListener,
    EncounterEventSource,
    EncounterRuleModifierType,
    EncounterRuleScope,
    EncounterXpRule,
    EncounterXpState,
    EncounterXpStateDraft,
    EncounterXpStateListener,
    EncounterCreature,
    CombatParticipant,
    CombatState,
} from "../domain/encounter-types";

// Re-export PartyMember from shared store for backward compatibility
export type EncounterPartyMember = PartyMember;

// Re-export all domain types from services layer
export type {
    EncounterEvent,
    EncounterEventListener,
    EncounterEventSource,
    EncounterRuleModifierType,
    EncounterRuleScope,
    EncounterXpRule,
    EncounterXpState,
    EncounterXpStateDraft,
    EncounterXpStateListener,
    EncounterCreature,
    CombatParticipant,
    CombatState,
} from "../domain/encounter-types";

export const DND5E_XP_THRESHOLDS: Record<number, number> = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000,
};

type MutableEncounterXpState = EncounterXpStateDraft;

let latestEvent: EncounterEvent | null = null;
const listeners = new Set<EncounterEventListener>();

let encounterXpState: MutableEncounterXpState = createInitialEncounterXpState();
const xpStateListeners = new Set<EncounterXpStateListener>();

function createInitialEncounterXpState(): MutableEncounterXpState {
    return {
        // Party is read from shared store, not stored here
        encounterXp: 0,
        rules: [],
    };
}

function cloneRule(rule: EncounterXpRule): EncounterXpRule {
    return { ...rule };
}

function cloneMutableEncounterXpState(state: MutableEncounterXpState): MutableEncounterXpState {
    return {
        // Party is read from shared store, not cloned here
        encounterXp: state.encounterXp,
        rules: state.rules.map(cloneRule),
    };
}

/**
 * Get current XP state with party from shared store
 */
function getEncounterXpStateWithParty(): EncounterXpState {
    const partyState = getPartyState();
    return {
        party: partyState.members,
        encounterXp: encounterXpState.encounterXp,
        rules: encounterXpState.rules.map(cloneRule),
    };
}

function createImmutableEncounterXpState(state: MutableEncounterXpState): EncounterXpState {
    // Party is read from shared store
    const partyState = getPartyState();
    const party = Object.freeze([...partyState.members]) as ReadonlyArray<EncounterPartyMember>;
    const rules = Object.freeze(state.rules.map(cloneRule)) as ReadonlyArray<EncounterXpRule>;
    return {
        party,
        encounterXp: state.encounterXp,
        rules,
    };
}

function emitEncounterXpState(): EncounterXpState {
    const snapshot = createImmutableEncounterXpState(encounterXpState);
    if (!xpStateListeners.size) {
        return snapshot;
    }
    for (const listener of [...xpStateListeners]) {
        try {
            listener(snapshot);
        } catch (err) {
            logger.error("xp listener failed", err);
        }
    }
    return snapshot;
}

// Lazy initialization: Subscribe to party store on first access to avoid
// accessing the store before plugin initialization completes
let partySubscriptionInitialized = false;

function ensurePartySubscription() {
    if (partySubscriptionInitialized) return;
    partySubscriptionInitialized = true;

    // Subscribe to party store changes to trigger XP state updates
    subscribePartyState(() => {
        // Party changed in shared store, emit XP state update
        emitEncounterXpState();
    });
}

export function publishEncounterEvent(event: EncounterEvent) {
    latestEvent = event;
    for (const listener of [...listeners]) {
        try {
            listener(event);
        } catch (err) {
            logger.error("listener failed", err);
        }
    }
}

export function subscribeToEncounterEvents(listener: EncounterEventListener): () => void {
    listeners.add(listener);
    if (latestEvent) {
        try {
            listener(latestEvent);
        } catch (err) {
            logger.error("listener failed", err);
        }
    }
    return () => {
        listeners.delete(listener);
    };
}

export function peekLatestEncounterEvent(): EncounterEvent | null {
    return latestEvent;
}

export function getEncounterXpState(): EncounterXpState {
    ensurePartySubscription();
    return createImmutableEncounterXpState(encounterXpState);
}

export function subscribeEncounterXpState(listener: EncounterXpStateListener): () => void {
    ensurePartySubscription();
    xpStateListeners.add(listener);
    try {
        listener(getEncounterXpState());
    } catch (err) {
        logger.error("xp listener failed", err);
    }
    return () => {
        xpStateListeners.delete(listener);
    };
}

export function updateEncounterXpState(mutator: (draft: EncounterXpStateDraft) => void): EncounterXpState {
    ensurePartySubscription();
    const next = cloneMutableEncounterXpState(encounterXpState);
    mutator(next);
    encounterXpState = next;
    return emitEncounterXpState();
}

export function setEncounterXp(value: number): EncounterXpState {
    return updateEncounterXpState((draft) => {
        draft.encounterXp = value;
    });
}

export function addPartyMember(member: EncounterPartyMember): EncounterXpState {
    // Delegate to shared party store
    addPartyMemberToStore(member);
    // Return current state (party will be included from shared store)
    return getEncounterXpState();
}

export function updatePartyMember(id: string, patch: Partial<EncounterPartyMember>): EncounterXpState {
    // Delegate to shared party store
    updatePartyMemberInStore(id, patch);
    // Return current state (party will be included from shared store)
    return getEncounterXpState();
}

export function removePartyMember(id: string): EncounterXpState {
    // Delegate to shared party store
    removePartyMemberFromStore(id);
    // Return current state (party will be included from shared store)
    return getEncounterXpState();
}

export function addRule(rule: EncounterXpRule): EncounterXpState {
    return updateEncounterXpState((draft) => {
        draft.rules.push(cloneRule(rule));
    });
}

export function updateRule(id: string, patch: Partial<EncounterXpRule>): EncounterXpState {
    return updateEncounterXpState((draft) => {
        const index = draft.rules.findIndex((rule) => rule.id === id);
        if (index === -1) {
            return;
        }
        draft.rules[index] = { ...draft.rules[index], ...patch };
    });
}

export function removeRule(id: string): EncounterXpState {
    return updateEncounterXpState((draft) => {
        draft.rules = draft.rules.filter((rule) => rule.id !== id);
    });
}

export function replaceEncounterXpState(state: EncounterXpState): EncounterXpState {
    // Note: Party is NOT stored locally anymore, it stays in shared party-store
    // This function now only replaces encounterXp and rules
    encounterXpState = {
        encounterXp: state.encounterXp,
        rules: state.rules.map(cloneRule),
    };
    return emitEncounterXpState();
}

// Test utility to avoid leaking state between vitest runs. Not exported publicly
// in bundles (tree-shaken when unused in production code).
export function __resetEncounterEventStore() {
    latestEvent = null;
    listeners.clear();
    encounterXpState = createInitialEncounterXpState();
    xpStateListeners.clear();
}
