// src/services/state/adapters/encounter-store-adapter.ts
// Adapter to wrap the existing encounter session-store with the new store interfaces
// Provides compatibility layer for gradual migration

import {
    peekLatestEncounterEvent,
    subscribeToEncounterEvents,
    publishEncounterEvent,
    getEncounterXpState,
    subscribeEncounterXpState,
    setEncounterXp,
    replaceEncounterXpState,
    addPartyMember,
    removePartyMember,
    updatePartyMember,
    addRule,
    removeRule,
    updateRule,
} from "../encounter-session-store";
import type {
    EncounterEvent,
    EncounterEventListener,
    EncounterXpState,
    EncounterXpStateListener,
} from "../encounter-session-store";
import type { ReadableStore, WritableStore } from "../store.interface";

/**
 * Adapter for encounter event store
 * Wraps the existing encounter event pub/sub system
 */
export class EncounterEventStoreAdapter implements WritableStore<EncounterEvent | null> {
    subscribe(subscriber: (value: EncounterEvent | null) => void): () => void {
        // Wrap the existing subscription function
        const listener: EncounterEventListener = (event) => {
            subscriber(event);
        };

        return subscribeToEncounterEvents(listener);
    }

    get(): EncounterEvent | null {
        return peekLatestEncounterEvent();
    }

    set(value: EncounterEvent | null): void {
        if (value) {
            publishEncounterEvent(value);
        }
        // Note: The original implementation doesn't support clearing the event
    }

    update(updater: (value: EncounterEvent | null) => EncounterEvent | null): void {
        const current = this.get();
        const newValue = updater(current);
        this.set(newValue);
    }
}

/**
 * Adapter for encounter XP state store
 * Wraps the existing XP state management
 */
export class EncounterXpStateStoreAdapter implements ReadableStore<EncounterXpState> {
    private _writableProxy?: WritableEncounterXpStateProxy;

    subscribe(subscriber: (value: EncounterXpState) => void): () => void {
        // Wrap the existing subscription function
        const listener: EncounterXpStateListener = (state) => {
            subscriber(state);
        };

        return subscribeEncounterXpState(listener);
    }

    get(): EncounterXpState {
        return getEncounterXpState();
    }

    /**
     * Get a writable proxy for the XP state
     * Note: The original implementation uses separate setters,
     * so we need to provide a special interface
     */
    asWritable(): WritableEncounterXpStateProxy {
        if (!this._writableProxy) {
            this._writableProxy = new WritableEncounterXpStateProxy();
        }
        return this._writableProxy;
    }
}

/**
 * Writable proxy for encounter XP state
 * Provides a WritableStore-like interface while using the original setters
 */
export class WritableEncounterXpStateProxy implements WritableStore<EncounterXpState> {
    /**
     * Set the encounter XP value
     */
    setXp(xp: number): void {
        setEncounterXp(xp);
    }

    /**
     * Add a party member
     */
    addPartyMember(member: EncounterXpState["party"][0]): void {
        addPartyMember(member);
    }

    /**
     * Update a party member
     */
    updatePartyMember(id: string, updates: Partial<EncounterXpState["party"][0]>): void {
        updatePartyMember(id, updates);
    }

    /**
     * Remove a party member
     */
    removePartyMember(id: string): void {
        removePartyMember(id);
    }

    /**
     * Add a rule
     */
    addRule(rule: EncounterXpState["rules"][0]): void {
        addRule(rule);
    }

    /**
     * Update a rule
     */
    updateRule(ruleId: string, updates: Partial<EncounterXpState["rules"][0]>): void {
        updateRule(ruleId, updates);
    }

    /**
     * Remove a rule
     */
    removeRule(ruleId: string): void {
        removeRule(ruleId);
    }

    /**
     * Get current state
     */
    get(): EncounterXpState {
        return getEncounterXpState();
    }

    /**
     * Set complete state
     */
    set(value: EncounterXpState): void {
        replaceEncounterXpState(value);
    }

    /**
     * Update state with a function
     */
    update(updater: (value: EncounterXpState) => EncounterXpState): void {
        const current = this.get();
        const newState = updater(current);
        this.set(newState);
    }

    /**
     * Subscribe to changes
     */
    subscribe(subscriber: (value: EncounterXpState) => void): () => void {
        return subscribeEncounterXpState(subscriber);
    }
}

/**
 * Factory function to create encounter store adapters
 */
export function createEncounterStoreAdapters() {
    return {
        events: new EncounterEventStoreAdapter(),
        xpState: new EncounterXpStateStoreAdapter(),
    };
}

// Re-export types for convenience
export type { EncounterEvent, EncounterXpState } from "../encounter-session-store";