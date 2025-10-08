// src/apps/encounter/session-store.ts
// Lightweight pub/sub store bridging travel events and the encounter workspace.
// Keeps the most recent encounter payload so that freshly mounted presenters can
// render the last travel hand-off without waiting for another event.

import type { Coord } from "../cartographer/travel/domain/types";

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

export type EncounterRuleScope = "overall" | "perPlayer";

export type EncounterRuleModifierType = "flat" | "percentTotal" | "percentNextLevel";

export interface EncounterPartyMember {
    readonly id: string;
    readonly name: string;
    readonly level: number;
    readonly currentXp?: number;
}

export interface EncounterXpRule {
    readonly id: string;
    readonly title: string;
    readonly scope: EncounterRuleScope;
    readonly modifierType: EncounterRuleModifierType;
    readonly modifierValue: number;
    readonly enabled: boolean;
    readonly notes?: string;
}

export interface EncounterXpState {
    readonly party: ReadonlyArray<EncounterPartyMember>;
    readonly encounterXp: number;
    readonly rules: ReadonlyArray<EncounterXpRule>;
}

export interface EncounterXpStateDraft {
    party: EncounterPartyMember[];
    encounterXp: number;
    rules: EncounterXpRule[];
}

type MutableEncounterXpState = EncounterXpStateDraft;

export type EncounterXpStateListener = (state: EncounterXpState) => void;

export type EncounterEventSource = "travel" | "manual";

export interface EncounterEvent {
    /** Stable identifier for deduplication across store/presenter instances. */
    readonly id: string;
    /** Origin of the encounter (e.g. travel hand-off). */
    readonly source: EncounterEventSource;
    /** ISO timestamp of the triggering moment. */
    readonly triggeredAt: string;
    readonly coord: Coord | null;
    readonly regionName?: string;
    readonly mapPath?: string;
    readonly mapName?: string;
    readonly encounterOdds?: number;
    readonly travelClockHours?: number;
}

export type EncounterEventListener = (event: EncounterEvent) => void;

let latestEvent: EncounterEvent | null = null;
const listeners = new Set<EncounterEventListener>();

let encounterXpState: MutableEncounterXpState = createInitialEncounterXpState();
const xpStateListeners = new Set<EncounterXpStateListener>();

function createInitialEncounterXpState(): MutableEncounterXpState {
    return {
        party: [],
        encounterXp: 0,
        rules: [],
    };
}

function clonePartyMember(member: EncounterPartyMember): EncounterPartyMember {
    return { ...member };
}

function cloneRule(rule: EncounterXpRule): EncounterXpRule {
    return { ...rule };
}

function cloneMutableEncounterXpState(state: MutableEncounterXpState): MutableEncounterXpState {
    return {
        party: state.party.map(clonePartyMember),
        encounterXp: state.encounterXp,
        rules: state.rules.map(cloneRule),
    };
}

function createImmutableEncounterXpState(state: MutableEncounterXpState): EncounterXpState {
    const party = Object.freeze(state.party.map(clonePartyMember)) as ReadonlyArray<EncounterPartyMember>;
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
            console.error("[encounter] xp listener failed", err);
        }
    }
    return snapshot;
}

export function publishEncounterEvent(event: EncounterEvent) {
    latestEvent = event;
    for (const listener of [...listeners]) {
        try {
            listener(event);
        } catch (err) {
            console.error("[encounter] listener failed", err);
        }
    }
}

export function subscribeToEncounterEvents(listener: EncounterEventListener): () => void {
    listeners.add(listener);
    if (latestEvent) {
        try {
            listener(latestEvent);
        } catch (err) {
            console.error("[encounter] listener failed", err);
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
    return createImmutableEncounterXpState(encounterXpState);
}

export function subscribeEncounterXpState(listener: EncounterXpStateListener): () => void {
    xpStateListeners.add(listener);
    try {
        listener(getEncounterXpState());
    } catch (err) {
        console.error("[encounter] xp listener failed", err);
    }
    return () => {
        xpStateListeners.delete(listener);
    };
}

export function updateEncounterXpState(mutator: (draft: EncounterXpStateDraft) => void): EncounterXpState {
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
    return updateEncounterXpState((draft) => {
        draft.party.push(clonePartyMember(member));
    });
}

export function updatePartyMember(id: string, patch: Partial<EncounterPartyMember>): EncounterXpState {
    return updateEncounterXpState((draft) => {
        const index = draft.party.findIndex((member) => member.id === id);
        if (index === -1) {
            return;
        }
        draft.party[index] = { ...draft.party[index], ...patch };
    });
}

export function removePartyMember(id: string): EncounterXpState {
    return updateEncounterXpState((draft) => {
        draft.party = draft.party.filter((member) => member.id !== id);
    });
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
    encounterXpState = {
        party: state.party.map(clonePartyMember),
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
